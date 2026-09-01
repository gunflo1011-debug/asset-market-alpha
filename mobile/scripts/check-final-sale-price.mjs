import fs from 'node:fs';
import assert from 'node:assert/strict';

const commands = fs.readFileSync('src/data/inventoryCommands.ts', 'utf8');
const conversation = fs.readFileSync('src/features/marketplace/MarketplaceConversationScreen.tsx', 'utf8');

assert.match(commands, /set_my_marketplace_conversation_status_v2/);
assert.match(commands, /p_final_sale_price_cents:\s*status === 'SOLD' \? finalSalePriceCents : null/);
assert.match(commands, /status === 'SOLD'[\s\S]*Enter a valid final sale price/);

assert.match(conversation, /Actual final sale price \(€\)/);
assert.match(conversation, /stored separately from the original seller asking price/i);
assert.match(conversation, /parsedFinalSalePrice\.valid/);
assert.match(conversation, /changeLifecycle\('SOLD', parsedFinalSalePrice\.cents\)/);
assert.match(conversation, /may contribute anonymously to Things Market Value/i);
assert.match(conversation, /Mark as sold at/);

console.log('final sale price mobile regression: OK');
