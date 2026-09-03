begin;
select plan(15);

select has_column('private','marketplace_listings','public_title','listing stores public title snapshot');
select has_column('private','marketplace_listings','public_category','listing stores public category snapshot');
select has_column('private','marketplace_listings','public_estimated_value_cents','listing stores public estimate snapshot');
select has_column('private','marketplace_listings','public_condition_label','listing stores public condition snapshot');
select has_column('private','marketplace_listings','source_variant_id','listing stores source catalog variant snapshot');
select has_column('private','marketplace_listings','source_gtin','listing stores source GTIN provenance snapshot');

select ok(
  position('l.public_title' in pg_get_functiondef('public.load_marketplace_v2()'::regprocedure)) > 0
  and position('i.custom_name' in pg_get_functiondef('public.load_marketplace_v2()'::regprocedure)) = 0,
  'buyer v2 Marketplace reads frozen public title instead of live private Thing title'
);

select ok(
  position('l.public_estimated_value_cents' in pg_get_functiondef('public.load_marketplace_v2()'::regprocedure)) > 0
  and position('item_value_evidence' in pg_get_functiondef('public.load_marketplace_v2()'::regprocedure)) = 0,
  'buyer v2 Marketplace reads frozen estimate instead of live evidence'
);

select ok(
  position('l.public_condition_label' in pg_get_functiondef('public.load_marketplace_v2()'::regprocedure)) > 0
  and position('condition_snapshots' in pg_get_functiondef('public.load_marketplace_v2()'::regprocedure)) = 0,
  'buyer v2 Marketplace reads frozen condition instead of live snapshots'
);

select ok(
  position('public_title = case when p_publish then v_title' in pg_get_functiondef('public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text)'::regprocedure)) > 0,
  'v2 publish/update explicitly refreshes the public snapshot'
);

select ok(
  position('public_title = case when p_publish then v_title' in pg_get_functiondef('public.save_my_marketplace_listing(uuid,bigint,boolean)'::regprocedure)) > 0,
  'legacy v1 publish/update also refreshes the public snapshot'
);

select ok(
  position('l.public_title' in pg_get_functiondef('public.adopt_my_sold_marketplace_thing(uuid)'::regprocedure)) > 0
  and position('i.custom_name' in pg_get_functiondef('public.adopt_my_sold_marketplace_thing(uuid)'::regprocedure)) = 0,
  'buyer adoption uses frozen listing title rather than seller live private title'
);

select ok(
  position('l.source_gtin' in pg_get_functiondef('public.adopt_my_sold_marketplace_thing(uuid)'::regprocedure)) > 0
  and position('item_product_identifiers' in pg_get_functiondef('public.adopt_my_sold_marketplace_thing(uuid)'::regprocedure)) = 0,
  'buyer adoption uses frozen product provenance rather than seller live identifiers'
);

select ok(
  not has_function_privilege('anon','public.load_marketplace_v2()','EXECUTE')
  and has_function_privilege('authenticated','public.load_marketplace_v2()','EXECUTE'),
  'Marketplace snapshot reader remains authenticated-only'
);

select ok(
  not has_function_privilege('anon','public.adopt_my_sold_marketplace_thing(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.adopt_my_sold_marketplace_thing(uuid)','EXECUTE'),
  'snapshot-based buyer adoption remains authenticated-only'
);

select * from finish();
rollback;
