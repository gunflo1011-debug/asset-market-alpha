begin;
select plan(6);

select has_function(
  'public',
  'alpha_backend_info',
  array[]::text[],
  'closed alpha compatibility handshake exists'
);

select function_privs_are(
  'public','alpha_backend_info',array[]::text[],'anon',array[]::text[],
  'anonymous clients cannot query backend capabilities'
);

select function_privs_are(
  'public','alpha_backend_info',array[]::text[],'authenticated',array['EXECUTE'],
  'authenticated clients may query backend capabilities'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is(
  (public.alpha_backend_info()->>'contract_version')::integer,
  1,
  'mobile/backend contract version is explicit'
);

select is(
  public.alpha_backend_info()->>'alpha_scope',
  'smartphone-private-inventory',
  'handshake is scoped to the current alpha product'
);

select ok(
  (public.alpha_backend_info()->'capabilities') ?& array['auth','private_inventory','condition_snapshot','privacy_minimal_telemetry'],
  'handshake advertises all required closed-alpha capabilities'
);

select * from finish();
rollback;
