import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/lib/inventoryValueSurface.ts', import.meta.url), 'utf8');

for (const required of [
  "summarizeInventoryValue(items)",
  "Known inventory value:",
  "Total inventory value:",
  "Unknown values are not counted as €0.",
  "summary.unvaluedItemCount > 0",
  "summary.knownValueCents / 100",
]) {
  if (!source.includes(required)) throw new Error(`inventory value surface missing contract: ${required}`);
}

if (/estimatedValueCents\s*\?\?\s*0/.test(source)) {
  throw new Error('Unknown inventory values must never be coerced to zero.');
}

console.log('inventory value surface regression passed');
