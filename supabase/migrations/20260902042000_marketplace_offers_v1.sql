-- Listing-bound monetary offers. Offer rows are private and immutable to clients;
-- all state transitions happen through SECURITY DEFINER RPCs with participant checks.
create table if not exists private.marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.marketplace_conversations(id) on delete cascade,
  proposer_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  message text null check (message is null or char_length(btrim(message)) between 1 and 500),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','COUNTERED')),
  parent_offer_id uuid null references private.marketplace_offers(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create unique index if not exists marketplace_offers_one_pending_per_conversation_idx
  on private.marketplace_offers(conversation_id) where status = 'PENDING';
create index if not exists marketplace_offers_conversation_created_idx
  on private.marketplace_offers(conversation_id, created_at asc);

revoke all on table private.marketplace_offers from public, anon, authenticated;

create or replace function public.make_my_marketplace_offer(
  p_conversation_id uuid,
  p_amount_cents bigint,
  p_message text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_buyer uuid;
  v_seller uuid;
  v_status text;
  v_offer uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 100000000000 then
    raise exception 'INVALID_OFFER_AMOUNT';
  end if;
  if p_message is not null and char_length(btrim(p_message)) not between 1 and 500 then
    raise exception 'INVALID_OFFER_MESSAGE';
  end if;

  select c.buyer_id, c.seller_id, c.status
    into v_buyer, v_seller, v_status
  from private.marketplace_conversations c
  where c.id = p_conversation_id
  for update;

  if v_user <> v_buyer then raise exception 'BUYER_ONLY'; end if;
  if v_status <> 'OPEN' then raise exception 'CONVERSATION_NOT_OPEN'; end if;
  if exists (
    select 1 from private.marketplace_offers o
    where o.conversation_id = p_conversation_id and o.status = 'PENDING'
  ) then raise exception 'PENDING_OFFER_EXISTS'; end if;

  insert into private.marketplace_offers(conversation_id, proposer_id, amount_cents, message)
  values (p_conversation_id, v_user, p_amount_cents, nullif(btrim(p_message), ''))
  returning id into v_offer;

  update private.marketplace_conversations set updated_at = now() where id = p_conversation_id;
  return v_offer;
end;
$$;

create or replace function public.respond_to_my_marketplace_offer(
  p_offer_id uuid,
  p_action text,
  p_counter_amount_cents bigint default null,
  p_counter_message text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_conversation uuid;
  v_item uuid;
  v_buyer uuid;
  v_seller uuid;
  v_conversation_status text;
  v_proposer uuid;
  v_offer_status text;
  v_new_offer uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_action not in ('ACCEPT','DECLINE','COUNTER') then raise exception 'INVALID_OFFER_ACTION'; end if;

  select o.conversation_id, o.proposer_id, o.status,
         c.item_id, c.buyer_id, c.seller_id, c.status
    into v_conversation, v_proposer, v_offer_status,
         v_item, v_buyer, v_seller, v_conversation_status
  from private.marketplace_offers o
  join private.marketplace_conversations c on c.id = o.conversation_id
  where o.id = p_offer_id
  for update of o, c;

  if v_conversation is null or v_user not in (v_buyer, v_seller) then raise exception 'NOT_ALLOWED'; end if;
  if v_user = v_proposer then raise exception 'PROPOSER_CANNOT_RESPOND'; end if;
  if v_offer_status <> 'PENDING' then raise exception 'OFFER_NOT_PENDING'; end if;
  if v_conversation_status <> 'OPEN' then raise exception 'CONVERSATION_NOT_OPEN'; end if;

  if p_action = 'DECLINE' then
    update private.marketplace_offers set status='DECLINED', responded_at=now() where id=p_offer_id;
    update private.marketplace_conversations set updated_at=now() where id=v_conversation;
    return p_offer_id;
  end if;

  if p_action = 'COUNTER' then
    if p_counter_amount_cents is null or p_counter_amount_cents < 1 or p_counter_amount_cents > 100000000000 then
      raise exception 'INVALID_OFFER_AMOUNT';
    end if;
    if p_counter_message is not null and char_length(btrim(p_counter_message)) not between 1 and 500 then
      raise exception 'INVALID_OFFER_MESSAGE';
    end if;
    update private.marketplace_offers set status='COUNTERED', responded_at=now() where id=p_offer_id;
    insert into private.marketplace_offers(conversation_id, proposer_id, amount_cents, message, parent_offer_id)
    values(v_conversation, v_user, p_counter_amount_cents, nullif(btrim(p_counter_message), ''), p_offer_id)
    returning id into v_new_offer;
    update private.marketplace_conversations set updated_at=now() where id=v_conversation;
    return v_new_offer;
  end if;

  -- ACCEPT: the accepted offer becomes the agreed amount and atomically reserves
  -- this listing for the conversation. Sale completion/final price remains a later seller action.
  update private.marketplace_offers set status='ACCEPTED', responded_at=now() where id=p_offer_id;
  update private.marketplace_conversations
    set status='RESERVED', updated_at=now()
    where id=v_conversation;
  update private.marketplace_conversations
    set status='CLOSED', updated_at=now()
    where item_id=v_item and id<>v_conversation and status in ('OPEN','RESERVED');
  update private.marketplace_listings
    set status='WITHDRAWN', published_at=null, updated_at=now()
    where item_id=v_item and seller_id=v_seller;
  insert into private.item_market_state(item_id, market_state, updated_at)
    values(v_item,'RESERVED',now())
    on conflict(item_id) do update set market_state=excluded.market_state, updated_at=now();
  return p_offer_id;
end;
$$;

create or replace function public.load_my_marketplace_offers(p_conversation_id uuid)
returns table(
  offer_id uuid,
  proposer_role text,
  amount_cents bigint,
  message text,
  status text,
  parent_offer_id uuid,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select o.id,
    case when o.proposer_id=auth.uid() then 'ME' else 'OTHER' end,
    o.amount_cents, o.message, o.status, o.parent_offer_id, o.created_at, o.responded_at
  from private.marketplace_offers o
  join private.marketplace_conversations c on c.id=o.conversation_id
  where c.id=p_conversation_id and auth.uid() in (c.buyer_id,c.seller_id)
  order by o.created_at asc;
$$;

revoke all on function public.make_my_marketplace_offer(uuid,bigint,text) from public, anon;
revoke all on function public.respond_to_my_marketplace_offer(uuid,text,bigint,text) from public, anon;
revoke all on function public.load_my_marketplace_offers(uuid) from public, anon;
grant execute on function public.make_my_marketplace_offer(uuid,bigint,text) to authenticated;
grant execute on function public.respond_to_my_marketplace_offer(uuid,text,bigint,text) to authenticated;
grant execute on function public.load_my_marketplace_offers(uuid) to authenticated;

comment on table private.marketplace_offers is
  'Private immutable offer history for listing-bound conversations. Clients use guarded RPCs only.';
