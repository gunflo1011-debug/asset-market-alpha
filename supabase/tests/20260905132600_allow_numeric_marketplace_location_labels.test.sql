begin;
select plan(4);

select ok(
  position('or v_public_location ~ ''[0-9]''' in pg_get_functiondef('public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text)'::regprocedure)) = 0,
  'Marketplace location no longer blanket-rejects digits'
);

select ok(
  position('char_length(v_public_location) > 80' in pg_get_functiondef('public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text)'::regprocedure)) > 0,
  'Marketplace location still enforces the 80 character coarse-label limit'
);

select ok(
  (select p.proconfig @> array['search_path=""']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text)'::regprocedure),
  'Marketplace listing command keeps an empty search_path'
);

select ok(
  has_function_privilege('authenticated', 'public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text)', 'EXECUTE'),
  'Marketplace listing command remains authenticated-only'
);

-- URL/email/newline and coordinate protections are asserted structurally by
-- scripts/check-marketplace-location-number-release-gate.mjs before pgTAP runs.
select * from finish();
rollback;
