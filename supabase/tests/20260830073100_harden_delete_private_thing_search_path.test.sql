begin;
select plan(4);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.delete_private_thing(uuid)'::regprocedure),
  true,
  'generic thing delete remains intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.delete_private_thing(uuid)'::regprocedure),
  'generic thing delete has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.delete_private_thing(uuid)', 'EXECUTE'),
  'anon cannot execute generic thing delete'
);

select ok(
  has_function_privilege('authenticated', 'public.delete_private_thing(uuid)', 'EXECUTE'),
  'authenticated retains generic thing delete access'
);

select * from finish();
rollback;
