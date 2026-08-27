import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

const required = [
  "import { buildSaleStartSurface } from './src/lib/saleStartSurface';",
  '{sale.valueLabel}',
  '{sale.actionLabel}',
  '{sale.privacyNotice}',
  'Things will not invent an asking price',
  'This private decision step does not create a listing.',
  'Selling always starts with an explicit private owner decision.',
];

for (const marker of required) {
  if (!app.includes(marker)) throw new Error(`Missing sale-start integration marker: ${marker}`);
}

const semanticContracts = [
  [/buildSaleStartSurface\(item\.id\s*,\s*null\)/, 'sale start must preserve unknown value as null'],
  [/saleIntentItemId\s*===\s*item\.id/, 'sale decision must be scoped to the selected item'],
  [/setSaleIntentItemId\(open\s*\?\s*null\s*:\s*item\.id\)/, 'sale action must explicitly toggle the selected item'],
];

for (const [pattern, description] of semanticContracts) {
  if (!pattern.test(app)) throw new Error(`Missing sale-start semantic contract: ${description}`);
}

if (/buildSaleStartSurface\(item\.id\s*,\s*0\)/.test(app)) {
  throw new Error('Unknown value must not be converted to a zero-price estimate.');
}

console.log('sale-start app integration regression passed');
