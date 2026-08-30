-- Owner-controlled coarse marketplace location.
-- This intentionally does not copy private inventory location automatically.
-- Existing v1 RPCs remain unchanged for backwards compatibility with installed APKs.

alter table private.marketplace_listings
  add column if not exists public_location text;

comment on column private.marketplace_listings.public_location is
  'Optional seller-entered coarse city/town shown publicly. Never populated from private inventory location automatically.';

create or replace function public.save_my_marketplace_listing_v2(
  p_item_id uuid,
  p_asking_price_cents bigint,
  p_publish boolean,
  p_public_location text default null
)
returns text
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
  v_public_location text := nullif(btrim(p_public_location), '');
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_asking_price_cents is null or p_asking_price_cents < 1 or p_asking_price_cents > 1000000000 then
    raise exception 'INVALID_ASKING_PRICE';
  end if;
  if v_public_location is not null and char_length(v_public_location) > 80 then
    raise exception 'INVALID_PUBLIC_LOCATION';
  end if;
  if not exists(select 1 from public.items i where i.id = p_item_id and i.owner_id = v_owner) then
    raise exception 'ITEM_NOT_OWNED';
  end if;

  v_status := case when p_publish then 'PUBLISHED' else 'DRAFT' end;

  insert into private.marketplace_listings(item_id, seller_id, asking_price_cents, public_location, status, published_at, updated_at)
  values (p_item_id, v_owner, p_asking_price_cents, v_public_location, v_status, case when p_publish then now() else null end, now())
  on conflict (item_id) do update set
    asking_price_cents = excluded.asking_price_cents,
    public_location = excluded.public_location,
    status = excluded.status,
    published_at = case
      when excluded.status = 'PUBLISHED' and private.marketplace_listings.status <> 'PUBLISHED' then now()
      when excluded.status = 'PUBLISHED' then private.marketplace_listings.published_at
      else null
    end,
    updated_at = now();

  return v_status;
end;
$$;

create or replace function public.load_my_marketplace_listings_v2()
returns table(
  item_id uuid,
  asking_price_cents bigint,
  public_location text,
  status text,
  published_at timestamptz
)
language sql
security definer
set search_path = public, private, auth, pg_temp
stable
as $$
  select l.item_id, l.asking_price_cents, l.public_location, l.status, l.published_at
  from private.marketplace_listings l
  where l.seller_id = auth.uid()
  order by l.updated_at desc;
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
set search_path = public, private, auth, pg_temp
stable
as $$
  select
    i.id,
    coalesce(nullif(btrim(i.custom_name), ''), p.brand || ' ' || p.family, 'Thing') as title,
    coalesce(nullif(btrim(i.category), ''), case when i.variant_id is not null then 'Device' else 'Other' end) as category,
    l.asking_price_cents,
    ve.estimated_value_cents,
    replace(lower(cs.housing_state), '_', ' ') as condition_label,
    l.public_location,
    l.published_at
  from private.marketplace_listings l
  join public.items i on i.id = l.item_id
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
  where l.status = 'PUBLISHED'
    and l.seller_id <> auth.uid()
  order by l.published_at desc nulls last;
$$;

revoke all on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) from public, anon;
revoke all on function public.load_my_marketplace_listings_v2() from public, anon;
revoke all on function public.load_marketplace_v2() from public, anon;
grant execute on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) to authenticated;
grant execute on function public.load_my_marketplace_listings_v2() to authenticated;
grant execute on function public.load_marketplace_v2() to authenticated;

comment on function public.load_marketplace_v2() is
  'Returns only explicitly published listing fields plus optional seller-entered coarse city/town. Seller identity, exact address, GPS and private inventory location are not returned.';
