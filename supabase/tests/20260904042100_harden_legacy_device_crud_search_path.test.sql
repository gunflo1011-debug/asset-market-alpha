begin;
select plan(8);

select is(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.update_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)'::regprocedure),
  true,
  'legacy device update remains intentionally SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p where p.oid = 'public.update_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)'::regprocedure),
  'legacy device update has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.update_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)', 'EXECUTE'),
  'anon cannot execute legacy device update'
);
select ok(
  has_function_privilege('authenticated', 'public.update_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)', 'EXECUTE'),
  'authenticated retains legacy device update access'
);

select is(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.delete_private_device(uuid)'::regprocedure),
  true,
  'legacy device delete remains intentionally SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p where p.oid = 'public.delete_private_device(uuid)'::regprocedure),
  'legacy device delete has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.delete_private_device(uuid)', 'EXECUTE'),
  'anon cannot execute legacy device delete'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_private_device(uuid)', 'EXECUTE'),
  'authenticated retains legacy device delete access'
);

select * from finish();
rollback;
