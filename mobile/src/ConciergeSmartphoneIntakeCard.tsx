import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { discardConciergeDraft, loadConciergeDraft, saveConciergeDraft } from './data/conciergeDraft';
import { ConciergeCondition, conciergeIntakeReady, validateConciergeIntake } from './data/conciergeIntake';

const conditions: ConciergeCondition[] = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'];

export function ConciergeSmartphoneIntakeCard() {
  const [model, setModel] = useState('');
  const [storage, setStorage] = useState('');
  const [condition, setCondition] = useState<ConciergeCondition>('GOOD');
  const [defects, setDefects] = useState('');
  const [battery, setBattery] = useState('');
  const [activationLockRemoved, setActivationLockRemoved] = useState(false);
  const [lawfulOwnershipConfirmed, setLawfulOwnershipConfirmed] = useState(false);
  const [priceFloor, setPriceFloor] = useState('');
  const [localArea, setLocalArea] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [draftStatus, setDraftStatus] = useState('Not published or shared.');

  useEffect(() => {
    void loadConciergeDraft(AsyncStorage).then((draft) => {
      if (!draft) return;
      const value = draft.intake;
      setModel(value.model);
      setStorage(String(value.storageGb));
      setCondition(value.condition);
      setDefects(value.defects);
      setBattery(value.batteryHealth == null ? '' : String(value.batteryHealth));
      setActivationLockRemoved(value.activationLockRemoved);
      setLawfulOwnershipConfirmed(value.lawfulOwnershipConfirmed);
      setPriceFloor((value.priceFloorCents / 100).toFixed(2));
      setLocalArea(value.localArea);
      setDraftStatus('Draft restored from this device. Nothing was published or shared.');
    });
  }, []);

  const intake = useMemo(() => ({
    model,
    storageGb: Number(storage),
    condition,
    defects,
    batteryHealth: battery.trim() === '' ? null : Number(battery),
    activationLockRemoved,
    lawfulOwnershipConfirmed,
    priceFloorCents: Math.round(Number(priceFloor) * 100),
    localArea,
  }), [model, storage, condition, defects, battery, activationLockRemoved, lawfulOwnershipConfirmed, priceFloor, localArea]);
  const errors = useMemo(() => validateConciergeIntake(intake), [intake]);
  const ready = conciergeIntakeReady(errors);

  const saveDraft = async () => {
    await saveConciergeDraft(AsyncStorage, intake);
    setDraftStatus('Draft saved only on this device. Nothing was published or shared.');
  };

  const discardDraft = async () => {
    await discardConciergeDraft(AsyncStorage);
    setModel(''); setStorage(''); setCondition('GOOD'); setDefects(''); setBattery('');
    setActivationLockRemoved(false); setLawfulOwnershipConfirmed(false); setPriceFloor(''); setLocalArea(''); setSubmitted(false);
    setDraftStatus('Draft discarded. Nothing was published or shared.');
  };

  return <View style={styles.card}>
    <Text style={styles.title}>Prepare a phone for a local buyer</Text>
    <Text style={styles.helper}>This stays on your device for now. We do not ask for IMEI, serial number or a full address.</Text>
    <Text style={styles.status}>{draftStatus}</Text>
    <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Model, e.g. iPhone 14 Pro" />
    <TextInput style={styles.input} value={storage} onChangeText={setStorage} placeholder="Storage (GB)" keyboardType="number-pad" />
    <Text style={styles.label}>Condition</Text>
    <View style={styles.wrap}>{conditions.map((value) => <TouchableOpacity key={value} style={[styles.choice, condition === value && styles.selected]} onPress={() => setCondition(value)}><Text>{value}</Text></TouchableOpacity>)}</View>
    <TextInput style={[styles.input, styles.multiline]} value={defects} onChangeText={setDefects} placeholder="Defects (optional, no identifiers)" multiline />
    <TextInput style={styles.input} value={battery} onChangeText={setBattery} placeholder="Battery health % (optional)" keyboardType="number-pad" />
    <TextInput style={styles.input} value={priceFloor} onChangeText={setPriceFloor} placeholder="Minimum price (€)" keyboardType="decimal-pad" />
    <TextInput style={styles.input} value={localArea} onChangeText={setLocalArea} placeholder="City / district / postal code" />
    <TouchableOpacity style={styles.checkRow} onPress={() => setActivationLockRemoved((value) => !value)}><Text style={styles.check}>{activationLockRemoved ? '✓' : '○'}</Text><Text style={styles.checkText}>Find My / activation lock will be removed before handover</Text></TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={() => setLawfulOwnershipConfirmed((value) => !value)}><Text style={styles.check}>{lawfulOwnershipConfirmed ? '✓' : '○'}</Text><Text style={styles.checkText}>I confirm that I lawfully own this phone</Text></TouchableOpacity>
    {submitted && !ready ? <View>{Object.values(errors).map((error) => error ? <Text key={error} style={styles.error}>• {error}</Text> : null)}</View> : null}
    {submitted && ready ? <Text style={styles.success}>Ready for a concierge match. Nothing has been published or shared.</Text> : null}
    <TouchableOpacity style={[styles.primary, !ready && styles.disabled]} onPress={() => setSubmitted(true)}><Text style={styles.primaryText}>Check readiness</Text></TouchableOpacity>
    <View style={styles.actions}>
      <TouchableOpacity style={styles.secondary} onPress={() => void saveDraft()}><Text style={styles.secondaryText}>Save draft on device</Text></TouchableOpacity>
      <TouchableOpacity style={styles.discard} onPress={() => void discardDraft()}><Text style={styles.discardText}>Discard draft</Text></TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#101828' },
  helper: { fontSize: 13, lineHeight: 19, color: '#667085' },
  status: { fontSize: 12, lineHeight: 18, color: '#475467', backgroundColor: '#F2F4F7', borderRadius: 8, padding: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#344054' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  selected: { borderWidth: 2, borderColor: '#101828' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 },
  check: { width: 20, fontSize: 18, fontWeight: '700' },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#344054' },
  error: { color: '#B42318', fontSize: 13, lineHeight: 19 },
  success: { color: '#067647', backgroundColor: '#ECFDF3', borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 19 },
  primary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#101828' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: '#98A2B3' },
  secondaryText: { color: '#344054', fontWeight: '700' },
  discard: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  discardText: { color: '#B42318', fontWeight: '700' },
});
