import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

const required = [
  "import { buildSaleStartSurface } from './src/lib/saleStartSurface';",
  'const sale = buildSaleStartSurface(item.id, null);',
  'const open = saleIntentItemId === item.id;',
  '{sale.valueLabel}',
  '{sale.actionLabel}',
  'setSaleIntentItemId(open ? null : item.id)',
  '{sale.privacyNotice}',
  'Things will not invent an asking price',
  'This private decision step does not create a listing.',
  'Selling always starts with an explicit private owner decision.',
];

for (const marker of required) {
  if (!app.includes(marker)) throw new Error(`Missing sale-start integration marker: ${marker}`);
}

if (app.includes('buildSaleStartSurface(item.id, 0)')) {
  throw new Error('Unknown value must not be converted to a zero-price estimate.');
}

console.log('sale-start app integration regression passed');
