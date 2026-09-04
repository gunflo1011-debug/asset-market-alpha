import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904051500_harden_inventory_value_rpc_search_paths.sql';
const parkedPath = `${migrationPath}.reviewed-by-inventory-value-rpc-hardening-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

assert.match(
  migration,
  /alter function public\.estimate_my_item_value_v1\(uuid,\s*bigint,\s*integer,\s*text\) set search_path = '';/i,
  'Item value estimate RPC must use an empty search_path',
);
assert.match(
  migration,
  /alter function public\.load_my_inventory_values\(\) set search_path = '';/i,
  'Inventory value loader RPC must use an empty search_path',
);
assert.doesNotMatch(
  migration,
  /\b(?:grant|revoke|create\s+(?:or\s+replace\s+)?function|drop\s+function|alter\s+policy|drop\s+policy|disable\s+row\s+level\s+security|insert|update|delete\s+from)\b/i,
  'Inventory value RPC hardening must only alter function configuration, never privileges, bodies, policies, or data',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-legacy-device-crud-hardening-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('inventory value RPC search-path hardening + established release gate: OK');
