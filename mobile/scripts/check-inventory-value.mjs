import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = path.resolve('src/lib/inventoryValue.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tempPath = path.join(os.tmpdir(), `things-inventory-value-${process.pid}.mjs`);
fs.writeFileSync(tempPath, transpiled);
const { summarizeInventoryValue, canShowTotalInventoryValue } = await import(pathToFileURL(tempPath).href);
fs.unlinkSync(tempPath);

const empty = summarizeInventoryValue([]);
assert.deepEqual(empty, {
  knownValueCents: 0,
  valuedItemCount: 0,
  unvaluedItemCount: 0,
  totalItemCount: 0,
  coveragePercent: 0,
});
assert.equal(canShowTotalInventoryValue(empty), false);

const partial = summarizeInventoryValue([
  { itemId: 'a', estimatedValueCents: 19900 },
  { itemId: 'b', estimatedValueCents: null },
  { itemId: 'c', estimatedValueCents: Number.NaN },
]);
assert.equal(partial.knownValueCents, 19900);
assert.equal(partial.valuedItemCount, 1);
assert.equal(partial.unvaluedItemCount, 2);
assert.equal(partial.coveragePercent, 33);
assert.equal(canShowTotalInventoryValue(partial), false);

const complete = summarizeInventoryValue([
  { itemId: 'a', estimatedValueCents: 19900 },
  { itemId: 'b', estimatedValueCents: 10100 },
]);
assert.equal(complete.knownValueCents, 30000);
assert.equal(complete.valuedItemCount, 2);
assert.equal(complete.unvaluedItemCount, 0);
assert.equal(complete.coveragePercent, 100);
assert.equal(canShowTotalInventoryValue(complete), true);

const invalid = summarizeInventoryValue([
  { itemId: 'a', estimatedValueCents: -1 },
  { itemId: 'b', estimatedValueCents: Number.POSITIVE_INFINITY },
]);
assert.equal(invalid.knownValueCents, 0);
assert.equal(invalid.valuedItemCount, 0);
assert.equal(invalid.unvaluedItemCount, 2);
assert.equal(canShowTotalInventoryValue(invalid), false);

console.log('inventory value regression: ok');
