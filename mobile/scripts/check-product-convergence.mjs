import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const saleSurface = read('src/lib/saleStartSurface.ts');
const inventory = [
  read('src/data/inventory.ts'),
  read('src/data/inventoryQueries.ts'),
  read('src/data/inventoryCommands.ts'),
].join('\n');

const requiredScreenSemantics = [
  '<Text style={styles.metric}>{props.items.length}</Text>',
  'item.value_evidence?.estimated_value_cents ?? null',
  '{sale.valueLabel}',
  '{sale.actionLabel}',
  'props.saleIntentItemId === item.id',
  'summarizeInventoryValue',
];
for (const marker of requiredScreenSemantics) {
  if (!screen.replace(/\s+/g, '').includes(marker.replace(/\s+/g, ''))) {
    throw new Error(`Missing authenticated product-convergence semantic: ${marker}`);
  }
}
if (!/function\s+toggleSaleIntent\(itemId:\s*string\)[\s\S]*setSaleIntentItemId/s.test(app)) {
  throw new Error('App shell must own the selected sale-intent state transition.');
}

if (!saleSurface.includes('estimatedValueCents: number | null')) {
  throw new Error('Sale surface must preserve unknown value evidence as nullable.');
}
if (!saleSurface.includes('Nothing is listed or sold until you explicitly continue.')) {
  throw new Error('Sale surface must preserve explicit owner intent before listing or selling.');
}
if (!saleSurface.includes('Estimated value not available yet')) {
  throw new Error('Unknown inventory value must remain explicitly unavailable.');
}

if (!inventory.includes("rpc('load_my_inventory_market_states')")) {
  throw new Error('Missing authoritative market-state lookup for catalog-backed devices.');
}
if (!inventory.includes("rpc('load_my_inventory_value_evidence')")) {
  throw new Error('Missing authenticated verified value-evidence lookup for inventory.');
}

const fullFailClosedOnRpcError = /if\s*\(\s*marketStateResult\.error\s*\)\s*throw\b/s;
const discriminatedRpcFailClosed = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,240}if\s*\(\s*isCatalogDevice\s*&&\s*marketStateResult\.error\s*\)\s*return\s*\[\]\s*;/s;
if (!fullFailClosedOnRpcError.test(inventory) && !discriminatedRpcFailClosed.test(inventory)) {
  throw new Error('Market-state RPC failure must fail closed for catalog-backed devices.');
}

const discriminatedDeviceFilter = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,360}const\s+state\s*=\s*marketStates\.get\(item\.id\)[^;]*;[\s\S]{0,160}if\s*\(\s*isCatalogDevice\s*&&\s*!state\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*state\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
if (!discriminatedDeviceFilter.test(inventory)) {
  throw new Error('Inventory must exclude SOLD devices and catalog-backed devices without authoritative market state.');
}

for (const marker of ['add_private_thing', 'update_private_thing', 'delete_private_thing']) {
  if (!inventory.includes(marker)) throw new Error(`Missing generic Thing lifecycle command: ${marker}`);
}

if (/buildSaleStartSurface\(item\.id\s*,\s*0\)/.test(screen)) {
  throw new Error('Unknown value must never be converted to a zero-price estimate.');
}

console.log('authenticated ownership/value/sell convergence regression passed');
