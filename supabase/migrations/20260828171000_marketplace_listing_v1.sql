-- Explicit owner-controlled marketplace listings.
-- Inventory remains private until the owner publishes a listing.
create table if not exists private.marketplace_listings (
  item_id uuid primary key references public.items(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  asking_price_cents bigint not null check (asking_price_cents between 1 and 1000000000),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','WITHDRAWN')),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_listings_status_published_idx
  on private.marketplace_listings(status, published_at desc nulls last);

revoke all on table private.marketplace_listings from public, anon, authenticated;

create or replace function public.save_my_marketplace_listing(
  p_item_id uuid,
  p_asking_price_cents bigint,
  p_publish boolean
)
returns text
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_asking_price_cents is null or p_asking_price_cents < 1 or p_asking_price_cents > 1000000000 then
    raise exception 'INVALID_ASKING_PRICE';
  end if;
  if not exists(select 1 from public.items i where i.id = p_item_id and i.owner_id = v_owner) then
    raise exception 'ITEM_NOT_OWNED';
  end if;

  v_status := case when p_publish then 'PUBLISHED' else 'DRAFT' end;

  insert into private.marketplace_listings(item_id, seller_id, asking_price_cents, status, published_at, updated_at)
  values (p_item_id, v_owner, p_asking_price_cents, v_status, case when p_publish then now() else null end, now())
  on conflict (item_id) do update set
    asking_price_cents = excluded.asking_price_cents,
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

create or replace function public.withdraw_my_marketplace_listing(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  update private.marketplace_listings
  set status = 'WITHDRAWN', published_at = null, updated_at = now()
  where item_id = p_item_id and seller_id = auth.uid();
  if not found then
    raise exception 'LISTING_NOT_OWNED';
  end if;
end;
$$;

create or replace function public.load_my_marketplace_listings()
returns table(item_id uuid, asking_price_cents bigint, status text, published_at timestamptz)
language sql
security definer
set search_path = public, private, auth, pg_temp
stable
as $$
  select l.item_id, l.asking_price_cents, l.status, l.published_at
  from private.marketplace_listings l
  where l.seller_id = auth.uid()
  order by l.updated_at desc;
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

revoke all on function public.save_my_marketplace_listing(uuid,bigint,boolean) from public, anon;
revoke all on function public.withdraw_my_marketplace_listing(uuid) from public, anon;
revoke all on function public.load_my_marketplace_listings() from public, anon;
revoke all on function public.load_marketplace_v1() from public, anon;
grant execute on function public.save_my_marketplace_listing(uuid,bigint,boolean) to authenticated;
grant execute on function public.withdraw_my_marketplace_listing(uuid) to authenticated;
grant execute on function public.load_my_marketplace_listings() to authenticated;
grant execute on function public.load_marketplace_v1() to authenticated;

comment on function public.load_marketplace_v1() is
  'Returns only explicitly published listing fields. Private metadata and seller identity are not returned.';
