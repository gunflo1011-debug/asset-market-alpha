begin;
select plan(6);

insert into public.items(id, owner_id, variant_id, custom_name, category)
values (
  '00000000-0000-0000-0000-000000009901'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  null,
  'GTIN isolation test Thing',
  'Test'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.set_my_item_gtin_v1(
    '00000000-0000-0000-0000-000000009901'::uuid,
    '4006381333931'::text,
    'BARCODE_SCAN'::text
  )$$,
  'owner can store a confirmed GTIN for their own Thing'
);

select lives_ok(
  $$select * from public.load_my_market_value_v1(
    '00000000-0000-0000-0000-000000009901'::uuid
  )$$,
  'owner can request market value using their private confirmed GTIN'
);

reset role;

select is(
  (select count(*)::integer
   from private.item_product_identifiers
   where item_id = '00000000-0000-0000-0000-000000009901'::uuid
     and gtin = '4006381333931'
     and confirmed_by_user = true),
  1,
  'confirmed GTIN is stored once as private item identity'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select throws_ok(
  $$select public.set_my_item_gtin_v1(
    '00000000-0000-0000-0000-000000009901'::uuid,
    '5012345678900'::text,
    'BARCODE_SCAN'::text
  )$$,
  '42501',
  'ITEM_NOT_OWNED',
  'another authenticated account cannot overwrite the owner GTIN'
);

select throws_ok(
  $$select * from public.load_my_market_value_v1(
    '00000000-0000-0000-0000-000000009901'::uuid
  )$$,
  '42501',
  'ITEM_NOT_OWNED',
  'another authenticated account cannot use the owner Thing to probe market-value identity'
);

reset role;

select is(
  (select gtin
   from private.item_product_identifiers
   where item_id = '00000000-0000-0000-0000-000000009901'::uuid),
  '4006381333931',
  'cross-account attempts leave the owner GTIN unchanged'
);

select * from finish();
rollback;
