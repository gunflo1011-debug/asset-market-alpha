create table private.alpha_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'SESSION_RESTORED',
    'SIGN_IN_SUCCEEDED',
    'SIGN_UP_REQUESTED',
    'INVENTORY_VIEWED',
    'DEVICE_ADDED'
  )),
  item_id uuid null references public.items(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index alpha_events_user_time_idx
  on private.alpha_events (user_id, occurred_at desc);

create index alpha_events_name_time_idx
  on private.alpha_events (event_name, occurred_at desc);

alter table private.alpha_events enable row level security;

revoke all on table private.alpha_events from public, anon, authenticated;

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
    'DEVICE_ADDED'
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
'Privacy-minimal closed-alpha product telemetry. No email, device fingerprint, free text, or public read path.';

comment on function public.track_alpha_event is
'Writes one allow-listed closed-alpha event for the authenticated user; optional item references must be owner-bound.';
