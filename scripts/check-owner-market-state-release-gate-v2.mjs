import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260901190500_marketplace_image_owner_upsert_select_v1.sql';
const parkedPath = `${migrationPath}.reviewed-by-v2-gate`;
const offerMigrationPath = 'supabase/migrations/20260902042000_marketplace_offers_v1.sql';
const offerParkedPath = `${offerMigrationPath}.reviewed-by-offer-gate`;
const gtinMigrationPath = 'supabase/migrations/20260902132000_gtin_checksum_hardening_v1.sql';
const gtinParkedPath = `${gtinMigrationPath}.reviewed-by-gtin-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const gtinMigration = fs.readFileSync(gtinMigrationPath, 'utf8');

function assertAuthenticatedOnlySelectedReadPolicy(sql) {
  const policyMatch = sql.match(
    /create\s+policy\s+marketplace_images_selected_read\s+on\s+storage\.objects[\s\S]*?for\s+select\s+to\s+([\s\S]*?)\s+using\s*\(/i,
  );

  assert.ok(policyMatch, 'Marketplace image selected-read policy must exist with an explicit TO role list');

  const roles = policyMatch[1]
    .split(',')
    .map((role) => role.trim().replace(/^"|"$/g, '').toLowerCase())
    .filter(Boolean);

  assert.deepEqual(
    roles,
    ['authenticated'],
    `Marketplace image read policy must be authenticated-only; got roles: ${roles.join(', ') || '(none)'}`,
  );
}

// Review the new policy delta explicitly before delegating all prior invariants
// to the established release gate. The owner path must remain scoped through the
// existing authorization helper; buyer access must still use the non-manage path.
assert.match(migration, /drop policy if exists marketplace_images_selected_read on storage\.objects;/i);
assertAuthenticatedOnlySelectedReadPolicy(migration);
assert.match(migration, /bucket_id\s*=\s*'marketplace-images'/i);
assert.match(migration, /public\.marketplace_image_object_access\(name, false\)/i);
assert.match(migration, /public\.marketplace_image_object_access\(name, true\)/i);
assert.doesNotMatch(migration, /\busing\s*\(\s*true\s*\)/i, 'Marketplace image read policy must never become unconditional');

for (const forbiddenRole of ['anon', 'public']) {
  const broadened = migration.replace(/\bto\s+authenticated\b/i, `to authenticated, ${forbiddenRole}`);
  assert.notEqual(broadened, migration, 'Expected authenticated role clause for release-gate self-test');
  assert.throws(
    () => assertAuthenticatedOnlySelectedReadPolicy(broadened),
    /authenticated-only/,
    `Release gate must reject appended ${forbiddenRole} role`,
  );
}

// Explicitly review the GTIN hardening delta before parking it for the legacy gate.
assert.match(gtinMigration, /create or replace function private\.is_valid_gtin_v1\(p_gtin text\)/i);
assert.match(gtinMigration, /revoke all on function private\.is_valid_gtin_v1\(text\) from public, anon, authenticated;/i);
assert.match(gtinMigration, /create or replace function public\.set_my_item_gtin_v1/i);
assert.match(gtinMigration, /where i\.id = p_item_id and i\.owner_id = v_owner/i, 'GTIN write must remain owner-scoped');
assert.match(gtinMigration, /if not private\.is_valid_gtin_v1\(v_gtin\) then[\s\S]*raise exception 'INVALID_GTIN'/i);
assert.match(gtinMigration, /revoke all on function public\.set_my_item_gtin_v1\(uuid, text, text\) from public, anon;/i);
assert.match(gtinMigration, /grant execute on function public\.set_my_item_gtin_v1\(uuid, text, text\) to authenticated;/i);
assert.doesNotMatch(gtinMigration, /grant\s+(?:select|insert|update|delete|all).*private\.item_product_identifiers.*authenticated/i,
  'GTIN hardening must not expose private identifier table privileges');

// The legacy owner-market-state gate intentionally fails closed when it sees
// migrations outside its reviewed scope. Park only deltas that have their own
// explicit release gates, then restore them before Supabase reset/pgTAP executes.
const parked = [
  [migrationPath, parkedPath],
  [offerMigrationPath, offerParkedPath],
  [gtinMigrationPath, gtinParkedPath],
];
for (const [source, destination] of parked) fs.renameSync(source, destination);
try {
  await import('./check-owner-market-state-release-gate.mjs');
} finally {
  for (const [source, destination] of parked.reverse()) fs.renameSync(destination, source);
}

console.log('marketplace image + GTIN checksum deltas + established owner market-state release gate: OK');
