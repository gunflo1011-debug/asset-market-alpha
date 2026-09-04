import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904072500_harden_legacy_marketplace_search_paths.sql';
const parkedPath = `${migrationPath}.reviewed-by-legacy-marketplace-search-path-hardening-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

for (const signature of [
  /alter function public\.load_interest_summary_for_my_listings\(\) set search_path = '';/i,
  /alter function public\.load_my_marketplace_interests\(\) set search_path = '';/i,
  /alter function public\.load_my_marketplace_listings\(\) set search_path = '';/i,
  /alter function public\.set_my_marketplace_interest\(uuid,\s*boolean\) set search_path = '';/i,
  /alter function public\.withdraw_my_marketplace_listing\(uuid\) set search_path = '';/i,
]) {
  assert.match(migration, signature, 'Each approved legacy Marketplace RPC must use an empty search_path');
}

assert.doesNotMatch(
  migration,
  /\b(?:grant|revoke|create\s+(?:or\s+replace\s+)?function|drop\s+function|alter\s+policy|drop\s+policy|disable\s+row\s+level\s+security|insert|update|delete\s+from)\b/i,
  'Legacy Marketplace search-path hardening must only alter function configuration, never privileges, bodies, policies, or data',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-inventory-value-rpc-hardening-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('legacy Marketplace RPC search-path hardening + established release gate: OK');
