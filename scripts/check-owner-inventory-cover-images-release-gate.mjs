import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260906091500_owner_inventory_cover_images_v1.sql';
const parkedPath = `${migrationPath}.reviewed-by-owner-inventory-cover-images-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.load_my_inventory_cover_image_refs_v1\(\)[\s\S]*returns table\(item_id uuid, storage_path text\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Owner Inventory cover loader must remain SECURITY DEFINER with an empty search_path and a minimal return contract',
);
assert.match(
  migration,
  /from private\.item_images ii[\s\S]*join public\.items i on i\.id = ii\.item_id[\s\S]*ii\.owner_id = auth\.uid\(\)[\s\S]*i\.owner_id = auth\.uid\(\)/i,
  'Owner Inventory cover loader must require authenticated ownership in both image and Thing records',
);
assert.match(
  migration,
  /row_number\(\) over \([\s\S]*partition by ii\.item_id[\s\S]*order by ii\.is_primary desc, ii\.sort_order, ii\.created_at[\s\S]*\) as rn/i,
  'Cover selection must stay deterministic and prefer the primary image',
);
assert.match(migration, /where ranked\.rn = 1/i, 'Cover loader must return at most one image reference per Thing');
assert.match(
  migration,
  /revoke all on function public\.load_my_inventory_cover_image_refs_v1\(\) from public, anon;/i,
  'Owner Inventory cover loader must deny public and anonymous execution',
);
assert.match(
  migration,
  /grant execute on function public\.load_my_inventory_cover_image_refs_v1\(\) to authenticated;/i,
  'Owner Inventory cover loader must be executable only by authenticated users',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Owner Inventory cover-image migration must not weaken RLS, expose private tables directly, or perform destructive operations',
);
assert.doesNotMatch(
  migration.match(/returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '',
  /\b(?:owner_id|seller_id|email|serial|location_label|notes|marketplace_visible)\b/i,
  'Cover-image return contract must not expose unrelated private metadata',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-location-number-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('owner Inventory cover images + established hardening release gate: OK');
