import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = path.resolve('src/lib/valueToSell.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tempPath = path.join(os.tmpdir(), `things-value-to-sell-${process.pid}.mjs`);
fs.writeFileSync(tempPath, transpiled);
const { createSellIntent } = await import(pathToFileURL(tempPath).href);
fs.unlinkSync(tempPath);

assert.deepEqual(createSellIntent({ itemId: 'known', estimatedValueCents: 19900 }), {
  itemId: 'known',
  referenceValueCents: 19900,
  valueEvidence: 'KNOWN',
});

for (const estimatedValueCents of [null, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const intent = createSellIntent({ itemId: 'unknown', estimatedValueCents });
  assert.deepEqual(intent, {
    itemId: 'unknown',
    referenceValueCents: null,
    valueEvidence: 'UNKNOWN',
  });
}

assert.deepEqual(createSellIntent({ itemId: 'rounded', estimatedValueCents: 19900.4 }), {
  itemId: 'rounded',
  referenceValueCents: 19900,
  valueEvidence: 'KNOWN',
});

console.log('value-to-sell regression: ok');
