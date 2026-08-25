import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260825104500_owner_inventory_market_state.sql';
const runbookPath = 'supabase/OWNER_MARKET_STATE_DEPLOY.md';
const inventoryPath = 'mobile/src/data/inventory.ts';

const migration = fs.readFileSync(migrationPath, 'utf8');
const runbook = fs.readFileSync(runbookPath, 'utf8');
const inventory = fs.readFileSync(inventoryPath, 'utf8');

const migrationFiles = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort();
assert.equal(migrationFiles.at(-1), '20260825104500_owner_inventory_market_state.sql', 'approval target must remain the latest migration; otherwise re-review pending migration ordering');

assert.match(runbook, /Approval authorizes \*\*one hosted schema mutation only\*\*/i);
assert.match(runbook, /Do not .*apply unrelated pending migrations/i);
assert.match(runbook, /node scripts\/check-owner-market-state-migration\.mjs/i);
assert.match(runbook, /Authenticated user A can execute/i);
assert.match(runbook, /item owned by user B is never returned to A/i);
assert.match(runbook, /Anonymous execution is denied/i);
assert.match(runbook, /mobile inventory load succeeds for A and excludes returned `SOLD` items/i);
assert.match(runbook, /revoke all on function public\.load_my_inventory_market_states\(\) from public, anon, authenticated;/i);
assert.match(runbook, /drop function if exists public\.load_my_inventory_market_states\(\);/i);

assert.match(migration, /where i\.owner_id = auth\.uid\(\)/i);
assert.match(migration, /revoke all on function public\.load_my_inventory_market_states\(\) from public, anon/i);
assert.match(migration, /grant execute on function public\.load_my_inventory_market_states\(\) to authenticated/i);

assert.match(inventory, /load_my_inventory_market_states/i, 'mobile inventory must consume the authoritative RPC');
assert.match(inventory, /SOLD/i, 'mobile inventory must explicitly handle SOLD state');

console.log('owner market-state release gate: OK');
