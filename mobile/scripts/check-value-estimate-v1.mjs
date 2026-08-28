import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260827232500_owner_value_estimate_v1.sql', 'utf8');
const commands = fs.readFileSync('mobile/src/data/inventoryCommands.ts', 'utf8');
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
assert.match(panel, /Purchase price \(€\)/i);
assert.match(panel, /Purchase year/i);
assert.match(panel, /Like new/i);
assert.match(panel, /Good/i);
assert.match(panel, /Fair/i);
assert.match(panel, /Poor/i);
assert.match(panel, /transparent model estimate/i);
assert.match(panel, /not a verified market comparison/i);
assert.doesNotMatch(panel, /verified value/i, 'owner-input estimate UI must not present itself as verified market evidence');

console.log('value estimate v1 contract: OK');
