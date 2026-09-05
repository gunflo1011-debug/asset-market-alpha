import { requireSupabase } from './supabaseClient';
import type { InventoryPurchaseContext, InventoryValueEvidence } from '../features/inventory/types';

export type InventoryEstimateContext = {
  valueEvidence: InventoryValueEvidence | null;
  purchaseContext: InventoryPurchaseContext | null;
};

export async function loadMyInventoryEstimateContext(itemId: string): Promise<InventoryEstimateContext> {
  const [valueResult, purchaseContextResult] = await Promise.all([
    requireSupabase().rpc('load_my_inventory_values'),
    requireSupabase().rpc('load_my_inventory_purchase_context'),
  ]);

  if (valueResult.error) throw valueResult.error;
  if (purchaseContextResult.error) throw purchaseContextResult.error;

  const valueRow = ((valueResult.data ?? []) as Array<Record<string, unknown>>).find((row) => String(row.item_id) === itemId);
  const purchaseRow = ((purchaseContextResult.data ?? []) as Array<Record<string, unknown>>).find((row) => String(row.item_id) === itemId);

  const estimatedValueCents = valueRow?.estimated_value_cents == null ? null : Number(valueRow.estimated_value_cents);
  const purchasePriceCents = purchaseRow?.purchase_price_cents == null ? null : Number(purchaseRow.purchase_price_cents);

  return {
    valueEvidence: valueRow && estimatedValueCents != null && Number.isFinite(estimatedValueCents)
      ? {
          estimated_value_cents: estimatedValueCents,
          currency: String(valueRow.currency ?? 'EUR'),
          source_type: String(valueRow.source_type ?? ''),
          observed_at: String(valueRow.observed_at ?? ''),
        }
      : null,
    purchaseContext: purchaseRow
      ? {
          purchase_price_cents: purchasePriceCents != null && Number.isFinite(purchasePriceCents) ? purchasePriceCents : null,
          source_type: 'MARKETPLACE_ADOPTION',
          source_gtin: purchaseRow.source_gtin == null ? null : String(purchaseRow.source_gtin),
        }
      : null,
  };
}
