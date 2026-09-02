begin;
select plan(9);

select has_column(
  'private', 'marketplace_buyer_adoptions', 'purchase_price_cents',
  'buyer adoption preserves final purchase price privately'
);

select has_column(
  'private', 'marketplace_buyer_adoptions', 'source_gtin',
  'buyer adoption can retain source GTIN as private provenance'
);

select col_type_is(
  'private', 'marketplace_buyer_adoptions', 'purchase_price_cents', 'bigint',
  'adoption purchase price uses bigint cents'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'private.marketplace_buyer_adoptions'::regclass
      and c.conname = 'marketplace_buyer_adoptions_purchase_price_range'
  ),
  'adoption purchase price is positively bounded'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'private.marketplace_buyer_adoptions'::regclass
      and c.conname = 'marketplace_buyer_adoptions_source_gtin_format'
  ),
  'adoption source GTIN has a structural format constraint'
);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.adopt_my_sold_marketplace_thing(uuid)'::regprocedure),
  true,
  'buyer adoption remains SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.adopt_my_sold_marketplace_thing(uuid)'::regprocedure),
  'buyer adoption keeps an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.adopt_my_sold_marketplace_thing(uuid)', 'EXECUTE'),
  'anon cannot adopt Marketplace purchases'
);

select ok(
  has_function_privilege('authenticated', 'public.adopt_my_sold_marketplace_thing(uuid)', 'EXECUTE'),
  'authenticated users can call adoption subject to buyer/SOLD checks inside the RPC'
);

select * from finish();
rollback;
