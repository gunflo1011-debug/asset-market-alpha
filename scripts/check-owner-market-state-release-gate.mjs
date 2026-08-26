import fs from 'node:fs';
import assert from 'node:assert/strict';

const marketStateMigrationPath = 'supabase/migrations/20260825104500_owner_inventory_market_state.sql';
const ownerCrudMigrationPath = 'supabase/migrations/20260826211500_owner_inventory_crud.sql';
const runbookPath = 'supabase/OWNER_MARKET_STATE_DEPLOY.md';
const inventoryPath = 'mobile/src/data/inventory.ts';

const marketStateMigration = fs.readFileSync(marketStateMigrationPath, 'utf8');
const ownerCrudMigration = fs.readFileSync(ownerCrudMigrationPath, 'utf8');
const runbook = fs.readFileSync(runbookPath, 'utf8');
const inventory = fs.readFileSync(inventoryPath, 'utf8');

const migrationFiles = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort();
const marketStateName = '20260825104500_owner_inventory_market_state.sql';
const ownerCrudName = '20260826211500_owner_inventory_crud.sql';

assert.equal(
  migrationFiles.at(-1),
  ownerCrudName,
  'release gate knows only reviewed migrations through owner inventory CRUD; re-review any newer migration before release',
);
assert.ok(
  migrationFiles.indexOf(marketStateName) >= 0 && migrationFiles.indexOf(marketStateName) < migrationFiles.indexOf(ownerCrudName),
  'authoritative market-state migration must remain ordered before the owner CRUD migration',
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

// The later CRUD migration is intentionally reviewed here rather than weakening the
// ordering guard. Both SECURITY DEFINER commands must bind auth.uid(), keep a fixed
// search_path, reject non-owners, deny public/anon execute, and grant only authenticated.
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

assert.match(inventory, /load_my_inventory_market_states/i, 'mobile inventory must consume the authoritative RPC');
assert.match(inventory, /SOLD/i, 'mobile inventory must explicitly handle SOLD state');
assert.match(inventory, /update_private_device/i, 'mobile inventory must use the owner-safe update RPC');
assert.match(inventory, /delete_private_device/i, 'mobile inventory must use the owner-safe delete RPC');

console.log('owner market-state and CRUD release gate: OK');
