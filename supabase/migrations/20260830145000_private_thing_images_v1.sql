-- Private Thing images. Files remain private by default; only the owner can access them.
create table if not exists private.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  marketplace_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists item_images_item_order_idx
  on private.item_images(item_id, sort_order, created_at);

revoke all on table private.item_images from public, anon, authenticated;

-- Storage schema differs across supported local/hosted Supabase versions. Keep the bucket
-- private on schemas exposing the privacy/config columns, while retaining replayability on
-- older local schemas where a new bucket is private by default.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name='public')
     and exists (select 1 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name='file_size_limit')
     and exists (select 1 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name='allowed_mime_types') then
    execute $sql$
      insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
      values ('thing-images', 'thing-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
      on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types
    $sql$;
  else
    insert into storage.buckets(id, name) values ('thing-images', 'thing-images') on conflict (id) do nothing;
  end if;
end;
$$;

-- Object names must be <user-id>/<item-id>/<file>.
drop policy if exists thing_images_owner_select on storage.objects;
create policy thing_images_owner_select on storage.objects
for select to authenticated
using (bucket_id = 'thing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists thing_images_owner_insert on storage.objects;
create policy thing_images_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'thing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists thing_images_owner_delete on storage.objects;
create policy thing_images_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'thing-images' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.register_my_item_image(p_item_id uuid, p_storage_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_image uuid;
  v_next_order integer;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not exists(select 1 from public.items i where i.id = p_item_id and i.owner_id = v_owner) then
    raise exception 'ITEM_NOT_OWNED';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_owner::text or split_part(p_storage_path, '/', 2) <> p_item_id::text then
    raise exception 'INVALID_IMAGE_PATH';
  end if;

  select coalesce(max(ii.sort_order), -1) + 1 into v_next_order
  from private.item_images ii where ii.item_id = p_item_id;

  insert into private.item_images(item_id, owner_id, storage_path, sort_order, is_primary)
  values (p_item_id, v_owner, p_storage_path, v_next_order,
    not exists(select 1 from private.item_images ii where ii.item_id = p_item_id))
  returning id into v_image;
  return v_image;
end;
$$;

create or replace function public.load_my_item_images(p_item_id uuid)
returns table(id uuid, storage_path text, sort_order integer, is_primary boolean, marketplace_visible boolean, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select ii.id, ii.storage_path, ii.sort_order, ii.is_primary, ii.marketplace_visible, ii.created_at
  from private.item_images ii
  join public.items i on i.id = ii.item_id
  where ii.item_id = p_item_id and i.owner_id = auth.uid() and ii.owner_id = auth.uid()
  order by ii.is_primary desc, ii.sort_order, ii.created_at;
$$;

create or replace function public.set_my_item_primary_image(p_item_id uuid, p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists(select 1 from private.item_images ii join public.items i on i.id=ii.item_id where ii.id=p_image_id and ii.item_id=p_item_id and ii.owner_id=auth.uid() and i.owner_id=auth.uid()) then
    raise exception 'IMAGE_NOT_OWNED';
  end if;
  update private.item_images set is_primary = false where item_id = p_item_id and owner_id = auth.uid();
  update private.item_images set is_primary = true where id = p_image_id and owner_id = auth.uid();
end;
$$;

create or replace function public.delete_my_item_image(p_item_id uuid, p_image_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
  v_was_primary boolean;
begin
  delete from private.item_images ii
  using public.items i
  where ii.id=p_image_id and ii.item_id=p_item_id and ii.owner_id=auth.uid() and i.id=ii.item_id and i.owner_id=auth.uid()
  returning ii.storage_path, ii.is_primary into v_path, v_was_primary;
  if v_path is null then raise exception 'IMAGE_NOT_OWNED'; end if;
  if v_was_primary then
    update private.item_images set is_primary=true
    where id=(select id from private.item_images where item_id=p_item_id and owner_id=auth.uid() order by sort_order, created_at limit 1);
  end if;
  return v_path;
end;
$$;

revoke all on function public.register_my_item_image(uuid,text) from public, anon;
revoke all on function public.load_my_item_images(uuid) from public, anon;
revoke all on function public.set_my_item_primary_image(uuid,uuid) from public, anon;
revoke all on function public.delete_my_item_image(uuid,uuid) from public, anon;
grant execute on function public.register_my_item_image(uuid,text) to authenticated;
grant execute on function public.load_my_item_images(uuid) to authenticated;
grant execute on function public.set_my_item_primary_image(uuid,uuid) to authenticated;
grant execute on function public.delete_my_item_image(uuid,uuid) to authenticated;
