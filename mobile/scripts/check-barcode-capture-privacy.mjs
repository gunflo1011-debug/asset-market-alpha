import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync(new URL('../src/features/inventory/BarcodeCapturePanel.tsx', import.meta.url), 'utf8');
const resolver = fs.readFileSync(new URL('../src/lib/barcodeProductResolver.ts', import.meta.url), 'utf8');

assert.match(panel, /const capturedQr = symbology === 'qr';/, 'capture must distinguish QR from product barcodes');
assert.match(panel, /setLastCode\(capturedQr \? null : normalizedProductCode\);/, 'raw QR payload must never enter the visible captured-code state');
assert.match(panel, /lastCaptureWasQr \? <Text[^>]*>QR payload kept private<\/Text>/, 'paused QR capture must show a privacy-safe acknowledgement');
assert.match(panel, /setLastCaptureWasQr\(false\);/, 'Scan again must clear QR privacy display state');

const localOnlyGuard = "if (!isGtinLike(code)) return parseQrProductData(rawCode);";
const guardIndex = resolver.indexOf(localOnlyGuard);
const upcProviderIndex = resolver.indexOf('await resolveWithUpcItemDb(code)');
const openFactsIndex = resolver.indexOf('await resolveWithOpenFacts(code)');
assert.ok(guardIndex >= 0, 'non-GTIN captures must be routed to local QR parsing');
assert.ok(upcProviderIndex > guardIndex, 'UPC provider lookup must only happen after the non-GTIN local-only guard');
assert.ok(openFactsIndex > guardIndex, 'Open Facts lookup must only happen after the non-GTIN local-only guard');
assert.match(resolver, /Non-URL QR payloads are deliberately kept local and are not sent to a lookup provider\./, 'resolver must retain its arbitrary-QR local-only contract');

console.log('barcode capture privacy contract: 8 assertions passed');
