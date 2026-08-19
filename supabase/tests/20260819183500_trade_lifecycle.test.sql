begin;
select plan(10);

select has_table('private','match_condition_evidence','match-bound condition evidence exists');
select has_table('private','liquidity_contracts','liquidity contracts exist');
select has_table('private','trade_receipts','trade receipts exist');

select col_is_pk('private','match_condition_evidence','match_id','one authoritative fresh condition per match');
select col_is_unique('private','match_condition_evidence','condition_snapshot_id','fresh condition snapshot cannot be reused across matches');
select col_is_unique('private','trade_receipts','match_id','one immutable receipt per match');

select function_privs_are(
  'private','confirm_handover',array['uuid','integer','uuid'],'anon',
  array[]::text[],'anon cannot confirm handover'
);

select function_privs_are(
  'private','confirm_handover',array['uuid','integer','uuid'],'authenticated',
  array['EXECUTE'],'authenticated may call guarded handover command'
);

select table_privs_are(
  'private','trade_receipts','authenticated',array[]::text[],
  'authenticated has no direct trade receipt access'
);

select table_privs_are(
  'private','liquidity_contracts','authenticated',array[]::text[],
  'authenticated has no direct contract access'
);

select * from finish();
rollback;
