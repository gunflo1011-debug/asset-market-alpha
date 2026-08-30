begin;
select plan(4);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.update_private_thing(uuid,text,text,text,text)'::regprocedure),
  true,
  'generic thing update remains intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.update_private_thing(uuid,text,text,text,text)'::regprocedure),
  'generic thing update has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.update_private_thing(uuid,text,text,text,text)', 'EXECUTE'),
  'anon cannot execute generic thing update'
);

select ok(
  has_function_privilege('authenticated', 'public.update_private_thing(uuid,text,text,text,text)', 'EXECUTE'),
  'authenticated retains generic thing update access'
);

select * from finish();
rollback;
