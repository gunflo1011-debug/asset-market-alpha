import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const migrationFiles = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort();

const marketStateName = '20260825104500_owner_inventory_market_state.sql';
const ownerCrudName = '20260826211500_owner_inventory_crud.sql';
const genericCrudName = '20260827093500_generic_private_thing_crud.sql';
const itemMetadataName = '20260827191500_owner_item_metadata.sql';
const valueEvidenceName = '20260827203000_owner_inventory_value_evidence.sql';
const valueEstimateName = '20260827232500_owner_value_estimate_v1.sql';
const marketplaceName = '20260828171000_marketplace_listing_v1.sql';
const interestName = '20260828220500_marketplace_interest_v1.sql';

const marketStateMigration = read(`supabase/migrations/${marketStateName}`);
const ownerCrudMigration = read(`supabase/migrations/${ownerCrudName}`);
const genericCrudMigration = read(`supabase/migrations/${genericCrudName}`);
const itemMetadataMigration = read(`supabase/migrations/${itemMetadataName}`);
const valueEvidenceMigration = read(`supabase/migrations/${valueEvidenceName}`);
const valueEstimateMigration = read(`supabase/migrations/${valueEstimateName}`);
const marketplaceMigration = read(`supabase/migrations/${marketplaceName}`);
const interestMigration = read(`supabase/migrations/${interestName}`);
const runbook = read('supabase/OWNER_MARKET_STATE_DEPLOY.md');
const inventory = [
  read('mobile/src/data/inventory.ts'),
  read('mobile/src/data/inventoryQueries.ts'),
  read('mobile/src/data/inventoryCommands.ts'),
].join('\n');

assert.equal(migrationFiles.at(-1), interestName, 'release gate knows only reviewed migrations through marketplace interest v1; re-review any newer migration before release');
const reviewedOrder = [marketStateName, ownerCrudName, genericCrudName, itemMetadataName, valueEvidenceName, valueEstimateName, marketplaceName, interestName];
for (let i = 0; i < reviewedOrder.length; i += 1) {
  assert.ok(migrationFiles.includes(reviewedOrder[i]), `missing reviewed migration ${reviewedOrder[i]}`);
  if (i > 0) assert.ok(migrationFiles.indexOf(reviewedOrder[i - 1]) < migrationFiles.indexOf(reviewedOrder[i]), 'reviewed migration order changed');
}

assert.match(runbook, /Approval authorizes \*\*one hosted schema mutation only\*\*/i);
assert.match(runbook, /Do not .*apply unrelated pending migrations/i);
assert.match(runbook, /Anonymous execution is denied/i);

assert.match(marketStateMigration, /where i\.owner_id = auth\.uid\(\)/i);
assert.match(marketStateMigration, /grant execute on function public\.load_my_inventory_market_states\(\) to authenticated/i);
assert.match(ownerCrudMigration, /where id=p_item_id and owner_id=v_owner_id/i);
assert.match(ownerCrudMigration, /raise exception 'ITEM_NOT_OWNED'/i);
assert.match(genericCrudMigration, /where id=p_item_id and owner_id=v_owner and variant_id is null/i);
assert.doesNotMatch(genericCrudMigration, /p_owner|owner_id\s+uuid\s+default/i);
assert.match(itemMetadataMigration, /where id=p_item_id and owner_id=v_owner/i);
assert.match(valueEvidenceMigration, /where i\.owner_id = auth\.uid\(\)/i);
assert.match(valueEstimateMigration, /where id = p_item_id and owner_id = v_owner/i);

assert.match(marketplaceMigration, /revoke all on table private\.marketplace_listings from public, anon, authenticated;/i);
assert.match(marketplaceMigration, /where i\.id = p_item_id and i\.owner_id = v_owner/i);
assert.match(marketplaceMigration, /where l\.status = 'PUBLISHED'[\s\S]*and l\.seller_id <> auth\.uid\(\)/i);
const marketplaceReturn = marketplaceMigration.match(/create or replace function public\.load_marketplace_v1\(\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
assert.ok(marketplaceReturn, 'marketplace read return contract missing');
assert.doesNotMatch(marketplaceReturn, /\b(?:seller_id|owner_id|location_label|notes|email)\b/i, 'marketplace read must not expose seller identity or private metadata');

// Marketplace interest v1 review: buyer/seller IDs remain private and callers only get their own state or aggregate seller counts.
assert.match(interestMigration, /create table if not exists private\.marketplace_interests/i);
assert.match(interestMigration, /primary key \(item_id, buyer_id\)/i);
assert.match(interestMigration, /check \(buyer_id <> seller_id\)/i);
assert.match(interestMigration, /revoke all on table private\.marketplace_interests from public, anon, authenticated;/i);
assert.match(interestMigration, /create or replace function public\.set_my_marketplace_interest/i);
assert.match(interestMigration, /v_buyer uuid := auth\.uid\(\)/i);
assert.match(interestMigration, /where l\.item_id = p_item_id and l\.status = 'PUBLISHED'/i);
assert.match(interestMigration, /OWN_LISTING_INTEREST_NOT_ALLOWED/i);
assert.match(interestMigration, /create or replace function public\.load_my_marketplace_interests/i);
assert.match(interestMigration, /where i\.buyer_id = auth\.uid\(\)/i);
assert.match(interestMigration, /create or replace function public\.load_interest_summary_for_my_listings/i);
assert.match(interestMigration, /where i\.seller_id = auth\.uid\(\)/i);
const buyerReturn = interestMigration.match(/create or replace function public\.load_my_marketplace_interests\(\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
const sellerReturn = interestMigration.match(/create or replace function public\.load_interest_summary_for_my_listings\(\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
assert.ok(buyerReturn && sellerReturn, 'interest return contracts missing');
assert.doesNotMatch(buyerReturn, /\b(?:buyer_id|seller_id|owner_id|email|location_label|notes)\b/i, 'buyer interest read must not expose identity/private metadata');
assert.doesNotMatch(sellerReturn, /\b(?:buyer_id|seller_id|owner_id|email|location_label|notes)\b/i, 'seller interest summary must remain aggregate and identity-free');
assert.match(sellerReturn, /item_id uuid,[\s\S]*interested_count bigint,[\s\S]*latest_interest_at timestamptz/i);
for (const signature of ['set_my_marketplace_interest\\(uuid,boolean\\)', 'load_my_marketplace_interests\\(\\)', 'load_interest_summary_for_my_listings\\(\\)']) {
  assert.match(interestMigration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(interestMigration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

for (const marker of [
  'load_my_inventory_market_states',
  'load_my_inventory_values',
  'estimate_my_item_value_v1',
  'save_my_marketplace_listing',
  'withdraw_my_marketplace_listing',
  'load_marketplace_v1',
  'set_my_marketplace_interest',
  'load_my_marketplace_interests',
  'load_interest_summary_for_my_listings',
  'update_private_device',
  'delete_private_device',
  'add_private_thing',
  'update_private_thing',
  'delete_private_thing',
  'update_private_item_metadata',
  'SOLD',
]) assert.match(inventory, new RegExp(marker, 'i'), `mobile inventory missing ${marker}`);

console.log('owner, value, marketplace listing, and privacy-safe interest release gate: OK');
