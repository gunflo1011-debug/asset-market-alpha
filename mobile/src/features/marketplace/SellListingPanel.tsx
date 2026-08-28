import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { OwnerMarketplaceListing } from '../inventory/types';

type Props = {
  busy: boolean;
  estimatedValueCents: number | null;
  listing: OwnerMarketplaceListing | null;
  onSave: (askingPriceCents: number, publish: boolean) => void;
  onWithdraw: () => void;
};

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function SellListingPanel({ busy, estimatedValueCents, listing, onSave, onWithdraw }: Props) {
  const [price, setPrice] = useState(() => listing ? String(listing.asking_price_cents / 100) : estimatedValueCents != null ? String(Math.max(1, Math.round(estimatedValueCents / 100))) : '');
  const parsed = useMemo(() => {
    const euros = Number(price.replace(',', '.').trim());
    return { valid: Number.isFinite(euros) && euros > 0 && euros <= 10_000_000, cents: Math.round(euros * 100) };
  }, [price]);
  const published = listing?.status === 'PUBLISHED';

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{published ? 'LIVE LISTING' : 'SELL THIS THING'}</Text>
      <Text style={styles.title}>{published ? 'Your item is on the marketplace' : 'Choose your asking price'}</Text>
      <Text style={styles.copy}>Your Things estimate is only a reference. You decide the price. Nothing becomes visible to other users until you explicitly publish.</Text>
      {estimatedValueCents != null ? <Text style={styles.reference}>Things estimate · {euro(estimatedValueCents)}</Text> : <Text style={styles.reference}>No Things estimate available</Text>}
      <Text style={styles.label}>Asking price (€)</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 90" style={styles.input} />
      <TouchableOpacity disabled={!parsed.valid || busy} style={[styles.primary, (!parsed.valid || busy) && styles.disabled]} onPress={() => onSave(parsed.cents, true)}>
        <Text style={styles.primaryText}>{busy ? 'Saving…' : published ? 'Update published price' : 'Publish on marketplace'}</Text>
      </TouchableOpacity>
      {!published ? <TouchableOpacity disabled={!parsed.valid || busy} style={styles.secondary} onPress={() => onSave(parsed.cents, false)}><Text style={styles.secondaryText}>Save as draft</Text></TouchableOpacity> : null}
      {published ? <TouchableOpacity disabled={busy} style={styles.withdraw} onPress={onWithdraw}><Text style={styles.withdrawText}>Remove from marketplace</Text></TouchableOpacity> : null}
      <Text style={styles.disclaimer}>Marketplace visibility: title, category, condition, asking price and optional Things estimate. Private notes, exact location and your identity stay hidden.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 11, borderWidth: 1, borderColor: '#E4E7EC' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#667085' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: '#101828' },
  copy: { fontSize: 14, lineHeight: 20, color: '#667085' },
  reference: { fontSize: 14, fontWeight: '700', color: '#344054' },
  label: { fontSize: 14, fontWeight: '700', color: '#344054' },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 15, fontSize: 17, fontWeight: '700', color: '#101828', backgroundColor: '#FFFFFF' },
  primary: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD' },
  secondaryText: { color: '#344054', fontSize: 14, fontWeight: '700' },
  withdraw: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F7', borderWidth: 1, borderColor: '#FECDCA' },
  withdrawText: { color: '#B42318', fontSize: 14, fontWeight: '700' },
  disclaimer: { fontSize: 12, lineHeight: 18, color: '#98A2B3' },
  disabled: { opacity: 0.45 },
});
