begin;
select plan(6);

select has_function(
  'public',
  'add_private_thing',
  array['text','text','text','text'],
  'generic private Thing command exists'
);

select function_privs_are(
  'public',
  'add_private_thing',
  array['text','text','text','text'],
  'anon',
  array[]::text[],
  'anonymous users cannot create private Things'
);

select function_privs_are(
  'public',
  'add_private_thing',
  array['text','text','text','text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated owners may create private Things'
);

select throws_ok(
  $$select public.add_private_thing('Cordless drill')$$,
  '28000',
  'AUTH_REQUIRED',
  'generic Thing command rejects unauthenticated calls'
);

select col_is_null(
  'public',
  'items',
  'variant_id',
  'generic Things are allowed to exist without a catalog variant'
);

select has_check(
  'public',
  'items',
  'items_identity_check',
  'items require either a catalog variant or a custom name'
);

select * from finish();
rollback;
