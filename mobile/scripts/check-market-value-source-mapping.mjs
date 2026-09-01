import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/data/inventoryQueries.ts', import.meta.url), 'utf8');

for (const expected of [
  "row.source === 'SOLD_GTIN_MEDIAN'",
  "row.source === 'ACTIVE_GTIN_MEDIAN'",
  "? 'SOLD_MEDIAN'",
  "? 'ACTIVE_MEDIAN'",
]) {
  if (!source.includes(expected)) {
    throw new Error(`Market Value source regression: missing ${expected}`);
  }
}

if (!source.includes("'INSUFFICIENT_DATA'")) {
  throw new Error('Market Value source regression: fail-closed insufficient-data fallback missing.');
}

console.log('Market Value GTIN source mapping regression OK');
