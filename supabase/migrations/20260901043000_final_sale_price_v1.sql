-- Explicit completed-transaction price for Marketplace lifecycle.
-- Asking price remains the seller's listing intent; sold_price_cents records only
-- the seller-confirmed final amount after reservation and real-world completion.
alter table private.marketplace_listings
  add column if not exists sold_price_cents bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_listings_sold_price_range'
      and conrelid = 'private.marketplace_listings'::regclass
  ) then
    alter table private.marketplace_listings
      add constraint marketplace_listings_sold_price_range
      check (sold_price_cents is null or (sold_price_cents > 0 and sold_price_cents <= 1000000000));
  end if;
end;
$$;

create or replace function public.set_my_marketplace_conversation_status_v2(
  p_conversation_id uuid,
  p_status text,
  p_final_sale_price_cents bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid := auth.uid();
  v_item uuid;
  v_current text;
begin
  if v_seller is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_status not in ('RESERVED','SOLD') then
    raise exception 'INVALID_LIFECYCLE_STATUS';
  end if;
  if p_status = 'RESERVED' and p_final_sale_price_cents is not null then
    raise exception 'FINAL_PRICE_ONLY_FOR_SOLD';
  end if;
  if p_status = 'SOLD' and (
    p_final_sale_price_cents is null
    or p_final_sale_price_cents <= 0
    or p_final_sale_price_cents > 1000000000
  ) then
    raise exception 'VALID_FINAL_SALE_PRICE_REQUIRED';
  end if;

  select c.item_id, c.status
    into v_item, v_current
  from private.marketplace_conversations c
  where c.id = p_conversation_id and c.seller_id = v_seller
  for update;

  if v_item is null then raise exception 'NOT_ALLOWED'; end if;
  if v_current in ('SOLD','CLOSED') then raise exception 'CONVERSATION_CLOSED'; end if;
  if p_status = 'SOLD' and v_current <> 'RESERVED' then
    raise exception 'RESERVATION_REQUIRED';
  end if;

  update private.marketplace_conversations
  set status = p_status, updated_at = now()
  where id = p_conversation_id;

  update private.marketplace_conversations
  set status = 'CLOSED', updated_at = now()
  where item_id = v_item
    and id <> p_conversation_id
    and status in ('OPEN','RESERVED');

  update private.marketplace_listings
  set status = 'WITHDRAWN',
      published_at = null,
      sold_price_cents = case when p_status = 'SOLD' then p_final_sale_price_cents else sold_price_cents end,
      updated_at = now()
  where item_id = v_item and seller_id = v_seller;

  insert into private.item_market_state(item_id, market_state, updated_at)
  values (v_item, p_status, now())
  on conflict (item_id) do update
    set market_state = excluded.market_state, updated_at = now();

  return p_status;
end;
$$;

revoke all on function public.set_my_marketplace_conversation_status_v2(uuid,text,bigint) from public, anon;
grant execute on function public.set_my_marketplace_conversation_status_v2(uuid,text,bigint) to authenticated;

comment on function public.set_my_marketplace_conversation_status_v2(uuid,text,bigint) is
  'Seller-only reserve/sold transition. SOLD requires an explicit final transaction price; no buyer can mutate lifecycle or price.';

-- Market Value now treats only explicit final transaction prices as completed-sale
-- evidence. Historical SOLD rows without an explicit final price are not silently
-- reinterpreted as completed-sale prices; active asking prices remain the fallback.
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
      l.sold_price_cents
    from private.marketplace_listings l
    join public.items i on i.id = l.item_id
    join private.item_market_state ms on ms.item_id = l.item_id
    left join private.item_product_identifiers pi
      on pi.item_id = i.id and pi.confirmed_by_user = true
    where i.id <> p_item_id
      and l.seller_id <> v_owner
      and ms.market_state = 'SOLD'
      and l.sold_price_cents is not null
      and (
        (v_variant_id is not null and i.variant_id = v_variant_id)
        or
        (v_variant_id is null and i.variant_id is null and pi.gtin = v_gtin)
      )
    order by l.seller_id, l.updated_at desc
  )
  select count(*)::integer,
         percentile_disc(0.5) within group (order by sold_price_cents)::bigint
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
  'Returns privacy-safe Marketplace median from at least three distinct sellers. Explicit final sale prices are preferred; otherwise active asking prices are used. Exact variant or confirmed-GTIN matching only.';
