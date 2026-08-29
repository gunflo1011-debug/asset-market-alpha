import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const inventory = [
  read('src/data/inventory.ts'),
  read('src/data/inventoryQueries.ts'),
  read('src/data/inventoryCommands.ts'),
].join('\n');
const auth = read('src/data/auth.ts');
const app = read('App.tsx');

assert.match(inventory, /rpc\(['"]load_my_inventory_market_states['"]\)/, 'inventory must load authoritative ownership/market state');
assert.match(
  inventory,
  /if\s*\(\s*isCatalogDevice\s*&&\s*marketStateResult\.error\s*\)\s*return\s*\[\]/s,
  'catalog-backed device ownership lookup must fail closed',
);
assert.match(
  inventory,
  /const\s+state\s*=\s*marketStates\.get\(item\.id\)\s*\?\?\s*null\s*;\s*if\s*\(\s*isCatalogDevice\s*&&\s*!state\s*\)\s*return\s*\[\]\s*;\s*if\s*\(\s*state\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s,
  'catalog-backed devices without authoritative state and SOLD items must not be shown as owned',
);
assert.match(inventory, /rpc\(['"]add_private_device['"][\s\S]*p_variant_id\s*:\s*input\.variantId/, 'add-private must use the authenticated backend RPC');
assert.match(inventory, /if\s*\(\s*typeof\s+data\s*!==\s*['"]string['"]\s*\)\s*throw\s+new\s+Error\(['"]Inventory command returned no item id\.['"]\)/, 'add-private must require a real item id');
assert.match(
  app,
  /await\s+addPrivateDevice\(\{\s*variantId\s*:\s*selectedVariantId\s*\}\);[\s\S]*await\s+refreshInventory\(\s*expectedUserId\s*\);/,
  'UI must reload authoritative inventory for the initiating account after add-private succeeds',
);

assert.match(auth, /const\s+EMAIL_CONFIRM_REDIRECT\s*=\s*['"]thingsalpha:\/\/auth\/confirmed['"];/, 'signup confirmation must redirect to the Things app');
assert.match(auth, /const\s+PASSWORD_RESET_REDIRECT\s*=\s*['"]thingsalpha:\/\/auth\/reset-password['"];/, 'password reset must redirect to the Things app');
assert.match(auth, /auth\.signUp\([\s\S]*emailRedirectTo\s*:\s*EMAIL_CONFIRM_REDIRECT/, 'signup must pass the confirmation deep link to Supabase');
assert.match(auth, /auth\.resend\([\s\S]*emailRedirectTo\s*:\s*EMAIL_CONFIRM_REDIRECT/, 'resend confirmation must preserve the app deep link');
assert.match(auth, /resetPasswordForEmail\([\s\S]*redirectTo\s*:\s*PASSWORD_RESET_REDIRECT/, 'password reset must preserve the app deep link');
assert.match(app, /url\.startsWith\(['"]thingsalpha:\/\/auth\/reset-password['"]\)/, 'app must handle password-reset deep links');

console.log('release-critical ownership + auth redirect regression: ok');
