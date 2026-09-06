-- Owner-only batch image refs for image-first Inventory cards.
-- Returns only rows owned by auth.uid(); storage bytes remain in the private thing-images bucket.
create or replace function public.load_my_inventory_cover_image_refs_v1()
returns table(item_id uuid, storage_path text)
language sql
security definer
set search_path = ''
stable
as $$
  select ranked.item_id, ranked.storage_path
  from (
    select
      ii.item_id,
      ii.storage_path,
      row_number() over (
        partition by ii.item_id
        order by ii.is_primary desc, ii.sort_order, ii.created_at
      ) as rn
    from private.item_images ii
    join public.items i on i.id = ii.item_id
    where ii.owner_id = auth.uid()
      and i.owner_id = auth.uid()
  ) ranked
  where ranked.rn = 1;
$$;

revoke all on function public.load_my_inventory_cover_image_refs_v1() from public, anon;
grant execute on function public.load_my_inventory_cover_image_refs_v1() to authenticated;
