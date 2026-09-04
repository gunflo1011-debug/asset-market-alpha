begin;
select plan(8);

select is(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.estimate_my_item_value_v1(uuid,bigint,integer,text)'::regprocedure),
  true,
  'estimate RPC remains intentionally SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p where p.oid = 'public.estimate_my_item_value_v1(uuid,bigint,integer,text)'::regprocedure),
  'estimate RPC has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.estimate_my_item_value_v1(uuid,bigint,integer,text)', 'EXECUTE'),
  'anon cannot execute estimate RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.estimate_my_item_value_v1(uuid,bigint,integer,text)', 'EXECUTE'),
  'authenticated retains estimate RPC access'
);

select is(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.load_my_inventory_values()'::regprocedure),
  true,
  'inventory value loader remains intentionally SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p where p.oid = 'public.load_my_inventory_values()'::regprocedure),
  'inventory value loader has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.load_my_inventory_values()', 'EXECUTE'),
  'anon cannot execute inventory value loader'
);
select ok(
  has_function_privilege('authenticated', 'public.load_my_inventory_values()', 'EXECUTE'),
  'authenticated retains inventory value loader access'
);

select * from finish();
rollback;
