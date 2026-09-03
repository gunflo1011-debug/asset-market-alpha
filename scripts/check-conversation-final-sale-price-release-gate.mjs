import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260903091500_conversation_final_sale_price.sql';
const parkedPath = `${migrationPath}.reviewed-by-conversation-final-sale-price-gate`;
const itemOfferLockMigrationPath = 'supabase/migrations/20260903131000_serialize_marketplace_offer_accept_by_item.sql';
const itemOfferLockParkedPath = `${itemOfferLockMigrationPath}.reviewed-by-item-offer-lock-gate`;
const deterministicChatMigrationPath = 'supabase/migrations/20260903211500_deterministic_marketplace_message_order.sql';
const deterministicChatParkedPath = `${deterministicChatMigrationPath}.reviewed-by-deterministic-chat-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const itemOfferLockMigration = fs.readFileSync(itemOfferLockMigrationPath, 'utf8');
const deterministicChatMigration = fs.readFileSync(deterministicChatMigrationPath, 'utf8');

assert.match(migration, /drop function if exists public\.load_my_marketplace_conversations\(\)/i);
assert.match(migration, /create function public\.load_my_marketplace_conversations\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Conversation read must remain SECURITY DEFINER with empty search_path');
assert.match(migration, /case when c\.status = 'SOLD' then l\.sold_price_cents else null end/i,
  'Final sale price must only be exposed after SOLD');
assert.match(migration, /where auth\.uid\(\) in \(c\.buyer_id, c\.seller_id\)/i,
  'Conversation read must remain participant-scoped');
assert.match(migration, /revoke all on function public\.load_my_marketplace_conversations\(\) from public;/i);
assert.match(migration, /revoke all on function public\.load_my_marketplace_conversations\(\) from anon;/i);
assert.match(migration, /grant execute on function public\.load_my_marketplace_conversations\(\) to authenticated;/i);
assert.doesNotMatch(migration, /\b(?:email|location_label|notes|serial|storage_path)\b/i,
  'Conversation final-sale-price contract must not expose seller-private metadata');

assert.match(itemOfferLockMigration,
  /create or replace function public\.respond_to_my_marketplace_offer\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Offer response RPC must remain SECURITY DEFINER with empty search_path');
assert.match(itemOfferLockMigration,
  /select c\.item_id[\s\S]*where o\.id = p_offer_id[\s\S]*pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(v_item::text, 0\)\)/i,
  'Offer response must resolve the Thing and take a transaction-scoped per-Thing lock before authoritative row locking');
assert.match(itemOfferLockMigration,
  /pg_advisory_xact_lock[\s\S]*select o\.conversation_id, o\.proposer_id, o\.status,[\s\S]*for update of o, c;/i,
  'Offer/conversation state must be re-read under row locks after per-Thing serialization');
assert.doesNotMatch(itemOfferLockMigration, /pg_advisory_lock\s*\(/i,
  'Offer response must never use a session-scoped advisory lock');
assert.match(itemOfferLockMigration, /v_user not in \(v_buyer, v_seller\)[\s\S]*raise exception 'NOT_ALLOWED'/i,
  'Offer response must remain participant-scoped');
assert.match(itemOfferLockMigration, /v_user = v_proposer[\s\S]*raise exception 'PROPOSER_CANNOT_RESPOND'/i);
assert.match(itemOfferLockMigration, /v_offer_status <> 'PENDING'[\s\S]*raise exception 'OFFER_NOT_PENDING'/i);
assert.match(itemOfferLockMigration, /v_conversation_status <> 'OPEN'[\s\S]*raise exception 'CONVERSATION_NOT_OPEN'/i);
assert.match(itemOfferLockMigration,
  /set status='CLOSED'[\s\S]*where item_id=v_item and id<>v_conversation and status in \('OPEN','RESERVED'\)/i,
  'Accept must close competing conversations for the same Thing');
assert.match(itemOfferLockMigration,
  /insert into private\.item_market_state\(item_id, market_state, updated_at\)[\s\S]*values\(v_item,'RESERVED',now\(\)\)/i,
  'Accept must keep the Thing market state RESERVED, not SOLD');
assert.match(itemOfferLockMigration,
  /revoke all on function public\.respond_to_my_marketplace_offer\(uuid,text,bigint,text\) from public, anon;/i);
assert.match(itemOfferLockMigration,
  /grant execute on function public\.respond_to_my_marketplace_offer\(uuid,text,bigint,text\) to authenticated;/i);
assert.doesNotMatch(itemOfferLockMigration,
  /grant\s+(?:select|insert|update|delete|all).*private\.(?:marketplace_offers|marketplace_conversations|marketplace_listings|item_market_state).*authenticated/i,
  'Concurrency hardening must not expose private marketplace tables');

assert.match(deterministicChatMigration,
  /create index if not exists marketplace_messages_conversation_created_id_idx[\s\S]*on private\.marketplace_messages\(conversation_id, created_at asc, id asc\)/i,
  'Marketplace chat must have an index matching its deterministic read order');
assert.match(deterministicChatMigration,
  /create or replace function public\.load_my_marketplace_messages\(p_conversation_id uuid\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Message loader must remain SECURITY DEFINER with empty search_path');
assert.match(deterministicChatMigration,
  /where c\.id=p_conversation_id and auth\.uid\(\) in \(c\.buyer_id,c\.seller_id\)[\s\S]*order by m\.created_at asc, m\.id asc/i,
  'Message loader must remain participant-scoped and use an immutable tie-breaker');
assert.match(deterministicChatMigration,
  /revoke all on function public\.load_my_marketplace_messages\(uuid\) from public, anon;/i);
assert.match(deterministicChatMigration,
  /grant execute on function public\.load_my_marketplace_messages\(uuid\) to authenticated;/i);
assert.doesNotMatch(deterministicChatMigration,
  /grant\s+(?:select|insert|update|delete|all).*private\.marketplace_messages.*authenticated/i,
  'Deterministic chat ordering must not expose the private messages table');

for (const [source, destination] of [
  [migrationPath, parkedPath],
  [itemOfferLockMigrationPath, itemOfferLockParkedPath],
  [deterministicChatMigrationPath, deterministicChatParkedPath],
]) fs.renameSync(source, destination);
try {
  await import('./check-owner-market-state-release-gate-v2.mjs');
} finally {
  for (const [source, destination] of [
    [migrationPath, parkedPath],
    [itemOfferLockMigrationPath, itemOfferLockParkedPath],
    [deterministicChatMigrationPath, deterministicChatParkedPath],
  ].reverse()) fs.renameSync(destination, source);
}

console.log('conversation final sale price + per-Thing offer serialization + deterministic marketplace chat order + established owner market-state release gate: OK');
