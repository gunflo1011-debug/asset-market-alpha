import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const surface = read('src/lib/saleStartSurface.ts');

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
if (!screen.includes('Set asking price')) {
  throw new Error('Sale start must expose the asking-price step before publishing.');
}
if (!screen.includes('<SellListingPanel')) {
  throw new Error('Explicit sale intent must reveal the real owner listing panel.');
}
if (!/onPress=\{\(\)\s*=>\s*props\.onToggleSaleIntent\(item\.id\)\}/.test(screen)) {
  throw new Error('Sale start must require the explicit item action in the inventory screen.');
}
if (!/function\s+toggleSaleIntent\(itemId:\s*string\)[\s\S]*recordSellInitiated\(\)[\s\S]*setSaleIntentItemId/s.test(app)) {
  throw new Error('Sale initiation must be recorded only through explicit app orchestration.');
}
if (/buildSaleStartSurface\(item\.id\s*,\s*0\)/.test(screen)) {
  throw new Error('Unknown value must not be converted to a zero-price estimate.');
}
if (!screen.includes('item.value_evidence?.estimated_value_cents ?? null')) {
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
