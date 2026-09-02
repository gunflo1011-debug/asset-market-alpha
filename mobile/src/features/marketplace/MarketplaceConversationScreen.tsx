import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { adoptMySoldMarketplaceThing, loadMyMarketplaceConversations, loadMyMarketplaceMessages, sendMyMarketplaceMessage, setMyMarketplaceConversationStatus } from '../../data/inventory';
import type { MarketplaceConversation, MarketplaceConversationStatus, MarketplaceMessage } from '../inventory/types';

type Props = { conversation: MarketplaceConversation; title: string; onBack: () => void };
const QUICK_MESSAGE = 'Hi, is this still available?';

export function MarketplaceConversationScreen({ conversation, title, onBack }: Props) {
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [finalSalePrice, setFinalSalePrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [adoptionBusy, setAdoptionBusy] = useState(false);
  const [adoptedItemId, setAdoptedItemId] = useState<string | null>(null);
  const [status, setStatus] = useState<MarketplaceConversationStatus>(conversation.status);
  const [error, setError] = useState<string | null>(null);

  const parsedFinalSalePrice = useMemo(() => {
    const euros = Number(finalSalePrice.replace(',', '.').trim());
    const cents = Math.round(euros * 100);
    return { cents, valid: Number.isFinite(euros) && euros > 0 && cents <= 1_000_000_000 };
  }, [finalSalePrice]);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const [nextMessages, conversations] = await Promise.all([
        loadMyMarketplaceMessages(conversation.conversation_id),
        loadMyMarketplaceConversations(),
      ]);
      setMessages(nextMessages);
      const currentConversation = conversations.find((entry) => entry.conversation_id === conversation.conversation_id);
      if (currentConversation) setStatus(currentConversation.status);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load conversation.');
    } finally { setLoading(false); }
  }

  useEffect(() => { setStatus(conversation.status); setAdoptedItemId(null); setFinalSalePrice(''); void refresh(); }, [conversation.conversation_id, conversation.status]);

  async function send() {
    const body = draft.trim();
    if (!body || sending || status === 'SOLD' || status === 'CLOSED') return;
    try {
      setSending(true); setError(null);
      await sendMyMarketplaceMessage(conversation.conversation_id, body);
      setDraft(''); await refresh();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not send message.'); }
    finally { setSending(false); }
  }

  async function changeLifecycle(nextStatus: 'RESERVED' | 'SOLD', finalSalePriceCents?: number | null) {
    try {
      setLifecycleBusy(true); setError(null);
      setStatus(await setMyMarketplaceConversationStatus(conversation.conversation_id, nextStatus, finalSalePriceCents));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not update listing status.'); }
    finally { setLifecycleBusy(false); }
  }

  async function adoptPurchasedThing() {
    if (adoptionBusy || adoptedItemId) return;
    try {
      setAdoptionBusy(true); setError(null);
      setAdoptedItemId(await adoptMySoldMarketplaceThing(conversation.conversation_id));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not add purchased Thing to My Things.'); }
    finally { setAdoptionBusy(false); }
  }

  function confirmReserve() {
    Alert.alert('Reserve for this buyer?', 'The listing will leave the public Marketplace and other buyer conversations for this Thing will close. You can keep chatting here.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Reserve', onPress: () => void changeLifecycle('RESERVED') },
    ]);
  }
  function confirmSold() {
    if (!parsedFinalSalePrice.valid) {
      setError('Enter the actual final sale price before marking this Thing sold.');
      return;
    }
    const formatted = (parsedFinalSalePrice.cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    Alert.alert('Mark this Thing as sold?', `Confirm that the real sale is complete at ${formatted}. This final price is stored separately from your asking price and may contribute anonymously to Things Market Value.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Mark as sold', style: 'destructive', onPress: () => void changeLifecycle('SOLD', parsedFinalSalePrice.cents) },
    ]);
  }

  const closed = status === 'SOLD' || status === 'CLOSED';
  const seller = conversation.role === 'SELLER';
  const buyer = conversation.role === 'BUYER';

  return (
    <SafeAreaView style={styles.safe}><View style={styles.container}>
      <View style={styles.header}><TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Marketplace</Text></TouchableOpacity><TouchableOpacity disabled={loading} onPress={() => void refresh()}><Text style={styles.refresh}>{loading ? '…' : '↻'}</Text></TouchableOpacity></View>
      <View style={styles.hero}><Text style={styles.eyebrow}>{buyer ? 'BUYER CONVERSATION' : 'SELLER CONVERSATION'}</Text><Text style={styles.title}>{title}</Text><Text style={styles.heroCopy}>Listing-bound private chat. Account identities and private inventory details are not exposed here.</Text><View style={styles.statusPill}><Text style={styles.statusText}>{status}</Text></View></View>

      {seller && status === 'OPEN' ? <View style={styles.lifecycleCard}><Text style={styles.lifecycleTitle}>Ready to hold it for this buyer?</Text><Text style={styles.copy}>Reserve only when you intend to stop offering this Thing to other buyers. No payment or purchase happens automatically.</Text><TouchableOpacity disabled={lifecycleBusy} style={[styles.lifecycleButton, lifecycleBusy && styles.disabled]} onPress={confirmReserve}><Text style={styles.lifecycleButtonText}>{lifecycleBusy ? 'Updating…' : 'Reserve for this buyer'}</Text></TouchableOpacity></View> : null}
      {seller && status === 'RESERVED' ? <View style={styles.lifecycleCard}><Text style={styles.lifecycleTitle}>Reserved for this buyer</Text><Text style={styles.copy}>The public listing is withdrawn. Keep using this chat to coordinate. Mark sold only after the real handover or sale is complete.</Text><Text style={styles.priceLabel}>Actual final sale price (€)</Text><TextInput value={finalSalePrice} onChangeText={setFinalSalePrice} keyboardType="decimal-pad" placeholder="e.g. 85" style={styles.priceInput} /><Text style={styles.priceHelp}>This is the amount actually agreed and paid. It is stored separately from the original seller asking price and is not published as a new listing price.</Text><TouchableOpacity disabled={lifecycleBusy || !parsedFinalSalePrice.valid} style={[styles.soldButton, (lifecycleBusy || !parsedFinalSalePrice.valid) && styles.disabled]} onPress={confirmSold}><Text style={styles.soldButtonText}>{lifecycleBusy ? 'Updating…' : parsedFinalSalePrice.valid ? `Mark as sold at ${(parsedFinalSalePrice.cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : 'Enter final price to mark as sold'}</Text></TouchableOpacity></View> : null}
      {buyer && status === 'SOLD' ? <View style={styles.adoptionCard}><Text style={styles.lifecycleTitle}>Add your purchased Thing?</Text><Text style={styles.copy}>Creates a new private Thing in My Things. Seller notes, private location, serial data, photos and account details are not copied.</Text><TouchableOpacity disabled={adoptionBusy || !!adoptedItemId} style={[styles.adoptionButton, (adoptionBusy || !!adoptedItemId) && styles.disabled]} onPress={() => void adoptPurchasedThing()}><Text style={styles.adoptionButtonText}>{adoptedItemId ? 'Added to My Things' : adoptionBusy ? 'Adding…' : 'Add to My Things'}</Text></TouchableOpacity>{adoptedItemId ? <Text style={styles.success}>Saved privately. Returning to Inventory will show the purchased Thing.</Text> : null}</View> : null}

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
        {loading && messages.length === 0 ? <ActivityIndicator /> : null}
        {!loading && messages.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.copy}>Start with a simple question about this listing.</Text>{buyer && !closed ? <TouchableOpacity style={styles.quickAction} onPress={() => setDraft(QUICK_MESSAGE)}><Text style={styles.quickActionText}>Use “Is this still available?”</Text></TouchableOpacity> : null}</View> : null}
        {messages.map((message) => { const mine = message.sender_role === 'ME'; return <View key={message.message_id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.messageBody, mine && styles.mineMessageBody]}>{message.body}</Text><Text style={[styles.time, mine && styles.mineTime]}>{new Date(message.created_at).toLocaleString()}</Text></View>; })}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {closed ? <View style={styles.closed}><Text style={styles.closedTitle}>Conversation closed</Text><Text style={styles.copy}>New messages are disabled because this transaction is {status.toLowerCase()}.</Text></View> : <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Message about this Thing" multiline maxLength={1200} style={styles.input} /><Text style={styles.counter}>{draft.length}/1200</Text><TouchableOpacity disabled={sending || !draft.trim()} style={[styles.sendButton, (sending || !draft.trim()) && styles.disabled]} onPress={() => void send()}><Text style={styles.sendText}>{sending ? 'Sending…' : 'Send'}</Text></TouchableOpacity></View>}
    </View></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F7F9'},container:{flex:1,padding:20,gap:14},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{fontSize:16,fontWeight:'800',color:'#344054',paddingVertical:8},refresh:{fontSize:20,fontWeight:'800',color:'#344054',padding:8},hero:{backgroundColor:'#0F1728',borderRadius:24,padding:20,gap:8},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:'#98A2B3'},title:{fontSize:24,lineHeight:30,fontWeight:'800',color:'#FFFFFF'},heroCopy:{fontSize:13,lineHeight:19,color:'#C5CBD4'},copy:{fontSize:13,lineHeight:19,color:'#7A8494'},statusPill:{alignSelf:'flex-start',borderRadius:999,backgroundColor:'#243046',paddingHorizontal:10,paddingVertical:6},statusText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},lifecycleCard:{backgroundColor:'#FFFFFF',borderRadius:18,padding:16,gap:8,borderWidth:1,borderColor:'#E5E8ED'},lifecycleTitle:{fontSize:15,fontWeight:'800',color:'#0F1728'},lifecycleButton:{borderRadius:14,backgroundColor:'#3448A5',paddingVertical:12,alignItems:'center',marginTop:2},lifecycleButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},priceLabel:{fontSize:12,fontWeight:'800',color:'#344054',marginTop:4},priceInput:{minHeight:52,borderWidth:1,borderColor:'#D0D5DD',borderRadius:14,paddingHorizontal:14,fontSize:20,fontWeight:'800',color:'#0F1728',backgroundColor:'#FFFFFF'},priceHelp:{fontSize:11,lineHeight:17,color:'#667085'},soldButton:{borderRadius:14,backgroundColor:'#B42318',paddingVertical:12,alignItems:'center',marginTop:2},soldButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},adoptionCard:{backgroundColor:'#ECFDF3',borderRadius:18,padding:16,gap:8,borderWidth:1,borderColor:'#ABEFC6'},adoptionButton:{borderRadius:14,backgroundColor:'#027A48',paddingVertical:12,alignItems:'center'},adoptionButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},success:{fontSize:12,lineHeight:18,color:'#027A48',fontWeight:'700'},messageList:{flex:1},messageContent:{gap:10,paddingVertical:4},empty:{backgroundColor:'#FFFFFF',borderRadius:18,padding:18,gap:8,borderWidth:1,borderColor:'#E5E8ED'},emptyTitle:{fontSize:16,fontWeight:'800',color:'#0F1728'},quickAction:{alignSelf:'flex-start',borderRadius:999,backgroundColor:'#EEF2FF',paddingHorizontal:12,paddingVertical:8,marginTop:2},quickActionText:{fontSize:12,fontWeight:'800',color:'#3448A5'},bubble:{maxWidth:'84%',borderRadius:18,paddingHorizontal:14,paddingVertical:11,gap:5},mine:{alignSelf:'flex-end',backgroundColor:'#0F1728'},theirs:{alignSelf:'flex-start',backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E5E8ED'},messageBody:{fontSize:14,lineHeight:20,color:'#475467'},mineMessageBody:{color:'#FFFFFF'},time:{fontSize:10,color:'#98A2B3'},mineTime:{color:'#C5CBD4'},composer:{gap:8},input:{minHeight:58,maxHeight:120,backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#D0D5DD',paddingHorizontal:14,paddingVertical:12,fontSize:14,color:'#0F1728'},counter:{alignSelf:'flex-end',fontSize:10,color:'#98A2B3'},sendButton:{backgroundColor:'#0F1728',borderRadius:16,paddingVertical:14,alignItems:'center'},sendText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},disabled:{opacity:.45},error:{color:'#B42318',fontSize:12,lineHeight:18},closed:{backgroundColor:'#FFF7ED',borderRadius:16,padding:14,gap:4},closedTitle:{fontSize:14,fontWeight:'800',color:'#9A3412'}
});
