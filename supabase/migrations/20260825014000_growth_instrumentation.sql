-- Privacy-safe core-loop instrumentation for free-first Things growth learning.
-- Events intentionally contain no free text, email, device fingerprint, value,
-- price, location, condition, catalog identity, or advertising identifier.

alter table private.alpha_events
  drop constraint if exists alpha_events_event_name_check;

alter table private.alpha_events
  add constraint alpha_events_event_name_check check (event_name in (
    'SESSION_RESTORED',
    'SIGN_IN_SUCCEEDED',
    'SIGN_UP_REQUESTED',
    'PASSWORD_RECOVERY_SUCCEEDED',
    'INVENTORY_VIEWED',
    'DEVICE_ADDED',
    'ITEM_CAPTURE_STARTED',
    'ITEM_CAPTURE_COMPLETED',
    'VALUE_VIEWED',
    'TOTAL_VALUE_VIEWED',
    'SELL_FLOW_STARTED',
    'SELL_FLOW_COMPLETED'
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
    'PASSWORD_RECOVERY_SUCCEEDED',
    'INVENTORY_VIEWED',
    'DEVICE_ADDED',
    'ITEM_CAPTURE_STARTED',
    'ITEM_CAPTURE_COMPLETED',
    'VALUE_VIEWED',
    'TOTAL_VALUE_VIEWED',
    'SELL_FLOW_STARTED',
    'SELL_FLOW_COMPLETED'
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

comment on table private.alpha_events is
'Privacy-minimal product telemetry for activation and core-loop learning. Stores only authenticated user id, allow-listed event name, optional owner-bound item id, and timestamp; no free text or item-sensitive payload.';
