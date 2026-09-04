begin;
select plan(9);

-- Release entry-point acceptance for the exact RPC used by SellListingPanel.
-- seller/owner       ...0101
-- intended buyer     ...0201
-- unrelated account  ...0202

update public.items
set custom_name='Publish RPC acceptance Thing',
    category='Camera',
    location_label='Exact seller cupboard',
    notes='Seller-private note that must never enter Marketplace discovery'
where id='00000000-0000-0000-0000-000000000401'::uuid
  and owner_id='00000000-0000-0000-0000-000000000101'::uuid;

delete from private.marketplace_listings
where item_id='00000000-0000-0000-0000-000000000401'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(
  public.save_my_marketplace_listing_v2(
    '00000000-0000-0000-0000-000000000401'::uuid,
    65000,
    false,
    'Hambrücken'
  ),
  'DRAFT',
  'seller can save the same private listing draft used by mobile'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  (select count(*)::integer from public.load_marketplace_v2() where item_id='00000000-0000-0000-0000-000000000401'::uuid),
  0,
  'draft is not discoverable by unrelated Marketplace user'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(
  public.save_my_marketplace_listing_v2(
    '00000000-0000-0000-0000-000000000401'::uuid,
    65000,
    true,
    'Hambrücken'
  ),
  'PUBLISHED',
  'seller publishes through the exact mobile listing RPC'
);
reset role;

select is(
  (select public_title from private.marketplace_listings where item_id='00000000-0000-0000-0000-000000000401'::uuid),
  'Publish RPC acceptance Thing',
  'publish snapshots buyer-visible title from the private Thing'
);
select is(
  (select public_category from private.marketplace_listings where item_id='00000000-0000-0000-0000-000000000401'::uuid),
  'Camera',
  'publish snapshots buyer-visible category from the private Thing'
);
select is(
  (select public_location from private.marketplace_listings where item_id='00000000-0000-0000-0000-000000000401'::uuid),
  'Hambrücken',
  'publish stores only the explicit coarse Marketplace location'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  (select count(*)::integer from public.load_marketplace_v2()
   where item_id='00000000-0000-0000-0000-000000000401'::uuid
     and title='Publish RPC acceptance Thing'
     and category='Camera'
     and asking_price_cents=65000
     and public_location='Hambrücken'),
  1,
  'unrelated user discovers the published public snapshot with asking price and coarse location'
);
select ok(
  not exists(
    select 1
    from public.load_marketplace_v2() discovery_row
    where discovery_row.item_id='00000000-0000-0000-0000-000000000401'::uuid
      and (
        row_to_json(discovery_row)::text like '%Exact seller cupboard%'
        or row_to_json(discovery_row)::text like '%Seller-private note that must never enter Marketplace discovery%'
      )
  ),
  'Marketplace discovery row contains neither seller exact inventory location nor private notes in any returned field'
);
select throws_ok(
  $$select public.save_my_marketplace_listing_v2('00000000-0000-0000-0000-000000000401'::uuid, 66000, true, 'Bruchsal')$$,
  'P0001',
  'ITEM_NOT_OWNED',
  'non-owner cannot publish or mutate seller listing'
);
reset role;

select * from finish();
rollback;
