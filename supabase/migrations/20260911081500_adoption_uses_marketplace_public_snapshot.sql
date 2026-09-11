-- Keep buyer adoption bound to the exact fields the seller explicitly published.
-- Never copy later/private seller item metadata into the buyer's inventory.
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
  v_variant_id uuid;
  v_source_gtin text;
  v_purchase_price_cents bigint;
  v_adopted uuid;
begin
  if v_buyer is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  select c.buyer_id, c.seller_id, c.item_id, c.status
    into v_buyer, v_seller, v_source_item, v_status
  from private.marketplace_conversations c
  where c.id = p_conversation_id
    and c.buyer_id = auth.uid();

  if v_source_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_status <> 'SOLD' then raise exception 'SALE_NOT_COMPLETE'; end if;

  -- Adoption identity comes only from the frozen buyer-visible listing snapshot.
  -- This prevents post-publication private edits (custom_name/category/identifiers)
  -- from being disclosed to the buyer during adoption.
  select
    coalesce(nullif(btrim(l.public_title), ''), 'Purchased Thing'),
    nullif(btrim(l.public_category), ''),
    l.source_variant_id,
    l.source_gtin,
    l.sold_price_cents
  into
    v_title,
    v_category,
    v_variant_id,
    v_source_gtin,
    v_purchase_price_cents
  from private.marketplace_listings l
  where l.item_id = v_source_item
    and l.seller_id = v_seller;

  if v_title is null then raise exception 'SOURCE_THING_NOT_AVAILABLE'; end if;

  select a.adopted_item_id
    into v_adopted
  from private.marketplace_buyer_adoptions a
  where a.conversation_id = p_conversation_id
    and a.buyer_id = auth.uid();

  if v_adopted is not null then
    update private.marketplace_buyer_adoptions
    set purchase_price_cents = coalesce(purchase_price_cents, v_purchase_price_cents),
        source_gtin = coalesce(source_gtin, v_source_gtin)
    where conversation_id = p_conversation_id
      and buyer_id = auth.uid();

    if v_variant_id is not null then
      update public.items
      set variant_id = v_variant_id
      where id = v_adopted
        and owner_id = auth.uid()
        and variant_id is null;
    end if;

    return v_adopted;
  end if;

  insert into public.items(owner_id, variant_id, custom_name, category)
  values(auth.uid(), v_variant_id, v_title, v_category)
  returning id into v_adopted;

  insert into private.item_market_state(item_id, market_state, updated_at)
  values(v_adopted, 'PRIVATE', now())
  on conflict(item_id) do update
    set market_state='PRIVATE', updated_at=now();

  insert into private.marketplace_buyer_adoptions(
    conversation_id,
    buyer_id,
    adopted_item_id,
    purchase_price_cents,
    source_gtin
  ) values(
    p_conversation_id,
    auth.uid(),
    v_adopted,
    v_purchase_price_cents,
    v_source_gtin
  );

  return v_adopted;
end;
$$;

revoke all on function public.adopt_my_sold_marketplace_thing(uuid) from public, anon;
grant execute on function public.adopt_my_sold_marketplace_thing(uuid) to authenticated;

comment on function public.adopt_my_sold_marketplace_thing(uuid) is
  'Buyer-only SOLD adoption. Copies only the frozen Marketplace public snapshot plus final sale price/catalog provenance; never reads seller-private mutable item metadata for buyer-visible adoption fields.';
