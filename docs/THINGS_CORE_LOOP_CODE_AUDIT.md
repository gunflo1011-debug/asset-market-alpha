# Things core-loop code audit

Date: 2026-08-25
Base: `main` @ `46d93fe4a129e321da1a192d49c5ee2afcb663d4`
Scope: actual shipped code path for `capture -> inventory -> value -> sell`.

## Executable path map

| Loop step | Current route / UI | Data function / backend boundary | Current state |
| --- | --- | --- | --- |
| Capture | `mobile/App.tsx` authenticated root, card **Add a device privately**; first eight catalog variants rendered inline; selection stored in `selectedVariantId`; submit handled by `createPrivateDevice()` | `mobile/src/data/inventory.ts::loadCatalog()` reads `product_variants`; `addPrivateDevice()` calls RPC `add_private_device` | Implemented, but minimal |
| Inventory | `mobile/App.tsx` authenticated root **My devices**; `refreshData()` loads data; `items.map(...)` renders device, housing condition and battery | `mobile/src/data/inventory.ts::loadPrivateInventory()` reads owner-visible `items` with variant/product and condition snapshot | Implemented |
| Value | No route/component or displayed per-item/total valuation exists on current `main` | No mobile valuation read function exists in `mobile/src/data/` | Missing |
| Sell | No sell CTA, sell route or owner decision component exists on current `main` | No mobile sell command exists in `mobile/src/data/`; current UI only states that a future verified buyer match may open a private decision flow | Missing |

## Highest-priority bounded friction: capture discovery does not scale past eight variants

**Evidence:** `mobile/App.tsx` renders `catalog.slice(0, 8)` with no search, filter, pagination, brand/family grouping or "show more" control. `loadCatalog()` can return the catalog, but the UI makes every variant after position eight unreachable. `selectedVariantId` also defaults to the first returned variant during `refreshData()`.

This is a direct activation blocker rather than cosmetic UX debt: a user whose owned device is not among the first eight variants cannot complete the first core-loop action at all. It will worsen automatically as catalog coverage grows, so adding catalog rows currently reduces the share of inventory that can be captured from the app.

### Recommended next implementation

Add a small client-side catalog search/filter immediately above the variant list and remove the hard eight-item reachability ceiling. Search only already-loaded non-sensitive catalog fields (`brand`, `family`, `storage_gb`); do not add profiling or a new backend dependency. Keep selection explicit and show an empty-result message. A focused pure helper/test should prove that matches beyond index 8 remain reachable and that brand/family/storage queries behave deterministically.

**Acceptance target:** given a catalog with >8 variants, a user can search for and select any matching variant, including one that was previously outside `slice(0, 8)`, then continue through the existing `add_private_device` RPC unchanged.

## Secondary observations for later CEO prioritization

1. `value` and `sell` are not merely hidden routes on `main`; the mobile data layer has no corresponding read/command functions. Treat those as explicit future product slices rather than assuming an end-to-end core loop already exists.
2. Capture currently defaults condition inputs inside `addPrivateDevice()` (`INTACT`, `CLEAN`, cameras/biometrics working, network unlocked). The UI does not collect those facts. Before those fields influence valuation or selling, they need an explicit truthful capture step or an unknown/not-captured representation; silently optimistic defaults should not become market evidence.
3. Inventory is the strongest implemented loop step today: owner-scoped rows are loaded after authentication and rendered with condition/battery information.

## Handoff

Owner: AI Business Worker per CEO assignment. Implement only the bounded catalog discovery fix first. Do not expand into valuation, sell, pricing or paywall work in the same change.