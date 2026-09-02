import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/features/marketplace/marketplaceDiscovery.ts', import.meta.url), 'utf8');

const required = [
  'filterMarketplaceListings',
  'marketplaceDiscoveryCategories',
  'listing.title',
  'listing.category',
  'listing.condition_label',
  'listing.public_location',
  "MARKETPLACE_DISCOVERY_ALL = 'ALL'",
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Marketplace discovery contract missing: ${token}`);
}

const forbiddenBuyerSearchFields = [
  'listing.notes',
  'listing.location_label',
  'listing.serial',
  'listing.owner_id',
  'listing.email',
  'listing.account_id',
];

for (const token of forbiddenBuyerSearchFields) {
  if (source.includes(token)) throw new Error(`Marketplace discovery must not search private field: ${token}`);
}

if (!source.includes("normalize('NFKD')") || !source.includes("toLocaleLowerCase('de-DE')")) {
  throw new Error('Marketplace discovery must normalize user-visible text for resilient search.');
}

console.log('Marketplace discovery privacy/search contract OK');
