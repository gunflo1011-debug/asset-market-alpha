import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const source = [
  read('src/data/inventory.ts'),
  read('src/data/inventoryQueries.ts'),
  read('src/data/inventoryCommands.ts'),
].join('\n');

assert.match(source, /rpc\(['"]load_my_inventory_market_states['"]\)/, 'catalog-backed inventory must load authoritative market state');

const fullFailClosedOnRpcError = /if\s*\(\s*marketStateResult\.error\s*\)\s*throw\b/s;
const discriminatedRpcFailClosed = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,240}if\s*\(\s*isCatalogDevice\s*&&\s*marketStateResult\.error\s*\)\s*return\s*\[\]\s*;/s;
assert.ok(
  fullFailClosedOnRpcError.test(source) || discriminatedRpcFailClosed.test(source),
  'market-state RPC failure must fail closed for catalog-backed devices; at most owner-RLS generic Things may remain visible',
);

const legacyExplicitFilter = /const\s+(?:marketState|state)\s*=\s*marketStates\.get\(item\.id\)\s*;\s*if\s*\(\s*!(?:marketState|state)\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*(?:marketState|state)\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
const legacyCompactFilter = /const\s+state\s*=\s*marketStates\.get\(item\.id\)\s*;\s*return\s*!state\s*\|\|\s*state\s*===\s*['"]SOLD['"]\s*\?\s*\[\]\s*:/s;
const discriminatedDeviceFilter = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,360}const\s+state\s*=\s*marketStates\.get\(item\.id\)[^;]*;[\s\S]{0,160}if\s*\(\s*isCatalogDevice\s*&&\s*!state\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*state\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
assert.ok(
  legacyExplicitFilter.test(source) || legacyCompactFilter.test(source) || discriminatedDeviceFilter.test(source),
  'owned inventory must exclude SOLD devices and must never return a catalog-backed device without authoritative market state',
);

assert.match(source, /add_private_thing/, 'generic Thing create command must remain wired');
assert.match(source, /update_private_thing/, 'generic Thing update command must remain wired');
assert.match(source, /delete_private_thing/, 'generic Thing delete command must remain wired');

console.log('owned-inventory lifecycle regression: ok');
