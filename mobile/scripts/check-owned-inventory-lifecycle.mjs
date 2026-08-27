import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/data/inventory.ts'), 'utf8');

assert.match(source, /rpc\(['"]load_my_inventory_market_states['"]\)/, 'catalog-backed inventory must load authoritative market state');

// Generic Things (variant/product is null) are owned directly by the items-row RLS boundary
// and therefore do not need a market-state row. Catalog-backed devices do need authoritative
// market state so SOLD/missing ownership evidence can never silently reappear.
const fullFailClosedOnRpcError = /if\s*\(\s*marketStateResult\.error\s*\)\s*throw\b/s;
const genericOnlyFallbackOnRpcError = /if\s*\(\s*marketStateResult\.error\s*\)[\s\S]{0,500}(?:product_variants|variant_id)[\s\S]{0,500}(?:filter|flatMap|return)/s;
assert.ok(
  fullFailClosedOnRpcError.test(source) || genericOnlyFallbackOnRpcError.test(source),
  'market-state RPC failure must fail closed for catalog-backed devices; at most owner-RLS generic Things may remain visible',
);

// Accept the legacy stricter shape (all items without market state excluded) or the new
// discriminated shape (generic Things may have null state, catalog-backed devices may not).
const legacyExplicitFilter = /const\s+(?:marketState|state)\s*=\s*marketStates\.get\(item\.id\)\s*;\s*if\s*\(\s*!(?:marketState|state)\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*(?:marketState|state)\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
const legacyCompactFilter = /const\s+state\s*=\s*marketStates\.get\(item\.id\)\s*;\s*return\s*!state\s*\|\|\s*state\s*===\s*['"]SOLD['"]\s*\?\s*\[\]\s*:/s;
const discriminatedDeviceFilter = /const\s+state\s*=\s*marketStates\.get\(item\.id\)[\s\S]{0,240}(?:item\.product_variants|item\.variant_id)[\s\S]{0,120}!state[\s\S]{0,120}return\s*\[\][\s\S]{0,220}state\s*===\s*['"]SOLD['"]/s;
assert.ok(
  legacyExplicitFilter.test(source) || legacyCompactFilter.test(source) || discriminatedDeviceFilter.test(source),
  'owned inventory must exclude SOLD devices and must never return a catalog-backed device without authoritative market state',
);

assert.match(source, /add_private_thing/, 'generic Thing create command must remain wired');
assert.match(source, /update_private_thing/, 'generic Thing update command must remain wired');
assert.match(source, /delete_private_thing/, 'generic Thing delete command must remain wired');

console.log('owned-inventory lifecycle regression: ok');
