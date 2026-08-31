import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const screen = read('src/features/inventory/InventoryScreen.tsx');
const saleSurface = read('src/lib/saleStartSurface.ts');
const listingPanel = read('src/features/marketplace/SellListingPanel.tsx');
const marketplaceScreen = read('src/features/marketplace/MarketplaceScreen.tsx');
const conversationScreen = read('src/features/marketplace/MarketplaceConversationScreen.tsx');
const inventory = [
  read('src/data/inventory.ts'),
  read('src/data/inventoryQueries.ts'),
  read('src/data/inventoryCommands.ts'),
].join('\n');

const requiredScreenSemantics = [
  '<Text style={styles.metric}>{props.items.length}</Text>',
  'value_evidence?.estimated_value_cents ?? null',
  "sale.valueLabel.replace('Estimated value ', '')",
  'summarizeInventoryValue',
  '<SellListingPanel',
];
for (const marker of requiredScreenSemantics) {
  if (!screen.replace(/\s+/g, '').includes(marker.replace(/\s+/g, ''))) {
    throw new Error(`Missing authenticated product-convergence semantic: ${marker}`);
  }
}
if (!/const\s+saleOpen\s*=\s*props\.saleIntentItemId\s*===\s*selectedItem\.id/.test(screen)) {
  throw new Error('Selected-item detail must derive selling visibility from explicit sale-intent state.');
}
if (!/onPress=\{\(\)\s*=>\s*props\.onToggleSaleIntent\(selectedItem\.id\)\}/.test(screen)) {
  throw new Error('Selected-item detail must require an explicit owner action to toggle selling.');
}
if (!listingPanel.includes('Seller asking price (€)') || !listingPanel.includes('Reference only · never auto-published')) {
  throw new Error('Authenticated sell convergence must keep seller asking price explicit and Things Estimate reference-only.');
}
if (!listingPanel.includes('BUYERS CURRENTLY SEE') || !listingPanel.includes('listing?.asking_price_cents ?? null')) {
  throw new Error('Authenticated sell convergence must render the persisted buyer-visible Marketplace price separately.');
}
if (!listingPanel.includes("const [price, setPrice] = useState('')")) {
  throw new Error('Authenticated sell convergence must not inherit Things Estimate into seller asking price.');
}
if (!listingPanel.includes('Nothing becomes visible to other users until you explicitly publish.')) {
  throw new Error('Marketplace convergence must preserve explicit owner consent before visibility.');
}
if (!listingPanel.includes('Marketplace location (optional)') || !listingPanel.includes('Things never copies your private inventory location automatically.')) {
  throw new Error('Marketplace convergence must keep coarse location optional and separate from private inventory location.');
}
if (!marketplaceScreen.includes('location not shared') || !marketplaceScreen.includes('exact address hidden')) {
  throw new Error('Marketplace buyer surfaces must distinguish optional coarse location from hidden exact location.');
}
if (!marketplaceScreen.includes('Message seller') || !marketplaceScreen.includes('Open conversation')) {
  throw new Error('Interested buyers must have an explicit private-conversation entry point.');
}
if (!marketplaceScreen.includes('loadMyMarketplaceConversations') || !marketplaceScreen.includes('openMyMarketplaceConversation')) {
  throw new Error('Marketplace must load and open authenticated listing-bound conversations.');
}
if (!marketplaceScreen.includes("row.role === 'SELLER'") || !marketplaceScreen.includes('Reply ›')) {
  throw new Error('Seller listing surfaces must expose participant-safe reply entry points.');
}
if (!marketplaceScreen.includes('Your transactions') || !marketplaceScreen.includes("row.status === 'RESERVED'") || !marketplaceScreen.includes("row.status === 'SOLD'")) {
  throw new Error('Reserved/sold Marketplace conversations must remain reachable after public listing withdrawal.');
}
if (!conversationScreen.includes('loadMyMarketplaceMessages') || !conversationScreen.includes('sendMyMarketplaceMessage')) {
  throw new Error('Conversation surface must load and send through authenticated Marketplace message RPCs.');
}
if (!conversationScreen.includes('Account identities and private inventory details are not exposed here.')) {
  throw new Error('Conversation surface must retain explicit privacy semantics.');
}
if (!conversationScreen.includes("status === 'SOLD'") || !conversationScreen.includes("status === 'CLOSED'")) {
  throw new Error('Conversation UI must disable messaging for sold/closed listing conversations.');
}
if (!conversationScreen.includes('Reserve for this buyer') || !conversationScreen.includes('Mark as sold') || !conversationScreen.includes("conversation.role === 'SELLER'")) {
  throw new Error('Marketplace lifecycle controls must be explicit seller actions in the listing-bound conversation.');
}
if (!conversationScreen.includes('No payment or purchase happens automatically.')) {
  throw new Error('Reservation UI must explicitly avoid implying an automatic payment or purchase.');
}
if (!/function\s+toggleSaleIntent\(itemId:\s*string\)[\s\S]*setSaleIntentItemId/s.test(app)) {
  throw new Error('App shell must own the selected sale-intent state transition.');
}

if (!saleSurface.includes('estimatedValueCents: number | null')) {
  throw new Error('Sale surface must preserve unknown value evidence as nullable.');
}
if (!saleSurface.includes('Nothing is listed or sold until you explicitly continue.')) {
  throw new Error('Sale surface must preserve explicit owner intent before listing or selling.');
}
if (!saleSurface.includes('Estimate pending')) {
  throw new Error('Unknown inventory value must remain explicit as a pending estimate.');
}

const compactInventory = inventory.replace(/\s+/g, '');
if (!compactInventory.includes("rpc('load_my_inventory_market_states')")) {
  throw new Error('Missing authoritative market-state lookup for catalog-backed devices.');
}
if (!compactInventory.includes("rpc('load_my_inventory_values')")) {
  throw new Error('Missing authenticated owner-scoped value-evidence lookup for inventory.');
}
const hasListingWrite = compactInventory.includes("rpc('save_my_marketplace_listing_v2'") || compactInventory.includes("rpc('save_my_marketplace_listing'");
const hasMarketplaceRead = compactInventory.includes("rpc('load_marketplace_v2')") || compactInventory.includes("rpc('load_marketplace_v1')");
if (!hasListingWrite || !hasMarketplaceRead) {
  throw new Error('Marketplace convergence requires owner-controlled listing writes and the filtered marketplace read RPC.');
}
if (compactInventory.includes("rpc('save_my_marketplace_listing_v2'") && !compactInventory.includes('p_public_location:publicLocation?.trim()||null')) {
  throw new Error('Marketplace v2 listing writes must send only the explicit seller-entered public location.');
}
for (const rpc of ['open_my_marketplace_conversation', 'load_my_marketplace_conversations', 'load_my_marketplace_messages', 'send_my_marketplace_message', 'set_my_marketplace_conversation_status']) {
  if (!compactInventory.includes(`rpc('${rpc}'`)) throw new Error(`Missing Marketplace conversation/lifecycle RPC wiring: ${rpc}`);
}

const fullFailClosedOnRpcError = /if\s*\(\s*marketStateResult\.error\s*\)\s*throw\b/s;
const discriminatedRpcFailClosed = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,240}if\s*\(\s*isCatalogDevice\s*&&\s*marketStateResult\.error\s*\)\s*return\s*\[\]\s*;/s;
if (!fullFailClosedOnRpcError.test(inventory) && !discriminatedRpcFailClosed.test(inventory)) {
  throw new Error('Market-state RPC failure must fail closed for catalog-backed devices.');
}

const discriminatedDeviceFilter = /const\s+isCatalogDevice\s*=\s*item\.product_variants\s*!==\s*null\s*;[\s\S]{0,360}const\s+state\s*=\s*marketStates\.get\(item\.id\)[^;]*;[\s\S]{0,160}if\s*\(\s*isCatalogDevice\s*&&\s*!state\s*\)\s*return\s*\[\]\s*;[\s\S]{0,160}if\s*\(\s*state\s*===\s*['"]SOLD['"]\s*\)\s*return\s*\[\]\s*;/s;
if (!discriminatedDeviceFilter.test(inventory)) {
  throw new Error('Inventory must exclude SOLD devices and catalog-backed devices without authoritative market state.');
}

for (const marker of ['add_private_thing', 'update_private_thing', 'delete_private_thing']) {
  if (!inventory.includes(marker)) throw new Error(`Missing generic Thing lifecycle command: ${marker}`);
}

if (/buildSaleStartSurface\([^,]+,\s*0\)/.test(screen)) {
  throw new Error('Unknown value must never be converted to a zero-price estimate.');
}

console.log('authenticated ownership/value/sell/conversation/lifecycle convergence regression passed');
