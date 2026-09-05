# Things

Private-by-default inventory with an optional C2C marketplace.

## Product scope

Things lets a user keep a private inventory of owned items and explicitly publish selected items to a marketplace. The V1 product currently covers:

- generic Things plus catalog-backed devices
- private inventory CRUD and persisted metadata
- multiple Thing photos with explicit per-photo Marketplace selection
- barcode / GTIN capture with confirmed structured identity
- personal value estimate kept separate from Marketplace price
- Marketplace listing with seller-chosen Asking Price and coarse public location
- public listing discovery backed by an explicit public snapshot
- listing-bound chat, offers, counter offers and acceptance
- `OPEN -> RESERVED -> SOLD` transaction lifecycle
- explicit Final Price at sale completion
- buyer adoption of a sold Thing into private inventory
- Android release-candidate builds and multi-account acceptance testing

Integrated payments, shipping, exact-address sharing and automatic AI/photo recognition are intentionally outside the current release scope.

## Privacy and security invariants

- private inventory is never public by default
- publishing is explicit; private inventory location is never copied into Marketplace location automatically
- only seller-selected photos are projected to the buyer-facing image store
- after a transaction is reserved or sold, the shared Marketplace photo set is frozen for transaction integrity
- chat, offers and reserved/sold transaction data are participant-scoped
- unrelated accounts must not gain access to seller-private notes, exact location, private images or transaction data
- purchased-item adoption is buyer-only and strips seller-private metadata
- privileged Supabase RPCs use explicit auth/owner/participant checks, restricted grants and empty `search_path`
- account isolation must never be weakened to simplify UI or testing

## Price semantics

Things intentionally keeps these concepts distinct:

- **Personal Estimate**: private estimate for the owner
- **Things Market Value**: evidence-based marketplace reference; completed-sale median is preferred and weak evidence must not imply false precision
- **Asking Price**: seller-selected public listing price
- **Offer / Counter Offer / Accepted Offer**: negotiation state
- **Final / Paid Price**: explicit sale-completion price and purchase context

No estimate or recommendation is copied into a listing automatically.

## Architecture

- `mobile/` — React Native / Expo Android client
- `mobile/src/features/` — feature-owned UI and presentation logic
- `mobile/src/data/` — thin Supabase query/command boundary
- `mobile/src/lib/` — cross-feature helpers and small domain utilities
- `supabase/migrations/` — schema, RPC, RLS and security evolution
- `supabase/tests/` — pgTAP security / lifecycle / acceptance tests
- `scripts/` — release-contract and concurrency guards
- `.github/workflows/` — mobile, smoke and backend-security CI

The mobile compatibility boundary is documented in `mobile/ARCHITECTURE.md`.

## Release gates

A release candidate is not considered ready solely because it builds. The current V1 release gate requires:

1. clean `main` with no unresolved P0/P1 defects
2. green mobile/smoke/backend-security/concurrency CI
3. hosted Supabase schema aligned with the release code
4. reproducible Android APK
5. real-device Seller -> Buyer journey, with an unrelated third account excluded throughout
6. agreement between automated behavioral evidence and real Android acceptance

An APK is only described as **device-tested** after it has actually been installed and tested on a device.

## Current release status

The backend and automated multi-account lifecycle contracts are substantially in place. The remaining release-critical work is real Android acceptance of the integrated Seller -> Buyer -> Account C journey plus any resulting device fixes.

Historical repository name `asset-market-alpha` is retained for continuity; the product itself is **Things**.
