import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904042000_harden_legacy_device_crud_search_path.sql';
const parkedPath = `${migrationPath}.reviewed-by-legacy-device-crud-hardening-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

assert.match(
  migration,
  /alter function public\.update_private_device\(uuid,text,text,text,boolean,boolean,smallint,boolean,boolean\) set search_path = '';/i,
  'Legacy device update must use an empty search_path',
);
assert.match(
  migration,
  /alter function public\.delete_private_device\(uuid\) set search_path = '';/i,
  'Legacy device delete must use an empty search_path',
);
assert.doesNotMatch(
  migration,
  /\b(?:grant|revoke|create\s+(?:or\s+replace\s+)?function|drop\s+function|alter\s+policy|drop\s+policy|disable\s+row\s+level\s+security|insert|update|delete\s+from)\b/i,
  'Legacy device CRUD hardening must only alter function configuration, never privileges, bodies, policies, or data',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-conversation-final-sale-price-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('legacy device CRUD search-path hardening + established release gate: OK');
