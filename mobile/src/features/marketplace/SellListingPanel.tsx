import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadInterestSummaryForMyListings, loadMyMarketplaceListings, saveMyMarketplaceListing, withdrawMyMarketplaceListing } from '../../data/inventory';
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
  const [price, setPrice] = useState(estimatedValueCents != null ? String(Math.max(1, Math.round(estimatedValueCents / 100))) : '');
  const [location, setLocation] = useState('');
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
        setLocation(existing.location_label ?? '');
      }
    }).catch(() => { if (active) setStatus('Could not load listing state.'); });
    return () => { active = false; };
  }, [itemId]);

  const parsed = useMemo(() => {
    const euros = Number(price.replace(',', '.').trim());
    return { valid: Number.isFinite(euros) && euros > 0 && euros <= 10_000_000, cents: Math.round(euros * 100) };
  }, [price]);
  const normalizedLocation = location.trim();
  const locationValid = normalizedLocation.length > 0 && normalizedLocation.length <= 120;
  const published = listing?.status === 'PUBLISHED';

  async function save(publish: boolean) {
    if (!parsed.valid || busy || (publish && !locationValid)) return;
    try {
      setBusy(true);
      setStatus(null);
      const nextStatus = await saveMyMarketplaceListing(itemId, parsed.cents, publish, normalizedLocation);
      setListing({ item_id: itemId, asking_price_cents: parsed.cents, status: nextStatus, location_label: normalizedLocation || null, published_at: publish ? new Date().toISOString() : null });
      setStatus(publish ? 'Published. Other users can now see this listing and your town/city.' : 'Draft saved. This item is still private.');
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
      setStatus('Removed from marketplace.');
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
          <Text style={styles.eyebrow}>{published ? 'LIVE LISTING' : 'ASKING PRICE'}</Text>
          <Text style={styles.title}>{published ? 'Listed on Marketplace' : 'Set your price'}</Text>
        </View>
        <View style={[styles.statusPill, published && styles.statusPillLive]}><Text style={[styles.statusPillText, published && styles.statusPillTextLive]}>{published ? 'Live' : 'Private'}</Text></View>
      </View>

      {published ? <View style={styles.interestSummary}><View><Text style={styles.interestLabel}>BUYER INTEREST</Text><Text style={styles.interestTitle}>{interestCount === 0 ? 'No interest yet' : `${interestCount} ${interestCount === 1 ? 'person is' : 'people are'} interested`}</Text></View><Text style={styles.interestCount}>{interestCount}</Text></View> : null}
      {estimatedValueCents != null ? <View style={styles.referenceRow}><Text style={styles.referenceLabel}>Things estimate</Text><Text style={styles.referenceValue}>{euro(estimatedValueCents)}</Text></View> : null}

      <Text style={styles.label}>Asking price (€)</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 90" style={styles.input} />

      <Text style={styles.label}>Town / city</Text>
      <TextInput value={location} onChangeText={setLocation} autoCapitalize="words" maxLength={120} placeholder="e.g. Hambrücken" style={styles.locationInput} />
      <Text style={styles.copy}>Only this coarse marketplace location is shared. Your exact private location remains hidden.</Text>

      <TouchableOpacity disabled={!parsed.valid || !locationValid || busy} style={[styles.primary, (!parsed.valid || !locationValid || busy) && styles.disabled]} onPress={() => void save(true)}>
        <Text style={styles.primaryText}>{busy ? 'Saving…' : published ? 'Update listing' : 'Publish on marketplace'}</Text>
      </TouchableOpacity>
      {!published ? <TouchableOpacity disabled={!parsed.valid || busy} style={styles.secondary} onPress={() => void save(false)}><Text style={styles.secondaryText}>Save draft</Text></TouchableOpacity> : null}
      {published ? <TouchableOpacity disabled={busy} style={styles.withdraw} onPress={() => void withdraw()}><Text style={styles.withdrawText}>Remove listing</Text></TouchableOpacity> : null}

      {status ? <View style={styles.feedback}><Text style={styles.status}>{status}</Text></View> : null}
      <Text style={styles.disclaimer}>Buyer interest is shown only as a count. Buyer identity, email and exact address are not exposed.</Text>
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
  interestSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#F0F7F3', borderRadius: 16, padding: 14 },
  interestLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#027A48' },
  interestTitle: { fontSize: 14, fontWeight: '800', color: '#174C35', marginTop: 3 },
  interestCount: { fontSize: 28, fontWeight: '800', color: '#027A48' },
  referenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F9FB', borderRadius: 14, padding: 13 },
  referenceLabel: { fontSize: 12, color: '#7A8494' },
  referenceValue: { fontSize: 15, fontWeight: '800', color: '#0F1728' },
  label: { fontSize: 13, fontWeight: '800', color: '#344054', marginTop: 2 },
  input: { minHeight: 58, borderWidth: 1, borderColor: '#D9DEE6', borderRadius: 15, paddingHorizontal: 16, fontSize: 22, fontWeight: '800', color: '#0F1728', backgroundColor: '#FFFFFF' },
  locationInput: { minHeight: 54, borderWidth: 1, borderColor: '#D9DEE6', borderRadius: 15, paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: '#0F1728', backgroundColor: '#FFFFFF' },
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
