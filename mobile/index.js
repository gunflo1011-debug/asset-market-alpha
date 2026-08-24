import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import { ConciergeSmartphoneIntakeCard } from './src/ConciergeSmartphoneIntakeCard';
import { getSession, onAuthStateChange } from './src/data/auth';
import { loadConciergeDraft } from './src/data/conciergeDraft';
import { hasSupabaseConfig } from './src/lib/supabase';

function ThingsRoot() {
  const [authenticated, setAuthenticated] = useState(false);
  const [showConcierge, setShowConcierge] = useState(false);
  const [hasConciergeDraft, setHasConciergeDraft] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    let active = true;
    void getSession()
      .then((session) => {
        if (active) setAuthenticated(Boolean(session));
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });

    const unsubscribe = onAuthStateChange((session) => {
      setAuthenticated(Boolean(session));
      if (!session) setShowConcierge(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setHasConciergeDraft(false);
      return;
    }
    void loadConciergeDraft(AsyncStorage).then((draft) => setHasConciergeDraft(Boolean(draft)));
  }, [authenticated, showConcierge]);

  return (
    <View style={styles.root}>
      <App />
      {authenticated ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={hasConciergeDraft ? 'Continue saved phone sale draft' : 'Prepare a phone for a local buyer'}
          style={styles.floatingButton}
          onPress={() => setShowConcierge(true)}
        >
          <Text style={styles.floatingButtonText}>{hasConciergeDraft ? 'Continue draft' : 'Sell a phone'}</Text>
        </TouchableOpacity>
      ) : null}
      <Modal
        animationType="slide"
        visible={showConcierge}
        onRequestClose={() => setShowConcierge(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalEyebrow}>LOCAL CONCIERGE</Text>
              <Text style={styles.modalTitle}>{hasConciergeDraft ? 'Continue your phone draft' : 'Prepare your phone'}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={() => setShowConcierge(false)}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <ConciergeSmartphoneIntakeCard onDraftStateChange={setHasConciergeDraft} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: '#101828',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  floatingButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalSafe: { flex: 1, backgroundColor: '#F4F5F7' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
  },
  modalTitleWrap: { flex: 1 },
  modalEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#667085' },
  modalTitle: { marginTop: 2, fontSize: 20, fontWeight: '800', color: '#101828' },
  closeText: { fontSize: 15, fontWeight: '700', color: '#344054' },
  modalContent: { padding: 20, paddingBottom: 40 },
});

registerRootComponent(ThingsRoot);