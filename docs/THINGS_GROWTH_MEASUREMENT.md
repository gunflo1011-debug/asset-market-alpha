# Things growth measurement contract

## Goal
Measure whether the free Things core loop becomes useful enough to drive adoption and repeat use. This contract is for product learning, not advertising profiles, pricing experiments, or user scoring.

## Allow-listed progression events

- `SIGN_UP_REQUESTED` — account creation was requested.
- `SIGN_IN_SUCCEEDED` / `SESSION_RESTORED` — authenticated use.
- `ITEM_CAPTURE_STARTED` — user intentionally begins adding an item.
- `ITEM_CAPTURE_COMPLETED` — an item was successfully saved.
- `INVENTORY_VIEWED` — inventory surface was shown.
- `VALUE_VIEWED` — user intentionally viewed a single-item value surface.
- `TOTAL_VALUE_VIEWED` — user intentionally viewed aggregate inventory value.
- `SELL_FLOW_STARTED` — user intentionally begins the sell flow.
- `SELL_FLOW_COMPLETED` — sell intake reached its defined completion boundary.

Legacy `DEVICE_ADDED` remains accepted while the alpha migrates to generic item capture.

## Data minimization
Each event stores only the authenticated user id, allow-listed event name, server timestamp, and an optional item id. The item id is accepted only when the authenticated user owns that item. Do not add event payloads containing email, free text, item name/model, catalog variant, value, price, condition, defects, location, network status, device identifiers, fingerprints, advertising identifiers, or contact details.

Telemetry is best-effort and must never block a product action. There is no public/read path for clients to browse event rows.

## Initial learning metrics

1. **Activation:** users with `ITEM_CAPTURE_COMPLETED` / users with `SIGN_UP_REQUESTED`.
2. **Capture conversion:** users with `ITEM_CAPTURE_COMPLETED` / users with `ITEM_CAPTURE_STARTED`.
3. **Inventory usefulness:** users with `INVENTORY_VIEWED` after a completed capture.
4. **Value discovery:** users with `VALUE_VIEWED` or `TOTAL_VALUE_VIEWED` after inventory use.
5. **Sell progression:** users with `SELL_FLOW_COMPLETED` / users with `SELL_FLOW_STARTED`.
6. **Repeat usefulness:** distinct users returning with `SESSION_RESTORED` or `SIGN_IN_SUCCEEDED` on a later calendar day after activation.

Do not infer demographic, behavioral advertising, credit, insurance, employment, health, or other sensitive profiles from these events.

## Change gate
Any new event or field must answer a specific product-learning question, use the least data needed, remain allow-listed server-side, and receive privacy/security review before collection. Monetization instrumentation is intentionally out of scope until adoption evidence justifies it.
