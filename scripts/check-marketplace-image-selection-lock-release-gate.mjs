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
assert.match(migration, /revoke all on function public\.set_my_item_image_marketplace_visibility\(uuid,uuid,boolean\) from public, anon;/i);
assert.match(migration, /grant execute on function public\.set_my_item_image_marketplace_visibility\(uuid,uuid,boolean\) to authenticated;/i);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\b(?:insert|delete|truncate)\b/i,
  'Image selection lock must not broaden policies/grants or mutate unrelated transaction data',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-legacy-marketplace-search-path-hardening-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace image selection transaction lock + established hardening release gate: OK');
