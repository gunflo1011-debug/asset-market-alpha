import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/data/inventory.ts'), 'utf8');

assert.match(source, /rpc\(['"]load_my_inventory_market_states['"]\)/, 'inventory must load authoritative market state');
assert.match(
  source,
  /if\s*\(\s*marketStateResult\.error\s*\)\s*throw\s+new\s+Error\(['"][^'"]*will not show devices as currently owned[^'"]*['"]\)/s,
  'market-state lookup must fail closed',
);

// Accept either explicit branches or the equivalent compact conditional, while still
// requiring both safety properties: no authoritative state => exclude, SOLD => exclude.
const explicitLifecycleFilter = /const\s+marketState\s*=\s*marketStates\.get\(item\.id\)\s*;\s*if\s*\(\s*!marketState\s*\)\s*return\s*\[\]\s*;\s*if\s*\(\s*marketState\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
const compactLifecycleFilter = /const\s+state\s*=\s*marketStates\.get\(item\.id\)\s*;\s*return\s*!state\s*\|\|\s*state\s*===\s*['"]SOLD['"]\s*\?\s*\[\]\s*:/s;
assert.ok(
  explicitLifecycleFilter.test(source) || compactLifecycleFilter.test(source),
  'owned inventory must exclude missing authoritative state and SOLD items',
);

console.log('owned-inventory lifecycle regression: ok');
