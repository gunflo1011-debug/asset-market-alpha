# Mobile architecture

The mobile app is moving from a single-screen prototype toward feature-oriented modules without rewriting working release-critical behavior.

## Boundaries

- `App.tsx` is the composition/root screen. It should coordinate authentication state, navigation-level state and feature composition, but not accumulate domain parsing or backend command details.
- `src/data/` is the compatibility/data-access boundary used by the app. Files here should stay thin and focused on Supabase calls, owner-safe data loading and backend commands.
- `src/features/<feature>/` owns feature-specific types, input normalization, presentation helpers and, progressively, UI components.
- `src/lib/` contains cross-feature infrastructure and small domain-independent helpers such as Supabase configuration, activation transitions and sale-start primitives.
- `scripts/` contains release contracts. Guards should validate behavior/semantics rather than exact copy or formatting wherever possible.

## Inventory

Inventory is the first feature being modularized because it is the core Things workflow.

- `src/features/inventory/types.ts` owns inventory domain types.
- `src/features/inventory/input.ts` owns deterministic normalization from UI input into RPC arguments.
- `src/data/inventory.ts` owns authenticated Supabase access, fail-closed catalog-device ownership filtering and CRUD command calls.

The compatibility exports from `src/data/inventory.ts` remain in place so UI refactors do not require a large-bang migration.

## Next extraction order

1. Inventory presentation helpers and item/form components.
2. Auth and recovery screens.
3. Account screen.
4. Shared theme/tokens and common controls.
5. Keep `App.tsx` as a small composition layer.

Each extraction should keep mobile CI and backend security gates green. Refactoring must not weaken owner/RLS, SOLD-state, explicit-sale-intent or deep-link contracts.
