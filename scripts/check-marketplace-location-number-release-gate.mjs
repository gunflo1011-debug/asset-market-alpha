import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260905132500_allow_numeric_marketplace_location_labels.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-location-number-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.save_my_marketplace_listing_v2\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Marketplace listing command must remain SECURITY DEFINER with an empty search_path',
);
assert.doesNotMatch(
  migration,
  /or\s+v_public_location\s+~\s+'\[0-9\]'/i,
  'Marketplace location must not blanket-reject digits',
);
assert.match(migration, /char_length\(v_public_location\)\s*>\s*80/i, 'Marketplace location must keep the 80 character cap');
assert.match(migration, /v_public_location\s+~\s+'\[\\r\\n\]'/i, 'Marketplace location must keep newline rejection');
assert.match(migration, /v_public_location\s+~\*\s+'\(https\?:\/\/\|www\\\.\|@\)'/i, 'Marketplace location must keep obvious URL/email rejection');
assert.match(
  migration,
  /v_public_location\s+~\s+'\^\[\[:space:\]\]\*\[\+\-\]\?\[0-9\]\{1,3\}/i,
  'Marketplace location must keep the bare coordinate-pair guard',
);

for (const snapshotField of [
  'public_title',
  'public_category',
  'public_estimated_value_cents',
  'public_condition_label',
  'source_variant_id',
  'source_gtin',
]) {
  assert.match(
    migration,
    new RegExp(`\\b${snapshotField}\\b`, 'i'),
    `Numeric location fix must preserve ${snapshotField} snapshot handling`,
  );
}
assert.match(
  migration,
  /public_title\s*=\s*case when p_publish then v_title else private\.marketplace_listings\.public_title end/i,
  'Explicit publish/update must continue refreshing the buyer-visible title snapshot',
);
assert.match(
  migration,
  /public_category\s*=\s*case when p_publish then v_category else private\.marketplace_listings\.public_category end/i,
  'Explicit publish/update must continue refreshing the buyer-visible category snapshot',
);

assert.match(migration, /revoke all on function public\.save_my_marketplace_listing_v2\(uuid,bigint,boolean,text\) from public, anon;/i);
assert.match(migration, /grant execute on function public\.save_my_marketplace_listing_v2\(uuid,bigint,boolean,text\) to authenticated;/i);

assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Numeric location fix must not weaken RLS, expose private tables, or perform destructive schema/data operations',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-item-scoped-estimate-context-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace numeric location + public snapshot preservation + established hardening release gate: OK');
