import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260827232500_owner_value_estimate_v1.sql', 'utf8');
const itemScopedContextMigration = fs.readFileSync('supabase/migrations/20260905062000_item_scoped_estimate_context.sql', 'utf8');
const commands = fs.readFileSync('mobile/src/data/inventoryCommands.ts', 'utf8');
const estimateContext = fs.readFileSync('mobile/src/data/inventoryEstimateContext.ts', 'utf8');
const panel = fs.readFileSync('mobile/src/features/inventory/ValueEstimatePanel.tsx', 'utf8');

assert.match(migration, /estimate_my_item_value_v1/i);
assert.match(migration, /where id = p_item_id and owner_id = v_owner/i);
assert.match(migration, /MODEL_V1_OWNER_INPUT/i);
assert.match(migration, /purchase-price-age-condition/i);
assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all)[\s\S]*item_valuation_profiles[\s\S]*authenticated/i);
assert.match(commands, /estimate_my_item_value_v1/i);
assert.match(commands, /p_purchase_price_cents/i);
assert.match(commands, /p_purchase_year/i);
assert.match(commands, /p_condition_grade/i);

assert.match(itemScopedContextMigration, /create or replace function public\.load_my_item_value\(p_item_id uuid\)/i);
assert.match(itemScopedContextMigration, /create or replace function public\.load_my_item_purchase_context\(p_item_id uuid\)/i);
assert.match(itemScopedContextMigration, /set search_path = ''/i);
assert.match(itemScopedContextMigration, /i\.owner_id = auth\.uid\(\)/i);
assert.match(itemScopedContextMigration, /a\.buyer_id = auth\.uid\(\)/i);
assert.match(estimateContext, /load_my_item_value[\s\S]*p_item_id:\s*itemId/i);
assert.match(estimateContext, /load_my_item_purchase_context[\s\S]*p_item_id:\s*itemId/i);
assert.doesNotMatch(estimateContext, /load_my_inventory_values/i, 'single-Thing estimate context must not transfer all owner value rows');
assert.doesNotMatch(estimateContext, /load_my_inventory_purchase_context/i, 'single-Thing estimate context must not transfer all owner purchase rows');
assert.match(estimateContext, /if \(valueResult\.error\) throw valueResult\.error/i);
assert.match(estimateContext, /if \(purchaseContextResult\.error\) throw purchaseContextResult\.error/i);
assert.match(panel, /loadMyInventoryEstimateContext\(itemId\)/i);
assert.doesNotMatch(panel, /loadPrivateInventory/i, 'estimate panel must not trigger full inventory reads or INVENTORY_VIEWED telemetry');
assert.match(panel, /Purchase price \(€\)/i);
assert.match(panel, /Purchase year/i);
assert.match(panel, /Like new/i);
assert.match(panel, /Good/i);
assert.match(panel, /Fair/i);
assert.match(panel, /Poor/i);
assert.match(panel, /transparent model estimate/i);
assert.match(panel, /not a verified market comparison/i);
assert.doesNotMatch(panel, /verified value/i, 'owner-input estimate UI must not present itself as verified market evidence');

console.log('value estimate v1 + item-scoped context contract: OK');
