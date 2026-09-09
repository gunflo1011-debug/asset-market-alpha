import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/features/marketplace/MarketplaceScreen.tsx', import.meta.url), 'utf8');
const list = fs.readFileSync(new URL('../src/features/marketplace/MarketplaceBrowseList.tsx', import.meta.url), 'utf8');

const failures = [];
const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message);
};
const reject = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message);
};

requireText(screen, "import { MarketplaceBrowseList } from './MarketplaceBrowseList';", 'MarketplaceScreen must import MarketplaceBrowseList.');
requireText(screen, '<MarketplaceBrowseList', 'MarketplaceScreen must render MarketplaceBrowseList for discovery.');
requireMatch(
  screen,
  /listings=\{(?:filteredBrowseListings|error\s*\?\s*\[\]\s*:\s*filteredBrowseListings)\}/,
  'MarketplaceBrowseList must own filtered public discovery data, optionally guarded by the existing error state.',
);
requireText(screen, 'renderListing={renderBrowseListing}', 'Marketplace listing cards must render through the virtualized list.');
reject(screen, /filteredBrowseListings\s*\.map\s*\(/, 'Marketplace discovery must not regress to full-mount filteredBrowseListings.map(...).');

requireText(list, '<FlatList', 'MarketplaceBrowseList must remain FlatList-backed.');
requireText(list, 'keyExtractor={keyExtractor}', 'MarketplaceBrowseList must keep stable item keys.');
requireText(list, 'initialNumToRender={4}', 'MarketplaceBrowseList must keep bounded initial rendering.');
requireText(list, 'maxToRenderPerBatch={4}', 'MarketplaceBrowseList must keep bounded batch rendering.');
requireText(list, 'windowSize={7}', 'MarketplaceBrowseList must keep a bounded render window.');
requireText(list, "removeClippedSubviews={Platform.OS === 'android'}", 'MarketplaceBrowseList must keep Android clipping enabled.');
requireText(list, 'keyboardDismissMode="on-drag"', 'MarketplaceBrowseList must preserve keyboard-dismiss behavior.');
requireText(list, 'refreshing={refreshing}', 'MarketplaceBrowseList must preserve pull-to-refresh state.');
requireText(list, 'onRefresh={onRefresh}', 'MarketplaceBrowseList must preserve pull-to-refresh behavior.');

if (failures.length > 0) {
  console.error('Marketplace virtualization contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Marketplace virtualization contract passed.');
