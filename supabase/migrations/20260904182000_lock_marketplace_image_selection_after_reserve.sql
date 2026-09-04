-- Freeze the seller-selected Marketplace image set once a concrete buyer reservation exists.
-- Image selection and every direct reserve/sold transition share the same per-Thing
-- advisory transaction lock already used by offer acceptance. This closes the race
-- where an image toggle could otherwise commit after a concurrent reservation.
create or replace function public.set_my_item_image_marketplace_visibility(
  p_item_id uuid,
  p_image_id uuid,
  p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_current boolean;
  v_visible_count integer;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  -- Validate ownership before taking an advisory lock for a caller-supplied UUID.
  perform 1
  from private.item_images ii
  join public.items i on i.id = ii.item_id
  where ii.id = p_image_id
    and ii.item_id = p_item_id
    and ii.owner_id = v_owner
    and i.owner_id = v_owner;

  if not found then
    raise exception 'IMAGE_NOT_OWNED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text, 0));

  -- Re-read authoritative state after acquiring the shared per-Thing lock.
  select ii.marketplace_visible into v_current
  from private.item_images ii
  join public.items i on i.id = ii.item_id
  where ii.id = p_image_id
    and ii.item_id = p_item_id
    and ii.owner_id = v_owner
    and i.owner_id = v_owner;

  if not found then
    raise exception 'IMAGE_NOT_OWNED';
  end if;

  if exists (
    select 1
    from private.marketplace_conversations c
    where c.item_id = p_item_id
      and c.seller_id = v_owner
      and c.status in ('RESERVED', 'SOLD')
  ) then
    raise exception 'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION';
  end if;

  if coalesce(p_visible, false) and not v_current then
    select count(*) into v_visible_count
    from private.item_images ii
    where ii.item_id = p_item_id
      and ii.owner_id = v_owner
      and ii.marketplace_visible;

    if v_visible_count >= 6 then
      raise exception 'MARKETPLACE_IMAGE_LIMIT_REACHED';
    end if;
  end if;

  update private.item_images
  set marketplace_visible = coalesce(p_visible, false)
  where id = p_image_id
    and item_id = p_item_id
    and owner_id = v_owner;

  return coalesce(p_visible, false);
end;
$$;

revoke all on function public.set_my_item_image_marketplace_visibility(uuid,uuid,boolean) from public, anon;
grant execute on function public.set_my_item_image_marketplace_visibility(uuid,uuid,boolean) to authenticated;

comment on function public.set_my_item_image_marketplace_visibility(uuid,uuid,boolean) is
  'Lets an authenticated owner select up to six Marketplace images before reservation; selection is serialized per Thing and frozen while a reserved/sold transaction exists.';

-- Keep the legacy lifecycle RPC race-safe for older clients that still call it.
create or replace function public.set_my_marketplace_conversation_status(
  p_conversation_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid := auth.uid();
  v_item uuid;
  v_current text;
begin
  if v_seller is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_status not in ('RESERVED','SOLD') then raise exception 'INVALID_LIFECYCLE_STATUS'; end if;

  select c.item_id into v_item
  from private.marketplace_conversations c
  where c.id = p_conversation_id and c.seller_id = v_seller;
  if v_item is null then raise exception 'NOT_ALLOWED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_item::text, 0));

  select c.item_id, c.status into v_item, v_current
  from private.marketplace_conversations c
  where c.id = p_conversation_id and c.seller_id = v_seller
  for update;

  if v_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_current in ('SOLD','CLOSED') then raise exception 'CONVERSATION_CLOSED'; end if;
  if p_status = 'SOLD' and v_current <> 'RESERVED' then raise exception 'RESERVATION_REQUIRED'; end if;

  update private.marketplace_conversations set status=p_status, updated_at=now() where id=p_conversation_id;
  update private.marketplace_conversations
    set status='CLOSED', updated_at=now()
    where item_id=v_item and id<>p_conversation_id and status in ('OPEN','RESERVED');
  update private.marketplace_listings
    set status='WITHDRAWN', published_at=null, updated_at=now()
    where item_id=v_item and seller_id=v_seller;
  insert into private.item_market_state(item_id,market_state,updated_at)
    values(v_item,p_status,now())
    on conflict(item_id) do update set market_state=excluded.market_state, updated_at=now();
  return p_status;
end;
$$;

revoke all on function public.set_my_marketplace_conversation_status(uuid,text) from public, anon;
grant execute on function public.set_my_marketplace_conversation_status(uuid,text) to authenticated;

-- Current lifecycle RPC uses the same lock before re-reading and mutating state.
create or replace function public.set_my_marketplace_conversation_status_v2(
  p_conversation_id uuid,
  p_status text,
  p_final_sale_price_cents bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid := auth.uid();
  v_item uuid;
  v_current text;
begin
  if v_seller is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_status not in ('RESERVED','SOLD') then raise exception 'INVALID_LIFECYCLE_STATUS'; end if;
  if p_status='RESERVED' and p_final_sale_price_cents is not null then raise exception 'FINAL_PRICE_ONLY_FOR_SOLD'; end if;
  if p_status='SOLD' and (p_final_sale_price_cents is null or p_final_sale_price_cents <= 0 or p_final_sale_price_cents > 1000000000) then
    raise exception 'VALID_FINAL_SALE_PRICE_REQUIRED';
  end if;

  select c.item_id into v_item
  from private.marketplace_conversations c
  where c.id=p_conversation_id and c.seller_id=v_seller;
  if v_item is null then raise exception 'NOT_ALLOWED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_item::text, 0));

  select c.item_id,c.status into v_item,v_current
  from private.marketplace_conversations c
  where c.id=p_conversation_id and c.seller_id=v_seller
  for update;

  if v_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_current in ('SOLD','CLOSED') then raise exception 'CONVERSATION_CLOSED'; end if;
  if p_status='SOLD' and v_current<>'RESERVED' then raise exception 'RESERVATION_REQUIRED'; end if;

  update private.marketplace_conversations set status=p_status,updated_at=now() where id=p_conversation_id;
  update private.marketplace_conversations
    set status='CLOSED',updated_at=now()
    where item_id=v_item and id<>p_conversation_id and status in ('OPEN','RESERVED');
  update private.marketplace_listings
    set status='WITHDRAWN', published_at=null,
        sold_price_cents=case when p_status='SOLD' then p_final_sale_price_cents else sold_price_cents end,
        updated_at=now()
    where item_id=v_item and seller_id=v_seller;
  insert into private.item_market_state(item_id,market_state,updated_at)
    values(v_item,p_status,now())
    on conflict(item_id) do update set market_state=excluded.market_state,updated_at=now();
  return p_status;
end;
$$;

revoke all on function public.set_my_marketplace_conversation_status_v2(uuid,text,bigint) from public, anon;
grant execute on function public.set_my_marketplace_conversation_status_v2(uuid,text,bigint) to authenticated;

comment on function public.set_my_marketplace_conversation_status_v2(uuid,text,bigint) is
  'Seller-only reserve/sold transition serialized per Thing with image selection and offer acceptance. SOLD requires an explicit final transaction price.';
