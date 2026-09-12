begin;
select plan(4);

select has_function(
  'public',
  'load_my_marketplace_messages_v3',
  array['uuid','timestamp with time zone','uuid','integer'],
  'cursor-paged marketplace message reader exists'
);

select ok(
  (
    select p.prosecdef
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) setting
        where setting = 'search_path=""'
      )
    from pg_proc p
    where p.oid = 'public.load_my_marketplace_messages_v3(uuid,timestamptz,uuid,integer)'::regprocedure
  ),
  'cursor message reader remains SECURITY DEFINER with an empty search_path'
);

select ok(
  (
    select p.provolatile = 's'
    from pg_proc p
    where p.oid = 'public.load_my_marketplace_messages_v3(uuid,timestamptz,uuid,integer)'::regprocedure
  ),
  'cursor message reader remains STABLE'
);

select ok(
  not has_function_privilege('anon','public.load_my_marketplace_messages_v3(uuid,timestamptz,uuid,integer)','EXECUTE')
  and has_function_privilege('authenticated','public.load_my_marketplace_messages_v3(uuid,timestamptz,uuid,integer)','EXECUTE'),
  'cursor message reader remains authenticated-only'
);

select * from finish();
rollback;
