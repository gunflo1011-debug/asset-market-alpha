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

const requiredOwnershipMarkers = [
  "client().rpc('load_my_inventory_market_states')",
  "if (marketState === 'SOLD') return [];",
  'Inventory ownership state is unavailable. Things will not show devices as currently owned until ownership can be verified.',
];

for (const marker of requiredOwnershipMarkers) {
  if (!inventory.includes(marker)) throw new Error(`Missing fail-closed ownership marker: ${marker}`);
}

if (app.includes('buildSaleStartSurface(item.id, 0)')) {
  throw new Error('Unknown value must never be converted to a zero-price estimate.');
}
if (/automatic(?:ally)?\s+(?:list|sale|sell)/i.test(app) && !app.includes('no automatic sale')) {
  throw new Error('Authenticated path must preserve explicit owner sale intent.');
}

console.log('authenticated ownership/value/sell convergence regression passed');
