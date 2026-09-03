import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260903091500_conversation_final_sale_price.sql';
const parkedPath = `${migrationPath}.reviewed-by-conversation-final-sale-price-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

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

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-owner-market-state-release-gate-v2.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('conversation final sale price + established owner market-state release gate: OK');
