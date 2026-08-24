begin;
select plan(10);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'alpha_backend_info'
     and p.pronargs = 0),
  false,
  'backend compatibility handshake is SECURITY INVOKER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'alpha_backend_info'
     and p.pronargs = 0),
  'backend compatibility handshake has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.alpha_backend_info()', 'EXECUTE'),
  'anon cannot execute backend compatibility handshake'
);

select ok(
  has_function_privilege('authenticated', 'public.alpha_backend_info()', 'EXECUTE'),
  'authenticated may execute backend compatibility handshake'
);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.add_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)'::regprocedure),
  true,
  'inventory command remains intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.add_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)'::regprocedure),
  'inventory command has an empty search_path'
);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.track_alpha_event(text,uuid)'::regprocedure),
  true,
  'telemetry command remains intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.track_alpha_event(text,uuid)'::regprocedure),
  'telemetry command has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.add_private_device(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.track_alpha_event(text,uuid)', 'EXECUTE'),
  'anon cannot execute either privileged write command'
);

select ok(
  pg_catalog.to_regprocedure('public.add_private_thing(text,text)') is null
  or (
    select p.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.add_private_thing(text,text)')
  ),
  'generic Things command is hardened when present'
);

select * from finish();
rollback;
