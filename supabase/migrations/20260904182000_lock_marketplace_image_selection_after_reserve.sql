-- Freeze the seller-selected Marketplace image set once a concrete buyer reservation exists.
-- This prevents the visual transaction snapshot from changing underneath a reserved/sold buyer.
create or replace function public.set_my_item_image_marketplace_visibility(
  p_item_id uuid,
  p_image_id uuid,
  p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_current boolean;
  v_visible_count integer;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  select ii.marketplace_visible into v_current
  from private.item_images ii
  join public.items i on i.id = ii.item_id
  where ii.id = p_image_id
    and ii.item_id = p_item_id
    and ii.owner_id = v_owner
    and i.owner_id = v_owner;

  if not found then
    raise exception 'IMAGE_NOT_OWNED';
  end if;

  if exists (
    select 1
    from private.marketplace_conversations c
    where c.item_id = p_item_id
      and c.seller_id = v_owner
      and c.status in ('RESERVED', 'SOLD')
  ) then
    raise exception 'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION';
  end if;

  if coalesce(p_visible, false) and not v_current then
    select count(*) into v_visible_count
    from private.item_images ii
    where ii.item_id = p_item_id
      and ii.owner_id = v_owner
      and ii.marketplace_visible;

    if v_visible_count >= 6 then
      raise exception 'MARKETPLACE_IMAGE_LIMIT_REACHED';
    end if;
  end if;

  update private.item_images
  set marketplace_visible = coalesce(p_visible, false)
  where id = p_image_id
    and item_id = p_item_id
    and owner_id = v_owner;

  return coalesce(p_visible, false);
end;
$$;

revoke all on function public.set_my_item_image_marketplace_visibility(uuid,uuid,boolean) from public, anon;
grant execute on function public.set_my_item_image_marketplace_visibility(uuid,uuid,boolean) to authenticated;

comment on function public.set_my_item_image_marketplace_visibility(uuid,uuid,boolean) is
  'Lets an authenticated owner select up to six Marketplace images before reservation; selection is frozen while a reserved/sold transaction exists.';
