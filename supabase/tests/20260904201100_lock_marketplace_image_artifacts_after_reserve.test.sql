begin;
select plan(8);

insert into private.marketplace_listings(
  item_id, seller_id, asking_price_cents, status, published_at, updated_at, public_title, public_category
)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  65000, 'PUBLISHED', now(), now(), 'Artifact lock test Thing', 'Test'
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
values
  (
    '00000000-0000-0000-0000-000000000b02'::uuid,
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000101/00000000-0000-0000-0000-000000000401/artifact-lock.jpg',
    0, true, true
  ),
  (
    '00000000-0000-0000-0000-000000000b03'::uuid,
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000101/00000000-0000-0000-0000-000000000401/pre-reserve-delete.jpg',
    1, false, false
  )
on conflict (id) do update set marketplace_visible=excluded.marketplace_visible;

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
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b02', true
  ),
  true,
  'seller can manage selected Marketplace projection before reservation'
);
select lives_ok(
  $$select public.delete_my_item_image(
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000b03'::uuid
  )$$,
  'seller can delete an image before reservation'
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
  'test.artifact_lock_conversation_id',
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
    current_setting('test.artifact_lock_conversation_id')::uuid, 'RESERVED', null
  )$$,
  'seller can reserve intended buyer'
);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b02', true
  ),
  false,
  'seller cannot manage Marketplace projection after reservation'
);
select throws_ok(
  $$select public.delete_my_item_image(
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000b02'::uuid
  )$$,
  'P0001',
  'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION',
  'seller cannot delete source image metadata after reservation'
);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b02', false
  ),
  true,
  'seller retains read access to frozen Marketplace image after reservation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b02', false
  ),
  true,
  'intended buyer retains read access to frozen Marketplace image after reservation'
);
reset role;

select * from finish();
rollback;
