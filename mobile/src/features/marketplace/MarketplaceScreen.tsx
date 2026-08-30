import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { loadMarketplace, loadMyMarketplaceInterests, loadMyMarketplaceListings, setMyMarketplaceInterest } from '../../data/inventory';
import type { MarketplaceInterest, MarketplaceListing, OwnerMarketplaceListing } from '../inventory/types';

type Props = { onBack: () => void };

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function MarketplaceScreen({ onBack }: Props) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<OwnerMarketplaceListing[]>([]);
  const [interests, setInterests] = useState<MarketplaceInterest[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestWarning, setInterestWarning] = useState<string | null>(null);
  const [ownerListingWarning, setOwnerListingWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(() => listings.find((listing) => listing.item_id === selectedItemId) ?? null, [listings, selectedItemId]);
  const interestByItem = useMemo(() => new Map(interests.map((row) => [row.item_id, row.status])), [interests]);
  const ownerListingIds = useMemo(() => new Set(myListings.filter((row) => row.status === 'PUBLISHED').map((row) => row.item_id)), [myListings]);
  const publicListingByItem = useMemo(() => new Map(listings.map((row) => [row.item_id, row])), [listings]);
  const publishedMine = useMemo(() => myListings.filter((row) => row.status === 'PUBLISHED'), [myListings]);
  const browseListings = useMemo(() => listings.filter((row) => !ownerListingIds.has(row.item_id)), [listings, ownerListingIds]);

  async function refresh() {
    setLoading(true);
    setError(null);
    setInterestWarning(null);
    setOwnerListingWarning(null);

    const [listingsResult, interestsResult, ownerListingsResult] = await Promise.allSettled([
      loadMarketplace(),
      loadMyMarketplaceInterests(),
      loadMyMarketplaceListings(),
    ]);

    if (listingsResult.status === 'fulfilled') setListings(listingsResult.value);
    else setError(listingsResult.reason instanceof Error ? listingsResult.reason.message : 'Could not load marketplace.');

    if (interestsResult.status === 'fulfilled') setInterests(interestsResult.value);
    else setInterestWarning('Listings are available, but your saved interest status could not be refreshed.');

    if (ownerListingsResult.status === 'fulfilled') setMyListings(ownerListingsResult.value);
    else setOwnerListingWarning('Marketplace is available, but your own listing status could not be refreshed.');

    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  async function changeInterest(itemId: string, interested: boolean) {
    if (busy) return;
    try {
      setBusy(true);
      setMessage(null);
      const status = await setMyMarketplaceInterest(itemId, interested);
      setInterests((current) => {
        const rest = current.filter((row) => row.item_id !== itemId);
        return [...rest, { item_id: itemId, status, updated_at: new Date().toISOString() }];
      });
      setInterestWarning(null);
      setMessage(interested ? 'Interest sent. The seller can now see that someone is interested.' : 'Interest withdrawn.');
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not update interest.');
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    const interested = interestByItem.get(selected.item_id) === 'INTERESTED';
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => { setSelectedItemId(null); setMessage(null); }}><Text style={styles.back}>‹ Marketplace</Text></TouchableOpacity>
          </View>

          <View style={styles.detailHero}>
            <View style={styles.cardTop}><View style={styles.pillDark}><Text style={styles.pillDarkText}>{selected.category}</Text></View><Text style={styles.detailPrice}>{euro(selected.asking_price_cents)}</Text></View>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <Text style={styles.detailSubtitle}>Private seller · exact address hidden</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Listing details</Text>
            <View style={styles.detailRow}><Text style={styles.detailKey}>Asking price</Text><Text style={styles.detailValue}>{euro(selected.asking_price_cents)}</Text></View>
            {selected.location_label ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Location</Text><Text style={styles.detailValue}>{selected.location_label}</Text></View></> : null}
            {selected.condition_label ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Condition</Text><Text style={styles.detailValue}>{selected.condition_label}</Text></View></> : null}
            {selected.estimated_value_cents != null ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Things estimate</Text><Text style={styles.detailValue}>{euro(selected.estimated_value_cents)}</Text></View></> : null}
          </View>

          <View style={styles.interestCard}>
            <Text style={styles.eyebrow}>{interested ? 'INTEREST SENT' : 'INTERESTED?'}</Text>
            <Text style={styles.interestTitle}>{interested ? 'The seller can see your interest' : 'Interested in this Thing?'}</Text>
            <Text style={styles.copy}>{interested ? 'Your identity is still hidden. This is only a private signal to the seller.' : 'Send a private interest signal. Your email, account identity and exact address are not shared.'}</Text>
            {interestWarning ? <Text style={styles.warningText}>{interestWarning}</Text> : null}
            <TouchableOpacity disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void changeInterest(selected.item_id, !interested)}>
              <Text style={styles.primaryButtonText}>{busy ? 'Saving…' : interested ? 'Withdraw interest' : 'I’m interested'}</Text>
            </TouchableOpacity>
            {message ? <Text style={styles.feedback}>{message}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Inventory</Text></TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} disabled={loading} onPress={() => void refresh()}><Text style={styles.refresh}>{loading ? '…' : '↻'}</Text></TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MARKETPLACE</Text>
          <Text style={styles.title}>Discover Things for sale</Text>
          <Text style={styles.copy}>Browse published listings with a coarse town/city and privately signal interest without revealing your identity.</Text>
          <View style={styles.heroStats}><Text style={styles.heroStatValue}>{browseListings.length}</Text><Text style={styles.heroStatLabel}>{browseListings.length === 1 ? 'listing from others' : 'listings from others'}</Text></View>
        </View>

        {loading && listings.length === 0 ? <View style={styles.loadingCard}><ActivityIndicator /><Text style={styles.copy}>Loading marketplace…</Text></View> : null}
        {error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Marketplace unavailable</Text><Text style={styles.errorText}>{error}</Text></View> : null}
        {!error && interestWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Marketplace available</Text><Text accessibilityLiveRegion="polite" style={styles.warningText}>{interestWarning}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading personal interest status" disabled={loading} style={styles.retryButton} onPress={() => void refresh()}><Text style={styles.retryLink}>Retry personal status</Text></TouchableOpacity></View> : null}
        {!error && ownerListingWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Your listings need refresh</Text><Text accessibilityLiveRegion="polite" style={styles.warningText}>{ownerListingWarning}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading my marketplace listings" disabled={loading} style={styles.retryButton} onPress={() => void refresh()}><Text style={styles.retryLink}>Retry your listings</Text></TouchableOpacity></View> : null}

        {publishedMine.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your listings</Text><Text style={styles.sectionMeta}>{publishedMine.length} for sale</Text></View> : null}
        {publishedMine.map((ownerListing) => {
          const publicListing = publicListingByItem.get(ownerListing.item_id);
          return (
            <View key={ownerListing.item_id} style={styles.ownerCard}>
              <View style={styles.cardTop}>
                <View style={styles.ownerPill}><Text style={styles.ownerPillText}>FOR SALE</Text></View>
                <Text style={styles.ask}>{euro(ownerListing.asking_price_cents)}</Text>
              </View>
              <Text style={styles.itemTitle}>{publicListing?.title ?? 'Your Thing'}</Text>
              <Text style={styles.copy}>{ownerListing.location_label ? `${ownerListing.location_label} · ` : ''}Published on Marketplace · linked to your private inventory item</Text>
            </View>
          );
        })}

        {!loading && !error && browseListings.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing else for sale yet</Text><Text style={styles.copy}>Published Things from other owners will appear here.</Text></View> : null}
        {browseListings.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Available now</Text><Text style={styles.sectionMeta}>From other sellers</Text></View> : null}

        {browseListings.map((listing) => {
          const interested = interestByItem.get(listing.item_id) === 'INTERESTED';
          return (
            <TouchableOpacity key={listing.item_id} style={styles.card} onPress={() => { setSelectedItemId(listing.item_id); setMessage(null); }}>
              <View style={styles.cardTop}><View style={styles.pill}><Text style={styles.pillText}>{listing.category}</Text></View><Text style={styles.ask}>{euro(listing.asking_price_cents)}</Text></View>
              <Text style={styles.itemTitle}>{listing.title}</Text>
              <View style={styles.metaRow}>
                {listing.location_label ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{listing.location_label} · Pickup</Text></View> : null}
                {listing.condition_label ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{listing.condition_label}</Text></View> : null}
                {listing.estimated_value_cents != null ? <View style={styles.metaChip}><Text style={styles.metaChipText}>Estimate {euro(listing.estimated_value_cents)}</Text></View> : null}
                {interested ? <View style={styles.interestedChip}><Text style={styles.interestedChipText}>Interested</Text></View> : null}
              </View>
              <View style={styles.cardFooter}><Text style={styles.footerLabel}>View listing</Text><Text style={styles.footerPrivacy}>Private seller ›</Text></View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { padding: 20, paddingTop: 18, paddingBottom: 56, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 16, fontWeight: '800', color: '#344054', paddingVertical: 8 },
  refreshButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  refresh: { fontSize: 19, fontWeight: '800', color: '#344054' },
  hero: { backgroundColor: '#0F1728', borderRadius: 28, padding: 22, gap: 9 },
  detailHero: { backgroundColor: '#0F1728', borderRadius: 28, padding: 22, gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: '#98A2B3' },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.7, color: '#FFFFFF' },
  detailTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#FFFFFF' },
  detailSubtitle: { fontSize: 13, lineHeight: 19, color: '#C5CBD4' },
  detailPrice: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  copy: { fontSize: 13, lineHeight: 19, color: '#7A8494' },
  heroStats: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6 },
  heroStatValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 12, color: '#C5CBD4' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  sectionMeta: { fontSize: 12, color: '#7A8494' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 11, borderWidth: 1, borderColor: '#E5E8ED' },
  ownerCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 9, borderWidth: 1, borderColor: '#B7E4C7' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pill: { backgroundColor: '#F0F2F5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: '800', color: '#475467' },
  ownerPill: { backgroundColor: '#ECFDF3', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  ownerPillText: { fontSize: 11, fontWeight: '800', color: '#027A48' },
  pillDark: { backgroundColor: '#263247', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillDarkText: { fontSize: 11, fontWeight: '800', color: '#E7EBF0' },
  ask: { fontSize: 25, fontWeight: '800', color: '#0F1728' },
  itemTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: '#0F1728' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metaChip: { borderRadius: 999, backgroundColor: '#F8F9FB', paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#EEF0F3' },
  metaChipText: { fontSize: 11, fontWeight: '700', color: '#667085', textTransform: 'capitalize' },
  interestedChip: { borderRadius: 999, backgroundColor: '#ECFDF3', paddingHorizontal: 9, paddingVertical: 5 },
  interestedChipText: { fontSize: 11, fontWeight: '800', color: '#027A48' },
  cardFooter: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF0F3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontSize: 12, color: '#7A8494' },
  footerPrivacy: { fontSize: 11, fontWeight: '700', color: '#027A48' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E5E8ED' },
  interestCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 11, borderWidth: 1, borderColor: '#E5E8ED' },
  interestTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: '#0F1728' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 20 },
  detailKey: { fontSize: 14, color: '#7A8494' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F1728', textAlign: 'right', textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#EEF0F3' },
  primaryButton: { minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1728' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  feedback: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#344054' },
  disabled: { opacity: 0.45 },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E8ED' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, gap: 8, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 16, fontWeight: '800', color: '#B42318' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#B42318' },
  warningCard: { backgroundColor: '#FFFAEB', borderRadius: 18, padding: 16, gap: 7, borderWidth: 1, borderColor: '#FEDF89' },
  warningTitle: { fontSize: 15, fontWeight: '800', color: '#93370D' },
  warningText: { fontSize: 12, lineHeight: 18, color: '#7A2E0E' },
  retryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  retryLink: { fontSize: 12, fontWeight: '800', color: '#B54708' },
});
