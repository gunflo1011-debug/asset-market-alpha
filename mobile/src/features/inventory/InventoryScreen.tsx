import React, { useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buildSaleStartSurface } from '../../lib/saleStartSurface';
import { itemTitle, savedDate, variantTitle } from './presentation';
import type { CatalogVariant, PrivateInventoryItem } from './types';

type Props = {
  items: PrivateInventoryItem[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  catalog: CatalogVariant[];
  catalogLoading: boolean;
  catalogError: string | null;
  selectedVariantId: string | null;
  selectedVariant: CatalogVariant | null;
  thingName: string;
  thingCategory: string;
  thingLocation: string;
  thingNotes: string;
  editingItemId: string | null;
  actionBusy: boolean;
  message: string | null;
  saleIntentItemId: string | null;
  onOpenAccount: () => void;
  onThingNameChange: (value: string) => void;
  onThingCategoryChange: (value: string) => void;
  onThingLocationChange: (value: string) => void;
  onThingNotesChange: (value: string) => void;
  onSaveThing: () => void;
  onCancelEditing: () => void;
  onRefreshInventory: () => void;
  onStartEditing: (item: PrivateInventoryItem) => void;
  onDelete: (item: PrivateInventoryItem) => void;
  onToggleSaleIntent: (itemId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onCreatePrivateDevice: () => void;
  onRefreshCatalog: () => void;
};

export function InventoryScreen(props: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => props.items.find((item) => item.id === selectedItemId) ?? null,
    [props.items, selectedItemId],
  );

  if (selectedItem) {
    const snapshot = selectedItem.condition_snapshots[0];
    const generic = !selectedItem.product_variants;
    const sale = buildSaleStartSurface(selectedItem.id, null);
    const saleOpen = props.saleIntentItemId === selectedItem.id;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedItemId(null)}>
              <Text style={styles.backButtonText}>‹ Inventory</Text>
            </TouchableOpacity>
            <View style={styles.privatePill}><Text style={styles.privatePillText}>Private</Text></View>
          </View>

          <View style={styles.detailHero}>
            <View style={styles.itemLabelRow}>
              <View style={styles.typePill}><Text style={styles.typePillText}>{generic ? (selectedItem.category || 'Thing') : 'Device'}</Text></View>
              <Text style={styles.savedDate}>{savedDate(selectedItem.created_at)}</Text>
            </View>
            <Text style={styles.detailTitle}>{itemTitle(selectedItem)}</Text>
            {!generic ? <Text style={styles.detailSubtitle}>{variantTitle(selectedItem.product_variants as CatalogVariant)}</Text> : null}
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailSectionLabel}>DETAILS</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Category</Text>
              <Text style={styles.detailValue}>{selectedItem.category || (generic ? 'Other' : 'Device')}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Location</Text>
              <Text style={styles.detailValue}>{selectedItem.location_label || 'Not set'}</Text>
            </View>
            {snapshot ? <><View style={styles.detailDivider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Condition</Text><Text style={styles.detailValue}>{snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}</Text></View></> : null}
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailSectionLabel}>NOTES</Text>
            <Text style={selectedItem.notes ? styles.detailNotes : styles.detailEmpty}>{selectedItem.notes || 'No notes added yet.'}</Text>
          </View>

          {!generic ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailSectionLabel}>VALUE & SELLING</Text>
              <Text style={styles.valueLabel}>{sale.valueLabel}</Text>
              <Text style={styles.helper}>Things only shows a value when verified evidence exists.</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => props.onToggleSaleIntent(selectedItem.id)}><Text style={styles.secondaryButtonText}>{sale.actionLabel}</Text></TouchableOpacity>
              {saleOpen ? <View style={styles.saleDecision}><Text style={styles.helper}>{sale.privacyNotice}</Text></View> : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            disabled={props.actionBusy}
            onPress={() => { props.onStartEditing(selectedItem); setSelectedItemId(null); }}
          >
            <Text style={styles.primaryButtonText}>Edit item</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} disabled={props.actionBusy} onPress={() => props.onDelete(selectedItem)}>
            <Text style={styles.dangerButtonText}>Delete item</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PRIVATE INVENTORY</Text>
            <Text style={styles.pageTitle}>Your things</Text>
            <Text style={styles.subtitle}>A simple, private record of what you own.</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={props.onOpenAccount}><Text style={styles.headerButtonText}>Account</Text></TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.metric}>{props.items.length}</Text>
            <Text style={styles.metricLabel}>{props.items.length === 1 ? 'Thing' : 'Things'} saved</Text>
          </View>
          <View style={styles.summaryPrivacy}>
            <Text style={styles.summaryPrivacyIcon}>✓</Text>
            <Text style={styles.summaryPrivacyText}>Only visible to your account</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionLead}>
            <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>{props.editingItemId ? '✎' : '＋'}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>{props.editingItemId ? 'Edit item' : 'Add a Thing'}</Text>
              <Text style={styles.helper}>{props.editingItemId ? 'Update the details you want to keep with this item.' : 'Start with the basics. You can update them anytime.'}</Text>
            </View>
          </View>
          <TextInput value={props.thingName} onChangeText={props.onThingNameChange} placeholder="Name · e.g. Road bike" maxLength={120} style={styles.input} />
          <TextInput value={props.thingCategory} onChangeText={props.onThingCategoryChange} placeholder="Category · e.g. Sports" maxLength={80} style={styles.input} />
          <TextInput value={props.thingLocation} onChangeText={props.onThingLocationChange} placeholder="Location (optional)" maxLength={120} style={styles.input} />
          <TextInput value={props.thingNotes} onChangeText={props.onThingNotesChange} placeholder="Notes (optional)" maxLength={2000} multiline style={[styles.input, styles.notesInput]} />
          <TouchableOpacity style={[styles.primaryButton, (!props.thingName.trim() || props.actionBusy) && styles.disabled]} disabled={!props.thingName.trim() || props.actionBusy} onPress={props.onSaveThing}>
            <Text style={styles.primaryButtonText}>{props.actionBusy ? 'Saving…' : props.editingItemId ? 'Save changes' : 'Add to inventory'}</Text>
          </TouchableOpacity>
          {props.editingItemId ? <TouchableOpacity style={styles.secondaryButton} onPress={props.onCancelEditing}><Text style={styles.secondaryButtonText}>Cancel editing</Text></TouchableOpacity> : null}
        </View>

        {props.message ? <Text style={styles.notice}>{props.message}</Text> : null}

        <View style={styles.inventoryHeading}>
          <View>
            <Text style={styles.sectionTitle}>Inventory</Text>
            <Text style={styles.helper}>{props.items.length === 0 ? 'Your saved Things will appear here.' : `${props.items.length} ${props.items.length === 1 ? 'item' : 'items'} · newest first`}</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} disabled={props.inventoryLoading} onPress={props.onRefreshInventory}><Text style={styles.refreshButtonText}>{props.inventoryLoading ? 'Refreshing…' : 'Refresh'}</Text></TouchableOpacity>
        </View>

        {props.inventoryLoading && props.items.length === 0 ? <View style={styles.stateCard}><ActivityIndicator /><Text style={styles.helper}>Loading your inventory…</Text></View> : null}
        {props.inventoryError ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Couldn’t load inventory</Text><Text style={styles.helper}>{props.inventoryError}</Text><TouchableOpacity style={styles.secondaryButton} onPress={props.onRefreshInventory}><Text style={styles.secondaryButtonText}>Try again</Text></TouchableOpacity></View> : null}
        {!props.inventoryLoading && !props.inventoryError && props.items.length === 0 ? <View style={styles.stateCard}><Text style={styles.emptyIcon}>＋</Text><Text style={styles.sectionTitle}>Your inventory is empty</Text><Text style={styles.helper}>Add your first Thing above. It will appear here after saving.</Text></View> : null}

        {props.items.map((item) => {
          const snapshot = item.condition_snapshots[0];
          const generic = !item.product_variants;
          const sale = buildSaleStartSurface(item.id, null);
          const open = props.saleIntentItemId === item.id;
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <View style={styles.itemLabelRow}>
                    <View style={styles.typePill}><Text style={styles.typePillText}>{generic ? (item.category || 'Thing') : 'Device'}</Text></View>
                    <Text style={styles.savedDate}>{savedDate(item.created_at)}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                  {!generic ? <Text style={styles.muted}>{variantTitle(item.product_variants as CatalogVariant)}</Text> : null}
                </View>
                <View style={styles.privatePill}><Text style={styles.privatePillText}>Private</Text></View>
              </View>

              {item.location_label ? <Text style={styles.meta}>⌖ {item.location_label}</Text> : null}
              {snapshot ? <Text style={styles.meta}>Condition · {snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}</Text> : null}
              {item.notes ? <Text style={styles.notesPreview} numberOfLines={2}>{item.notes}</Text> : null}

              <TouchableOpacity style={styles.viewButton} onPress={() => setSelectedItemId(item.id)}>
                <Text style={styles.viewButtonText}>View details</Text><Text style={styles.viewButtonArrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.smallButton} disabled={props.actionBusy} onPress={() => props.onStartEditing(item)}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallDangerButton} disabled={props.actionBusy} onPress={() => props.onDelete(item)}><Text style={styles.smallDangerText}>Delete</Text></TouchableOpacity>
              </View>

              {!generic ? (
                <View style={styles.sellPanel}>
                  <Text style={styles.valueLabel}>{sale.valueLabel}</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => props.onToggleSaleIntent(item.id)}><Text style={styles.secondaryButtonText}>{sale.actionLabel}</Text></TouchableOpacity>
                  {open ? <View style={styles.saleDecision}><Text style={styles.helper}>{sale.privacyNotice}</Text></View> : null}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}><Text style={styles.sectionTitle}>Add from device catalog</Text><Text style={styles.helper}>Optional shortcut for supported phones.</Text></View>
            {props.catalogLoading ? <ActivityIndicator /> : null}
          </View>
          {props.catalogError ? <Text style={styles.helper}>{props.catalogError}</Text> : null}
          {props.catalog.slice(0, 4).map((variant) => {
            const selected = variant.id === props.selectedVariantId;
            return <TouchableOpacity key={variant.id} style={[styles.variantButton, selected && styles.variantButtonSelected]} onPress={() => props.onSelectVariant(variant.id)}><Text style={styles.variantText}>{variantTitle(variant)}</Text>{selected ? <Text style={styles.variantSelectedText}>Selected</Text> : null}</TouchableOpacity>;
          })}
          {props.catalog.length > 0 ? <TouchableOpacity style={[styles.secondaryButton, (!props.selectedVariant || props.actionBusy) && styles.disabled]} disabled={!props.selectedVariant || props.actionBusy} onPress={props.onCreatePrivateDevice}><Text style={styles.secondaryButtonText}>Add selected device</Text></TouchableOpacity> : null}
          {props.catalogError ? <TouchableOpacity onPress={props.onRefreshCatalog}><Text style={styles.linkCentered}>Retry device suggestions</Text></TouchableOpacity> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  container: { padding: 20, paddingTop: 24, paddingBottom: 52, gap: 18 },
  detailContainer: { padding: 20, paddingTop: 18, paddingBottom: 52, gap: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#667085', marginBottom: 4 },
  pageTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7, color: '#101828' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#667085', marginTop: 3 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E7EAF0', shadowColor: '#101828', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  summaryCard: { backgroundColor: '#101828', borderRadius: 22, padding: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  metric: { fontSize: 38, lineHeight: 42, fontWeight: '800', color: '#FFFFFF' },
  metricLabel: { fontSize: 14, color: '#D0D5DD', marginTop: 2 },
  summaryPrivacy: { flex: 1, maxWidth: 170, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  summaryPrivacyIcon: { fontSize: 13, fontWeight: '800', color: '#A6F4C5' },
  summaryPrivacyText: { fontSize: 12, lineHeight: 17, color: '#D0D5DD', textAlign: 'right' },
  sectionLead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  sectionIconText: { fontSize: 18, fontWeight: '700', color: '#344054' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#101828', backgroundColor: '#FFFFFF' },
  notesInput: { minHeight: 88, textAlignVertical: 'top' },
  primaryButton: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#344054', fontWeight: '700', fontSize: 15 },
  dangerButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FFF8F7' },
  dangerButtonText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  headerButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  headerButtonText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  disabled: { opacity: 0.45 },
  helper: { fontSize: 14, lineHeight: 20, color: '#667085' },
  notice: { fontSize: 14, lineHeight: 20, color: '#344054', backgroundColor: '#EEF4FF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D1E0FF' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  linkCentered: { fontSize: 14, fontWeight: '700', color: '#344054', textAlign: 'center', paddingVertical: 6 },
  inventoryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 2 },
  refreshButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: '#EAECF0' },
  refreshButtonText: { fontSize: 13, fontWeight: '700', color: '#344054' },
  stateCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 26, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E7EAF0' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 22, padding: 18, gap: 10, borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#B42318' },
  emptyIcon: { fontSize: 30, color: '#98A2B3' },
  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E7EAF0', shadowColor: '#101828', shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  typePill: { borderRadius: 999, backgroundColor: '#F2F4F7', paddingHorizontal: 9, paddingVertical: 5 },
  typePillText: { fontSize: 11, fontWeight: '700', color: '#475467' },
  savedDate: { fontSize: 11, color: '#98A2B3' },
  itemTitle: { fontSize: 19, lineHeight: 24, fontWeight: '700', color: '#101828' },
  muted: { fontSize: 13, lineHeight: 18, color: '#667085', marginTop: 2 },
  meta: { fontSize: 13, color: '#667085' },
  notesPreview: { fontSize: 13, lineHeight: 19, color: '#667085' },
  privatePill: { borderRadius: 999, backgroundColor: '#ECFDF3', paddingHorizontal: 10, paddingVertical: 6 },
  privatePillText: { fontSize: 12, fontWeight: '700', color: '#027A48' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 1 },
  smallButton: { flex: 1, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  smallButtonText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  smallDangerButton: { flex: 1, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FFF8F7', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  smallDangerText: { fontSize: 14, fontWeight: '700', color: '#B42318' },
  viewButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#F2F4F7', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewButtonText: { fontSize: 14, fontWeight: '700', color: '#101828' },
  viewButtonArrow: { fontSize: 22, color: '#667085' },
  sellPanel: { gap: 10, paddingTop: 3 },
  valueLabel: { fontSize: 14, fontWeight: '700', color: '#344054' },
  saleDecision: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  variantButton: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  variantButtonSelected: { borderWidth: 2, borderColor: '#101828', backgroundColor: '#F8FAFC' },
  variantText: { fontSize: 14, color: '#344054', flex: 1 },
  variantSelectedText: { fontSize: 11, fontWeight: '700', color: '#344054' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { paddingVertical: 10, paddingRight: 14 },
  backButtonText: { fontSize: 16, fontWeight: '700', color: '#344054' },
  detailHero: { backgroundColor: '#101828', borderRadius: 24, padding: 22, gap: 8 },
  detailTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  detailSubtitle: { fontSize: 14, lineHeight: 20, color: '#D0D5DD' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E7EAF0' },
  detailSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#667085' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 },
  detailKey: { fontSize: 14, color: '#667085' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '700', color: '#101828', textAlign: 'right', textTransform: 'capitalize' },
  detailDivider: { height: 1, backgroundColor: '#EAECF0' },
  detailNotes: { fontSize: 15, lineHeight: 22, color: '#344054' },
  detailEmpty: { fontSize: 14, lineHeight: 20, color: '#98A2B3' },
});