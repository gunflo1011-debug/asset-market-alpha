begin;
select plan(11);

select has_table('public','items','items exists');
select has_table('private','matches','matches exists');
select has_index('private','matches','one_live_match_per_item','one live match per item');
select has_index('private','matches','one_live_match_per_intent','one live owner per buyer intent');

select policies_are('public','items',array['item_owner_insert','item_owner_select'],'items policy allowlist');
select policies_are('public','condition_snapshots',array['condition_owner_insert','condition_owner_select'],'condition policy allowlist');

select table_privs_are('public','items','authenticated',array['INSERT','SELECT'],'no generic item update/delete');
select table_privs_are('private','matches','authenticated',array[]::text[],'matches not directly client-readable');
select table_privs_are('private','match_events','authenticated',array[]::text[],'match events stay private');

select is((select count(*)::integer from private.buyer_intents where status='ACTIVE'),2,'two active buyer intents seeded');
select is((select count(*)::integer from private.matches),0,'fixture begins without match');

select * from finish();
rollback;
