import React, { memo, type ReactElement, type ReactNode, useCallback } from 'react';
import { FlatList, Platform, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { MarketplaceListing } from '../inventory/types';

type Props = {
  listings: MarketplaceListing[];
  renderListing: (listing: MarketplaceListing) => ReactElement;
  header?: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

function MarketplaceBrowseListComponent({
  listings,
  renderListing,
  header,
  footer,
  empty,
  refreshing = false,
  onRefresh,
}: Props) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketplaceListing>) => renderListing(item),
    [renderListing],
  );

  return (
    <FlatList
      data={listings}
      renderItem={renderItem}
      keyExtractor={(item) => item.item_id}
      ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : null}
      ListFooterComponent={footer ? <View style={styles.footer}>{footer}</View> : null}
      ListEmptyComponent={empty ? <View style={styles.empty}>{empty}</View> : null}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={7}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={Platform.OS === 'android'}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

export const MarketplaceBrowseList = memo(MarketplaceBrowseListComponent);

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 64,
  },
  header: {
    marginBottom: 17,
  },
  footer: {
    marginTop: 17,
  },
  empty: {
    marginTop: 17,
  },
  separator: {
    height: 17,
  },
});
