create or replace function public.load_my_inventory_market_states()
returns table(item_id uuid, market_state text)
language sql
security definer
set search_path = ''
stable
as $$
  select ims.item_id, ims.market_state
  from private.item_market_state ims
  join public.items i on i.id = ims.item_id
  where i.owner_id = auth.uid()
  order by ims.updated_at desc;
$$;

revoke all on function public.load_my_inventory_market_states() from public, anon;
grant execute on function public.load_my_inventory_market_states() to authenticated;
