import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const surface = read('src/lib/saleStartSurface.ts');
const listingPanel = read('src/features/marketplace/SellListingPanel.tsx');

for (const marker of [
  'buildSaleStartSurface(item.id, item.value_evidence?.estimated_value_cents ?? null)',
  '{sale.privacyNotice}',
]) {
  if (!screen.replace(/\s+/g, '').includes(marker.replace(/\s+/g, ''))) {
    throw new Error(`Missing sale-start screen contract: ${marker}`);
  }
}

if (!screen.includes("sale.valueLabel.replace('Estimated value ', '')")) {
  throw new Error('Sale-start value must still be rendered even when the UI removes the repeated label prefix.');
}
if (!screen.includes('<SellListingPanel')) {
  throw new Error('Explicit sale intent must reveal the real owner listing panel.');
}
if (!listingPanel.includes('Asking price (€)') || !listingPanel.includes('Publish on marketplace')) {
  throw new Error('Sale start must expose an asking-price step before explicit marketplace publishing.');
}
if (!listingPanel.includes('Nothing becomes visible to other users until you explicitly publish.')) {
  throw new Error('Listing panel must preserve explicit owner consent before marketplace visibility.');
}
if (!/onPress=\{\(\)\s*=>\s*props\.onToggleSaleIntent\((?:item|selectedItem)\.id\)\}/.test(screen)) {
  throw new Error('Sale start must require an explicit owner action in the inventory screen.');
}
if (!/function\s+toggleSaleIntent\(itemId:\s*string\)[\s\S]*recordSellInitiated\(\)[\s\S]*setSaleIntentItemId/s.test(app)) {
  throw new Error('Sale initiation must be recorded only through explicit app orchestration.');
}
if (/buildSaleStartSurface\([^,]+,\s*0\)/.test(screen)) {
  throw new Error('Unknown value must not be converted to a zero-price estimate.');
}
if (!screen.includes('value_evidence?.estimated_value_cents ?? null')) {
  throw new Error('Inventory value evidence must feed the private-sale reference value while unknown remains null.');
}
if (!/estimatedValueCents:\s*number\s*\|\s*null/.test(surface)) {
  throw new Error('Sale-start surface must model unknown value explicitly as null.');
}
if (!surface.includes('Nothing is listed or sold until you explicitly continue.')) {
  throw new Error('Sale-start surface must preserve explicit owner consent before listing or selling.');
}
if (!surface.includes('Estimated value not available yet')) {
  throw new Error('Sale-start surface must not invent a value when evidence is unknown.');
}

console.log('sale-start app integration regression passed');
