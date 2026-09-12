begin;
select plan(4);

select has_function(
  'public',
  'load_my_marketplace_messages_v2',
  array['uuid','integer'],
  'bounded marketplace message reader exists'
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
    where p.oid = 'public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure
  ),
  'bounded message reader remains SECURITY DEFINER with an empty search_path'
);

select ok(
  (
    select p.provolatile = 's'
    from pg_proc p
    where p.oid = 'public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure
  ),
  'bounded message reader remains STABLE'
);

select ok(
  not has_function_privilege('anon','public.load_my_marketplace_messages_v2(uuid,integer)','EXECUTE')
  and has_function_privilege('authenticated','public.load_my_marketplace_messages_v2(uuid,integer)','EXECUTE'),
  'bounded message reader remains authenticated-only'
);

select * from finish();
rollback;
