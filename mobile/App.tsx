import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivityIndicator, Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { beginPasswordRecoveryFromUrl, getSession, onAuthStateChange, requestAccountEmailChange, requestPasswordReset, signIn, signOut, signUp, updateAccountPassword, updateRecoveredPassword } from './src/data/auth';
import { addPrivateDevice, addPrivateThing, CatalogVariant, deletePrivateThing, loadCatalog, loadPrivateInventory, PrivateInventoryItem, updatePrivateThing } from './src/data/inventory';
import { recordCaptureSuccess, recordInventoryVisible, recordSellInitiated, recordValueVisible } from './src/lib/activationAppTransitions';
import { buildSaleStartSurface } from './src/lib/saleStartSurface';
import { hasSupabaseConfig } from './src/lib/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';
const DEFAULT_CATEGORY = 'Other';

function variantTitle(variant: CatalogVariant): string {
  const product = variant.products;
  const base = product ? `${product.brand} ${product.family}` : 'Device';
  return `${base}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

function itemTitle(item: PrivateInventoryItem): string {
  if (item.custom_name?.trim()) return item.custom_name.trim();
  const variant = item.product_variants;
  const product = variant?.products;
  if (!variant || !product) return 'Thing';
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

function friendlyInventoryError(error: unknown): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('jwt') || raw.includes('auth')) return 'Your session needs to be refreshed. Sign out and sign in again.';
  if (raw.includes('network') || raw.includes('fetch')) return 'Things could not reach the service. Check your connection and try again.';
  return 'Your inventory could not be loaded. Your data is still private. Try again in a moment.';
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

  const [showAccount, setShowAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [saleIntentItemId, setSaleIntentItemId] = useState<string | null>(null);

  const selectedVariant = useMemo(() => catalog.find((variant) => variant.id === selectedVariantId) ?? null, [catalog, selectedVariantId]);

  useEffect(() => {
    if (!hasSupabaseConfig) { setAuthReady(true); return; }
    let active = true;
    getSession().then((next) => { if (active) setSession(next); }).catch((error: Error) => { if (active) setMessage(error.message); }).finally(() => { if (active) setAuthReady(true); });
    const unsubscribe = onAuthStateChange((next) => setSession(next));
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      if (url.startsWith('thingsalpha://auth/confirmed')) {
        if (active) { setAuthMode('signin'); setMessage('Email confirmed. You can sign in now.'); }
        return;
      }
      if (!url.startsWith('thingsalpha://auth/reset-password')) return;
      try {
        setAuthBusy(true); setMessage(null);
        await beginPasswordRecoveryFromUrl(url);
        if (!active) return;
        setPassword(''); setConfirmPassword(''); setAuthMode('recovery');
      } catch (error) {
        if (!active) return;
        setAuthMode('forgot'); setMessage(friendlyAuthError(error));
      } finally { if (active) setAuthBusy(false); }
    };
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!session || authMode === 'recovery') {
      setItems([]); setCatalog([]); setShowAccount(false); setInventoryError(null); setCatalogError(null);
      return;
    }
    setAccountEmail(session.user.email ?? '');
    void refreshInventory();
    void refreshCatalog();
  }, [session, authMode]);

  async function refreshInventory() {
    try {
      setInventoryLoading(true); setInventoryError(null);
      const nextItems = await loadPrivateInventory();
      setItems(nextItems); recordInventoryVisible(); recordValueVisible();
    } catch (error) {
      setInventoryError(friendlyInventoryError(error));
    } finally { setInventoryLoading(false); }
  }

  async function refreshCatalog() {
    try {
      setCatalogLoading(true); setCatalogError(null);
      const nextCatalog = await loadCatalog();
      setCatalog(nextCatalog);
      setSelectedVariantId((current) => current ?? nextCatalog[0]?.id ?? null);
    } catch {
      setCatalogError('Device suggestions are temporarily unavailable. You can still add any Thing manually.');
    } finally { setCatalogLoading(false); }
  }

  async function authenticate(mode: 'signin' | 'signup') {
    if (!email.trim() || password.length < 8) { setMessage('Enter a valid email and a password with at least 8 characters.'); return; }
    try {
      setAuthBusy(true); setMessage(null);
      if (mode === 'signin') await signIn(email.trim(), password);
      else setMessage(await signUp(email.trim(), password));
    } catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setAuthBusy(false); }
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) { setMessage('Enter the email address you use for Things.'); return; }
    try { setAuthBusy(true); setMessage(null); await requestPasswordReset(normalizedEmail); setMessage('If an account exists for this email, a reset link has been sent.'); }
    catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setAuthBusy(false); }
  }

  async function finishPasswordRecovery() {
    if (password.length < 8) { setMessage('Use at least 8 characters for your new password.'); return; }
    if (password !== confirmPassword) { setMessage('The passwords do not match.'); return; }
    try { setAuthBusy(true); setMessage(null); await updateRecoveredPassword(password); setPassword(''); setConfirmPassword(''); setAuthMode('signin'); setMessage('Password updated. Sign in with your new password.'); }
    catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setAuthBusy(false); }
  }

  async function saveAccountEmail() {
    const normalized = accountEmail.trim();
    if (!normalized || !normalized.includes('@')) { setMessage('Enter a valid email address.'); return; }
    try { setAuthBusy(true); setMessage(null); await requestAccountEmailChange(normalized); setMessage('Check your inbox to confirm the new email address.'); }
    catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setAuthBusy(false); }
  }

  async function saveAccountPassword() {
    if (accountPassword.length < 8) { setMessage('Use at least 8 characters for your new password.'); return; }
    if (accountPassword !== accountPasswordConfirm) { setMessage('The new passwords do not match.'); return; }
    try { setAuthBusy(true); setMessage(null); await updateAccountPassword(accountPassword); setAccountPassword(''); setAccountPasswordConfirm(''); setMessage('Password updated.'); }
    catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setAuthBusy(false); }
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode); setMessage(null); if (mode === 'forgot') setPassword(''); setConfirmPassword('');
  }

  function resetThingForm() {
    setThingName(''); setThingCategory(DEFAULT_CATEGORY); setThingLocation(''); setThingNotes(''); setEditingItemId(null);
  }

  function startEditing(item: PrivateInventoryItem) {
    if (item.product_variants) return;
    setEditingItemId(item.id);
    setThingName(item.custom_name ?? ''); setThingCategory(item.category ?? DEFAULT_CATEGORY); setThingLocation(item.location_label ?? ''); setThingNotes(item.notes ?? '');
  }

  async function saveThing() {
    if (!thingName.trim()) { setMessage('Give your Thing a name.'); return; }
    try {
      setActionBusy(true); setMessage(null);
      const input = { name: thingName, category: thingCategory, location: thingLocation, notes: thingNotes };
      if (editingItemId) await updatePrivateThing(editingItemId, input);
      else { await addPrivateThing(input); recordCaptureSuccess(); }
      resetThingForm(); await refreshInventory(); setMessage(editingItemId ? 'Thing updated.' : 'Thing added to your inventory.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this Thing.'); }
    finally { setActionBusy(false); }
  }

  function confirmDelete(item: PrivateInventoryItem) {
    Alert.alert('Delete Thing?', `Remove “${itemTitle(item)}” from your inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeThing(item) },
    ]);
  }

  async function removeThing(item: PrivateInventoryItem) {
    try { setActionBusy(true); setMessage(null); await deletePrivateThing(item.id); if (editingItemId === item.id) resetThingForm(); await refreshInventory(); setMessage('Thing deleted.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete this Thing.'); }
    finally { setActionBusy(false); }
  }

  async function createPrivateDevice() {
    if (!selectedVariantId) return;
    try { setActionBusy(true); setMessage(null); await addPrivateDevice({ variantId: selectedVariantId }); recordCaptureSuccess(); await refreshInventory(); setMessage('Device added to your private inventory.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save device.'); }
    finally { setActionBusy(false); }
  }

  if (!authReady) return <SafeAreaView style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Opening Things…</Text></SafeAreaView>;
  if (!hasSupabaseConfig) return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.brand}>Things</Text><Text style={styles.title}>Service unavailable</Text><Text style={styles.subtitle}>This build is missing its secure backend configuration.</Text></View></SafeAreaView>;

  if (authMode === 'recovery') return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.brand}>Things</Text><Text style={styles.title}>Choose a new password</Text><Text style={styles.subtitle}>Use at least 8 characters.</Text><View style={styles.card}><TextInput value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry style={styles.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry style={styles.input}/><TouchableOpacity style={[styles.primaryButton,(authBusy||password.length<8||password!==confirmPassword)&&styles.disabled]} disabled={authBusy||password.length<8||password!==confirmPassword} onPress={()=>void finishPasswordRecovery()}><Text style={styles.primaryButtonText}>{authBusy?'Updating…':'Update password'}</Text></TouchableOpacity>{message?<Text style={styles.notice}>{message}</Text>:null}</View></View></SafeAreaView>;

  if (!session) return <SafeAreaView style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.authContainer}><Text style={styles.brand}>Things</Text><Text style={styles.title}>{authMode==='signup'?'Create your account':authMode==='forgot'?'Reset your password':'Everything you own, in one place'}</Text><Text style={styles.subtitle}>{authMode==='signup'?'Start a private inventory you control.':authMode==='forgot'?'We’ll send a secure reset link to your email.':'Sign in to see and manage your private inventory.'}</Text><View style={styles.card}><TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input}/>{authMode!=='forgot'?<TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoComplete="password" style={styles.input}/>:null}{authMode==='signin'?<><TouchableOpacity style={[styles.primaryButton,authBusy&&styles.disabled]} disabled={authBusy} onPress={()=>void authenticate('signin')}><Text style={styles.primaryButtonText}>{authBusy?'Signing in…':'Sign in'}</Text></TouchableOpacity><TouchableOpacity disabled={authBusy} onPress={()=>switchAuthMode('forgot')}><Text style={styles.linkCentered}>Forgot password?</Text></TouchableOpacity><View style={styles.divider}/><TouchableOpacity style={styles.secondaryButton} onPress={()=>switchAuthMode('signup')}><Text style={styles.secondaryButtonText}>Create account</Text></TouchableOpacity></>:null}{authMode==='signup'?<><Text style={styles.helper}>We’ll email you a confirmation link before your first sign-in.</Text><TouchableOpacity style={[styles.primaryButton,authBusy&&styles.disabled]} disabled={authBusy} onPress={()=>void authenticate('signup')}><Text style={styles.primaryButtonText}>{authBusy?'Creating account…':'Create account'}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={()=>switchAuthMode('signin')}><Text style={styles.secondaryButtonText}>Back to sign in</Text></TouchableOpacity></>:null}{authMode==='forgot'?<><TouchableOpacity style={[styles.primaryButton,authBusy&&styles.disabled]} disabled={authBusy} onPress={()=>void sendPasswordReset()}><Text style={styles.primaryButtonText}>{authBusy?'Sending…':'Send reset link'}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={()=>switchAuthMode('signin')}><Text style={styles.secondaryButtonText}>Back to sign in</Text></TouchableOpacity></>:null}{message?<Text style={styles.notice}>{message}</Text>:null}</View></ScrollView></SafeAreaView>;

  if (showAccount) return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><View style={styles.rowBetween}><View><Text style={styles.brand}>Things</Text><Text style={styles.pageTitle}>Account</Text></View><TouchableOpacity onPress={()=>setShowAccount(false)}><Text style={styles.link}>Done</Text></TouchableOpacity></View><View style={styles.card}><Text style={styles.sectionTitle}>Email</Text><Text style={styles.helper}>{session.user.email}</Text><TextInput value={accountEmail} onChangeText={setAccountEmail} placeholder="New email" autoCapitalize="none" style={styles.input}/><TouchableOpacity style={styles.secondaryButton} onPress={()=>void saveAccountEmail()}><Text style={styles.secondaryButtonText}>Change email</Text></TouchableOpacity></View><View style={styles.card}><Text style={styles.sectionTitle}>Password</Text><TextInput value={accountPassword} onChangeText={setAccountPassword} placeholder="New password" secureTextEntry style={styles.input}/><TextInput value={accountPasswordConfirm} onChangeText={setAccountPasswordConfirm} placeholder="Confirm password" secureTextEntry style={styles.input}/><TouchableOpacity style={styles.primaryButton} onPress={()=>void saveAccountPassword()}><Text style={styles.primaryButtonText}>Update password</Text></TouchableOpacity></View>{message?<Text style={styles.notice}>{message}</Text>:null}<TouchableOpacity style={styles.secondaryButton} onPress={()=>void signOut()}><Text style={styles.secondaryButtonText}>Sign out</Text></TouchableOpacity></ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
    <View style={styles.rowBetween}><View><Text style={styles.brand}>Things</Text><Text style={styles.pageTitle}>My inventory</Text></View><TouchableOpacity onPress={()=>{setAccountEmail(session.user.email??'');setMessage(null);setShowAccount(true);}}><Text style={styles.link}>Account</Text></TouchableOpacity></View>
    <Text style={styles.subtitle}>Keep track of the things that matter to you. Your inventory is private to your account.</Text>

    <View style={styles.summaryCard}><Text style={styles.metric}>{items.length}</Text><Text style={styles.metricLabel}>{items.length===1?'Thing':'Things'} saved</Text></View>

    <View style={styles.card}><Text style={styles.sectionTitle}>{editingItemId?'Edit Thing':'Add a Thing'}</Text><Text style={styles.helper}>Start with the basics. You can update them anytime.</Text><TextInput value={thingName} onChangeText={setThingName} placeholder="Name · e.g. Road bike" maxLength={120} style={styles.input}/><TextInput value={thingCategory} onChangeText={setThingCategory} placeholder="Category · e.g. Sports" maxLength={80} style={styles.input}/><TextInput value={thingLocation} onChangeText={setThingLocation} placeholder="Location (optional)" maxLength={120} style={styles.input}/><TextInput value={thingNotes} onChangeText={setThingNotes} placeholder="Notes (optional)" maxLength={2000} multiline style={[styles.input,styles.notesInput]}/><TouchableOpacity style={[styles.primaryButton,(!thingName.trim()||actionBusy)&&styles.disabled]} disabled={!thingName.trim()||actionBusy} onPress={()=>void saveThing()}><Text style={styles.primaryButtonText}>{actionBusy?'Saving…':editingItemId?'Save changes':'Add to inventory'}</Text></TouchableOpacity>{editingItemId?<TouchableOpacity style={styles.secondaryButton} onPress={resetThingForm}><Text style={styles.secondaryButtonText}>Cancel editing</Text></TouchableOpacity>:null}</View>

    {message?<Text style={styles.notice}>{message}</Text>:null}

    <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Inventory</Text><TouchableOpacity disabled={inventoryLoading} onPress={()=>void refreshInventory()}><Text style={styles.link}>{inventoryLoading?'Refreshing…':'Refresh'}</Text></TouchableOpacity></View>
    {inventoryLoading&&items.length===0?<View style={styles.stateCard}><ActivityIndicator/><Text style={styles.helper}>Loading your inventory…</Text></View>:null}
    {inventoryError?<View style={styles.errorCard}><Text style={styles.errorTitle}>Couldn’t load inventory</Text><Text style={styles.helper}>{inventoryError}</Text><TouchableOpacity style={styles.secondaryButton} onPress={()=>void refreshInventory()}><Text style={styles.secondaryButtonText}>Try again</Text></TouchableOpacity></View>:null}
    {!inventoryLoading&&!inventoryError&&items.length===0?<View style={styles.stateCard}><Text style={styles.emptyIcon}>＋</Text><Text style={styles.sectionTitle}>Your inventory is empty</Text><Text style={styles.helper}>Add your first Thing above. It will appear here after saving.</Text></View>:null}

    {items.map((item)=>{const snapshot=item.condition_snapshots[0];const generic=!item.product_variants;const sale=buildSaleStartSurface(item.id,null);const open=saleIntentItemId===item.id;return <View key={item.id} style={styles.itemCard}><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.itemTitle}>{itemTitle(item)}</Text><Text style={styles.muted}>{generic?(item.category||'Thing'):variantTitle(item.product_variants as CatalogVariant)}</Text></View><View style={styles.privatePill}><Text style={styles.privatePillText}>Private</Text></View></View>{item.location_label?<Text style={styles.meta}>⌖ {item.location_label}</Text>:null}{item.notes?<Text style={styles.notes}>{item.notes}</Text>:null}{snapshot?<Text style={styles.meta}>Condition: {snapshot.housing_state.replace(/_/g,' ').toLowerCase()}</Text>:null}{generic?<View style={styles.actionRow}><TouchableOpacity style={styles.smallButton} onPress={()=>startEditing(item)}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity><TouchableOpacity style={styles.smallDangerButton} onPress={()=>confirmDelete(item)}><Text style={styles.smallDangerText}>Delete</Text></TouchableOpacity></View>:<><Text style={styles.valueLabel}>{sale.valueLabel}</Text><TouchableOpacity style={styles.secondaryButton} onPress={()=>{recordSellInitiated();setSaleIntentItemId(open?null:item.id);}}><Text style={styles.secondaryButtonText}>{sale.actionLabel}</Text></TouchableOpacity>{open?<View style={styles.saleDecision}><Text style={styles.helper}>{sale.privacyNotice}</Text></View>:null}</>}</View>;})}

    <View style={styles.card}><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.sectionTitle}>Add from device catalog</Text><Text style={styles.helper}>Optional shortcut for supported phones.</Text></View>{catalogLoading?<ActivityIndicator/>:null}</View>{catalogError?<Text style={styles.helper}>{catalogError}</Text>:null}{catalog.slice(0,4).map((variant)=>{const selected=variant.id===selectedVariantId;return <TouchableOpacity key={variant.id} style={[styles.variantButton,selected&&styles.variantButtonSelected]} onPress={()=>setSelectedVariantId(variant.id)}><Text style={styles.variantText}>{variantTitle(variant)}</Text></TouchableOpacity>;})}{catalog.length>0?<TouchableOpacity style={[styles.secondaryButton,(!selectedVariant||actionBusy)&&styles.disabled]} disabled={!selectedVariant||actionBusy} onPress={()=>void createPrivateDevice()}><Text style={styles.secondaryButtonText}>Add selected device</Text></TouchableOpacity>:null}{catalogError?<TouchableOpacity onPress={()=>void refreshCatalog()}><Text style={styles.linkCentered}>Retry device suggestions</Text></TouchableOpacity>:null}</View>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F7F9'},centered:{flex:1,alignItems:'center',justifyContent:'center',gap:12,backgroundColor:'#F6F7F9'},container:{padding:20,paddingBottom:44,gap:16},authContainer:{padding:24,paddingTop:64,gap:18},brand:{fontSize:18,fontWeight:'800',letterSpacing:-0.3,color:'#101828'},title:{fontSize:34,lineHeight:40,fontWeight:'800',letterSpacing:-0.8,color:'#101828'},pageTitle:{fontSize:28,lineHeight:34,fontWeight:'800',letterSpacing:-0.5,color:'#101828'},subtitle:{fontSize:16,lineHeight:23,color:'#667085'},card:{backgroundColor:'#FFFFFF',borderRadius:20,padding:18,gap:11,borderWidth:1,borderColor:'#EAECF0'},summaryCard:{backgroundColor:'#101828',borderRadius:20,padding:20},metric:{fontSize:36,fontWeight:'800',color:'#FFFFFF'},metricLabel:{fontSize:14,color:'#D0D5DD'},sectionTitle:{fontSize:18,fontWeight:'750',color:'#101828'},input:{borderWidth:1,borderColor:'#D0D5DD',borderRadius:13,paddingHorizontal:14,paddingVertical:13,fontSize:16,color:'#101828',backgroundColor:'#FFFFFF'},notesInput:{minHeight:86,textAlignVertical:'top'},primaryButton:{borderRadius:13,minHeight:50,alignItems:'center',justifyContent:'center',backgroundColor:'#101828'},primaryButtonText:{color:'#FFFFFF',fontWeight:'700',fontSize:16},secondaryButton:{borderRadius:13,minHeight:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFFFFF'},secondaryButtonText:{color:'#344054',fontWeight:'700',fontSize:15},disabled:{opacity:0.45},helper:{fontSize:14,lineHeight:20,color:'#667085'},notice:{fontSize:14,lineHeight:20,color:'#344054',backgroundColor:'#EEF4FF',padding:14,borderRadius:13},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},flex:{flex:1},link:{fontSize:15,fontWeight:'700',color:'#344054'},linkCentered:{fontSize:14,fontWeight:'700',color:'#344054',textAlign:'center',paddingVertical:6},divider:{height:1,backgroundColor:'#EAECF0',marginVertical:2},stateCard:{backgroundColor:'#FFFFFF',borderRadius:20,padding:24,gap:10,alignItems:'center',borderWidth:1,borderColor:'#EAECF0'},errorCard:{backgroundColor:'#FFF8F7',borderRadius:20,padding:18,gap:10,borderWidth:1,borderColor:'#FECDCA'},errorTitle:{fontSize:17,fontWeight:'700',color:'#B42318'},emptyIcon:{fontSize:30,color:'#98A2B3'},itemCard:{backgroundColor:'#FFFFFF',borderRadius:20,padding:18,gap:10,borderWidth:1,borderColor:'#EAECF0'},itemTitle:{fontSize:18,fontWeight:'750',color:'#101828'},muted:{fontSize:13,color:'#667085'},meta:{fontSize:14,color:'#667085'},notes:{fontSize:14,lineHeight:20,color:'#344054'},privatePill:{borderRadius:999,backgroundColor:'#ECFDF3',paddingHorizontal:10,paddingVertical:6},privatePillText:{fontSize:12,fontWeight:'700',color:'#027A48'},actionRow:{flexDirection:'row',gap:10,marginTop:2},smallButton:{flex:1,borderWidth:1,borderColor:'#D0D5DD',borderRadius:11,paddingVertical:10,alignItems:'center'},smallButtonText:{fontSize:14,fontWeight:'700',color:'#344054'},smallDangerButton:{flex:1,borderWidth:1,borderColor:'#FDA29B',borderRadius:11,paddingVertical:10,alignItems:'center'},smallDangerText:{fontSize:14,fontWeight:'700',color:'#B42318'},valueLabel:{fontSize:14,fontWeight:'700',color:'#344054'},saleDecision:{backgroundColor:'#F8FAFC',borderRadius:12,padding:12},variantButton:{borderWidth:1,borderColor:'#D0D5DD',borderRadius:11,padding:12},variantButtonSelected:{borderWidth:2,borderColor:'#101828'},variantText:{fontSize:14,color:'#344054'}
});