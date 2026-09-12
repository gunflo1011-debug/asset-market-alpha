begin;
select plan(5);

select has_function(
  'public',
  'load_my_marketplace_messages_v2',
  array['uuid','integer'],
  'bounded marketplace message reader exists'
);

select ok(
  lower(pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure)) ~
    'auth\.uid\(\)[[:space:]]*(in[[:space:]]*\(c\.buyer_id,[[:space:]]*c\.seller_id\)|=[[:space:]]*any[[:space:]]*\(array\[c\.buyer_id,[[:space:]]*c\.seller_id\]\))',
  'message history remains limited to conversation participants'
);

select ok(
  position(
    'least(greatest(coalesce(p_limit, 100), 1), 200)'
    in lower(pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure))
  ) > 0,
  'requested message history is clamped to a safe 1..200 row window'
);

select ok(
  position(
    'order by m.created_at desc, m.id desc'
    in lower(pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure))
  ) > 0
  and lower(pg_get_functiondef('public.load_my_marketplace_messages_v2(uuid,integer)'::regprocedure)) ~
    'order by recent\.created_at([[:space:]]+asc)?,[[:space:]]*recent\.message_id([[:space:]]+asc)?',
  'reader selects the newest window efficiently and returns chronological UI order'
);

select ok(
  not has_function_privilege('anon','public.load_my_marketplace_messages_v2(uuid,integer)','EXECUTE')
  and has_function_privilege('authenticated','public.load_my_marketplace_messages_v2(uuid,integer)','EXECUTE'),
  'bounded message reader remains authenticated-only'
);

select * from finish();
rollback;
