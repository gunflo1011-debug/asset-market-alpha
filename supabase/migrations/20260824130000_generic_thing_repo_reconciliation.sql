-- Reconcile the generic Things command from the hosted migration lineage into
-- the repository so clean local rebuilds exercise all three authenticated commands.
-- Repository migration only: no hosted apply is performed by this change.

create table if not exists public.thing_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (btrim(key) <> ''),
  label text not null check (btrim(label) <> ''),
  parent_id uuid references public.thing_categories(id) on delete restrict,
  created_at timestamptz not null default now()
);

insert into public.thing_categories (key, label)
values
  ('books.book', 'Book'),
  ('clothing.item', 'Clothing'),
  ('electronics.other', 'Electronics'),
  ('electronics.phone', 'Phone'),
  ('games.toy', 'Games & toys'),
  ('hobby.item', 'Hobby'),
  ('home.appliance', 'Home appliance'),
  ('home.furniture', 'Furniture'),
  ('jewelry.item', 'Jewelry'),
  ('kitchen.item', 'Kitchen'),
  ('music.instrument', 'Musical instrument'),
  ('office.item', 'Office'),
  ('other.item', 'Other'),
  ('outdoor.gear', 'Outdoor gear'),
  ('sports.bicycle', 'Bicycle'),
  ('tools.power_tool', 'Power tool')
on conflict (key) do update set label = excluded.label;

alter table public.thing_categories enable row level security;
alter table public.thing_categories force row level security;
revoke all on public.thing_categories from public, anon, authenticated;
grant select on public.thing_categories to authenticated;

drop policy if exists thing_categories_authenticated_read on public.thing_categories;
create policy thing_categories_authenticated_read
  on public.thing_categories
  for select
  to authenticated
  using (true);

create index if not exists thing_categories_parent_idx
  on public.thing_categories(parent_id);

alter table public.items
  add column if not exists display_name text,
  add column if not exists category_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table public.items
  alter column variant_id drop not null;

update public.items i
set
  display_name = coalesce(
    nullif(btrim(concat_ws(' ', p.brand, p.family)), ''),
    'Thing'
  ),
  category_id = c.id
from public.product_variants v
join public.products p on p.id = v.product_id
cross join public.thing_categories c
where i.variant_id = v.id
  and c.key = 'electronics.phone'
  and (i.display_name is null or i.category_id is null);

alter table public.items
  alter column display_name set not null,
  alter column category_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.items'::regclass
      and conname = 'items_category_id_fkey'
  ) then
    alter table public.items
      add constraint items_category_id_fkey
      foreign key (category_id)
      references public.thing_categories(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists items_category_idx
  on public.items(category_id);

create or replace function public.add_private_thing(
  p_display_name text,
  p_category_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_item_id uuid;
  v_category_id uuid;
  v_display_name text := nullif(btrim(p_display_name), '');
  v_category_key text := nullif(btrim(p_category_key), '');
begin
  if v_owner_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_display_name is null or char_length(v_display_name) > 120 then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = '22023';
  end if;

  if v_category_key is null then
    raise exception 'INVALID_CATEGORY' using errcode = '22023';
  end if;

  select id
  into v_category_id
  from public.thing_categories
  where key = v_category_key;

  if v_category_id is null then
    raise exception 'UNKNOWN_CATEGORY' using errcode = '23503';
  end if;

  insert into public.items (
    owner_id,
    variant_id,
    color,
    display_name,
    category_id
  ) values (
    v_owner_id,
    null,
    null,
    v_display_name,
    v_category_id
  )
  returning id into v_item_id;

  insert into private.item_market_state (item_id, market_state, possession_status)
  values (v_item_id, 'PRIVATE', 'UNVERIFIED');

  return v_item_id;
end;
$$;

revoke all on function public.add_private_thing(text, text) from public, anon;
grant execute on function public.add_private_thing(text, text) to authenticated;

comment on function public.add_private_thing is
'Atomically creates one owner-bound generic Thing in PRIVATE/UNVERIFIED state. Repeated calls intentionally create distinct inventory records.';

create or replace function public.add_private_device(
  p_variant_id uuid,
  p_color text default null,
  p_display_state text default 'INTACT',
  p_housing_state text default 'CLEAN',
  p_cameras_working boolean default true,
  p_biometrics_working boolean default true,
  p_battery_health smallint default null,
  p_network_locked boolean default false,
  p_other_defect boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_item_id uuid;
  v_display_name text;
  v_category_id uuid;
begin
  if v_owner_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select
    coalesce(nullif(btrim(concat_ws(' ', p.brand, p.family)), ''), 'Thing'),
    c.id
  into v_display_name, v_category_id
  from public.product_variants v
  join public.products p on p.id = v.product_id
  cross join public.thing_categories c
  where v.id = p_variant_id
    and c.key = 'electronics.phone';

  if v_display_name is null or v_category_id is null then
    raise exception 'UNKNOWN_VARIANT' using errcode = '23503';
  end if;

  if p_display_state not in ('INTACT','DAMAGED') then
    raise exception 'INVALID_DISPLAY_STATE' using errcode = '22023';
  end if;

  if p_housing_state not in ('CLEAN','LIGHT_WEAR','HEAVY_WEAR','DAMAGED') then
    raise exception 'INVALID_HOUSING_STATE' using errcode = '22023';
  end if;

  if p_battery_health is not null and (p_battery_health < 0 or p_battery_health > 100) then
    raise exception 'INVALID_BATTERY_HEALTH' using errcode = '22023';
  end if;

  insert into public.items (
    owner_id,
    variant_id,
    color,
    display_name,
    category_id
  ) values (
    v_owner_id,
    p_variant_id,
    nullif(btrim(p_color), ''),
    v_display_name,
    v_category_id
  )
  returning id into v_item_id;

  insert into public.condition_snapshots (
    item_id,
    purpose,
    display_state,
    housing_state,
    cameras_working,
    biometrics_working,
    battery_health,
    network_locked,
    other_defect
  ) values (
    v_item_id,
    'PORTFOLIO',
    p_display_state,
    p_housing_state,
    p_cameras_working,
    p_biometrics_working,
    p_battery_health,
    p_network_locked,
    p_other_defect
  );

  insert into private.item_market_state (item_id, market_state, possession_status)
  values (v_item_id, 'PRIVATE', 'UNVERIFIED');

  return v_item_id;
end;
$$;

revoke all on function public.add_private_device(
  uuid, text, text, text, boolean, boolean, smallint, boolean, boolean
) from public, anon;
grant execute on function public.add_private_device(
  uuid, text, text, text, boolean, boolean, smallint, boolean, boolean
) to authenticated;
