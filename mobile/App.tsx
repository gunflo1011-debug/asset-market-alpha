import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivityIndicator, Alert, Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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
  deletePrivateDevice,
  deletePrivateThing,
  loadCatalog,
  loadPrivateInventory,
  updatePrivateItemMetadata,
} from './src/data/inventory';
import type { CatalogVariant, PrivateInventoryItem } from './src/features/inventory/types';
import { friendlyInventoryError, itemTitle } from './src/features/inventory/presentation';
import { AuthScreen, type AuthMode } from './src/features/auth/AuthScreen';
import { AccountScreen } from './src/features/account/AccountScreen';
import { InventoryScreen } from './src/features/inventory/InventoryScreen';
import { recordCaptureSuccess, recordInventoryVisible, recordSellInitiated, recordValueVisible } from './src/lib/activationAppTransitions';
import { hasSupabaseConfig } from './src/lib/supabase';

const DEFAULT_CATEGORY = 'Other';

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
  const [message, setMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [items, setItems] = useState<PrivateInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const [thingName, setThingName] = useState('');
  const [thingCategory, setThingCategory] = useState(DEFAULT_CATEGORY);
  const [thingLocation, setThingLocation] = useState('');
  const [thingNotes, setThingNotes] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const inventoryRequestIdRef = useRef(0);
  const actionUserIdRef = useRef<string | null>(null);
  const inventoryUserId = session && authMode !== 'recovery' ? session.user.id : null;
  const inventoryUserIdRef = useRef<string | null>(inventoryUserId);
  inventoryUserIdRef.current = inventoryUserId;

  const [showAccount, setShowAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [saleIntentItemId, setSaleIntentItemId] = useState<string | null>(null);

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
      .then((next) => { if (active) setSession(next); })
      .catch((error: Error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setAuthReady(true); });
    const unsubscribe = onAuthStateChange((next) => setSession(next));
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      if (url.startsWith('thingsalpha://auth/confirmed')) {
        if (active) {
          setAuthMode('signin');
          setMessage('Email confirmed. You can sign in now.');
        }
        return;
      }
      if (!url.startsWith('thingsalpha://auth/reset-password')) return;
      try {
        setAuthBusy(true);
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
        if (active) setAuthBusy(false);
      }
    };
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    inventoryRequestIdRef.current += 1;
    if (actionUserIdRef.current && actionUserIdRef.current !== inventoryUserId) {
      actionUserIdRef.current = null;
      setActionBusy(false);
    }
    if (!session || authMode === 'recovery') {
      setItems([]);
      setCatalog([]);
      setShowAccount(false);
      setInventoryError(null);
      setInventoryLoading(false);
      setCatalogError(null);
      return;
    }
    setAccountEmail(session.user.email ?? '');
    void refreshInventory(session.user.id);
    void refreshCatalog();
  }, [session, authMode]);

  async function refreshInventory(expectedUserId = inventoryUserIdRef.current): Promise<boolean> {
    if (!expectedUserId) return false;
    const requestId = ++inventoryRequestIdRef.current;
    try {
      setInventoryLoading(true);
      setInventoryError(null);
      const nextItems = await loadPrivateInventory();
      if (requestId !== inventoryRequestIdRef.current || inventoryUserIdRef.current !== expectedUserId) return false;
      setItems(nextItems);
      recordInventoryVisible();
      recordValueVisible();
      return true;
    } catch (error) {
      if (requestId === inventoryRequestIdRef.current && inventoryUserIdRef.current === expectedUserId) {
        setInventoryError(friendlyInventoryError(error));
      }
      return false;
    } finally {
      if (requestId === inventoryRequestIdRef.current && inventoryUserIdRef.current === expectedUserId) {
        setInventoryLoading(false);
      }
    }
  }

  async function refreshCatalog() {
    try {
      setCatalogLoading(true);
      setCatalogError(null);
      const nextCatalog = await loadCatalog();
      setCatalog(nextCatalog);
      setSelectedVariantId((current) => current ?? nextCatalog[0]?.id ?? null);
    } catch {
      setCatalogError('Device suggestions are temporarily unavailable. You can still add any Thing manually.');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function authenticate(mode: 'signin' | 'signup') {
    if (!email.trim() || password.length < 8) {
      setMessage('Enter a valid email and a password with at least 8 characters.');
      return;
    }
    try {
      setAuthBusy(true);
      setMessage(null);
      if (mode === 'signin') await signIn(email.trim(), password);
      else setMessage(await signUp(email.trim(), password));
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setMessage('Enter the email address you use for Things.');
      return;
    }
    try {
      setAuthBusy(true);
      setMessage(null);
      await requestPasswordReset(normalizedEmail);
      setMessage('If an account exists for this email, a reset link has been sent.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
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
      setAuthBusy(true);
      setMessage(null);
      await updateRecoveredPassword(password);
      setPassword('');
      setConfirmPassword('');
      setAuthMode('signin');
      setMessage('Password updated. Sign in with your new password.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveAccountEmail() {
    const normalized = accountEmail.trim();
    if (!normalized || !normalized.includes('@')) {
      setMessage('Enter a valid email address.');
      return;
    }
    try {
      setAuthBusy(true);
      setMessage(null);
      await requestAccountEmailChange(normalized);
      setMessage('Check your inbox to confirm the new email address.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
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
      setAuthBusy(true);
      setMessage(null);
      await updateAccountPassword(accountPassword);
      setAccountPassword('');
      setAccountPasswordConfirm('');
      setMessage('Password updated.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setMessage(null);
    if (mode === 'forgot') setPassword('');
    setConfirmPassword('');
  }

  function resetThingForm() {
    setThingName('');
    setThingCategory(DEFAULT_CATEGORY);
    setThingLocation('');
    setThingNotes('');
    setEditingItemId(null);
  }

  function startEditing(item: PrivateInventoryItem) {
    setEditingItemId(item.id);
    setThingName(item.custom_name?.trim() || itemTitle(item));
    setThingCategory(item.category ?? (item.product_variants ? 'Device' : DEFAULT_CATEGORY));
    setThingLocation(item.location_label ?? '');
    setThingNotes(item.notes ?? '');
  }

  async function saveThing() {
    if (!thingName.trim()) {
      setMessage('Give your Thing a name.');
      return;
    }
    const expectedUserId = inventoryUserIdRef.current;
    if (!expectedUserId || actionUserIdRef.current) return;
    const editingId = editingItemId;
    const wasEditing = editingId !== null;
    const input = { name: thingName, category: thingCategory, location: thingLocation, notes: thingNotes };
    actionUserIdRef.current = expectedUserId;
    try {
      setActionBusy(true);
      setMessage(null);
      let createdItemId: string | null = null;
      if (editingId) await updatePrivateItemMetadata(editingId, input);
      else {
        createdItemId = await addPrivateThing(input);
        recordCaptureSuccess();
      }
      if (inventoryUserIdRef.current !== expectedUserId) return;

      if (editingId) {
        setItems((current) => current.map((item) => item.id === editingId ? {
          ...item,
          custom_name: input.name.trim(),
          category: input.category.trim() || null,
          location_label: input.location.trim() || null,
          notes: input.notes.trim() || null,
        } : item));
      } else if (createdItemId) {
        const optimisticItem: PrivateInventoryItem = {
          id: createdItemId,
          custom_name: input.name.trim(),
          category: input.category.trim() || null,
          location_label: input.location.trim() || null,
          notes: input.notes.trim() || null,
          color: null,
          created_at: new Date().toISOString(),
          market_state: null,
          value_evidence: null,
          product_variants: null,
          condition_snapshots: [],
        };
        setItems((current) => [optimisticItem, ...current.filter((item) => item.id !== createdItemId)]);
      }

      resetThingForm();
      const synced = await refreshInventory(expectedUserId);
      if (inventoryUserIdRef.current !== expectedUserId) return;
      setMessage(synced
        ? (wasEditing ? 'Item updated.' : 'Thing added to your inventory.')
        : (wasEditing
          ? 'Item updated. Inventory sync is delayed; use Refresh to confirm the latest details.'
          : 'Thing saved privately. Inventory sync is delayed—do not add it again. Use Refresh to confirm it.'));
    } catch (error) {
      if (inventoryUserIdRef.current === expectedUserId) {
        setMessage(error instanceof Error ? error.message : 'Could not save this item.');
      }
    } finally {
      if (actionUserIdRef.current === expectedUserId) {
        actionUserIdRef.current = null;
        setActionBusy(false);
      }
    }
  }

  function confirmDelete(item: PrivateInventoryItem) {
    Alert.alert('Delete item?', `Remove “${itemTitle(item)}” from your inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeThing(item) },
    ]);
  }

  async function removeThing(item: PrivateInventoryItem) {
    const expectedUserId = inventoryUserIdRef.current;
    if (!expectedUserId || actionUserIdRef.current) return;
    actionUserIdRef.current = expectedUserId;
    try {
      setActionBusy(true);
      setMessage(null);
      if (item.product_variants) await deletePrivateDevice(item.id);
      else await deletePrivateThing(item.id);
      if (inventoryUserIdRef.current !== expectedUserId) return;

      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      if (editingItemId === item.id) resetThingForm();
      const synced = await refreshInventory(expectedUserId);
      if (inventoryUserIdRef.current !== expectedUserId) return;
      setMessage(synced
        ? 'Item deleted.'
        : 'Item deleted. Inventory sync is delayed; use Refresh if it still appears.');
    } catch (error) {
      if (inventoryUserIdRef.current === expectedUserId) {
        setMessage(error instanceof Error ? error.message : 'Could not delete this item.');
      }
    } finally {
      if (actionUserIdRef.current === expectedUserId) {
        actionUserIdRef.current = null;
        setActionBusy(false);
      }
    }
  }

  async function createPrivateDevice() {
    if (!selectedVariantId) return;
    const expectedUserId = inventoryUserIdRef.current;
    if (!expectedUserId || actionUserIdRef.current) return;
    actionUserIdRef.current = expectedUserId;
    try {
      setActionBusy(true);
      setMessage(null);
      await addPrivateDevice({ variantId: selectedVariantId });
      recordCaptureSuccess();
      if (inventoryUserIdRef.current !== expectedUserId) return;

      const synced = await refreshInventory(expectedUserId);
      if (inventoryUserIdRef.current !== expectedUserId) return;
      setMessage(synced
        ? 'Device saved privately.'
        : 'Device saved privately. Inventory sync is delayed—do not add it again. Use Refresh to confirm it.');
    } catch (error) {
      if (inventoryUserIdRef.current === expectedUserId) {
        setMessage(error instanceof Error ? error.message : 'Could not save device.');
      }
    } finally {
      if (actionUserIdRef.current === expectedUserId) {
        actionUserIdRef.current = null;
        setActionBusy(false);
      }
    }
  }

  function toggleSaleIntent(itemId: string) {
    recordSellInitiated();
    setSaleIntentItemId((current) => current === itemId ? null : itemId);
  }

  function openAccount() {
    setAccountEmail(session?.user.email ?? '');
    setMessage(null);
    setShowAccount(true);
  }

  if (!authReady) {
    return <SafeAreaView style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Opening Things…</Text></SafeAreaView>;
  }

  if (!hasSupabaseConfig) {
    return <SafeAreaView style={styles.safe}><View style={styles.serviceContainer}><Text style={styles.brand}>Things</Text><Text style={styles.title}>Service unavailable</Text><Text style={styles.muted}>This build is missing its secure backend configuration.</Text></View></SafeAreaView>;
  }

  if (!session || authMode === 'recovery') {
    return (
      <AuthScreen
        mode={authMode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        busy={authBusy}
        message={message}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onModeChange={switchAuthMode}
        onAuthenticate={(mode) => void authenticate(mode)}
        onSendPasswordReset={() => void sendPasswordReset()}
        onFinishPasswordRecovery={() => void finishPasswordRecovery()}
      />
    );
  }

  if (showAccount) {
    return (
      <AccountScreen
        currentEmail={session.user.email}
        accountEmail={accountEmail}
        accountPassword={accountPassword}
        accountPasswordConfirm={accountPasswordConfirm}
        message={message}
        onAccountEmailChange={setAccountEmail}
        onAccountPasswordChange={setAccountPassword}
        onAccountPasswordConfirmChange={setAccountPasswordConfirm}
        onSaveEmail={() => void saveAccountEmail()}
        onSavePassword={() => void saveAccountPassword()}
        onSignOut={() => void signOut()}
        onDone={() => setShowAccount(false)}
      />
    );
  }

  return (
    <InventoryScreen
      items={items}
      inventoryLoading={inventoryLoading}
      inventoryError={inventoryError}
      catalog={catalog}
      catalogLoading={catalogLoading}
      catalogError={catalogError}
      selectedVariantId={selectedVariantId}
      selectedVariant={selectedVariant}
      thingName={thingName}
      thingCategory={thingCategory}
      thingLocation={thingLocation}
      thingNotes={thingNotes}
      editingItemId={editingItemId}
      actionBusy={actionBusy}
      message={message}
      saleIntentItemId={saleIntentItemId}
      onOpenAccount={openAccount}
      onThingNameChange={setThingName}
      onThingCategoryChange={setThingCategory}
      onThingLocationChange={setThingLocation}
      onThingNotesChange={setThingNotes}
      onSaveThing={() => void saveThing()}
      onCancelEditing={resetThingForm}
      onRefreshInventory={() => void refreshInventory()}
      onStartEditing={startEditing}
      onDelete={confirmDelete}
      onToggleSaleIntent={toggleSaleIntent}
      onSelectVariant={setSelectedVariantId}
      onCreatePrivateDevice={() => void createPrivateDevice()}
      onRefreshCatalog={() => void refreshCatalog()}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F4F6F8' },
  serviceContainer: { padding: 24, paddingTop: 64, gap: 18 },
  brand: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: '#101828' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8, color: '#101828' },
  muted: { fontSize: 14, lineHeight: 20, color: '#667085' },
});