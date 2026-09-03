import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadInterestSummaryForMyListings, loadMyMarketplaceListings, saveMyMarketplaceListing, withdrawMyMarketplaceListing } from '../../data/inventory';
import { loadMarketValueForMyItem, type MarketValueInsight } from '../../data/inventoryQueries';
import { loadMyItemImages, syncMyMarketplaceImageProjections, type ItemImage } from '../../data/itemImages';
import type { OwnerMarketplaceListing } from '../inventory/types';

type Props = {
  itemId: string;
  estimatedValueCents: number | null;
};

type PreviewState = 'loading' | 'ready' | 'error';

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function marketplaceSelection(images: ItemImage[]): ItemImage[] {
  return images.filter((image) => image.marketplaceVisible).slice(0, 6);
}

function selectionKey(images: ItemImage[]): string {
  return images.map((image) => image.id).join('|');
}

export function SellListingPanel({ itemId, estimatedValueCents }: Props) {
  const [listing, setListing] = useState<OwnerMarketplaceListing | null>(null);
  const [interestCount, setInterestCount] = useState(0);
  const [marketValue, setMarketValue] = useState<MarketValueInsight | null>(null);
  const [price, setPrice] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>('loading');
  const [selectedMarketplaceImages, setSelectedMarketplaceImages] = useState<ItemImage[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadMyMarketplaceListings(),
      loadInterestSummaryForMyListings(),
      loadMarketValueForMyItem(itemId).catch(() => null),
    ]).then(([rows, summaries, insight]) => {
      if (!active) return;
      const existing = rows.find((row) => row.item_id === itemId) ?? null;
      const summary = summaries.find((row) => row.item_id === itemId) ?? null;
      setListing(existing);
      setInterestCount(summary?.interested_count ?? 0);
      setMarketValue(insight);
      if (existing) {
        setPrice(String(existing.asking_price_cents / 100));
        setPublicLocation(existing.public_location ?? '');
      }
    }).catch(() => { if (active) setStatus('Could not load listing state.'); });

    setPreviewState('loading');
    void loadMyItemImages(itemId).then((images) => {
      if (!active) return;
      setSelectedMarketplaceImages(marketplaceSelection(images));
      setPreviewState('ready');
    }).catch(() => {
      if (!active) return;
      setSelectedMarketplaceImages([]);
      setPreviewState('error');
    });

    return () => { active = false; };
  }, [itemId]);

  const parsed = useMemo(() => {
    const euros = Number(price.replace(',', '.').trim());
    return { valid: Number.isFinite(euros) && euros > 0 && euros <= 10_000_000, cents: Math.round(euros * 100) };
  }, [price]);
  const normalizedLocation = publicLocation.trim();
  const locationValid = normalizedLocation.length <= 80;
  const published = listing?.status === 'PUBLISHED';
  const displayedMarketplacePrice = listing?.asking_price_cents ?? null;
  const suggestedMarketPrice = marketValue?.marketValueCents ?? null;
  const publishDisabled = !parsed.valid || !locationValid || busy || previewState !== 'ready';

  async function reloadMarketplacePreview() {
    if (busy) return;
    try {
      setPreviewState('loading');
      const images = marketplaceSelection(await loadMyItemImages(itemId));
      setSelectedMarketplaceImages(images);
      setPreviewState('ready');
    } catch {
      setSelectedMarketplaceImages([]);
      setPreviewState('error');
    }
  }

  async function save(publish: boolean) {
    if (!parsed.valid || !locationValid || busy || (publish && previewState !== 'ready')) return;
    try {
      setBusy(true);
      setStatus(null);
      let imageCount = 0;
      if (publish) {
        const freshSelection = marketplaceSelection(await loadMyItemImages(itemId));
        if (selectionKey(freshSelection) !== selectionKey(selectedMarketplaceImages)) {
          setSelectedMarketplaceImages(freshSelection);
          setPreviewState('ready');
          setStatus('Your Marketplace photo selection changed. Review the updated preview, then tap Publish again. Nothing was published yet.');
          return;
        }
        imageCount = await syncMyMarketplaceImageProjections(itemId);
      }
      const nextStatus = await saveMyMarketplaceListing(itemId, parsed.cents, publish, normalizedLocation || null);
      setListing({
        item_id: itemId,
        asking_price_cents: parsed.cents,
        public_location: normalizedLocation || null,
        status: nextStatus,
        published_at: publish ? new Date().toISOString() : null,
      });
      setStatus(publish
        ? `${published ? 'Marketplace price updated' : 'Published on Marketplace'} at ${euro(parsed.cents)}${imageCount > 0 ? ` with ${imageCount} selected ${imageCount === 1 ? 'photo' : 'photos'}` : ' with no public photos'}${normalizedLocation ? ` · ${normalizedLocation}` : ''}.`
        : `Draft saved with seller asking price ${euro(parsed.cents)}. This item is still private.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this listing.');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    try {
      setBusy(true);
      setStatus(null);
      await withdrawMyMarketplaceListing(itemId);
      setListing((current) => current ? { ...current, status: 'WITHDRAWN', published_at: null } : current);
      setStatus('Removed from marketplace. Selected photo projections are no longer readable by buyers.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not remove this listing.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{published ? 'PUBLISHED MARKETPLACE PRICE' : 'SELLER ASKING PRICE'}</Text>
          <Text style={styles.title}>{published ? 'Marketplace listing' : 'Choose your selling price'}</Text>
        </View>
        <View style={[styles.statusPill, published && styles.statusPillLive]}><Text style={[styles.statusPillText, published && styles.statusPillTextLive]}>{published ? 'Live' : 'Private'}</Text></View>
      </View>

      {published ? <View style={styles.publishedPrice}><Text style={styles.publishedPriceLabel}>BUYERS CURRENTLY SEE</Text><Text style={styles.publishedPriceValue}>{displayedMarketplacePrice != null ? euro(displayedMarketplacePrice) : '—'}</Text></View> : null}
      {published ? <View style={styles.interestSummary}><View><Text style={styles.interestLabel}>BUYER INTEREST</Text><Text style={styles.interestTitle}>{interestCount === 0 ? 'No interest yet' : `${interestCount} ${interestCount === 1 ? 'person is' : 'people are'} interested`}</Text></View><Text style={styles.interestCount}>{interestCount}</Text></View> : null}

      {suggestedMarketPrice != null && marketValue ? (
        <View style={styles.marketValueCard}>
          <View style={styles.flex}>
            <Text style={styles.marketValueLabel}>THINGS MARKET VALUE</Text>
            <Text style={styles.marketValueAmount}>{euro(suggestedMarketPrice)}</Text>
            <Text style={styles.marketValueHint}>{marketValue.source === 'SOLD_MEDIAN' ? `Median of ${marketValue.sampleCount} completed sales` : `Median of ${marketValue.sampleCount} active listings`} · exact product match</Text>
          </View>
          <TouchableOpacity style={styles.useSuggestion} onPress={() => setPrice(String(suggestedMarketPrice / 100))} accessibilityRole="button" accessibilityLabel={`Use Things Market Value ${euro(suggestedMarketPrice)} as asking price`}>
            <Text style={styles.useSuggestionText}>Use price</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.marketValuePending}>
          <Text style={styles.marketValuePendingTitle}>Market value needs more data</Text>
          <Text style={styles.marketValuePendingText}>Things only suggests a market price after at least 3 independent exact-product observations. Completed sales are preferred; otherwise active listings are used. No fuzzy title guess is shown.</Text>
        </View>
      )}

      {estimatedValueCents != null ? <View style={styles.referenceRow}><View style={styles.flex}><Text style={styles.referenceLabel}>Personal estimate</Text><Text style={styles.referenceHint}>Based on your inputs · reference only · never auto-published</Text></View><Text style={styles.referenceValue}>{euro(estimatedValueCents)}</Text></View> : null}

      <Text style={styles.label}>{published ? 'New marketplace price (€)' : 'Seller asking price (€)'}</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder={suggestedMarketPrice != null ? `Market suggestion ${euro(suggestedMarketPrice)}` : estimatedValueCents != null ? `Choose a price · personal estimate ${euro(estimatedValueCents)}` : 'e.g. 90'} style={styles.input} accessibilityLabel="Seller asking price in euros" />
      <Text style={styles.priceHint}>{published ? 'Changing this value does nothing until you tap Update listing. After that, this exact price becomes the buyer-visible Marketplace price.' : 'You choose this price yourself. Market Value and Personal Estimate are references only and are never copied into the listing automatically.'}</Text>

      <Text style={styles.label}>Marketplace location (optional)</Text>
      <TextInput
        value={publicLocation}
        onChangeText={setPublicLocation}
        autoCapitalize="words"
        maxLength={80}
        placeholder="City or town, e.g. Hambrücken"
        style={styles.locationInput}
        accessibilityLabel="Public Marketplace city or town"
      />
      <View style={styles.privacyHint}>
        <Text style={styles.privacyHintTitle}>City/town only</Text>
        <Text style={styles.privacyHintText}>This text becomes public when you publish. Things never copies your private inventory location automatically. Do not enter a street address.</Text>
      </View>

      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.flex}>
            <Text style={styles.previewEyebrow}>PUBLIC LISTING PREVIEW</Text>
            <Text style={styles.previewTitle}>{published ? 'What buyers will see after update' : 'Review before publishing'}</Text>
          </View>
          <TouchableOpacity disabled={busy || previewState === 'loading'} onPress={() => void reloadMarketplacePreview()} style={styles.refreshPreview} accessibilityRole="button" accessibilityLabel="Refresh Marketplace photo preview">
            <Text style={styles.refreshPreviewText}>{previewState === 'loading' ? 'Checking…' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.previewFacts}>
          <View style={styles.previewFact}><Text style={styles.previewFactLabel}>ASKING PRICE</Text><Text style={styles.previewFactValue}>{parsed.valid ? euro(parsed.cents) : 'Add price'}</Text></View>
          <View style={styles.previewFact}><Text style={styles.previewFactLabel}>PUBLIC LOCATION</Text><Text style={styles.previewFactValue}>{normalizedLocation || 'Not shown'}</Text></View>
        </View>
        {previewState === 'error' ? (
          <View style={styles.previewError}>
            <Text style={styles.previewErrorTitle}>Photos could not be verified</Text>
            <Text style={styles.previewErrorText}>Publishing is paused until Things can confirm which photos are selected. Your private photos remain unchanged.</Text>
          </View>
        ) : previewState === 'loading' ? (
          <Text style={styles.previewLoading}>Checking your Marketplace photo selection…</Text>
        ) : selectedMarketplaceImages.length > 0 ? (
          <View>
            <Text style={styles.previewPhotosLabel}>{selectedMarketplaceImages.length} {selectedMarketplaceImages.length === 1 ? 'PHOTO' : 'PHOTOS'} SELECTED FOR MARKETPLACE</Text>
            <View style={styles.previewPhotos}>
              {selectedMarketplaceImages.map((image, index) => (
                <View key={image.id} style={styles.previewPhotoWrap}>
                  <Image source={{ uri: image.signedUrl }} style={styles.previewPhoto} accessibilityLabel={`Marketplace photo ${index + 1} of ${selectedMarketplaceImages.length}`} />
                  {index === 0 ? <View style={styles.firstPhotoChip}><Text style={styles.firstPhotoChipText}>FIRST</Text></View> : null}
                </View>
              ))}
            </View>
            <Text style={styles.previewSafety}>Only these selected photos will be copied to the buyer-facing image store when you publish or update.</Text>
          </View>
        ) : (
          <View style={styles.noPhotos}>
            <Text style={styles.noPhotosTitle}>No public photos selected</Text>
            <Text style={styles.noPhotosText}>You can publish without photos. Private Thing photos stay private unless you explicitly mark them “Use in listing”.</Text>
          </View>
        )}
      </View>

      <Text style={styles.copy}>Nothing becomes visible to other users until you explicitly publish. The preview above is the final privacy check for price, coarse location and selected photos.</Text>

      <TouchableOpacity disabled={publishDisabled} accessibilityRole="button" accessibilityState={{ disabled: publishDisabled, busy }} style={[styles.primary, publishDisabled && styles.disabled]} onPress={() => void save(true)}>
        <Text style={styles.primaryText}>{busy ? 'Saving…' : published ? `Update listing${parsed.valid ? ` to ${euro(parsed.cents)}` : ''}` : `Publish${parsed.valid ? ` at ${euro(parsed.cents)}` : ''}`}</Text>
      </TouchableOpacity>
      {!published ? <TouchableOpacity disabled={!parsed.valid || !locationValid || busy} accessibilityRole="button" accessibilityState={{ disabled: !parsed.valid || !locationValid || busy, busy }} style={[styles.secondary, (!parsed.valid || !locationValid || busy) && styles.disabled]} onPress={() => void save(false)}><Text style={styles.secondaryText}>Save private draft</Text></TouchableOpacity> : null}
      {published ? <TouchableOpacity disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} style={[styles.withdraw, busy && styles.disabled]} onPress={() => void withdraw()}><Text style={styles.withdrawText}>Remove listing</Text></TouchableOpacity> : null}

      {status ? <View style={styles.feedback} accessibilityRole="alert"><Text style={styles.status}>{status}</Text></View> : null}
      <Text style={styles.disclaimer}>Buyer interest is shown only as a count. Buyer identity, email and exact location are not exposed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 19, gap: 12, borderWidth: 1, borderColor: '#E5E8ED' },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#7A8494' },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: '#0F1728', marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F0F2F5' },
  statusPillLive: { backgroundColor: '#ECFDF3' },
  statusPillText: { fontSize: 11, fontWeight: '800', color: '#667085' },
  statusPillTextLive: { color: '#027A48' },
  publishedPrice: { borderRadius: 16, padding: 15, backgroundColor: '#0F1728' },
  publishedPriceLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#98A2B3' },
  publishedPriceValue: { marginTop: 4, fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#FFFFFF' },
  interestSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#F0F7F3', borderRadius: 16, padding: 14 },
  interestLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#027A48' },
  interestTitle: { fontSize: 14, fontWeight: '800', color: '#174C35', marginTop: 3 },
  interestCount: { fontSize: 28, fontWeight: '800', color: '#027A48' },
  marketValueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#C7D7FE' },
  marketValueLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#3538CD' },
  marketValueAmount: { marginTop: 2, fontSize: 24, fontWeight: '800', color: '#101828' },
  marketValueHint: { marginTop: 2, fontSize: 10, lineHeight: 15, color: '#475467' },
  useSuggestion: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3538CD' },
  useSuggestionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  marketValuePending: { borderRadius: 14, padding: 12, backgroundColor: '#F8F9FB', gap: 3 },
  marketValuePendingTitle: { fontSize: 12, fontWeight: '800', color: '#344054' },
  marketValuePendingText: { fontSize: 11, lineHeight: 17, color: '#667085' },
  referenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#F8F9FB', borderRadius: 14, padding: 13 },
  referenceLabel: { fontSize: 12, fontWeight: '700', color: '#475467' },
  referenceHint: { fontSize: 10, color: '#98A2B3', marginTop: 2 },
  referenceValue: { fontSize: 15, fontWeight: '800', color: '#0F1728' },
  label: { fontSize: 13, fontWeight: '800', color: '#344054', marginTop: 2 },
  input: { minHeight: 58, borderWidth: 1, borderColor: '#D9DEE6', borderRadius: 15, paddingHorizontal: 16, fontSize: 22, fontWeight: '800', color: '#0F1728', backgroundColor: '#FFFFFF' },
  priceHint: { fontSize: 11, lineHeight: 17, color: '#667085', marginTop: -4 },
  locationInput: { minHeight: 52, borderWidth: 1, borderColor: '#D9DEE6', borderRadius: 15, paddingHorizontal: 14, fontSize: 16, color: '#0F1728', backgroundColor: '#FFFFFF' },
  privacyHint: { borderRadius: 14, padding: 12, backgroundColor: '#F8F9FB', gap: 3 },
  privacyHintTitle: { fontSize: 12, fontWeight: '800', color: '#344054' },
  privacyHintText: { fontSize: 11, lineHeight: 17, color: '#667085' },
  previewCard: { borderRadius: 18, padding: 14, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E8ED', gap: 12 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#667085' },
  previewTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: '#0F1728', marginTop: 3 },
  refreshPreview: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DEE6' },
  refreshPreviewText: { fontSize: 12, fontWeight: '800', color: '#344054' },
  previewFacts: { flexDirection: 'row', gap: 8 },
  previewFact: { flex: 1, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 11, borderWidth: 1, borderColor: '#EAECF0' },
  previewFactLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, color: '#98A2B3' },
  previewFactValue: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '800', color: '#101828' },
  previewPhotosLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#667085', marginBottom: 8 },
  previewPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewPhotoWrap: { width: 68, height: 68, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EAECF0' },
  previewPhoto: { width: '100%', height: '100%' },
  firstPhotoChip: { position: 'absolute', left: 5, bottom: 5, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#0F1728' },
  firstPhotoChipText: { fontSize: 7, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.6 },
  previewSafety: { marginTop: 9, fontSize: 11, lineHeight: 17, color: '#667085' },
  previewLoading: { fontSize: 12, lineHeight: 18, color: '#667085' },
  previewError: { borderRadius: 12, padding: 11, backgroundColor: '#FFF4ED', borderWidth: 1, borderColor: '#FED7AA' },
  previewErrorTitle: { fontSize: 12, fontWeight: '800', color: '#9A3412' },
  previewErrorText: { marginTop: 3, fontSize: 11, lineHeight: 17, color: '#9A3412' },
  noPhotos: { borderRadius: 12, padding: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAECF0' },
  noPhotosTitle: { fontSize: 12, fontWeight: '800', color: '#344054' },
  noPhotosText: { marginTop: 3, fontSize: 11, lineHeight: 17, color: '#667085' },
  copy: { fontSize: 12, lineHeight: 18, color: '#7A8494' },
  primary: { minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1728' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9DEE6' },
  secondaryText: { color: '#344054', fontSize: 14, fontWeight: '700' },
  withdraw: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF9F8', borderWidth: 1, borderColor: '#F0C7C2' },
  withdrawText: { color: '#B42318', fontSize: 14, fontWeight: '700' },
  feedback: { backgroundColor: '#F8F9FB', borderRadius: 12, padding: 11 },
  status: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#344054' },
  disclaimer: { fontSize: 11, lineHeight: 17, color: '#98A2B3' },
  disabled: { opacity: 0.45 },
});
