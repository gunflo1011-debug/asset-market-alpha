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

function searchTokens(value: string | null | undefined): string[] {
  return normalizeSearchValue(value).split(/\s+/).filter(Boolean);
}

export function marketplaceDiscoveryCategories(listings: MarketplaceListing[]): string[] {
  const categories = new Map<string, { display: string; count: number; firstSeen: number }>();
  listings.forEach((listing, index) => {
    const display = listing.category.trim();
    if (!display) return;
    const key = normalizeSearchValue(display);
    const current = categories.get(key);
    if (current) current.count += 1;
    else categories.set(key, { display, count: 1, firstSeen: index });
  });

  // Discovery chips should help people browse, not behave like an admin taxonomy.
  // Put categories with real inventory density first while keeping ties stable.
  return [...categories.values()]
    .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen || a.display.localeCompare(b.display, 'de-DE', { sensitivity: 'base' }))
    .map(({ display }) => display);
}

export function filterMarketplaceListings(
  listings: MarketplaceListing[],
  filter: MarketplaceDiscoveryFilter,
): MarketplaceListing[] {
  const queryTokens = searchTokens(filter.query);
  const selectedCategory = filter.category && filter.category !== MARKETPLACE_DISCOVERY_ALL
    ? normalizeSearchValue(filter.category)
    : null;

  return listings.filter((listing) => {
    if (selectedCategory && normalizeSearchValue(listing.category) !== selectedCategory) return false;
    if (queryTokens.length === 0) return true;

    // Deliberately search only fields already present in the buyer-visible listing
    // projection. Never couple discovery to private inventory notes, serials,
    // account identity or exact-address data.
    const searchable = normalizeSearchValue([
      listing.title,
      listing.category,
      listing.condition_label,
      listing.public_location,
    ].filter(Boolean).join(' '));

    // Multi-word searches should work naturally even when words come from
    // different public fields, e.g. "camera berlin".
    return queryTokens.every((token) => searchable.includes(token));
  });
}
