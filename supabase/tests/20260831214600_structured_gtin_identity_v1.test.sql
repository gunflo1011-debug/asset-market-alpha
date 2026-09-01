begin;
select plan(8);

select ok(
  exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'item_product_identifiers'
  ),
  'private structured product identifier table exists'
);

select ok(
  (select c.relrowsecurity
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relname = 'item_product_identifiers'),
  'structured product identifiers have RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'private.item_product_identifiers', 'SELECT'),
  'authenticated clients cannot directly read private structured product identifiers'
);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.set_my_item_gtin_v1(uuid,text,text)'::regprocedure),
  true,
  'GTIN write RPC is intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.set_my_item_gtin_v1(uuid,text,text)'::regprocedure),
  'GTIN write RPC has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.set_my_item_gtin_v1(uuid,text,text)', 'EXECUTE'),
  'anon cannot store structured GTIN identity'
);

select ok(
  has_function_privilege('authenticated', 'public.set_my_item_gtin_v1(uuid,text,text)', 'EXECUTE'),
  'authenticated users can call the owner-checked GTIN RPC'
);

select ok(
  not has_table_privilege('anon', 'private.item_product_identifiers', 'SELECT'),
  'anon cannot read private structured product identifiers'
);

select * from finish();
rollback;