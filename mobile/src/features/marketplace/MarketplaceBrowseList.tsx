import React, { memo, type ReactElement, type ReactNode, useCallback } from 'react';
import { FlatList, Platform, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { MarketplaceListing } from '../inventory/types';

export type MarketplaceBrowseListingState = {
  interested: boolean;
  conversationOpen: boolean;
};

type Props = {
  listings: MarketplaceListing[];
  renderListing: (listing: MarketplaceListing, state: MarketplaceBrowseListingState) => ReactElement;
  getListingState: (listing: MarketplaceListing) => MarketplaceBrowseListingState;
  header?: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

type MarketplaceBrowseRowProps = {
  listing: MarketplaceListing;
  state: MarketplaceBrowseListingState;
  renderListing: (listing: MarketplaceListing, state: MarketplaceBrowseListingState) => ReactElement;
};

function stableRemoteImageIdentity(uri: string): string {
  const queryIndex = uri.indexOf('?');
  const hashIndex = uri.indexOf('#');
  let cutoff = uri.length;
  if (queryIndex >= 0) cutoff = Math.min(cutoff, queryIndex);
  if (hashIndex >= 0) cutoff = Math.min(cutoff, hashIndex);
  return uri.slice(0, cutoff);
}

function sameMarketplaceListing(previous: MarketplaceListing, next: MarketplaceListing): boolean {
  return (
    previous.item_id === next.item_id
    && previous.title === next.title
    && previous.category === next.category
    && previous.asking_price_cents === next.asking_price_cents
    && previous.estimated_value_cents === next.estimated_value_cents
    && previous.condition_label === next.condition_label
    && previous.public_location === next.public_location
    && previous.published_at === next.published_at
    && previous.image_urls.length === next.image_urls.length
    && previous.image_urls.every(
      (uri, index) => stableRemoteImageIdentity(uri) === stableRemoteImageIdentity(next.image_urls[index]),
    )
  );
}

const MarketplaceBrowseRow = memo(
  function MarketplaceBrowseRow({ listing, state, renderListing }: MarketplaceBrowseRowProps) {
    return renderListing(listing, state);
  },
  (previous, next) => (
    previous.state.interested === next.state.interested
    && previous.state.conversationOpen === next.state.conversationOpen
    && sameMarketplaceListing(previous.listing, next.listing)
  ),
);

const MarketplaceBrowseSeparator = memo(function MarketplaceBrowseSeparator() {
  return <View style={styles.separator} />;
});

function MarketplaceBrowseListComponent({
  listings,
  renderListing,
  getListingState,
  header,
  footer,
  empty,
  refreshing = false,
  onRefresh,
}: Props) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketplaceListing>) => (
      <MarketplaceBrowseRow
        listing={item}
        state={getListingState(item)}
        renderListing={renderListing}
      />
    ),
    [getListingState, renderListing],
  );
  const keyExtractor = useCallback((item: MarketplaceListing) => item.item_id, []);

  return (
    <FlatList
      style={styles.list}
      data={listings}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : null}
      ListFooterComponent={footer ? <View style={styles.footer}>{footer}</View> : null}
      ListEmptyComponent={empty ? <View style={styles.empty}>{empty}</View> : null}
      ItemSeparatorComponent={MarketplaceBrowseSeparator}
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
  list: {
    flex: 1,
  },
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
