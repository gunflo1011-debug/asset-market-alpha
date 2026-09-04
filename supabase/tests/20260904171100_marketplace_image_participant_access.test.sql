begin;
select plan(15);

-- Disposable seed identities:
-- seller/owner       ...0101
-- intended buyer     ...0201
-- unrelated account  ...0202
-- source Thing       ...0401
-- selected image     ...0a01
-- private image      ...0a02

insert into private.marketplace_listings(
  item_id,
  seller_id,
  asking_price_cents,
  status,
  published_at,
  updated_at,
  public_title,
  public_category
)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  65000,
  'PUBLISHED',
  now(),
  now(),
  'Image access test Thing',
  'Test'
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
    '00000000-0000-0000-0000-000000000a01'::uuid,
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000101/00000000-0000-0000-0000-000000000401/selected-test.jpg',
    0,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000a02'::uuid,
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000101/00000000-0000-0000-0000-000000000401/private-test.jpg',
    1,
    false,
    false
  )
on conflict (id) do update set
  item_id=excluded.item_id,
  owner_id=excluded.owner_id,
  storage_path=excluded.storage_path,
  sort_order=excluded.sort_order,
  is_primary=excluded.is_primary,
  marketplace_visible=excluded.marketplace_visible;

insert into private.marketplace_interests(item_id, buyer_id, seller_id, status, updated_at)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  'INTERESTED',
  now()
)
on conflict (item_id, buyer_id) do update set
  seller_id=excluded.seller_id,
  status='INTERESTED',
  updated_at=now();

-- While published, any authenticated Marketplace browser can see only explicitly
-- selected Marketplace copies; the unselected private image remains unavailable.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select ok(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000a01',
    false
  ),
  'authenticated Marketplace browser can read a selected image while listing is published'
);
select ok(
  exists(
    select 1 from public.load_marketplace_image_refs_v1() r
    where r.item_id='00000000-0000-0000-0000-000000000401'::uuid
      and r.image_id='00000000-0000-0000-0000-000000000a01'::uuid
  ),
  'published selected image is discoverable through opaque Marketplace refs'
);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000a02',
    false
  ),
  false,
  'unselected private image is not readable through Marketplace delivery'
);
reset role;

-- Intended buyer opens the listing-bound conversation before reservation.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.open_my_marketplace_conversation('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'intended buyer can open the Marketplace conversation'
);
reset role;

select set_config(
  'test.image_conversation_id',
  (select id::text
   from private.marketplace_conversations
   where item_id='00000000-0000-0000-0000-000000000401'::uuid
     and buyer_id='00000000-0000-0000-0000-000000000201'::uuid
   limit 1),
  true
);

-- Reservation withdraws public discovery. Only the actual sale participants retain
-- access to the already seller-selected Marketplace copies.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.image_conversation_id')::uuid,
    'RESERVED',
    null
  )$$,
  'seller can reserve the intended buyer conversation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select ok(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000a01',
    false
  ),
  'reserved buyer retains access to selected Marketplace image copy'
);
select ok(
  exists(
    select 1 from public.load_marketplace_image_refs_v1() r
    where r.item_id='00000000-0000-0000-0000-000000000401'::uuid
      and r.image_id='00000000-0000-0000-0000-000000000a01'::uuid
  ),
  'reserved buyer retains selected image ref after public listing withdrawal'
);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000a02',
    false
  ),
  false,
  'reserved buyer still cannot read unselected private image'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000a01',
    false
  ),
  false,
  'unrelated account loses selected image access once public discovery is withdrawn'
);
select is(
  (select count(*) from public.load_marketplace_image_refs_v1() r
   where r.item_id='00000000-0000-0000-0000-000000000401'::uuid),
  0::bigint,
  'unrelated account receives no image refs for a reserved listing'
);
reset role;

-- Sale completion preserves the selected Marketplace copy for the actual buyer,
-- while adoption still creates a private Thing without copying seller image metadata.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.image_conversation_id')::uuid,
    'SOLD',
    61000
  )$$,
  'seller can complete the sale with final price'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select ok(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000a01',
    false
  ),
  'sold buyer retains access to selected Marketplace image copy'
);
select ok(
  exists(
    select 1 from public.load_marketplace_image_refs_v1() r
    where r.item_id='00000000-0000-0000-0000-000000000401'::uuid
      and r.image_id='00000000-0000-0000-0000-000000000a01'::uuid
  ),
  'sold buyer retains selected image ref'
);
select set_config(
  'test.image_adopted_item_id',
  public.adopt_my_sold_marketplace_thing(current_setting('test.image_conversation_id')::uuid)::text,
  true
);
reset role;

select is(
  (select count(*) from private.item_images ii
   where ii.item_id=current_setting('test.image_adopted_item_id')::uuid),
  0::bigint,
  'buyer adoption does not copy seller image metadata into private buyer inventory'
);

select is(
  (select owner_id from public.items
   where id=current_setting('test.image_adopted_item_id')::uuid),
  '00000000-0000-0000-0000-000000000201'::uuid,
  'adopted Thing still belongs to intended buyer'
);

select * from finish();
rollback;
