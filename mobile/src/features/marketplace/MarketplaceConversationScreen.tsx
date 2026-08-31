import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadMyMarketplaceMessages, sendMyMarketplaceMessage, setMyMarketplaceConversationStatus } from '../../data/inventory';
import type { MarketplaceConversation, MarketplaceConversationStatus, MarketplaceMessage } from '../inventory/types';

type Props = {
  conversation: MarketplaceConversation;
  title: string;
  onBack: () => void;
};

const QUICK_MESSAGE = 'Hi, is this still available?';

export function MarketplaceConversationScreen({ conversation, title, onBack }: Props) {
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [status, setStatus] = useState<MarketplaceConversationStatus>(conversation.status);
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

  useEffect(() => {
    setStatus(conversation.status);
    void refresh();
  }, [conversation.conversation_id, conversation.status]);

  async function send() {
    const body = draft.trim();
    if (!body || sending || status === 'SOLD' || status === 'CLOSED') return;
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

  async function changeLifecycle(nextStatus: 'RESERVED' | 'SOLD') {
    try {
      setLifecycleBusy(true);
      setError(null);
      const saved = await setMyMarketplaceConversationStatus(conversation.conversation_id, nextStatus);
      setStatus(saved);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update listing status.');
    } finally {
      setLifecycleBusy(false);
    }
  }

  function confirmReserve() {
    Alert.alert(
      'Reserve for this buyer?',
      'The listing will leave the public Marketplace and other buyer conversations for this Thing will close. You can keep chatting here.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reserve', onPress: () => void changeLifecycle('RESERVED') },
      ],
    );
  }

  function confirmSold() {
    Alert.alert(
      'Mark this Thing as sold?',
      'Use this only after you have actually completed the sale. This closes messaging for this transaction and marks the Thing sold in your lifecycle.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark sold', style: 'destructive', onPress: () => void changeLifecycle('SOLD') },
      ],
    );
  }

  const closed = status === 'SOLD' || status === 'CLOSED';
  const seller = conversation.role === 'SELLER';

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
          <Text style={styles.heroCopy}>Listing-bound private chat. Account identities and private inventory details are not exposed here.</Text>
          <View style={styles.statusPill}><Text style={styles.statusText}>{status}</Text></View>
        </View>

        {seller && status === 'OPEN' ? (
          <View style={styles.lifecycleCard}>
            <Text style={styles.lifecycleTitle}>Ready to hold it for this buyer?</Text>
            <Text style={styles.copy}>Reserve only when you intend to stop offering this Thing to other buyers. No payment or purchase happens automatically.</Text>
            <TouchableOpacity disabled={lifecycleBusy} style={[styles.lifecycleButton, lifecycleBusy && styles.disabled]} onPress={confirmReserve}>
              <Text style={styles.lifecycleButtonText}>{lifecycleBusy ? 'Updating…' : 'Reserve for this buyer'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {seller && status === 'RESERVED' ? (
          <View style={styles.lifecycleCard}>
            <Text style={styles.lifecycleTitle}>Reserved for this buyer</Text>
            <Text style={styles.copy}>The public listing is withdrawn. Keep using this chat to coordinate. Mark sold only after the real handover or sale is complete.</Text>
            <TouchableOpacity disabled={lifecycleBusy} style={[styles.soldButton, lifecycleBusy && styles.disabled]} onPress={confirmSold}>
              <Text style={styles.soldButtonText}>{lifecycleBusy ? 'Updating…' : 'Mark as sold'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
          {loading && messages.length === 0 ? <ActivityIndicator /> : null}
          {!loading && messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.copy}>Start with a simple question about this listing.</Text>
              {conversation.role === 'BUYER' && !closed ? (
                <TouchableOpacity style={styles.quickAction} onPress={() => setDraft(QUICK_MESSAGE)}>
                  <Text style={styles.quickActionText}>Use “Is this still available?”</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {messages.map((message) => {
            const mine = message.sender_role === 'ME';
            return (
              <View key={message.message_id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.messageBody, mine && styles.mineMessageBody]}>{message.body}</Text>
                <Text style={[styles.time, mine && styles.mineTime]}>{new Date(message.created_at).toLocaleString()}</Text>
              </View>
            );
          })}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {closed ? (
          <View style={styles.closed}><Text style={styles.closedTitle}>Conversation closed</Text><Text style={styles.copy}>New messages are disabled because this transaction is {status.toLowerCase()}.</Text></View>
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
            <Text style={styles.counter}>{draft.length}/1200</Text>
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
  heroCopy: { fontSize: 13, lineHeight: 19, color: '#C5CBD4' },
  copy: { fontSize: 13, lineHeight: 19, color: '#7A8494' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#243046', paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  lifecycleCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#E5E8ED' },
  lifecycleTitle: { fontSize: 15, fontWeight: '800', color: '#0F1728' },
  lifecycleButton: { borderRadius: 14, backgroundColor: '#3448A5', paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  lifecycleButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  soldButton: { borderRadius: 14, backgroundColor: '#B42318', paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  soldButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  messageList: { flex: 1 },
  messageContent: { gap: 10, paddingVertical: 4 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 8, borderWidth: 1, borderColor: '#E5E8ED' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F1728' },
  quickAction: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 8, marginTop: 2 },
  quickActionText: { fontSize: 12, fontWeight: '800', color: '#3448A5' },
  bubble: { maxWidth: '84%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, gap: 5 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#0F1728' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E8ED' },
  messageBody: { fontSize: 14, lineHeight: 20, color: '#475467' },
  mineMessageBody: { color: '#FFFFFF' },
  time: { fontSize: 10, color: '#98A2B3' },
  mineTime: { color: '#C5CBD4' },
  composer: { gap: 8 },
  input: { minHeight: 58, maxHeight: 120, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F1728' },
  counter: { alignSelf: 'flex-end', fontSize: 10, color: '#98A2B3' },
  sendButton: { backgroundColor: '#0F1728', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.45 },
  error: { color: '#B42318', fontSize: 12, lineHeight: 18 },
  closed: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 14, gap: 4 },
  closedTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412' },
});
