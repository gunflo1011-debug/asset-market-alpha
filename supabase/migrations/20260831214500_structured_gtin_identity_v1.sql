-- Private, user-confirmed product identity for barcode-captured Things.
-- GTIN stays private inventory metadata and is never exposed by Marketplace listing reads.
create table if not exists private.item_product_identifiers (
  item_id uuid primary key references public.items(id) on delete cascade,
  gtin text not null,
  source text not null default 'BARCODE_SCAN',
  confirmed_by_user boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_product_identifiers_gtin_format check (gtin ~ '^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$'),
  constraint item_product_identifiers_source_check check (source in ('BARCODE_SCAN', 'MANUAL_ENTRY', 'QR_PRODUCT_DATA'))
);

alter table private.item_product_identifiers enable row level security;
revoke all on table private.item_product_identifiers from public, anon, authenticated;

create index if not exists item_product_identifiers_gtin_idx
  on private.item_product_identifiers(gtin)
  where confirmed_by_user = true;

create or replace function public.set_my_item_gtin_v1(
  p_item_id uuid,
  p_gtin text,
  p_source text default 'BARCODE_SCAN'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_gtin text := regexp_replace(coalesce(p_gtin, ''), '[^0-9]', '', 'g');
  v_source text := upper(coalesce(nullif(trim(p_source), ''), 'BARCODE_SCAN'));
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  if not exists (
    select 1 from public.items i
    where i.id = p_item_id and i.owner_id = v_owner
  ) then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;

  if v_gtin !~ '^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$' then
    raise exception 'INVALID_GTIN';
  end if;

  if v_source not in ('BARCODE_SCAN', 'MANUAL_ENTRY', 'QR_PRODUCT_DATA') then
    raise exception 'INVALID_PRODUCT_IDENTITY_SOURCE';
  end if;

  insert into private.item_product_identifiers(item_id, gtin, source, confirmed_by_user)
  values (p_item_id, v_gtin, v_source, true)
  on conflict (item_id) do update
    set gtin = excluded.gtin,
        source = excluded.source,
        confirmed_by_user = true,
        updated_at = now();
end;
$$;

revoke all on function public.set_my_item_gtin_v1(uuid, text, text) from public, anon;
grant execute on function public.set_my_item_gtin_v1(uuid, text, text) to authenticated;

comment on function public.set_my_item_gtin_v1(uuid, text, text) is
  'Stores a normalized, user-confirmed GTIN for an owned Thing as private product identity. It is not Marketplace-public data.';

-- Extend the existing Market Value contract without changing the mobile RPC name:
-- catalog-backed Things still match exact variant; generic barcode Things may now
-- match exact confirmed GTIN. Fuzzy title/model matching remains intentionally excluded.
create or replace function public.load_my_market_value_v1(p_item_id uuid)
returns table(
  market_value_cents bigint,
  sample_count integer,
  source text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_owner uuid := auth.uid();
  v_variant_id uuid;
  v_gtin text;
  v_count integer;
  v_median bigint;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  select i.variant_id
    into v_variant_id
  from public.items i
  where i.id = p_item_id and i.owner_id = v_owner;

  if not found then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;

  if v_variant_id is null then
    select pi.gtin
      into v_gtin
    from private.item_product_identifiers pi
    where pi.item_id = p_item_id
      and pi.confirmed_by_user = true;

    if v_gtin is null then
      return query select null::bigint, 0::integer, 'INSUFFICIENT_DATA'::text;
      return;
    end if;
  end if;

  with sold_samples as (
    select distinct on (l.seller_id)
      l.seller_id,
      l.asking_price_cents
    from private.marketplace_listings l
    join public.items i on i.id = l.item_id
    join private.item_market_state ms on ms.item_id = l.item_id
    left join private.item_product_identifiers pi
      on pi.item_id = i.id and pi.confirmed_by_user = true
    where i.id <> p_item_id
      and l.seller_id <> v_owner
      and ms.market_state = 'SOLD'
      and (
        (v_variant_id is not null and i.variant_id = v_variant_id)
        or
        (v_variant_id is null and i.variant_id is null and pi.gtin = v_gtin)
      )
    order by l.seller_id, l.updated_at desc
  )
  select count(*)::integer,
         percentile_disc(0.5) within group (order by asking_price_cents)::bigint
    into v_count, v_median
  from sold_samples;

  if v_count >= 3 then
    return query select v_median, v_count,
      case when v_variant_id is not null then 'SOLD_MEDIAN' else 'SOLD_GTIN_MEDIAN' end::text;
    return;
  end if;

  with active_samples as (
    select distinct on (l.seller_id)
      l.seller_id,
      l.asking_price_cents
    from private.marketplace_listings l
    join public.items i on i.id = l.item_id
    left join private.item_product_identifiers pi
      on pi.item_id = i.id and pi.confirmed_by_user = true
    where i.id <> p_item_id
      and l.seller_id <> v_owner
      and l.status = 'PUBLISHED'
      and (
        (v_variant_id is not null and i.variant_id = v_variant_id)
        or
        (v_variant_id is null and i.variant_id is null and pi.gtin = v_gtin)
      )
    order by l.seller_id, l.updated_at desc
  )
  select count(*)::integer,
         percentile_disc(0.5) within group (order by asking_price_cents)::bigint
    into v_count, v_median
  from active_samples;

  if v_count >= 3 then
    return query select v_median, v_count,
      case when v_variant_id is not null then 'ACTIVE_MEDIAN' else 'ACTIVE_GTIN_MEDIAN' end::text;
  else
    return query select null::bigint, v_count, 'INSUFFICIENT_DATA'::text;
  end if;
end;
$$;

revoke all on function public.load_my_market_value_v1(uuid) from public, anon;
grant execute on function public.load_my_market_value_v1(uuid) to authenticated;

comment on function public.load_my_market_value_v1(uuid) is
  'Returns a privacy-safe Marketplace median for an owned Thing using at least three distinct sellers. Matches exact catalog variant first, or exact user-confirmed GTIN for generic Things; sold lifecycle observations are preferred over active asking prices.';