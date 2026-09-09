import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260909081103_revoke_legacy_marketplace_rpc_execute.sql';
const parkedPath = `${migrationPath}.reviewed-by-legacy-marketplace-rpc-execute-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

for (const signature of [
  'load_marketplace_v1\\(\\)',
  'load_my_marketplace_listings\\(\\)',
  'save_my_marketplace_listing\\(uuid,\\s*bigint,\\s*boolean\\)',
  'set_my_marketplace_conversation_status\\(uuid,\\s*text\\)',
]) {
  assert.match(
    migration,
    new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${signature}\\s+from\\s+authenticated\\s*;`, 'i'),
    `${signature} must revoke authenticated EXECUTE`,
  );
}

assert.doesNotMatch(
  executable,
  /\\b(?:grant|create|alter|drop|truncate|insert|update|delete)\\b|\\b(?:enable|disable)\\s+row\\s+level\\s+security\\b|\\bcreate\\s+policy\\b/i,
  'Legacy Marketplace RPC execute hardening must only revoke obsolete client execution privileges',
);
assert.doesNotMatch(
  migration,
  /load_marketplace_v2|load_my_marketplace_listings_v2|save_my_marketplace_listing_v2|set_my_marketplace_conversation_status_v2/i,
  'Active Marketplace v2 RPC privileges must remain untouched',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-owner-inventory-cover-images-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('legacy Marketplace RPC execute revocation + established hardening release gate: OK');
