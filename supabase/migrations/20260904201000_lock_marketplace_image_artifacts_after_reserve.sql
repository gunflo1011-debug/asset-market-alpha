-- Keep the reserved/sold visual transaction snapshot immutable at both metadata and storage-object layers.

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
        and not exists (
          select 1 from private.marketplace_conversations c
          where c.item_id = v_item_id
            and c.seller_id = v_user
            and c.status in ('RESERVED','SOLD')
        )
    );
  end if;

  return exists(
    select 1
    from private.item_images ii
    where ii.id = v_image_id
      and ii.item_id = v_item_id
      and ii.marketplace_visible
      and (
        exists(select 1 from private.marketplace_listings l where l.item_id=ii.item_id and l.status='PUBLISHED')
        or exists(select 1 from private.marketplace_conversations c where c.item_id=ii.item_id and c.status in ('RESERVED','SOLD') and v_user in (c.buyer_id,c.seller_id))
      )
  );
end;
$$;

create or replace function public.delete_my_item_image(p_item_id uuid, p_image_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_path text;
  v_was_primary boolean;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text, 0));

  if exists (
    select 1 from private.marketplace_conversations c
    where c.item_id=p_item_id and c.seller_id=v_owner and c.status in ('RESERVED','SOLD')
  ) then
    raise exception 'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION';
  end if;

  delete from private.item_images ii
  using public.items i
  where ii.id=p_image_id and ii.item_id=p_item_id and ii.owner_id=v_owner and i.id=ii.item_id and i.owner_id=v_owner
  returning ii.storage_path, ii.is_primary into v_path, v_was_primary;
  if v_path is null then raise exception 'IMAGE_NOT_OWNED'; end if;
  if v_was_primary then
    update private.item_images set is_primary=true
    where id=(select id from private.item_images where item_id=p_item_id and owner_id=v_owner order by sort_order, created_at limit 1);
  end if;
  return v_path;
end;
$$;

revoke all on function public.marketplace_image_object_access(text,boolean) from public, anon;
grant execute on function public.marketplace_image_object_access(text,boolean) to authenticated;
revoke all on function public.delete_my_item_image(uuid,uuid) from public, anon;
grant execute on function public.delete_my_item_image(uuid,uuid) to authenticated;

comment on function public.marketplace_image_object_access(text,boolean) is
  'Reads remain available according to Marketplace lifecycle; seller management of projected Marketplace objects is blocked once a reserved/sold transaction exists.';
comment on function public.delete_my_item_image(uuid,uuid) is
  'Deletes an owner image only before reservation/sale; reserved/sold Marketplace transaction images are immutable.';
