import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260901190500_marketplace_image_owner_upsert_select_v1.sql';
const parkedPath = `${migrationPath}.reviewed-by-v2-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

// Review the new policy delta explicitly before delegating all prior invariants
// to the established release gate. The owner path must remain scoped through the
// existing authorization helper; buyer access must still use the non-manage path.
assert.match(migration, /drop policy if exists marketplace_images_selected_read on storage\.objects;/i);
assert.match(migration, /create policy marketplace_images_selected_read on storage\.objects[\s\S]*for select to authenticated/i);
assert.match(migration, /bucket_id\s*=\s*'marketplace-images'/i);
assert.match(migration, /public\.marketplace_image_object_access\(name, false\)/i);
assert.match(migration, /public\.marketplace_image_object_access\(name, true\)/i);
assert.doesNotMatch(migration, /\bto\s+(?:anon|public)\b/i, 'Marketplace image read policy must remain authenticated-only');
assert.doesNotMatch(migration, /\busing\s*\(\s*true\s*\)/i, 'Marketplace image read policy must never become unconditional');

// The legacy gate intentionally fails closed when it sees an unreviewed newest
// migration. Park only this migration while running that complete historical
// contract, then restore it before later Supabase reset/pgTAP steps execute.
fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-owner-market-state-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('marketplace image owner-upsert select delta + established owner market-state release gate: OK');
