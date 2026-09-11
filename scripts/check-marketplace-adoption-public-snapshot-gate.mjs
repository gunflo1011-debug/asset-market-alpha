import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260911081500_adoption_uses_marketplace_public_snapshot.sql';
const parkedPath = `${migrationPath}.reviewed-by-adoption-public-snapshot-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.adopt_my_sold_marketplace_thing\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Buyer adoption must remain SECURITY DEFINER with an empty search_path',
);
assert.match(
  migration,
  /from private\.marketplace_conversations[\s\S]*c\.buyer_id = auth\.uid\(\)/i,
  'Buyer adoption must remain scoped to the authenticated buyer',
);
assert.match(
  migration,
  /v_status <> 'SOLD'[\s\S]*SALE_NOT_COMPLETE/i,
  'Buyer adoption must remain restricted to completed sales',
);
assert.match(
  migration,
  /l\.public_title[\s\S]*l\.public_category[\s\S]*l\.source_variant_id[\s\S]*l\.source_gtin[\s\S]*l\.sold_price_cents[\s\S]*from private\.marketplace_listings/i,
  'Adoption fields must come from the frozen Marketplace public snapshot and transaction record',
);
assert.doesNotMatch(
  executable,
  /select[\s\S]{0,500}(?:i\.custom_name|i\.category)[\s\S]{0,500}from public\.items/i,
  'Buyer adoption must not read mutable seller-private title/category from public.items',
);
assert.doesNotMatch(
  executable,
  /from private\.item_product_identifiers/i,
  'Buyer adoption must not re-read mutable seller-private identifiers after publication',
);
assert.match(
  migration,
  /revoke all on function public\.adopt_my_sold_marketplace_thing\(uuid\) from public, anon;[\s\S]*grant execute[\s\S]*to authenticated;/i,
  'Buyer adoption RPC must not be executable by anon/PUBLIC',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Adoption privacy hardening must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-item-delete-marketplace-history-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace buyer-adoption public-snapshot privacy gate: OK');
