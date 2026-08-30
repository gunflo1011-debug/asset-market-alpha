import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const saleSurface = read('src/lib/saleStartSurface.ts');
const listingPanel = read('src/features/marketplace/SellListingPanel.tsx');
const marketplaceScreen = read('src/features/marketplace/MarketplaceScreen.tsx');
const inventory = [
  read('src/data/inventory.ts'),
  read('src/data/inventoryQueries.ts'),
  read('src/data/inventoryCommands.ts'),
].join('\n');

const requiredScreenSemantics = [
  '<Text style={styles.metric}>{props.items.length}</Text>',
  'value_evidence?.estimated_value_cents ?? null',
  "sale.valueLabel.replace('Estimated value ', '')",
  'summarizeInventoryValue',
  '<SellListingPanel',
];
for (const marker of requiredScreenSemantics) {
  if (!screen.replace(/\s+/g, '').includes(marker.replace(/\s+/g, ''))) {
    throw new Error(`Missing authenticated product-convergence semantic: ${marker}`);
  }
}
if (!/const\s+saleOpen\s*=\s*props\.saleIntentItemId\s*===\s*selectedItem\.id/.test(screen)) {
  throw new Error('Selected-item detail must derive selling visibility from explicit sale-intent state.');
}
if (!/onPress=\{\(\)\s*=>\s*props\.onToggleSaleIntent\(selectedItem\.id\)\}/.test(screen)) {
  throw new Error('Selected-item detail must require an explicit owner action to toggle selling.');
}
if (!listingPanel.includes('Asking price (€)') || !listingPanel.includes('Publish on marketplace')) {
  throw new Error('Authenticated sell convergence must include an asking-price step and explicit publish action.');
}
if (!listingPanel.includes('Nothing becomes visible to other users until you explicitly publish.')) {
  throw new Error('Marketplace convergence must preserve explicit owner consent before visibility.');
}
if (!listingPanel.includes('Marketplace location (optional)') || !listingPanel.includes('Things never copies your private inventory location automatically.')) {
  throw new Error('Marketplace convergence must keep coarse location optional and separate from private inventory location.');
}
if (!marketplaceScreen.includes('location not shared') || !marketplaceScreen.includes('exact address hidden')) {
  throw new Error('Marketplace buyer surfaces must distinguish optional coarse location from hidden exact location.');
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
if (!saleSurface.includes('Estimate pending')) {
  throw new Error('Unknown inventory value must remain explicit as a pending estimate.');
}

const compactInventory = inventory.replace(/\s+/g, '');
if (!compactInventory.includes("rpc('load_my_inventory_market_states')")) {
  throw new Error('Missing authoritative market-state lookup for catalog-backed devices.');
}
if (!compactInventory.includes("rpc('load_my_inventory_values')")) {
  throw new Error('Missing authenticated owner-scoped value-evidence lookup for inventory.');
}
const hasListingWrite = compactInventory.includes("rpc('save_my_marketplace_listing_v2'") || compactInventory.includes("rpc('save_my_marketplace_listing'");
const hasMarketplaceRead = compactInventory.includes("rpc('load_marketplace_v2')") || compactInventory.includes("rpc('load_marketplace_v1')");
if (!hasListingWrite || !hasMarketplaceRead) {
  throw new Error('Marketplace convergence requires owner-controlled listing writes and the filtered marketplace read RPC.');
}
if (compactInventory.includes("rpc('save_my_marketplace_listing_v2'") && !compactInventory.includes('p_public_location:publicLocation?.trim()||null')) {
  throw new Error('Marketplace v2 listing writes must send only the explicit seller-entered public location.');
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

if (/buildSaleStartSurface\([^,]+,\s*0\)/.test(screen)) {
  throw new Error('Unknown value must never be converted to a zero-price estimate.');
}

console.log('authenticated ownership/value/sell convergence regression passed');
