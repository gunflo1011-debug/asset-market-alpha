import fs from 'node:fs';
import assert from 'node:assert/strict';

const commands = fs.readFileSync(new URL('../src/data/inventoryCommands.ts', import.meta.url), 'utf8');
const inventoryScreen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');
const capturePanel = fs.readFileSync(new URL('../src/features/inventory/BarcodeCapturePanel.tsx', import.meta.url), 'utf8');
const resolver = fs.readFileSync(new URL('../src/lib/barcodeProductResolver.ts', import.meta.url), 'utf8');
const gtin = fs.readFileSync(new URL('../src/lib/gtin.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260902132000_gtin_checksum_hardening_v1.sql', import.meta.url), 'utf8');

assert.match(inventoryScreen, /suggestion\.kind === 'gtin' \? `GTIN\/UPC: \$\{suggestion\.code\}`/,
  'confirmed scan flow must carry the exact scanned GTIN into the user-editable confirmation form');
assert.match(commands, /extractConfirmedGtinFromNotes/,
  'inventory commands must extract a confirmed GTIN only from the saved confirmation payload');
assert.match(commands, /client\.rpc\('set_my_item_gtin_v1',[\s\S]*p_item_id: data,[\s\S]*p_gtin: confirmedGtin,[\s\S]*p_source: 'BARCODE_SCAN'/,
  'newly saved Things must persist confirmed scanned GTIN through the private owner-scoped RPC');
assert.match(commands, /if \(identityError\) console\.warn/,
  'post-save GTIN enrichment failure must not turn a successfully created Thing into an apparent failed add');
assert.doesNotMatch(commands, /if \(identityError\) throw identityError/,
  'post-save identity enrichment must not encourage duplicate Thing creation after the primary save succeeded');

assert.match(gtin, /export function isValidGtin/,
  'mobile GTIN handling must have a dedicated checksum validator');
assert.match(gtin, /calculatedCheckDigit === expectedCheckDigit/,
  'mobile GTIN validation must enforce the standard check digit, not just numeric length');
assert.match(gtin, /export function expandUpcEToUpcA/,
  'UPC-E must be expanded before applying canonical GTIN-12 validation');
assert.match(gtin, /symbology === 'upc_e'[\s\S]*expandUpcEToUpcA/,
  'scanner symbology must control UPC-E normalization rather than treating it as EAN-8');
assert.match(capturePanel, /lookup\(result\.data, result\.type\)/,
  'camera scans must preserve Expo barcode symbology through lookup');
assert.match(resolver, /normalizeScannedProductCode\(rawCode, symbology\)/,
  'resolver must canonicalize scanner-specific product codes before lookup');
assert.match(capturePanel, /check digit is invalid[\s\S]*Scan it again or enter the code manually/,
  'checksum-invalid numeric product codes must not be mislabeled as QR payloads');
assert.match(resolver, /return isValidGtin\(value\)/,
  'lookup eligibility must require checksum-valid GTINs before any external provider call');
assert.match(migration, /private\.is_valid_gtin_v1\(v_gtin\)/,
  'authoritative GTIN persistence must independently enforce checksum validity');
assert.match(migration, /ITEM_NOT_OWNED/,
  'checksum hardening must retain owner isolation at the RPC boundary');
assert.match(migration, /revoke all on function private\.is_valid_gtin_v1\(text\) from public, anon, authenticated/,
  'internal checksum helper must not become a new client-callable surface');

// Review regression vector: UPC-E 04252614 expands to checksum-valid UPC-A 042100005264.
function expandUpcEReference(upcE) {
  const numberSystem = upcE[0];
  const [d1, d2, d3, d4, d5, d6] = upcE.slice(1, 7).split('');
  const checkDigit = upcE[7];
  let body;
  if (d6 === '0' || d6 === '1' || d6 === '2') body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${numberSystem}${body}${checkDigit}`;
}
assert.equal(expandUpcEReference('04252614'), '042100005264',
  'UPC-E reference expansion must remain compatible with canonical UPC-A/GTIN-12 persistence');

console.log('structured GTIN mobile wiring regression: OK');
