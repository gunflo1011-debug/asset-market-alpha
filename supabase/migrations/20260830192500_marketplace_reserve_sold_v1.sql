-- Seller-controlled lifecycle for listing-bound Marketplace conversations.
-- Reservation and sale remain explicit seller actions. No buyer can mutate lifecycle.
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
  if v_seller is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_status not in ('RESERVED','SOLD') then
    raise exception 'INVALID_LIFECYCLE_STATUS';
  end if;

  select c.item_id, c.status
    into v_item, v_current
  from private.marketplace_conversations c
  where c.id = p_conversation_id and c.seller_id = v_seller
  for update;

  if v_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_current in ('SOLD','CLOSED') then raise exception 'CONVERSATION_CLOSED'; end if;
  if p_status = 'SOLD' and v_current <> 'RESERVED' then
    raise exception 'RESERVATION_REQUIRED';
  end if;

  update private.marketplace_conversations
  set status = p_status, updated_at = now()
  where id = p_conversation_id;

  update private.marketplace_conversations
  set status = 'CLOSED', updated_at = now()
  where item_id = v_item
    and id <> p_conversation_id
    and status in ('OPEN','RESERVED');

  -- A reserved/sold item is no longer publicly discoverable. The existing
  -- listing record remains the single source of asking-price history.
  update private.marketplace_listings
  set status = 'WITHDRAWN', published_at = null, updated_at = now()
  where item_id = v_item and seller_id = v_seller;

  insert into private.item_market_state(item_id, market_state, updated_at)
  values (v_item, p_status, now())
  on conflict (item_id) do update
    set market_state = excluded.market_state, updated_at = now();

  return p_status;
end;
$$;

revoke all on function public.set_my_marketplace_conversation_status(uuid,text) from public, anon;
grant execute on function public.set_my_marketplace_conversation_status(uuid,text) to authenticated;

comment on function public.set_my_marketplace_conversation_status(uuid,text) is
  'Allows only the listing seller to reserve a conversation, then mark it sold. Reservation withdraws public discovery and closes competing conversations.';
