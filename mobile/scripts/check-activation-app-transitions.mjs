import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/lib/activationAppTransitions.ts', import.meta.url), 'utf8');

for (const stage of ['CAPTURE_SUCCESS', 'INVENTORY_VISIBLE', 'VALUE_VISIBLE', 'SELL_INITIATED']) {
  assert.match(source, new RegExp(`recordActivationTransition\\('${stage}'\\)`), `${stage} must use the ordered local bridge`);
}

assert.match(source, /exportLocalActivationSummary\(\)/, 'debug export must use the coarse local summary');
for (const forbidden of ['fetch(', 'supabase', 'AsyncStorage', 'userId', 'itemId', 'price', 'timestamp', 'location', 'deviceId']) {
  assert.equal(source.includes(forbidden), false, `activation app transitions must not contain ${forbidden}`);
}

console.log('activation app-transition contract ok');
