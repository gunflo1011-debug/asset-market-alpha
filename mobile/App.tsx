import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  beginPasswordRecoveryFromUrl,
  getSession,
  onAuthStateChange,
  requestAccountEmailChange,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  updateAccountPassword,
  updateRecoveredPassword,
} from './src/data/auth';
import {
  addPrivateDevice,
  addPrivateThing,
  CatalogVariant,
  loadCatalog,
  loadPrivateInventory,
  PrivateInventoryItem,
} from './src/data/inventory';
import { hasSupabaseConfig } from './src/lib/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';

function variantTitle(variant: CatalogVariant): string {
  const product = variant.products;
  const base = product ? `${product.brand} ${product.family}` : 'Device';
  return `${base}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

function itemTitle(item: PrivateInventoryItem): string {
  if (item.custom_name?.trim()) return item.custom_name.trim();
  const variant = item.product_variants;
  const product = variant?.products;
  if (!variant || !product) return 'Private Thing';
  return `${product.brand} ${product.family}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

function friendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (raw.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (raw.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (raw.includes('expired')) return 'This link has expired. Request a new password-reset email.';
  if (raw.includes('invalid email')) return 'Enter a valid email address.';
  if (raw.includes('same password')) return 'Choose a password you have not used for this account.';
  return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [items, setItems] = useState<PrivateInventoryItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [thingName, setThingName] = useState('');
  const [thingCategory, setThingCategory] = useState('');
  const [thingLocation, setThingLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');

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
    if (!hasSupabaseConfig) return;
    let active = true;

    const handleRecoveryUrl = async (url: string | null) => {
      if (!url || !url.startsWith('thingsalpha://auth/reset-password')) return;
      try {
        setBusy(true);
        setMessage(null);
        await beginPasswordRecoveryFromUrl(url);
        if (!active) return;
        setPassword('');
        setConfirmPassword('');
        setAuthMode('recovery');
      } catch (error) {
        if (!active) return;
        setAuthMode('forgot');
        setMessage(friendlyAuthError(error));
      } finally {
        if (active) setBusy(false);
      }
    };

    void Linking.getInitialURL().then(handleRecoveryUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => void handleRecoveryUrl(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session || authMode === 'recovery') {
      setItems([]);
      setCatalog([]);
      setShowAccount(false);
      return;
    }
    setAccountEmail(session.user.email ?? '');
    void refreshData();
  }, [session, authMode]);

  async function refreshData() {
    try {
      setBusy(true);
      setMessage(null);
      const [nextItems, nextCatalog] = await Promise.all([loadPrivateInventory(), loadCatalog()]);
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
      if (mode === 'signin') await signIn(email.trim(), password);
      else setMessage(await signUp(email.trim(), password));
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setMessage('Enter the email address you use for Things.');
      return;
    }
    try {
      setBusy(true);
      setMessage(null);
      await requestPasswordReset(normalizedEmail);
      setMessage('If an account exists for this email, a password-reset link has been sent.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function finishPasswordRecovery() {
    if (password.length < 8) {
      setMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('The passwords do not match.');
      return;
    }
    try {
      setBusy(true);
      setMessage(null);
      await updateRecoveredPassword(password);
      setPassword('');
      setConfirmPassword('');
      setAuthMode('signin');
      setMessage('Password updated. Sign in with your new password.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveAccountEmail() {
    const normalized = accountEmail.trim();
    if (!normalized || !normalized.includes('@')) {
      setMessage('Enter a valid email address.');
      return;
    }
    if (normalized.toLowerCase() === (session?.user.email ?? '').toLowerCase()) {
      setMessage('This is already your current login email.');
      return;
    }
    try {
      setBusy(true);
      setMessage(null);
      await requestAccountEmailChange(normalized);
      setMessage('Email change requested. Follow the verification email before using the new address to sign in.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveAccountPassword() {
    if (accountPassword.length < 8) {
      setMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (accountPassword !== accountPasswordConfirm) {
      setMessage('The new passwords do not match.');
      return;
    }
    try {
      setBusy(true);
      setMessage(null);
      await updateAccountPassword(accountPassword);
      setAccountPassword('');
      setAccountPasswordConfirm('');
      setMessage('Password updated successfully.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setMessage(null);
    if (mode === 'forgot') setPassword('');
    setConfirmPassword('');
  }

  async function createPrivateThing() {
    const name = thingName.trim();
    if (!name) {
      setMessage('Give your Thing a name first.');
      return;
    }
    try {
      setBusy(true);
      setMessage(null);
      await addPrivateThing({ name, category: thingCategory, location: thingLocation });
      setThingName('');
      setThingCategory('');
      setThingLocation('');
      await refreshData();
      setMessage('Thing saved privately. Only you can see it.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save Thing.');
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
    return <SafeAreaView style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Restoring secure session…</Text></SafeAreaView>;
  }

  if (!hasSupabaseConfig) {
    return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.eyebrow}>THINGS · PRIVATE INVENTORY</Text><Text style={styles.title}>Backend connection required.</Text><Text style={styles.subtitle}>This build intentionally does not fall back to fake inventory. Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to test the real private-data flow.</Text></View></SafeAreaView>;
  }

  if (authMode === 'recovery') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>THINGS · ACCOUNT RECOVERY</Text>
          <Text style={styles.title}>Choose a new password.</Text>
          <Text style={styles.subtitle}>Your reset link was verified. Set a new password to secure your account.</Text>
          <View style={styles.card}>
            <TextInput value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry textContentType="newPassword" style={styles.input} />
            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" secureTextEntry textContentType="newPassword" style={styles.input} />
            <Text style={styles.helper}>Use at least 8 characters.</Text>
            <TouchableOpacity style={[styles.primaryButton, (busy || password.length < 8 || password !== confirmPassword) ? styles.disabled : null]} disabled={busy || password.length < 8 || password !== confirmPassword} onPress={() => void finishPasswordRecovery()}>
              <Text style={styles.primaryButtonText}>{busy ? 'Updating…' : 'Update password'}</Text>
            </TouchableOpacity>
            {message ? <Text style={styles.helper}>{message}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>THINGS · PRIVATE BY DEFAULT</Text>
          <Text style={styles.title}>{authMode === 'forgot' ? 'Reset your password.' : authMode === 'signup' ? 'Create your Things account.' : 'Welcome back.'}</Text>
          <Text style={styles.subtitle}>{authMode === 'forgot' ? 'Enter your email and we will send a secure reset link. We never reveal whether an account exists.' : 'Your inventory starts private and stays under your control.'}</Text>
          <View style={styles.card}>
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" style={styles.input} />
            {authMode !== 'forgot' ? <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry textContentType={authMode === 'signup' ? 'newPassword' : 'password'} style={styles.input} /> : null}
            {authMode === 'signin' ? <><TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => void authenticate('signin')}><Text style={styles.primaryButtonText}>{busy ? 'Signing in…' : 'Sign in'}</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={() => switchAuthMode('forgot')}><Text style={styles.linkCentered}>Forgot password?</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => switchAuthMode('signup')}><Text style={styles.secondaryButtonText}>Create account</Text></TouchableOpacity></> : null}
            {authMode === 'signup' ? <><TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => void authenticate('signup')}><Text style={styles.primaryButtonText}>{busy ? 'Creating account…' : 'Create account'}</Text></TouchableOpacity><Text style={styles.helper}>You may need to confirm your email before your first sign-in.</Text><TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => switchAuthMode('signin')}><Text style={styles.secondaryButtonText}>Back to sign in</Text></TouchableOpacity></> : null}
            {authMode === 'forgot' ? <><TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => void sendPasswordReset()}><Text style={styles.primaryButtonText}>{busy ? 'Sending…' : 'Send reset link'}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => switchAuthMode('signin')}><Text style={styles.secondaryButtonText}>Back to sign in</Text></TouchableOpacity></> : null}
            {message ? <Text style={styles.helper}>{message}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showAccount) {
    const verified = Boolean(session.user.email_confirmed_at);
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}><Text style={styles.eyebrow}>THINGS · ACCOUNT</Text><Text style={styles.title}>Account & Security</Text></View>
            <TouchableOpacity disabled={busy} onPress={() => { setShowAccount(false); setMessage(null); }}><Text style={styles.link}>Done</Text></TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sign-in email</Text>
            <Text style={styles.helper}>Current: {session.user.email ?? 'No email available'}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{verified ? 'EMAIL VERIFIED' : 'EMAIL NOT VERIFIED'}</Text></View>
            <TextInput value={accountEmail} onChangeText={setAccountEmail} placeholder="New email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" style={styles.input} />
            <TouchableOpacity style={[styles.secondaryButton, busy ? styles.disabled : null]} disabled={busy} onPress={() => void saveAccountEmail()}><Text style={styles.secondaryButtonText}>{busy ? 'Saving…' : 'Change email'}</Text></TouchableOpacity>
            <Text style={styles.helper}>Changing your email may require confirmation before the new address becomes your login.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Password</Text>
            <Text style={styles.helper}>Choose a new password with at least 8 characters.</Text>
            <TextInput value={accountPassword} onChangeText={setAccountPassword} placeholder="New password" secureTextEntry textContentType="newPassword" style={styles.input} />
            <TextInput value={accountPasswordConfirm} onChangeText={setAccountPasswordConfirm} placeholder="Confirm new password" secureTextEntry textContentType="newPassword" style={styles.input} />
            <TouchableOpacity style={[styles.primaryButton, (busy || accountPassword.length < 8 || accountPassword !== accountPasswordConfirm) ? styles.disabled : null]} disabled={busy || accountPassword.length < 8 || accountPassword !== accountPasswordConfirm} onPress={() => void saveAccountPassword()}><Text style={styles.primaryButtonText}>{busy ? 'Updating…' : 'Update password'}</Text></TouchableOpacity>
          </View>
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Session</Text>
            <Text style={styles.helper}>Signing out removes the current Things session from this device.</Text>
            <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => void signOut()}><Text style={styles.secondaryButtonText}>Sign out</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.eyebrow}>THINGS · PRIVATE BY DEFAULT</Text><Text style={styles.title}>My things</Text></View><TouchableOpacity onPress={() => { setAccountEmail(session.user.email ?? ''); setMessage(null); setShowAccount(true); }}><Text style={styles.link}>Account</Text></TouchableOpacity></View>
        <View style={styles.card}><Text style={styles.metric}>{items.length}</Text><Text style={styles.metricLabel}>Thing{items.length === 1 ? '' : 's'} saved privately</Text><Text style={styles.helper}>Start with what you own. Only your authenticated account can read these inventory rows.</Text></View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick add anything</Text>
          <Text style={styles.helper}>A drill, bicycle, record player, document box, camera — if you own it, it can be a Thing.</Text>
          <TextInput value={thingName} onChangeText={setThingName} placeholder="What is it? e.g. Cordless drill" maxLength={120} style={styles.input} />
          <TextInput value={thingCategory} onChangeText={setThingCategory} placeholder="Category (optional)" maxLength={80} style={styles.input} />
          <TextInput value={thingLocation} onChangeText={setThingLocation} placeholder="Where is it? (optional)" maxLength={120} style={styles.input} />
          <TouchableOpacity style={[styles.primaryButton, (!thingName.trim() || busy) ? styles.disabled : null]} disabled={!thingName.trim() || busy} onPress={() => void createPrivateThing()}><Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Save Thing privately'}</Text></TouchableOpacity>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add a known device</Text>
          <Text style={styles.helper}>Catalog-backed devices keep structured details for future valuation and private demand matching.</Text>
          {catalog.length === 0 ? <Text style={styles.helper}>No catalog variants are available yet.</Text> : catalog.slice(0, 8).map((variant) => { const selected = variant.id === selectedVariantId; return <TouchableOpacity key={variant.id} style={[styles.variantButton, selected ? styles.variantButtonSelected : null]} onPress={() => setSelectedVariantId(variant.id)}><Text style={styles.variantText}>{variantTitle(variant)}</Text></TouchableOpacity>; })}
          <TouchableOpacity style={[styles.secondaryButton, !selectedVariant || busy ? styles.disabled : null]} disabled={!selectedVariant || busy} onPress={() => void createPrivateDevice()}><Text style={styles.secondaryButtonText}>{busy ? 'Saving…' : 'Add catalog device'}</Text></TouchableOpacity>
        </View>
        {message ? <Text style={styles.notice}>{message}</Text> : null}
        <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Inventory</Text><TouchableOpacity disabled={busy} onPress={() => void refreshData()}><Text style={styles.link}>Refresh</Text></TouchableOpacity></View>
        {items.length === 0 && !busy ? <View style={styles.card}><Text style={styles.helper}>Nothing here yet. Add the first Thing above — it takes only a name.</Text></View> : null}
        {items.map((item) => {
          const snapshot = item.condition_snapshots[0];
          const isCatalogDevice = Boolean(item.product_variants);
          return <View key={item.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
            {item.category ? <Text style={styles.muted}>{item.category}</Text> : null}
            {item.location_label ? <Text style={styles.muted}>Stored at: {item.location_label}</Text> : null}
            {isCatalogDevice ? <Text style={styles.muted}>Condition: {snapshot?.housing_state ?? 'not captured'}</Text> : null}
            {snapshot?.battery_health != null ? <Text style={styles.muted}>Battery health: {snapshot.battery_health}%</Text> : null}
            <View style={styles.badge}><Text style={styles.badgeText}>{isCatalogDevice ? 'PRIVATE · structured device' : 'PRIVATE THING'}</Text></View>
          </View>;
        })}
        <View style={styles.card}><Text style={styles.sectionTitle}>Your inventory, not a public profile</Text><Text style={styles.helper}>Saving a Thing never lists it for sale. Marketplace or sharing features must always be an explicit choice later.</Text></View>
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
  linkCentered: { fontSize: 14, fontWeight: '700', color: '#344054', textAlign: 'center', paddingVertical: 4 },
  variantButton: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 11 },
  variantButtonSelected: { borderWidth: 2, borderColor: '#101828' },
  variantText: { fontSize: 14, color: '#344054' },
  disabled: { opacity: 0.45 },
});