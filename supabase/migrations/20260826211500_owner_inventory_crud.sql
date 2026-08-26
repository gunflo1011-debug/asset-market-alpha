create or replace function public.update_private_device(
  p_item_id uuid,
  p_color text default null,
  p_display_state text default 'INTACT',
  p_housing_state text default 'CLEAN',
  p_cameras_working boolean default true,
  p_biometrics_working boolean default true,
  p_battery_health smallint default null,
  p_network_locked boolean default false,
  p_other_defect boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not exists (select 1 from public.items where id=p_item_id and owner_id=v_owner_id) then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;
  if p_display_state not in ('INTACT','DAMAGED') then raise exception 'INVALID_DISPLAY_STATE' using errcode='22023'; end if;
  if p_housing_state not in ('CLEAN','LIGHT_WEAR','HEAVY_WEAR','DAMAGED') then raise exception 'INVALID_HOUSING_STATE' using errcode='22023'; end if;
  if p_battery_health is not null and (p_battery_health < 0 or p_battery_health > 100) then raise exception 'INVALID_BATTERY_HEALTH' using errcode='22023'; end if;

  update public.items set color=nullif(btrim(p_color),'') where id=p_item_id and owner_id=v_owner_id;
  insert into public.condition_snapshots(item_id,purpose,display_state,housing_state,cameras_working,biometrics_working,battery_health,network_locked,other_defect)
  values(p_item_id,'PORTFOLIO',p_display_state,p_housing_state,p_cameras_working,p_biometrics_working,p_battery_health,p_network_locked,p_other_defect);
end;
$$;

create or replace function public.delete_private_device(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not exists (select 1 from public.items where id=p_item_id and owner_id=v_owner_id) then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;
  delete from public.items where id=p_item_id and owner_id=v_owner_id;
end;
$$;

revoke all on function public.update_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean) from public, anon;
grant execute on function public.update_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean) to authenticated;
revoke all on function public.delete_private_device(uuid) from public, anon;
grant execute on function public.delete_private_device(uuid) to authenticated;

comment on function public.update_private_device is 'Updates only the authenticated owner item and appends a portfolio condition snapshot.';
comment on function public.delete_private_device is 'Deletes only an item owned by the authenticated caller; dependent snapshots and private market state cascade.';
