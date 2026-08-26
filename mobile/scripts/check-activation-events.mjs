import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/lib/activationEvents.ts', import.meta.url), 'utf8');

const requiredEvents = [
  'CAPTURE_SUCCESS',
  'INVENTORY_VISIBLE',
  'VALUE_VISIBLE',
  'SELL_INITIATED',
];

for (const event of requiredEvents) {
  assert.ok(source.includes(`'${event}'`), `missing activation event ${event}`);
}

// Check executable contract surface rather than comments. Documentation may
// legitimately describe the privacy fields that are intentionally excluded.
const contractSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
for (const forbidden of [
  'userId', 'user_id', 'email', 'phone', 'itemId', 'item_id', 'deviceId',
  'device_id', 'location', 'latitude', 'longitude', 'freeText', 'timestamp',
]) {
  assert.equal(contractSource.includes(forbidden), false, `privacy-minimal contract must not expose ${forbidden}`);
}

assert.ok(source.includes('schemaVersion: 1'), 'event contract must be explicitly versioned');
assert.ok(source.includes('does not transmit or persist anything'), 'local-only semantics must be documented');

console.log('activation event contract regression passed');
