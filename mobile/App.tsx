import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSession, onAuthStateChange, signIn, signOut, signUp } from './src/data/auth';
import {
  addPrivateDevice,
  CatalogVariant,
  loadCatalog,
  loadPrivateInventory,
  PrivateInventoryItem,
} from './src/data/inventory';
import { hasSupabaseConfig } from './src/lib/supabase';

function variantTitle(variant: CatalogVariant): string {
  const product = variant.products;
  const base = product ? `${product.brand} ${product.family}` : 'Device';
  return `${base}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

function itemTitle(item: PrivateInventoryItem): string {
  const variant = item.product_variants;
  const product = variant?.products;
  if (!variant || !product) return 'Private device';
  return `${product.brand} ${product.family}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [items, setItems] = useState<PrivateInventoryItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => catalog.find((variant) => variant.id === selectedVariantId) ?? null,
    [catalog, selectedVariantId],
  );

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthReady(true);
      return;
    }

    let active = true;
    getSession()
      .then((next) => {
        if (active) setSession(next);
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    const unsubscribe = onAuthStateChange((next) => setSession(next));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setItems([]);
      setCatalog([]);
      return;
    }
    void refreshData();
  }, [session]);

  async function refreshData() {
    try {
      setBusy(true);
      setMessage(null);
      const [nextItems, nextCatalog] = await Promise.all([
        loadPrivateInventory(),
        loadCatalog(),
      ]);
      setItems(nextItems);
      setCatalog(nextCatalog);
      setSelectedVariantId((current) => current ?? nextCatalog[0]?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load private inventory.');
    } finally {
      setBusy(false);
    }
  }

  async function authenticate(mode: 'signin' | 'signup') {
    if (!email.trim() || password.length < 6) {
      setMessage('Enter an email and a password with at least 6 characters.');
      return;
    }
    try {
      setBusy(true);
      setMessage(null);
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        setMessage(await signUp(email.trim(), password));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function createPrivateDevice() {
    if (!selectedVariantId) return;
    try {
      setBusy(true);
      setMessage(null);
      await addPrivateDevice({ variantId: selectedVariantId });
      await refreshData();
      setMessage('Device saved privately. It is not publicly listed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save device.');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Restoring secure session…</Text>
      </SafeAreaView>
    );
  }

  if (!hasSupabaseConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>PRIVATE INVENTORY ALPHA</Text>
          <Text style={styles.title}>Backend connection required.</Text>
          <Text style={styles.subtitle}>
            This build intentionally does not fall back to fake inventory. Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to test the real private-data flow.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>CLOSED ALPHA</Text>
          <Text style={styles.title}>Your possessions start private.</Text>
          <Text style={styles.subtitle}>
            Sign in to keep a private device inventory. Nothing becomes a public listing automatically.
          </Text>
          <View style={styles.card}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => void authenticate('signin')}>
              <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : 'Sign in'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => void authenticate('signup')}>
              <Text style={styles.secondaryButtonText}>Create alpha account</Text>
            </TouchableOpacity>
            {message ? <Text style={styles.helper}>{message}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PRIVATE INVENTORY ALPHA</Text>
            <Text style={styles.title}>My devices</Text>
          </View>
          <TouchableOpacity onPress={() => void signOut()}>
            <Text style={styles.link}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.metric}>{items.length}</Text>
          <Text style={styles.metricLabel}>private device{items.length === 1 ? '' : 's'}</Text>
          <Text style={styles.helper}>Only your authenticated account can read these inventory rows.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add a device privately</Text>
          {catalog.length === 0 ? (
            <Text style={styles.helper}>No catalog variants are available yet.</Text>
          ) : (
            catalog.slice(0, 8).map((variant) => {
              const selected = variant.id === selectedVariantId;
              return (
                <TouchableOpacity
                  key={variant.id}
                  style={[styles.variantButton, selected ? styles.variantButtonSelected : null]}
                  onPress={() => setSelectedVariantId(variant.id)}
                >
                  <Text style={styles.variantText}>{variantTitle(variant)}</Text>
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity
            style={[styles.primaryButton, !selectedVariant ? styles.disabled : null]}
            disabled={!selectedVariant || busy}
            onPress={() => void createPrivateDevice()}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Add privately'}</Text>
          </TouchableOpacity>
          <Text style={styles.helper}>Creating an item never creates a public marketplace listing.</Text>
        </View>

        {message ? <Text style={styles.notice}>{message}</Text> : null}

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <TouchableOpacity disabled={busy} onPress={() => void refreshData()}>
            <Text style={styles.link}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 && !busy ? (
          <View style={styles.card}>
            <Text style={styles.helper}>No devices yet. Add the first one above.</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const snapshot = item.condition_snapshots[0];
          return (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
              <Text style={styles.muted}>Condition: {snapshot?.housing_state ?? 'not captured'}</Text>
              {snapshot?.battery_health != null ? (
                <Text style={styles.muted}>Battery health: {snapshot.battery_health}%</Text>
              ) : null}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>PRIVATE · eligible for demand matching</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Alpha rule</Text>
          <Text style={styles.helper}>
            No public inventory browsing and no automatic sale. A future verified buyer match may only open a private owner decision flow.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F4F5F7' },
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
  secondaryButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#D0D5DD' },
  secondaryButtonText: { color: '#344054', fontWeight: '700', fontSize: 15 },
  helper: { fontSize: 13, lineHeight: 19, color: '#667085' },
  notice: { fontSize: 13, lineHeight: 19, color: '#344054', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 },
  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#101828' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EEF2F6', paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#344054' },
  link: { fontSize: 14, fontWeight: '700', color: '#344054' },
  variantButton: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 11 },
  variantButtonSelected: { borderWidth: 2, borderColor: '#101828' },
  variantText: { fontSize: 14, color: '#344054' },
  disabled: { opacity: 0.45 },
});
