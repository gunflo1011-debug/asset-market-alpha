-- Reproduce the hardened live RPC boundary on every clean database rebuild.
-- This successor migration intentionally changes function attributes only; function
-- bodies and application behavior remain unchanged.

alter function public.alpha_backend_info()
  security invoker;
alter function public.alpha_backend_info()
  set search_path = '';

alter function public.add_private_device(
  uuid, text, text, text, boolean, boolean, smallint, boolean, boolean
) set search_path = '';

alter function public.track_alpha_event(text, uuid)
  set search_path = '';

-- The generic Things command exists in the hosted migration lineage but not in
-- every historical repository baseline. Harden it when present without making
-- older clean rebuilds fail.
do $$
begin
  if pg_catalog.to_regprocedure('public.add_private_thing(text,text)') is not null then
    execute 'alter function public.add_private_thing(text,text) set search_path = ''''';
  end if;
end;
$$;

revoke all on function public.alpha_backend_info() from public, anon;
grant execute on function public.alpha_backend_info() to authenticated;

revoke all on function public.add_private_device(
  uuid, text, text, text, boolean, boolean, smallint, boolean, boolean
) from public, anon;
grant execute on function public.add_private_device(
  uuid, text, text, text, boolean, boolean, smallint, boolean, boolean
) to authenticated;

revoke all on function public.track_alpha_event(text, uuid) from public, anon;
grant execute on function public.track_alpha_event(text, uuid) to authenticated;
