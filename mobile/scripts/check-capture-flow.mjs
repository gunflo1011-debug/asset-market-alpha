import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/lib/captureFlow.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports });
const flow = module.exports;

assert.equal(flow.reconcileVariantSelection(null, ['a']), null, 'catalog load must not auto-select');
assert.equal(flow.reconcileVariantSelection('a', ['a', 'b']), 'a', 'valid explicit selection survives refresh');
assert.equal(flow.reconcileVariantSelection('a', ['b']), null, 'stale selection is cleared');
assert.equal(flow.canSaveCapture(null, false), false);
assert.equal(flow.canSaveCapture('a', false), true);
assert.equal(flow.canSaveCapture('a', true), false);
assert.equal(flow.captureStartedEvent(null, 'a'), 'ITEM_CAPTURE_STARTED');
assert.equal(flow.captureStartedEvent('a', 'b'), null, 'switching variants is not a new capture start');
assert.equal(flow.captureCompletedEvent(false), null, 'failed persistence must not complete capture');
assert.equal(flow.captureCompletedEvent(true), 'ITEM_CAPTURE_COMPLETED');
assert.equal(flow.selectionAfterSuccessfulCapture(), null);
assert.deepEqual([...flow.postCaptureRefreshTargets()], ['inventory'], 'successful capture refreshes inventory only');

const events = [flow.captureStartedEvent(null, 'a'), flow.captureCompletedEvent(true)].filter(Boolean);
assert.deepEqual(events, ['ITEM_CAPTURE_STARTED', 'ITEM_CAPTURE_COMPLETED']);
console.log(`capture-flow contract: ${13} assertions passed`);
