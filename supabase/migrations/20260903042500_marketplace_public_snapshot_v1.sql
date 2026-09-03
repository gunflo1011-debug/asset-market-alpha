-- Freeze buyer-visible Marketplace fields at an explicit publish/update action.
-- Private Thing edits after publication must not silently mutate what buyers see.
-- Existing v1/v2 RPC signatures stay intact for installed APK compatibility.

alter table private.marketplace_listings
  add column if not exists public_title text,
  add column if not exists public_category text,
  add column if not exists public_estimated_value_cents bigint,
  add column if not exists public_condition_label text,
  add column if not exists source_variant_id uuid references public.product_variants(id),
  add column if not exists source_gtin text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_listings_public_title_length'
      and conrelid = 'private.marketplace_listings'::regclass
  ) then
    alter table private.marketplace_listings
      add constraint marketplace_listings_public_title_length
      check (public_title is null or char_length(public_title) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_listings_public_category_length'
      and conrelid = 'private.marketplace_listings'::regclass
  ) then
    alter table private.marketplace_listings
      add constraint marketplace_listings_public_category_length
      check (public_category is null or char_length(public_category) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_listings_public_estimate_range'
      and conrelid = 'private.marketplace_listings'::regclass
  ) then
    alter table private.marketplace_listings
      add constraint marketplace_listings_public_estimate_range
      check (public_estimated_value_cents is null or public_estimated_value_cents between 1 and 1000000000);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_listings_source_gtin_format'
      and conrelid = 'private.marketplace_listings'::regclass
  ) then
    alter table private.marketplace_listings
      add constraint marketplace_listings_source_gtin_format
      check (source_gtin is null or source_gtin ~ '^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$');
  end if;
end;
$$;

-- Backfill current rows once so existing listings keep the exact public values they
-- expose at migration time. Future private edits no longer affect these snapshots.
update private.marketplace_listings l
set public_title = coalesce(nullif(btrim(i.custom_name), ''), p.brand || ' ' || p.family, 'Thing'),
    public_category = coalesce(nullif(btrim(i.category), ''), case when i.variant_id is not null then 'Device' else 'Other' end),
    public_estimated_value_cents = ve.estimated_value_cents,
    public_condition_label = replace(lower(cs.housing_state), '_', ' '),
    source_variant_id = i.variant_id,
    source_gtin = pi.gtin
from public.items i
left join public.product_variants pv on pv.id = i.variant_id
left join public.products p on p.id = pv.product_id
left join lateral (
  select e.estimated_value_cents
  from private.item_value_evidence e
  where e.item_id = i.id
  order by e.observed_at desc, e.created_at desc
  limit 1
) ve on true
left join lateral (
  select c.housing_state
  from public.condition_snapshots c
  where c.item_id = i.id
  order by c.captured_at desc
  limit 1
) cs on true
left join lateral (
  select ident.gtin
  from private.item_product_identifiers ident
  where ident.item_id = i.id and ident.confirmed_by_user = true
  order by ident.updated_at desc nulls last
  limit 1
) pi on true
where l.item_id = i.id;

create or replace function public.save_my_marketplace_listing_v2(
  p_item_id uuid,
  p_asking_price_cents bigint,
  p_publish boolean,
  p_public_location text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
  v_public_location text := nullif(btrim(p_public_location), '');
  v_title text;
  v_category text;
  v_estimate bigint;
  v_condition text;
  v_variant uuid;
  v_gtin text;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_asking_price_cents is null or p_asking_price_cents < 1 or p_asking_price_cents > 1000000000 then
    raise exception 'INVALID_ASKING_PRICE';
  end if;
  if v_public_location is not null and (
    char_length(v_public_location) > 80
    or v_public_location ~ '[0-9]'
    or v_public_location ~ '[\r\n]'
    or v_public_location ~* '(https?://|www\.|@)'
  ) then
    raise exception 'INVALID_PUBLIC_LOCATION';
  end if;

  select coalesce(nullif(btrim(i.custom_name), ''), p.brand || ' ' || p.family, 'Thing'),
         coalesce(nullif(btrim(i.category), ''), case when i.variant_id is not null then 'Device' else 'Other' end),
         i.variant_id
    into v_title, v_category, v_variant
  from public.items i
  left join public.product_variants pv on pv.id = i.variant_id
  left join public.products p on p.id = pv.product_id
  where i.id = p_item_id and i.owner_id = v_owner;

  if v_title is null then raise exception 'ITEM_NOT_OWNED'; end if;

  if p_publish then
    select e.estimated_value_cents into v_estimate
    from private.item_value_evidence e
    where e.item_id = p_item_id
    order by e.observed_at desc, e.created_at desc
    limit 1;

    select replace(lower(c.housing_state), '_', ' ') into v_condition
    from public.condition_snapshots c
    where c.item_id = p_item_id
    order by c.captured_at desc
    limit 1;

    select ident.gtin into v_gtin
    from private.item_product_identifiers ident
    where ident.item_id = p_item_id and ident.confirmed_by_user = true
    order by ident.updated_at desc nulls last
    limit 1;
  end if;

  v_status := case when p_publish then 'PUBLISHED' else 'DRAFT' end;

  insert into private.marketplace_listings(
    item_id, seller_id, asking_price_cents, public_location, status, published_at, updated_at,
    public_title, public_category, public_estimated_value_cents, public_condition_label,
    source_variant_id, source_gtin
  ) values (
    p_item_id, v_owner, p_asking_price_cents, v_public_location, v_status,
    case when p_publish then now() else null end, now(),
    case when p_publish then v_title else null end,
    case when p_publish then v_category else null end,
    case when p_publish then v_estimate else null end,
    case when p_publish then v_condition else null end,
    case when p_publish then v_variant else null end,
    case when p_publish then v_gtin else null end
  )
  on conflict (item_id) do update set
    asking_price_cents = excluded.asking_price_cents,
    public_location = excluded.public_location,
    status = excluded.status,
    published_at = case
      when excluded.status = 'PUBLISHED' and private.marketplace_listings.status <> 'PUBLISHED' then now()
      when excluded.status = 'PUBLISHED' then private.marketplace_listings.published_at
      else null
    end,
    public_title = case when p_publish then v_title else private.marketplace_listings.public_title end,
    public_category = case when p_publish then v_category else private.marketplace_listings.public_category end,
    public_estimated_value_cents = case when p_publish then v_estimate else private.marketplace_listings.public_estimated_value_cents end,
    public_condition_label = case when p_publish then v_condition else private.marketplace_listings.public_condition_label end,
    source_variant_id = case when p_publish then v_variant else private.marketplace_listings.source_variant_id end,
    source_gtin = case when p_publish then v_gtin else private.marketplace_listings.source_gtin end,
    updated_at = now();

  return v_status;
end;
$$;

-- Keep the legacy save RPC safe for older installed APKs. It snapshots the same
-- buyer-visible fields while retaining the existing location value, if any.
create or replace function public.save_my_marketplace_listing(
  p_item_id uuid,
  p_asking_price_cents bigint,
  p_publish boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
  v_title text;
  v_category text;
  v_estimate bigint;
  v_condition text;
  v_variant uuid;
  v_gtin text;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_asking_price_cents is null or p_asking_price_cents < 1 or p_asking_price_cents > 1000000000 then
    raise exception 'INVALID_ASKING_PRICE';
  end if;

  select coalesce(nullif(btrim(i.custom_name), ''), p.brand || ' ' || p.family, 'Thing'),
         coalesce(nullif(btrim(i.category), ''), case when i.variant_id is not null then 'Device' else 'Other' end),
         i.variant_id
    into v_title, v_category, v_variant
  from public.items i
  left join public.product_variants pv on pv.id = i.variant_id
  left join public.products p on p.id = pv.product_id
  where i.id = p_item_id and i.owner_id = v_owner;

  if v_title is null then raise exception 'ITEM_NOT_OWNED'; end if;

  if p_publish then
    select e.estimated_value_cents into v_estimate
    from private.item_value_evidence e
    where e.item_id = p_item_id
    order by e.observed_at desc, e.created_at desc
    limit 1;

    select replace(lower(c.housing_state), '_', ' ') into v_condition
    from public.condition_snapshots c
    where c.item_id = p_item_id
    order by c.captured_at desc
    limit 1;

    select ident.gtin into v_gtin
    from private.item_product_identifiers ident
    where ident.item_id = p_item_id and ident.confirmed_by_user = true
    order by ident.updated_at desc nulls last
    limit 1;
  end if;

  v_status := case when p_publish then 'PUBLISHED' else 'DRAFT' end;

  insert into private.marketplace_listings(
    item_id, seller_id, asking_price_cents, status, published_at, updated_at,
    public_title, public_category, public_estimated_value_cents, public_condition_label,
    source_variant_id, source_gtin
  ) values (
    p_item_id, v_owner, p_asking_price_cents, v_status,
    case when p_publish then now() else null end, now(),
    case when p_publish then v_title else null end,
    case when p_publish then v_category else null end,
    case when p_publish then v_estimate else null end,
    case when p_publish then v_condition else null end,
    case when p_publish then v_variant else null end,
    case when p_publish then v_gtin else null end
  )
  on conflict (item_id) do update set
    asking_price_cents = excluded.asking_price_cents,
    status = excluded.status,
    published_at = case
      when excluded.status = 'PUBLISHED' and private.marketplace_listings.status <> 'PUBLISHED' then now()
      when excluded.status = 'PUBLISHED' then private.marketplace_listings.published_at
      else null
    end,
    public_title = case when p_publish then v_title else private.marketplace_listings.public_title end,
    public_category = case when p_publish then v_category else private.marketplace_listings.public_category end,
    public_estimated_value_cents = case when p_publish then v_estimate else private.marketplace_listings.public_estimated_value_cents end,
    public_condition_label = case when p_publish then v_condition else private.marketplace_listings.public_condition_label end,
    source_variant_id = case when p_publish then v_variant else private.marketplace_listings.source_variant_id end,
    source_gtin = case when p_publish then v_gtin else private.marketplace_listings.source_gtin end,
    updated_at = now();

  return v_status;
end;
$$;

create or replace function public.load_marketplace_v2()
returns table(
  item_id uuid,
  title text,
  category text,
  asking_price_cents bigint,
  estimated_value_cents bigint,
  condition_label text,
  public_location text,
  published_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select l.item_id, l.public_title, l.public_category, l.asking_price_cents,
         l.public_estimated_value_cents, l.public_condition_label,
         l.public_location, l.published_at
  from private.marketplace_listings l
  where l.status = 'PUBLISHED'
    and l.seller_id <> auth.uid()
  order by l.published_at desc nulls last;
$$;

create or replace function public.load_marketplace_v1()
returns table(
  item_id uuid,
  title text,
  category text,
  asking_price_cents bigint,
  estimated_value_cents bigint,
  condition_label text,
  published_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select l.item_id, l.public_title, l.public_category, l.asking_price_cents,
         l.public_estimated_value_cents, l.public_condition_label, l.published_at
  from private.marketplace_listings l
  where l.status = 'PUBLISHED'
    and l.seller_id <> auth.uid()
  order by l.published_at desc nulls last;
$$;

-- Adoption now copies the immutable transaction/listing snapshot rather than live
-- seller Thing fields. Seller-private edits after the sale cannot flow into buyer inventory.
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
  if v_buyer is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select c.buyer_id, c.seller_id, c.item_id, c.status
    into v_buyer, v_seller, v_source_item, v_status
  from private.marketplace_conversations c
  where c.id = p_conversation_id and c.buyer_id = auth.uid();

  if v_source_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_status <> 'SOLD' then raise exception 'SALE_NOT_COMPLETE'; end if;

  select l.public_title, l.public_category, l.source_variant_id, l.source_gtin, l.sold_price_cents
    into v_title, v_category, v_variant_id, v_source_gtin, v_purchase_price_cents
  from private.marketplace_listings l
  where l.item_id = v_source_item and l.seller_id = v_seller;

  if v_title is null then raise exception 'SOURCE_LISTING_SNAPSHOT_NOT_AVAILABLE'; end if;

  select a.adopted_item_id into v_adopted
  from private.marketplace_buyer_adoptions a
  where a.conversation_id = p_conversation_id and a.buyer_id = auth.uid();

  if v_adopted is not null then
    update private.marketplace_buyer_adoptions
    set purchase_price_cents = coalesce(purchase_price_cents, v_purchase_price_cents),
        source_gtin = coalesce(source_gtin, v_source_gtin)
    where conversation_id = p_conversation_id and buyer_id = auth.uid();

    if v_variant_id is not null then
      update public.items
      set variant_id = v_variant_id
      where id = v_adopted and owner_id = auth.uid() and variant_id is null;
    end if;
    return v_adopted;
  end if;

  insert into public.items(owner_id, variant_id, custom_name, category)
  values(auth.uid(), v_variant_id, v_title, v_category)
  returning id into v_adopted;

  insert into private.item_market_state(item_id, market_state, updated_at)
  values(v_adopted, 'PRIVATE', now())
  on conflict(item_id) do update set market_state='PRIVATE', updated_at=now();

  insert into private.marketplace_buyer_adoptions(
    conversation_id, buyer_id, adopted_item_id, purchase_price_cents, source_gtin
  ) values (
    p_conversation_id, auth.uid(), v_adopted, v_purchase_price_cents, v_source_gtin
  );

  return v_adopted;
end;
$$;

revoke all on function public.save_my_marketplace_listing(uuid,bigint,boolean) from public, anon;
revoke all on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) from public, anon;
revoke all on function public.load_marketplace_v1() from public, anon;
revoke all on function public.load_marketplace_v2() from public, anon;
revoke all on function public.adopt_my_sold_marketplace_thing(uuid) from public, anon;
grant execute on function public.save_my_marketplace_listing(uuid,bigint,boolean) to authenticated;
grant execute on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) to authenticated;
grant execute on function public.load_marketplace_v1() to authenticated;
grant execute on function public.load_marketplace_v2() to authenticated;
grant execute on function public.adopt_my_sold_marketplace_thing(uuid) to authenticated;

comment on function public.load_marketplace_v2() is
  'Returns only immutable fields captured by an explicit seller publish/update action plus coarse public location.';
comment on function public.adopt_my_sold_marketplace_thing(uuid) is
  'Buyer-only SOLD adoption using the frozen Marketplace transaction snapshot; seller-private post-publication edits are excluded.';
