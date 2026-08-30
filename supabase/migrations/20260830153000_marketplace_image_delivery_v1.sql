-- Secure delivery projection for seller-selected Marketplace images.
-- Private Thing images remain in thing-images. Sellers copy only explicitly selected images
-- into this separate private bucket before publishing. Buyers can read only projections
-- whose source image is still selected and whose listing is currently PUBLISHED.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-images', 'marketplace-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.marketplace_image_object_access(p_name text, p_manage boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_item_id uuid;
  v_image_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  begin
    v_item_id := split_part(p_name, '/', 1)::uuid;
    v_image_id := split_part(p_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;

  if split_part(p_name, '/', 3) <> '' then return false; end if;

  if coalesce(p_manage, false) then
    return exists(
      select 1
      from private.item_images ii
      join public.items i on i.id = ii.item_id
      where ii.id = v_image_id
        and ii.item_id = v_item_id
        and ii.owner_id = v_user
        and i.owner_id = v_user
        and ii.marketplace_visible
    );
  end if;

  return exists(
    select 1
    from private.item_images ii
    join private.marketplace_listings l on l.item_id = ii.item_id
    where ii.id = v_image_id
      and ii.item_id = v_item_id
      and ii.marketplace_visible
      and l.status = 'PUBLISHED'
  );
end;
$$;

revoke all on function public.marketplace_image_object_access(text,boolean) from public, anon;
grant execute on function public.marketplace_image_object_access(text,boolean) to authenticated;

create or replace function public.load_marketplace_image_refs_v1()
returns table(item_id uuid, image_id uuid, sort_order integer)
language sql
security definer
set search_path = ''
stable
as $$
  select ii.item_id, ii.id, ii.sort_order
  from private.item_images ii
  join private.marketplace_listings l on l.item_id = ii.item_id
  where ii.marketplace_visible
    and l.status = 'PUBLISHED'
    and l.seller_id <> auth.uid()
  order by ii.item_id, ii.is_primary desc, ii.sort_order, ii.created_at;
$$;

revoke all on function public.load_marketplace_image_refs_v1() from public, anon;
grant execute on function public.load_marketplace_image_refs_v1() to authenticated;

drop policy if exists marketplace_images_selected_read on storage.objects;
create policy marketplace_images_selected_read on storage.objects
for select to authenticated
using (
  bucket_id = 'marketplace-images'
  and public.marketplace_image_object_access(name, false)
);

drop policy if exists marketplace_images_owner_insert on storage.objects;
create policy marketplace_images_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'marketplace-images'
  and public.marketplace_image_object_access(name, true)
);

drop policy if exists marketplace_images_owner_update on storage.objects;
create policy marketplace_images_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'marketplace-images'
  and public.marketplace_image_object_access(name, true)
)
with check (
  bucket_id = 'marketplace-images'
  and public.marketplace_image_object_access(name, true)
);

drop policy if exists marketplace_images_owner_delete on storage.objects;
create policy marketplace_images_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'marketplace-images'
  and public.marketplace_image_object_access(name, true)
);

comment on function public.load_marketplace_image_refs_v1() is
  'Returns only opaque item/image identifiers for selected images on published listings. Seller identity and private thing-images paths are never returned.';
