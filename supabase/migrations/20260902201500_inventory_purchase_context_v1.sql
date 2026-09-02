-- Owner-only projection of safe purchase context for adopted Marketplace Things.
-- This intentionally exposes no seller-authored private fields.
create or replace function public.load_my_inventory_purchase_context()
returns table(
  item_id uuid,
  purchase_price_cents bigint,
  source_type text,
  source_gtin text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.adopted_item_id as item_id,
    a.purchase_price_cents,
    'MARKETPLACE_ADOPTION'::text as source_type,
    a.source_gtin
  from private.marketplace_buyer_adoptions a
  join public.items i
    on i.id = a.adopted_item_id
   and i.owner_id = auth.uid()
  where a.buyer_id = auth.uid();
$$;

revoke all on function public.load_my_inventory_purchase_context() from public, anon;
grant execute on function public.load_my_inventory_purchase_context() to authenticated;

comment on function public.load_my_inventory_purchase_context() is
  'Authenticated owner-only projection of purchase price and product-identity provenance for Marketplace-adopted private Things. Never exposes seller notes, serials, exact location, photos, storage paths, or account data.';
