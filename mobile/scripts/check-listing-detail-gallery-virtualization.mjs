import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/features/marketplace/MarketplaceScreen.tsx', import.meta.url), 'utf8');
const failures = [];

const requireText = (text, message) => {
  if (!screen.includes(text)) failures.push(message);
};
const reject = (pattern, message) => {
  if (pattern.test(screen)) failures.push(message);
};

requireText('FlatList', 'MarketplaceScreen must import/use FlatList for the Listing Detail gallery.');
requireText('data={selected.image_urls}', 'Listing Detail gallery must virtualize the selected public image URLs.');
requireText('keyExtractor={(_, index) => `${selected.item_id}-${index}`}', 'Listing Detail gallery must keep stable per-listing image keys.');
requireText('initialNumToRender={2}', 'Listing Detail gallery must keep bounded initial image rendering.');
requireText('maxToRenderPerBatch={2}', 'Listing Detail gallery must keep bounded image batches.');
requireText('windowSize={3}', 'Listing Detail gallery must keep a bounded render window.');
requireText("removeClippedSubviews={Platform.OS === 'android'}", 'Listing Detail gallery must keep Android clipping enabled.');
requireText('accessibilityLabel={`Listing photo ${index + 1} of ${selected.image_urls.length}`}', 'Listing Detail gallery must preserve positional public-photo accessibility labels.');
reject(/selected\.image_urls\s*\.map\s*\(/, 'Listing Detail gallery must not regress to full-mount selected.image_urls.map(...).');

if (failures.length > 0) {
  console.error('Listing Detail gallery virtualization contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Listing Detail gallery virtualization contract passed.');
