import React, { useEffect, useMemo, useState } from 'react';
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

type CaptureMode = 'manual' | 'catalog';

export function InventoryScreen(props: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('manual');
  const selectedItem = useMemo(
    () => props.items.find((item) => item.id === selectedItemId) ?? null,
    [props.items, selectedItemId],
  );

  useEffect(() => {
    if (props.editingItemId) {
      setSelectedItemId(null);
      setCaptureMode('manual');
      setCaptureOpen(true);
    }
  }, [props.editingItemId]);

  if (selectedItem) {
    const snapshot = selectedItem.condition_snapshots[0];
    const generic = !selectedItem.product_variants;
    const sale = buildSaleStartSurface(selectedItem.id, null);
    const saleOpen = props.saleIntentItemId === selectedItem.id;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedItemId(null)}><Text style={styles.backButtonText}>‹ Inventory</Text></TouchableOpacity>
            <View style={styles.privatePill}><Text style={styles.privatePillText}>Private</Text></View>
          </View>

          <View style={styles.detailHero}>
            <View style={styles.itemLabelRow}>
              <View style={styles.typePillDark}><Text style={styles.typePillDarkText}>{generic ? (selectedItem.category || 'Thing') : 'Device'}</Text></View>
              <Text style={styles.savedDateDark}>{savedDate(selectedItem.created_at)}</Text>
            </View>
            <Text style={styles.detailTitle}>{itemTitle(selectedItem)}</Text>
            {!generic ? <Text style={styles.detailSubtitle}>{variantTitle(selectedItem.product_variants as CatalogVariant)}</Text> : null}
          </View>

          <View style={styles.valueHero}>
            <Text style={styles.detailSectionLabel}>ESTIMATED VALUE</Text>
            <Text style={styles.valueHeroText}>{sale.valueLabel.replace('Estimated value ', '')}</Text>
            <Text style={styles.helper}>We only show a value once there is verified evidence. Unknown never means €0.</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailSectionLabel}>DETAILS</Text>
            <View style={styles.detailRow}><Text style={styles.detailKey}>Category</Text><Text style={styles.detailValue}>{selectedItem.category || (generic ? 'Other' : 'Device')}</Text></View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}><Text style={styles.detailKey}>Location</Text><Text style={styles.detailValue}>{selectedItem.location_label || 'Not set'}</Text></View>
            {snapshot ? <><View style={styles.detailDivider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Condition</Text><Text style={styles.detailValue}>{snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}</Text></View></> : null}
          </View>

          {selectedItem.notes ? <View style={styles.detailCard}><Text style={styles.detailSectionLabel}>NOTES</Text><Text style={styles.detailNotes}>{selectedItem.notes}</Text></View> : null}

          <View style={styles.sellHero}>
            <Text style={styles.sellHeroEyebrow}>PRIVATE SALE</Text>
            <Text style={styles.sellHeroTitle}>Ready to let it go?</Text>
            <Text style={styles.sellHeroCopy}>Start privately. Nothing becomes public and nothing is sold without your confirmation.</Text>
            <TouchableOpacity style={styles.sellButton} onPress={() => props.onToggleSaleIntent(selectedItem.id)}><Text style={styles.sellButtonText}>{sale.actionLabel}</Text></TouchableOpacity>
            {saleOpen ? <View style={styles.saleDecisionDark}><Text style={styles.saleDecisionText}>{sale.privacyNotice}</Text></View> : null}
          </View>

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryButton} disabled={props.actionBusy} onPress={() => { props.onStartEditing(selectedItem); setSelectedItemId(null); }}><Text style={styles.secondaryButtonText}>Edit item</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} disabled={props.actionBusy} onPress={() => props.onDelete(selectedItem)}><Text style={styles.dangerButtonText}>Delete item</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>THINGS</Text>
            <Text style={styles.pageTitle}>Your inventory</Text>
            <Text style={styles.subtitle}>Know what you own, what it is worth, and sell it privately when you are ready.</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={props.onOpenAccount}><Text style={styles.headerButtonText}>Account</Text></TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>YOUR THINGS</Text>
            <Text style={styles.metric}>{props.items.length}</Text>
            <Text style={styles.metricLabel}>{props.items.length === 1 ? 'item saved' : 'items saved'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>PORTFOLIO VALUE</Text>
            <Text style={styles.valueSummary}>—</Text>
            <Text style={styles.metricLabel}>Awaiting verified values</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addHeroButton} onPress={() => setCaptureOpen((open) => !open)}>
          <View style={styles.addHeroIcon}><Text style={styles.addHeroIconText}>{captureOpen ? '×' : '+'}</Text></View>
          <View style={styles.flex}><Text style={styles.addHeroTitle}>{captureOpen ? 'Close add flow' : 'Add a Thing'}</Text><Text style={styles.addHeroCopy}>Capture it in seconds. Keep the details private.</Text></View>
          <Text style={styles.addHeroArrow}>{captureOpen ? '↑' : '›'}</Text>
        </TouchableOpacity>

        {captureOpen ? (
          <View style={styles.captureCard}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity style={[styles.segment, captureMode === 'manual' && styles.segmentActive]} onPress={() => setCaptureMode('manual')}><Text style={[styles.segmentText, captureMode === 'manual' && styles.segmentTextActive]}>Any Thing</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.segment, captureMode === 'catalog' && styles.segmentActive]} onPress={() => setCaptureMode('catalog')}><Text style={[styles.segmentText, captureMode === 'catalog' && styles.segmentTextActive]}>Device catalog</Text></TouchableOpacity>
            </View>

            {captureMode === 'manual' ? (
              <>
                <View><Text style={styles.sectionTitle}>{props.editingItemId ? 'Edit item' : 'What are you adding?'}</Text><Text style={styles.helper}>{props.editingItemId ? 'Update only the details you want to change.' : 'A name is enough to start. The rest is optional.'}</Text></View>
                <TextInput value={props.thingName} onChangeText={props.onThingNameChange} placeholder="Name · e.g. Road bike" maxLength={120} style={styles.input} />
                <View style={styles.twoColumnInputs}>
                  <TextInput value={props.thingCategory} onChangeText={props.onThingCategoryChange} placeholder="Category" maxLength={80} style={[styles.input, styles.flexInput]} />
                  <TextInput value={props.thingLocation} onChangeText={props.onThingLocationChange} placeholder="Location" maxLength={120} style={[styles.input, styles.flexInput]} />
                </View>
                <TextInput value={props.thingNotes} onChangeText={props.onThingNotesChange} placeholder="Notes (optional)" maxLength={2000} multiline style={[styles.input, styles.notesInput]} />
                <TouchableOpacity style={[styles.primaryButton, (!props.thingName.trim() || props.actionBusy) && styles.disabled]} disabled={!props.thingName.trim() || props.actionBusy} onPress={props.onSaveThing}><Text style={styles.primaryButtonText}>{props.actionBusy ? 'Saving…' : props.editingItemId ? 'Save changes' : 'Add to inventory'}</Text></TouchableOpacity>
                {props.editingItemId ? <TouchableOpacity style={styles.secondaryButton} onPress={props.onCancelEditing}><Text style={styles.secondaryButtonText}>Cancel editing</Text></TouchableOpacity> : null}
              </>
            ) : (
              <>
                <View><Text style={styles.sectionTitle}>Choose your device</Text><Text style={styles.helper}>Use the catalog when your device is supported. This gives us a stronger basis for future valuation.</Text></View>
                {props.catalogLoading ? <ActivityIndicator /> : null}
                {props.catalogError ? <Text style={styles.helper}>{props.catalogError}</Text> : null}
                {props.catalog.slice(0, 4).map((variant) => {
                  const selected = variant.id === props.selectedVariantId;
                  return <TouchableOpacity key={variant.id} style={[styles.variantButton, selected && styles.variantButtonSelected]} onPress={() => props.onSelectVariant(variant.id)}><Text style={styles.variantText}>{variantTitle(variant)}</Text>{selected ? <Text style={styles.variantSelectedText}>Selected</Text> : null}</TouchableOpacity>;
                })}
                {props.catalog.length > 0 ? <TouchableOpacity style={[styles.primaryButton, (!props.selectedVariant || props.actionBusy) && styles.disabled]} disabled={!props.selectedVariant || props.actionBusy} onPress={props.onCreatePrivateDevice}><Text style={styles.primaryButtonText}>Add selected device</Text></TouchableOpacity> : null}
                {props.catalogError ? <TouchableOpacity onPress={props.onRefreshCatalog}><Text style={styles.linkCentered}>Retry device suggestions</Text></TouchableOpacity> : null}
              </>
            )}
          </View>
        ) : null}

        {props.message ? <Text style={styles.notice}>{props.message}</Text> : null}

        <View style={styles.inventoryHeading}>
          <View><Text style={styles.sectionTitle}>Inventory</Text><Text style={styles.helper}>{props.items.length === 0 ? 'Your saved Things will appear here.' : `${props.items.length} ${props.items.length === 1 ? 'item' : 'items'} · newest first`}</Text></View>
          <TouchableOpacity style={styles.refreshButton} disabled={props.inventoryLoading} onPress={props.onRefreshInventory}><Text style={styles.refreshButtonText}>{props.inventoryLoading ? 'Refreshing…' : 'Refresh'}</Text></TouchableOpacity>
        </View>

        {props.inventoryLoading && props.items.length === 0 ? <View style={styles.stateCard}><ActivityIndicator /><Text style={styles.helper}>Loading your inventory…</Text></View> : null}
        {props.inventoryError ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Couldn’t load inventory</Text><Text style={styles.helper}>{props.inventoryError}</Text><TouchableOpacity style={styles.secondaryButton} onPress={props.onRefreshInventory}><Text style={styles.secondaryButtonText}>Try again</Text></TouchableOpacity></View> : null}
        {!props.inventoryLoading && !props.inventoryError && props.items.length === 0 ? <View style={styles.stateCard}><Text style={styles.emptyIcon}>＋</Text><Text style={styles.sectionTitle}>Start your inventory</Text><Text style={styles.helper}>Add the first thing you own. You can enrich it later.</Text><TouchableOpacity style={styles.primaryButtonWide} onPress={() => setCaptureOpen(true)}><Text style={styles.primaryButtonText}>Add first Thing</Text></TouchableOpacity></View> : null}

        {props.items.map((item) => {
          const snapshot = item.condition_snapshots[0];
          const generic = !item.product_variants;
          const sale = buildSaleStartSurface(item.id, null);
          const open = props.saleIntentItemId === item.id;
          return (
            <View key={item.id} style={styles.itemCard}>
              <TouchableOpacity onPress={() => setSelectedItemId(item.id)}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <View style={styles.itemLabelRow}><View style={styles.typePill}><Text style={styles.typePillText}>{generic ? (item.category || 'Thing') : 'Device'}</Text></View><Text style={styles.savedDate}>{savedDate(item.created_at)}</Text></View>
                    <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                    {!generic ? <Text style={styles.muted}>{variantTitle(item.product_variants as CatalogVariant)}</Text> : null}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                {item.location_label ? <Text style={styles.meta}>⌖ {item.location_label}</Text> : null}
                {snapshot ? <Text style={styles.meta}>Condition · {snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}</Text> : null}
              </TouchableOpacity>

              <View style={styles.itemValueRow}>
                <View><Text style={styles.itemValueEyebrow}>ESTIMATED VALUE</Text><Text style={styles.valueLabel}>{sale.valueLabel.replace('Estimated value ', '')}</Text></View>
                <View style={styles.privatePill}><Text style={styles.privatePillText}>Private</Text></View>
              </View>

              <TouchableOpacity style={styles.sellInlineButton} onPress={() => props.onToggleSaleIntent(item.id)}><Text style={styles.sellInlineButtonText}>{sale.actionLabel}</Text><Text style={styles.sellInlineArrow}>›</Text></TouchableOpacity>
              {open ? <View style={styles.saleDecision}><Text style={styles.helper}>{sale.privacyNotice}</Text></View> : null}
            </View>
          );
        })}
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  headerButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  headerButtonText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  summaryCard: { backgroundColor: '#101828', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'stretch', gap: 18 },
  summaryColumn: { flex: 1, justifyContent: 'flex-end' },
  summaryDivider: { width: 1, backgroundColor: '#344054' },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#98A2B3', marginBottom: 8 },
  metric: { fontSize: 38, lineHeight: 42, fontWeight: '800', color: '#FFFFFF' },
  valueSummary: { fontSize: 30, lineHeight: 42, fontWeight: '800', color: '#FFFFFF' },
  metricLabel: { fontSize: 12, lineHeight: 17, color: '#D0D5DD', marginTop: 2 },
  addHeroButton: { minHeight: 78, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E4E7EC', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addHeroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#101828', alignItems: 'center', justifyContent: 'center' },
  addHeroIconText: { color: '#FFFFFF', fontSize: 24, lineHeight: 28, fontWeight: '500' },
  addHeroTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  addHeroCopy: { fontSize: 12, lineHeight: 17, color: '#667085', marginTop: 2 },
  addHeroArrow: { fontSize: 24, color: '#98A2B3' },
  captureCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 13, borderWidth: 1, borderColor: '#E7EAF0' },
  segmentedControl: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: '#F2F4F7', borderRadius: 14 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#667085' },
  segmentTextActive: { color: '#101828' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828' },
  helper: { fontSize: 14, lineHeight: 20, color: '#667085' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#101828', backgroundColor: '#FFFFFF' },
  flexInput: { flex: 1 },
  twoColumnInputs: { flexDirection: 'row', gap: 10 },
  notesInput: { minHeight: 82, textAlignVertical: 'top' },
  primaryButton: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  primaryButtonWide: { width: '100%', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828', marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#344054', fontWeight: '700', fontSize: 15 },
  dangerButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FFF8F7' },
  dangerButtonText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  notice: { fontSize: 14, lineHeight: 20, color: '#344054', backgroundColor: '#EEF4FF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D1E0FF' },
  inventoryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 2 },
  refreshButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: '#EAECF0' },
  refreshButtonText: { fontSize: 13, fontWeight: '700', color: '#344054' },
  stateCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 26, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E7EAF0' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 22, padding: 18, gap: 10, borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#B42318' },
  emptyIcon: { fontSize: 30, color: '#98A2B3' },
  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 13, borderWidth: 1, borderColor: '#E7EAF0', shadowColor: '#101828', shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  typePill: { borderRadius: 999, backgroundColor: '#F2F4F7', paddingHorizontal: 9, paddingVertical: 5 },
  typePillText: { fontSize: 11, fontWeight: '700', color: '#475467' },
  savedDate: { fontSize: 11, color: '#98A2B3' },
  itemTitle: { fontSize: 19, lineHeight: 24, fontWeight: '700', color: '#101828' },
  muted: { fontSize: 13, lineHeight: 18, color: '#667085', marginTop: 2 },
  meta: { fontSize: 13, color: '#667085', marginTop: 7 },
  chevron: { fontSize: 28, color: '#98A2B3' },
  itemValueRow: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemValueEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9, color: '#98A2B3', marginBottom: 3 },
  valueLabel: { fontSize: 14, fontWeight: '700', color: '#344054' },
  privatePill: { borderRadius: 999, backgroundColor: '#ECFDF3', paddingHorizontal: 10, paddingVertical: 6 },
  privatePillText: { fontSize: 12, fontWeight: '700', color: '#027A48' },
  sellInlineButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#101828', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sellInlineButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sellInlineArrow: { color: '#FFFFFF', fontSize: 22 },
  saleDecision: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  variantButton: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  variantButtonSelected: { borderWidth: 2, borderColor: '#101828', backgroundColor: '#F8FAFC' },
  variantText: { fontSize: 14, color: '#344054', flex: 1 },
  variantSelectedText: { fontSize: 11, fontWeight: '700', color: '#344054' },
  linkCentered: { fontSize: 14, fontWeight: '700', color: '#344054', textAlign: 'center', paddingVertical: 6 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { paddingVertical: 10, paddingRight: 14 },
  backButtonText: { fontSize: 16, fontWeight: '700', color: '#344054' },
  detailHero: { backgroundColor: '#101828', borderRadius: 24, padding: 22, gap: 8 },
  typePillDark: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#344054', paddingHorizontal: 9, paddingVertical: 5 },
  typePillDarkText: { fontSize: 11, fontWeight: '700', color: '#F2F4F7' },
  savedDateDark: { fontSize: 11, color: '#98A2B3' },
  detailTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  detailSubtitle: { fontSize: 14, lineHeight: 20, color: '#D0D5DD' },
  valueHero: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 8, borderWidth: 1, borderColor: '#E7EAF0' },
  valueHeroText: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#101828' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E7EAF0' },
  detailSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#667085' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 },
  detailKey: { fontSize: 14, color: '#667085' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '700', color: '#101828', textAlign: 'right', textTransform: 'capitalize' },
  detailDivider: { height: 1, backgroundColor: '#EAECF0' },
  detailNotes: { fontSize: 15, lineHeight: 22, color: '#344054' },
  sellHero: { backgroundColor: '#101828', borderRadius: 22, padding: 20, gap: 10 },
  sellHeroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#98A2B3' },
  sellHeroTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#FFFFFF' },
  sellHeroCopy: { fontSize: 14, lineHeight: 20, color: '#D0D5DD' },
  sellButton: { minHeight: 50, marginTop: 4, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sellButtonText: { fontSize: 15, fontWeight: '800', color: '#101828' },
  saleDecisionDark: { backgroundColor: '#1D2939', borderRadius: 12, padding: 12 },
  saleDecisionText: { fontSize: 13, lineHeight: 19, color: '#D0D5DD' },
  secondaryActions: { gap: 10 },
});
