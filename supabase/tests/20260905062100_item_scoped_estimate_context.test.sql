begin;
select plan(13);

select has_function('public', 'load_my_item_value', array['uuid']::text[], 'item-scoped value projection exists');
select has_function('public', 'load_my_item_purchase_context', array['uuid']::text[], 'item-scoped purchase projection exists');

select is(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid='public.load_my_item_value(uuid)'::regprocedure),
  true,
  'item value projection is SECURITY DEFINER'
);
select is(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid='public.load_my_item_purchase_context(uuid)'::regprocedure),
  true,
  'item purchase projection is SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p where p.oid='public.load_my_item_value(uuid)'::regprocedure),
  'item value projection keeps an empty search_path'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p where p.oid='public.load_my_item_purchase_context(uuid)'::regprocedure),
  'item purchase projection keeps an empty search_path'
);
select ok(not has_function_privilege('anon', 'public.load_my_item_value(uuid)', 'EXECUTE'), 'anon cannot read item value context');
select ok(not has_function_privilege('anon', 'public.load_my_item_purchase_context(uuid)', 'EXECUTE'), 'anon cannot read item purchase context');
select ok(has_function_privilege('authenticated', 'public.load_my_item_value(uuid)', 'EXECUTE'), 'authenticated may execute owner-scoped item value context');
select ok(has_function_privilege('authenticated', 'public.load_my_item_purchase_context(uuid)', 'EXECUTE'), 'authenticated may execute owner-scoped item purchase context');

insert into private.item_value_evidence(item_id, estimated_value_cents, currency, source_type, source_ref, observed_at)
values('00000000-0000-0000-0000-000000000401'::uuid, 54321, 'EUR', 'TEST_ITEM_SCOPE', 'item-scope-test', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(
  (select estimated_value_cents from public.load_my_item_value('00000000-0000-0000-0000-000000000401'::uuid)),
  54321::bigint,
  'owner receives only the requested Thing value'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  (select count(*) from public.load_my_item_value('00000000-0000-0000-0000-000000000401'::uuid)),
  0::bigint,
  'unrelated account receives no value row for another owner Thing'
);
reset role;

select ok(
  position('a.adopted_item_id = p_item_id' in pg_get_functiondef('public.load_my_item_purchase_context(uuid)'::regprocedure)) > 0
  and position('a.buyer_id = auth.uid()' in pg_get_functiondef('public.load_my_item_purchase_context(uuid)'::regprocedure)) > 0
  and position('i.owner_id = auth.uid()' in pg_get_functiondef('public.load_my_item_purchase_context(uuid)'::regprocedure)) > 0,
  'purchase context requires requested item, authenticated buyer, and current ownership'
);

select * from finish();
rollback;
