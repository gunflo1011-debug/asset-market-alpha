import fs from 'node:fs';
import assert from 'node:assert/strict';

const marketStateMigrationPath = 'supabase/migrations/20260825104500_owner_inventory_market_state.sql';
const ownerCrudMigrationPath = 'supabase/migrations/20260826211500_owner_inventory_crud.sql';
const genericCrudMigrationPath = 'supabase/migrations/20260827093500_generic_private_thing_crud.sql';
const itemMetadataMigrationPath = 'supabase/migrations/20260827191500_owner_item_metadata.sql';
const runbookPath = 'supabase/OWNER_MARKET_STATE_DEPLOY.md';
const inventoryPath = 'mobile/src/data/inventory.ts';

const marketStateMigration = fs.readFileSync(marketStateMigrationPath, 'utf8');
const ownerCrudMigration = fs.readFileSync(ownerCrudMigrationPath, 'utf8');
const genericCrudMigration = fs.readFileSync(genericCrudMigrationPath, 'utf8');
const itemMetadataMigration = fs.readFileSync(itemMetadataMigrationPath, 'utf8');
const runbook = fs.readFileSync(runbookPath, 'utf8');
const inventory = fs.readFileSync(inventoryPath, 'utf8');

const migrationFiles = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort();
const marketStateName = '20260825104500_owner_inventory_market_state.sql';
const ownerCrudName = '20260826211500_owner_inventory_crud.sql';
const genericCrudName = '20260827093500_generic_private_thing_crud.sql';
const itemMetadataName = '20260827191500_owner_item_metadata.sql';

assert.equal(
  migrationFiles.at(-1),
  itemMetadataName,
  'release gate knows only reviewed migrations through owner item metadata; re-review any newer migration before release',
);
assert.ok(
  migrationFiles.indexOf(marketStateName) >= 0 &&
    migrationFiles.indexOf(marketStateName) < migrationFiles.indexOf(ownerCrudName) &&
    migrationFiles.indexOf(ownerCrudName) < migrationFiles.indexOf(genericCrudName) &&
    migrationFiles.indexOf(genericCrudName) < migrationFiles.indexOf(itemMetadataName),
  'reviewed migration order must remain market state -> device CRUD -> generic Thing CRUD -> owner item metadata',
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

// Device CRUD remains owner-scoped and fail-closed.
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

// Generic Things may omit a catalog variant, but every SECURITY DEFINER command must
// derive the owner from auth.uid(), keep a fixed search_path, and never accept a caller-
// supplied owner id. Update/delete additionally require the row to belong to the caller
// and to be a generic Thing (variant_id is null).
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

// Item display metadata may be edited for both generic Things and catalog devices, but
// never by supplying or changing owner_id. The RPC must derive auth.uid(), validate the
// row belongs to that user, and expose execution only to authenticated users.
assert.match(itemMetadataMigration, /create or replace function public\.update_private_item_metadata/i);
assert.match(itemMetadataMigration, /security definer/i);
assert.match(itemMetadataMigration, /set search_path = public, auth, pg_temp/i);
assert.match(itemMetadataMigration, /v_owner uuid := auth\.uid\(\)/i);
assert.match(itemMetadataMigration, /where id=p_item_id and owner_id=v_owner/i);
assert.match(itemMetadataMigration, /raise exception 'ITEM_NOT_OWNED'/i);
assert.doesNotMatch(itemMetadataMigration, /p_owner|set\s+owner_id/i, 'item metadata RPC must not accept or mutate ownership');
assert.match(itemMetadataMigration, /revoke all on function public\.update_private_item_metadata\(uuid,text,text,text,text\) from public, anon;/i);
assert.match(itemMetadataMigration, /grant execute on function public\.update_private_item_metadata\(uuid,text,text,text,text\) to authenticated;/i);

assert.match(inventory, /load_my_inventory_market_states/i, 'mobile inventory must consume the authoritative RPC for catalog-backed devices');
assert.match(inventory, /SOLD/i, 'mobile inventory must explicitly handle SOLD state');
assert.match(inventory, /update_private_device/i, 'mobile inventory must use the owner-safe device update RPC');
assert.match(inventory, /delete_private_device/i, 'mobile inventory must use the owner-safe device delete RPC');
assert.match(inventory, /add_private_thing/i, 'mobile inventory must use the owner-safe generic Thing create RPC');
assert.match(inventory, /update_private_thing/i, 'mobile inventory must use the owner-safe generic Thing update RPC');
assert.match(inventory, /delete_private_thing/i, 'mobile inventory must use the owner-safe generic Thing delete RPC');
assert.match(inventory, /update_private_item_metadata/i, 'mobile inventory must use the owner-safe metadata RPC for editing any owned item');

console.log('owner market-state, device CRUD, generic Thing CRUD, and item metadata release gate: OK');
