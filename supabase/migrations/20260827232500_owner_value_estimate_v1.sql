-- Transparent v1 estimate based on owner-provided purchase price, age and condition.
-- This is a server-calculated model estimate, not verified market-comparable evidence.
create table if not exists private.item_valuation_profiles (
  item_id uuid primary key references public.items(id) on delete cascade,
  purchase_price_cents bigint not null check (purchase_price_cents between 1 and 1000000000),
  purchase_year integer not null check (purchase_year between 1970 and 2100),
  condition_grade text not null check (condition_grade in ('LIKE_NEW','GOOD','FAIR','POOR')),
  updated_at timestamptz not null default now()
);

revoke all on table private.item_valuation_profiles from public, anon, authenticated;

create or replace function public.estimate_my_item_value_v1(
  p_item_id uuid,
  p_purchase_price_cents bigint,
  p_purchase_year integer,
  p_condition_grade text
)
returns bigint
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_category text;
  v_age integer;
  v_base numeric;
  v_yearly numeric;
  v_condition numeric;
  v_estimate bigint;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_purchase_price_cents is null or p_purchase_price_cents < 1 or p_purchase_price_cents > 1000000000 then
    raise exception 'INVALID_PURCHASE_PRICE';
  end if;
  if p_purchase_year < 1970 or p_purchase_year > extract(year from now())::integer then
    raise exception 'INVALID_PURCHASE_YEAR';
  end if;
  if p_condition_grade not in ('LIKE_NEW','GOOD','FAIR','POOR') then
    raise exception 'INVALID_CONDITION_GRADE';
  end if;

  select lower(coalesce(nullif(btrim(category), ''), 'other'))
    into v_category
  from public.items
  where id = p_item_id and owner_id = v_owner;
  if not found then
    raise exception 'ITEM_NOT_OWNED';
  end if;

  v_age := greatest(0, extract(year from now())::integer - p_purchase_year);

  if v_category ~ '(phone|smartphone|device|computer|laptop|tablet|electronics)' then
    v_base := 0.68; v_yearly := 0.80;
  elsif v_category ~ '(bicycle|bike|cycling)' then
    v_base := 0.75; v_yearly := 0.88;
  elsif v_category ~ '(book)' then
    v_base := 0.35; v_yearly := 0.82;
  elsif v_category ~ '(furniture|chair|table|sofa)' then
    v_base := 0.62; v_yearly := 0.90;
  else
    v_base := 0.65; v_yearly := 0.87;
  end if;

  v_condition := case p_condition_grade
    when 'LIKE_NEW' then 1.00
    when 'GOOD' then 0.90
    when 'FAIR' then 0.72
    when 'POOR' then 0.50
  end;

  v_estimate := round(
    p_purchase_price_cents::numeric *
    case when v_age = 0 then 0.92 else v_base * power(v_yearly, greatest(v_age - 1, 0)) end *
    v_condition
  )::bigint;
  v_estimate := greatest(0, least(p_purchase_price_cents, v_estimate));

  insert into private.item_valuation_profiles(item_id, purchase_price_cents, purchase_year, condition_grade, updated_at)
  values (p_item_id, p_purchase_price_cents, p_purchase_year, p_condition_grade, now())
  on conflict (item_id) do update set
    purchase_price_cents = excluded.purchase_price_cents,
    purchase_year = excluded.purchase_year,
    condition_grade = excluded.condition_grade,
    updated_at = now();

  insert into private.item_value_evidence(item_id, estimated_value_cents, currency, source_type, source_ref, observed_at)
  values (p_item_id, v_estimate, 'EUR', 'MODEL_V1_OWNER_INPUT', 'purchase-price-age-condition', now());

  return v_estimate;
end;
$$;

revoke all on function public.estimate_my_item_value_v1(uuid,bigint,integer,text) from public, anon;
grant execute on function public.estimate_my_item_value_v1(uuid,bigint,integer,text) to authenticated;

comment on function public.estimate_my_item_value_v1(uuid,bigint,integer,text) is
  'Creates a transparent Things v1 estimate from owner-provided purchase price, age and condition. Not a market-comparable valuation.';
