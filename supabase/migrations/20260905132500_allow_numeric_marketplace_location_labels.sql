-- Allow legitimate numeric district/place labels such as "Hamburg 16" while
-- keeping Marketplace location deliberately coarse. Preserve the public listing
-- snapshot semantics introduced by marketplace_public_snapshot_v1.

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
    or v_public_location ~ '[\r\n]'
    or v_public_location ~* '(https?://|www\.|@)'
    or v_public_location ~ '^[[:space:]]*[+-]?[0-9]{1,3}([.,][0-9]+)?[[:space:]]*[,;/][[:space:]]*[+-]?[0-9]{1,3}([.,][0-9]+)?[[:space:]]*$'
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

revoke all on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) from public, anon;
grant execute on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) to authenticated;

comment on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) is
  'Owner-only listing command. Optional public location accepts coarse city/town/district labels including numbers, while obvious contact, URL, newline and coordinate values are rejected; explicit publish/update refreshes the immutable buyer-visible listing snapshot.';
