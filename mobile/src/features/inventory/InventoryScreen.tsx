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
  safe: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { padding: 20, paddingTop: 24, paddingBottom: 56, gap: 18 },
  detailContainer: { padding: 20, paddingTop: 18, paddingBottom: 56, gap: 16 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, color: '#7A8494' },
  pageTitle: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.1, color: '#0F1728', marginTop: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  iconButtonText: { color: '#344054', fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  summaryCard: { backgroundColor: '#0F1728', borderRadius: 28, padding: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 20 },
  summaryPrimary: { flex: 1 },
  summaryCount: { minWidth: 72, alignItems: 'flex-end' },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#8E99AA', marginBottom: 8 },
  valueSummary: { fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1, color: '#FFFFFF' },
  metric: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: '#FFFFFF' },
  metricLabel: { fontSize: 12, lineHeight: 17, color: '#C5CBD4', marginTop: 3 },
  quickActions: { flexDirection: 'row', gap: 10 },
  primaryQuickAction: { flex: 1, minHeight: 58, borderRadius: 18, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#0F1728' },
  primaryQuickIcon: { fontSize: 22, color: '#FFFFFF', fontWeight: '500' },
  primaryQuickText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  secondaryQuickAction: { flex: 1.2, minHeight: 58, borderRadius: 18, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  secondaryQuickText: { fontSize: 15, fontWeight: '800', color: '#0F1728' },
  quickArrow: { fontSize: 23, color: '#98A2B3' },
  captureCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 13, borderWidth: 1, borderColor: '#E5E8ED' },
  segmentedControl: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: '#F0F2F5', borderRadius: 14 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#7A8494' },
  segmentTextActive: { color: '#0F1728' },
  sectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: '#0F1728' },
  compactCopy: { fontSize: 13, lineHeight: 19, color: '#7A8494' },
  formField: { gap: 6 },
  fieldLabel: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#344054' },
  fieldMeta: { fontWeight: '600', color: '#98A2B3' },
  input: { borderWidth: 1, borderColor: '#D9DEE6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#0F1728', backgroundColor: '#FFFFFF' },
  flexInput: { flex: 1 },
  twoColumnInputs: { flexDirection: 'row', gap: 10 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1728' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryButton: { borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9DEE6', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#344054', fontWeight: '700', fontSize: 15 },
  dangerButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#F0C7C2', backgroundColor: '#FFF9F8' },
  dangerButtonText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  notice: { fontSize: 13, lineHeight: 19, color: '#344054', backgroundColor: '#EEF4FF', padding: 13, borderRadius: 14 },
  inventoryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 2 },
  inventoryRefreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  refreshLink: { fontSize: 13, fontWeight: '800', color: '#475467' },
  filterRow: { gap: 8, paddingRight: 4 },
  filterChip: { minHeight: 40, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 15, borderWidth: 1, borderColor: '#D9DEE6', backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: '#0F1728', borderColor: '#0F1728' },
  filterChipText: { fontSize: 13, fontWeight: '800', color: '#475467' },
  filterChipTextActive: { color: '#FFFFFF' },
  listCard: { overflow: 'hidden', backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E5E8ED' },
  compactItem: { minHeight: 86, paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactItemBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  itemIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F5' },
  itemIconText: { fontSize: 15, fontWeight: '800', color: '#475467' },
  itemTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemTitle: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '800', color: '#0F1728' },
  itemValue: { fontSize: 15, fontWeight: '800', color: '#0F1728' },
  itemBottomLine: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  itemMeta: { flex: 1, fontSize: 12, color: '#7A8494' },
  stateDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#667085', marginRight: 5 },
  itemState: { fontSize: 11, fontWeight: '700', color: '#475467' },
  chevron: { fontSize: 25, color: '#B0B8C4' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, gap: 8, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F1728' },
  errorCard: { backgroundColor: '#FFF8F7', borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 16, fontWeight: '800', color: '#B42318' },
  errorRetryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  errorRetryText: { fontSize: 13, fontWeight: '800', color: '#B42318' },
  variantButton: { borderWidth: 1, borderColor: '#D9DEE6', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  variantButtonSelected: { borderWidth: 2, borderColor: '#0F1728', backgroundColor: '#F8F9FB' },
  variantText: { fontSize: 14, color: '#344054', flex: 1 },
  variantSelectedText: { fontSize: 11, fontWeight: '700', color: '#344054' },
  linkCentered: { fontSize: 14, fontWeight: '700', color: '#344054', textAlign: 'center', paddingVertical: 6 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topLink: { fontSize: 16, fontWeight: '800', color: '#344054', paddingVertical: 8 },
  statePill: { borderRadius: 999, backgroundColor: '#F0F2F5', paddingHorizontal: 10, paddingVertical: 6 },
  statePillText: { fontSize: 12, fontWeight: '800', color: '#475467' },
  detailHero: { backgroundColor: '#0F1728', borderRadius: 28, padding: 22, gap: 10 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  darkPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#263246', paddingHorizontal: 9, paddingVertical: 5 },
  darkPillText: { fontSize: 11, fontWeight: '700', color: '#F4F6F8' },
  heroDate: { fontSize: 11, color: '#98A2B3' },
  detailTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: '#FFFFFF' },
  detailSubtitle: { fontSize: 14, lineHeight: 20, color: '#C5CBD4' },
  purchaseCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 19, gap: 9, borderWidth: 1, borderColor: '#DCE4EA' },
  purchaseEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#667085' },
  purchaseHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  purchaseLabel: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#667085' },
  purchasePrice: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: '#0F1728', marginTop: 2 },
  purchaseBadge: { borderRadius: 999, backgroundColor: '#ECFDF3', paddingHorizontal: 9, paddingVertical: 6 },
  purchaseBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#027A48' },
  purchaseCopy: { fontSize: 12, lineHeight: 18, color: '#667085' },
  primaryValueCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 19, gap: 7, borderWidth: 1, borderColor: '#E5E8ED' },
  cardEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#7A8494' },
  cardEyebrowLight: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#98A2B3' },
  primaryValue: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8, color: '#0F1728' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E5E8ED' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 },
  detailKey: { fontSize: 14, color: '#7A8494' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F1728', textAlign: 'right', textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#EEF0F3' },
  detailNotes: { fontSize: 15, lineHeight: 22, color: '#344054' },
  saleCard: { backgroundColor: '#0F1728', borderRadius: 22, padding: 20, gap: 11 },
  saleHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  saleTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  saleValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  saleCopy: { fontSize: 13, lineHeight: 19, color: '#C5CBD4' },
  saleButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginTop: 2 },
  saleButtonText: { fontSize: 15, fontWeight: '800', color: '#0F1728' },
  secondaryActions: { gap: 10 },
});
