-- Marketplace-derived value suggestion for owned catalog-backed Things.
-- Uses exact catalog variant matches only. No seller identity or private metadata is returned.
-- SOLD observations are preferred; active published asking prices are only used when sold data is insufficient.
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

  -- Generic/manual Things do not yet have a trustworthy structured identity.
  -- Returning insufficient data is safer than fuzzy title matching.
  if v_variant_id is null then
    return query select null::bigint, 0::integer, 'INSUFFICIENT_DATA'::text;
    return;
  end if;

  -- One latest sold observation per seller limits a single account's ability to
  -- dominate the aggregate while preserving real multi-seller market evidence.
  with sold_samples as (
    select distinct on (l.seller_id)
      l.seller_id,
      l.asking_price_cents
    from private.marketplace_listings l
    join public.items i on i.id = l.item_id
    join private.item_market_state ms on ms.item_id = l.item_id
    where i.variant_id = v_variant_id
      and i.id <> p_item_id
      and l.seller_id <> v_owner
      and ms.market_state = 'SOLD'
    order by l.seller_id, l.updated_at desc
  )
  select count(*)::integer,
         percentile_disc(0.5) within group (order by asking_price_cents)::bigint
    into v_count, v_median
  from sold_samples;

  if v_count >= 3 then
    return query select v_median, v_count, 'SOLD_MEDIAN'::text;
    return;
  end if;

  -- If there are not enough completed sales yet, fall back to active asking
  -- prices, again capped to one latest observation per seller.
  with active_samples as (
    select distinct on (l.seller_id)
      l.seller_id,
      l.asking_price_cents
    from private.marketplace_listings l
    join public.items i on i.id = l.item_id
    where i.variant_id = v_variant_id
      and i.id <> p_item_id
      and l.seller_id <> v_owner
      and l.status = 'PUBLISHED'
    order by l.seller_id, l.updated_at desc
  )
  select count(*)::integer,
         percentile_disc(0.5) within group (order by asking_price_cents)::bigint
    into v_count, v_median
  from active_samples;

  if v_count >= 3 then
    return query select v_median, v_count, 'ACTIVE_MEDIAN'::text;
  else
    return query select null::bigint, v_count, 'INSUFFICIENT_DATA'::text;
  end if;
end;
$$;

revoke all on function public.load_my_market_value_v1(uuid) from public, anon;
grant execute on function public.load_my_market_value_v1(uuid) to authenticated;

comment on function public.load_my_market_value_v1(uuid) is
  'Returns a privacy-safe median market value for an owned catalog-backed Thing using at least three distinct-seller exact-variant observations; completed sales are preferred over active asking prices.';
