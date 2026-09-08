import React, { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MarketplaceMessage } from '../inventory/types';
import { premiumColors, premiumRadii, premiumSpacing, premiumTouch } from '../../lib/premiumTheme';

type Props = {
  messages: MarketplaceMessage[];
  loading: boolean;
  buyer: boolean;
  closed: boolean;
  onUseQuickMessage: () => void;
};

const MessageBubble = memo(function MessageBubble({ message }: { message: MarketplaceMessage }) {
  const mine = message.sender_role === 'ME';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.messageBody, mine && styles.mineMessageBody]}>{message.body}</Text>
      <Text style={[styles.time, mine && styles.mineTime]}>{new Date(message.created_at).toLocaleString()}</Text>
    </View>
  );
});

export const MarketplaceMessageList = memo(function MarketplaceMessageList({ messages, loading, buyer, closed, onUseQuickMessage }: Props) {
  const newestFirstMessages = useMemo(() => [...messages].reverse(), [messages]);
  const renderItem = useCallback(({ item }: { item: MarketplaceMessage }) => <MessageBubble message={item} />, []);
  const keyExtractor = useCallback((item: MarketplaceMessage) => item.message_id, []);

  return (
    <FlatList
      style={styles.messageList}
      contentContainerStyle={styles.messageContent}
      data={newestFirstMessages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted={newestFirstMessages.length > 0}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={18}
      maxToRenderPerBatch={12}
      windowSize={9}
      removeClippedSubviews
      ListEmptyComponent={loading ? (
        <ActivityIndicator accessibilityLabel="Loading messages" />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.copy}>Start with a simple question about this listing.</Text>
          {buyer && !closed ? (
            <TouchableOpacity accessibilityRole="button" style={styles.quickAction} onPress={onUseQuickMessage}>
              <Text style={styles.quickActionText}>Use “Is this still available?”</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    />
  );
});

const styles = StyleSheet.create({
  messageList: { flex: 1 },
  messageContent: { gap: premiumSpacing.md, paddingVertical: premiumSpacing.xs },
  empty: {
    backgroundColor: premiumColors.surface,
    borderRadius: premiumRadii.card,
    padding: premiumSpacing.lg,
    gap: premiumSpacing.sm,
    borderWidth: 1,
    borderColor: premiumColors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: premiumColors.text },
  copy: { fontSize: 13, lineHeight: 19, color: premiumColors.textMuted },
  quickAction: {
    alignSelf: 'flex-start',
    minHeight: premiumTouch.minimum,
    borderRadius: premiumRadii.pill,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: premiumSpacing.md,
    paddingVertical: premiumSpacing.sm,
    marginTop: 2,
    justifyContent: 'center',
  },
  quickActionText: { fontSize: 12, fontWeight: '800', color: '#3448A5' },
  bubble: {
    maxWidth: '84%',
    borderRadius: premiumRadii.control,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: premiumSpacing.xs,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: premiumColors.navy },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: premiumColors.surface,
    borderWidth: 1,
    borderColor: premiumColors.border,
  },
  messageBody: { fontSize: 14, lineHeight: 20, color: '#475467' },
  mineMessageBody: { color: premiumColors.surface },
  time: { fontSize: 10, color: premiumColors.textSubtle },
  mineTime: { color: '#C5CBD4' },
});
