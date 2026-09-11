import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260911101500_block_marketplace_republish_after_transaction.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-republish-lock-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function private\.guard_marketplace_listing_republish\(\)[\s\S]*set search_path to ''/i,
  'Marketplace republish guard must use a private function with an empty search_path',
);
assert.match(
  migration,
  /new\.status\s*=\s*'PUBLISHED'[\s\S]*marketplace_conversations[\s\S]*status\s+in\s*\(\s*'RESERVED'\s*,\s*'SOLD'\s*\)/i,
  'Republish guard must reject listings with RESERVED/SOLD transaction history',
);
assert.match(
  migration,
  /item_market_state[\s\S]*market_state\s+in\s*\(\s*'RESERVED'\s*,\s*'SOLD'\s*\)/i,
  'Republish guard must also fail closed on the item market-state source of truth',
);
assert.match(
  migration,
  /before insert or update of status on private\.marketplace_listings[\s\S]*execute function private\.guard_marketplace_listing_republish\(\)/i,
  'Marketplace listing table must enforce the invariant before publish writes',
);
assert.match(
  migration,
  /revoke all on function private\.guard_marketplace_listing_republish\(\) from public, anon, authenticated/i,
  'Guard helper must not become a client-callable RPC',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Republish hardening must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-adoption-public-snapshot-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace transaction republish lock + established hardening release gate: OK');
