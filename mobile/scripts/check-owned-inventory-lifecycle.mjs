import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/data/inventory.ts'), 'utf8');

assert.match(source, /rpc\('load_my_inventory_market_states'\)/, 'inventory must load authoritative market state');
assert.match(source, /if \(marketStateResult\.error\)[\s\S]*will not show devices as currently owned/, 'market-state lookup must fail closed');
assert.match(source, /if \(marketState === 'SOLD'\) return \[\];/, 'sold items must be excluded from current owned inventory');
assert.match(source, /if \(!marketState\) return \[\];/, 'items without authoritative market state must not be counted as owned');

console.log('owned-inventory lifecycle regression: ok');
