import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ValuationConditionGrade, ValuationInput } from './types';

type Props = {
  busy: boolean;
  onEstimate: (input: ValuationInput) => void;
};

const CONDITION_OPTIONS: Array<{ grade: ValuationConditionGrade; label: string }> = [
  { grade: 'LIKE_NEW', label: 'Like new' },
  { grade: 'GOOD', label: 'Good' },
  { grade: 'FAIR', label: 'Fair' },
  { grade: 'POOR', label: 'Poor' },
];

export function ValueEstimatePanel({ busy, onEstimate }: Props) {
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseYear, setPurchaseYear] = useState(String(new Date().getFullYear()));
  const [conditionGrade, setConditionGrade] = useState<ValuationConditionGrade>('GOOD');

  const parsed = useMemo(() => {
    const normalized = purchasePrice.replace(',', '.').trim();
    const euros = Number(normalized);
    const year = Number.parseInt(purchaseYear.trim(), 10);
    const currentYear = new Date().getFullYear();
    const valid = Number.isFinite(euros) && euros > 0 && euros <= 10_000_000 && Number.isInteger(year) && year >= 1970 && year <= currentYear;
    return { valid, cents: Math.round(euros * 100), year };
  }, [purchasePrice, purchaseYear]);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>VALUE ESTIMATE</Text>
      <Text style={styles.title}>Get a first euro estimate</Text>
      <Text style={styles.copy}>Tell Things what you paid, when you bought it, and its condition. This is a transparent model estimate — not a verified market comparison.</Text>

      <Text style={styles.label}>Purchase price (€)</Text>
      <TextInput
        value={purchasePrice}
        onChangeText={setPurchasePrice}
        keyboardType="decimal-pad"
        placeholder="e.g. 1200"
        style={styles.input}
      />

      <Text style={styles.label}>Purchase year</Text>
      <TextInput
        value={purchaseYear}
        onChangeText={setPurchaseYear}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="e.g. 2023"
        style={styles.input}
      />

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

      <TouchableOpacity
        disabled={!parsed.valid || busy}
        style={[styles.button, (!parsed.valid || busy) && styles.buttonDisabled]}
        onPress={() => onEstimate({ purchasePriceCents: parsed.cents, purchaseYear: parsed.year, conditionGrade })}
      >
        <Text style={styles.buttonText}>{busy ? 'Estimating…' : 'Estimate current value'}</Text>
      </TouchableOpacity>
      <Text style={styles.disclaimer}>You can refine this later when real comparable-market evidence is available.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, gap: 12, borderWidth: 1, borderColor: '#E4E7EC' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: '#667085' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#101828' },
  copy: { fontSize: 15, lineHeight: 22, color: '#667085', marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '700', color: '#344054', marginTop: 4 },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 16, paddingHorizontal: 16, fontSize: 17, fontWeight: '600', color: '#101828', backgroundColor: '#FFFFFF' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F2F4F7' },
  optionActive: { backgroundColor: '#101828' },
  optionText: { fontSize: 14, fontWeight: '700', color: '#475467' },
  optionTextActive: { color: '#FFFFFF' },
  button: { minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828', marginTop: 4 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 12, lineHeight: 18, color: '#98A2B3' },
});
