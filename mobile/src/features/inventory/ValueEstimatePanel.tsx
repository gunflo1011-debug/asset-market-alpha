import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { estimatePrivateItemValue } from '../../data/inventory';
import { ItemImagesPanel } from './ItemImagesPanel';
import type { ValuationConditionGrade } from './types';

type Props = {
  itemId: string;
  busy?: boolean;
  onEstimated: () => void | Promise<void>;
};

const CONDITION_OPTIONS: Array<{ grade: ValuationConditionGrade; label: string }> = [
  { grade: 'LIKE_NEW', label: 'Like new' },
  { grade: 'GOOD', label: 'Good' },
  { grade: 'FAIR', label: 'Fair' },
  { grade: 'POOR', label: 'Poor' },
];

export function ValueEstimatePanel({ itemId, busy = false, onEstimated }: Props) {
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseYear, setPurchaseYear] = useState(String(new Date().getFullYear()));
  const [conditionGrade, setConditionGrade] = useState<ValuationConditionGrade>('GOOD');
  const [estimating, setEstimating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const normalized = purchasePrice.replace(',', '.').trim();
    const euros = Number(normalized);
    const year = Number.parseInt(purchaseYear.trim(), 10);
    const currentYear = new Date().getFullYear();
    const valid = Number.isFinite(euros) && euros > 0 && euros <= 10_000_000 && Number.isInteger(year) && year >= 1970 && year <= currentYear;
    return { valid, cents: Math.round(euros * 100), year };
  }, [purchasePrice, purchaseYear]);

  const disabled = !parsed.valid || busy || estimating;

  async function runEstimate() {
    if (disabled) return;
    try {
      setEstimating(true);
      setStatus(null);
      const cents = await estimatePrivateItemValue(itemId, {
        purchasePriceCents: parsed.cents,
        purchaseYear: parsed.year,
        conditionGrade,
      });
      await onEstimated();
      setStatus(`Things estimate updated: ${(cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not estimate this item yet.');
    } finally {
      setEstimating(false);
    }
  }

  return (
    <>
      <ItemImagesPanel itemId={itemId} />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THINGS ESTIMATE</Text>
        <Text style={styles.title}>Get a first euro estimate</Text>
        <Text style={styles.copy}>Tell Things what you paid, when you bought it, and its condition. This is a transparent model estimate — not a verified market comparison.</Text>

        {estimating ? (
          <View style={[styles.stateCard, styles.stateCardActive]}>
            <Text style={styles.stateLabel}>ESTIMATING NOW</Text>
            <Text style={styles.stateTitle}>Calculating your Things Estimate…</Text>
            <Text style={styles.stateCopy}>Your Thing is already saved. This only updates its private reference value.</Text>
          </View>
        ) : !status ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateLabel}>ESTIMATE PENDING</Text>
            <Text style={styles.stateTitle}>No estimate has been calculated yet</Text>
            <Text style={styles.stateCopy}>Nothing has failed. Add the purchase details below whenever you are ready; until then the value stays unknown rather than being treated as €0.</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Purchase price (€)</Text>
        <TextInput value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" placeholder="e.g. 1200" style={styles.input} />

        <Text style={styles.label}>Purchase year</Text>
        <TextInput value={purchaseYear} onChangeText={setPurchaseYear} keyboardType="number-pad" maxLength={4} placeholder="e.g. 2023" style={styles.input} />

        <Text style={styles.label}>Condition</Text>
        <View style={styles.options}>
          {CONDITION_OPTIONS.map((option) => {
            const active = option.grade === conditionGrade;
            return (
              <TouchableOpacity key={option.grade} style={[styles.option, active && styles.optionActive]} onPress={() => setConditionGrade(option.grade)}>
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity disabled={disabled} style={[styles.button, disabled && styles.buttonDisabled]} onPress={() => void runEstimate()}>
          <Text style={styles.buttonText}>{estimating ? 'Estimating…' : 'Estimate current value'}</Text>
        </TouchableOpacity>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <Text style={styles.disclaimer}>Purchase price unknown? Skip this for now. Unknown value stays unknown and is never treated as €0.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E4E7EC' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#667085' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#101828' },
  copy: { fontSize: 14, lineHeight: 20, color: '#667085', marginBottom: 4 },
  stateCard: { borderRadius: 14, padding: 13, gap: 4, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E4E7EC' },
  stateCardActive: { backgroundColor: '#EEF4FF', borderColor: '#C7D7FE' },
  stateLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#667085' },
  stateTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: '#101828' },
  stateCopy: { fontSize: 12, lineHeight: 18, color: '#667085' },
  label: { fontSize: 14, fontWeight: '700', color: '#344054', marginTop: 4 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 14, fontSize: 16, fontWeight: '600', color: '#101828', backgroundColor: '#FFFFFF' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F2F4F7' },
  optionActive: { backgroundColor: '#101828' },
  optionText: { fontSize: 14, fontWeight: '700', color: '#475467' },
  optionTextActive: { color: '#FFFFFF' },
  button: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828', marginTop: 4 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  status: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: '#344054' },
  disclaimer: { fontSize: 12, lineHeight: 18, color: '#98A2B3' },
});
