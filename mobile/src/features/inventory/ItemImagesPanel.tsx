import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { deleteMyItemImage, loadMyItemImages, setMyItemPrimaryImage, uploadMyItemImage, type ItemImage } from '../../data/itemImages';

type Props = { itemId: string };

export function ItemImagesPanel({ itemId }: Props) {
  const [images, setImages] = useState<ItemImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setImages(await loadMyItemImages(itemId));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load photos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [itemId]);

  async function addPhoto() {
    if (busy || images.length >= 8) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('Photo access is required to add an image.');
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
      setMessage(null);
      const asset = result.assets[0];
      await uploadMyItemImage(itemId, asset.uri, asset.mimeType);
      await refresh();
      setMessage('Photo added privately.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add photo.');
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(imageId: string) {
    if (busy) return;
    try {
      setBusy(true);
      await setMyItemPrimaryImage(itemId, imageId);
      await refresh();
      setMessage('Cover photo updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update cover photo.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(image: ItemImage) {
    Alert.alert('Delete photo?', 'This removes the photo from this Thing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(image) },
    ]);
  }

  async function remove(image: ItemImage) {
    if (busy) return;
    try {
      setBusy(true);
      await deleteMyItemImage(itemId, image.id);
      await refresh();
      setMessage('Photo deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>PHOTOS</Text>
          <Text style={styles.title}>Thing photos</Text>
          <Text style={styles.copy}>Private by default. Up to 8 photos per Thing.</Text>
        </View>
        <TouchableOpacity disabled={busy || images.length >= 8} style={[styles.addButton, (busy || images.length >= 8) && styles.disabled]} onPress={() => void addPhoto()}>
          <Text style={styles.addButtonText}>{busy ? '…' : '+ Photo'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator /> : null}
      {!loading && images.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No photos yet</Text><Text style={styles.copy}>Add a clear photo so this Thing is easier to recognize later.</Text></View> : null}

      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
          {images.map((image) => (
            <View key={image.id} style={styles.photoCard}>
              <Image source={{ uri: image.signedUrl }} style={styles.photo} resizeMode="cover" />
              {image.isPrimary ? <View style={styles.coverPill}><Text style={styles.coverPillText}>COVER</Text></View> : null}
              <View style={styles.actions}>
                {!image.isPrimary ? <TouchableOpacity disabled={busy} onPress={() => void makePrimary(image.id)}><Text style={styles.actionText}>Make cover</Text></TouchableOpacity> : <Text style={styles.coverText}>Cover photo</Text>}
                <TouchableOpacity disabled={busy} onPress={() => confirmDelete(image)}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {images.length >= 8 ? <Text style={styles.limit}>8-photo limit reached.</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
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
  addButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1728' },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  empty: { backgroundColor: '#F8F9FB', borderRadius: 16, padding: 14, gap: 4 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#344054' },
  gallery: { gap: 12, paddingRight: 4 },
  photoCard: { width: 190, gap: 8 },
  photo: { width: 190, height: 150, borderRadius: 16, backgroundColor: '#EEF0F3' },
  coverPill: { position: 'absolute', top: 9, left: 9, backgroundColor: '#0F1728', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  coverPillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actionText: { fontSize: 12, fontWeight: '800', color: '#344054' },
  coverText: { fontSize: 12, fontWeight: '800', color: '#027A48' },
  deleteText: { fontSize: 12, fontWeight: '800', color: '#B42318' },
  limit: { fontSize: 11, color: '#7A8494' },
  message: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#344054' },
});
