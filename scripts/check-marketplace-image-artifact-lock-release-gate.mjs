import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904201000_lock_marketplace_image_artifacts_after_reserve.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-image-artifact-lock-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.marketplace_image_object_access\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Marketplace image access helper must remain SECURITY DEFINER with empty search_path',
);
assert.match(
  migration,
  /coalesce\(p_manage, false\)[\s\S]*not exists[\s\S]*private\.marketplace_conversations[\s\S]*c\.status in \('RESERVED','SOLD'\)/i,
  'Seller Marketplace object management must be denied once reserved/sold exists',
);
assert.match(
  migration,
  /create or replace function public\.delete_my_item_image\([\s\S]*pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_item_id::text, 0\)\)[\s\S]*MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION/i,
  'Source image deletion must share the per-Thing lock and reject reserved/sold transactions',
);

for (const signature of [
  'marketplace_image_object_access\\(text,boolean\\)',
  'delete_my_item_image\\(uuid,uuid\\)',
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.doesNotMatch(
  executable,
  /\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Artifact lock migration must not broaden private table grants or perform destructive schema/data operations',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b/i,
  'Artifact lock must reuse the established storage policies through the access helper instead of widening policy scope',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-image-selection-lock-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace image artifact immutability + selection/reservation lock + established hardening release gate: OK');
