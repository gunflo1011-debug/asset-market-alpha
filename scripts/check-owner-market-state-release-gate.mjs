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
const metadataHardeningName = '20260829213000_harden_update_private_item_metadata_search_path.sql';
const addThingHardeningName = '20260830003000_harden_add_private_thing_search_path.sql';
const updateThingHardeningName = '20260830043000_harden_update_private_thing_search_path.sql';
const deleteThingHardeningName = '20260830073000_harden_delete_private_thing_search_path.sql';
const itemImagesName = '20260830145000_private_thing_images_v1.sql';
const marketplaceImageSelectionName = '20260830150000_marketplace_image_selection_v1.sql';
const marketplaceImageDeliveryName = '20260830153000_marketplace_image_delivery_v1.sql';
const coarseLocationName = '20260830193000_marketplace_coarse_location_v1.sql';
const coarseLocationHardeningName = '20260831102500_harden_marketplace_coarse_location_v2.sql';
const marketValueName = '20260831154000_market_value_median_v1.sql';
const structuredGtinName = '20260831214500_structured_gtin_identity_v1.sql';

const marketStateMigration = read(`supabase/migrations/${marketStateName}`);
const ownerCrudMigration = read(`supabase/migrations/${ownerCrudName}`);
const genericCrudMigration = read(`supabase/migrations/${genericCrudName}`);
const itemMetadataMigration = read(`supabase/migrations/${itemMetadataName}`);
const valueEvidenceMigration = read(`supabase/migrations/${valueEvidenceName}`);
const valueEstimateMigration = read(`supabase/migrations/${valueEstimateName}`);
const marketplaceMigration = read(`supabase/migrations/${marketplaceName}`);
const interestMigration = read(`supabase/migrations/${interestName}`);
const metadataHardeningMigration = read(`supabase/migrations/${metadataHardeningName}`);
const addThingHardeningMigration = read(`supabase/migrations/${addThingHardeningName}`);
const updateThingHardeningMigration = read(`supabase/migrations/${updateThingHardeningName}`);
const deleteThingHardeningMigration = read(`supabase/migrations/${deleteThingHardeningName}`);
const itemImagesMigration = read(`supabase/migrations/${itemImagesName}`);
const marketplaceImageSelectionMigration = read(`supabase/migrations/${marketplaceImageSelectionName}`);
const marketplaceImageDeliveryMigration = read(`supabase/migrations/${marketplaceImageDeliveryName}`);
const coarseLocationMigration = read(`supabase/migrations/${coarseLocationName}`);
const coarseLocationHardeningMigration = read(`supabase/migrations/${coarseLocationHardeningName}`);
const marketValueMigration = read(`supabase/migrations/${marketValueName}`);
const structuredGtinMigration = read(`supabase/migrations/${structuredGtinName}`);
const runbook = read('supabase/OWNER_MARKET_STATE_DEPLOY.md');
const inventory = [
  read('mobile/src/data/inventory.ts'),
  read('mobile/src/data/inventoryQueries.ts'),
  read('mobile/src/data/inventoryCommands.ts'),
  read('mobile/src/data/itemImages.ts'),
].join('\n');

assert.equal(migrationFiles.at(-1), structuredGtinName, 'release gate knows only reviewed migrations through private structured GTIN identity v1; re-review any newer migration before release');
const reviewedOrder = [marketStateName, ownerCrudName, genericCrudName, itemMetadataName, valueEvidenceName, valueEstimateName, marketplaceName, interestName, metadataHardeningName, addThingHardeningName, updateThingHardeningName, deleteThingHardeningName, itemImagesName, marketplaceImageSelectionName, marketplaceImageDeliveryName, coarseLocationName, coarseLocationHardeningName, marketValueName, structuredGtinName];
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
assert.match(metadataHardeningMigration, /alter function public\.update_private_item_metadata\(uuid, text, text, text, text\)[\s\S]*set search_path = ''/i);
assert.match(addThingHardeningMigration, /alter function public\.add_private_thing\(text, text, text, text\)[\s\S]*set search_path = ''/i);
assert.match(updateThingHardeningMigration, /alter function public\.update_private_thing\(uuid, text, text, text, text\)[\s\S]*set search_path = ''/i);
assert.match(deleteThingHardeningMigration, /alter function public\.delete_private_thing\(uuid\)[\s\S]*set search_path = ''/i);
assert.match(valueEvidenceMigration, /where i\.owner_id = auth\.uid\(\)/i);
assert.match(valueEstimateMigration, /where id = p_item_id and owner_id = v_owner/i);

assert.match(marketplaceMigration, /revoke all on table private\.marketplace_listings from public, anon, authenticated;/i);
assert.match(marketplaceMigration, /where i\.id = p_item_id and i\.owner_id = v_owner/i);
assert.match(marketplaceMigration, /where l\.status = 'PUBLISHED'[\s\S]*and l\.seller_id <> auth\.uid\(\)/i);
const marketplaceReturn = marketplaceMigration.match(/create or replace function public\.load_marketplace_v1\(\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
assert.ok(marketplaceReturn, 'marketplace read return contract missing');
assert.doesNotMatch(marketplaceReturn, /\b(?:seller_id|owner_id|location_label|notes|email)\b/i, 'marketplace read must not expose seller identity or private metadata');

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

assert.match(itemImagesMigration, /values \('thing-images', 'thing-images', false/i);
assert.match(itemImagesMigration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
assert.match(itemImagesMigration, /split_part\(p_storage_path, '\/', 1\) <> v_owner::text/i);
assert.match(itemImagesMigration, /split_part\(p_storage_path, '\/', 2\) <> p_item_id::text/i);
assert.match(itemImagesMigration, /where ii\.item_id = p_item_id and i\.owner_id = auth\.uid\(\) and ii\.owner_id = auth\.uid\(\)/i);
assert.match(itemImagesMigration, /revoke all on table private\.item_images from public, anon, authenticated;/i);
for (const signature of ['register_my_item_image\\(uuid,text\\)', 'load_my_item_images\\(uuid\\)', 'set_my_item_primary_image\\(uuid,uuid\\)', 'delete_my_item_image\\(uuid,uuid\\)']) {
  assert.match(itemImagesMigration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(itemImagesMigration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.match(marketplaceImageSelectionMigration, /create or replace function public\.set_my_item_image_marketplace_visibility/i);
assert.match(marketplaceImageSelectionMigration, /ii\.owner_id = v_owner[\s\S]*i\.owner_id = v_owner/i);
assert.match(marketplaceImageSelectionMigration, /v_visible_count >= 6/i);
assert.match(marketplaceImageSelectionMigration, /This flag alone never grants file access/i);
assert.match(marketplaceImageSelectionMigration, /revoke all on function public\.set_my_item_image_marketplace_visibility\(uuid,uuid,boolean\) from public, anon;/i);
assert.match(marketplaceImageSelectionMigration, /grant execute on function public\.set_my_item_image_marketplace_visibility\(uuid,uuid,boolean\) to authenticated;/i);

assert.match(marketplaceImageDeliveryMigration, /values \('marketplace-images', 'marketplace-images', false/i);
assert.match(marketplaceImageDeliveryMigration, /create or replace function public\.marketplace_image_object_access/i);
assert.match(marketplaceImageDeliveryMigration, /ii\.marketplace_visible[\s\S]*l\.status = 'PUBLISHED'/i);
assert.match(marketplaceImageDeliveryMigration, /create or replace function public\.load_marketplace_image_refs_v1/i);
assert.match(marketplaceImageDeliveryMigration, /returns table\(item_id uuid, image_id uuid, sort_order integer\)/i);
assert.match(marketplaceImageDeliveryMigration, /l\.seller_id <> auth\.uid\(\)/i);
assert.doesNotMatch(marketplaceImageDeliveryMigration.match(/returns table\(item_id uuid, image_id uuid, sort_order integer\)/i)?.[0] ?? '', /seller_id|owner_id|storage_path/i);
assert.match(marketplaceImageDeliveryMigration, /marketplace_images_selected_read[\s\S]*marketplace_image_object_access\(name, false\)/i);
assert.match(marketplaceImageDeliveryMigration, /marketplace_images_owner_insert[\s\S]*marketplace_image_object_access\(name, true\)/i);
for (const signature of ['marketplace_image_object_access\\(text,boolean\\)', 'load_marketplace_image_refs_v1\\(\\)']) {
  assert.match(marketplaceImageDeliveryMigration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(marketplaceImageDeliveryMigration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.match(coarseLocationMigration, /add column if not exists public_location text/i);
assert.match(coarseLocationMigration, /v_owner uuid := auth\.uid\(\)/i);
assert.match(coarseLocationMigration, /char_length\(v_public_location\) > 80/i);
assert.match(coarseLocationMigration, /where i\.id = p_item_id and i\.owner_id = v_owner/i);
assert.match(coarseLocationMigration, /where l\.seller_id = auth\.uid\(\)/i);
assert.match(coarseLocationMigration, /where l\.status = 'PUBLISHED'[\s\S]*and l\.seller_id <> auth\.uid\(\)/i);
const marketplaceV2Return = coarseLocationMigration.match(/create or replace function public\.load_marketplace_v2\(\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
assert.ok(marketplaceV2Return, 'Marketplace v2 buyer return contract missing');
assert.match(marketplaceV2Return, /public_location text/i);
assert.doesNotMatch(marketplaceV2Return, /\b(?:seller_id|owner_id|location_label|notes|email|latitude|longitude|gps|address)\b/i, 'Marketplace v2 buyer read must expose only seller-controlled coarse location, never identity or precise/private location data');
for (const signature of ['save_my_marketplace_listing_v2\\(uuid,bigint,boolean,text\\)', 'load_my_marketplace_listings_v2\\(\\)', 'load_marketplace_v2\\(\\)']) {
  assert.match(coarseLocationMigration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(coarseLocationMigration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.match(coarseLocationHardeningMigration, /create or replace function public\.save_my_marketplace_listing_v2[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(coarseLocationHardeningMigration, /char_length\(v_public_location\) > 80/i);
assert.match(coarseLocationHardeningMigration, /v_public_location ~ '\[0-9\]'/i);
assert.match(coarseLocationHardeningMigration, /v_public_location ~ '\[\\r\\n\]'/i);
assert.match(coarseLocationHardeningMigration, /v_public_location ~\* '\(https\?:\/\/\|www\\\.\|@\)'/i);
assert.match(coarseLocationHardeningMigration, /alter function public\.load_my_marketplace_listings_v2\(\) set search_path = ''/i);
assert.match(coarseLocationHardeningMigration, /alter function public\.load_marketplace_v2\(\) set search_path = ''/i);
for (const signature of ['save_my_marketplace_listing_v2\\(uuid,bigint,boolean,text\\)', 'load_my_marketplace_listings_v2\\(\\)', 'load_marketplace_v2\\(\\)']) {
  assert.match(coarseLocationHardeningMigration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(coarseLocationHardeningMigration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.match(marketValueMigration, /create or replace function public\.load_my_market_value_v1\(p_item_id uuid\)/i);
assert.match(marketValueMigration, /security definer[\s\S]*set search_path = ''/i);
assert.match(marketValueMigration, /where i\.id = p_item_id and i\.owner_id = v_owner/i);
assert.match(marketValueMigration, /percentile_disc\(0\.5\)/i);
assert.match(marketValueMigration, /v_count >= 3/i);
assert.match(marketValueMigration, /ms\.market_state = 'SOLD'/i);
assert.match(marketValueMigration, /l\.status = 'PUBLISHED'/i);
assert.match(marketValueMigration, /distinct on \(l\.seller_id\)/i);
assert.match(marketValueMigration, /l\.seller_id <> v_owner/i);
assert.match(marketValueMigration, /revoke all on function public\.load_my_market_value_v1\(uuid\) from public, anon;/i);
assert.match(marketValueMigration, /grant execute on function public\.load_my_market_value_v1\(uuid\) to authenticated;/i);
const marketValueReturn = marketValueMigration.match(/returns table\(([\s\S]*?)\)\s*language plpgsql/i)?.[1] ?? '';
assert.ok(marketValueReturn, 'market value return contract missing');
assert.doesNotMatch(marketValueReturn, /\b(?:seller_id|owner_id|email|notes|location|address)\b/i, 'market value aggregate must not expose seller identity or private metadata');

assert.match(structuredGtinMigration, /create table if not exists private\.item_product_identifiers/i);
assert.match(structuredGtinMigration, /alter table private\.item_product_identifiers enable row level security/i);
assert.match(structuredGtinMigration, /revoke all on table private\.item_product_identifiers from public, anon, authenticated/i);
assert.match(structuredGtinMigration, /constraint item_product_identifiers_gtin_format check/i);
assert.match(structuredGtinMigration, /create or replace function public\.set_my_item_gtin_v1/i);
assert.match(structuredGtinMigration, /security definer[\s\S]*set search_path = ''/i);
assert.match(structuredGtinMigration, /where i\.id = p_item_id and i\.owner_id = v_owner/i);
assert.match(structuredGtinMigration, /raise exception 'ITEM_NOT_OWNED'/i);
assert.match(structuredGtinMigration, /revoke all on function public\.set_my_item_gtin_v1\(uuid, text, text\) from public, anon/i);
assert.match(structuredGtinMigration, /grant execute on function public\.set_my_item_gtin_v1\(uuid, text, text\) to authenticated/i);
assert.match(structuredGtinMigration, /from private\.item_product_identifiers pi[\s\S]*pi\.confirmed_by_user = true/i);
assert.match(structuredGtinMigration, /i\.variant_id is null and pi\.gtin = v_gtin/i);
assert.match(structuredGtinMigration, /percentile_disc\(0\.5\)/i);
assert.match(structuredGtinMigration, /v_count >= 3/i);
assert.match(structuredGtinMigration, /distinct on \(l\.seller_id\)/i);
assert.match(structuredGtinMigration, /l\.seller_id <> v_owner/i);
assert.doesNotMatch(structuredGtinMigration.match(/returns table\(([\s\S]*?)\)\s*language plpgsql/i)?.[1] ?? '', /\b(?:gtin|seller_id|owner_id|email|notes|location|address)\b/i, 'market value RPC must not expose GTIN, seller identity, or private metadata');

for (const marker of [
  'load_my_inventory_market_states',
  'load_my_inventory_values',
  'estimate_my_item_value_v1',
  'save_my_marketplace_listing_v2',
  'withdraw_my_marketplace_listing',
  'load_marketplace_v2',
  'load_my_marketplace_listings_v2',
  'load_marketplace_image_refs_v1',
  'load_my_market_value_v1',
  'set_my_marketplace_interest',
  'load_my_marketplace_interests',
  'load_interest_summary_for_my_listings',
  'update_private_device',
  'delete_private_device',
  'add_private_thing',
  'update_private_thing',
  'delete_private_thing',
  'update_private_item_metadata',
  'set_my_item_image_marketplace_visibility',
  'syncMyMarketplaceImageProjections',
  'SOLD',
]) assert.match(inventory, new RegExp(marker, 'i'), `mobile inventory missing ${marker}`);

console.log('owner, value, marketplace, interest, private Thing images, secure Marketplace image delivery, coarse Marketplace location privacy hardening, Marketplace median market value, and private structured GTIN identity release gate: OK');
