import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const inventory = read('src/data/inventory.ts');
const auth = read('src/data/auth.ts');
const app = read('App.tsx');

// Ownership must remain authoritative and fail closed. A successful add must use the
// backend command, return a real item id, then the UI must reload authoritative state.
assert.match(inventory, /rpc\('load_my_inventory_market_states'\)/, 'inventory must load authoritative ownership/market state');
assert.match(inventory, /if \(marketStateResult\.error\)[\s\S]*will not show devices as currently owned/, 'ownership lookup must fail closed');
assert.match(inventory, /if \(!marketState\) return \[\];/, 'items without authoritative state must not be shown as owned');
assert.match(inventory, /if \(marketState === 'SOLD'\) return \[\];/, 'sold items must not remain in owned inventory');
assert.match(inventory, /rpc\('add_private_device'[\s\S]*p_variant_id: input\.variantId/, 'add-private must use the authenticated backend RPC');
assert.match(inventory, /if \(typeof data !== 'string'\) throw new Error\('Inventory command returned no item id\.'\)/, 'add-private must require a real item id');
assert.match(app, /await addPrivateDevice\(\{ variantId: selectedVariantId \}\);[\s\S]*await refreshData\(\);[\s\S]*Device saved privately/, 'UI must reload authoritative inventory after add-private succeeds');

// Email confirmation and password recovery must stay on the app deep-link scheme.
assert.match(auth, /const EMAIL_CONFIRM_REDIRECT = 'thingsalpha:\/\/auth\/confirmed';/, 'signup confirmation must redirect to the Things app');
assert.match(auth, /const PASSWORD_RESET_REDIRECT = 'thingsalpha:\/\/auth\/reset-password';/, 'password reset must redirect to the Things app');
assert.match(auth, /auth\.signUp\([\s\S]*emailRedirectTo: EMAIL_CONFIRM_REDIRECT/, 'signup must pass the confirmation deep link to Supabase');
assert.match(auth, /auth\.resend\([\s\S]*emailRedirectTo: EMAIL_CONFIRM_REDIRECT/, 'resend confirmation must preserve the app deep link');
assert.match(auth, /resetPasswordForEmail\([\s\S]*redirectTo: PASSWORD_RESET_REDIRECT/, 'password reset must preserve the app deep link');
assert.match(app, /url\.startsWith\('thingsalpha:\/\/auth\/reset-password'\)/, 'app must handle password-reset deep links');

console.log('release-critical ownership + auth redirect regression: ok');
