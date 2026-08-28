import fs from 'node:fs';
import assert from 'node:assert/strict';

const marketStateMigrationPath = 'supabase/migrations/20260825104500_owner_inventory_market_state.sql';
const ownerCrudMigrationPath = 'supabase/migrations/20260826211500_owner_inventory_crud.sql';
const genericCrudMigrationPath = 'supabase/migrations/20260827093500_generic_private_thing_crud.sql';
const itemMetadataMigrationPath = 'supabase/migrations/20260827191500_owner_item_metadata.sql';
const valueEvidenceMigrationPath = 'supabase/migrations/20260827203000_owner_inventory_value_evidence.sql';
const valueEstimateMigrationPath = 'supabase/migrations/20260827232500_owner_value_estimate_v1.sql';
const runbookPath = 'supabase/OWNER_MARKET_STATE_DEPLOY.md';
const inventoryPaths = [
  'mobile/src/data/inventory.ts',
  'mobile/src/data/inventoryQueries.ts',
  'mobile/src/data/inventoryCommands.ts',
];

const marketStateMigration = fs.readFileSync(marketStateMigrationPath, 'utf8');
const ownerCrudMigration = fs.readFileSync(ownerCrudMigrationPath, 'utf8');
const genericCrudMigration = fs.readFileSync(genericCrudMigrationPath, 'utf8');
const itemMetadataMigration = fs.readFileSync(itemMetadataMigrationPath, 'utf8');
const valueEvidenceMigration = fs.readFileSync(valueEvidenceMigrationPath, 'utf8');
const valueEstimateMigration = fs.readFileSync(valueEstimateMigrationPath, 'utf8');
const runbook = fs.readFileSync(runbookPath, 'utf8');
const inventory = inventoryPaths.map((path) => fs.readFileSync(path, 'utf8')).join('\n');

const migrationFiles = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort();
const marketStateName = '20260825104500_owner_inventory_market_state.sql';
const ownerCrudName = '20260826211500_owner_inventory_crud.sql';
const genericCrudName = '20260827093500_generic_private_thing_crud.sql';
const itemMetadataName = '20260827191500_owner_item_metadata.sql';
const valueEvidenceName = '20260827203000_owner_inventory_value_evidence.sql';
const valueEstimateName = '20260827232500_owner_value_estimate_v1.sql';

assert.equal(
  migrationFiles.at(-1),
  valueEstimateName,
  'release gate knows only reviewed migrations through owner value estimate v1; re-review any newer migration before release',
);
assert.ok(
  migrationFiles.indexOf(marketStateName) >= 0 &&
    migrationFiles.indexOf(marketStateName) < migrationFiles.indexOf(ownerCrudName) &&
    migrationFiles.indexOf(ownerCrudName) < migrationFiles.indexOf(genericCrudName) &&
    migrationFiles.indexOf(genericCrudName) < migrationFiles.indexOf(itemMetadataName) &&
    migrationFiles.indexOf(itemMetadataName) < migrationFiles.indexOf(valueEvidenceName) &&
    migrationFiles.indexOf(valueEvidenceName) < migrationFiles.indexOf(valueEstimateName),
  'reviewed migration order must remain market state -> device CRUD -> generic Thing CRUD -> owner item metadata -> owner value evidence -> owner value estimate v1',
);

assert.match(runbook, /Approval authorizes \*\*one hosted schema mutation only\*\*/i);
assert.match(runbook, /Do not .*apply unrelated pending migrations/i);
assert.match(runbook, /node scripts\/check-owner-market-state-migration\.mjs/i);
assert.match(runbook, /Authenticated user A can execute/i);
assert.match(runbook, /item owned by user B is never returned to A/i);
assert.match(runbook, /Anonymous execution is denied/i);
assert.match(runbook, /mobile inventory load succeeds for A and excludes returned `SOLD` items/i);
assert.match(runbook, /revoke all on function public\.load_my_inventory_market_states\(\) from public, anon, authenticated;/i);
assert.match(runbook, /drop function if exists public\.load_my_inventory_market_states\(\);/i);

assert.match(marketStateMigration, /where i\.owner_id = auth\.uid\(\)/i);
assert.match(marketStateMigration, /revoke all on function public\.load_my_inventory_market_states\(\) from public, anon/i);
assert.match(marketStateMigration, /grant execute on function public\.load_my_inventory_market_states\(\) to authenticated/i);

assert.match(ownerCrudMigration, /create or replace function public\.update_private_device/i);
assert.match(ownerCrudMigration, /create or replace function public\.delete_private_device/i);
assert.match(ownerCrudMigration, /security definer/gi);
assert.match(ownerCrudMigration, /set search_path = public, private, auth, pg_temp/gi);
assert.match(ownerCrudMigration, /v_owner_id uuid := auth\.uid\(\)/gi);
assert.match(ownerCrudMigration, /where id=p_item_id and owner_id=v_owner_id/gi);
assert.match(ownerCrudMigration, /raise exception 'ITEM_NOT_OWNED'/gi);
assert.match(ownerCrudMigration, /revoke all on function public\.update_private_device[\s\S]*from public, anon;/i);
assert.match(ownerCrudMigration, /grant execute on function public\.update_private_device[\s\S]*to authenticated;/i);
assert.match(ownerCrudMigration, /revoke all on function public\.delete_private_device\(uuid\) from public, anon;/i);
assert.match(ownerCrudMigration, /grant execute on function public\.delete_private_device\(uuid\) to authenticated;/i);

for (const functionName of ['add_private_thing', 'update_private_thing', 'delete_private_thing']) {
  assert.match(genericCrudMigration, new RegExp(`create or replace function public\\.${functionName}`, 'i'));
}
assert.match(genericCrudMigration, /alter table public\.items[\s\S]*alter column variant_id drop not null/i);
assert.match(genericCrudMigration, /check \(variant_id is not null or nullif\(btrim\(custom_name\), ''\) is not null\)/i);
assert.match(genericCrudMigration, /security definer set search_path=public,auth,pg_temp/gi);
assert.match(genericCrudMigration, /v_owner uuid:=auth\.uid\(\)/gi);
assert.match(genericCrudMigration, /insert into public\.items\(owner_id,variant_id,custom_name,category,location_label,notes\)[\s\S]*values\(v_owner,null,/i);
assert.match(genericCrudMigration, /where id=p_item_id and owner_id=v_owner and variant_id is null/gi);
assert.match(genericCrudMigration, /raise exception 'ITEM_NOT_OWNED'/gi);
assert.doesNotMatch(genericCrudMigration, /p_owner|owner_id\s+uuid\s+default/i, 'generic Thing RPCs must not accept caller-supplied ownership');
for (const signature of [
  'add_private_thing\\(text,text,text,text\\)',
  'update_private_thing\\(uuid,text,text,text,text\\)',
  'delete_private_thing\\(uuid\\)',
]) {
  assert.match(genericCrudMigration, new RegExp(`revoke all on function public\\.${signature} from public,anon;`, 'i'));
  assert.match(genericCrudMigration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.match(itemMetadataMigration, /create or replace function public\.update_private_item_metadata/i);
assert.match(itemMetadataMigration, /security definer/i);
assert.match(itemMetadataMigration, /set search_path = public, auth, pg_temp/i);
assert.match(itemMetadataMigration, /v_owner uuid := auth\.uid\(\)/i);
assert.match(itemMetadataMigration, /where id=p_item_id and owner_id=v_owner/i);
assert.match(itemMetadataMigration, /raise exception 'ITEM_NOT_OWNED'/i);
assert.doesNotMatch(itemMetadataMigration, /p_owner|set\s+owner_id/i, 'item metadata RPC must not accept or mutate ownership');
assert.match(itemMetadataMigration, /revoke all on function public\.update_private_item_metadata\(uuid,text,text,text,text\) from public, anon;/i);
assert.match(itemMetadataMigration, /grant execute on function public\.update_private_item_metadata\(uuid,text,text,text,text\) to authenticated;/i);

assert.match(valueEvidenceMigration, /create table if not exists private\.item_value_evidence/i);
assert.match(valueEvidenceMigration, /estimated_value_cents bigint not null check \(estimated_value_cents >= 0\)/i);
assert.match(valueEvidenceMigration, /currency text not null default 'EUR' check \(currency = 'EUR'\)/i);
assert.match(valueEvidenceMigration, /revoke all on table private\.item_value_evidence from public, anon, authenticated;/i);
assert.match(valueEvidenceMigration, /create or replace function public\.load_my_inventory_values\(\)/i);
assert.match(valueEvidenceMigration, /security definer/i);
assert.match(valueEvidenceMigration, /set search_path = public, private, auth, pg_temp/i);
assert.match(valueEvidenceMigration, /if auth\.uid\(\) is null[\s\S]*raise exception 'AUTH_REQUIRED'/i);
assert.match(valueEvidenceMigration, /join public\.items i on i\.id = e\.item_id[\s\S]*where i\.owner_id = auth\.uid\(\)/i);
assert.match(valueEvidenceMigration, /distinct on \(e\.item_id\)/i);
assert.match(valueEvidenceMigration, /order by e\.item_id, e\.observed_at desc, e\.created_at desc/i);
assert.match(valueEvidenceMigration, /revoke all on function public\.load_my_inventory_values\(\) from public, anon;/i);
assert.match(valueEvidenceMigration, /grant execute on function public\.load_my_inventory_values\(\) to authenticated;/i);
assert.doesNotMatch(valueEvidenceMigration, /grant\s+(insert|update|delete|all)[\s\S]*item_value_evidence[\s\S]*authenticated/i, 'mobile clients must not be granted write access to trusted value evidence');

// Owner-input value estimate v1 is deliberately transparent and owner-scoped.
assert.match(valueEstimateMigration, /create table if not exists private\.item_valuation_profiles/i);
assert.match(valueEstimateMigration, /revoke all on table private\.item_valuation_profiles from public, anon, authenticated;/i);
assert.match(valueEstimateMigration, /create or replace function public\.estimate_my_item_value_v1/i);
assert.match(valueEstimateMigration, /security definer/i);
assert.match(valueEstimateMigration, /set search_path = public, private, auth, pg_temp/i);
assert.match(valueEstimateMigration, /v_owner uuid := auth\.uid\(\)/i);
assert.match(valueEstimateMigration, /where id = p_item_id and owner_id = v_owner/i);
assert.match(valueEstimateMigration, /raise exception 'ITEM_NOT_OWNED'/i);
assert.match(valueEstimateMigration, /p_purchase_price_cents < 1|INVALID_PURCHASE_PRICE/i);
assert.match(valueEstimateMigration, /INVALID_PURCHASE_YEAR/i);
assert.match(valueEstimateMigration, /LIKE_NEW[\s\S]*GOOD[\s\S]*FAIR[\s\S]*POOR/i);
assert.match(valueEstimateMigration, /MODEL_V1_OWNER_INPUT/i);
assert.match(valueEstimateMigration, /purchase-price-age-condition/i);
assert.match(valueEstimateMigration, /revoke all on function public\.estimate_my_item_value_v1\(uuid,bigint,integer,text\) from public, anon;/i);
assert.match(valueEstimateMigration, /grant execute on function public\.estimate_my_item_value_v1\(uuid,bigint,integer,text\) to authenticated;/i);
assert.doesNotMatch(valueEstimateMigration, /p_owner|set\s+owner_id/i, 'value estimate RPC must not accept or mutate ownership');

assert.match(inventory, /load_my_inventory_market_states/i, 'mobile inventory must consume the authoritative RPC for catalog-backed devices');
assert.match(inventory, /load_my_inventory_values/i, 'mobile inventory must consume owner-scoped verified value evidence');
assert.match(inventory, /estimate_my_item_value_v1/i, 'mobile inventory must use the owner-safe transparent value estimate RPC');
assert.match(inventory, /SOLD/i, 'mobile inventory must explicitly handle SOLD state');
assert.match(inventory, /update_private_device/i, 'mobile inventory must use the owner-safe device update RPC');
assert.match(inventory, /delete_private_device/i, 'mobile inventory must use the owner-safe device delete RPC');
assert.match(inventory, /add_private_thing/i, 'mobile inventory must use the owner-safe generic Thing create RPC');
assert.match(inventory, /update_private_thing/i, 'mobile inventory must use the owner-safe generic Thing update RPC');
assert.match(inventory, /delete_private_thing/i, 'mobile inventory must use the owner-safe generic Thing delete RPC');
assert.match(inventory, /update_private_item_metadata/i, 'mobile inventory must use the owner-safe metadata RPC for editing any owned item');

console.log('owner market-state, CRUD, metadata, verified value evidence, and value estimate v1 release gate: OK');
