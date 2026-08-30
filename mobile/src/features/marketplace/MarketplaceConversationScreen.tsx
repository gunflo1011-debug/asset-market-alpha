import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadMyMarketplaceMessages, sendMyMarketplaceMessage } from '../../data/inventory';
import type { MarketplaceConversation, MarketplaceMessage } from '../inventory/types';

type Props = {
  conversation: MarketplaceConversation;
  title: string;
  onBack: () => void;
};

export function MarketplaceConversationScreen({ conversation, title, onBack }: Props) {
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      setMessages(await loadMyMarketplaceMessages(conversation.conversation_id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [conversation.conversation_id]);

  async function send() {
    const body = draft.trim();
    if (!body || sending || conversation.status === 'SOLD' || conversation.status === 'CLOSED') return;
    try {
      setSending(true);
      setError(null);
      await sendMyMarketplaceMessage(conversation.conversation_id, body);
      setDraft('');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  const closed = conversation.status === 'SOLD' || conversation.status === 'CLOSED';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Marketplace</Text></TouchableOpacity>
          <TouchableOpacity disabled={loading} onPress={() => void refresh()}><Text style={styles.refresh}>{loading ? '…' : '↻'}</Text></TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{conversation.role === 'BUYER' ? 'BUYER CONVERSATION' : 'SELLER CONVERSATION'}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>Listing-bound private chat. Account identities and private inventory details are not exposed here.</Text>
          <View style={styles.statusPill}><Text style={styles.statusText}>{conversation.status}</Text></View>
        </View>

        <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
          {loading && messages.length === 0 ? <ActivityIndicator /> : null}
          {!loading && messages.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.copy}>Start with a simple question about this listing.</Text></View> : null}
          {messages.map((message) => (
            <View key={message.message_id} style={[styles.bubble, message.sender_role === 'ME' ? styles.mine : styles.theirs]}>
              <Text style={styles.messageBody}>{message.body}</Text>
              <Text style={styles.time}>{new Date(message.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {closed ? (
          <View style={styles.closed}><Text style={styles.closedTitle}>Conversation closed</Text><Text style={styles.copy}>New messages are disabled because this listing is {conversation.status.toLowerCase()}.</Text></View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message about this Thing"
              multiline
              maxLength={1200}
              style={styles.input}
            />
            <TouchableOpacity disabled={sending || !draft.trim()} style={[styles.sendButton, (sending || !draft.trim()) && styles.disabled]} onPress={() => void send()}>
              <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { flex: 1, padding: 20, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 16, fontWeight: '800', color: '#344054', paddingVertical: 8 },
  refresh: { fontSize: 20, fontWeight: '800', color: '#344054', padding: 8 },
  hero: { backgroundColor: '#0F1728', borderRadius: 24, padding: 20, gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#98A2B3' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#FFFFFF' },
  copy: { fontSize: 13, lineHeight: 19, color: '#7A8494' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#243046', paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  messageList: { flex: 1 },
  messageContent: { gap: 10, paddingVertical: 4 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 5, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F1728' },
  bubble: { maxWidth: '84%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, gap: 5 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#0F1728' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  messageBody: { fontSize: 14, lineHeight: 20, color: '#667085' },
  time: { fontSize: 10, color: '#98A2B3' },
  composer: { gap: 10 },
  input: { minHeight: 58, maxHeight: 120, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F1728' },
  sendButton: { backgroundColor: '#0F1728', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.45 },
  error: { color: '#B42318', fontSize: 12, lineHeight: 18 },
  closed: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 14, gap: 4 },
  closedTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412' },
});
