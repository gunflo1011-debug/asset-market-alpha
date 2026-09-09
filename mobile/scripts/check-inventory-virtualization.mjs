import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');
const list = fs.readFileSync(new URL('../src/features/inventory/InventoryThingList.tsx', import.meta.url), 'utf8');

const failures = [];
const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const reject = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message);
};

requireText(screen, "import { InventoryThingList } from './InventoryThingList';", 'InventoryScreen must import InventoryThingList.');
requireText(screen, '<InventoryThingList', 'InventoryScreen must render InventoryThingList for the main inventory feed.');
requireText(screen, 'items={visibleItems}', 'InventoryThingList must own the filtered/searchable inventory data.');
requireText(screen, 'onOpenItem={setSelectedItemId}', 'Inventory item navigation must stay wired through the virtualized list.');
requireText(screen, 'header={inventoryHeader}', 'Inventory header must stay inside the single vertical list owner.');
requireText(screen, 'emptyState={inventoryEmptyState}', 'Inventory loading/error/empty states must stay list-native.');
requireText(screen, 'onRefresh={props.onRefreshInventory}', 'Inventory pull-to-refresh must remain wired to the virtualized list.');
reject(screen, /visibleItems\s*\.map\s*\(/, 'Inventory must not regress to full-mount visibleItems.map(...).');

requireText(list, '<FlatList', 'InventoryThingList must remain FlatList-backed.');
requireText(list, 'keyExtractor={keyExtractor}', 'InventoryThingList must keep stable item keys.');
requireText(list, 'initialNumToRender={12}', 'InventoryThingList must keep bounded initial rendering.');
requireText(list, 'maxToRenderPerBatch={10}', 'InventoryThingList must keep bounded batch rendering.');
requireText(list, 'windowSize={7}', 'InventoryThingList must keep a bounded render window.');
requireText(list, "removeClippedSubviews={Platform.OS === 'android'}", 'InventoryThingList must keep Android clipping enabled.');
requireText(list, 'keyboardDismissMode="on-drag"', 'InventoryThingList must preserve keyboard-dismiss behavior.');
requireText(list, 'refreshing={refreshing}', 'InventoryThingList must preserve pull-to-refresh state.');
requireText(list, 'onRefresh={onRefresh}', 'InventoryThingList must preserve pull-to-refresh behavior.');

if (failures.length > 0) {
  console.error('Inventory virtualization contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Inventory virtualization contract passed.');
