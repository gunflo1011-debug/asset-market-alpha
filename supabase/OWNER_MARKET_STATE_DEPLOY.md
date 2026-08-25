# Owner market-state read RPC — deploy runbook

Migration: `supabase/migrations/20260825104500_owner_inventory_market_state.sql`

## Purpose
Expose only `(item_id, market_state)` for the authenticated owner's own items so the mobile app can exclude `SOLD` items from current ownership. The function is read-only and does not mutate product data.

## Preflight
Run from repository root:

```bash
node scripts/check-owner-market-state-migration.mjs
```

The check fails if the migration loses the owner predicate, hardened search path, privilege restrictions, or introduces data/schema mutation statements.

## Hosted apply (approval required)
Apply exactly `20260825104500_owner_inventory_market_state.sql` through the normal Supabase migration mechanism. Do not hand-edit the hosted function.

## Post-deploy verification
As authenticated user A, call `load_my_inventory_market_states()`: every returned `item_id` must belong to A. A SOLD item owned by A may be returned as `SOLD`; an item owned by user B must never be returned. Anonymous execution must be denied.

## Rollback
If verification fails, execute:

```sql
revoke all on function public.load_my_inventory_market_states() from public, anon, authenticated;
drop function if exists public.load_my_inventory_market_states();
```

The mobile inventory path is designed to fail closed when authoritative market-state evidence is unavailable, so rollback must not cause SOLD items to be asserted as verified current ownership.
