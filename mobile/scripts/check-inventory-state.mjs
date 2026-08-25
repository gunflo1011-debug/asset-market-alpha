import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/data/inventory.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
const require = (id) => {
  if (id.endsWith('/supabase')) return { supabase: null };
  if (id.endsWith('/analytics')) return { trackAlphaEvent: () => Promise.resolve() };
  throw new Error(`Unexpected dependency: ${id}`);
};
vm.runInNewContext(compiled, { module, exports: module.exports, require });

const { latestConditionFirst } = module.exports;
const older = { captured_at: '2026-08-24T10:00:00Z', housing_state: 'HEAVY_WEAR' };
const newest = { captured_at: '2026-08-25T10:00:00Z', housing_state: 'CLEAN' };
const middle = { captured_at: '2026-08-24T18:00:00Z', housing_state: 'LIGHT_WEAR' };
const input = [{ id: 'item-1', condition_snapshots: [older, newest, middle] }];

const result = latestConditionFirst(input);
assert.equal(result[0].condition_snapshots[0].housing_state, 'CLEAN', 'inventory must expose newest condition first');
assert.deepEqual(
  [...result[0].condition_snapshots.map((snapshot) => snapshot.captured_at)],
  [newest.captured_at, middle.captured_at, older.captured_at],
  'all snapshots remain available in descending capture order',
);
assert.equal(input[0].condition_snapshots[0].housing_state, 'HEAVY_WEAR', 'normalization must not mutate query results');
assert.deepEqual(latestConditionFirst([{ id: 'item-2', condition_snapshots: [] }])[0].condition_snapshots, []);

console.log('inventory-state regression: 4 assertions passed');
