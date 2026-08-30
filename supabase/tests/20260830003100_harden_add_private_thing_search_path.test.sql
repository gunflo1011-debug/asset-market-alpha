begin;
select plan(4);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.add_private_thing(text,text,text,text)'::regprocedure),
  true,
  'generic thing create remains intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.add_private_thing(text,text,text,text)'::regprocedure),
  'generic thing create has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.add_private_thing(text,text,text,text)', 'EXECUTE'),
  'anon cannot execute generic thing create'
);

select ok(
  has_function_privilege('authenticated', 'public.add_private_thing(text,text,text,text)', 'EXECUTE'),
  'authenticated retains generic thing create access'
);

select * from finish();
rollback;
