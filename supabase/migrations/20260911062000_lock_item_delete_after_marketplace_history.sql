create or replace function public.delete_private_device(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  perform 1
  from public.items i
  where i.id = p_item_id
    and i.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;

  if exists (
    select 1
    from private.marketplace_listings l
    where l.item_id = p_item_id
      and l.seller_id = v_owner_id
      and l.status = 'PUBLISHED'
  ) then
    raise exception 'MARKETPLACE_LISTING_ACTIVE';
  end if;

  if exists (
    select 1
    from private.marketplace_conversations c
    where c.item_id = p_item_id
      and c.seller_id = v_owner_id
  ) then
    raise exception 'MARKETPLACE_TRANSACTION_HISTORY_LOCKED';
  end if;

  delete from public.items
  where id = p_item_id
    and owner_id = v_owner_id;
end;
$function$;

create or replace function public.delete_private_thing(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  perform 1
  from public.items i
  where i.id = p_item_id
    and i.owner_id = v_owner
    and i.variant_id is null
  for update;

  if not found then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;

  if exists (
    select 1
    from private.marketplace_listings l
    where l.item_id = p_item_id
      and l.seller_id = v_owner
      and l.status = 'PUBLISHED'
  ) then
    raise exception 'MARKETPLACE_LISTING_ACTIVE';
  end if;

  if exists (
    select 1
    from private.marketplace_conversations c
    where c.item_id = p_item_id
      and c.seller_id = v_owner
  ) then
    raise exception 'MARKETPLACE_TRANSACTION_HISTORY_LOCKED';
  end if;

  delete from public.items
  where id = p_item_id
    and owner_id = v_owner
    and variant_id is null;
end;
$function$;
