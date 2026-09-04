import fs from 'node:fs';
import assert from 'node:assert/strict';
import { validateItemProductIdentifiersOwnerRlsMigration } from './check-item-product-identifiers-owner-rls-release-gate.mjs';

const migrationPath = 'supabase/migrations/20260904081500_index_marketplace_interests_buyer_updated.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-interest-index-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

assert.match(
  migration,
  /^\s*create\s+index\s+if\s+not\s+exists\s+marketplace_interests_buyer_updated_idx\s+on\s+private\.marketplace_interests\s*\(\s*buyer_id\s*,\s*updated_at\s+desc\s*\)\s*;\s*$/i,
  'Marketplace interest index migration must create only the approved buyer/updated_at index',
);

assert.doesNotMatch(
  migration,
  /\b(?:drop|alter|grant|revoke|create\s+(?:or\s+replace\s+)?function|policy|row\s+level\s+security|insert|update|delete\s+from|truncate)\b/i,
  'Marketplace interest index migration must not change data, privileges, functions, policies, RLS, or existing schema objects',
);

const ownerRlsMigrationPath = 'supabase/migrations/20260904102000_item_product_identifiers_owner_rls.sql';
const ownerRlsParkedPath = `${ownerRlsMigrationPath}.reviewed-by-item-product-identifiers-owner-rls-gate`;
const hasOwnerRlsMigration = fs.existsSync(ownerRlsMigrationPath);

if (hasOwnerRlsMigration) {
  validateItemProductIdentifiersOwnerRlsMigration(fs.readFileSync(ownerRlsMigrationPath, 'utf8'));
  fs.renameSync(ownerRlsMigrationPath, ownerRlsParkedPath);
}

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-image-participant-access-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
  if (hasOwnerRlsMigration) {
    fs.renameSync(ownerRlsParkedPath, ownerRlsMigrationPath);
  }
}

console.log('Marketplace interest buyer/recency index + product identifier owner RLS + Marketplace image participant access + established release gate: OK');
