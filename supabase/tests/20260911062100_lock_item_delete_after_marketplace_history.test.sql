begin;
select plan(7);

insert into private.marketplace_listings(
  item_id, seller_id, asking_price_cents, status, published_at, updated_at,
  public_title, public_category
)
values (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  65000, 'PUBLISHED', now(), now(), 'Delete guard device', 'Device'
)
on conflict (item_id) do update set
  seller_id=excluded.seller_id,
  asking_price_cents=excluded.asking_price_cents,
  status='PUBLISHED',
  published_at=now(),
  updated_at=now(),
  public_title=excluded.public_title,
  public_category=excluded.public_category;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.delete_private_device('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'P0001',
  'MARKETPLACE_LISTING_ACTIVE',
  'owner cannot hard-delete a currently published Marketplace device'
);
reset role;

update private.marketplace_listings
set status='WITHDRAWN', published_at=null, updated_at=now()
where item_id='00000000-0000-0000-0000-000000000401'::uuid;

insert into private.marketplace_conversations(
  id, item_id, buyer_id, seller_id, status, updated_at
)
values (
  '00000000-0000-0000-0000-000000000c11'::uuid,
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  'OPEN', now()
)
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.delete_private_device('00000000-0000-0000-0000-000000000401'::uuid)$$,
  'P0001',
  'MARKETPLACE_TRANSACTION_HISTORY_LOCKED',
  'owner cannot erase a device once Marketplace conversation history exists'
);
reset role;

select ok(
  exists(select 1 from public.items where id='00000000-0000-0000-0000-000000000401'::uuid),
  'source device remains after blocked hard delete'
);
select ok(
  exists(select 1 from private.marketplace_conversations where id='00000000-0000-0000-0000-000000000c11'::uuid),
  'conversation history remains after blocked hard delete'
);

insert into public.items(id, owner_id, variant_id, custom_name, category)
values(
  '00000000-0000-0000-0000-000000000491'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  null,
  'Generic marketplace thing',
  'Other'
);
insert into private.marketplace_conversations(
  id, item_id, buyer_id, seller_id, status, updated_at
)
values (
  '00000000-0000-0000-0000-000000000c12'::uuid,
  '00000000-0000-0000-0000-000000000491'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  'CLOSED', now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.delete_private_thing('00000000-0000-0000-0000-000000000491'::uuid)$$,
  'P0001',
  'MARKETPLACE_TRANSACTION_HISTORY_LOCKED',
  'owner cannot erase generic Thing after Marketplace history exists'
);
reset role;

select ok(
  exists(select 1 from public.items where id='00000000-0000-0000-0000-000000000491'::uuid),
  'generic source Thing remains after blocked hard delete'
);

insert into public.items(id, owner_id, variant_id, custom_name, category)
values(
  '00000000-0000-0000-0000-000000000492'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  null,
  'Clean private thing',
  'Other'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.delete_private_thing('00000000-0000-0000-0000-000000000492'::uuid)$$,
  'owner can still delete a purely private Thing with no Marketplace history'
);
reset role;

select * from finish();
rollback;
