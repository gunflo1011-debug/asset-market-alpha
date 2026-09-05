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
    else setError(listingsResult.reason instanceof Error ? listingsResult.reason.message : 'Could not load marketplace.');

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
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not update interest.');
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
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not start your offer.');
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
            <View style={styles.cardTop}><View style={styles.pillDark}><Text style={styles.pillDarkText}>{selected.category}</Text></View><Text style={styles.detailPrice}>{euro(selected.asking_price_cents)}</Text></View>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <Text style={styles.detailSubtitle}>{selected.public_location ? `Private seller · ${selected.public_location} · exact address hidden` : 'Private seller · location not shared'}</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Listing details</Text>
            <View style={styles.detailRow}><Text style={styles.detailKey}>Asking price</Text><Text style={styles.detailValue}>{euro(selected.asking_price_cents)}</Text></View>
            {selected.public_location ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Seller area</Text><Text style={styles.detailValue}>{selected.public_location}</Text></View></> : null}
            {selected.condition_label ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Condition</Text><Text style={styles.detailValue}>{selected.condition_label}</Text></View></> : null}
            {selected.estimated_value_cents != null ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Things estimate</Text><Text style={styles.detailValue}>{euro(selected.estimated_value_cents)}</Text></View></> : null}
          </View>

          <View style={styles.interestCard}>
            <Text style={styles.eyebrow}>MAKE AN OFFER</Text>
            <Text style={styles.interestTitle}>{buyerConversation ? 'Continue your offer and chat' : 'Make an offer securely'}</Text>
            <Text style={styles.copy}>{buyerConversation ? 'Your listing-bound conversation keeps offers and messages together. Account emails, exact addresses and private inventory details stay hidden.' : 'Start a private listing-bound conversation and enter the price you want to offer. Your email, exact address and private inventory stay hidden.'}</Text>
            {interestWarning ? <Text style={styles.warningText}>{interestWarning}</Text> : null}
            {conversationWarning ? <Text style={styles.warningText}>{conversationWarning}</Text> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={buyerConversation ? 'Open offer and chat' : 'Make an offer'} disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void startOfferForBuyer(selected.item_id)}>
              <Text style={styles.primaryButtonText}>{busy ? 'Opening…' : buyerConversation ? 'Open offer & chat' : 'Make an offer'}</Text>
            </TouchableOpacity>
            {interested && !buyerConversation ? <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.secondaryButton} onPress={() => void changeInterest(selected.item_id, false)}><Text style={styles.secondaryButtonText}>Withdraw interest</Text></TouchableOpacity> : null}
            {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
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

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MARKETPLACE</Text>
          <Text style={styles.title}>Discover Things for sale</Text>
          <Text style={styles.heroCopy}>Search public listings, compare asking prices and make an offer without exposing private inventory details.</Text>
          <View style={styles.heroStats}><Text style={styles.heroStatValue}>{browseListings.length}</Text><Text style={styles.heroStatLabel}>{browseListings.length === 1 ? 'listing from others' : 'listings from others'}</Text></View>
        </View>

        {loading && listings.length === 0 ? <View style={styles.loadingCard}><ActivityIndicator /><Text style={styles.copy}>Loading marketplace…</Text></View> : null}
        {error ? <View accessibilityRole="alert" style={styles.errorCard}><Text style={styles.errorTitle}>Marketplace unavailable</Text><Text style={styles.errorText}>{error}</Text></View> : null}
        {!error && interestWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Marketplace available</Text><Text style={styles.warningText}>{interestWarning}</Text></View> : null}
        {!error && ownerListingWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Your listings need refresh</Text><Text style={styles.warningText}>{ownerListingWarning}</Text></View> : null}
        {!error && conversationWarning ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Messages need refresh</Text><Text style={styles.warningText}>{conversationWarning}</Text></View> : null}

        {!error && browseListings.length > 0 ? (
          <View style={styles.discoveryCard}>
            <View style={styles.discoveryHeader}>
              <View style={styles.discoveryHeadingCopy}>
                <Text style={styles.sectionTitle}>Find something</Text>
                <Text style={styles.discoveryHint}>Search title, category or seller area. Only public listing details are searched.</Text>
              </View>
              {discoveryActive ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear Marketplace search and filters" style={styles.clearButton} onPress={resetDiscovery}><Text style={styles.clearButtonText}>Clear</Text></TouchableOpacity> : null}
            </View>
            <TextInput
              accessibilityLabel="Search Marketplace listings"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search title, category or area"
              placeholderTextColor="#98A2B3"
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
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
            <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{filteredBrowseListings.length} {filteredBrowseListings.length === 1 ? 'listing' : 'listings'} shown</Text>
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
              <View style={styles.cardTop}><View style={styles.pill}><Text style={styles.pillText}>{listing.category}</Text></View><Text style={styles.ask}>{euro(listing.asking_price_cents)}</Text></View>
              <Text style={styles.itemTitle}>{listing.title}</Text>
              <View style={styles.metaRow}>
                {listing.public_location ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{listing.public_location}</Text></View> : null}
                {listing.condition_label ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{listing.condition_label}</Text></View> : null}
                {listing.estimated_value_cents != null ? <View style={styles.metaChip}><Text style={styles.metaChipText}>Estimate {euro(listing.estimated_value_cents)}</Text></View> : null}
                {listing.image_urls.length > 1 ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{listing.image_urls.length} photos</Text></View> : null}
                {interested ? <View style={styles.interestedChip}><Text style={styles.interestedChipText}>{buyerConversation ? 'Conversation' : 'Interested'}</Text></View> : null}
              </View>
              <View style={styles.cardFooter}><Text style={styles.footerLabel}>{listing.public_location ?? 'Location not shared'}</Text><Text style={styles.footerPrivacy}>{buyerConversation ? 'Open messages ›' : 'Private seller ›'}</Text></View>
            </TouchableOpacity>
          );
        })}

        {(transactionConversations.length > 0 || publishedMine.length > 0) ? <View style={styles.manageDivider}><Text style={styles.manageEyebrow}>YOUR MARKETPLACE</Text><Text style={styles.manageTitle}>Manage your activity</Text><Text style={styles.copy}>Transactions and listings stay available below without interrupting browsing.</Text></View> : null}

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
  safe: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { padding: 20, paddingTop: 18, paddingBottom: 56, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 16, fontWeight: '800', color: '#344054', paddingVertical: 10 },
  refreshButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  refresh: { fontSize: 19, fontWeight: '800', color: '#344054' },
  hero: { backgroundColor: '#0F1728', borderRadius: 28, padding: 22, gap: 9 },
  heroCopy: { fontSize: 13, lineHeight: 19, color: '#C5CBD4' },
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
  discoveryCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 12, borderWidth: 1, borderColor: '#E5E8ED' },
  discoveryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  discoveryHeadingCopy: { flex: 1, gap: 4 },
  discoveryHint: { fontSize: 11, lineHeight: 16, color: '#7A8494' },
  searchInput: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#0F1728' },
  categoryRow: { gap: 8, paddingRight: 4 },
  categoryChip: { minHeight: 44, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#E5E8ED', backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 9 },
  categoryChipSelected: { backgroundColor: '#0F1728', borderColor: '#0F1728' },
  categoryChipText: { fontSize: 12, fontWeight: '800', color: '#475467' },
  categoryChipTextSelected: { color: '#FFFFFF' },
  clearButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  clearButtonText: { fontSize: 12, fontWeight: '800', color: '#344054' },
  resultCount: { fontSize: 11, fontWeight: '700', color: '#667085' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  sectionMeta: { fontSize: 12, color: '#7A8494' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 11, borderWidth: 1, borderColor: '#E5E8ED' },
  listingImage: { width: '100%', height: 190, borderRadius: 16, backgroundColor: '#EEF0F3' },
  listingImagePlaceholder: { width: '100%', height: 190, borderRadius: 16, backgroundColor: '#F4F6F8', borderWidth: 1, borderColor: '#E5E8ED', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  listingImagePlaceholderLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: '#98A2B3' },
  listingImagePlaceholderText: { fontSize: 12, lineHeight: 18, fontWeight: '700', textAlign: 'center', color: '#667085' },
  detailGallery: { gap: 10, paddingRight: 4 },
  detailImage: { width: 280, height: 220, borderRadius: 20, backgroundColor: '#EEF0F3' },
  noPhotoDetail: { minHeight: 220, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 9 },
  noPhotoIcon: { minWidth: 76, minHeight: 44, borderRadius: 999, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  noPhotoIconText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: '#667085' },
  noPhotoTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#0F1728' },
  noPhotoCopy: { maxWidth: 300, fontSize: 12, lineHeight: 18, textAlign: 'center', color: '#667085' },
  ownerCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 9, borderWidth: 1, borderColor: '#B7E4C7' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { color: '#3448A5', fontSize: 10, fontWeight: '800' },
  pillDark: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#243046', paddingHorizontal: 10, paddingVertical: 6 },
  pillDarkText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  ownerPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 6 },
  ownerPillText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  ask: { fontSize: 22, fontWeight: '800', color: '#0F1728' },
  itemTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: '#0F1728' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metaChip: { borderRadius: 999, backgroundColor: '#F2F4F7', paddingHorizontal: 9, paddingVertical: 5 },
  metaChipText: { fontSize: 10, fontWeight: '700', color: '#667085' },
  interestedChip: { borderRadius: 999, backgroundColor: '#E8F5EE', paddingHorizontal: 9, paddingVertical: 5 },
  interestedChipText: { fontSize: 10, fontWeight: '800', color: '#26734D' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEF0F3', paddingTop: 11 },
  footerLabel: { fontSize: 11, color: '#667085' },
  footerPrivacy: { fontSize: 11, fontWeight: '800', color: '#344054' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 13, borderWidth: 1, borderColor: '#E5E8ED' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  detailKey: { flex: 1, fontSize: 13, color: '#667085' },
  detailValue: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: '#0F1728', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#EEF0F3' },
  interestCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 11, borderWidth: 1, borderColor: '#E5E8ED' },
  interestTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: '#0F1728' },
  primaryButton: { backgroundColor: '#0F1728', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 44, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#475467', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  feedback: { fontSize: 12, lineHeight: 18, color: '#26734D' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 10, alignItems: 'center' },
  errorCard: { backgroundColor: '#FEF3F2', borderRadius: 20, padding: 18, gap: 5 },
  errorTitle: { fontSize: 15, fontWeight: '800', color: '#B42318' },
  errorText: { fontSize: 12, lineHeight: 18, color: '#B42318' },
  warningCard: { backgroundColor: '#FFF7ED', borderRadius: 18, padding: 15, gap: 5 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412' },
  warningText: { fontSize: 12, lineHeight: 18, color: '#9A3412' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, gap: 10, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  manageDivider: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#DDE2E8', paddingTop: 24, gap: 5 },
  manageEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#7A8494' },
  manageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#0F1728' },
  messageRow: { marginTop: 4, minHeight: 54, padding: 13, borderRadius: 15, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E8ED', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  messageCopy: { flex: 1 },
  messageRowTitle: { fontSize: 13, fontWeight: '800', color: '#0F1728' },
  messageRowMeta: { marginTop: 3, fontSize: 10, color: '#7A8494' },
  messageRowAction: { fontSize: 12, fontWeight: '800', color: '#344054' },
});