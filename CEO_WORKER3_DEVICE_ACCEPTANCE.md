# Things 1.0 — Android production-device acceptance

Status: **DEVICE ACCEPTANCE REQUIRED BEFORE MARK-READY**

Current production candidate baseline: `main` commit `2c57dd658c79770fe8563c958122059ae428b82b`.

Current evidenced Android workflow: `android-release` run `34676259571` / run number `185`, completed successfully on the baseline commit. Device-test artifact: `things-android-device-test-candidate` (artifact id `10292617939`, 36,342,664 bytes, SHA-256 digest recorded by GitHub Actions). This artifact is explicitly a device-test candidate, not a Play Store signing proof.

This packet is the acceptance contract for Things 1.0. CI/static checks are necessary but are not device evidence. Do not call the app market-ready until the complete production journey and isolation checks below pass on the intended APK.

## 1. Pre-install release gate

Before testing, verify:

1. The APK was produced by a successful `android-release` run from the exact intended `main` commit.
2. The artifact is named `things-android-device-test-candidate` and is non-zero/non-expired.
3. `mobile-release-ci`, `backend-security-gate`, and `actions-smoke` are green for the relevant integrated code.
4. Production config uses hosted HTTPS Supabase, the production Things identity, and no privileged/service-role client key.
5. Never treat the device-test APK as Play Store signed. Store publication requires the separate signed AAB path and configured upload-key secrets.

Reject an APK from an older commit, an Alpha artifact, a failed workflow, or an artifact with unknown provenance.

## 2. Fresh install / Auth / session

Use normal disposable Supabase Auth accounts only; never admin/service-role credentials.

| ID | Action | PASS expectation |
|---|---|---|
| A1 | Fresh install and launch | Things opens into the real production auth/app surface; no fake private-data fallback. |
| A2 | Register / sign in | Normal Auth completes; confirmation/reset links return to Things through the production deep-link path. |
| A3 | Relaunch | Valid session restores without exposing another account's data. |
| A4 | Invalid login | Clear user-facing error; no private data appears. |
| A5 | Sign out | Inventory, private item details and seller-private state are no longer accessible. |

## 3. Core owner journey — Add → Inventory → Thing detail

Run one complete creation flow. At least one pass must use camera/photo or barcode if available on the device; manual entry is not sufficient as the only evidence.

| ID | Action | PASS expectation |
|---|---|---|
| C1 | Add Thing | Barcode/photo/manual entry reaches suggestions/confirmation without crash or dead navigation. |
| C2 | Confirm and save | Exactly one Thing is persisted; repeated taps while saving do not create accidental duplicates. |
| C3 | Inventory | New Thing appears after refresh and after relaunch. Large-list scrolling remains responsive. |
| C4 | Images | Image loads/changes do not leave permanent loader/error overlays or stale previous images. |
| C5 | Thing detail | Product data, private images and lifecycle state match the saved Thing. |
| C6 | Estimate | Unknown/unverified estimate remains unknown; it is never silently converted to €0 or an asking price. |

Private images, serial numbers, exact addresses and seller-private metadata must remain private throughout this section.

## 4. Listing journey — Thing → public Marketplace listing

| ID | Action | PASS expectation |
|---|---|---|
| L1 | Start selling | Explicit owner action enters listing flow; no automatic public listing. |
| L2 | Asking price | Asking Price is entered independently from Estimate. Changing it must not mutate the Estimate source of truth. |
| L3 | Location | Only the intended coarse marketplace location is exposed; exact address/private owner data stays private. |
| L4 | Publish | Lifecycle progresses consistently (`Ready to list` / `Publishing` / `For sale`) and only actually public listings show as For sale. |
| L5 | Discovery | The published item is discoverable from another normal account with only public listing fields/images. |
| L6 | Reopen/edit | Listing remains coherent after refresh/relaunch; no stale pre-publish state returns. |

## 5. Two-user Marketplace transaction journey

Use two disposable normal accounts: Seller A and Buyer B.

| ID | Action | PASS expectation |
|---|---|---|
| M1 | Buyer B opens listing | B sees public listing data only; never A's private inventory/address/serial/private image state. |
| M2 | Make Offer | Offer amount is its own source of truth and does not overwrite Asking Price or Estimate. |
| M3 | Seller receives offer | A sees the correct offer/conversation; unrelated accounts cannot read it. |
| M4 | Counter | Counter amount is represented independently and both parties converge on the same current negotiation state. |
| M5 | Accept | Accepted offer produces one coherent transaction/conversation state. |
| M6 | Chat | A and B can exchange messages; keyboard/send/loading/retry behavior remains usable and messages do not leak to other accounts. |
| M7 | Reserve | Reserved state is reflected consistently in listing/conversation/inventory and cannot regress to a stale Published state. |
| M8 | Sold | Sold state persists across refresh/relaunch and the listing cannot be republished after transaction completion. |
| M9 | Final/Paid Price | Final/Paid Price is recorded independently from Estimate, Asking Price and Offer/Counter. |
| M10 | Buyer adoption | Buyer receives the intended adopted Thing state; seller-private fields are not transferred unless explicitly part of the product contract. |

Any cross-account access to private data is a **STOP / P0 privacy failure**.

## 6. Exact account-isolation matrix

| ID | Action | PASS | Immediate failure |
|---|---|---|---|
| R1 | A owns a private Thing | Visible to A | Write/read failure for owner |
| R2 | B opens Inventory | A private Thing absent | **P0:** A private Thing visible |
| R3 | B adds own Thing | B Thing visible; A remains absent | Wrong-owner visibility/write |
| R4 | Sign back in as A | A Thing visible; B private Thing absent | **P0:** B private Thing visible |
| R5 | Signed out | No private inventory/conditions/conversations | **P0:** any private row exposed |
| R6 | Public listing read | Only explicitly public marketplace projection visible | Exact address, serial, private images or seller-private data exposed |

Do not weaken RLS for test cleanup.

## 7. Network, retries and lifecycle race sanity

1. Disable network during Inventory refresh. PASS: visible error/retry state; no fake inventory substitution.
2. Re-enable network and retry. PASS: hosted state recovers without duplicate creation.
3. Repeat with Marketplace refresh. PASS: an older request cannot overwrite newer listing/interest/conversation state.
4. Switch product images quickly. PASS: stale callbacks from the previous URI cannot re-activate a loader or replace the current image state.
5. Trigger reserve/sold transitions and refresh/navigation rapidly. PASS: transaction state never visually or persistently regresses to Published.
6. Background/relaunch during an in-progress user flow. PASS: no private data leaks and state returns to a coherent screen.

## 8. World-class consumer-app acceptance

This is not a screenshot-only check. Test all major screens as one product: Inventory/Home, Marketplace, Listing Detail, Make an Offer, Offers Received, Chat, Add Thing and Thing Detail.

PASS requires:

- consistent navigation/back behavior and no dead ends;
- safe-area/keyboard handling on the actual device;
- touch targets usable one-handed;
- loading/empty/error/success states understandable without developer knowledge;
- no obvious visual jumps from image loading or list refresh;
- smooth Inventory/Marketplace scrolling with representative data;
- coherent white/navy premium visual system across the complete journey;
- no Alpha/debug/internal wording in normal consumer surfaces.

A polished individual screen does not compensate for a broken transaction or privacy journey.

## 9. Evidence to retain

Retain only non-sensitive evidence:

- tested commit SHA;
- workflow run id and artifact id/name/size/digest;
- Android device model + Android version;
- fresh install vs upgrade;
- account labels `A` / `B` only;
- PASS / BLOCKED / FAIL for A1–A5, C1–C6, L1–L6, M1–M10, R1–R6 and network/UI checks;
- UTC test time;
- exact failing step, expected result, actual result and reproducibility;
- redacted screenshots/video only when free of credentials, tokens, account emails, exact addresses and other private data.

Never retain passwords, access/refresh tokens, service-role keys, private Supabase secrets, account UUIDs or full auth logs.

## 10. Release decision

**MARK-READY** only when the intended current APK passes fresh-install Auth/session, complete Add → Inventory → Estimate → Listing → Discovery → Offer/Counter/Accept → Chat → Reserved/Sold → Buyer Adoption, two-account isolation, offline/retry/race sanity and cross-screen consumer-quality acceptance.

Use **BLOCKED** when a prerequisite or physical-device/two-account evidence is missing. Use **FAIL** when an executed step violates its expected behavior. Any privacy/account-isolation breach, destructive data regression, price-source conflation, or transaction-state corruption is an immediate release blocker.

Play Store publication remains a separate final gate: the signed AAB path must be executed with explicitly configured Android upload-key credentials and verified independently. Device acceptance alone does not authorize or perform a store publish.
