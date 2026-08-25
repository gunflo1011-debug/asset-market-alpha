import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function transpile(relativePath) {
  return ts.transpileModule(fs.readFileSync(path.resolve(relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function evaluate(source, requireFn = () => { throw new Error('Unexpected require'); }) {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, requireFn);
  return module.exports;
}

const inventoryValue = evaluate(transpile('src/lib/inventoryValue.ts'));
const soldState = evaluate(transpile('src/lib/soldState.ts'), (request) => {
  if (request === './inventoryValue') return inventoryValue;
  throw new Error(`Unexpected require: ${request}`);
});
const soldSurface = evaluate(transpile('src/lib/soldItemSurface.ts'), (request) => {
  if (request === './soldState') return soldState;
  throw new Error(`Unexpected require: ${request}`);
});

const inventory = [
  { itemId: 'phone', estimatedValueCents: 45000 },
  { itemId: 'tablet', estimatedValueCents: 25000 },
  { itemId: 'unknown', estimatedValueCents: null },
];

const completed = soldSurface.completeSaleWithTrustSurface(inventory, 'phone');
assert.equal(completed.changed, true);
assert.equal(completed.surface.ownershipLabel, 'SOLD');
assert.equal(completed.surface.countedAsOwned, false);
assert.equal(completed.surface.countedInInventoryValue, false);
assert.equal(completed.surface.ownedItemCount, 2);
assert.equal(completed.surface.knownOwnedValueCents, 25000);
assert.equal(completed.surface.unvaluedOwnedItemCount, 1);
assert.match(completed.surface.ownershipMessage, /removed from owned inventory and total value/i);
assert.deepEqual(soldState.ownedInventoryItems(completed.items).map((item) => item.itemId), ['tablet', 'unknown']);
assert.equal(completed.valueSummary.knownValueCents, 25000);

const repeated = soldSurface.completeSaleWithTrustSurface(completed.items, 'phone');
assert.equal(repeated.changed, false);
assert.equal(repeated.surface.ownershipLabel, 'SOLD');
assert.equal(repeated.surface.knownOwnedValueCents, 25000);

const missing = soldSurface.completeSaleWithTrustSurface(inventory, 'not-present');
assert.equal(missing.changed, false);
assert.equal(missing.surface, null);
assert.equal(missing.valueSummary.knownValueCents, 70000);

console.log('sold-item trust surface regression: ok');
