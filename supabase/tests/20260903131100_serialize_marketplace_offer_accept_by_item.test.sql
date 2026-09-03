begin;
select plan(5);

select is(
  (select prosecdef from pg_proc where oid = 'public.respond_to_my_marketplace_offer(uuid,text,bigint,text)'::regprocedure),
  true,
  'offer response RPC remains SECURITY DEFINER'
);

select is(
  (select proconfig[1] from pg_proc where oid = 'public.respond_to_my_marketplace_offer(uuid,text,bigint,text)'::regprocedure),
  'search_path=""',
  'offer response RPC keeps an empty search_path'
);

select unlike(
  pg_get_functiondef('public.respond_to_my_marketplace_offer(uuid,text,bigint,text)'::regprocedure),
  '%pg_advisory_lock(%',
  'RPC does not use session-scoped advisory locks'
);

select like(
  pg_get_functiondef('public.respond_to_my_marketplace_offer(uuid,text,bigint,text)'::regprocedure),
  '%pg_advisory_xact_lock%hashtextextended%v_item%',
  'offer responses serialize per Thing with a transaction-scoped advisory lock'
);

select ok(
  not has_function_privilege('anon', 'public.respond_to_my_marketplace_offer(uuid,text,bigint,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.respond_to_my_marketplace_offer(uuid,text,bigint,text)', 'EXECUTE'),
  'RPC remains authenticated-only'
);

select * from finish();
rollback;
