import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { loadMarketplace } from '../../data/inventory';
import type { MarketplaceListing } from '../inventory/types';

type Props = { onBack: () => void };

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function MarketplaceScreen({ onBack }: Props) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      setListings(await loadMarketplace());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load marketplace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

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
          <Text style={styles.copy}>Only explicitly published listings appear here. Seller identity, private notes and exact location stay hidden.</Text>
          <View style={styles.heroStats}><Text style={styles.heroStatValue}>{listings.length}</Text><Text style={styles.heroStatLabel}>{listings.length === 1 ? 'listing available' : 'listings available'}</Text></View>
        </View>

        {loading && listings.length === 0 ? <View style={styles.loadingCard}><ActivityIndicator /><Text style={styles.copy}>Loading marketplace…</Text></View> : null}
        {error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Marketplace unavailable</Text><Text style={styles.errorText}>{error}</Text></View> : null}
        {!loading && !error && listings.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing for sale yet</Text><Text style={styles.copy}>Published Things from other owners will appear here.</Text></View> : null}

        {listings.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Available now</Text><Text style={styles.sectionMeta}>Newest first</Text></View> : null}

        {listings.map((listing) => (
          <View key={listing.item_id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.pill}><Text style={styles.pillText}>{listing.category}</Text></View>
              <Text style={styles.ask}>{euro(listing.asking_price_cents)}</Text>
            </View>
            <Text style={styles.itemTitle}>{listing.title}</Text>
            <View style={styles.metaRow}>
              {listing.condition_label ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{listing.condition_label}</Text></View> : null}
              {listing.estimated_value_cents != null ? <View style={styles.metaChip}><Text style={styles.metaChipText}>Estimate {euro(listing.estimated_value_cents)}</Text></View> : null}
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.footerLabel}>Asking price</Text>
              <Text style={styles.footerPrivacy}>Private seller</Text>
            </View>
          </View>
        ))}
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
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: '#98A2B3' },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.7, color: '#FFFFFF' },
  copy: { fontSize: 13, lineHeight: 19, color: '#7A8494' },
  heroStats: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6 },
  heroStatValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 12, color: '#C5CBD4' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  sectionMeta: { fontSize: 12, color: '#7A8494' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 11, borderWidth: 1, borderColor: '#E5E8ED', shadowColor: '#0F1728', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pill: { backgroundColor: '#F0F2F5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: '800', color: '#475467' },
  ask: { fontSize: 25, fontWeight: '800', letterSpacing: -0.4, color: '#0F1728' },
  itemTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: '#0F1728' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metaChip: { borderRadius: 999, backgroundColor: '#F8F9FB', paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#EEF0F3' },
  metaChipText: { fontSize: 11, fontWeight: '700', color: '#667085', textTransform: 'capitalize' },
  cardFooter: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF0F3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontSize: 12, color: '#7A8494' },
  footerPrivacy: { fontSize: 11, fontWeight: '700', color: '#027A48' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E8ED' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, gap: 8, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 16, fontWeight: '800', color: '#B42318' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#B42318' },
});
