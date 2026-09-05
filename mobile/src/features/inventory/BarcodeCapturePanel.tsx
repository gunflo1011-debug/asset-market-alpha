import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { isGtinLike, normalizeScannedProductCode, resolveBarcodeProduct, type ProductSuggestion } from '../../lib/barcodeProductResolver';

type Props = {
  onUseSuggestion: (suggestion: ProductSuggestion) => void;
  onEnterManually: () => void;
};

type ScanErrorKind = 'invalid_barcode' | 'no_match' | 'unsupported_qr' | 'lookup_failed';

type ScanError = {
  kind: ScanErrorKind;
  message: string;
};

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] as const;
const NUMERIC_PRODUCT_CODE_LENGTHS = new Set([8, 12, 13, 14]);
const LOOKUP_FAILED_MESSAGE = "Things couldn't look up this product right now. Check your connection and try again, or enter the item manually.";

function looksLikeNumericProductCode(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, '');
  return /^\d+$/.test(normalized) && NUMERIC_PRODUCT_CODE_LENGTHS.has(normalized.length);
}

function scanErrorTitle(kind: ScanErrorKind): string {
  if (kind === 'invalid_barcode') return 'Barcode could not be verified';
  if (kind === 'no_match') return 'No product match found';
  if (kind === 'unsupported_qr') return 'QR code not usable yet';
  return 'Lookup did not work';
}

export function BarcodeCapturePanel({ onUseSuggestion, onEnterManually }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<ProductSuggestion | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lastCaptureWasQr, setLastCaptureWasQr] = useState(false);

  async function lookup(code: string, symbology?: string) {
    const normalized = code.trim();
    if (!normalized) return;
    const normalizedProductCode = normalizeScannedProductCode(normalized, symbology);
    const capturedQr = symbology === 'qr';
    setScanned(true);
    setBusy(true);
    setError(null);
    setSuggestion(null);
    setLastCaptureWasQr(capturedQr);
    setLastCode(capturedQr ? null : normalizedProductCode);
    try {
      const result = await resolveBarcodeProduct(normalized, symbology);
      if (result) {
        setSuggestion(result);
      } else if (isGtinLike(normalizedProductCode)) {
        setError({
          kind: 'no_match',
          message: 'The barcode is valid, but Things could not find a reliable product match. You can add the item manually instead.',
        });
      } else if (symbology !== 'qr' && looksLikeNumericProductCode(normalized)) {
        setError({
          kind: 'invalid_barcode',
          message: 'The barcode was read, but its check digit is invalid. Scan it again or enter the item manually.',
        });
      } else {
        setError({
          kind: 'unsupported_qr',
          message: 'This QR code does not contain product data Things can safely use yet. Its contents were not sent to a product lookup provider.',
        });
      }
    } catch {
      setError({
        kind: 'lookup_failed',
        message: LOOKUP_FAILED_MESSAGE,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleScan(result: BarcodeScanningResult) {
    if (scanned || busy) return;
    void lookup(result.data, result.type);
  }

  function scanAgain() {
    setScanned(false);
    setSuggestion(null);
    setError(null);
    setLastCode(null);
    setLastCaptureWasQr(false);
  }

  if (!permission) return <View style={styles.center}><ActivityIndicator /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.title}>Scan a barcode</Text>
        <Text style={styles.copy}>Use the camera to read EAN, UPC or QR codes. Things only sends normal product barcodes to the lookup provider; arbitrary QR contents stay on your device.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Allow camera access for barcode scanning" style={styles.primaryButton} onPress={() => void requestPermission()}><Text style={styles.primaryButtonText}>Allow camera</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={onEnterManually}><Text style={styles.secondaryButtonText}>Enter manually instead</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.cameraFrame}>
        {!scanned ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={handleScan}
          />
        ) : (
          <View style={styles.scanPaused}>
            {busy ? <ActivityIndicator /> : null}
            <Text style={styles.scanPausedTitle}>{busy ? 'Looking up product…' : 'Code captured'}</Text>
            {lastCaptureWasQr ? <Text style={styles.codeText}>QR payload kept private</Text> : lastCode ? <Text numberOfLines={2} style={styles.codeText}>{lastCode}</Text> : null}
          </View>
        )}
      </View>

      <Text style={styles.hint}>Point the camera at the product barcode. You always review the suggested details before anything is saved.</Text>

      {suggestion ? (
        <View style={styles.resultCard}>
          <Text style={styles.eyebrow}>PRODUCT SUGGESTION · {suggestion.confidence.toUpperCase()} CONFIDENCE</Text>
          {suggestion.imageUrl ? <Image source={{ uri: suggestion.imageUrl }} style={styles.image} resizeMode="contain" /> : null}
          <Text style={styles.resultTitle}>{suggestion.title}</Text>
          {suggestion.brand ? <Text style={styles.meta}>Brand: {suggestion.brand}</Text> : null}
          {suggestion.model ? <Text style={styles.meta}>Model: {suggestion.model}</Text> : null}
          {suggestion.category ? <Text style={styles.meta}>Category: {suggestion.category}</Text> : null}
          <Text style={styles.meta}>Code: {suggestion.kind === 'gtin' ? suggestion.code : 'QR product data'}</Text>
          {suggestion.privateSerial ? <Text style={styles.privateNote}>Serial detected: kept private. It will not be published to Marketplace automatically.</Text> : null}
          <Text style={styles.disclaimer}>This is a lookup suggestion, not verified truth. Next, review and correct the prefilled fields before adding this Thing to your inventory.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => onUseSuggestion(suggestion)} accessibilityRole="button" accessibilityLabel="Review suggested Thing details"><Text style={styles.primaryButtonText}>Review suggested details</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={scanAgain} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Scan again</Text></TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard} accessibilityRole="alert">
          <Text style={styles.errorTitle}>{scanErrorTitle(error.kind)}</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          {error.kind === 'invalid_barcode' ? (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={scanAgain} accessibilityRole="button"><Text style={styles.primaryButtonText}>Scan again</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onEnterManually} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Enter item manually</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={onEnterManually} accessibilityRole="button"><Text style={styles.primaryButtonText}>Enter item manually</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={scanAgain} accessibilityRole="button"><Text style={styles.secondaryButtonText}>{error.kind === 'lookup_failed' ? 'Try scanning again' : 'Scan another code'}</Text></TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      <View style={styles.manualLookup}>
        <Text style={styles.manualLabel}>Or enter EAN / UPC</Text>
        <View style={styles.manualRow}>
          <TextInput value={manualCode} onChangeText={setManualCode} keyboardType="number-pad" placeholder="e.g. 4006381333931" style={styles.input} accessibilityLabel="EAN or UPC code" />
          <TouchableOpacity disabled={!manualCode.trim() || busy} style={[styles.lookupButton, (!manualCode.trim() || busy) && styles.disabled]} onPress={() => void lookup(manualCode)} accessibilityRole="button"><Text style={styles.lookupButtonText}>Look up</Text></TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={onEnterManually} accessibilityRole="button"><Text style={styles.manualLink}>Enter item manually</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  permissionCard: { gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F1728' },
  copy: { fontSize: 13, lineHeight: 19, color: '#667085' },
  cameraFrame: { height: 260, overflow: 'hidden', borderRadius: 18, backgroundColor: '#101828' },
  camera: { flex: 1 },
  scanPaused: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  scanPausedTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  codeText: { color: '#D0D5DD', textAlign: 'center', fontSize: 13 },
  hint: { fontSize: 12, lineHeight: 18, color: '#667085' },
  resultCard: { borderRadius: 16, borderWidth: 1, borderColor: '#D0D5DD', padding: 14, gap: 9, backgroundColor: '#FFFFFF' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: '#667085' },
  image: { width: '100%', height: 140, borderRadius: 12, backgroundColor: '#F2F4F7' },
  resultTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: '#101828' },
  meta: { fontSize: 13, lineHeight: 18, color: '#475467' },
  privateNote: { fontSize: 12, lineHeight: 18, color: '#027A48', backgroundColor: '#ECFDF3', borderRadius: 10, padding: 10 },
  disclaimer: { fontSize: 12, lineHeight: 18, color: '#667085' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#0F1728', paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  secondaryButtonText: { color: '#344054', fontSize: 14, fontWeight: '700' },
  errorCard: { padding: 14, gap: 10, borderRadius: 16, backgroundColor: '#FFF6F5', borderWidth: 1, borderColor: '#FECDCA' },
  errorTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: '#912018' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#B42318' },
  manualLookup: { gap: 7 },
  manualLabel: { fontSize: 12, fontWeight: '700', color: '#475467' },
  manualRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 14, color: '#101828' },
  lookupButton: { minWidth: 86, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#344054' },
  lookupButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  manualLink: { textAlign: 'center', paddingVertical: 8, minHeight: 44, color: '#344054', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});