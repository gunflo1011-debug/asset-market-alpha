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
const authScreen = read('src/features/auth/AuthScreen.tsx');
const app = read('App.tsx');
const marketplaceScreen = read('src/features/marketplace/MarketplaceScreen.tsx');
const marketplaceConversation = read('src/features/marketplace/MarketplaceConversationScreen.tsx');
const marketplaceConsumerErrors = read('src/features/marketplace/consumerErrors.ts');
const itemImages = read('src/features/inventory/ItemImagesPanel.tsx');
const inventoryMarketState = read('src/data/inventoryMarketState.ts');
const barcodeCapture = read('src/features/inventory/BarcodeCapturePanel.tsx');

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
assert.match(
  app,
  /setMessage\(['"]If an account exists for this email, a reset link has been sent\.['"]\)/,
  'password-reset success copy must not reveal whether an account exists',
);
assert.match(
  authScreen,
  /const disabled = busy \|\| password\.length < 8 \|\| password !== confirmPassword;/,
  'password recovery UI must block short or mismatched passwords before submit',
);
assert.match(
  app,
  /if \(password\.length < 8\)[\s\S]*if \(password !== confirmPassword\)[\s\S]*await updateRecoveredPassword\(password\)/,
  'password recovery handler must enforce length and match before updating credentials',
);

assert.match(
  barcodeCapture,
  /const LOOKUP_FAILED_MESSAGE = ["']Things couldn't look up this product right now\. Check your connection and try again, or enter the item manually\.["'];/,
  'barcode provider/runtime failures must use stable consumer copy',
);
assert.match(
  barcodeCapture,
  /catch\s*\{[\s\S]*kind:\s*['"]lookup_failed['"][\s\S]*message:\s*LOOKUP_FAILED_MESSAGE/,
  'barcode lookup failures must not render the caught provider/runtime error',
);
assert.doesNotMatch(
  barcodeCapture,
  /lookupError\.message/,
  'raw barcode lookup error messages must never be rendered to users',
);
assert.match(barcodeCapture, /Try scanning again/, 'barcode lookup failure must keep a retry route');
assert.match(barcodeCapture, /Enter item manually/, 'barcode lookup failure must keep a manual-entry escape route');
assert.match(
  barcodeCapture,
  /capturedQr \? null : normalizedProductCode/,
  'arbitrary QR payloads must remain excluded from visible retained product-code state',
);

for (const [internalStatus, consumerLabel] of [['OPEN', 'Open'], ['RESERVED', 'Reserved'], ['SOLD', 'Sold'], ['CLOSED', 'Closed']]) {
  assert.match(
    marketplaceConversation,
    new RegExp(`${internalStatus}: ['\"]${consumerLabel}['\"]`),
    `Marketplace chat must present ${internalStatus} as consumer label ${consumerLabel}`,
  );
  assert.match(
    marketplaceScreen,
    new RegExp(`case ['\"]${internalStatus}['\"]: return ['\"]${consumerLabel}['\"]`),
    `Marketplace activity must present ${internalStatus} as consumer label ${consumerLabel}`,
  );
}
assert.match(
  marketplaceConversation,
  /STATUS_LABELS\[status\]/,
  'Marketplace chat status pill must render the presentation label rather than the backend enum',
);
assert.match(
  marketplaceScreen,
  /conversationStatusLabel\(conversation\.status\)/,
  'Marketplace transaction rows must render the presentation label rather than the backend enum',
);
assert.match(
  marketplaceScreen,
  /selected\.image_urls\.length > 0[\s\S]*No public photos[\s\S]*<View style=\{styles\.detailHero\}>/,
  'Marketplace listing detail must lead with public photos or the explicit no-photo state before listing metadata',
);
assert.match(
  marketplaceScreen,
  /selected\.image_urls\.map\(/,
  'Marketplace detail must keep seller-selected public image URLs as its image source',
);
assert.match(
  marketplaceConversation,
  /status === ['"]SOLD['"][\s\S]*Sale complete\.[\s\S]*confirmed final price is the amount actually paid\./,
  'SOLD accepted-offer copy must treat final price as authoritative and accepted offer as history',
);
assert.doesNotMatch(
  marketplaceConversation,
  /status === ['"]SOLD['"][\s\S]{0,220}not the final sale price until the seller confirms/,
  'SOLD copy must never say final sale confirmation is still pending',
);
assert.match(
  marketplaceConversation,
  /marketplaceFailureMessage\(['"]LOAD_CONVERSATION['"]\)/,
  'Marketplace conversation load failures must use consumer-safe copy',
);
assert.match(
  marketplaceConversation,
  /marketplaceFailureMessage\(['"]SEND_MESSAGE['"]\)/,
  'Marketplace message failures must use consumer-safe copy',
);
assert.match(
  marketplaceConversation,
  /marketplaceFailureMessage\(['"]UPDATE_OFFER['"]\)/,
  'Marketplace offer failures must use consumer-safe copy',
);
assert.match(
  marketplaceConversation,
  /marketplaceFailureMessage\(['"]UPDATE_SALE['"]\)/,
  'Marketplace sale lifecycle failures must use consumer-safe copy',
);
assert.match(
  marketplaceConversation,
  /marketplaceFailureMessage\(['"]ADOPT_PURCHASE['"]\)/,
  'Marketplace purchase adoption failures must use consumer-safe copy',
);
assert.doesNotMatch(
  marketplaceConversation,
  /nextError\.message|Error\s*\?\s*[^:]*\.message/,
  'raw Marketplace exception messages must never be rendered to users',
);
for (const copy of [
  "Things couldn't load this conversation right now. Check your connection and try again.",
  "Message wasn't sent. Check your connection and try again.",
  "Things couldn't update this offer right now. Try again.",
  "Things couldn't update this sale right now. Try again.",
  "Things couldn't add this purchase to My Things right now. Try again.",
]) {
  assert.match(marketplaceConsumerErrors, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `consumer-safe Marketplace copy must remain stable: ${copy}`);
}
assert.match(
  marketplaceConversation,
  /await sendMyMarketplaceMessage[\s\S]*setDraft\(['"]['"]\)/,
  'message draft must only clear after send succeeds',
);
assert.match(
  marketplaceConversation,
  /await makeMyMarketplaceOffer[\s\S]*setOfferAmount\(['"]['"]\)[\s\S]*setOfferMessage\(['"]['"]\)/,
  'offer input must only clear after offer succeeds',
);
assert.match(
  marketplaceConversation,
  /await respondToMyMarketplaceOffer[\s\S]*setCounterAmount\(['"]['"]\)[\s\S]*setCounterMessage\(['"]['"]\)/,
  'counter-offer input must only clear after response succeeds',
);

assert.match(
  inventoryMarketState,
  /rpc\(['"]load_my_inventory_market_states['"]\)/,
  'photo transaction state must come from the authoritative owner-scoped market-state RPC',
);
assert.match(
  inventoryMarketState,
  /if\s*\(error\)\s*throw\s+error/,
  'photo transaction state lookup must surface verification failures so the UI fails closed',
);
assert.doesNotMatch(
  itemImages,
  /loadPrivateInventory\(/,
  'photo refreshes must not call the full inventory loader or emit duplicate INVENTORY_VIEWED telemetry',
);
assert.match(
  itemImages,
  /loadMyInventoryMarketState\(itemId\)[\s\S]*marketState === ['"]RESERVED['"] \|\| marketState === ['"]SOLD['"]/,
  'Thing photo controls must lock from authoritative RESERVED/SOLD state without filtering SOLD items out first',
);
assert.match(itemImages, /Photos locked for this sale/, 'Reserved/Sold photo UI must explain why transaction photos are locked');
assert.match(
  itemImages,
  /const transactionActionsDisabled = transactionPhotoState !== ['"]editable['"];/,
  'Marketplace photo mutations must fail closed until transaction state is known editable',
);
assert.match(
  itemImages,
  /disabled=\{busy \|\| transactionActionsDisabled\}[\s\S]*onPress=\{\(\) => confirmDelete\(image\)\}/,
  'Delete controls must be visibly disabled when transaction photos are locked or sale state cannot be verified',
);
assert.match(
  itemImages,
  /accessibilityHint=\{transactionActionsDisabled \? transactionStatusCopy : ['"]Selection alone does not publish the photo['"]\}/,
  'Disabled Marketplace photo controls must expose the lock reason to assistive technology',
);

console.log('release-critical ownership + auth + barcode capture + Marketplace conversation + transaction photo regression: ok');
