alter table public.items
  alter column variant_id drop not null,
  add column custom_name text,
  add column category text,
  add column location_label text,
  add column notes text;

alter table public.items
  add constraint items_identity_check
  check (variant_id is not null or nullif(btrim(custom_name), '') is not null),
  add constraint items_custom_name_length_check
  check (custom_name is null or char_length(custom_name) <= 120),
  add constraint items_category_length_check
  check (category is null or char_length(category) <= 80),
  add constraint items_location_length_check
  check (location_label is null or char_length(location_label) <= 120),
  add constraint items_notes_length_check
  check (notes is null or char_length(notes) <= 2000);

create or replace function public.add_private_thing(
  p_name text,
  p_category text default null,
  p_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_item_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_category text := nullif(btrim(p_category), '');
  v_location text := nullif(btrim(p_location), '');
  v_notes text := nullif(btrim(p_notes), '');
begin
  if v_owner is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if v_name is null then
    raise exception using errcode = '22023', message = 'THING_NAME_REQUIRED';
  end if;

  if char_length(v_name) > 120
     or coalesce(char_length(v_category), 0) > 80
     or coalesce(char_length(v_location), 0) > 120
     or coalesce(char_length(v_notes), 0) > 2000 then
    raise exception using errcode = '22023', message = 'THING_FIELD_TOO_LONG';
  end if;

  insert into public.items (
    owner_id,
    variant_id,
    custom_name,
    category,
    location_label,
    notes
  ) values (
    v_owner,
    null,
    v_name,
    v_category,
    v_location,
    v_notes
  )
  returning id into v_item_id;

  return v_item_id;
end;
$$;

revoke all on function public.add_private_thing(text, text, text, text) from public, anon;
grant execute on function public.add_private_thing(text, text, text, text) to authenticated;

comment on function public.add_private_thing(text, text, text, text) is
  'Creates a private, non-market generic Thing owned by the authenticated user.';
