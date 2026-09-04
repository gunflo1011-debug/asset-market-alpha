import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { loadPrivateInventory } from '../../data/inventory';
import { deleteMyItemImage, loadMyItemImages, setMyItemMarketplaceVisibility, setMyItemPrimaryImage, uploadMyItemImage, type ItemImage } from '../../data/itemImages';

type Props = { itemId: string };

type Notice = { tone: 'info' | 'error'; text: string } | null;
type TransactionPhotoState = 'checking' | 'editable' | 'locked' | 'unknown';

export function ItemImagesPanel({ itemId }: Props) {
  const [images, setImages] = useState<ItemImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [transactionPhotoState, setTransactionPhotoState] = useState<TransactionPhotoState>('checking');

  async function refresh() {
    try {
      setLoading(true);
      setLoadFailed(false);
      setTransactionPhotoState('checking');
      setImages(await loadMyItemImages(itemId));

      try {
        const inventory = await loadPrivateInventory();
        const item = inventory.find((candidate) => candidate.id === itemId);
        if (!item) {
          setTransactionPhotoState('unknown');
        } else {
          setTransactionPhotoState(item.market_state === 'RESERVED' || item.market_state === 'SOLD' ? 'locked' : 'editable');
        }
      } catch {
        setTransactionPhotoState('unknown');
      }
    } catch {
      setLoadFailed(true);
      setTransactionPhotoState('unknown');
      setNotice({ tone: 'error', text: 'We couldn’t load this Thing’s photos. Your private images have not been changed.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [itemId]);

  async function addPhoto() {
    if (busy || images.length >= 8) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice({ tone: 'error', text: 'Allow photo-library access to choose a photo for this Thing.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      setBusy(true);
      setNotice(null);
      const asset = result.assets[0];
      await uploadMyItemImage(itemId, asset.uri, asset.mimeType);
      await refresh();
      setNotice({ tone: 'info', text: 'Photo added privately. It is not visible in Marketplace unless you select it for a listing.' });
    } catch {
      setNotice({ tone: 'error', text: 'We couldn’t add that photo. Nothing was published or changed in Marketplace.' });
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(imageId: string) {
    if (busy) return;
    try {
      setBusy(true);
      setNotice(null);
      await setMyItemPrimaryImage(itemId, imageId);
      await refresh();
      setNotice({ tone: 'info', text: 'Cover photo updated.' });
    } catch {
      setNotice({ tone: 'error', text: 'We couldn’t update the cover photo. Your current cover is unchanged.' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleMarketplace(image: ItemImage) {
    if (busy || transactionPhotoState !== 'editable') return;
    try {
      setBusy(true);
      setNotice(null);
      await setMyItemMarketplaceVisibility(itemId, image.id, !image.marketplaceVisible);
      await refresh();
      setNotice(image.marketplaceVisible
        ? { tone: 'info', text: 'Photo removed from Marketplace selection.' }
        : { tone: 'info', text: 'Photo selected for Marketplace. Selection alone does not publish the photo.' });
    } catch {
      setNotice({ tone: 'error', text: 'We couldn’t change this photo’s Marketplace selection. Its previous privacy state is unchanged.' });
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(image: ItemImage) {
    if (transactionPhotoState !== 'editable') return;
    Alert.alert('Delete photo?', 'This permanently removes the photo from this Thing. If it was selected for Marketplace, that selection is removed too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(image) },
    ]);
  }

  async function remove(image: ItemImage) {
    if (busy || transactionPhotoState !== 'editable') return;
    try {
      setBusy(true);
      setNotice(null);
      await deleteMyItemImage(itemId, image.id);
      await refresh();
      setNotice({ tone: 'info', text: 'Photo deleted from this Thing.' });
    } catch {
      setNotice({ tone: 'error', text: 'We couldn’t finish deleting this photo. Refresh before trying again.' });
    } finally {
      setBusy(false);
    }
  }

  const marketplaceCount = images.filter((image) => image.marketplaceVisible).length;
  const transactionLocked = transactionPhotoState === 'locked';
  const transactionActionsDisabled = transactionPhotoState !== 'editable';
  const transactionStatusCopy = transactionLocked
    ? 'These Marketplace photos are kept unchanged after reservation so both sides retain the same transaction context.'
    : 'Photo editing is temporarily unavailable while Things verifies this sale’s status. Your photos are unchanged.';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>PHOTOS</Text>
          <Text style={styles.title}>Thing photos</Text>
          <Text style={styles.copy}>Private by default. Add up to 8 photos, then explicitly choose up to 6 that may appear in a Marketplace listing.</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={images.length >= 8 ? 'Photo limit reached' : 'Add a private Thing photo'}
          accessibilityState={{ disabled: busy || images.length >= 8, busy }}
          disabled={busy || images.length >= 8}
          style={[styles.addButton, (busy || images.length >= 8) && styles.disabled]}
          onPress={() => void addPhoto()}
        >
          <Text style={styles.addButtonText}>{busy ? '…' : '+ Photo'}</Text>
        </TouchableOpacity>
      </View>

      {transactionPhotoState === 'locked' || transactionPhotoState === 'unknown' ? (
        <View accessibilityRole={transactionPhotoState === 'unknown' ? 'alert' : undefined} style={[styles.lockState, transactionPhotoState === 'unknown' && styles.lockStateUnknown]}>
          <Text style={styles.lockTitle}>{transactionLocked ? 'Photos locked for this sale' : 'Checking sale status'}</Text>
          <Text style={styles.lockCopy}>{transactionStatusCopy}</Text>
        </View>
      ) : null}

      {marketplaceCount > 0 ? (
        <View style={styles.marketSummary}>
          <Text style={styles.marketSummaryTitle}>{marketplaceCount} selected for Marketplace</Text>
          <Text style={styles.copy}>{transactionLocked ? 'This selected set is now frozen for the reserved or completed sale.' : 'Selected does not mean public. Photos are only exposed through the listing flow.'}</Text>
        </View>
      ) : null}

      {loading ? (
        <View accessibilityLiveRegion="polite" style={styles.loadingState}>
          <ActivityIndicator />
          <Text style={styles.copy}>Loading your private photos…</Text>
        </View>
      ) : null}

      {!loading && loadFailed ? (
        <View accessibilityRole="alert" style={styles.errorState}>
          <Text style={styles.errorTitle}>Photos unavailable</Text>
          <Text style={styles.copy}>We couldn’t load this Thing’s private photos. Nothing has been published or removed.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading Thing photos" style={styles.retryButton} onPress={() => void refresh()}>
            <Text style={styles.retryButtonText}>Retry loading photos</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !loadFailed && images.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.copy}>Add a clear private photo so this Thing is easier to recognize later.</Text>
        </View>
      ) : null}

      {!loadFailed && images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery} accessibilityLabel="Thing photo gallery">
          {images.map((image, index) => {
            const marketplaceDisabled = busy || transactionActionsDisabled || (!image.marketplaceVisible && marketplaceCount >= 6);
            return (
              <View key={image.id} style={styles.photoCard}>
                <Image
                  accessible
                  accessibilityLabel={`Thing photo ${index + 1}${image.isPrimary ? ', cover photo' : ''}${image.marketplaceVisible ? ', selected for Marketplace' : ', private only'}`}
                  source={{ uri: image.signedUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                {image.isPrimary ? <View style={styles.coverPill}><Text style={styles.coverPillText}>COVER</Text></View> : null}
                {image.marketplaceVisible ? <View style={styles.marketPill}><Text style={styles.marketPillText}>MARKETPLACE</Text></View> : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={image.marketplaceVisible ? `Remove photo ${index + 1} from Marketplace selection` : `Select photo ${index + 1} for Marketplace`}
                  accessibilityHint={transactionActionsDisabled ? transactionStatusCopy : 'Selection alone does not publish the photo'}
                  accessibilityState={{ disabled: marketplaceDisabled, busy }}
                  disabled={marketplaceDisabled}
                  style={[styles.marketButton, marketplaceDisabled && styles.disabled]}
                  onPress={() => void toggleMarketplace(image)}
                >
                  <Text style={styles.marketButtonText}>{image.marketplaceVisible ? 'Remove from listing' : 'Use in listing'}</Text>
                </TouchableOpacity>
                <View style={styles.actions}>
                  {!image.isPrimary ? (
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Make photo ${index + 1} the cover photo`} disabled={busy} style={styles.textAction} onPress={() => void makePrimary(image.id)}>
                      <Text style={styles.actionText}>Make cover</Text>
                    </TouchableOpacity>
                  ) : <Text style={styles.coverText}>Cover photo</Text>}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Delete photo ${index + 1}`}
                    accessibilityHint={transactionActionsDisabled ? transactionStatusCopy : 'Permanently removes this photo from the Thing'}
                    accessibilityState={{ disabled: busy || transactionActionsDisabled, busy }}
                    disabled={busy || transactionActionsDisabled}
                    style={[styles.textAction, transactionActionsDisabled && styles.disabled]}
                    onPress={() => confirmDelete(image)}
                  >
                    <Text style={[styles.deleteText, transactionActionsDisabled && styles.disabledActionText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {images.length >= 8 ? <Text style={styles.limit}>8-photo limit reached. Delete a photo before adding another.</Text> : null}
      {marketplaceCount >= 6 && !transactionActionsDisabled ? <Text style={styles.limit}>6 Marketplace photos selected. Remove one before selecting another.</Text> : null}
      {notice ? <Text accessibilityRole={notice.tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.message, notice.tone === 'error' && styles.errorMessage]}>{notice.text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E5E8ED' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#7A8494' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: '#0F1728', marginTop: 4 },
  copy: { fontSize: 12, lineHeight: 18, color: '#7A8494' },
  addButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1728' },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  disabledActionText: { color: '#98A2B3' },
  lockState: { backgroundColor: '#F2F4F7', borderRadius: 14, padding: 13, gap: 4, borderWidth: 1, borderColor: '#D0D5DD' },
  lockStateUnknown: { backgroundColor: '#FFFAEB', borderColor: '#FEDF89' },
  lockTitle: { fontSize: 13, fontWeight: '800', color: '#0F1728' },
  lockCopy: { fontSize: 12, lineHeight: 18, color: '#667085' },
  marketSummary: { backgroundColor: '#ECFDF3', borderRadius: 14, padding: 12, gap: 2 },
  marketSummaryTitle: { fontSize: 13, fontWeight: '800', color: '#027A48' },
  loadingState: { minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorState: { backgroundColor: '#FFF7F5', borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: '#F7D7D0' },
  errorTitle: { fontSize: 14, fontWeight: '800', color: '#B42318' },
  retryButton: { minHeight: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  retryButtonText: { fontSize: 13, fontWeight: '800', color: '#344054' },
  empty: { backgroundColor: '#F8F9FB', borderRadius: 16, padding: 14, gap: 4 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#344054' },
  gallery: { gap: 12, paddingRight: 4 },
  photoCard: { width: 190, gap: 8 },
  photo: { width: 190, height: 150, borderRadius: 16, backgroundColor: '#EEF0F3' },
  coverPill: { position: 'absolute', top: 9, left: 9, backgroundColor: '#0F1728', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  coverPillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  marketPill: { position: 'absolute', top: 9, right: 9, backgroundColor: '#ECFDF3', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  marketPillText: { color: '#027A48', fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  marketButton: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F7F3' },
  marketButtonText: { fontSize: 12, fontWeight: '800', color: '#027A48' },
  actions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  textAction: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12, fontWeight: '800', color: '#344054' },
  coverText: { fontSize: 12, fontWeight: '800', color: '#027A48' },
  deleteText: { fontSize: 12, fontWeight: '800', color: '#B42318' },
  limit: { fontSize: 11, lineHeight: 16, color: '#7A8494' },
  message: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#344054' },
  errorMessage: { color: '#B42318' },
});
