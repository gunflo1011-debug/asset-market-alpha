import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const transitions = fs.readFileSync(new URL('../src/lib/activationAppTransitions.ts', import.meta.url), 'utf8');
const executableTransitions = transitions
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');

for (const name of ['recordCaptureSuccess', 'recordInventoryVisible', 'recordValueVisible', 'recordSellInitiated']) {
  assert.match(transitions, new RegExp(`export function ${name}\\(\\): void`), `${name} must remain payload-free`);
  assert.match(app, new RegExp(`\\b${name}\\(`), `App.tsx must invoke ${name} from a real app transition`);
}

assert.match(app, /activationAppTransitions/, 'App.tsx must import the privacy-safe activation transition boundary');
assert.match(app, /await addPrivateDevice[\s\S]*recordCaptureSuccess\(/, 'capture success must be recorded only after private device creation succeeds');
assert.match(app, /setItems\(nextItems\)[\s\S]*recordInventoryVisible\(/, 'inventory visibility must follow successful inventory loading');
assert.match(app, /buildSaleStartSurface[\s\S]*recordValueVisible\(/, 'value visibility must be attached to the rendered truthful value surface');
assert.match(app, /onPress=\{\(\) => \{[\s\S]*recordSellInitiated\(\)[\s\S]*setSaleIntentItemId/, 'sell initiation must require the explicit owner tap');

for (const forbidden of ['user.id', 'item.id)', 'estimatedValueCents', 'deviceId', 'location', 'timestamp']) {
  assert.ok(!executableTransitions.includes(forbidden), `activation transition API must not accept or expose ${forbidden}`);
}

console.log('activation real-app wiring contract passed');
