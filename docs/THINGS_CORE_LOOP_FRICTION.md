# Things core-loop friction package

## Scope

CEO assignment: improve the free core loop `capture -> inventory -> value -> total value -> sell -> inventory update` without paywall/price work and without weakening privacy/security.

Evidence inspected at PR #8 head `1a0237a`: `mobile/App.tsx`, `mobile/src/data/inventory.ts`, `mobile/src/data/analytics.ts`, smartphone intake domain/tests, and the current growth-measurement contract.

## Highest-friction bottleneck

The current authenticated UI makes first capture unnecessarily expensive and ambiguous:

1. `App.tsx` renders up to eight raw catalog variants as a vertical button list before the save CTA.
2. A catalog variant is preselected during `refreshData()`, so a user can save without making an intentional model choice.
3. `createPrivateDevice()` calls `addPrivateDevice({ variantId })` with defaults for condition, cameras, biometrics, battery and network lock. The richer deterministic smartphone-intake contract in PR #8 therefore is not yet represented in the actual UI path.
4. After save, `refreshData()` reloads both inventory **and the entire catalog**, adding avoidable latency to the activation moment.
5. The existing telemetry already defines `ITEM_CAPTURE_STARTED` and `ITEM_CAPTURE_COMPLETED`, but this UI path does not emit them. We therefore cannot measure start-to-completion drop-off.

This is a higher-value activation bottleneck than adding value/sell UI first: if first possession capture is confusing or silently records defaults, downstream value and sell usage cannot become trustworthy retention signals.

## Bounded implementation contract

### P0 — intentional, measurable first capture

Modify `mobile/App.tsx` and `mobile/src/data/inventory.ts` only as needed so that:

- no catalog variant is selected merely because data loaded;
- tapping a catalog variant is the explicit capture start and emits `ITEM_CAPTURE_STARTED` once for that attempt;
- the primary CTA remains disabled until an explicit variant selection exists;
- successful persistence emits `ITEM_CAPTURE_COMPLETED` only after `add_private_device` succeeds;
- failed persistence does **not** emit completion;
- capture events contain no email, catalog/model identity, condition, value, price, location, free text or device fingerprint;
- after a successful add, reload inventory only; do not refetch the static catalog merely to show the new item;
- reset the explicit selection after success so a second accidental tap cannot duplicate the previous model.

### P1 — do not pretend defaults are observed facts

Until the PR #8 smartphone-intake fields are actually wired to UI controls, the save path must not present defaulted condition/camera/biometric/network values as user-confirmed observations. Either collect them explicitly in a later bounded step or render them as `not captured`/unknown where the schema permits. Do not broaden this package into a schema migration.

## Acceptance tests

1. Loading catalog leaves `selectedVariantId === null`.
2. Save CTA is disabled with no explicit selection.
3. First variant selection records exactly one `ITEM_CAPTURE_STARTED` event with no item id/payload.
4. Changing variant within the same attempt does not create another start event.
5. Successful RPC records exactly one `ITEM_CAPTURE_COMPLETED` event after persistence.
6. Failed RPC records zero completion events and leaves retry possible.
7. Successful save refreshes inventory but not catalog.
8. Successful save clears selection.
9. No telemetry payload contains catalog identity, condition, price/value, location, email or free text.
10. Existing auth, private-inventory and smartphone-intake tests remain green.

## Activation / retention hypothesis

**Hypothesis:** forcing one clear intentional model choice, removing an unnecessary post-save catalog reload and instrumenting the attempt boundary will improve trustworthy first-item activation while giving the company a privacy-minimal completion funnel.

Primary metric once real users exist:

`capture_completion_rate = unique authenticated sessions with ITEM_CAPTURE_COMPLETED / unique authenticated sessions with ITEM_CAPTURE_STARTED`

Secondary diagnostic: median time from first `ITEM_CAPTURE_STARTED` to `ITEM_CAPTURE_COMPLETED` if server timestamps are available. Do not add client identifiers or extra payload solely to compute it.

## Next adjacent friction

After this P0 is implemented and measured, inspect the gap between a newly captured item and useful value information. Do **not** build a sell flow before the user can understand item value and total inventory value; that would skip the stated core-loop order and create activity without demonstrated usefulness.
