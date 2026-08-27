-- Align the hosted Things schema with the mobile generic-Thing contract without weakening owner RLS.
alter table public.items
  add column if not exists custom_name text,
  add column if not exists category text,
  add column if not exists location_label text,
  add column if not exists notes text;

-- Preserve existing generic Things created through the earlier display_name/category_id model.
update public.items i
set custom_name = coalesce(i.custom_name, i.display_name),
    category = coalesce(i.category, c.label)
from public.thing_categories c
where i.category_id = c.id
  and i.variant_id is null;

-- Legacy device commands still populate display_name/category_id. New generic Things use custom_* fields.
alter table public.items alter column display_name drop not null;
alter table public.items alter column category_id drop not null;

alter table public.items drop constraint if exists items_identity_check;
alter table public.items add constraint items_identity_check
  check (
    variant_id is not null
    or nullif(btrim(custom_name), '') is not null
    or nullif(btrim(display_name), '') is not null
  );

alter table public.items drop constraint if exists items_custom_name_length_check;
alter table public.items add constraint items_custom_name_length_check
  check (custom_name is null or char_length(custom_name) <= 120);
alter table public.items drop constraint if exists items_category_length_check;
alter table public.items add constraint items_category_length_check
  check (category is null or char_length(category) <= 80);
alter table public.items drop constraint if exists items_location_length_check;
alter table public.items add constraint items_location_length_check
  check (location_label is null or char_length(location_label) <= 120);
alter table public.items drop constraint if exists items_notes_length_check;
alter table public.items add constraint items_notes_length_check
  check (notes is null or char_length(notes) <= 2000);

-- Replace the older 2-argument RPC with the mobile contract. Existing clients are no longer release candidates.
drop function if exists public.add_private_thing(text,text);

create or replace function public.add_private_thing(
  p_name text,
  p_category text default null,
  p_location text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_item uuid;
  v_name text := nullif(btrim(p_name), '');
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_name is null then raise exception 'THING_NAME_REQUIRED' using errcode='22023'; end if;
  if char_length(v_name) > 120
     or coalesce(char_length(nullif(btrim(p_category),'')),0) > 80
     or coalesce(char_length(nullif(btrim(p_location),'')),0) > 120
     or coalesce(char_length(nullif(btrim(p_notes),'')),0) > 2000
  then raise exception 'THING_FIELD_TOO_LONG' using errcode='22023'; end if;

  insert into public.items(owner_id, variant_id, custom_name, category, location_label, notes)
  values(v_owner, null, v_name, nullif(btrim(p_category),''), nullif(btrim(p_location),''), nullif(btrim(p_notes),''))
  returning id into v_item;
  return v_item;
end; $$;

create or replace function public.update_private_thing(
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
  if not exists(select 1 from public.items where id=p_item_id and owner_id=v_owner and variant_id is null)
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
  where id=p_item_id and owner_id=v_owner and variant_id is null;
end; $$;

create or replace function public.delete_private_thing(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not exists(select 1 from public.items where id=p_item_id and owner_id=v_owner and variant_id is null)
    then raise exception 'ITEM_NOT_OWNED' using errcode='42501'; end if;
  delete from public.items where id=p_item_id and owner_id=v_owner and variant_id is null;
end; $$;

revoke all on function public.add_private_thing(text,text,text,text) from public, anon;
grant execute on function public.add_private_thing(text,text,text,text) to authenticated;
revoke all on function public.update_private_thing(uuid,text,text,text,text) from public, anon;
grant execute on function public.update_private_thing(uuid,text,text,text,text) to authenticated;
revoke all on function public.delete_private_thing(uuid) from public, anon;
grant execute on function public.delete_private_thing(uuid) to authenticated;
