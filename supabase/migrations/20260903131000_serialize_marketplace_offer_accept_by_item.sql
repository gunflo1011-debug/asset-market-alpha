-- Serialize offer responses that can reserve the same Thing across different buyer conversations.
-- Conversation-row locks alone are insufficient because one item can have multiple open conversations.
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

  -- Resolve the Thing first without taking a conversation lock, then serialize all
  -- offer responses for that Thing before locking/re-reading the authoritative rows.
  -- This avoids two conversations for one Thing being accepted concurrently.
  select c.item_id
    into v_item
  from private.marketplace_offers o
  join private.marketplace_conversations c on c.id = o.conversation_id
  where o.id = p_offer_id;

  if v_item is null then raise exception 'NOT_ALLOWED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_item::text, 0));

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

  -- ACCEPT: only one conversation for this Thing can still be OPEN once the item lock is held.
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

revoke all on function public.respond_to_my_marketplace_offer(uuid,text,bigint,text) from public, anon;
grant execute on function public.respond_to_my_marketplace_offer(uuid,text,bigint,text) to authenticated;
