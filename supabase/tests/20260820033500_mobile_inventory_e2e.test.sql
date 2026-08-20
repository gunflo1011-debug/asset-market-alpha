begin;
select plan(7);

-- Exercise the same authenticated RPC used by the Expo client against the real local schema.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.add_private_device(
    '00000000-0000-0000-0000-000000000302'::uuid,
    'CI Blue',
    'INTACT',
    'LIGHT_WEAR',
    true,
    true,
    91,
    false,
    false
  )$$,
  'authenticated mobile inventory RPC completes end to end'
);

reset role;

select is(
  (select count(*)::integer from public.items where owner_id='00000000-0000-0000-0000-000000000101' and color='CI Blue'),
  1,
  'RPC creates exactly one owner-bound private item'
);

select is(
  (select count(*)::integer
   from public.condition_snapshots cs
   join public.items i on i.id=cs.item_id
   where i.owner_id='00000000-0000-0000-0000-000000000101'
     and i.color='CI Blue'
     and cs.purpose='PORTFOLIO'
     and cs.battery_health=91
     and cs.display_state='INTACT'
     and cs.housing_state='LIGHT_WEAR'),
  1,
  'RPC creates the initial condition snapshot consumed by the mobile inventory view'
);

select is(
  (select count(*)::integer
   from private.item_market_state ims
   join public.items i on i.id=ims.item_id
   where i.owner_id='00000000-0000-0000-0000-000000000101'
     and i.color='CI Blue'
     and ims.market_state='PRIVATE'
     and ims.possession_status='UNVERIFIED'),
  1,
  'new mobile inventory remains private and unverified'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select is(
  (select count(*)::integer from public.items where color='CI Blue'),
  0,
  'another authenticated user cannot discover the newly created private item through RLS'
);

select is(
  (select count(*)::integer
   from public.condition_snapshots cs
   join public.items i on i.id=cs.item_id
   where i.color='CI Blue'),
  0,
  'another authenticated user cannot discover its condition snapshot through RLS'
);

select is(
  (select count(*)::integer from public.product_variants where id='00000000-0000-0000-0000-000000000302'),
  1,
  'authenticated mobile client can still read the shared device catalog'
);

reset role;
select * from finish();
rollback;
