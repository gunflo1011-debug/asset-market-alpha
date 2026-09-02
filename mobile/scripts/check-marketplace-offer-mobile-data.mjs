import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/data/marketplaceOffers.ts', import.meta.url), 'utf8');
const barrel = fs.readFileSync(new URL('../src/data/inventory.ts', import.meta.url), 'utf8');
const types = fs.readFileSync(new URL('../src/features/inventory/types.ts', import.meta.url), 'utf8');

for (const rpc of ['load_my_marketplace_offers', 'make_my_marketplace_offer', 'respond_to_my_marketplace_offer']) {
  assert.match(source, new RegExp(`rpc\\('${rpc}'`), `${rpc} must remain wired through the authenticated Supabase client`);
}

assert.match(source, /Number\.isInteger\(amountCents\)[\s\S]*amountCents < 1[\s\S]*amountCents > MAX_OFFER_CENTS/);
assert.match(source, /MAX_OFFER_MESSAGE_LENGTH = 500/);
assert.match(source, /action === 'COUNTER'[\s\S]*counterAmountCents == null/);
assert.match(source, /p_counter_amount_cents: action === 'COUNTER' \? counterAmountCents : null/);
assert.match(source, /p_counter_message: action === 'COUNTER' \? normalizeOfferMessage\(counterMessage\) : null/);
assert.match(source, /row\.proposer_role !== 'ME' && row\.proposer_role !== 'OTHER'/);
assert.match(source, /row\.status !== 'PENDING'[\s\S]*'ACCEPTED'[\s\S]*'DECLINED'[\s\S]*'COUNTERED'/);

for (const exported of ['loadMyMarketplaceOffers', 'makeMyMarketplaceOffer', 'respondToMyMarketplaceOffer']) {
  assert.match(barrel, new RegExp(`\\b${exported}\\b`));
}

assert.match(types, /export type MarketplaceOfferStatus = 'PENDING' \| 'ACCEPTED' \| 'DECLINED' \| 'COUNTERED'/);
assert.match(types, /export type MarketplaceOfferResponseAction = 'ACCEPT' \| 'DECLINE' \| 'COUNTER'/);
assert.match(types, /export type MarketplaceOffer = \{[\s\S]*amount_cents: number;[\s\S]*parent_offer_id: string \| null;/);

console.log('marketplace offer mobile data contract: OK');
