begin;
select plan(5);

select is(
  (select prosecdef from pg_proc where oid = 'public.load_my_marketplace_messages(uuid)'::regprocedure),
  true,
  'message loader remains SECURITY DEFINER'
);

select is(
  (select proconfig[1] from pg_proc where oid = 'public.load_my_marketplace_messages(uuid)'::regprocedure),
  'search_path=""',
  'message loader keeps an empty search_path'
);

select ok(
  strpos(
    regexp_replace(pg_get_functiondef('public.load_my_marketplace_messages(uuid)'::regprocedure), E'\\s+', ' ', 'g'),
    'order by m.created_at asc, m.id asc'
  ) > 0,
  'message loader uses message id as deterministic timestamp tie-breaker'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'marketplace_messages'
      and indexname = 'marketplace_messages_conversation_created_id_idx'
      and indexdef ilike '%(conversation_id, created_at, id)%'
  ),
  'chat read order has a matching conversation/timestamp/id index'
);

select ok(
  not has_function_privilege('anon', 'public.load_my_marketplace_messages(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.load_my_marketplace_messages(uuid)', 'EXECUTE'),
  'message loader remains authenticated-only'
);

select * from finish();
rollback;
