import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904182000_lock_marketplace_image_selection_after_reserve.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-image-selection-lock-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.set_my_item_image_marketplace_visibility\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Marketplace image selection RPC must remain SECURITY DEFINER with empty search_path',
);
assert.match(
  migration,
  /private\.marketplace_conversations[\s\S]*c\.item_id = p_item_id[\s\S]*c\.seller_id = v_owner[\s\S]*c\.status in \('RESERVED', 'SOLD'\)[\s\S]*MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION/i,
  'Seller image selection must be frozen for reserved/sold transactions',
);

const itemLocks = [...migration.matchAll(/pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\([^\n]+::text, 0\)\)/gi)];
assert.ok(
  itemLocks.length >= 3,
  `image selection plus legacy/current lifecycle RPCs must share the per-Thing advisory lock (found ${itemLocks.length})`,
);
assert.match(
  migration,
  /create or replace function public\.set_my_marketplace_conversation_status\([\s\S]*pg_advisory_xact_lock[\s\S]*for update/i,
  'legacy reserve/sold RPC must acquire the shared item lock before authoritative row locking',
);
assert.match(
  migration,
  /create or replace function public\.set_my_marketplace_conversation_status_v2\([\s\S]*pg_advisory_xact_lock[\s\S]*for update/i,
  'current reserve/sold RPC must acquire the shared item lock before authoritative row locking',
);

for (const signature of [
  'set_my_item_image_marketplace_visibility\\(uuid,uuid,boolean\\)',
  'set_my_marketplace_conversation_status\\(uuid,text\\)',
  'set_my_marketplace_conversation_status_v2\\(uuid,text,bigint\\)',
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Transaction serialization must not broaden policies/table grants or perform destructive schema/data operations',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-legacy-marketplace-search-path-hardening-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace image selection + reserve/sold shared transaction lock + established hardening release gate: OK');
