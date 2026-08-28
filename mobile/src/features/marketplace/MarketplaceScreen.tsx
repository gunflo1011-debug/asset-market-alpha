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
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Inventory</Text></TouchableOpacity>
          <TouchableOpacity disabled={loading} onPress={() => void refresh()}><Text style={styles.refresh}>{loading ? 'Refreshing…' : 'Refresh'}</Text></TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>THINGS MARKETPLACE</Text>
        <Text style={styles.title}>For sale by other owners</Text>
        <Text style={styles.copy}>Only items that their owners explicitly published appear here. Private notes, exact location and owner identity stay hidden.</Text>

        {loading && listings.length === 0 ? <ActivityIndicator /> : null}
        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
        {!loading && !error && listings.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing listed yet</Text><Text style={styles.copy}>Published Things from other users will appear here.</Text></View> : null}

        {listings.map((listing) => (
          <View key={listing.item_id} style={styles.card}>
            <View style={styles.row}><View style={styles.pill}><Text style={styles.pillText}>{listing.category}</Text></View><Text style={styles.ask}>{euro(listing.asking_price_cents)}</Text></View>
            <Text style={styles.itemTitle}>{listing.title}</Text>
            <Text style={styles.meta}>Asking price</Text>
            {listing.estimated_value_cents != null ? <Text style={styles.estimate}>Things estimate · {euro(listing.estimated_value_cents)}</Text> : <Text style={styles.estimate}>No estimate available</Text>}
            {listing.condition_label ? <Text style={styles.meta}>Condition · {listing.condition_label}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  container: { padding: 20, paddingTop: 20, paddingBottom: 52, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 16, fontWeight: '700', color: '#344054' },
  refresh: { fontSize: 14, fontWeight: '700', color: '#344054' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#667085' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#101828' },
  copy: { fontSize: 14, lineHeight: 21, color: '#667085' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 9, borderWidth: 1, borderColor: '#E4E7EC' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pill: { backgroundColor: '#F2F4F7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '700', color: '#475467' },
  ask: { fontSize: 22, fontWeight: '800', color: '#101828' },
  itemTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: '#101828' },
  meta: { fontSize: 13, lineHeight: 18, color: '#667085' },
  estimate: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#344054' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, gap: 8, borderWidth: 1, borderColor: '#E4E7EC' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#101828' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#FECDCA' },
  errorText: { fontSize: 14, color: '#B42318' },
});
