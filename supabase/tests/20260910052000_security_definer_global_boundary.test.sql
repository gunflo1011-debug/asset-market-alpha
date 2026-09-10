begin;
select plan(2);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon cannot execute any public SECURITY DEFINER function'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""']::text[], false)
  ),
  0::bigint,
  'every public SECURITY DEFINER function has an empty search_path'
);

select * from finish();
rollback;
