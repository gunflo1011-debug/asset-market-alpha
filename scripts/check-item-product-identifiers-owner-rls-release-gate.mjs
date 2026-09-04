import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904102000_item_product_identifiers_owner_rls.sql';
const parkedPath = `${migrationPath}.reviewed-by-item-product-identifiers-owner-rls-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');

const normalized = migration.replace(/\s+/g, ' ').trim();

for (const [name, command] of [
  ['item_product_identifiers_owner_select', 'select'],
  ['item_product_identifiers_owner_insert', 'insert'],
  ['item_product_identifiers_owner_update', 'update'],
  ['item_product_identifiers_owner_delete', 'delete'],
]) {
  assert.match(
    normalized,
    new RegExp(`create policy "${name}" on private\\.item_product_identifiers for ${command} to authenticated`, 'i'),
    `Missing approved ${command.toUpperCase()} owner policy`,
  );
}

assert.equal(
  (normalized.match(/create policy /gi) ?? []).length,
  4,
  'Owner RLS migration must create exactly four policies',
);

assert.equal(
  (normalized.match(/i\.owner_id\s*=\s*\(select auth\.uid\(\)\)/gi) ?? []).length,
  5,
  'Every policy predicate, including both UPDATE predicates, must enforce owner_id = auth.uid()',
);

assert.match(
  normalized,
  /create policy "item_product_identifiers_owner_update" on private\.item_product_identifiers for update to authenticated using \(.+?owner_id\s*=\s*\(select auth\.uid\(\)\).+?\) with check \(.+?owner_id\s*=\s*\(select auth\.uid\(\)\).+?\);/i,
  'UPDATE policy must protect both existing rows and replacement values',
);

assert.doesNotMatch(
  normalized,
  /\b(?:grant|revoke|alter|drop|truncate|insert\s+into|update\s+private\.|delete\s+from|create\s+(?:or\s+replace\s+)?function)\b/i,
  'Owner RLS migration must not change privileges, functions, data, or existing schema objects',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-interest-index-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Item product identifier owner RLS + established release gates: OK');
