begin;
select plan(8);

select has_function(
  'public', 'load_my_inventory_purchase_context', array[]::text[],
  'owner purchase-context projection exists'
);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.load_my_inventory_purchase_context()'::regprocedure),
  true,
  'purchase-context projection is SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.load_my_inventory_purchase_context()'::regprocedure),
  'purchase-context projection keeps an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.load_my_inventory_purchase_context()', 'EXECUTE'),
  'anon cannot read purchase context'
);

select ok(
  has_function_privilege('authenticated', 'public.load_my_inventory_purchase_context()', 'EXECUTE'),
  'authenticated users may read only their scoped purchase context'
);

select ok(
  position('a.buyer_id = auth.uid()' in pg_get_functiondef('public.load_my_inventory_purchase_context()'::regprocedure)) > 0,
  'projection scopes adoption rows to the authenticated buyer'
);

select ok(
  position('i.owner_id = auth.uid()' in pg_get_functiondef('public.load_my_inventory_purchase_context()'::regprocedure)) > 0,
  'projection also verifies ownership of the adopted Thing'
);

select ok(
  position('notes' in lower(pg_get_functiondef('public.load_my_inventory_purchase_context()'::regprocedure))) = 0
  and position('serial' in lower(pg_get_functiondef('public.load_my_inventory_purchase_context()'::regprocedure))) = 0
  and position('location' in lower(pg_get_functiondef('public.load_my_inventory_purchase_context()'::regprocedure))) = 0
  and position('image' in lower(pg_get_functiondef('public.load_my_inventory_purchase_context()'::regprocedure))) = 0,
  'projection does not reference seller-private notes, serials, exact location, or images'
);

select * from finish();
rollback;
