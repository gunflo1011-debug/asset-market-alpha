-- Preserve safe transaction context when a buyer takes a completed Marketplace
-- purchase into private inventory. Seller-private metadata remains excluded.
alter table private.marketplace_buyer_adoptions
  add column if not exists purchase_price_cents bigint,
  add column if not exists source_gtin text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_buyer_adoptions_purchase_price_range'
      and conrelid = 'private.marketplace_buyer_adoptions'::regclass
  ) then
    alter table private.marketplace_buyer_adoptions
      add constraint marketplace_buyer_adoptions_purchase_price_range
      check (purchase_price_cents is null or (purchase_price_cents > 0 and purchase_price_cents <= 1000000000));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_buyer_adoptions_source_gtin_format'
      and conrelid = 'private.marketplace_buyer_adoptions'::regclass
  ) then
    alter table private.marketplace_buyer_adoptions
      add constraint marketplace_buyer_adoptions_source_gtin_format
      check (source_gtin is null or source_gtin ~ '^[0-9]{8,14}$');
  end if;
end;
$$;

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

  select
    coalesce(nullif(btrim(i.custom_name), ''), 'Purchased Thing'),
    nullif(btrim(i.category), ''),
    i.variant_id
  into v_title, v_category, v_variant_id
  from public.items i
  where i.id = v_source_item
    and i.owner_id = v_seller;

  if v_title is null then raise exception 'SOURCE_THING_NOT_AVAILABLE'; end if;

  -- Final sale price is seller-confirmed transaction data, distinct from asking price.
  select l.sold_price_cents
    into v_purchase_price_cents
  from private.marketplace_listings l
  where l.item_id = v_source_item
    and l.seller_id = v_seller
    and l.sold_price_cents is not null;

  -- A confirmed GTIN is safe product identity, but the buyer has not personally
  -- confirmed it yet. Keep it only as private adoption provenance; do not write it
  -- into the buyer's confirmed identifier table automatically.
  select pi.gtin
    into v_source_gtin
  from private.item_product_identifiers pi
  where pi.item_id = v_source_item
    and pi.confirmed_by_user = true
  order by pi.updated_at desc nulls last
  limit 1;

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

    -- Backfill only catalog identity on earlier adoptions. Never overwrite a buyer's
    -- existing product choice and never copy seller-authored private fields.
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
  'Buyer-only SOLD adoption. Copies title/category and catalog variant, preserves seller-confirmed final price plus confirmed GTIN as private provenance, and never copies seller notes, serials, exact location, photos, account data, or buyer-unconfirmed GTIN identity.';
