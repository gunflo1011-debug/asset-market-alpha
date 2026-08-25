import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/localActivationCollector.ts', import.meta.url), 'utf8');

for (const expected of [
  "recordLocalActivation(name: ActivationEventName)",
  "events.push(activationEvent(name))",
  "aggregateActivationFunnel(events)",
  "resetLocalActivation()",
]) {
  assert.ok(source.includes(expected), `missing collector contract: ${expected}`);
}

for (const forbidden of ['fetch(', 'AsyncStorage', 'supabase', 'userId', 'itemId', 'timestamp', 'location']) {
  assert.ok(!source.includes(forbidden), `collector must stay local/privacy-minimal: ${forbidden}`);
}

console.log('local activation collector contract ok');
