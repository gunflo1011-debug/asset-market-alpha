begin;
select plan(22);

-- Logic-level unauthenticated denial. The postgres test role can invoke the
-- functions, while an empty JWT subject exercises each explicit AUTH_REQUIRED gate.
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.add_private_device(
    '00000000-0000-0000-0000-000000000302'::uuid
  )$$,
  '28000',
  'AUTH_REQUIRED',
  'add_private_device rejects an unauthenticated caller'
);

select throws_ok(
  $$select public.add_private_thing('CI Bicycle', 'sports.bicycle')$$,
  '28000',
  'AUTH_REQUIRED',
  'add_private_thing rejects an unauthenticated caller'
);

select throws_ok(
  $$select public.track_alpha_event('INVENTORY_VIEWED', null)$$,
  '28000',
  'AUTH_REQUIRED',
  'track_alpha_event rejects an unauthenticated caller'
);

-- Owner success and exact post-state for the device command.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.add_private_device(
    '00000000-0000-0000-0000-000000000302'::uuid,
    'Behavior Blue',
    'INTACT',
    'LIGHT_WEAR',
    true,
    true,
    91::smallint,
    false,
    false
  )$$,
  'owner can create one private device'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.items
    where owner_id = '00000000-0000-0000-0000-000000000101'
      and color = 'Behavior Blue'
  ),
  1,
  'device command creates exactly one owner-bound item'
);

select is(
  (
    select count(*)::integer
    from private.item_market_state s
    join public.items i on i.id = s.item_id
    where i.owner_id = '00000000-0000-0000-0000-000000000101'
      and i.color = 'Behavior Blue'
      and s.market_state = 'PRIVATE'
      and s.possession_status = 'UNVERIFIED'
  ),
  1,
  'device command leaves the item PRIVATE and UNVERIFIED'
);

-- Owner success and exact post-state for the generic Thing command.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.add_private_thing('Behavior Bicycle', 'sports.bicycle')$$,
  'owner can create one generic private Thing'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.items i
    join public.thing_categories c on c.id = i.category_id
    where i.owner_id = '00000000-0000-0000-0000-000000000101'
      and i.display_name = 'Behavior Bicycle'
      and c.key = 'sports.bicycle'
      and i.variant_id is null
  ),
  1,
  'generic command creates exactly one categorized owner-bound item'
);

select is(
  (
    select count(*)::integer
    from private.item_market_state s
    join public.items i on i.id = s.item_id
    where i.owner_id = '00000000-0000-0000-0000-000000000101'
      and i.display_name = 'Behavior Bicycle'
      and s.market_state = 'PRIVATE'
      and s.possession_status = 'UNVERIFIED'
  ),
  1,
  'generic command leaves the item PRIVATE and UNVERIFIED'
);

-- Owner success for telemetry, bound to the seeded owner item.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.track_alpha_event(
    'INVENTORY_VIEWED',
    '00000000-0000-0000-0000-000000000401'::uuid
  )$$,
  'owner can emit an allow-listed event for their own item'
);

reset role;

select is(
  (
    select count(*)::integer
    from private.alpha_events
    where user_id = '00000000-0000-0000-0000-000000000101'
      and event_name = 'INVENTORY_VIEWED'
      and item_id = '00000000-0000-0000-0000-000000000401'
  ),
  1,
  'telemetry command appends exactly one owner-bound event'
);

-- Invalid inputs fail before any state mutation.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select throws_ok(
  $$select public.add_private_device(
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
  )$$,
  '23503',
  'UNKNOWN_VARIANT',
  'device command rejects an unknown catalog variant'
);

select throws_ok(
  $$select public.add_private_thing('   ', 'sports.bicycle')$$,
  '22023',
  'INVALID_DISPLAY_NAME',
  'generic command rejects a blank display name'
);

select throws_ok(
  $$select public.track_alpha_event('NOT_ALLOW_LISTED', null)$$,
  '22023',
  'UNKNOWN_ALPHA_EVENT',
  'telemetry command rejects a non-allow-listed event'
);

-- Cross-owner isolation: public rows are hidden by RLS and the privileged
-- telemetry command performs its own owner check before writing.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select is(
  (
    select count(*)::integer
    from public.items
    where color = 'Behavior Blue'
       or display_name = 'Behavior Bicycle'
  ),
  0,
  'another authenticated user cannot discover either new owner item'
);

select throws_ok(
  $$select public.track_alpha_event(
    'INVENTORY_VIEWED',
    '00000000-0000-0000-0000-000000000401'::uuid
  )$$,
  '42501',
  'ITEM_NOT_OWNED',
  'another authenticated user cannot emit telemetry for the owner item'
);

-- These inventory and event commands are intentionally append-only rather than
-- idempotent: each successful invocation creates one fresh, correctly isolated row.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.add_private_device(
    '00000000-0000-0000-0000-000000000302'::uuid,
    'Behavior Blue',
    'INTACT',
    'LIGHT_WEAR',
    true,
    true,
    91::smallint,
    false,
    false
  )$$,
  'repeating the device command succeeds with append-only semantics'
);

reset role;

select is(
  (
    select count(*)::integer
    from private.item_market_state s
    join public.items i on i.id = s.item_id
    where i.owner_id = '00000000-0000-0000-0000-000000000101'
      and i.color = 'Behavior Blue'
      and s.market_state = 'PRIVATE'
      and s.possession_status = 'UNVERIFIED'
  ),
  2,
  'two device invocations produce two fresh private states'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.add_private_thing('Behavior Bicycle', 'sports.bicycle')$$,
  'repeating the generic Thing command succeeds with append-only semantics'
);

reset role;

select is(
  (
    select count(*)::integer
    from private.item_market_state s
    join public.items i on i.id = s.item_id
    where i.owner_id = '00000000-0000-0000-0000-000000000101'
      and i.display_name = 'Behavior Bicycle'
      and s.market_state = 'PRIVATE'
      and s.possession_status = 'UNVERIFIED'
  ),
  2,
  'two generic Thing invocations produce two fresh private states'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.track_alpha_event(
    'INVENTORY_VIEWED',
    '00000000-0000-0000-0000-000000000401'::uuid
  )$$,
  'repeating the telemetry command succeeds with append-only semantics'
);

reset role;

select is(
  (
    select count(*)::integer
    from private.alpha_events
    where user_id = '00000000-0000-0000-0000-000000000101'
      and event_name = 'INVENTORY_VIEWED'
      and item_id = '00000000-0000-0000-0000-000000000401'
  ),
  2,
  'two telemetry invocations append exactly two owner-bound events'
);

select * from finish();
rollback;
