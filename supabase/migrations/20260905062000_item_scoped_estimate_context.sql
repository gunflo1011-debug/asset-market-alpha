-- Item-scoped owner projections for the Estimate panel.
-- Keep existing account-wide inventory RPCs intact for screens that need them;
-- these focused reads avoid transferring every value/adoption row for one Thing.

create or replace function public.load_my_item_value(p_item_id uuid)
returns table(
  item_id uuid,
  estimated_value_cents bigint,
  currency text,
  source_type text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  return query
  select
    e.item_id,
    e.estimated_value_cents,
    e.currency,
    e.source_type,
    e.observed_at
  from private.item_value_evidence e
  join public.items i on i.id = e.item_id
  where e.item_id = p_item_id
    and i.owner_id = auth.uid()
  order by e.observed_at desc, e.created_at desc
  limit 1;
end;
$$;

create or replace function public.load_my_item_purchase_context(p_item_id uuid)
returns table(
  item_id uuid,
  purchase_price_cents bigint,
  source_type text,
  source_gtin text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  return query
  select
    a.adopted_item_id,
    a.purchase_price_cents,
    'MARKETPLACE_ADOPTION'::text,
    a.source_gtin
  from private.marketplace_buyer_adoptions a
  join public.items i
    on i.id = a.adopted_item_id
   and i.owner_id = auth.uid()
  where a.adopted_item_id = p_item_id
    and a.buyer_id = auth.uid()
  limit 1;
end;
$$;

revoke all on function public.load_my_item_value(uuid) from public, anon;
grant execute on function public.load_my_item_value(uuid) to authenticated;
revoke all on function public.load_my_item_purchase_context(uuid) from public, anon;
grant execute on function public.load_my_item_purchase_context(uuid) to authenticated;

comment on function public.load_my_item_value(uuid) is
  'Returns only the latest value evidence for one Thing when the authenticated caller owns it.';
comment on function public.load_my_item_purchase_context(uuid) is
  'Returns safe Marketplace purchase context for one adopted Thing only when the authenticated caller is both buyer and current owner; seller-private metadata is never exposed.';
