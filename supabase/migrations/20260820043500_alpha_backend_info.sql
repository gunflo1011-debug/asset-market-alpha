create or replace function public.alpha_backend_info()
returns jsonb
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select jsonb_build_object(
    'contract_version', 1,
    'alpha_scope', 'smartphone-private-inventory',
    'capabilities', jsonb_build_array(
      'auth',
      'private_inventory',
      'condition_snapshot',
      'privacy_minimal_telemetry'
    )
  );
$$;

revoke all on function public.alpha_backend_info() from public, anon;
grant execute on function public.alpha_backend_info() to authenticated;

comment on function public.alpha_backend_info is
'Authenticated, non-sensitive compatibility handshake for closed-alpha mobile clients. Contract version changes only for breaking client/backend interface changes.';
