import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { adoptMySoldMarketplaceThing, loadMyMarketplaceConversations, loadMyMarketplaceMessages, loadMyMarketplaceOffers, makeMyMarketplaceOffer, MAX_FINAL_SALE_CENTS, MAX_OFFER_CENTS, respondToMyMarketplaceOffer, sendMyMarketplaceMessage, setMyMarketplaceConversationStatus } from '../../data/inventory';
import { viewPurchasedThingInInventory } from '../../lib/purchasedThingNavigation';
import type { MarketplaceConversation, MarketplaceConversationStatus, MarketplaceMessage, MarketplaceOffer } from '../inventory/types';

type Props = { conversation: MarketplaceConversation; title: string; onBack: () => void };
const QUICK_MESSAGE = 'Hi, is this still available?';

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function parseEuroAmount(value: string, maxCents: number): { cents: number; valid: boolean } {
  const euros = Number(value.replace(',', '.').trim());
  const cents = Math.round(euros * 100);
  return { cents, valid: Number.isFinite(euros) && euros > 0 && cents <= maxCents };
}

export function MarketplaceConversationScreen({ conversation, title, onBack }: Props) {
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [draft, setDraft] = useState('');
  const [finalSalePrice, setFinalSalePrice] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [showOfferComposer, setShowOfferComposer] = useState(conversation.role === 'BUYER' && conversation.status === 'OPEN');
  const [showCounterComposer, setShowCounterComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [adoptionBusy, setAdoptionBusy] = useState(false);
  const [adoptedItemId, setAdoptedItemId] = useState<string | null>(null);
  const [status, setStatus] = useState<MarketplaceConversationStatus>(conversation.status);
  const [error, setError] = useState<string | null>(null);

  const parsedFinalSalePrice = useMemo(() => parseEuroAmount(finalSalePrice, MAX_FINAL_SALE_CENTS), [finalSalePrice]);
  const parsedOfferAmount = useMemo(() => parseEuroAmount(offerAmount, MAX_OFFER_CENTS), [offerAmount]);
  const parsedCounterAmount = useMemo(() => parseEuroAmount(counterAmount, MAX_OFFER_CENTS), [counterAmount]);
  const pendingOffer = useMemo(() => offers.find((offer) => offer.status === 'PENDING') ?? null, [offers]);
  const acceptedOffer = useMemo(() => [...offers].reverse().find((offer) => offer.status === 'ACCEPTED') ?? null, [offers]);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const [nextMessages, conversations, nextOffers] = await Promise.all([
        loadMyMarketplaceMessages(conversation.conversation_id),
        loadMyMarketplaceConversations(),
        loadMyMarketplaceOffers(conversation.conversation_id),
      ]);
      setMessages(nextMessages);
      setOffers(nextOffers);
      const currentConversation = conversations.find((entry) => entry.conversation_id === conversation.conversation_id);
      if (currentConversation) setStatus(currentConversation.status);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load conversation.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    setStatus(conversation.status);
    setAdoptedItemId(null);
    setFinalSalePrice('');
    setOfferAmount('');
    setOfferMessage('');
    setCounterAmount('');
    setCounterMessage('');
    setShowOfferComposer(conversation.role === 'BUYER' && conversation.status === 'OPEN');
    setShowCounterComposer(false);
    void refresh();
  }, [conversation.conversation_id, conversation.status]);

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

  async function submitOffer() {
    if (!parsedOfferAmount.valid || offerBusy || status !== 'OPEN' || pendingOffer) return;
    try {
      setOfferBusy(true); setError(null);
      await makeMyMarketplaceOffer(conversation.conversation_id, parsedOfferAmount.cents, offerMessage);
      setOfferAmount(''); setOfferMessage(''); setShowOfferComposer(false);
      await refresh();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not send offer.'); }
    finally { setOfferBusy(false); }
  }

  async function respondToOffer(action: 'ACCEPT' | 'DECLINE' | 'COUNTER') {
    if (!pendingOffer || pendingOffer.proposer_role !== 'OTHER' || offerBusy) return;
    if (action === 'COUNTER' && !parsedCounterAmount.valid) {
      setError('Enter a valid counter offer amount.');
      return;
    }
    try {
      setOfferBusy(true); setError(null);
      await respondToMyMarketplaceOffer(
        pendingOffer.offer_id,
        action,
        action === 'COUNTER' ? parsedCounterAmount.cents : null,
        action === 'COUNTER' ? counterMessage : null,
      );
      setCounterAmount(''); setCounterMessage(''); setShowCounterComposer(false);
      await refresh();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not respond to offer.'); }
    finally { setOfferBusy(false); }
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
    const formatted = euro(parsedFinalSalePrice.cents);
    Alert.alert('Mark this Thing as sold?', `Confirm that the real sale is complete at ${formatted}. This final price is stored separately from your asking price and may contribute anonymously to Things Market Value.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Mark as sold', style: 'destructive', onPress: () => void changeLifecycle('SOLD', parsedFinalSalePrice.cents) },
    ]);
  }

  const closed = status === 'SOLD' || status === 'CLOSED';
  const seller = conversation.role === 'SELLER';
  const buyer = conversation.role === 'BUYER';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}><TouchableOpacity accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Marketplace</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => void refresh()}><Text style={styles.refresh}>{loading ? '…' : '↻'}</Text></TouchableOpacity></View>
          <View style={styles.hero}><Text style={styles.eyebrow}>{buyer ? 'BUYING' : 'SELLING'}</Text><Text style={styles.title}>{title}</Text><Text style={styles.heroCopy}>Private listing chat. Exact addresses, account emails and private inventory details stay hidden.</Text><View style={styles.statusPill}><Text style={styles.statusText}>{status}</Text></View></View>

          {acceptedOffer ? <View style={styles.acceptedCard}><Text style={styles.acceptedEyebrow}>OFFER ACCEPTED</Text><Text style={styles.acceptedAmount}>{euro(acceptedOffer.amount_cents)}</Text><Text style={styles.copy}>This accepted offer reserved the Thing. It is not the final sale price until the seller confirms the completed sale.</Text></View> : null}

          {status === 'OPEN' ? <View style={styles.offerCard}>
            <View style={styles.offerHeader}><View><Text style={styles.offerEyebrow}>OFFERS</Text><Text style={styles.offerTitle}>{pendingOffer ? (pendingOffer.proposer_role === 'ME' ? 'Offer sent' : 'Offer received') : 'Agree on a price'}</Text></View>{pendingOffer ? <Text style={styles.offerAmount}>{euro(pendingOffer.amount_cents)}</Text> : null}</View>
            {loading ? <><ActivityIndicator /><Text accessibilityLiveRegion="polite" style={styles.copy}>Checking current offer status…</Text></> : pendingOffer ? <>
              <Text style={styles.copy}>{pendingOffer.proposer_role === 'ME' ? 'Waiting for the other person to respond. You cannot send another offer while this one is pending.' : 'Review the amount carefully. Accepting reserves the Thing; it does not mark the sale as completed.'}</Text>
              {pendingOffer.message ? <View style={styles.offerNote}><Text style={styles.offerNoteLabel}>Message</Text><Text style={styles.offerNoteText}>{pendingOffer.message}</Text></View> : null}
              {pendingOffer.proposer_role === 'OTHER' ? <>
                <View style={styles.offerActions}><TouchableOpacity accessibilityRole="button" disabled={offerBusy} style={[styles.acceptButton, offerBusy && styles.disabled]} onPress={() => void respondToOffer('ACCEPT')}><Text style={styles.acceptButtonText}>{offerBusy ? 'Updating…' : 'Accept'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={offerBusy} style={[styles.declineButton, offerBusy && styles.disabled]} onPress={() => void respondToOffer('DECLINE')}><Text style={styles.declineButtonText}>Decline</Text></TouchableOpacity></View>
                {!showCounterComposer ? <TouchableOpacity accessibilityRole="button" disabled={offerBusy} style={styles.counterButton} onPress={() => setShowCounterComposer(true)}><Text style={styles.counterButtonText}>Counter offer</Text></TouchableOpacity> : <View style={styles.offerComposer}><Text style={styles.priceLabel}>Your counter offer (€)</Text><TextInput accessibilityLabel="Counter offer amount" value={counterAmount} onChangeText={setCounterAmount} keyboardType="decimal-pad" placeholder="e.g. 85" style={styles.priceInput} /><Text style={styles.priceLabel}>Message (optional)</Text><TextInput accessibilityLabel="Counter offer message" value={counterMessage} onChangeText={setCounterMessage} maxLength={500} multiline placeholder="Add a short note" style={styles.offerMessageInput} /><Text style={styles.counter}>{counterMessage.length}/500</Text><TouchableOpacity accessibilityRole="button" disabled={offerBusy || !parsedCounterAmount.valid} style={[styles.primaryOfferButton, (offerBusy || !parsedCounterAmount.valid) && styles.disabled]} onPress={() => void respondToOffer('COUNTER')}><Text style={styles.primaryOfferButtonText}>{offerBusy ? 'Sending…' : parsedCounterAmount.valid ? `Send counter at ${euro(parsedCounterAmount.cents)}` : 'Enter a counter amount'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.cancelTextButton} onPress={() => setShowCounterComposer(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View>}
              </> : null}
            </> : !showOfferComposer ? <><Text style={styles.copy}>Send a clear price offer without sharing payment details, your address or other private information.</Text><TouchableOpacity accessibilityRole="button" style={styles.primaryOfferButton} onPress={() => setShowOfferComposer(true)}><Text style={styles.primaryOfferButtonText}>Make an offer</Text></TouchableOpacity></> : <View style={styles.offerComposer}><Text style={styles.priceLabel}>Your offer (€)</Text><TextInput accessibilityLabel="Offer amount" value={offerAmount} onChangeText={setOfferAmount} keyboardType="decimal-pad" placeholder="e.g. 80" style={styles.priceInput} /><Text style={styles.priceLabel}>Message (optional)</Text><TextInput accessibilityLabel="Offer message" value={offerMessage} onChangeText={setOfferMessage} maxLength={500} multiline placeholder="Add context for the seller" style={styles.offerMessageInput} /><Text style={styles.counter}>{offerMessage.length}/500</Text><View style={styles.privacyNote}><Text style={styles.privacyTitle}>Keep it private</Text><Text style={styles.priceHelp}>Do not include payment credentials, your exact address, phone number or private inventory details. The offer amount is separate from the seller’s asking price.</Text></View><TouchableOpacity accessibilityRole="button" disabled={offerBusy || !parsedOfferAmount.valid} style={[styles.primaryOfferButton, (offerBusy || !parsedOfferAmount.valid) && styles.disabled]} onPress={() => void submitOffer()}><Text style={styles.primaryOfferButtonText}>{offerBusy ? 'Sending…' : parsedOfferAmount.valid ? `Send offer of ${euro(parsedOfferAmount.cents)}` : 'Enter an offer amount'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.cancelTextButton} onPress={() => setShowOfferComposer(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View>}
          </View> : null}

          {seller && status === 'OPEN' ? <View style={styles.lifecycleCard}><Text style={styles.lifecycleTitle}>Reserve without accepting an offer</Text><Text style={styles.copy}>Use this only when you have agreed separately to hold the Thing for this buyer. No payment or purchase happens automatically.</Text><TouchableOpacity accessibilityRole="button" disabled={lifecycleBusy} style={[styles.lifecycleButton, lifecycleBusy && styles.disabled]} onPress={confirmReserve}><Text style={styles.lifecycleButtonText}>{lifecycleBusy ? 'Updating…' : 'Reserve for this buyer'}</Text></TouchableOpacity></View> : null}
          {seller && status === 'RESERVED' ? <View style={styles.lifecycleCard}><Text style={styles.lifecycleTitle}>Reserved for this buyer</Text><Text style={styles.copy}>The public listing is withdrawn. Keep using this chat to coordinate. Mark sold only after the real handover or sale is complete.</Text><Text style={styles.priceLabel}>Actual final sale price (€)</Text><TextInput accessibilityLabel="Actual final sale price" value={finalSalePrice} onChangeText={setFinalSalePrice} keyboardType="decimal-pad" placeholder={acceptedOffer ? `Accepted offer was ${euro(acceptedOffer.amount_cents)}` : 'e.g. 85'} style={styles.priceInput} /><Text style={styles.priceHelp}>This is the amount actually agreed and paid. It is stored separately from the asking price{acceptedOffer ? ' and accepted offer' : ''}.</Text><TouchableOpacity accessibilityRole="button" disabled={lifecycleBusy || !parsedFinalSalePrice.valid} style={[styles.soldButton, (lifecycleBusy || !parsedFinalSalePrice.valid) && styles.disabled]} onPress={confirmSold}><Text style={styles.soldButtonText}>{lifecycleBusy ? 'Updating…' : parsedFinalSalePrice.valid ? `Mark as sold at ${euro(parsedFinalSalePrice.cents)}` : 'Enter final price to mark as sold'}</Text></TouchableOpacity></View> : null}
          {buyer && status === 'SOLD' ? <View style={[styles.adoptionCard, adoptedItemId ? styles.adoptionSuccessCard : null]}>
            <Text style={adoptedItemId ? styles.successEyebrow : styles.adoptionEyebrow}>{adoptedItemId ? 'PURCHASE SAVED' : 'YOUR PURCHASE'}</Text>
            <Text style={adoptedItemId ? styles.successTitle : styles.lifecycleTitle}>{adoptedItemId ? 'Added to My Things' : 'Add your purchased Thing?'}</Text>
            <Text style={styles.copy}>{adoptedItemId ? 'Your purchased Thing is now saved privately. Seller notes, private location, serial data, photos and account details were not copied.' : 'Creates a new private Thing in My Things. Seller notes, private location, serial data, photos and account details are not copied.'}</Text>
            {adoptedItemId ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="View purchased Thing in My Things" style={styles.adoptionButton} onPress={() => viewPurchasedThingInInventory(adoptedItemId)}><Text style={styles.adoptionButtonText}>View in My Things</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity accessibilityRole="button" disabled={adoptionBusy} style={[styles.adoptionButton, adoptionBusy && styles.disabled]} onPress={() => void adoptPurchasedThing()}><Text style={styles.adoptionButtonText}>{adoptionBusy ? 'Adding…' : 'Add to My Things'}</Text></TouchableOpacity>
            )}
            {adoptedItemId ? <Text accessibilityLiveRegion="polite" style={styles.success}>Saved privately. Open My Things to review your purchase.</Text> : null}
          </View> : null}

          <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
            {loading && messages.length === 0 ? <ActivityIndicator /> : null}
            {!loading && messages.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.copy}>Start with a simple question about this listing.</Text>{buyer && !closed ? <TouchableOpacity accessibilityRole="button" style={styles.quickAction} onPress={() => setDraft(QUICK_MESSAGE)}><Text style={styles.quickActionText}>Use “Is this still available?”</Text></TouchableOpacity> : null}</View> : null}
            {messages.map((message) => { const mine = message.sender_role === 'ME'; return <View key={message.message_id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.messageBody, mine && styles.mineMessageBody]}>{message.body}</Text><Text style={[styles.time, mine && styles.mineTime]}>{new Date(message.created_at).toLocaleString()}</Text></View>; })}
          </ScrollView>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {closed ? <View style={styles.closed}><Text style={styles.closedTitle}>Conversation closed</Text><Text style={styles.copy}>New messages are disabled because this transaction is {status.toLowerCase()}.</Text></View> : <View style={styles.composer}><TextInput accessibilityLabel="Message about this Thing" value={draft} onChangeText={setDraft} placeholder="Message about this Thing" multiline maxLength={1200} style={styles.input} /><Text style={styles.counter}>{draft.length}/1200</Text><TouchableOpacity accessibilityRole="button" disabled={sending || !draft.trim()} style={[styles.sendButton, (sending || !draft.trim()) && styles.disabled]} onPress={() => void send()}><Text style={styles.sendText}>{sending ? 'Sending…' : 'Send'}</Text></TouchableOpacity></View>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:'#F6F7F9'},container:{flex:1,padding:20,gap:14},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{fontSize:16,fontWeight:'800',color:'#344054',paddingVertical:8},refresh:{fontSize:20,fontWeight:'800',color:'#344054',padding:8},hero:{backgroundColor:'#0F1728',borderRadius:24,padding:20,gap:8},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:'#98A2B3'},title:{fontSize:24,lineHeight:30,fontWeight:'800',color:'#FFFFFF'},heroCopy:{fontSize:13,lineHeight:19,color:'#C5CBD4'},copy:{fontSize:13,lineHeight:19,color:'#7A8494'},statusPill:{alignSelf:'flex-start',borderRadius:999,backgroundColor:'#243046',paddingHorizontal:10,paddingVertical:6},statusText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},acceptedCard:{backgroundColor:'#0F1728',borderRadius:20,padding:18,gap:7},acceptedEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#86EFAC'},acceptedAmount:{fontSize:27,fontWeight:'800',color:'#FFFFFF'},offerCard:{backgroundColor:'#FFFFFF',borderRadius:20,padding:17,gap:10,borderWidth:1,borderColor:'#E5E8ED'},offerHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:12},offerEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#667085'},offerTitle:{fontSize:19,lineHeight:24,fontWeight:'800',color:'#0F1728',marginTop:3},offerAmount:{fontSize:22,fontWeight:'800',color:'#0F1728'},offerNote:{backgroundColor:'#F8FAFC',borderRadius:14,padding:12,gap:4},offerNoteLabel:{fontSize:10,fontWeight:'800',letterSpacing:.8,color:'#98A2B3'},offerNoteText:{fontSize:13,lineHeight:19,color:'#344054'},offerActions:{flexDirection:'row',gap:9},acceptButton:{flex:1,borderRadius:14,backgroundColor:'#027A48',paddingVertical:12,alignItems:'center'},acceptButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},declineButton:{flex:1,borderRadius:14,borderWidth:1,borderColor:'#D0D5DD',paddingVertical:12,alignItems:'center'},declineButtonText:{color:'#475467',fontWeight:'800',fontSize:13},counterButton:{borderRadius:14,backgroundColor:'#EEF2FF',paddingVertical:12,alignItems:'center'},counterButtonText:{color:'#3448A5',fontWeight:'800',fontSize:13},offerComposer:{gap:8},offerMessageInput:{minHeight:74,maxHeight:120,borderWidth:1,borderColor:'#D0D5DD',borderRadius:14,paddingHorizontal:14,paddingVertical:11,fontSize:14,color:'#0F1728',backgroundColor:'#FFFFFF',textAlignVertical:'top'},privacyNote:{backgroundColor:'#F8FAFC',borderRadius:14,padding:12,gap:3},privacyTitle:{fontSize:12,fontWeight:'800',color:'#344054'},primaryOfferButton:{borderRadius:15,backgroundColor:'#0F1728',paddingVertical:14,alignItems:'center'},primaryOfferButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},cancelTextButton:{alignItems:'center',paddingVertical:7},cancelText:{fontSize:12,fontWeight:'800',color:'#667085'},lifecycleCard:{backgroundColor:'#FFFFFF',borderRadius:18,padding:16,gap:8,borderWidth:1,borderColor:'#E5E8ED'},lifecycleTitle:{fontSize:15,fontWeight:'800',color:'#0F1728'},lifecycleButton:{borderRadius:14,backgroundColor:'#3448A5',paddingVertical:12,alignItems:'center',marginTop:2},lifecycleButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},priceLabel:{fontSize:12,fontWeight:'800',color:'#344054',marginTop:4},priceInput:{minHeight:52,borderWidth:1,borderColor:'#D0D5DD',borderRadius:14,paddingHorizontal:14,fontSize:20,fontWeight:'800',color:'#0F1728',backgroundColor:'#FFFFFF'},priceHelp:{fontSize:11,lineHeight:17,color:'#667085'},soldButton:{borderRadius:14,backgroundColor:'#B42318',paddingVertical:12,alignItems:'center',marginTop:2},soldButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},adoptionCard:{backgroundColor:'#ECFDF3',borderRadius:20,padding:18,gap:9,borderWidth:1,borderColor:'#ABEFC6'},adoptionSuccessCard:{backgroundColor:'#FFFFFF',borderColor:'#D8E5DE'},adoptionEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#027A48'},successEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#027A48'},successTitle:{fontSize:20,lineHeight:25,fontWeight:'800',color:'#0F1728'},adoptionButton:{minHeight:48,borderRadius:15,backgroundColor:'#0F1728',paddingHorizontal:16,justifyContent:'center',alignItems:'center'},adoptionButtonText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},success:{fontSize:12,lineHeight:18,color:'#027A48',fontWeight:'700'},messageList:{flex:1},messageContent:{gap:10,paddingVertical:4},empty:{backgroundColor:'#FFFFFF',borderRadius:18,padding:18,gap:8,borderWidth:1,borderColor:'#E5E8ED'},emptyTitle:{fontSize:16,fontWeight:'800',color:'#0F1728'},quickAction:{alignSelf:'flex-start',borderRadius:999,backgroundColor:'#EEF2FF',paddingHorizontal:12,paddingVertical:8,marginTop:2},quickActionText:{fontSize:12,fontWeight:'800',color:'#3448A5'},bubble:{maxWidth:'84%',borderRadius:18,paddingHorizontal:14,paddingVertical:11,gap:5},mine:{alignSelf:'flex-end',backgroundColor:'#0F1728'},theirs:{alignSelf:'flex-start',backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E5E8ED'},messageBody:{fontSize:14,lineHeight:20,color:'#475467'},mineMessageBody:{color:'#FFFFFF'},time:{fontSize:10,color:'#98A2B3'},mineTime:{color:'#C5CBD4'},composer:{gap:8},input:{minHeight:58,maxHeight:120,backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#D0D5DD',paddingHorizontal:14,paddingVertical:12,fontSize:14,color:'#0F1728'},counter:{alignSelf:'flex-end',fontSize:10,color:'#98A2B3'},sendButton:{backgroundColor:'#0F1728',borderRadius:16,paddingVertical:14,alignItems:'center'},sendText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},disabled:{opacity:.45},error:{color:'#B42318',fontSize:12,lineHeight:18},closed:{backgroundColor:'#FFF7ED',borderRadius:16,padding:14,gap:4},closedTitle:{fontSize:14,fontWeight:'800',color:'#9A3412'}
});