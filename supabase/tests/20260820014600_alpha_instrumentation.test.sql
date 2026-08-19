begin;
select plan(7);

select has_table('private','alpha_events','closed-alpha event ledger exists');

select table_privs_are(
  'private','alpha_events','anon',array[]::text[],
  'anon has no direct telemetry access'
);

select table_privs_are(
  'private','alpha_events','authenticated',array[]::text[],
  'authenticated has no direct telemetry table access'
);

select function_privs_are(
  'public','track_alpha_event',array['text','uuid'],'anon',
  array[]::text[],'anon cannot emit telemetry'
);

select function_privs_are(
  'public','track_alpha_event',array['text','uuid'],'authenticated',
  array['EXECUTE'],'authenticated may call guarded telemetry command'
);

select col_not_null('private','alpha_events','user_id','telemetry is always account-bound');
select col_not_null('private','alpha_events','event_name','telemetry always has an allow-listed event name');

select * from finish();
rollback;
