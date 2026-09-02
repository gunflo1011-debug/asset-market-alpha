import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260902042000_marketplace_offers_v1.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');

assert.match(migration, /create table if not exists private\.marketplace_offers/i);
assert.match(migration, /revoke all on table private\.marketplace_offers from public, anon, authenticated;/i);
assert.match(migration, /create unique index if not exists marketplace_offers_one_pending_per_conversation_idx[\s\S]*where status = 'PENDING'/i);

for (const fn of ['make_my_marketplace_offer', 'respond_to_my_marketplace_offer', 'load_my_marketplace_offers']) {
  assert.match(
    migration,
    new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, 'i'),
    `${fn} must remain SECURITY DEFINER with an empty search_path`,
  );
}

assert.match(migration, /v_user uuid := auth\.uid\(\)/i);
assert.match(migration, /if v_user <> v_buyer then raise exception 'BUYER_ONLY'/i);
assert.match(migration, /if v_status <> 'OPEN' then raise exception 'CONVERSATION_NOT_OPEN'/i);
assert.match(migration, /where o\.conversation_id = p_conversation_id and o\.status = 'PENDING'/i);

assert.match(migration, /v_user not in \(v_buyer, v_seller\)/i);
assert.match(migration, /if v_user = v_proposer then raise exception 'PROPOSER_CANNOT_RESPOND'/i);
assert.match(migration, /if v_offer_status <> 'PENDING' then raise exception 'OFFER_NOT_PENDING'/i);
assert.match(migration, /if p_action not in \('ACCEPT','DECLINE','COUNTER'\)/i);

assert.match(migration, /update private\.marketplace_offers set status='ACCEPTED'/i);
assert.match(migration, /update private\.marketplace_conversations[\s\S]*set status='RESERVED'[\s\S]*where id=v_conversation/i);
assert.match(migration, /set status='CLOSED'[\s\S]*where item_id=v_item and id<>v_conversation and status in \('OPEN','RESERVED'\)/i);
assert.match(migration, /update private\.marketplace_listings[\s\S]*set status='WITHDRAWN', published_at=null/i);
assert.match(migration, /insert into private\.item_market_state[\s\S]*values\(v_item,'RESERVED',now\(\)\)/i);

const loadReturn = migration.match(/create or replace function public\.load_my_marketplace_offers[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
assert.ok(loadReturn, 'Offer history return contract missing');
assert.doesNotMatch(loadReturn, /\b(?:proposer_id|buyer_id|seller_id|owner_id|email|address|latitude|longitude)\b/i, 'Offer read must not expose participant identity or precise/private location');
assert.match(migration, /where c\.id=p_conversation_id and auth\.uid\(\) in \(c\.buyer_id,c\.seller_id\)/i);

for (const signature of [
  'make_my_marketplace_offer\\(uuid,bigint,text\\)',
  'respond_to_my_marketplace_offer\\(uuid,text,bigint,text\\)',
  'load_my_marketplace_offers\\(uuid\\)',
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

console.log('marketplace offer lifecycle release gate: OK');
