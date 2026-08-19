begin;
select plan(4);

select has_function(
  'public',
  'add_private_device',
  array['uuid','text','text','text','boolean','boolean','smallint','boolean','boolean'],
  'atomic private inventory command exists'
);

select function_privs_are(
  'public',
  'add_private_device',
  array['uuid','text','text','text','boolean','boolean','smallint','boolean','boolean'],
  'anon',
  array[]::text[],
  'anon cannot create private inventory'
);

select function_privs_are(
  'public',
  'add_private_device',
  array['uuid','text','text','text','boolean','boolean','smallint','boolean','boolean'],
  'authenticated',
  array['EXECUTE'],
  'authenticated owner may call guarded inventory command'
);

select throws_ok(
  $$select public.add_private_device('00000000-0000-0000-0000-000000000000'::uuid)$$,
  '28000',
  'AUTH_REQUIRED',
  'command rejects calls without an authenticated owner'
);

select * from finish();
rollback;
