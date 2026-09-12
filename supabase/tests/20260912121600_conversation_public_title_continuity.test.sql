begin;
select plan(4);

select ok(
  position('l.public_title' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0,
  'conversation reader carries the frozen public listing title'
);

select ok(
  position('i.custom_name' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) = 0
  and position('location_label' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) = 0
  and position('notes' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) = 0,
  'conversation title continuity never reads seller-private Thing metadata'
);

select ok(
  position('auth.uid() in (c.buyer_id, c.seller_id)' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0,
  'conversation reader remains participant-scoped'
);

select ok(
  not has_function_privilege('anon','public.load_my_marketplace_conversations()','EXECUTE')
  and has_function_privilege('authenticated','public.load_my_marketplace_conversations()','EXECUTE'),
  'conversation reader remains authenticated-only'
);

select * from finish();
rollback;
