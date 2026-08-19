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
set search_path = public, private, auth, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
  v_item_id uuid;
begin
  if v_owner_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (select 1 from public.product_variants where id = p_variant_id) then
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

  insert into public.items (owner_id, variant_id, color)
  values (v_owner_id, p_variant_id, nullif(btrim(p_color), ''))
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

revoke all on function public.add_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean) from public, anon;
grant execute on function public.add_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean) to authenticated;

comment on function public.add_private_device is
'Atomically creates an owner-private inventory item, its initial portfolio condition snapshot, and PRIVATE market state. Never publishes inventory.';
