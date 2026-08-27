import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const inventory = [
  read('src/data/inventory.ts'),
  read('src/data/inventoryQueries.ts'),
  read('src/data/inventoryCommands.ts'),
].join('\n');

const appContracts = [
  'function startEditing(item: PrivateInventoryItem)',
  'setThingName(item.custom_name?.trim() || itemTitle(item))',
  'setThingLocation(item.location_label ??',
  'setThingNotes(item.notes ??',
  'await updatePrivateItemMetadata(editingItemId, input)',
  'await refreshInventory()',
  'if (item.product_variants) await deletePrivateDevice(item.id)',
  'else await deletePrivateThing(item.id)',
  "setMessage('Item deleted.')",
  "setMessage(wasEditing ? 'Item updated.' : 'Thing added to your inventory.')",
];
for (const marker of appContracts) {
  if (!app.includes(marker)) throw new Error(`Missing inventory orchestration contract: ${marker}`);
}

for (const marker of ['onStartEditing', '>Edit<', 'onDelete', '>Delete<']) {
  if (!screen.replace(/\s+/g, '').includes(marker.replace(/\s+/g, ''))) {
    throw new Error(`Missing inventory screen CRUD contract: ${marker}`);
  }
}
if (!/props\.items\.map\([\s\S]*onStartEditing\(item\)[\s\S]*onDelete\(item\)/s.test(screen)) {
  throw new Error('Every visible inventory item must expose Edit and Delete actions.');
}

const dataContracts = [
  [/rpc\(['"]update_private_item_metadata['"]/, 'owner metadata update RPC'],
  [/rpc\(['"]delete_private_thing['"]/, 'generic Thing delete RPC'],
  [/rpc\(['"]delete_private_device['"]/, 'catalog device delete RPC'],
  [/if\s*\(\s*isCatalogDevice\s*&&\s*marketStateResult\.error\s*\)\s*return\s*\[\]/s, 'catalog device RPC failure must fail closed'],
  [/if\s*\(\s*isCatalogDevice\s*&&\s*!state\s*\)\s*return\s*\[\]/s, 'catalog device missing state must fail closed'],
  [/if\s*\(\s*state\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]/s, 'SOLD inventory must stay excluded'],
];
for (const [pattern, description] of dataContracts) {
  if (!pattern.test(inventory)) throw new Error(`Missing inventory data contract: ${description}`);
}

console.log('inventory CRUD surface regression passed');
