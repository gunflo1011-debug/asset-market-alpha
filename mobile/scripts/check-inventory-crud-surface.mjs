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
  'await updatePrivateItemMetadata(editingId, input)',
  'const synced = await refreshInventory(expectedUserId)',
  'if (item.product_variants) await deletePrivateDevice(item.id)',
  'else await deletePrivateThing(item.id)',
  "'Item deleted.'",
  "'Thing added to your inventory.'",
  "'Thing saved privately. Inventory sync is delayed—do not add it again. Use Refresh to confirm it.'",
  "'Item deleted. Inventory sync is delayed; use Refresh if it still appears.'",
  "'Device saved privately. Inventory sync is delayed—do not add it again. Use Refresh to confirm it.'",
  'const optimisticItem: PrivateInventoryItem',
  'setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))',
  'const actionUserIdRef = useRef<string | null>(null)',
  'const actionRequestIdRef = useRef(0)',
  'if (inventoryUserIdRef.current !== expectedUserId || actionRequestIdRef.current !== actionRequestId) return',
  'const inventoryRequestIdRef = useRef(0)',
  'inventoryUserIdRef.current = inventoryUserId',
  'inventoryRequestIdRef.current += 1',
  'void refreshInventory(session.user.id)',
  'const requestId = ++inventoryRequestIdRef.current',
];
for (const marker of appContracts) {
  if (!app.includes(marker)) throw new Error(`Missing inventory orchestration contract: ${marker}`);
}

if (!/const nextItems = await loadPrivateInventory\(\);[\s\S]*requestId !== inventoryRequestIdRef\.current \|\| inventoryUserIdRef\.current !== expectedUserId[\s\S]*setItems\(nextItems\)/s.test(app)) {
  throw new Error('Inventory results must be discarded after account changes or a newer refresh.');
}
if (!/catch \(error\) \{[\s\S]*requestId === inventoryRequestIdRef\.current && inventoryUserIdRef\.current === expectedUserId[\s\S]*setInventoryError/s.test(app)) {
  throw new Error('Stale inventory failures must not overwrite the current account error state.');
}
if (!/finally \{[\s\S]*requestId === inventoryRequestIdRef\.current && inventoryUserIdRef\.current === expectedUserId[\s\S]*setInventoryLoading\(false\)/s.test(app)) {
  throw new Error('Stale inventory requests must not clear loading state for a newer request.');
}

if (!/createdItemId = await addPrivateThing\(input\)[\s\S]*const optimisticItem: PrivateInventoryItem[\s\S]*setItems\(\(current\) => \[optimisticItem,/s.test(app)) {
  throw new Error('Confirmed generic Thing creation must appear locally before the follow-up sync.');
}
if (!/await updatePrivateItemMetadata\(editingId, input\)[\s\S]*setItems\(\(current\) => current\.map/s.test(app)) {
  throw new Error('Confirmed Thing edits must update the local inventory before the follow-up sync.');
}
if (!/await deletePrivateThing\(item\.id\)[\s\S]*setItems\(\(current\) => current\.filter/s.test(app)) {
  throw new Error('Confirmed deletion must remove the local item before the follow-up sync.');
}
if (!/actionUserIdRef\.current = expectedUserId[\s\S]*inventoryUserIdRef\.current !== expectedUserId \|\| actionRequestIdRef\.current !== actionRequestId[\s\S]*finally \{[\s\S]*actionUserIdRef\.current === expectedUserId && actionRequestIdRef\.current === actionRequestId/s.test(app)) {
  throw new Error('Inventory mutation UI effects must remain bound to the account and mutation that started them.');
}

for (const marker of ['onStartEditing', 'Edit item', 'onDelete', 'Delete item', 'accessibilityLabel="Refresh private inventory"', 'accessibilityLabel="Retry loading private inventory"', 'minHeight: 44']) {
  if (!screen.replace(/\s+/g, '').includes(marker.replace(/\s+/g, ''))) {
    throw new Error(`Missing inventory screen CRUD contract: ${marker}`);
  }
}

if (!/props\.items\.map\([\s\S]*setSelectedItemId\(item\.id\)/s.test(screen)) {
  throw new Error('Every visible inventory item must open its detail surface.');
}
if (!/if\s*\(selectedItem\)[\s\S]*onStartEditing\(selectedItem\)[\s\S]*onDelete\(selectedItem\)/s.test(screen)) {
  throw new Error('Selected item detail must expose Edit and Delete actions.');
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
