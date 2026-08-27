import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const inventory = fs.readFileSync(new URL('../src/data/inventory.ts', import.meta.url), 'utf8');

const requiredAppMarkers = [
  '<Text style={styles.metric}>{items.length}</Text>',
  'Total known inventory value: unavailable until verified value evidence exists.',
  'Unknown values are never counted as €0.',
  'const sale = buildSaleStartSurface(item.id, null);',
  '{sale.valueLabel}',
  '{sale.actionLabel}',
  'setSaleIntentItemId(open ? null : item.id)',
  'This private decision step does not create a listing.',
  'Selling always starts with an explicit private owner decision.',
];

for (const marker of requiredAppMarkers) {
  if (!app.includes(marker)) throw new Error(`Missing authenticated product-convergence marker: ${marker}`);
}

if (!inventory.includes("client().rpc('load_my_inventory_market_states')")) {
  throw new Error('Missing authoritative market-state lookup for catalog-backed devices.');
}

// Generic Things are directly owner-scoped by items RLS and may legitimately have no
// market-state row. Catalog-backed devices must remain fail-closed when the market-state
// RPC is unavailable or returns no state, otherwise SOLD/missing ownership evidence could
// silently reappear in the authenticated inventory.
const fullFailClosedOnRpcError = /if\s*\(\s*marketStateResult\.error\s*\)\s*throw\b/s;
const discriminatedRpcFailClosed = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,240}if\s*\(\s*isCatalogDevice\s*&&\s*marketStateResult\.error\s*\)\s*return\s*\[\]\s*;/s;
if (!fullFailClosedOnRpcError.test(inventory) && !discriminatedRpcFailClosed.test(inventory)) {
  throw new Error('Market-state RPC failure must fail closed for catalog-backed devices.');
}

const legacyExplicitFilter = /const\s+(?:marketState|state)\s*=\s*marketStates\.get\(item\.id\)\s*;\s*if\s*\(\s*!(?:marketState|state)\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*(?:marketState|state)\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
const legacyCompactFilter = /const\s+state\s*=\s*marketStates\.get\(item\.id\)\s*;\s*return\s*!state\s*\|\|\s*state\s*===\s*['"]SOLD['"]\s*\?\s*\[\]\s*:/s;
const discriminatedDeviceFilter = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,360}const\s+state\s*=\s*marketStates\.get\(item\.id\)[^;]*;[\s\S]{0,160}if\s*\(\s*isCatalogDevice\s*&&\s*!state\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*state\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
if (!legacyExplicitFilter.test(inventory) && !legacyCompactFilter.test(inventory) && !discriminatedDeviceFilter.test(inventory)) {
  throw new Error('Inventory must exclude SOLD devices and catalog-backed devices without authoritative market state.');
}

for (const marker of ['add_private_thing', 'update_private_thing', 'delete_private_thing']) {
  if (!inventory.includes(marker)) throw new Error(`Missing generic Thing lifecycle command: ${marker}`);
}

if (app.includes('buildSaleStartSurface(item.id, 0)')) {
  throw new Error('Unknown value must never be converted to a zero-price estimate.');
}
if (/automatic(?:ally)?\s+(?:list|sale|sell)/i.test(app) && !app.includes('no automatic sale')) {
  throw new Error('Authenticated path must preserve explicit owner sale intent.');
}

console.log('authenticated ownership/value/sell convergence regression passed');
