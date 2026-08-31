import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadInterestSummaryForMyListings, loadMyMarketplaceListings, saveMyMarketplaceListing, withdrawMyMarketplaceListing } from '../../data/inventory';
import { syncMyMarketplaceImageProjections } from '../../data/itemImages';
import type { OwnerMarketplaceListing } from '../inventory/types';

type Props = {
  itemId: string;
  estimatedValueCents: number | null;
};

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function SellListingPanel({ itemId, estimatedValueCents }: Props) {
  const [listing, setListing] = useState<OwnerMarketplaceListing | null>(null);
  const [interestCount, setInterestCount] = useState(0);
  const [price, setPrice] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([loadMyMarketplaceListings(), loadInterestSummaryForMyListings()]).then(([rows, summaries]) => {
      if (!active) return;
      const existing = rows.find((row) => row.item_id === itemId) ?? null;
      const summary = summaries.find((row) => row.item_id === itemId) ?? null;
      setListing(existing);
      setInterestCount(summary?.interested_count ?? 0);
      if (existing) {
        setPrice(String(existing.asking_price_cents / 100));
        setPublicLocation(existing.public_location ?? '');
      }
    }).catch(() => { if (active) setStatus('Could not load listing state.'); });
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

  async function save(publish: boolean) {
    if (!parsed.valid || !locationValid || busy) return;
    try {
      setBusy(true);
      setStatus(null);
      const imageCount = publish ? await syncMyMarketplaceImageProjections(itemId) : 0;
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
      {estimatedValueCents != null ? <View style={styles.referenceRow}><View style={styles.flex}><Text style={styles.referenceLabel}>Things estimate</Text><Text style={styles.referenceHint}>Reference only · never auto-published</Text></View><Text style={styles.referenceValue}>{euro(estimatedValueCents)}</Text></View> : null}

      <Text style={styles.label}>{published ? 'New marketplace price (€)' : 'Seller asking price (€)'}</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder={estimatedValueCents != null ? `Choose a price · estimate ${euro(estimatedValueCents)}` : 'e.g. 90'} style={styles.input} />
      <Text style={styles.priceHint}>{published ? 'Changing this value does nothing until you tap Update listing. After that, this exact price becomes the buyer-visible Marketplace price.' : 'You choose this price yourself. Things Estimate is only a reference and is never copied into the listing automatically.'}</Text>

      <Text style={styles.label}>Marketplace location (optional)</Text>
      <TextInput
        value={publicLocation}
        onChangeText={setPublicLocation}
        autoCapitalize="words"
        maxLength={80}
        placeholder="City or town, e.g. Hambrücken"
        style={styles.locationInput}
      />
      <View style={styles.privacyHint}>
        <Text style={styles.privacyHintTitle}>City/town only</Text>
        <Text style={styles.privacyHintText}>This text becomes public when you publish. Things never copies your private inventory location automatically. Do not enter a street address.</Text>
      </View>

      <Text style={styles.copy}>Nothing becomes visible to other users until you explicitly publish. Only photos you selected for Marketplace are copied to the buyer-facing image store.</Text>

      <TouchableOpacity disabled={!parsed.valid || !locationValid || busy} style={[styles.primary, (!parsed.valid || !locationValid || busy) && styles.disabled]} onPress={() => void save(true)}>
        <Text style={styles.primaryText}>{busy ? 'Saving…' : published ? `Update listing${parsed.valid ? ` to ${euro(parsed.cents)}` : ''}` : `Publish${parsed.valid ? ` at ${euro(parsed.cents)}` : ''}`}</Text>
      </TouchableOpacity>
      {!published ? <TouchableOpacity disabled={!parsed.valid || !locationValid || busy} style={styles.secondary} onPress={() => void save(false)}><Text style={styles.secondaryText}>Save private draft</Text></TouchableOpacity> : null}
      {published ? <TouchableOpacity disabled={busy} style={styles.withdraw} onPress={() => void withdraw()}><Text style={styles.withdrawText}>Remove listing</Text></TouchableOpacity> : null}

      {status ? <View style={styles.feedback}><Text style={styles.status}>{status}</Text></View> : null}
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
