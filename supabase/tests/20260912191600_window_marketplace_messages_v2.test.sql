begin;
select plan(5);

select has_function(
  'public',
  'load_my_marketplace_messages_v2',
  array['uuid','integer'],
  'bounded marketplace message reader exists'
);

select ok(
  position('auth.uid() in (c.buyer_id, c.seller_id)' in pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure)) > 0,
  'message history remains limited to conversation participants'
);

select ok(
  position('least(greatest(coalesce(p_limit, 100), 1), 200)' in pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure)) > 0,
  'requested message history is clamped to a safe 1..200 row window'
);

select ok(
  position('order by m.created_at desc, m.id desc' in pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure)) > 0
  and position('order by recent.created_at, recent.message_id' in pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure)) > 0,
  'reader selects the newest window efficiently and returns chronological UI order'
);

select ok(
  not has_function_privilege('anon','public.load_my_marketplace_messages_v2(uuid,integer)','EXECUTE')
  and has_function_privilege('authenticated','public.load_my_marketplace_messages_v2(uuid,integer)','EXECUTE'),
  'bounded message reader remains authenticated-only'
);

select * from finish();
rollback;
