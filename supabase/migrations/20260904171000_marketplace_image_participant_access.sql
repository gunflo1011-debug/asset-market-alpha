-- Preserve access to seller-selected Marketplace image copies for the actual sale
-- participants after reservation withdraws the listing from public discovery.
-- Private source images in thing-images remain owner-only and are never exposed here.

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
    );
  end if;

  return exists(
    select 1
    from private.item_images ii
    where ii.id = v_image_id
      and ii.item_id = v_item_id
      and ii.marketplace_visible
      and (
        exists(
          select 1
          from private.marketplace_listings l
          where l.item_id = ii.item_id
            and l.status = 'PUBLISHED'
        )
        or exists(
          select 1
          from private.marketplace_conversations c
          where c.item_id = ii.item_id
            and c.status in ('RESERVED', 'SOLD')
            and v_user in (c.buyer_id, c.seller_id)
        )
      )
  );
end;
$$;

create or replace function public.load_marketplace_image_refs_v1()
returns table(item_id uuid, image_id uuid, sort_order integer)
language sql
security definer
set search_path = ''
stable
as $$
  select ii.item_id, ii.id, ii.sort_order
  from private.item_images ii
  where ii.marketplace_visible
    and (
      exists(
        select 1
        from private.marketplace_listings l
        where l.item_id = ii.item_id
          and l.status = 'PUBLISHED'
          and l.seller_id <> auth.uid()
      )
      or exists(
        select 1
        from private.marketplace_conversations c
        where c.item_id = ii.item_id
          and c.status in ('RESERVED', 'SOLD')
          and auth.uid() in (c.buyer_id, c.seller_id)
      )
    )
  order by ii.item_id, ii.is_primary desc, ii.sort_order, ii.created_at;
$$;

revoke all on function public.marketplace_image_object_access(text,boolean) from public, anon;
grant execute on function public.marketplace_image_object_access(text,boolean) to authenticated;
revoke all on function public.load_marketplace_image_refs_v1() from public, anon;
grant execute on function public.load_marketplace_image_refs_v1() to authenticated;

comment on function public.marketplace_image_object_access(text,boolean) is
  'Allows authenticated public discovery reads for selected images while a listing is published, and preserves reads only for the reserved/sold buyer and seller afterwards. Private thing-images remain owner-only.';

comment on function public.load_marketplace_image_refs_v1() is
  'Returns selected Marketplace image identifiers for published discovery or for the actual reserved/sold conversation participants. Private source paths are never returned.';
