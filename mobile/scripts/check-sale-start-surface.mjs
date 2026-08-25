import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/saleStartSurface.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
}).outputText.replace("from './valueToSell'", "from './valueToSell.mjs'");
const valueSource = fs.readFileSync(new URL('../src/lib/valueToSell.ts', import.meta.url), 'utf8');
const valueJs = ts.transpileModule(valueSource, {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
}).outputText;

const tempDir = new URL('./.tmp-sale-start/', import.meta.url);
fs.mkdirSync(tempDir, { recursive: true });
fs.writeFileSync(new URL('valueToSell.mjs', tempDir), valueJs);
fs.writeFileSync(new URL('saleStartSurface.mjs', tempDir), js);
const { buildSaleStartSurface } = await import(new URL(`saleStartSurface.mjs?${Date.now()}`, tempDir));

const known = buildSaleStartSurface('item-1', 12345.4);
assert.equal(known.intent.itemId, 'item-1');
assert.equal(known.intent.referenceValueCents, 12345);
assert.equal(known.intent.valueEvidence, 'KNOWN');
assert.equal(known.valueLabel, 'Estimated value €123.45');
assert.equal(known.actionLabel, 'Start selling');
assert.match(known.privacyNotice, /Nothing is listed or sold/);

const unknown = buildSaleStartSurface('item-2', null);
assert.equal(unknown.intent.referenceValueCents, null);
assert.equal(unknown.intent.valueEvidence, 'UNKNOWN');
assert.equal(unknown.valueLabel, 'Estimated value not available yet');
assert.equal(unknown.actionLabel, 'Start selling');

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('sale-start surface regression: ok');
