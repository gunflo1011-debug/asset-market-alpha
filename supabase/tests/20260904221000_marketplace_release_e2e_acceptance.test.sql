begin;
select plan(20);

-- Release acceptance identities from disposable seed data:
-- seller/owner       ...0101
-- intended buyer     ...0201
-- unrelated account  ...0202
-- This test intentionally composes the already-hardened Marketplace contracts
-- into one lifecycle so regressions between subsystems are caught together.

update public.items
set custom_name='Release acceptance Thing',
    category='Phone',
    location_label='Exact seller shelf',
    notes='Seller private note'
where id='00000000-0000-0000-0000-000000000401'::uuid
  and owner_id='00000000-0000-0000-0000-000000000101'::uuid;

insert into private.marketplace_listings(
  item_id, seller_id, asking_price_cents, sold_price_cents, status,
  published_at, updated_at, public_title, public_category
)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  65000, null, 'PUBLISHED', now(), now(), 'Release acceptance Thing', 'Phone'
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
  '00000000-0000-0000-0000-000000000b04'::uuid,
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000101/00000000-0000-0000-0000-000000000401/release-e2e.jpg',
  0, true, true
)
on conflict (id) do update set marketplace_visible=true;

insert into private.marketplace_interests(item_id, buyer_id, seller_id, status, updated_at)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  'INTERESTED', now()
)
on conflict (item_id, buyer_id) do update set
  seller_id=excluded.seller_id, status='INTERESTED', updated_at=now();

-- While published, authenticated Marketplace discovery may read only the
-- explicitly selected Marketplace projection.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b04', false
  ),
  true,
  'published selected Marketplace image is discoverable before reservation'
);
reset role;

-- Intended buyer opens the listing-bound transaction, chats, and makes an offer.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.open_my_marketplace_conversation('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'intended buyer opens listing-bound conversation'
);
select lives_ok(
  $$select public.send_my_marketplace_message(
    (select conversation_id from public.load_my_marketplace_conversations()
     where item_id='00000000-0000-0000-0000-000000000401'::uuid limit 1),
    'Release acceptance message'
  )$$,
  'buyer can send listing-bound chat message'
);
select lives_ok(
  $$select public.make_my_marketplace_offer(
    (select conversation_id from public.load_my_marketplace_conversations()
     where item_id='00000000-0000-0000-0000-000000000401'::uuid limit 1),
    62000,
    'Offer intentionally differs from final sale price.'
  )$$,
  'buyer can make an offer distinct from asking and final price'
);
reset role;

select set_config(
  'test.release_conversation_id',
  (select id::text from private.marketplace_conversations
   where item_id='00000000-0000-0000-0000-000000000401'::uuid
     and buyer_id='00000000-0000-0000-0000-000000000201'::uuid limit 1),
  true
);
select set_config(
  'test.release_offer_id',
  (select id::text from private.marketplace_offers
   where conversation_id=current_setting('test.release_conversation_id')::uuid
     and status='PENDING' order by created_at desc limit 1),
  true
);

-- Account C must not enter the private transaction once it exists.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  (select count(*)::integer from public.load_my_marketplace_messages(current_setting('test.release_conversation_id')::uuid)),
  0,
  'unrelated account cannot read participant chat'
);
select is(
  (select count(*)::integer from public.load_my_marketplace_offers(current_setting('test.release_conversation_id')::uuid)),
  0,
  'unrelated account cannot read participant offers'
);
select throws_ok(
  $$select public.send_my_marketplace_message(current_setting('test.release_conversation_id')::uuid, 'outsider')$$,
  'P0001', 'NOT_ALLOWED',
  'unrelated account cannot write participant chat'
);
reset role;

-- Seller accepts the buyer offer, then explicitly reserves this buyer.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.respond_to_my_marketplace_offer(
    current_setting('test.release_offer_id')::uuid, 'ACCEPT', null, null
  )$$,
  'seller can accept intended buyer offer'
);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.release_conversation_id')::uuid, 'RESERVED', null
  )$$,
  'seller can reserve intended buyer after offer acceptance'
);
select throws_ok(
  $$select public.delete_my_item_image(
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000b04'::uuid
  )$$,
  'P0001', 'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION',
  'seller cannot delete frozen transaction image after reservation'
);
reset role;

-- Reservation withdraws public discovery but keeps the frozen image for the
-- actual transaction participants only.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b04', false
  ),
  false,
  'unrelated account loses image access after reservation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select is(
  public.marketplace_image_object_access(
    '00000000-0000-0000-0000-000000000401/00000000-0000-0000-0000-000000000b04', false
  ),
  true,
  'intended buyer keeps frozen Marketplace image after reservation'
);
reset role;

-- Seller completes the sale with an explicit final price different from both
-- Asking Price (65000) and Accepted Offer (62000).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.release_conversation_id')::uuid, 'SOLD', 61000
  )$$,
  'seller completes sale with explicit final price'
);
reset role;

select is(
  (select status from private.marketplace_offers where id=current_setting('test.release_offer_id')::uuid),
  'ACCEPTED',
  'accepted offer remains recorded as offer history'
);
select is(
  (select sold_price_cents from private.marketplace_listings where item_id='00000000-0000-0000-0000-000000000401'::uuid),
  61000::bigint,
  'final sold price is stored independently from Asking Price and Accepted Offer'
);

-- Only the intended buyer may adopt the sold Thing.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select throws_ok(
  $$select public.adopt_my_sold_marketplace_thing(current_setting('test.release_conversation_id')::uuid)$$,
  'P0001', 'NOT_ALLOWED',
  'unrelated account cannot adopt the sold Thing'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select set_config(
  'test.release_adopted_item_id',
  public.adopt_my_sold_marketplace_thing(current_setting('test.release_conversation_id')::uuid)::text,
  true
);
select is(
  public.adopt_my_sold_marketplace_thing(current_setting('test.release_conversation_id')::uuid),
  current_setting('test.release_adopted_item_id')::uuid,
  'buyer adoption is idempotent'
);
reset role;

select is(
  (select owner_id from public.items where id=current_setting('test.release_adopted_item_id')::uuid),
  '00000000-0000-0000-0000-000000000201'::uuid,
  'adopted Thing belongs to intended buyer'
);
select is(
  (select market_state from private.item_market_state where item_id=current_setting('test.release_adopted_item_id')::uuid),
  'PRIVATE',
  'adopted Thing starts private'
);
select ok(
  (select location_label is null and notes is null
   from public.items where id=current_setting('test.release_adopted_item_id')::uuid),
  'seller private exact location and notes are not copied'
);
select is(
  (select count(*)::integer from private.item_images
   where item_id=current_setting('test.release_adopted_item_id')::uuid),
  0,
  'seller image metadata is not copied into buyer inventory'
);
select is(
  (select purchase_price_cents from private.marketplace_buyer_adoptions
   where conversation_id=current_setting('test.release_conversation_id')::uuid
     and buyer_id='00000000-0000-0000-0000-000000000201'::uuid),
  61000::bigint,
  'buyer private purchase context preserves confirmed final price'
);

select * from finish();
rollback;
