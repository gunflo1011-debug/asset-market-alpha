import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

  return <View style={styles.card}>
    <Text style={styles.title}>Prepare a phone for a local buyer</Text>
    <Text style={styles.helper}>This stays on this screen for now. We do not ask for IMEI, serial number or a full address.</Text>
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
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#101828' },
  helper: { fontSize: 13, lineHeight: 19, color: '#667085' },
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
});
