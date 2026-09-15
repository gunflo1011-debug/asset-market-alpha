import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MarketplaceListing } from '../inventory/types';
import { PublicListingImage } from './PublicListingImage';

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

type Props = {
  listings: MarketplaceListing[];
  categories: string[];
  onOpenListing: (itemId: string) => void;
  onSelectCategory: (category: string) => void;
};

function publishedTime(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MarketplaceDiscoveryHome({ listings, categories, onOpenListing, onSelectCategory }: Props) {
  const listingsWithArea = useMemo(
    () => listings.filter((listing) => Boolean(listing.public_location)).slice(0, 6),
    [listings],
  );
  const newest = useMemo(
    () => [...listings].sort((a, b) => publishedTime(b.published_at) - publishedTime(a.published_at)).slice(0, 8),
    [listings],
  );

  if (listings.length === 0) return null;

  return (
    <View style={styles.root}>
      {listingsWithArea.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Explore listings</Text>
              <Text style={styles.sectionCue}>Sellers who shared a general area</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
            {listingsWithArea.map((listing) => (
              <TouchableOpacity
                key={listing.item_id}
                accessibilityRole="button"
                accessibilityLabel={`Open listing ${listing.title}, asking price ${euro(listing.asking_price_cents)}, ${listing.public_location}`}
                style={styles.nearbyCard}
                onPress={() => onOpenListing(listing.item_id)}
              >
                <PublicListingImage
                  uri={listing.image_urls[0]}
                  accessibilityLabel={listing.image_urls[0] ? `Cover photo for ${listing.title}` : `No public photo for ${listing.title}`}
                  fallbackLabel={listing.image_urls[0] ? 'Listing photo unavailable' : 'Seller chose not to share a photo'}
                  style={styles.nearbyImage}
                />
                <View style={styles.nearbyBody}>
                  <Text numberOfLines={1} style={styles.nearbyTitle}>{listing.title}</Text>
                  <Text style={styles.nearbyPrice}>{euro(listing.asking_price_cents)}</Text>
                  <Text numberOfLines={1} style={styles.nearbyMeta}>{listing.public_location}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Browse categories</Text>
              <Text style={styles.sectionCue}>Jump into what you are looking for</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.slice(0, 8).map((category) => (
              <TouchableOpacity
                key={category}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${category} listings`}
                style={styles.categoryButton}
                onPress={() => onSelectCategory(category)}
              >
                <View style={styles.categoryIcon}><Text style={styles.categoryInitial}>{category.trim().slice(0, 1).toUpperCase()}</Text></View>
                <Text numberOfLines={2} style={styles.categoryLabel}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>New listings</Text>
            <Text style={styles.sectionCue}>Recently published by other sellers</Text>
          </View>
        </View>
        <View style={styles.newGrid}>
          {newest.map((listing) => (
            <TouchableOpacity
              key={listing.item_id}
              accessibilityRole="button"
              accessibilityLabel={`Open new listing ${listing.title}, asking price ${euro(listing.asking_price_cents)}`}
              style={styles.newCard}
              onPress={() => onOpenListing(listing.item_id)}
            >
              <PublicListingImage
                uri={listing.image_urls[0]}
                accessibilityLabel={listing.image_urls[0] ? `Cover photo for ${listing.title}` : `No public photo for ${listing.title}`}
                fallbackLabel={listing.image_urls[0] ? 'Listing photo unavailable' : 'Seller chose not to share a photo'}
                style={styles.newImage}
              />
              <View style={styles.newBody}>
                <Text numberOfLines={2} style={styles.newTitle}>{listing.title}</Text>
                <Text style={styles.newPrice}>{euro(listing.asking_price_cents)}</Text>
                <Text numberOfLines={1} style={styles.newMeta}>{listing.public_location ?? listing.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 26 },
  section: { gap: 13 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.35, color: '#0C1628' },
  sectionCue: { marginTop: 3, fontSize: 12, lineHeight: 17, color: '#7C8798' },
  horizontalRow: { gap: 12, paddingRight: 4 },
  nearbyCard: { width: 184, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EDF2' },
  nearbyImage: { width: '100%', height: 132, backgroundColor: '#EEF2F6' },
  nearbyBody: { padding: 12, gap: 3 },
  nearbyTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#0C1628' },
  nearbyPrice: { fontSize: 17, lineHeight: 21, fontWeight: '900', color: '#0C1628' },
  nearbyMeta: { fontSize: 11, lineHeight: 16, color: '#7C8798' },
  categoryRow: { gap: 13, paddingRight: 4 },
  categoryButton: { width: 74, alignItems: 'center', gap: 8 },
  categoryIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5F8', borderWidth: 1, borderColor: '#E7EBF0' },
  categoryInitial: { fontSize: 18, fontWeight: '900', color: '#0C1628' },
  categoryLabel: { minHeight: 30, fontSize: 11, lineHeight: 15, fontWeight: '800', textAlign: 'center', color: '#596579' },
  newGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  newCard: { width: '48.2%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EDF2' },
  newImage: { width: '100%', height: 132, backgroundColor: '#EEF2F6' },
  newBody: { padding: 11, gap: 3 },
  newTitle: { minHeight: 36, fontSize: 13, lineHeight: 18, fontWeight: '800', color: '#0C1628' },
  newPrice: { fontSize: 16, lineHeight: 20, fontWeight: '900', color: '#0C1628' },
  newMeta: { fontSize: 10, lineHeight: 15, color: '#7C8798' },
});
