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

alter table private.alpha_events
  drop constraint if exists alpha_events_event_name_check;

alter table private.alpha_events
  add constraint alpha_events_event_name_check check (event_name in (
    'SESSION_RESTORED',
    'SIGN_IN_SUCCEEDED',
    'SIGN_UP_REQUESTED',
    'INVENTORY_VIEWED',
    'DEVICE_ADDED',
    'THING_ADDED'
  ));

create or replace function public.track_alpha_event(
  p_event_name text,
  p_item_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_event_name not in (
    'SESSION_RESTORED',
    'SIGN_IN_SUCCEEDED',
    'SIGN_UP_REQUESTED',
    'INVENTORY_VIEWED',
    'DEVICE_ADDED',
    'THING_ADDED'
  ) then
    raise exception 'UNKNOWN_ALPHA_EVENT' using errcode = '22023';
  end if;

  if p_item_id is not null and not exists (
    select 1
    from public.items i
    where i.id = p_item_id
      and i.owner_id = v_user_id
  ) then
    raise exception 'ITEM_NOT_OWNED' using errcode = '42501';
  end if;

  insert into private.alpha_events (user_id, event_name, item_id)
  values (v_user_id, p_event_name, p_item_id);
end;
$$;

revoke all on function public.track_alpha_event(text,uuid) from public, anon;
grant execute on function public.track_alpha_event(text,uuid) to authenticated;
