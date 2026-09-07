import React, { memo, useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MarketplaceMessage } from '../inventory/types';

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
  const listRef = useRef<FlatList<MarketplaceMessage>>(null);
  const lastPositionedMessageId = useRef<string | null>(null);
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].message_id : null;
  const renderItem = useCallback(({ item }: { item: MarketplaceMessage }) => <MessageBubble message={item} />, []);
  const keyExtractor = useCallback((item: MarketplaceMessage) => item.message_id, []);
  const positionOnLatestMessage = useCallback(() => {
    if (!latestMessageId || latestMessageId === lastPositionedMessageId.current) return;
    listRef.current?.scrollToEnd({ animated: false });
    lastPositionedMessageId.current = latestMessageId;
  }, [latestMessageId]);

  return (
    <FlatList
      ref={listRef}
      style={styles.messageList}
      contentContainerStyle={styles.messageContent}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={18}
      maxToRenderPerBatch={12}
      windowSize={9}
      removeClippedSubviews
      onContentSizeChange={positionOnLatestMessage}
      ListEmptyComponent={loading ? (
        <ActivityIndicator />
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
  messageContent: { gap: 10, paddingVertical: 4 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 8, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F1728' },
  copy: { fontSize: 13, lineHeight: 19, color: '#7A8494' },
  quickAction: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 8, marginTop: 2 },
  quickActionText: { fontSize: 12, fontWeight: '800', color: '#3448A5' },
  bubble: { maxWidth: '84%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, gap: 5 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#0F1728' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  messageBody: { fontSize: 14, lineHeight: 20, color: '#475467' },
  mineMessageBody: { color: '#FFFFFF' },
  time: { fontSize: 10, color: '#98A2B3' },
  mineTime: { color: '#C5CBD4' },
});
