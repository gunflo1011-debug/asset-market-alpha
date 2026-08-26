import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/activationActionBridge.ts', import.meta.url), 'utf8');
const executableSource = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

for (const expected of [
  "'CAPTURE_SUCCESS'",
  "'INVENTORY_VISIBLE'",
  "'VALUE_VISIBLE'",
  "'SELL_INITIATED'",
  'snapshot.counts[prerequisite] < 1',
  'snapshot.counts[name] > 0',
  'recordLocalActivation(name)',
]) {
  assert.ok(executableSource.includes(expected), `missing ordered/deduplicated bridge contract: ${expected}`);
}

for (const forbidden of ['fetch(', 'AsyncStorage', 'supabase', 'userId', 'itemId', 'price', 'timestamp', 'location']) {
  assert.ok(!executableSource.includes(forbidden), `activation action bridge must stay process-local/privacy-minimal: ${forbidden}`);
}

console.log('activation action bridge contract ok');
