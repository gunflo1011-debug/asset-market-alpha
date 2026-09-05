import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { summarizeInventoryValue } from '../../lib/inventoryValue';
import { subscribeToPurchasedThingNavigation } from '../../lib/purchasedThingNavigation';
import { buildSaleStartSurface } from '../../lib/saleStartSurface';
import type { ProductSuggestion } from '../../lib/barcodeProductResolver';
import { MarketplaceScreen } from '../marketplace/MarketplaceScreen';
import { SellListingPanel } from '../marketplace/SellListingPanel';
import { BarcodeCapturePanel } from './BarcodeCapturePanel';
import { itemTitle, savedDate, variantTitle } from './presentation';
import { ValueEstimatePanel } from './ValueEstimatePanel';
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

type CaptureMode = 'scan' | 'manual' | 'catalog';
type InventoryFilter = 'ALL' | 'PRIVATE' | 'FOR_SALE' | 'RESERVED';

function formatEuroCents(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function isModelEstimate(item: PrivateInventoryItem): boolean {
  return item.value_evidence?.source_type === 'MODEL_V1_OWNER_INPUT';
}

function inventoryLifecycleLabel(item: PrivateInventoryItem): string {
  if (item.market_state === 'RESERVED') return 'Reserved';
  if (item.market_state === 'SOLD') return 'Sold';
  if (item.market_state === 'OFFERS_ENABLED' || item.market_state === 'MARKET_ELIGIBLE' || item.market_state === 'ACTIVATING') return 'For sale';
  return 'Private';
}

function matchesInventoryFilter(item: PrivateInventoryItem, filter: InventoryFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'RESERVED') return item.market_state === 'RESERVED';
  if (filter === 'FOR_SALE') return item.market_state === 'OFFERS_ENABLED' || item.market_state === 'MARKET_ELIGIBLE' || item.market_state === 'ACTIVATING';
  return item.market_state == null || item.market_state === 'PRIVATE';
}

function matchesInventorySearch(item: PrivateInventoryItem, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  return [itemTitle(item), item.category, item.location_label]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function isSuccessfulCaptureMessage(message: string | null): boolean {
  if (!message) return false;
  return message === 'Thing added to your inventory.'
    || message.startsWith('Thing saved privately.')
    || message === 'Device saved privately.'
    || message.startsWith('Device saved privately.');
}

export function InventoryScreen(props: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('scan');
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [pendingMarketplaceItemId, setPendingMarketplaceItemId] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('ALL');
  const [inventorySearch, setInventorySearch] = useState('');

  const selectedItem = useMemo(() => props.items.find((item) => item.id === selectedItemId) ?? null, [props.items, selectedItemId]);
  const lifecycleItems = useMemo(() => props.items.filter((item) => matchesInventoryFilter(item, inventoryFilter)), [props.items, inventoryFilter]);
  const visibleItems = useMemo(() => lifecycleItems.filter((item) => matchesInventorySearch(item, inventorySearch)), [lifecycleItems, inventorySearch]);
  const inventoryValue = useMemo(() => summarizeInventoryValue(props.items.map((item) => ({
    itemId: item.id,
    estimatedValueCents: item.value_evidence?.estimated_value_cents ?? null,
  }))), [props.items]);

  const portfolioValueLabel = inventoryValue.valuedItemCount > 0 ? formatEuroCents(inventoryValue.knownValueCents) : '—';
  const portfolioCoverageLabel = inventoryValue.totalItemCount === 0
    ? 'No estimates yet'
    : inventoryValue.unvaluedItemCount === 0
      ? `All ${inventoryValue.totalItemCount} valued`
      : `${inventoryValue.valuedItemCount} of ${inventoryValue.totalItemCount} valued`;
  const hasInventorySearch = inventorySearch.trim().length > 0;

  useEffect(() => {
    if (props.editingItemId) {
      setSelectedItemId(null);
      setMarketplaceOpen(false);
      setCaptureMode('manual');
      setCaptureOpen(true);
    }
  }, [props.editingItemId]);

  useEffect(() => {
    if (!props.editingItemId && isSuccessfulCaptureMessage(props.message)) {
      setCaptureOpen(false);
      setCaptureMode('scan');
      setInventoryFilter('ALL');
      setInventorySearch('');
      Keyboard.dismiss();
    }
  }, [props.editingItemId, props.message]);

  useEffect(() => subscribeToPurchasedThingNavigation((itemId) => {
    setPendingMarketplaceItemId(itemId);
    setSelectedItemId(null);
    setMarketplaceOpen(false);
    setInventoryFilter('ALL');
    setInventorySearch('');
    props.onRefreshInventory();
  }), [props.onRefreshInventory]);

  useEffect(() => {
    if (!pendingMarketplaceItemId) return;
    if (props.items.some((item) => item.id === pendingMarketplaceItemId)) {
      setSelectedItemId(pendingMarketplaceItemId);
      setPendingMarketplaceItemId(null);
    }
  }, [pendingMarketplaceItemId, props.items]);

  function useScannedSuggestion(suggestion: ProductSuggestion) {
    props.onThingNameChange(suggestion.title);
    props.onThingCategoryChange(suggestion.category || 'Device');
    const identity = [suggestion.brand ? `Brand: ${suggestion.brand}` : null, suggestion.model ? `Model: ${suggestion.model}` : null, suggestion.kind === 'gtin' ? `GTIN/UPC: ${suggestion.code}` : null]
      .filter(Boolean)
      .join('\n');
    props.onThingNotesChange(identity);
    setCaptureMode('manual');
  }

  if (marketplaceOpen) return <MarketplaceScreen onBack={() => setMarketplaceOpen(false)} />;

  if (selectedItem) {
    const snapshot = selectedItem.condition_snapshots[0];
    const generic = !selectedItem.product_variants;
    const sale = buildSaleStartSurface(selectedItem.id, selectedItem.value_evidence?.estimated_value_cents ?? null);
    const saleOpen = props.saleIntentItemId === selectedItem.id;
    const modelEstimate = isModelEstimate(selectedItem);
    const lifecycleLabel = inventoryLifecycleLabel(selectedItem);
    const purchasePriceCents = selectedItem.purchase_context?.purchase_price_cents ?? null;

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.detailContainer}>
          <View style={styles.topBar}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to inventory" onPress={() => setSelectedItemId(null)}><Text style={styles.topLink}>‹ Inventory</Text></TouchableOpacity>
            <View style={styles.statePill}><Text style={styles.statePillText}>{lifecycleLabel}</Text></View>
          </View>

          <View style={styles.detailHero}>
            <View style={styles.heroMetaRow}>
              <View style={styles.darkPill}><Text style={styles.darkPillText}>{generic ? (selectedItem.category || 'Thing') : 'Device'}</Text></View>
              <Text style={styles.heroDate}>{savedDate(selectedItem.created_at)}</Text>
            </View>
            <Text style={styles.detailTitle}>{itemTitle(selectedItem)}</Text>
            {!generic ? <Text style={styles.detailSubtitle}>{variantTitle(selectedItem.product_variants as CatalogVariant)}</Text> : null}
          </View>

          {selectedItem.purchase_context ? (
            <View style={styles.purchaseCard}>
              <Text style={styles.purchaseEyebrow}>YOUR PURCHASE</Text>
              <View style={styles.purchaseHeaderRow}>
                <View style={styles.flex}>
                  <Text style={styles.purchaseLabel}>{purchasePriceCents != null ? 'Paid price' : 'Marketplace purchase'}</Text>
                  <Text style={styles.purchasePrice}>{purchasePriceCents != null ? formatEuroCents(purchasePriceCents) : 'Price not recorded'}</Text>
                </View>
                <View style={styles.purchaseBadge}><Text style={styles.purchaseBadgeText}>COMPLETED</Text></View>
              </View>
              <Text style={styles.purchaseCopy}>{purchasePriceCents != null ? 'Final price from your completed Marketplace purchase. This is what you paid, not a Things Estimate or asking price.' : 'This Thing came from a completed Marketplace purchase. No final paid price is available for this purchase.'}</Text>
            </View>
          ) : null}

          <View style={styles.primaryValueCard}>
            <Text style={styles.cardEyebrow}>{modelEstimate ? 'THINGS ESTIMATE' : 'ESTIMATED VALUE'}</Text>
            <Text style={styles.primaryValue}>{sale.valueLabel.replace('Estimated value ', '')}</Text>
            <Text style={styles.compactCopy}>{selectedItem.value_evidence ? 'Things’ current reference value for this item. It can differ from what you paid or an asking price.' : 'No estimate yet. Add purchase details to calculate a first estimate.'}</Text>
          </View>

          <ValueEstimatePanel itemId={selectedItem.id} busy={props.actionBusy} onEstimated={props.onRefreshInventory} />

          <View style={styles.detailCard}>
            <Text style={styles.cardEyebrow}>DETAILS</Text>
            <View style={styles.detailRow}><Text style={styles.detailKey}>Category</Text><Text style={styles.detailValue}>{selectedItem.category || (generic ? 'Other' : 'Device')}</Text></View>
            <View style={styles.divider} />
            <View style={styles.detailRow}><Text style={styles.detailKey}>Location</Text><Text style={styles.detailValue}>{selectedItem.location_label || 'Not set'}</Text></View>
            {snapshot ? <><View style={styles.divider} /><View style={styles.detailRow}><Text style={styles.detailKey}>Condition</Text><Text style={styles.detailValue}>{snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}</Text></View></> : null}
          </View>

          {selectedItem.notes ? <View style={styles.detailCard}><Text style={styles.cardEyebrow}>NOTES</Text><Text style={styles.detailNotes}>{selectedItem.notes}</Text></View> : null}

          <View style={styles.saleCard}>
            <View style={styles.saleHeaderRow}>
              <View style={styles.flex}><Text style={styles.cardEyebrowLight}>SELL</Text><Text style={styles.saleTitle}>{saleOpen ? 'Selling options' : 'Ready to sell?'}</Text></View>
              <Text style={styles.saleValue}>{selectedItem.value_evidence ? formatEuroCents(selectedItem.value_evidence.estimated_value_cents) : '—'}</Text>
            </View>
            <Text style={styles.saleCopy}>Choose your own asking price. Your item stays private until you publish it. The asking price is separate from both your purchase price and Things Estimate.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.saleButton} onPress={() => props.onToggleSaleIntent(selectedItem.id)}><Text style={styles.saleButtonText}>{saleOpen ? 'Close selling' : 'Sell this Thing'}</Text></TouchableOpacity>
          </View>

          {saleOpen ? <SellListingPanel itemId={selectedItem.id} estimatedValueCents={selectedItem.value_evidence?.estimated_value_cents ?? null} /> : null}

          <View style={styles.secondaryActions}>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} disabled={props.actionBusy} onPress={() => { props.onStartEditing(selectedItem); setSelectedItemId(null); }}><Text style={styles.secondaryButtonText}>Edit item</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.dangerButton} disabled={props.actionBusy} onPress={() => props.onDelete(selectedItem)}><Text style={styles.dangerButtonText}>Delete item</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>THINGS</Text>
            <Text style={styles.pageTitle}>Your inventory</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open account" style={styles.iconButton} onPress={props.onOpenAccount}><Text style={styles.iconButtonText}>•••</Text></TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryPrimary}>
            <Text style={styles.summaryLabel}>TOTAL ESTIMATE</Text>
            <Text style={styles.valueSummary}>{portfolioValueLabel}</Text>
            <Text style={styles.metricLabel}>{portfolioCoverageLabel}</Text>
          </View>
          <View style={styles.summaryCount}>
            <Text style={styles.summaryLabel}>THINGS</Text>
            <Text style={styles.metric}>{props.items.length}</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={captureOpen ? 'Close Add Thing' : 'Add Thing'} accessibilityState={{ expanded: captureOpen }} style={styles.primaryQuickAction} onPress={() => { setCaptureOpen((open) => !open); if (!captureOpen) setCaptureMode('scan'); }}>
            <Text style={styles.primaryQuickIcon}>{captureOpen ? '×' : '+'}</Text>
            <Text style={styles.primaryQuickText}>{captureOpen ? 'Close' : 'Add Thing'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Marketplace" style={styles.secondaryQuickAction} onPress={() => setMarketplaceOpen(true)}>
            <Text style={styles.secondaryQuickText}>Marketplace</Text><Text style={styles.quickArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {captureOpen ? (
          <View style={styles.captureCard}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scan a barcode or QR code" accessibilityState={{ selected: captureMode === 'scan' }} style={[styles.segment, captureMode === 'scan' && styles.segmentActive]} onPress={() => setCaptureMode('scan')}><Text style={[styles.segmentText, captureMode === 'scan' && styles.segmentTextActive]}>Scan</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enter Thing details manually" accessibilityState={{ selected: captureMode === 'manual' }} style={[styles.segment, captureMode === 'manual' && styles.segmentActive]} onPress={() => setCaptureMode('manual')}><Text style={[styles.segmentText, captureMode === 'manual' && styles.segmentTextActive]}>Manual</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose a known device from the catalog" accessibilityState={{ selected: captureMode === 'catalog' }} style={[styles.segment, captureMode === 'catalog' && styles.segmentActive]} onPress={() => setCaptureMode('catalog')}><Text style={[styles.segmentText, captureMode === 'catalog' && styles.segmentTextActive]}>Catalog</Text></TouchableOpacity>
            </View>

            {captureMode === 'scan' ? (
              <BarcodeCapturePanel onUseSuggestion={useScannedSuggestion} onEnterManually={() => setCaptureMode('manual')} />
            ) : captureMode === 'manual' ? (
              <>
                <Text style={styles.sectionTitle}>{props.editingItemId ? 'Edit Thing' : 'Confirm Thing details'}</Text>
                {!props.editingItemId ? <Text style={styles.compactCopy}>Review or correct every suggestion before saving. Scanned data is never treated as verified truth.</Text> : null}
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Name <Text style={styles.fieldMeta}>· Required</Text></Text>
                  <TextInput accessibilityLabel="Thing name, required" value={props.thingName} onChangeText={props.onThingNameChange} placeholder="e.g. Road bike" maxLength={120} returnKeyType="next" style={styles.input} />
                </View>
                <View style={styles.twoColumnInputs}>
                  <View style={[styles.formField, styles.flexInput]}>
                    <Text style={styles.fieldLabel}>Category <Text style={styles.fieldMeta}>· Optional</Text></Text>
                    <TextInput accessibilityLabel="Category, optional" value={props.thingCategory} onChangeText={props.onThingCategoryChange} placeholder="e.g. Sports" maxLength={80} returnKeyType="next" style={styles.input} />
                  </View>
                  <View style={[styles.formField, styles.flexInput]}>
                    <Text style={styles.fieldLabel}>Location <Text style={styles.fieldMeta}>· Optional</Text></Text>
                    <TextInput accessibilityLabel="Private location, optional" value={props.thingLocation} onChangeText={props.onThingLocationChange} placeholder="e.g. Garage" maxLength={120} returnKeyType="next" style={styles.input} />
                  </View>
                </View>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Notes <Text style={styles.fieldMeta}>· Optional</Text></Text>
                  <TextInput accessibilityLabel="Private notes, optional" value={props.thingNotes} onChangeText={props.onThingNotesChange} placeholder="Anything useful to remember" maxLength={2000} multiline style={[styles.input, styles.notesInput]} />
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={props.editingItemId ? 'Save Thing changes' : 'Add Thing to inventory'} style={[styles.primaryButton, (!props.thingName.trim() || props.actionBusy) && styles.disabled]} disabled={!props.thingName.trim() || props.actionBusy} onPress={props.onSaveThing}><Text style={styles.primaryButtonText}>{props.actionBusy ? 'Saving…' : props.editingItemId ? 'Save changes' : 'Add to inventory'}</Text></TouchableOpacity>
                {props.editingItemId ? <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={props.onCancelEditing}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity> : null}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Choose a known device</Text>
                {props.catalogLoading ? <ActivityIndicator /> : null}
                {props.catalogError ? <Text style={styles.compactCopy}>{props.catalogError}</Text> : null}
                {props.catalog.slice(0, 4).map((variant) => {
                  const selected = variant.id === props.selectedVariantId;
                  return <TouchableOpacity key={variant.id} style={[styles.variantButton, selected && styles.variantButtonSelected]} onPress={() => props.onSelectVariant(variant.id)}><Text style={styles.variantText}>{variantTitle(variant)}</Text>{selected ? <Text style={styles.variantSelectedText}>Selected</Text> : null}</TouchableOpacity>;
                })}
                {props.catalog.length > 0 ? <TouchableOpacity style={[styles.primaryButton, (!props.selectedVariant || props.actionBusy) && styles.disabled]} disabled={!props.selectedVariant || props.actionBusy} onPress={props.onCreatePrivateDevice}><Text style={styles.primaryButtonText}>Add selected device</Text></TouchableOpacity> : null}
                {props.catalogError ? <TouchableOpacity onPress={props.onRefreshCatalog}><Text style={styles.linkCentered}>Retry</Text></TouchableOpacity> : null}
              </>
            )}
          </View>
        ) : null}

        {props.message ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{props.message}</Text> : null}

        <View style={styles.inventoryHeading}>
          <View><Text style={styles.sectionTitle}>Things</Text><Text style={styles.compactCopy}>{props.items.length ? `${visibleItems.length} shown · ${props.items.length} saved` : 'Your saved Things appear here.'}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh private inventory" disabled={props.inventoryLoading} style={styles.inventoryRefreshButton} onPress={props.onRefreshInventory}><Text style={styles.refreshLink}>{props.inventoryLoading ? 'Refreshing…' : 'Refresh'}</Text></TouchableOpacity>
        </View>

        {props.items.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {([
                ['ALL', 'All'],
                ['PRIVATE', 'My Things'],
                ['FOR_SALE', 'For sale'],
                ['RESERVED', 'Reserved'],
              ] as Array<[InventoryFilter, string]>).map(([filter, label]) => {
                const active = inventoryFilter === filter;
                return (
                  <TouchableOpacity key={filter} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setInventoryFilter(filter)}>
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              accessibilityLabel="Search inventory"
              value={inventorySearch}
              onChangeText={setInventorySearch}
              placeholder="Search name, category or location"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={styles.input}
            />
          </>
        ) : null}

        {props.inventoryLoading && props.items.length === 0 ? <ActivityIndicator /> : null}
        {props.inventoryError ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Couldn’t load inventory</Text><Text style={styles.compactCopy}>{props.inventoryError}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading private inventory" disabled={props.inventoryLoading} style={styles.errorRetryButton} onPress={props.onRefreshInventory}><Text style={styles.errorRetryText}>{props.inventoryLoading ? 'Retrying…' : 'Try again'}</Text></TouchableOpacity></View> : null}
        {!props.inventoryLoading && !props.inventoryError && props.items.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Start with your first Thing</Text><Text style={styles.compactCopy}>Scan a barcode or add anything you own manually.</Text></View> : null}
        {!props.inventoryLoading && !props.inventoryError && props.items.length > 0 && lifecycleItems.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing in this view</Text><Text style={styles.compactCopy}>Choose another inventory filter to see your other Things.</Text></View> : null}
        {!props.inventoryLoading && !props.inventoryError && lifecycleItems.length > 0 && visibleItems.length === 0 && hasInventorySearch ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No matching Things</Text><Text style={styles.compactCopy}>Try another name, category or location, or clear the search.</Text></View> : null}

        {visibleItems.length > 0 ? <View style={styles.listCard}>
          {visibleItems.map((item, index) => {
            const snapshot = item.condition_snapshots[0];
            const generic = !item.product_variants;
            const sale = buildSaleStartSurface(item.id, item.value_evidence?.estimated_value_cents ?? null);
            const lifecycleLabel = inventoryLifecycleLabel(item);
            const estimateAccessibilityLabel = item.value_evidence
              ? `Things Estimate ${formatEuroCents(item.value_evidence.estimated_value_cents)}`
              : 'Estimate pending';
            return (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${itemTitle(item)}. ${estimateAccessibilityLabel}. ${lifecycleLabel}.`}
                accessibilityHint="Opens Thing details"
                style={[styles.compactItem, index < visibleItems.length - 1 && styles.compactItemBorder]}
                onPress={() => setSelectedItemId(item.id)}
              >
                <View style={styles.itemIcon}><Text style={styles.itemIconText}>{(generic ? (item.category || 'T') : 'D').slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.flex}>
                  <View style={styles.itemTopLine}>
                    <Text numberOfLines={1} style={styles.itemTitle}>{itemTitle(item)}</Text>
                    <Text style={styles.itemValue}>{sale.valueLabel.replace('Estimated value ', '')}</Text>
                  </View>
                  <View style={styles.itemBottomLine}>
                    <Text numberOfLines={1} style={styles.itemMeta}>{generic ? (item.category || 'Thing') : 'Device'}{snapshot ? ` · ${snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}` : ''}</Text>
                    <View style={styles.stateDot} /><Text style={styles.itemState}>{lifecycleLabel}</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FCFDFE' },
  container: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 64, gap: 20 },
  detailContainer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 64, gap: 17 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: '#8B95A5' },
  pageTitle: { fontSize: 33, lineHeight: 39, fontWeight: '900', letterSpacing: -1.15, color: '#0B1323', marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 2 },
  iconButton: { width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  iconButtonText: { color: '#29364A', fontSize: 16, fontWeight: '900', letterSpacing: 1.2 },
  summaryCard: { minHeight: 166, backgroundColor: '#0C1628', borderRadius: 32, paddingHorizontal: 24, paddingVertical: 24, flexDirection: 'row', alignItems: 'flex-end', gap: 20, shadowColor: '#0B1323', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  summaryPrimary: { flex: 1, justifyContent: 'space-between' },
  summaryCount: { minWidth: 72, alignItems: 'flex-end', paddingBottom: 2 },
  summaryLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.35, color: '#8E9BAE', marginBottom: 10 },
  valueSummary: { fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1.4, color: '#FFFFFF' },
  metric: { fontSize: 32, lineHeight: 38, fontWeight: '900', color: '#FFFFFF' },
  metricLabel: { fontSize: 12, lineHeight: 18, color: '#C5CEDA', marginTop: 5 },
  quickActions: { flexDirection: 'row', gap: 12 },
  primaryQuickAction: { flex: 1, minHeight: 60, borderRadius: 20, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#0C1628', shadowColor: '#0B1323', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  primaryQuickIcon: { fontSize: 23, color: '#FFFFFF', fontWeight: '500' },
  primaryQuickText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  secondaryQuickAction: { flex: 1.25, minHeight: 60, borderRadius: 20, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8ECF1', shadowColor: '#0B1323', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  secondaryQuickText: { fontSize: 15, fontWeight: '900', color: '#0C1628' },
  quickArrow: { fontSize: 23, color: '#8994A6' },
  captureCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, gap: 14, borderWidth: 1, borderColor: '#E8ECF1', shadowColor: '#0B1323', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  segmentedControl: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: '#F2F4F7', borderRadius: 15 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segmentActive: { backgroundColor: '#FFFFFF', shadowColor: '#0B1323', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  segmentText: { fontSize: 13, fontWeight: '800', color: '#8A94A4' },
  segmentTextActive: { color: '#0C1628' },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.25, color: '#0C1628' },
  compactCopy: { fontSize: 13, lineHeight: 19, color: '#758196' },
  formField: { gap: 7 },
  fieldLabel: { fontSize: 12, lineHeight: 16, fontWeight: '900', color: '#334155' },
  fieldMeta: { fontWeight: '600', color: '#9AA4B2' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#E1E6EC', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, color: '#0C1628', backgroundColor: '#FFFFFF', shadowColor: '#0B1323', shadowOpacity: 0.025, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  flexInput: { flex: 1 },
  twoColumnInputs: { flexDirection: 'row', gap: 10 },
  notesInput: { minHeight: 84, textAlignVertical: 'top' },
  primaryButton: { borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1628' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  secondaryButton: { borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E1E6EC', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#334155', fontWeight: '800', fontSize: 15 },
  dangerButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F2C8C3', backgroundColor: '#FFF9F8' },
  dangerButtonText: { color: '#B42318', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  notice: { fontSize: 13, lineHeight: 19, color: '#334155', backgroundColor: '#EEF4FF', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16 },
  inventoryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 6 },
  inventoryRefreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 5 },
  refreshLink: { fontSize: 13, fontWeight: '900', color: '#536174' },
  filterRow: { gap: 9, paddingRight: 4 },
  filterChip: { minHeight: 40, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E1E6EC', backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: '#0C1628', borderColor: '#0C1628' },
  filterChipText: { fontSize: 13, fontWeight: '800', color: '#5C687A' },
  filterChipTextActive: { color: '#FFFFFF' },
  listCard: { backgroundColor: 'transparent', gap: 11, overflow: 'visible' },
  compactItem: { minHeight: 94, paddingHorizontal: 15, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#FFFFFF', borderRadius: 21, borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  compactItemBorder: { borderBottomWidth: 1, borderBottomColor: '#E9EDF2' },
  itemIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F7' },
  itemIconText: { fontSize: 16, fontWeight: '900', color: '#35445B' },
  itemTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemTitle: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.15, color: '#0C1628' },
  itemValue: { fontSize: 15, fontWeight: '900', color: '#0C1628' },
  itemBottomLine: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  itemMeta: { flex: 1, fontSize: 12, color: '#7C8798' },
  stateDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#6B778A', marginRight: 5 },
  itemState: { fontSize: 11, fontWeight: '800', color: '#536174' },
  chevron: { fontSize: 25, color: '#A7B0BE', marginLeft: 1 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, gap: 8, borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0C1628' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 20, padding: 17, gap: 7, borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 16, fontWeight: '900', color: '#B42318' },
  errorRetryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  errorRetryText: { fontSize: 13, fontWeight: '900', color: '#B42318' },
  variantButton: { borderWidth: 1, borderColor: '#E1E6EC', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#FFFFFF' },
  variantButtonSelected: { borderWidth: 2, borderColor: '#0C1628', backgroundColor: '#F8FAFC' },
  variantText: { fontSize: 14, color: '#334155', flex: 1 },
  variantSelectedText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  linkCentered: { fontSize: 14, fontWeight: '800', color: '#334155', textAlign: 'center', paddingVertical: 6 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topLink: { fontSize: 16, fontWeight: '900', color: '#334155', paddingVertical: 8 },
  statePill: { borderRadius: 999, backgroundColor: '#F0F3F7', paddingHorizontal: 11, paddingVertical: 7 },
  statePillText: { fontSize: 12, fontWeight: '900', color: '#536174' },
  detailHero: { backgroundColor: '#0C1628', borderRadius: 30, padding: 24, gap: 11, shadowColor: '#0B1323', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  darkPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#26354C', paddingHorizontal: 10, paddingVertical: 6 },
  darkPillText: { fontSize: 11, fontWeight: '800', color: '#F4F6F8' },
  heroDate: { fontSize: 11, color: '#9BA7B8' },
  detailTitle: { fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -0.7, color: '#FFFFFF' },
  detailSubtitle: { fontSize: 14, lineHeight: 20, color: '#C8D0DB' },
  purchaseCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 9, borderWidth: 1, borderColor: '#E2E8EE', shadowColor: '#0B1323', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  purchaseEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#667085' },
  purchaseHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  purchaseLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: '#667085' },
  purchasePrice: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.7, color: '#0C1628', marginTop: 2 },
  purchaseBadge: { borderRadius: 999, backgroundColor: '#ECFDF3', paddingHorizontal: 10, paddingVertical: 6 },
  purchaseBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#027A48' },
  purchaseCopy: { fontSize: 12, lineHeight: 18, color: '#667085' },
  primaryValueCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 7, borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#7C8798' },
  cardEyebrowLight: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#9BA7B8' },
  primaryValue: { fontSize: 35, lineHeight: 41, fontWeight: '900', letterSpacing: -0.9, color: '#0C1628' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 19, gap: 12, borderWidth: 1, borderColor: '#E9EDF2', shadowColor: '#0B1323', shadowOpacity: 0.035, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 },
  detailKey: { fontSize: 14, color: '#7C8798' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0C1628', textAlign: 'right', textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#EEF1F4' },
  detailNotes: { fontSize: 15, lineHeight: 22, color: '#334155' },
  saleCard: { backgroundColor: '#0C1628', borderRadius: 24, padding: 21, gap: 11, shadowColor: '#0B1323', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  saleHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  saleTitle: { fontSize: 23, lineHeight: 29, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  saleValue: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  saleCopy: { fontSize: 13, lineHeight: 19, color: '#C8D0DB' },
  saleButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginTop: 3 },
  saleButtonText: { fontSize: 15, fontWeight: '900', color: '#0C1628' },
  secondaryActions: { gap: 10 },
});
