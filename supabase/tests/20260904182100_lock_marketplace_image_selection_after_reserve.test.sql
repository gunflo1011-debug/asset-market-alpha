begin;
select plan(7);

insert into private.marketplace_listings(
  item_id, seller_id, asking_price_cents, status, published_at, updated_at, public_title, public_category
)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  65000, 'PUBLISHED', now(), now(), 'Locked image test Thing', 'Test'
)
on conflict (item_id) do update set
  seller_id=excluded.seller_id,
  asking_price_cents=excluded.asking_price_cents,
  sold_price_cents=null,
  status='PUBLISHED',
  published_at=now(),
  updated_at=now(),
  public_title=excluded.public_title,
  public_category=excluded.public_category;

insert into private.item_images(
  id, item_id, owner_id, storage_path, sort_order, is_primary, marketplace_visible
)
values (
  '00000000-0000-0000-0000-000000000b01'::uuid,
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000101/00000000-0000-0000-0000-000000000401/locked-test.jpg',
  0, true, false
)
on conflict (id) do update set marketplace_visible=false;

insert into private.marketplace_interests(item_id, buyer_id, seller_id, status, updated_at)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  'INTERESTED', now()
)
on conflict (item_id, buyer_id) do update set status='INTERESTED', updated_at=now();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(
  public.set_my_item_image_marketplace_visibility(
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000b01'::uuid,
    true
  ),
  true,
  'seller can change Marketplace image selection before reservation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.open_my_marketplace_conversation('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'buyer can open listing-bound conversation'
);
reset role;

select set_config(
  'test.locked_image_conversation_id',
  (select id::text from private.marketplace_conversations
   where item_id='00000000-0000-0000-0000-000000000401'::uuid
     and buyer_id='00000000-0000-0000-0000-000000000201'::uuid
   limit 1),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.locked_image_conversation_id')::uuid, 'RESERVED', null
  )$$,
  'seller can reserve intended buyer'
);
select throws_ok(
  $$select public.set_my_item_image_marketplace_visibility(
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000b01'::uuid,
    false
  )$$,
  'P0001',
  'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION',
  'seller cannot remove a selected image after reservation'
);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.locked_image_conversation_id')::uuid, 'SOLD', 61000
  )$$,
  'seller can complete sale'
);
select throws_ok(
  $$select public.set_my_item_image_marketplace_visibility(
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000b01'::uuid,
    false
  )$$,
  'P0001',
  'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION',
  'seller cannot change selected images after sale'
);
reset role;

select is(
  (select marketplace_visible from private.item_images where id='00000000-0000-0000-0000-000000000b01'::uuid),
  true,
  'reserved/sold transaction keeps the originally selected image frozen'
);

select * from finish();
rollback;
