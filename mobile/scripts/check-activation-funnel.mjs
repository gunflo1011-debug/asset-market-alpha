import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/activationFunnel.ts'), 'utf8');

for (const name of ['CAPTURE_SUCCESS', 'INVENTORY_VISIBLE', 'VALUE_VISIBLE', 'SELL_INITIATED']) {
  assert.match(source, new RegExp(`${name}:`), `metric definition missing for ${name}`);
}

assert.match(source, /counts\[event\.name\] \+= 1/, 'events must aggregate as deterministic counts');
assert.match(source, /event\.schemaVersion !== 1/, 'unknown schema versions must be ignored');
assert.match(source, /contains only event-name counts/, 'privacy boundary must be documented');

for (const forbidden of ['userId', 'itemId', 'deviceId', 'advertisingId', 'location', 'freeText', 'sessionId']) {
  assert.equal(source.includes(`${forbidden}:`), false, `forbidden identifying field declared: ${forbidden}`);
}

console.log('activation funnel aggregation regression: ok');
