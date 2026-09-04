begin;
select plan(9);

-- Disposable seed identities:
-- seller/owner       ...0101
-- intended buyer     ...0201
-- unrelated account  ...0202
-- Give the source Thing seller-private fields that must never transfer.
update public.items
set custom_name='Seller iPhone',
    category='Phone',
    location_label='Exact seller shelf',
    notes='Private seller note'
where id='00000000-0000-0000-0000-000000000401'::uuid
  and owner_id='00000000-0000-0000-0000-000000000101'::uuid;

insert into private.marketplace_listings(item_id, seller_id, asking_price_cents, status, published_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  65000,
  'PUBLISHED',
  now(),
  now()
)
on conflict (item_id) do update set
  seller_id=excluded.seller_id,
  asking_price_cents=excluded.asking_price_cents,
  sold_price_cents=null,
  status='PUBLISHED',
  published_at=now(),
  updated_at=now();

insert into private.marketplace_interests(item_id, buyer_id, seller_id, status, updated_at)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  'INTERESTED',
  now()
)
on conflict (item_id, buyer_id) do update set
  status='INTERESTED', seller_id=excluded.seller_id, updated_at=now();

-- Intended buyer opens the listing-bound conversation.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.open_my_marketplace_conversation('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'intended buyer can open the Marketplace conversation'
);
reset role;

-- Capture the trusted fixture id before exercising participant-scoped RPCs.
select set_config(
  'test.adoption_conversation_id',
  (select id::text
   from private.marketplace_conversations
   where item_id='00000000-0000-0000-0000-000000000401'::uuid
     and buyer_id='00000000-0000-0000-0000-000000000201'::uuid
   limit 1),
  true
);

-- Seller completes the explicit RESERVED -> SOLD lifecycle with final price.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.adoption_conversation_id')::uuid,
    'RESERVED',
    null
  )$$,
  'seller can reserve the intended buyer conversation'
);
select lives_ok(
  $$select public.set_my_marketplace_conversation_status_v2(
    current_setting('test.adoption_conversation_id')::uuid,
    'SOLD',
    61000
  )$$,
  'seller can complete sale with explicit final price'
);
reset role;

-- A different authenticated account must not be able to adopt this purchase.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select throws_ok(
  $$select public.adopt_my_sold_marketplace_thing(
    current_setting('test.adoption_conversation_id')::uuid
  )$$,
  'P0001',
  'NOT_ALLOWED',
  'unrelated authenticated account cannot adopt another buyer purchase'
);
reset role;

-- The actual buyer can adopt, and repeat calls are idempotent.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select set_config(
  'test.adopted_item_id',
  public.adopt_my_sold_marketplace_thing(current_setting('test.adoption_conversation_id')::uuid)::text,
  true
);
select is(
  public.adopt_my_sold_marketplace_thing(current_setting('test.adoption_conversation_id')::uuid),
  current_setting('test.adopted_item_id')::uuid,
  'buyer adoption is idempotent and returns the same private Thing'
);
reset role;

select is(
  (select owner_id
   from public.items
   where id=current_setting('test.adopted_item_id')::uuid),
  '00000000-0000-0000-0000-000000000201'::uuid,
  'adopted Thing belongs to the intended buyer'
);

select is(
  (select market_state
   from private.item_market_state
   where item_id=current_setting('test.adopted_item_id')::uuid),
  'PRIVATE',
  'adopted Thing starts private and is not automatically listed'
);

select ok(
  (select location_label is null and notes is null
   from public.items
   where id=current_setting('test.adopted_item_id')::uuid),
  'seller-private location and notes are not copied to buyer inventory'
);

select is(
  (select purchase_price_cents
   from private.marketplace_buyer_adoptions
   where conversation_id=current_setting('test.adoption_conversation_id')::uuid
     and buyer_id='00000000-0000-0000-0000-000000000201'::uuid),
  61000::bigint,
  'buyer adoption preserves seller-confirmed final purchase price privately'
);

select * from finish();
rollback;
