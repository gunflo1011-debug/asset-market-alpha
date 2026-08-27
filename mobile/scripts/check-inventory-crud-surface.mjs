import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const inventory = fs.readFileSync(new URL('../src/data/inventory.ts', import.meta.url), 'utf8');

const requiredAppSemantics = [
  'function startEditing(item: PrivateInventoryItem)',
  'setThingName(item.custom_name?.trim() || itemTitle(item))',
  'setThingLocation(item.location_label ??',
  'setThingNotes(item.notes ??',
  'await updatePrivateItemMetadata(editingItemId, input)',
  'await refreshInventory()',
  'onPress={()=>startEditing(item)}',
  '>Edit<',
  'onPress={()=>confirmDelete(item)}',
  '>Delete<',
  'if (item.product_variants) await deletePrivateDevice(item.id)',
  'else await deletePrivateThing(item.id)',
  "setMessage('Item deleted.')",
  "setMessage(wasEditing ? 'Item updated.' : 'Thing added to your inventory.')",
];

for (const marker of requiredAppSemantics) {
  if (!app.includes(marker)) throw new Error(`Missing inventory CRUD surface contract: ${marker}`);
}

// Edit/Delete actions must live on the shared item card, not only inside the generic-Thing branch.
const itemMapStart = app.indexOf('{items.map((item)=>');
const catalogStart = app.indexOf('<View style={styles.card}><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.sectionTitle}>Add from device catalog');
if (itemMapStart < 0 || catalogStart < 0 || catalogStart <= itemMapStart) throw new Error('Could not locate inventory item surface.');
const itemSurface = app.slice(itemMapStart, catalogStart);
if (!itemSurface.includes('onPress={()=>startEditing(item)}') || !itemSurface.includes('onPress={()=>confirmDelete(item)}')) {
  throw new Error('Every visible inventory item must expose Edit and Delete actions.');
}
if (/generic\s*\?[^:]*Edit|generic\s*&&[^<]*Edit/.test(itemSurface)) {
  throw new Error('Edit must not be restricted to generic Things only.');
}

const requiredDataSemantics = [
  "client().rpc('update_private_item_metadata'",
  "client().rpc('delete_private_thing'",
  "client().rpc('delete_private_device'",
  "if(isCatalogDevice && marketStateResult.error) return []",
  "if(isCatalogDevice && !state) return []",
  "if(state==='SOLD') return []",
];
for (const marker of requiredDataSemantics) {
  if (!inventory.includes(marker)) throw new Error(`Missing inventory data contract: ${marker}`);
}

console.log('inventory CRUD surface regression passed');
