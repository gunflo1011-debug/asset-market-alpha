import fs from 'node:fs';
import assert from 'node:assert/strict';

const commands = fs.readFileSync(new URL('../src/data/inventoryCommands.ts', import.meta.url), 'utf8');
const inventoryScreen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');
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
assert.match(resolver, /return isValidGtin\(value\)/,
  'lookup eligibility must require checksum-valid GTINs before any external provider call');
assert.match(migration, /private\.is_valid_gtin_v1\(v_gtin\)/,
  'authoritative GTIN persistence must independently enforce checksum validity');
assert.match(migration, /ITEM_NOT_OWNED/,
  'checksum hardening must retain owner isolation at the RPC boundary');
assert.match(migration, /revoke all on function private\.is_valid_gtin_v1\(text\) from public, anon, authenticated/,
  'internal checksum helper must not become a new client-callable surface');

console.log('structured GTIN mobile wiring regression: OK');
