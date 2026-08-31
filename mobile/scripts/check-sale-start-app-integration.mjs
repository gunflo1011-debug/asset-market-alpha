import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const surface = read('src/lib/saleStartSurface.ts');
const listingPanel = read('src/features/marketplace/SellListingPanel.tsx');

for (const marker of [
  'buildSaleStartSurface(item.id, item.value_evidence?.estimated_value_cents ?? null)',
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
if (!screen.includes('Your item stays private until you publish it.')) {
  throw new Error('Sale start must visibly preserve private-by-default marketplace consent.');
}
if (!listingPanel.includes("published ? 'New marketplace price (€)' : 'Seller asking price (€)'") || !listingPanel.includes('Publish${parsed.valid ? ` at ${euro(parsed.cents)}` : \'\'}')) {
  throw new Error('Sale start must expose an explicit seller-controlled asking-price step before marketplace publishing.');
}
if (!listingPanel.includes('reference only · never auto-published')) {
  throw new Error('Personal estimate must remain reference-only and must never be presented as an automatic listing price.');
}
if (!listingPanel.includes('THINGS MARKET VALUE') || !listingPanel.includes('Use price') || !listingPanel.includes('setPrice(String(suggestedMarketPrice / 100))')) {
  throw new Error('Market Value may suggest a price only through an explicit seller action.');
}
if (!listingPanel.includes('Market Value and Personal Estimate are references only and are never copied into the listing automatically.')) {
  throw new Error('Market guidance must remain separate from the seller-controlled listing price.');
}
if (!listingPanel.includes('BUYERS CURRENTLY SEE') || !listingPanel.includes('listing?.asking_price_cents ?? null')) {
  throw new Error('Published Marketplace price must be rendered from the persisted listing source of truth.');
}
if (!listingPanel.includes("const [price, setPrice] = useState('')")) {
  throw new Error('Seller asking price must start empty instead of inheriting any estimate or market suggestion.');
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
if (!surface.includes('Estimate pending')) {
  throw new Error('Sale-start surface must represent missing evidence as a pending estimate without inventing a value.');
}

console.log('sale-start app integration regression passed');
