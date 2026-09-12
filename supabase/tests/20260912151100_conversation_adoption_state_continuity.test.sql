begin;
select plan(5);

select ok(
  position('a.adopted_item_id' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0,
  'conversation reader exposes durable adoption state'
);

select ok(
  position('case when c.buyer_id = auth.uid() then a.adopted_item_id else null end' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0,
  'adopted item id is buyer-only and remains hidden from sellers'
);

select ok(
  position('a.buyer_id = auth.uid()' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0
  and position('auth.uid() in (c.buyer_id, c.seller_id)' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0,
  'adoption state is scoped to the current buyer inside a participant-only conversation reader'
);

select ok(
  position('l.public_title' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) > 0
  and position('i.custom_name' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) = 0
  and position('location_label' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) = 0
  and position('notes' in pg_get_functiondef('public.load_my_marketplace_conversations()'::regprocedure)) = 0,
  'durable adoption state does not weaken the frozen public-title privacy boundary'
);

select ok(
  not has_function_privilege('anon','public.load_my_marketplace_conversations()','EXECUTE')
  and has_function_privilege('authenticated','public.load_my_marketplace_conversations()','EXECUTE'),
  'conversation reader remains authenticated-only'
);

select * from finish();
rollback;
