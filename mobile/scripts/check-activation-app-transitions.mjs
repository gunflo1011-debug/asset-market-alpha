import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/lib/activationAppTransitions.ts', import.meta.url), 'utf8');

for (const stage of ['CAPTURE_SUCCESS', 'INVENTORY_VISIBLE', 'VALUE_VISIBLE', 'SELL_INITIATED']) {
  assert.match(source, new RegExp(`recordActivationTransition\\('${stage}'\\)`), `${stage} must use the ordered local bridge`);
}

assert.match(source, /exportLocalActivationSummary\(\)/, 'debug export must use the coarse local summary');

// Privacy checks apply to executable code, not comments that document which
// sensitive fields are deliberately excluded from these process-local hooks.
const executableSource = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');

for (const forbidden of ['fetch(', 'supabase', 'AsyncStorage', 'userId', 'itemId', 'price', 'timestamp', 'location', 'deviceId']) {
  assert.equal(executableSource.includes(forbidden), false, `activation app transitions must not contain ${forbidden}`);
}

console.log('activation app-transition contract ok');
