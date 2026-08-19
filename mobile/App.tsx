import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { hasSupabaseConfig } from './src/lib/supabase';

type Item = {
  id: string;
  title: string;
  condition: 'excellent' | 'good' | 'fair';
  estimatedValue: number;
  activatable: boolean;
};

const seedItems: Item[] = [
  {
    id: 'demo-iphone',
    title: 'iPhone 13 · 128 GB',
    condition: 'good',
    estimatedValue: 315,
    activatable: true,
  },
];

export default function App() {
  const [items, setItems] = useState<Item[]>(seedItems);
  const [title, setTitle] = useState('');

  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + item.estimatedValue, 0),
    [items],
  );

  const addDraftItem = () => {
    const clean = title.trim();
    if (!clean) return;

    setItems((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        title: clean,
        condition: 'good',
        estimatedValue: 0,
        activatable: false,
      },
    ]);
    setTitle('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>PRIVATE INVENTORY ALPHA</Text>
        <Text style={styles.title}>Your things stay private until real demand appears.</Text>
        <Text style={styles.subtitle}>
          Capture devices you own, track an estimated resale value, and only decide about selling after a verified buyer request exists.
        </Text>

        <View style={styles.card}>
          <Text style={styles.metricLabel}>Estimated inventory value</Text>
          <Text style={styles.metric}>€{totalValue.toFixed(0)}</Text>
          <Text style={styles.muted}>
            Backend: {hasSupabaseConfig ? 'configured' : 'local alpha mode'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add a device</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. iPhone 13 128 GB"
            style={styles.input}
            autoCapitalize="sentences"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={addDraftItem}>
            <Text style={styles.primaryButtonText}>Add privately</Text>
          </TouchableOpacity>
          <Text style={styles.helper}>
            Alpha rule: creating an item never publishes it to a marketplace.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>My inventory</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.muted}>Condition: {item.condition}</Text>
              </View>
              <Text style={styles.itemValue}>
                {item.estimatedValue > 0 ? `€${item.estimatedValue}` : 'Value pending'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.activatable ? 'Eligible for private demand matching' : 'Private draft'}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Closed-alpha promise</Text>
          <Text style={styles.helper}>
            No public inventory browsing. No automatic sale. A match only opens a private decision flow for the owner.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F7' },
  container: { padding: 20, gap: 14 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#616A76' },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: '#101828' },
  subtitle: { fontSize: 16, lineHeight: 23, color: '#475467' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 10 },
  metricLabel: { fontSize: 14, color: '#667085' },
  metric: { fontSize: 34, fontWeight: '800', color: '#101828' },
  muted: { fontSize: 13, color: '#667085' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFFFFF' },
  primaryButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#101828' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  helper: { fontSize: 13, lineHeight: 19, color: '#667085' },
  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#101828', marginBottom: 4 },
  itemValue: { fontSize: 15, fontWeight: '700', color: '#344054' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EEF2F6', paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#344054' },
});
