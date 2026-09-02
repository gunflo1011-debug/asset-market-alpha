import type { MarketplaceListing } from '../inventory/types';

export const MARKETPLACE_DISCOVERY_ALL = 'ALL' as const;
export type MarketplaceDiscoveryCategory = typeof MARKETPLACE_DISCOVERY_ALL | string;

export type MarketplaceDiscoveryFilter = {
  query?: string;
  category?: MarketplaceDiscoveryCategory;
};

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

export function marketplaceDiscoveryCategories(listings: MarketplaceListing[]): string[] {
  const categories = new Map<string, string>();
  for (const listing of listings) {
    const display = listing.category.trim();
    if (!display) continue;
    const key = normalizeSearchValue(display);
    if (!categories.has(key)) categories.set(key, display);
  }
  return [...categories.values()].sort((a, b) => a.localeCompare(b, 'de-DE', { sensitivity: 'base' }));
}

export function filterMarketplaceListings(
  listings: MarketplaceListing[],
  filter: MarketplaceDiscoveryFilter,
): MarketplaceListing[] {
  const query = normalizeSearchValue(filter.query);
  const selectedCategory = filter.category && filter.category !== MARKETPLACE_DISCOVERY_ALL
    ? normalizeSearchValue(filter.category)
    : null;

  return listings.filter((listing) => {
    if (selectedCategory && normalizeSearchValue(listing.category) !== selectedCategory) return false;
    if (!query) return true;

    // Deliberately search only fields already present in the buyer-visible listing
    // projection. Never couple discovery to private inventory notes, serials,
    // account identity or exact-address data.
    const searchable = [
      listing.title,
      listing.category,
      listing.condition_label,
      listing.public_location,
    ].map(normalizeSearchValue);

    return searchable.some((value) => value.includes(query));
  });
}
