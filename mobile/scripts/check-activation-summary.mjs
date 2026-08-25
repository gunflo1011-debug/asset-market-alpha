import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/activationSummary.ts', import.meta.url), 'utf8');

for (const expected of [
  "'CAPTURE_SUCCESS'",
  "'INVENTORY_VISIBLE'",
  "'VALUE_VISIBLE'",
  "'SELL_INITIATED'",
  'highestReachedStage',
  'completed: stages.every',
  'JSON.stringify(getLocalActivationSummary())',
  'getLocalActivationSnapshot()',
]) {
  assert.ok(source.includes(expected), `missing activation summary contract: ${expected}`);
}

for (const forbidden of [
  'fetch(',
  'AsyncStorage',
  'supabase',
  'userId',
  'itemId',
  'price',
  'estimatedValue',
  'timestamp',
  'location',
  'deviceId',
]) {
  assert.ok(!source.includes(forbidden), `activation summary must remain privacy-minimal/process-local: ${forbidden}`);
}

const order = [
  source.indexOf("'CAPTURE_SUCCESS'"),
  source.indexOf("'INVENTORY_VISIBLE'"),
  source.indexOf("'VALUE_VISIBLE'"),
  source.indexOf("'SELL_INITIATED'"),
];
assert.ok(order.every((index) => index >= 0), 'all funnel stages must exist');
assert.deepEqual([...order].sort((a, b) => a - b), order, 'funnel stages must remain ordered');

console.log('activation summary contract ok');
