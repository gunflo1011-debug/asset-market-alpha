import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260909101223_index_marketplace_foreign_keys.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-foreign-key-index-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

for (const [indexName, tableName, columnName] of [
  ['item_images_owner_id_idx', 'private.item_images', 'owner_id'],
  ['marketplace_listings_source_variant_id_idx', 'private.marketplace_listings', 'source_variant_id'],
  ['marketplace_messages_sender_id_idx', 'private.marketplace_messages', 'sender_id'],
  ['marketplace_offers_parent_offer_id_idx', 'private.marketplace_offers', 'parent_offer_id'],
  ['marketplace_offers_proposer_id_idx', 'private.marketplace_offers', 'proposer_id'],
]) {
  assert.match(
    migration,
    new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${indexName}\\s+on\\s+${tableName.replace('.', '\\.') }\\s*\\(\\s*${columnName}\\s*\\)\\s*;`, 'i'),
    `${indexName} must cover ${tableName}.${columnName}`,
  );
}

assert.doesNotMatch(
  executable,
  /\b(?:drop|alter|truncate|insert|update|delete|grant|revoke)\b|\bcreate\s+(?:policy|table|schema|function|trigger|view)\b|\b(?:enable|disable)\s+row\s+level\s+security\b/i,
  'Marketplace foreign-key index migration must remain additive indexing only',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-legacy-marketplace-rpc-execute-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace foreign-key indexes + established hardening release gate: OK');
