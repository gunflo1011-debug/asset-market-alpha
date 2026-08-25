import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve('src/lib/soldState.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const inventorySource = fs.readFileSync(path.resolve('src/lib/inventoryValue.ts'), 'utf8');
const inventoryTranspiled = ts.transpileModule(inventorySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const inventoryModule = { exports: {} };
new Function('module', 'exports', inventoryTranspiled)(inventoryModule, inventoryModule.exports);

const soldModule = { exports: {} };
const localRequire = (request) => {
  if (request === './inventoryValue') return inventoryModule.exports;
  throw new Error(`Unexpected require: ${request}`);
};
new Function('module', 'exports', 'require', transpiled)(soldModule, soldModule.exports, localRequire);
const { markItemSold, ownedInventoryItems } = soldModule.exports;

const inventory = [
  { itemId: 'camera', estimatedValueCents: 12000 },
  { itemId: 'bike', estimatedValueCents: 8000 },
  { itemId: 'mystery', estimatedValueCents: null },
];

const result = markItemSold(inventory, 'camera');
assert.equal(result.changed, true);
assert.equal(result.items.find((item) => item.itemId === 'camera').ownershipState, 'sold');
assert.deepEqual(ownedInventoryItems(result.items).map((item) => item.itemId), ['bike', 'mystery']);
assert.equal(result.valueSummary.knownValueCents, 8000);
assert.equal(result.valueSummary.totalItemCount, 2);
assert.equal(result.valueSummary.valuedItemCount, 1);
assert.equal(result.valueSummary.unvaluedItemCount, 1);

const repeated = markItemSold(result.items, 'camera');
assert.equal(repeated.changed, false);
assert.equal(repeated.valueSummary.knownValueCents, 8000);

const missing = markItemSold(inventory, 'not-present');
assert.equal(missing.changed, false);
assert.equal(missing.valueSummary.knownValueCents, 20000);
assert.equal(missing.valueSummary.totalItemCount, 3);

console.log('sold-state consistency regression: ok');
