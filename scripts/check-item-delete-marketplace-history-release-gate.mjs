import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260911062000_lock_item_delete_after_marketplace_history.sql';
const parkedPath = `${migrationPath}.reviewed-by-item-delete-marketplace-history-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

for (const rpc of ['delete_private_device', 'delete_private_thing']) {
  assert.match(
    migration,
    new RegExp(`create or replace function public\\.${rpc}\\([\\s\\S]*security definer[\\s\\S]*set search_path to ''`, 'i'),
    `${rpc} must remain SECURITY DEFINER with an empty search_path`,
  );
}

assert.match(
  migration,
  /from public\.items[\s\S]*owner_id\s*=\s*v_owner(?:_id)?[\s\S]*for update/i,
  'Hard delete must lock the owned source item before checking Marketplace state',
);
assert.match(
  migration,
  /from private\.marketplace_listings[\s\S]*status\s*=\s*'PUBLISHED'[\s\S]*raise exception 'MARKETPLACE_LISTING_ACTIVE'/i,
  'Hard delete must reject currently published Marketplace listings',
);

const historyGuardMatches = migration.match(/from private\.marketplace_conversations[\s\S]*?raise exception 'MARKETPLACE_TRANSACTION_HISTORY_LOCKED'/gi) ?? [];
assert.equal(
  historyGuardMatches.length,
  2,
  'Both device and generic Thing hard-delete RPCs must preserve Marketplace conversation history',
);

assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Item-delete hardening must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);
assert.doesNotMatch(
  executable,
  /\b(?:serial_number|seller_email|exact_address|storage_path)\b/i,
  'Item-delete hardening must not introduce unrelated private seller fields',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-price-ceiling-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace item-delete history lock + established hardening release gate: OK');
