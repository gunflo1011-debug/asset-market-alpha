import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const surface = fs.readFileSync(new URL('../src/lib/saleStartSurface.ts', import.meta.url), 'utf8');

const appContracts = [
  ["import { buildSaleStartSurface } from './src/lib/saleStartSurface';", 'app must import the sale-start surface'],
  ['{sale.valueLabel}', 'app must render sale value evidence'],
  ['{sale.actionLabel}', 'app must render the explicit sale action'],
  ['{sale.privacyNotice}', 'app must render the privacy notice'],
];

for (const [marker, description] of appContracts) {
  if (!app.includes(marker)) throw new Error(`Missing sale-start integration contract: ${description}`);
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
