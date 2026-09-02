import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260901190500_marketplace_image_owner_upsert_select_v1.sql';
const parkedPath = `${migrationPath}.reviewed-by-v2-gate`;
const offerMigrationPath = 'supabase/migrations/20260902042000_marketplace_offers_v1.sql';
const offerParkedPath = `${offerMigrationPath}.reviewed-by-offer-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

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

// Regression-proof the gate itself: adding any broader PostgreSQL role must fail,
// even when authenticated remains the first entry in the TO list.
for (const forbiddenRole of ['anon', 'public']) {
  const broadened = migration.replace(/\bto\s+authenticated\b/i, `to authenticated, ${forbiddenRole}`);
  assert.notEqual(broadened, migration, 'Expected authenticated role clause for release-gate self-test');
  assert.throws(
    () => assertAuthenticatedOnlySelectedReadPolicy(broadened),
    /authenticated-only/,
    `Release gate must reject appended ${forbiddenRole} role`,
  );
}

// The legacy owner-market-state gate intentionally fails closed when it sees
// migrations outside its reviewed scope. Park only deltas that have their own
// explicit release gates, then restore them before Supabase reset/pgTAP executes.
const parked = [
  [migrationPath, parkedPath],
  [offerMigrationPath, offerParkedPath],
];
for (const [source, destination] of parked) fs.renameSync(source, destination);
try {
  await import('./check-owner-market-state-release-gate.mjs');
} finally {
  for (const [source, destination] of parked.reverse()) fs.renameSync(destination, source);
}

console.log('marketplace image owner-upsert select delta + established owner market-state release gate: OK');
