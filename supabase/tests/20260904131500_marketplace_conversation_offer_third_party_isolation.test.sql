begin;
select plan(8);

-- Reuse disposable seed identities:
-- seller/owner  ...0101
-- intended buyer ...0201
-- unrelated authenticated account ...0202
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
on conflict (item_id, buyer_id) do update set status='INTERESTED', seller_id=excluded.seller_id, updated_at=now();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select lives_ok(
  $$select public.open_my_marketplace_conversation('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'interested buyer can open the listing-bound conversation'
);

select lives_ok(
  $$select public.send_my_marketplace_message(
    (select conversation_id from public.load_my_marketplace_conversations() where item_id='00000000-0000-0000-0000-000000000401'::uuid limit 1),
    'Is this still available?'
  )$$,
  'buyer participant can send a message'
);

select lives_ok(
  $$select public.make_my_marketplace_offer(
    (select conversation_id from public.load_my_marketplace_conversations() where item_id='00000000-0000-0000-0000-000000000401'::uuid limit 1),
    61000,
    'I can pick it up this weekend.'
  )$$,
  'buyer participant can make an offer'
);

reset role;

-- Capture fixture ids in the trusted test setup context before switching to the
-- unrelated authenticated account. The outsider assertions below must exercise
-- only public RPCs; they must not depend on direct reads from private tables.
select set_config(
  'test.marketplace_conversation_id',
  (select id::text from private.marketplace_conversations where item_id='00000000-0000-0000-0000-000000000401'::uuid and buyer_id='00000000-0000-0000-0000-000000000201'::uuid limit 1),
  true
);
select set_config(
  'test.marketplace_offer_id',
  (select id::text from private.marketplace_offers where conversation_id=current_setting('test.marketplace_conversation_id')::uuid and status='PENDING' limit 1),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);

select is(
  (select count(*)::integer from public.load_my_marketplace_messages(current_setting('test.marketplace_conversation_id')::uuid)),
  0,
  'unrelated authenticated account cannot read conversation messages'
);

select is(
  (select count(*)::integer from public.load_my_marketplace_offers(current_setting('test.marketplace_conversation_id')::uuid)),
  0,
  'unrelated authenticated account cannot read offers'
);

select throws_ok(
  $$select public.send_my_marketplace_message(
    current_setting('test.marketplace_conversation_id')::uuid,
    'outsider message'
  )$$,
  'P0001',
  'NOT_ALLOWED',
  'unrelated authenticated account cannot send into the conversation'
);

select throws_ok(
  $$select public.make_my_marketplace_offer(
    current_setting('test.marketplace_conversation_id')::uuid,
    62000,
    'outsider offer'
  )$$,
  'P0001',
  'BUYER_ONLY',
  'unrelated authenticated account cannot make an offer in another buyer conversation'
);

select throws_ok(
  $$select public.respond_to_my_marketplace_offer(
    current_setting('test.marketplace_offer_id')::uuid,
    'ACCEPT',
    null,
    null
  )$$,
  'P0001',
  'NOT_ALLOWED',
  'unrelated authenticated account cannot accept or mutate another conversation offer'
);

select * from finish();
rollback;
