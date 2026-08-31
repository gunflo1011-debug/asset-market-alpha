-- Buyer-controlled post-sale adoption. Creates a NEW private inventory Thing for the
-- buyer from deliberately public listing fields only. It never transfers seller
-- ownership or copies seller notes, serials, private location, photos, or account data.
create table if not exists private.marketplace_buyer_adoptions (
  conversation_id uuid primary key references private.marketplace_conversations(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  adopted_item_id uuid not null unique references public.items(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.marketplace_buyer_adoptions from public, anon, authenticated;

create or replace function public.adopt_my_sold_marketplace_thing(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_source_item uuid;
  v_status text;
  v_title text;
  v_category text;
  v_adopted uuid;
begin
  if v_buyer is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select c.buyer_id, c.seller_id, c.item_id, c.status
    into v_buyer, v_seller, v_source_item, v_status
  from private.marketplace_conversations c
  where c.id = p_conversation_id and c.buyer_id = auth.uid();

  if v_source_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_status <> 'SOLD' then raise exception 'SALE_NOT_COMPLETE'; end if;

  select a.adopted_item_id into v_adopted
  from private.marketplace_buyer_adoptions a
  where a.conversation_id = p_conversation_id and a.buyer_id = auth.uid();
  if v_adopted is not null then return v_adopted; end if;

  select coalesce(nullif(btrim(i.custom_name), ''), 'Purchased Thing'),
         nullif(btrim(i.category), '')
    into v_title, v_category
  from public.items i
  where i.id = v_source_item and i.owner_id = v_seller;

  if v_title is null then raise exception 'SOURCE_THING_NOT_AVAILABLE'; end if;

  insert into public.items(owner_id, custom_name, category)
  values(auth.uid(), v_title, v_category)
  returning id into v_adopted;

  insert into private.item_market_state(item_id, market_state, updated_at)
  values(v_adopted, 'PRIVATE', now())
  on conflict(item_id) do update set market_state='PRIVATE', updated_at=now();

  insert into private.marketplace_buyer_adoptions(conversation_id,buyer_id,adopted_item_id)
  values(p_conversation_id,auth.uid(),v_adopted);

  return v_adopted;
end;
$$;

revoke all on function public.adopt_my_sold_marketplace_thing(uuid) from public, anon;
grant execute on function public.adopt_my_sold_marketplace_thing(uuid) to authenticated;
