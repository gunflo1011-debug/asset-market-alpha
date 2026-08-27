import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const inventoryScreen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');
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
assert.match(inventoryScreen, /buildSaleStartSurface\(item\.id,\s*null\)/, 'truthful value surface must remain attached to rendered inventory items');
assert.match(app, /function\s+toggleSaleIntent\(itemId:\s*string\)[\s\S]*recordSellInitiated\(\)[\s\S]*setSaleIntentItemId/s, 'sell initiation must require explicit app orchestration');
assert.match(inventoryScreen, /onPress=\{\(\)\s*=>\s*props\.onToggleSaleIntent\(item\.id\)\}/, 'sell initiation must originate from the explicit owner tap');

for (const forbidden of ['user.id', 'item.id)', 'estimatedValueCents', 'deviceId', 'location', 'timestamp']) {
  assert.ok(!executableTransitions.includes(forbidden), `activation transition API must not accept or expose ${forbidden}`);
}

console.log('activation real-app wiring contract passed');
