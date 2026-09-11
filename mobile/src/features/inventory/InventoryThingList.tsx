import React, { memo, useCallback } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { premiumColors } from '../../lib/premiumTheme';
import { buildSaleStartSurface } from '../../lib/saleStartSurface';
import { PrivateThingCover } from './PrivateThingCover';
import { inventoryLifecyclePresentation, itemTitle } from './presentation';
import type { PrivateInventoryItem } from './types';

type Props = {
  items: PrivateInventoryItem[];
  onOpenItem: (itemId: string) => void;
  header?: React.ReactElement | null;
  emptyState?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
};

function formatEuroCents(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const InventoryThingRow = memo(function InventoryThingRow({ item, onOpenItem }: { item: PrivateInventoryItem; onOpenItem: (itemId: string) => void }) {
  const snapshot = item.condition_snapshots[0];
  const generic = !item.product_variants;
  const sale = buildSaleStartSurface(item.id, item.value_evidence?.estimated_value_cents ?? null);
  const lifecycle = inventoryLifecyclePresentation(item.market_state);
  const title = itemTitle(item);
  const estimateAccessibilityLabel = item.value_evidence
    ? `Things Estimate ${formatEuroCents(item.value_evidence.estimated_value_cents)}`
    : 'Estimate pending';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${estimateAccessibilityLabel}. ${lifecycle.accessibilityLabel}.`}
      accessibilityHint="Opens Thing details"
      style={styles.compactItem}
      onPress={() => onOpenItem(item.id)}
    >
      <PrivateThingCover
        uri={item.cover_image_url}
        fallbackLabel={title}
        size={58}
        borderRadius={18}
        accessibilityLabel={`${title} private photo`}
      />
      <View style={styles.flex}>
        <View style={styles.itemTopLine}>
          <Text numberOfLines={1} style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemValue}>{sale.valueLabel.replace('Estimated value ', '')}</Text>
        </View>
        <View style={styles.itemBottomLine}>
          <Text numberOfLines={1} style={styles.itemMeta}>
            {generic ? (item.category || 'Thing') : 'Device'}{snapshot ? ` · ${snapshot.housing_state.replace(/_/g, ' ').toLowerCase()}` : ''}
          </Text>
          <View style={styles.stateDot} />
          <Text style={styles.itemState}>{lifecycle.label}</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
});

export const InventoryThingList = memo(function InventoryThingList({ items, onOpenItem, header = null, emptyState = null, refreshing = false, onRefresh }: Props) {
  const renderItem = useCallback(({ item }: ListRenderItemInfo<PrivateInventoryItem>) => (
    <InventoryThingRow item={item} onOpenItem={onOpenItem} />
  ), [onOpenItem]);
  const keyExtractor = useCallback((item: PrivateInventoryItem) => item.id, []);

  return (
    <FlatList
      style={styles.list}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={styles.header}
      ListEmptyComponent={emptyState}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={refreshing}
      onRefresh={onRefresh}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
});

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 64, gap: 11 },
  header: { gap: 20, marginBottom: 9 },
  flex: { flex: 1 },
  compactItem: {
    minHeight: 94,
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: premiumColors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: premiumColors.border,
    shadowColor: '#0B1323',
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  itemTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemTitle: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.15, color: premiumColors.text },
  itemValue: { fontSize: 15, fontWeight: '900', color: premiumColors.text },
  itemBottomLine: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  itemMeta: { flex: 1, fontSize: 12, color: '#7C8798' },
  stateDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#6B778A', marginRight: 5 },
  itemState: { fontSize: 11, fontWeight: '800', color: '#536174' },
  chevron: { fontSize: 25, color: '#A7B0BE', marginLeft: 1 },
});
