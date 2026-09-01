begin;
select plan(7);

select has_column(
  'private', 'marketplace_listings', 'sold_price_cents',
  'Marketplace listings store final sale price separately from asking price'
);

select col_type_is(
  'private', 'marketplace_listings', 'sold_price_cents', 'bigint',
  'final sale price uses bigint cents'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'private.marketplace_listings'::regclass
      and c.conname = 'marketplace_listings_sold_price_range'
  ),
  'final sale price has an explicit positive bounded constraint'
);

select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   where p.oid = 'public.set_my_marketplace_conversation_status_v2(uuid,text,bigint)'::regprocedure),
  true,
  'seller lifecycle v2 is intentionally SECURITY DEFINER'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.set_my_marketplace_conversation_status_v2(uuid,text,bigint)'::regprocedure),
  'seller lifecycle v2 has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.set_my_marketplace_conversation_status_v2(uuid,text,bigint)', 'EXECUTE'),
  'anon cannot execute seller lifecycle v2'
);

select ok(
  has_function_privilege('authenticated', 'public.set_my_marketplace_conversation_status_v2(uuid,text,bigint)', 'EXECUTE'),
  'authenticated can execute lifecycle v2 subject to seller authorization inside the RPC'
);

select * from finish();
rollback;
