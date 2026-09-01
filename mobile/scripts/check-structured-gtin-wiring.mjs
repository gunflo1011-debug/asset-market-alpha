import fs from 'node:fs';
import assert from 'node:assert/strict';

const commands = fs.readFileSync(new URL('../src/data/inventoryCommands.ts', import.meta.url), 'utf8');
const inventoryScreen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');

assert.match(inventoryScreen, /suggestion\.kind === 'gtin' \? `GTIN\/UPC: \$\{suggestion\.code\}`/,
  'confirmed scan flow must carry the exact scanned GTIN into the user-editable confirmation form');
assert.match(commands, /extractConfirmedGtinFromNotes/,
  'inventory commands must extract a confirmed GTIN only from the saved confirmation payload');
assert.match(commands, /client\.rpc\('set_my_item_gtin_v1',[\s\S]*p_item_id: data,[\s\S]*p_gtin: confirmedGtin,[\s\S]*p_source: 'BARCODE_SCAN'/,
  'newly saved Things must persist confirmed scanned GTIN through the private owner-scoped RPC');
assert.match(commands, /if \(identityError\) console\.warn/,
  'post-save GTIN enrichment failure must not turn a successfully created Thing into an apparent failed add');
assert.doesNotMatch(commands, /if \(identityError\) throw identityError/,
  'post-save identity enrichment must not encourage duplicate Thing creation after the primary save succeeded');

console.log('structured GTIN mobile wiring regression: OK');
