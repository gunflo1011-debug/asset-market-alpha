import React, { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MarketplaceMessage } from '../inventory/types';
import { premiumColors, premiumRadii, premiumSpacing, premiumTouch } from '../../lib/premiumTheme';

type Props = {
  messages: MarketplaceMessage[];
  loading: boolean;
  buyer: boolean;
  closed: boolean;
  onUseQuickMessage: () => void;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
};

const MessageBubble = memo(
  function MessageBubble({ message }: { message: MarketplaceMessage }) {
    const mine = message.sender_role === 'ME';
    const timestamp = useMemo(() => new Date(message.created_at).toLocaleString(), [message.created_at]);
    const accessibilityLabel = `${mine ? 'You' : 'Other person'}: ${message.body}. Sent ${timestamp}`;
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.messageBody, mine && styles.mineMessageBody]}>{message.body}</Text>
        <Text style={[styles.time, mine && styles.mineTime]}>{timestamp}</Text>
      </View>
    );
  },
  (previous, next) => (
    previous.message.message_id === next.message.message_id
    && previous.message.sender_role === next.message.sender_role
    && previous.message.body === next.message.body
    && previous.message.created_at === next.message.created_at
  ),
);

export const MarketplaceMessageList = memo(function MarketplaceMessageList({
  messages,
  loading,
  buyer,
  closed,
  onUseQuickMessage,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
}: Props) {
  const newestFirstMessages = useMemo(() => [...messages].reverse(), [messages]);
  const renderItem = useCallback(({ item }: { item: MarketplaceMessage }) => <MessageBubble message={item} />, []);
  const keyExtractor = useCallback((item: MarketplaceMessage) => item.message_id, []);
  const historyControl = hasOlder && onLoadOlder ? (
    <View style={styles.historyControl}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={loadingOlder ? 'Loading earlier messages' : 'Load earlier messages'}
        accessibilityHint="Loads older messages without leaving this conversation"
        disabled={loadingOlder}
        style={[styles.historyButton, loadingOlder && styles.historyButtonDisabled]}
        onPress={onLoadOlder}
      >
        {loadingOlder ? <ActivityIndicator size="small" /> : <Text style={styles.historyButtonText}>Earlier messages</Text>}
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <FlatList
      accessibilityLabel="Marketplace conversation messages"
      style={styles.messageList}
      contentContainerStyle={styles.messageContent}
      data={newestFirstMessages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted={newestFirstMessages.length > 0}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={18}
      maxToRenderPerBatch={12}
      windowSize={9}
      removeClippedSubviews={Platform.OS === 'android'}
      ListFooterComponent={historyControl}
      ListEmptyComponent={loading ? (
        <ActivityIndicator accessibilityLabel="Loading messages" />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.copy}>Start with a simple question about this listing.</Text>
          {buyer && !closed ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Use quick message: Is this still available?"
              accessibilityHint="Fills the message composer without sending"
              style={styles.quickAction}
              onPress={onUseQuickMessage}
            >
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
  historyControl: { alignItems: 'center', paddingBottom: premiumSpacing.xs },
  historyButton: {
    minHeight: premiumTouch.minimum,
    borderRadius: premiumRadii.pill,
    backgroundColor: premiumColors.surface,
    borderWidth: 1,
    borderColor: premiumColors.border,
    paddingHorizontal: premiumSpacing.lg,
    paddingVertical: premiumSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButtonDisabled: { opacity: 0.6 },
  historyButtonText: { fontSize: 12, fontWeight: '800', color: premiumColors.textMuted },
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
