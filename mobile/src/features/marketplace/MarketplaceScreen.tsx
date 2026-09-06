import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  loadMarketplace,
  loadMyMarketplaceConversations,
  loadMyMarketplaceInterests,
  loadMyMarketplaceListings,
  openMyMarketplaceConversation,
  setMyMarketplaceInterest,
} from '../../data/inventory';
import type { MarketplaceConversation, MarketplaceInterest, MarketplaceListing, OwnerMarketplaceListing } from '../inventory/types';
import { MarketplaceConversationScreen } from './MarketplaceConversationScreen';
import { marketplaceFailureMessage } from './consumerErrors';
import { MARKETPLACE_DISCOVERY_ALL, filterMarketplaceListings, marketplaceDiscoveryCategories } from './marketplaceDiscovery';

type Props = { onBack: () => void };

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function conversationStatusLabel(status: MarketplaceConversation['status']): string {
  switch (status) {
    case 'OPEN': return 'Open';
    case 'RESERVED': return 'Reserved';
    case 'SOLD': return 'Sold';
    case 'CLOSED': return 'Closed';
  }
}

export function MarketplaceScreen({ onBack }: Props) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<OwnerMarketplaceListing[]>([]);
  const [interests, setInterests] = useState<MarketplaceInterest[]>([]);
  const [conversations, setConversations] = useState<MarketplaceConversation[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(MARKETPLACE_DISCOVERY_ALL);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestWarning, setInterestWarning] = useState<string | null>(null);
  const [ownerListingWarning, setOwnerListingWarning] = useState<string | null>(null);
  const [conversationWarning, setConversationWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(() => listings.find((listing) => listing.item_id === selectedItemId) ?? null, [listings, selectedItemId]);
  const selectedConversation = useMemo(() => conversations.find((row) => row.conversation_id === selectedConversationId) ?? null, [conversations, selectedConversationId]);
  const interestByItem = useMemo(() => new Map(interests.map((row) => [row.item_id, row.status])), [interests]);
  const ownerListingIds = useMemo(() => new Set(myListings.filter((row) => row.status === 'PUBLISHED').map((row) => row.item_id)), [myListings]);
  const publishedMine = useMemo(() => myListings.filter((row) => row.status === 'PUBLISHED'), [myListings]);
  const browseListings = useMemo(() => listings.filter((row) => !ownerListingIds.has(row.item_id)), [listings, ownerListingIds]);
  const discoveryCategories = useMemo(() => marketplaceDiscoveryCategories(browseListings), [browseListings]);
  const filteredBrowseListings = useMemo(
    () => filterMarketplaceListings(browseListings, { query: searchQuery, category: selectedCategory }),
    [browseListings, searchQuery, selectedCategory],
  );
  const discoveryActive = searchQuery.trim().length > 0 || selectedCategory !== MARKETPLACE_DISCOVERY_ALL;
  const transactionConversations = useMemo(
    () => conversations.filter((row) => row.status === 'RESERVED' || row.status === 'SOLD' || row.status === 'CLOSED'),
    [conversations],
  );
  const conversationsByItem = useMemo(() => {
    const map = new Map<string, MarketplaceConversation[]>();
    for (const conversation of conversations) {
      const current = map.get(conversation.item_id) ?? [];
      current.push(conversation);
      map.set(conversation.item_id, current);
    }
    return map;
  }, [conversations]);

  function resetDiscovery() {
    setSearchQuery('');
    setSelectedCategory(MARKETPLACE_DISCOVERY_ALL);
  }

  function titleForConversation(conversation: MarketplaceConversation): string {
    return listings.find((row) => row.item_id === conversation.item_id)?.title
      ?? myListings.find((row) => row.item_id === conversation.item_id)?.title
      ?? 'Marketplace Thing';
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    setInterestWarning(null);
    setOwnerListingWarning(null);
    setConversationWarning(null);

    const [listingsResult, interestsResult, ownerListingsResult, conversationsResult] = await Promise.allSettled([
      loadMarketplace(),
      loadMyMarketplaceInterests(),
      loadMyMarketplaceListings(),
      loadMyMarketplaceConversations(),
    ]);

    if (listingsResult.status === 'fulfilled') setListings(listingsResult.value);
    else setError(marketplaceFailureMessage('LOAD_MARKETPLACE'));

    if (interestsResult.status === 'fulfilled') setInterests(interestsResult.value);
    else setInterestWarning('Listings are available, but your saved interest status could not be refreshed.');

    if (ownerListingsResult.status === 'fulfilled') setMyListings(ownerListingsResult.value);
    else setOwnerListingWarning('Marketplace is available, but your own listing status could not be refreshed.');

    if (conversationsResult.status === 'fulfilled') setConversations(conversationsResult.value);
    else setConversationWarning('Marketplace is available, but private conversations could not be refreshed.');

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
      setMessage(interested ? 'Interest sent. You can now message the seller privately.' : 'Interest withdrawn.');
    } catch {
      setMessage(marketplaceFailureMessage('UPDATE_INTEREST'));
    } finally {
      setBusy(false);
    }
  }

  async function startOfferForBuyer(itemId: string) {
    if (busy) return;
    const existing = (conversationsByItem.get(itemId) ?? []).find((row) => row.role === 'BUYER');
    if (existing) {
      setSelectedConversationId(existing.conversation_id);
      return;
    }

    try {
      setBusy(true);
      setMessage(null);
      if (interestByItem.get(itemId) !== 'INTERESTED') {
        const status = await setMyMarketplaceInterest(itemId, true);
        setInterests((current) => {
          const rest = current.filter((row) => row.item_id !== itemId);
          return [...rest, { item_id: itemId, status, updated_at: new Date().toISOString() }];
        });
        setInterestWarning(null);
      }

      const conversationId = await openMyMarketplaceConversation(itemId);
      const refreshed = await loadMyMarketplaceConversations();
      setConversations(refreshed);
      const opened = refreshed.find((row) => row.conversation_id === conversationId);
      if (!opened) throw new Error('Your offer conversation was created but is not available yet. Refresh and try again.');
      setSelectedConversationId(opened.conversation_id);
    } catch {
      setMessage(marketplaceFailureMessage('START_OFFER'));
    } finally {
      setBusy(false);
    }
  }

  if (selectedConversation) {
    return (
      <MarketplaceConversationScreen
        conversation={selectedConversation}
        title={titleForConversation(selectedConversation)}
        onBack={() => { setSelectedConversationId(null); void refresh(); }}
      />
    );
  }

  if (selected) {
    const interested = interestByItem.get(selected.item_id) === 'INTERESTED';
    const buyerConversation = (conversationsByItem.get(selected.item_id) ?? []).find((row) => row.role === 'BUYER');
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity accessibilityRole="button" onPress={() => { setSelectedItemId(null); setMessage(null); }}><Text style={styles.back}>‹ Marketplace</Text></TouchableOpacity>
          </View>

          {selected.image_urls.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailGallery} accessibilityLabel="Public listing photos">
              {selected.image_urls.map((url, index) => <Image key={`${selected.item_id}-${index}`} accessible accessibilityLabel={`Listing photo ${index + 1} of ${selected.image_urls.length}`} source={{ uri: url }} style={styles.detailImage} resizeMode="cover" />)}
            </ScrollView>
          ) : (
            <View accessible accessibilityLabel="No public photos. The seller did not share photos for this listing." style={styles.noPhotoDetail}>
              <View style={styles.noPhotoIcon}><Text style={styles.noPhotoIconText}>PHOTO</Text></View>
              <Text style={styles.noPhotoTitle}>No public photos</Text>
              <Text style={styles.noPhotoCopy}>The seller did not share any photos with this listing. Private Thing photos are not shown here.</Text>
            </View>
          )}

          <View style={styles.detailHero}>
            <Text style={styles.detailPriceLabel}>ASKING PRICE</Text>
            <Text style={styles.detailPrice}>{euro(selected.asking_price_cents)}</Text>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <View style={styles.detailMetaRow}>
              <View style={styles.pillDark}><Text style={styles.pillDarkText}>{selected.category}</Text></View>
              {selected.condition_label ? <Text style={styles.detailMetaText}>{selected.condition_label}</Text> : null}
              {selected.public_location ? <Text style={styles.detailMetaText}>{selected.public_location}</Text> : <Text style={styles.detailMetaText}>Location not shared</Text>}
            </View>
          </View>

          <View style={styles.interestCard}>
            <Text style={styles.interestTitle}>{buyerConversation ? 'Continue your offer and chat' : 'Make an offer'}</Text>
            <Text style={styles.copy}>{buyerConversation ? 'Your private listing conversation keeps offers and messages together.' : 'Start a private listing-bound conversation with the seller.'}</Text>
            {interestWarning ? <Text style={styles.warningText}>{interestWarning}</Text> : null}
            {conversationWarning ? <Text style={styles.warningText}>{conversationWarning}</Text> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={buyerConversation ? 'Open offer and chat' : 'Make an offer'} disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void startOfferForBuyer(selected.item_id)}>
              <Text style={styles.primaryButtonText}>{busy ? 'Opening…' : buyerConversation ? 'Open offer & chat' : 'Make an offer'}</Text>
            </TouchableOpacity>
            {interested && !buyerConversation ? <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.secondaryButton} onPress={() => void changeInterest(selected.item_id, false)}><Text style={styles.secondaryButtonText}>Withdraw interest</Text></TouchableOpacity> : null}
            {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Listing details</Text>
            {selected.public_location ? <View style={styles.detailRow}><Text style={styles.detailKey}>Seller area</Text><Text style={styles.detailValue}>{selected.public_location}</Text></View> : null}
            {selected.public_location && selected.condition_label ? <View style={styles.divider} /> : null}
            {selected.condition_label ? <View style={styles.detailRow}><Text style={styles.detailKey}>Condition</Text><Text style={styles.detailValue}>{selected.condition_label}</Text></View> : null}
            {selected.estimated_value_cents != null ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Things estimate</Text><Text style={styles.detailValue}>{euro(selected.estimated_value_cents)}</Text></View></> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Inventory</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh Marketplace" style={styles.refreshButton} disabled={loading} onPress={() => void refresh()}><Text style={styles.refresh}>{loading ? '…' : '↻'}</Text></TouchableOpacity>
        </View>

        <View style={styles.marketplaceHeader}>
          <Text style={styles.eyebrow}>MARKETPLACE</Text>
          <Text style={styles.title}>Discover Things</Text>
          <Text style={styles.headerCue}>Public listings only · exact seller details stay private</Text>
        </View>

        {loading && listings.length === 0 ? <View style={styles.loadingCard}><ActivityIndicator /><Text style={styles.copy}>Loading marketplace…</Text></View> : null}
        {error ? <View accessibilityRole="alert" style={styles.errorCard}><Text style={styles.errorTitle}>Marketplace unavailable</Text><Text style={styles.errorText}>{error}</Text></View> : null}
        {!error && interestWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Marketplace available</Text><Text style={styles.warningText}>{interestWarning}</Text></View> : null}
        {!error && ownerListingWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Your listings need refresh</Text><Text style={styles.warningText}>{ownerListingWarning}</Text></View> : null}
        {!error && conversationWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Messages need refresh</Text><Text style={styles.warningText}>{conversationWarning}</Text></View> : null}

        {!error && browseListings.length > 0 ? (
          <View style={styles.discoveryBlock}>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Search Marketplace listings"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                placeholder="Search Things, categories or area"
                placeholderTextColor="#98A2B3"
                returnKeyType="search"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {discoveryActive ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear Marketplace search and filters" style={styles.clearButton} onPress={resetDiscovery}><Text style={styles.clearButtonText}>Clear</Text></TouchableOpacity> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow} keyboardShouldPersistTaps="handled">
              {[MARKETPLACE_DISCOVERY_ALL, ...discoveryCategories].map((category) => {
                const selectedChip = selectedCategory === category;
                const label = category === MARKETPLACE_DISCOVERY_ALL ? 'All' : category;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedChip }}
                    accessibilityLabel={`Filter Marketplace by ${label}`}
                    key={category}
                    style={[styles.categoryChip, selectedChip && styles.categoryChipSelected]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, selectedChip && styles.categoryChipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{filteredBrowseListings.length} {filteredBrowseListings.length === 1 ? 'listing' : 'listings'}</Text>
          </View>
        ) : null}

        {!loading && !error && browseListings.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing else for sale yet</Text><Text style={styles.copy}>Published Things from other owners will appear here.</Text></View> : null}
        {!loading && !error && browseListings.length > 0 && filteredBrowseListings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matching listings</Text>
            <Text style={styles.copy}>Try a broader search or switch back to All categories.</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear Marketplace search and filters" style={styles.secondaryButton} onPress={resetDiscovery}><Text style={styles.secondaryButtonText}>Clear search & filters</Text></TouchableOpacity>
          </View>
        ) : null}

        {filteredBrowseListings.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Available now</Text><Text style={styles.sectionMeta}>{discoveryActive ? `${filteredBrowseListings.length} matching` : 'From other sellers'}</Text></View> : null}
        {filteredBrowseListings.map((listing) => {
          const interested = interestByItem.get(listing.item_id) === 'INTERESTED';
          const buyerConversation = (conversationsByItem.get(listing.item_id) ?? []).find((row) => row.role === 'BUYER');
          return (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open listing ${listing.title}, ${euro(listing.asking_price_cents)}`} key={listing.item_id} style={styles.card} onPress={() => { setSelectedItemId(listing.item_id); setMessage(null); }}>
              {listing.image_urls[0] ? (
                <Image accessible accessibilityLabel={`Cover photo for ${listing.title}`} source={{ uri: listing.image_urls[0] }} style={styles.listingImage} resizeMode="cover" />
              ) : (
                <View accessible accessibilityLabel={`No public photo for ${listing.title}`} style={styles.listingImagePlaceholder}>
                  <Text style={styles.listingImagePlaceholderLabel}>NO PUBLIC PHOTO</Text>
                  <Text style={styles.listingImagePlaceholderText}>Seller chose not to share a photo</Text>
                </View>
              )}
              <View style={styles.listingBody}>
                <Text style={styles.askLabel}>ASKING PRICE</Text>
                <Text style={styles.ask}>{euro(listing.asking_price_cents)}</Text>
                <Text style={styles.itemTitle}>{listing.title}</Text>
                <View style={styles.listingMetaRow}>
                  <Text style={styles.listingMeta}>{listing.public_location ?? 'Location not shared'}</Text>
                  {listing.condition_label ? <Text style={styles.listingMeta}>· {listing.condition_label}</Text> : null}
                  <Text style={styles.listingMeta}>· {listing.category}</Text>
                </View>
                {interested ? <View style={styles.interestedChip}><Text style={styles.interestedChipText}>{buyerConversation ? 'Conversation open' : 'Interested'}</Text></View> : null}
              </View>
            </TouchableOpacity>
          );
        })}

        {(transactionConversations.length > 0 || publishedMine.length > 0) ? <View style={styles.manageDivider}><Text style={styles.manageEyebrow}>YOUR MARKETPLACE</Text><Text style={styles.manageTitle}>Manage your activity</Text><Text style={styles.copy}>Transactions and listings stay separate from public browsing.</Text></View> : null}

        {transactionConversations.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your transactions</Text><Text style={styles.sectionMeta}>{transactionConversations.length}</Text></View> : null}
        {transactionConversations.map((conversation) => (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${conversation.role === 'BUYER' ? 'buying' : 'selling'} transaction, ${conversationStatusLabel(conversation.status)}`} key={conversation.conversation_id} style={styles.messageRow} onPress={() => setSelectedConversationId(conversation.conversation_id)}>
            <View style={styles.messageCopy}><Text style={styles.messageRowTitle}>{titleForConversation(conversation)}</Text><Text style={styles.messageRowMeta}>{conversation.role === 'BUYER' ? 'Buying' : 'Selling'} · {conversationStatusLabel(conversation.status)} · updated {new Date(conversation.updated_at).toLocaleString()}</Text></View>
            <Text style={styles.messageRowAction}>Open ›</Text>
          </TouchableOpacity>
        ))}

        {publishedMine.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your listings</Text><Text style={styles.sectionMeta}>{publishedMine.length} for sale</Text></View> : null}
        {publishedMine.map((ownerListing) => {
          const sellerConversations = (conversationsByItem.get(ownerListing.item_id) ?? []).filter((row) => row.role === 'SELLER');
          return (
            <View key={ownerListing.item_id} style={styles.ownerCard}>
              <View style={styles.cardTop}><View style={styles.ownerPill}><Text style={styles.ownerPillText}>FOR SALE</Text></View><Text style={styles.ask}>{euro(ownerListing.asking_price_cents)}</Text></View>
              <Text style={styles.itemTitle}>{ownerListing.title ?? 'Your Thing'}</Text>
              <View style={styles.metaRow}>
                {ownerListing.category ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{ownerListing.category}</Text></View> : null}
                {ownerListing.public_location ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{ownerListing.public_location}</Text></View> : null}
                {sellerConversations.length > 0 ? <View style={styles.interestedChip}><Text style={styles.interestedChipText}>{sellerConversations.length} {sellerConversations.length === 1 ? 'conversation' : 'conversations'}</Text></View> : null}
              </View>
              <Text style={styles.copy}>Published on Marketplace · linked to your private inventory item{ownerListing.public_location ? ' · coarse location public' : ' · location not shared'}.</Text>
              {sellerConversations.map((conversation, index) => (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open conversation with interested buyer ${index + 1}, ${conversationStatusLabel(conversation.status)}`} key={conversation.conversation_id} style={styles.messageRow} onPress={() => setSelectedConversationId(conversation.conversation_id)}>
                  <View style={styles.messageCopy}><Text style={styles.messageRowTitle}>Interested buyer {index + 1}</Text><Text style={styles.messageRowMeta}>{conversationStatusLabel(conversation.status)} · updated {new Date(conversation.updated_at).toLocaleString()}</Text></View>
                  <Text style={styles.messageRowAction}>Reply ›</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FCFDFE' },
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 64, gap: 17 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 16, fontWeight: '900', color: '#334155', paddingVertical: 10 },
  refreshButton: { width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  refresh: { fontSize: 19, fontWeight: '900', color: '#334155' },
  marketplaceHeader: { gap: 5, paddingVertical: 2 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: '#8B95A5' },
  title: { fontSize: 33, lineHeight: 39, fontWeight: '900', letterSpacing: -1.15, color: '#0B1323' },
  headerCue: { fontSize: 12, lineHeight: 18, color: '#7C8798' },
  copy: { fontSize: 13, lineHeight: 19, color: '#758196' },
  discoveryBlock: { gap: 11 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minHeight: 50, borderRadius: 17, borderWidth: 1, borderColor: '#E1E6EC', backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#0C1628', shadowColor: '#0B1323', shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  categoryRow: { gap: 9, paddingRight: 4 },
  categoryChip: { minHeight: 42, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#E1E6EC', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 9 },
  categoryChipSelected: { backgroundColor: '#0C1628', borderColor: '#0C1628' },
  categoryChipText: { fontSize: 12, fontWeight: '800', color: '#5C687A' },
  categoryChipTextSelected: { color: '#FFFFFF' },
  clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  clearButtonText: { fontSize: 12, fontWeight: '900', color: '#334155' },
  resultCount: { fontSize: 11, fontWeight: '800', color: '#7C8798' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.25, color: '#0C1628' },
  sectionMeta: { fontSize: 12, color: '#7C8798' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  listingImage: { width: '100%', height: 220, backgroundColor: '#EEF2F6' },
  listingImagePlaceholder: { width: '100%', height: 220, backgroundColor: '#F4F6F8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  listingImagePlaceholderLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: '#98A2B3' },
  listingImagePlaceholderText: { fontSize: 12, lineHeight: 18, fontWeight: '800', textAlign: 'center', color: '#667085' },
  listingBody: { paddingHorizontal: 17, paddingVertical: 16, gap: 5 },
  askLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#8994A6' },
  ask: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.5, color: '#0C1628' },
  itemTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.2, color: '#0C1628' },
  listingMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 3 },
  listingMeta: { fontSize: 12, lineHeight: 18, color: '#758196' },
  interestedChip: { alignSelf: 'flex-start', marginTop: 5, borderRadius: 999, backgroundColor: '#E8F5EE', paddingHorizontal: 10, paddingVertical: 6 },
  interestedChipText: { fontSize: 10, fontWeight: '900', color: '#26734D' },
  detailGallery: { gap: 10, paddingRight: 4 },
  detailImage: { width: 300, height: 250, borderRadius: 24, backgroundColor: '#EEF2F6' },
  noPhotoDetail: { minHeight: 240, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EDF2', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 9 },
  noPhotoIcon: { minWidth: 76, minHeight: 44, borderRadius: 999, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  noPhotoIconText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: '#667085' },
  noPhotoTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: '#0C1628' },
  noPhotoCopy: { maxWidth: 300, fontSize: 12, lineHeight: 18, textAlign: 'center', color: '#667085' },
  detailHero: { backgroundColor: '#0C1628', borderRadius: 28, padding: 22, gap: 7, shadowColor: '#0B1323', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  detailPriceLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, color: '#9BA7B8' },
  detailPrice: { fontSize: 35, lineHeight: 41, fontWeight: '900', letterSpacing: -0.9, color: '#FFFFFF' },
  detailTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.6, color: '#FFFFFF', marginTop: 2 },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  detailMetaText: { fontSize: 12, color: '#C8D0DB' },
  pillDark: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#26354C', paddingHorizontal: 10, paddingVertical: 6 },
  pillDarkText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 19, gap: 13, borderWidth: 1, borderColor: '#E9EDF2' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  detailKey: { flex: 1, fontSize: 13, color: '#667085' },
  detailValue: { flexShrink: 1, fontSize: 14, fontWeight: '900', color: '#0C1628', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#EEF1F4' },
  interestCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 11, borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  interestTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: '#0C1628' },
  primaryButton: { minHeight: 54, backgroundColor: '#0C1628', borderRadius: 17, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#DCE2E8', paddingHorizontal: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#475467', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  feedback: { fontSize: 12, lineHeight: 18, color: '#26734D' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 10, alignItems: 'center' },
  errorCard: { backgroundColor: '#FEF3F2', borderRadius: 20, padding: 18, gap: 5 },
  errorTitle: { fontSize: 15, fontWeight: '900', color: '#B42318' },
  errorText: { fontSize: 12, lineHeight: 18, color: '#B42318' },
  warningCard: { backgroundColor: '#FFF7ED', borderRadius: 18, padding: 15, gap: 5 },
  warningTitle: { fontSize: 14, fontWeight: '900', color: '#9A3412' },
  warningText: { fontSize: 12, lineHeight: 18, color: '#9A3412' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, gap: 10, borderWidth: 1, borderColor: '#E9EDF2' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0C1628' },
  manageDivider: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#DDE2E8', paddingTop: 24, gap: 5 },
  manageEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#7C8798' },
  manageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#0C1628' },
  ownerCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 9, borderWidth: 1, borderColor: '#B7E4C7' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  ownerPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 6 },
  ownerPillText: { color: '#166534', fontSize: 10, fontWeight: '900' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metaChip: { borderRadius: 999, backgroundColor: '#F2F4F7', paddingHorizontal: 9, paddingVertical: 5 },
  metaChipText: { fontSize: 10, fontWeight: '700', color: '#667085' },
  messageRow: { marginTop: 4, minHeight: 54, padding: 13, borderRadius: 15, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E8ED', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  messageCopy: { flex: 1 },
  messageRowTitle: { fontSize: 13, fontWeight: '900', color: '#0C1628' },
  messageRowMeta: { marginTop: 3, fontSize: 10, color: '#7A8494' },
  messageRowAction: { fontSize: 12, fontWeight: '900', color: '#344054' },
});