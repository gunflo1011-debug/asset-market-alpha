create table private.match_condition_evidence (
  match_id uuid primary key references private.matches(id) on delete cascade,
  condition_snapshot_id uuid not null unique references public.condition_snapshots(id),
  created_at timestamptz not null default now()
);

create table private.liquidity_contracts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references private.matches(id) on delete cascade,
  version integer not null check (version > 0),
  agreed_price_cents integer not null check (agreed_price_cents > 0),
  condition_snapshot_id uuid not null references public.condition_snapshots(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(match_id, version)
);

create table private.trade_receipts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references private.matches(id),
  final_price_cents integer not null check (final_price_cents > 0),
  condition_snapshot_id uuid not null references public.condition_snapshots(id),
  confirmed_at timestamptz not null default now()
);

revoke all on private.match_condition_evidence from public, anon, authenticated;
revoke all on private.liquidity_contracts from public, anon, authenticated;
revoke all on private.trade_receipts from public, anon, authenticated;

create or replace function private.refresh_trade_condition(
  p_match uuid,
  p_display_state text,
  p_housing_state text,
  p_cameras_working boolean,
  p_biometrics_working boolean,
  p_battery_health smallint,
  p_network_locked boolean,
  p_other_defect boolean,
  p_idempotency uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
  v_owner uuid;
  v_status text;
  v_snapshot uuid;
begin
  select m.item_id, i.owner_id, m.status
    into v_item, v_owner, v_status
  from private.matches m
  join public.items i on i.id = m.item_id
  where m.id = p_match
  for update of m;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  select condition_snapshot_id into v_snapshot
  from private.match_condition_evidence
  where match_id = p_match;

  if v_snapshot is not null then
    return v_snapshot;
  end if;

  if v_status <> 'OWNER_INTERESTED' then
    raise exception 'invalid_state';
  end if;

  if p_battery_health is not null and (p_battery_health < 0 or p_battery_health > 100) then
    raise exception 'invalid_battery';
  end if;

  insert into public.condition_snapshots(
    item_id, purpose, display_state, housing_state, cameras_working,
    biometrics_working, battery_health, network_locked, other_defect
  ) values (
    v_item, 'TRADE_REFRESH', p_display_state, p_housing_state, p_cameras_working,
    p_biometrics_working, p_battery_health, p_network_locked, coalesce(p_other_defect, false)
  ) returning id into v_snapshot;

  insert into private.match_condition_evidence(match_id, condition_snapshot_id)
  values(p_match, v_snapshot);

  update private.matches
  set status = 'CONDITION_REFRESHED', updated_at = now()
  where id = p_match;

  insert into private.match_events(match_id, actor_id, event_type, idempotency_key, payload)
  values(
    p_match, auth.uid(), 'CONDITION_REFRESHED', p_idempotency,
    jsonb_build_object('condition_snapshot_id', v_snapshot)
  );

  return v_snapshot;
end;
$$;

create or replace function private.buyer_reconfirm(
  p_match uuid,
  p_idempotency uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid;
  v_status text;
begin
  select bi.buyer_id, m.status
    into v_buyer, v_status
  from private.matches m
  join private.buyer_intents bi on bi.id = m.buyer_intent_id
  where m.id = p_match
  for update of m;

  if v_buyer is null or v_buyer <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  if exists(
    select 1 from private.match_events e
    where e.match_id = p_match and e.idempotency_key = p_idempotency
  ) then
    return v_status;
  end if;

  if v_status <> 'CONDITION_REFRESHED' then
    raise exception 'invalid_state';
  end if;

  update private.matches
  set status = 'BUYER_RECONFIRMED', updated_at = now()
  where id = p_match;

  insert into private.match_events(match_id, actor_id, event_type, idempotency_key)
  values(p_match, auth.uid(), 'BUYER_RECONFIRMED', p_idempotency);

  return 'BUYER_RECONFIRMED';
end;
$$;

create or replace function private.create_reservation(
  p_match uuid,
  p_agreed_price_cents integer,
  p_expires_at timestamptz,
  p_idempotency uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid;
  v_status text;
  v_item uuid;
  v_snapshot uuid;
  v_contract uuid;
  v_version integer;
begin
  select bi.buyer_id, m.status, m.item_id
    into v_buyer, v_status, v_item
  from private.matches m
  join private.buyer_intents bi on bi.id = m.buyer_intent_id
  where m.id = p_match
  for update of m;

  if v_buyer is null or v_buyer <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  select (e.payload->>'contract_id')::uuid into v_contract
  from private.match_events e
  where e.match_id = p_match and e.idempotency_key = p_idempotency;

  if v_contract is not null then
    return v_contract;
  end if;

  if v_status <> 'BUYER_RECONFIRMED' then
    raise exception 'invalid_state';
  end if;
  if p_agreed_price_cents <= 0 then
    raise exception 'invalid_price';
  end if;
  if p_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  select condition_snapshot_id into v_snapshot
  from private.match_condition_evidence
  where match_id = p_match;

  if v_snapshot is null then
    raise exception 'fresh_condition_required';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from private.liquidity_contracts
  where match_id = p_match;

  insert into private.liquidity_contracts(
    match_id, version, agreed_price_cents, condition_snapshot_id, expires_at
  ) values (
    p_match, v_version, p_agreed_price_cents, v_snapshot, p_expires_at
  ) returning id into v_contract;

  update private.matches
  set status = 'RESERVED', updated_at = now()
  where id = p_match;

  update private.item_market_state
  set market_state = 'RESERVED', updated_at = now()
  where item_id = v_item;

  update private.buyer_intents
  set status = 'RESERVED'
  where id = (select buyer_intent_id from private.matches where id = p_match);

  insert into private.match_events(match_id, actor_id, event_type, idempotency_key, payload)
  values(
    p_match, auth.uid(), 'RESERVATION_CREATED', p_idempotency,
    jsonb_build_object('contract_id', v_contract)
  );

  return v_contract;
end;
$$;

create or replace function private.confirm_handover(
  p_match uuid,
  p_final_price_cents integer,
  p_idempotency uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_buyer uuid;
  v_status text;
  v_item uuid;
  v_snapshot uuid;
  v_receipt uuid;
  v_owner_price integer;
  v_buyer_price integer;
begin
  select i.owner_id, bi.buyer_id, m.status, m.item_id
    into v_owner, v_buyer, v_status, v_item
  from private.matches m
  join public.items i on i.id = m.item_id
  join private.buyer_intents bi on bi.id = m.buyer_intent_id
  where m.id = p_match
  for update of m;

  if auth.uid() not in (v_owner, v_buyer) then
    raise exception 'not_allowed';
  end if;

  select tr.id into v_receipt
  from private.trade_receipts tr
  where tr.match_id = p_match;

  if v_receipt is not null then
    return v_receipt;
  end if;

  if v_status <> 'MEETING_AGREED' then
    raise exception 'invalid_state';
  end if;
  if p_final_price_cents <= 0 then
    raise exception 'invalid_price';
  end if;

  if not exists(
    select 1 from private.match_events e
    where e.match_id = p_match and e.idempotency_key = p_idempotency
  ) then
    insert into private.match_events(match_id, actor_id, event_type, idempotency_key, payload)
    values(
      p_match, auth.uid(), 'HANDOVER_PARTY_CONFIRMED', p_idempotency,
      jsonb_build_object('final_price_cents', p_final_price_cents)
    );
  end if;

  select (e.payload->>'final_price_cents')::integer into v_owner_price
  from private.match_events e
  where e.match_id = p_match
    and e.event_type = 'HANDOVER_PARTY_CONFIRMED'
    and e.actor_id = v_owner
  order by e.created_at desc
  limit 1;

  select (e.payload->>'final_price_cents')::integer into v_buyer_price
  from private.match_events e
  where e.match_id = p_match
    and e.event_type = 'HANDOVER_PARTY_CONFIRMED'
    and e.actor_id = v_buyer
  order by e.created_at desc
  limit 1;

  if v_owner_price is null or v_buyer_price is null then
    return null;
  end if;

  if v_owner_price <> v_buyer_price then
    raise exception 'handover_price_mismatch';
  end if;

  select condition_snapshot_id into v_snapshot
  from private.match_condition_evidence
  where match_id = p_match;

  if v_snapshot is null then
    raise exception 'fresh_condition_required';
  end if;

  insert into private.trade_receipts(match_id, final_price_cents, condition_snapshot_id)
  values(p_match, v_owner_price, v_snapshot)
  returning id into v_receipt;

  update private.matches
  set status = 'HANDOVER_CONFIRMED', updated_at = now()
  where id = p_match;

  update private.item_market_state
  set market_state = 'SOLD', updated_at = now()
  where item_id = v_item;

  update private.buyer_intents
  set status = 'CLOSED'
  where id = (select buyer_intent_id from private.matches where id = p_match);

  return v_receipt;
end;
$$;

revoke execute on function private.refresh_trade_condition(uuid,text,text,boolean,boolean,smallint,boolean,boolean,uuid) from public, anon;
revoke execute on function private.buyer_reconfirm(uuid,uuid) from public, anon;
revoke execute on function private.create_reservation(uuid,integer,timestamptz,uuid) from public, anon;
revoke execute on function private.confirm_handover(uuid,integer,uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.refresh_trade_condition(uuid,text,text,boolean,boolean,smallint,boolean,boolean,uuid) to authenticated;
grant execute on function private.buyer_reconfirm(uuid,uuid) to authenticated;
grant execute on function private.create_reservation(uuid,integer,timestamptz,uuid) to authenticated;
grant execute on function private.confirm_handover(uuid,integer,uuid) to authenticated;
