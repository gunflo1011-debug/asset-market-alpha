# Owner market-state read RPC — exact approval gate

Migration: `supabase/migrations/20260825104500_owner_inventory_market_state.sql`

## Purpose
Expose only `(item_id, market_state)` for the authenticated owner's own items so the mobile app can exclude `SOLD` items from current ownership. The function is read-only and does not mutate product data.

## Approval scope
Approval authorizes **one hosted schema mutation only**: apply exactly `supabase/migrations/20260825104500_owner_inventory_market_state.sql` through the normal Supabase migration mechanism. Do not hand-edit the hosted function and do not apply unrelated pending migrations in the same approval.

## Required preflight
From repository root:

```bash
node scripts/check-owner-market-state-migration.mjs
```

Success criterion: exit code 0 and `owner market-state migration contract: OK`. The backend security workflow also runs this contract before starting local Supabase. Do not deploy if this check fails.

## Exact hosted mutation
The migration creates/replaces only `public.load_my_inventory_market_states()` and sets its execution privileges. The function returns `(item_id, market_state)`, joins `private.item_market_state` to `public.items`, filters by `i.owner_id = auth.uid()`, is `SECURITY DEFINER` with an empty `search_path`, revokes access from `public`/`anon`, and grants execute to `authenticated`.

## Required postflight
After the hosted migration, verify all of the following before treating SOLD filtering as production-ready:

1. Authenticated user A can execute `load_my_inventory_market_states()`.
2. Every returned `item_id` belongs to user A.
3. A `SOLD` item owned by A is returned as `SOLD` when such a fixture exists.
4. An item owned by user B is never returned to A.
5. Anonymous execution is denied.
6. The mobile inventory load succeeds for A and excludes returned `SOLD` items from current ownership.

**Success criterion:** all applicable checks pass. If any ownership-isolation, privilege, RPC, or mobile fail-closed check fails, rollback immediately and do not claim production readiness.

## Exact rollback
Execute only:

```sql
revoke all on function public.load_my_inventory_market_states() from public, anon, authenticated;
drop function if exists public.load_my_inventory_market_states();
```

Then confirm anonymous/authenticated calls no longer execute the RPC. The mobile inventory path is designed to fail closed when authoritative market-state evidence is unavailable, so rollback must not cause SOLD items to be asserted as verified current ownership.

## Single approval request
`Approve applying only supabase/migrations/20260825104500_owner_inventory_market_state.sql to the hosted Supabase project, followed immediately by the six postflight checks above, with the documented RPC revoke/drop rollback on any failure.`

No hosted write is part of preparing this gate; deployment requires that explicit approval.
