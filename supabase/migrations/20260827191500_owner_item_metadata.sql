-- Allow authenticated owners to edit display metadata on any inventory item,
-- including catalog-backed devices, without exposing ownership or market-state mutation.
create or replace function public.update_private_item_metadata(
  p_item_id uuid,
  p_name text,
  p_category text default null,
  p_location text default null,
  p_notes text default null
) returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_name text := nullif(btrim(p_name), '');
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not exists(select 1 from public.items where id=p_item_id and owner_id=v_owner)
    then raise exception 'ITEM_NOT_OWNED' using errcode='42501'; end if;
  if v_name is null then raise exception 'THING_NAME_REQUIRED' using errcode='22023'; end if;
  if char_length(v_name) > 120
     or coalesce(char_length(nullif(btrim(p_category),'')),0) > 80
     or coalesce(char_length(nullif(btrim(p_location),'')),0) > 120
     or coalesce(char_length(nullif(btrim(p_notes),'')),0) > 2000
  then raise exception 'THING_FIELD_TOO_LONG' using errcode='22023'; end if;

  update public.items
  set custom_name=v_name,
      category=nullif(btrim(p_category),''),
      location_label=nullif(btrim(p_location),''),
      notes=nullif(btrim(p_notes),''),
      updated_at=now()
  where id=p_item_id and owner_id=v_owner;
end; $$;

revoke all on function public.update_private_item_metadata(uuid,text,text,text,text) from public, anon;
grant execute on function public.update_private_item_metadata(uuid,text,text,text,text) to authenticated;
