# Things Supabase access and RLS audit — 2026-08-24

**Decision:** `DIRECT_PRIVATE_EXPOSURE_REFUTED__DEFENSE_IN_DEPTH_HARDENING_REQUIRED`

**Mode:** read-only. No schema, policy, grant, data, user, secret, PR, or deployment change was made.

## Executive outcome

The seven `private` tables without RLS are **not directly reachable through the current Supabase Data API configuration**. The earlier statement that they were potentially client-reachable merely because RLS was disabled was materially overstated.

Current protection is layered:

1. PostgREST exposes only `public` and `graphql_public`, not `private`.
2. `anon`, `authenticated`, `service_role`, and `PUBLIC` have no table grants on the eight private tables.
3. `anon` has neither `USAGE` nor `CREATE` on `private`.
4. `authenticated` has `USAGE` only to invoke a small allowlist of private RPCs; it has no direct private-table privileges.
5. All externally invokable private lifecycle functions are `SECURITY DEFINER`, use `search_path = ''`, schema-qualify relations, and enforce `auth.uid()`, participant/owner, and state checks.

RLS on the seven tables remains useful defense in depth, but enabling it blindly—especially with `FORCE ROW LEVEL SECURITY`—could break the intentional SECURITY DEFINER command path. It is not the immediate P0 fix.

## Current official security model

Supabase's current API security guidance distinguishes:

- **Privileges/grants:** whether a database role can reach an object at all.
- **RLS:** which rows a reachable role may access.
- **Exposed schemas:** which schemas PostgREST publishes through the Data API.

Source: [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## Live evidence

### Data API probes

| Probe | Result | Interpretation |
|---|---:|---|
| Publishable key → `public.items?select=id&limit=1` | HTTP 401 / PostgreSQL `42501 permission denied for table items` | `anon` has no direct table read |
| Publishable key + `Accept-Profile: private` → `private.buyer_intents` | HTTP 406 / PostgREST `PGRST106` | `private` is not an exposed schema |
| Publishable key + `Accept-Profile: private` → `rpc/buyer_reconfirm` | HTTP 406 / `PGRST106` | private-profile RPC access is also unavailable |

The server reported the exposed schemas as exactly `public` and `graphql_public`.

### Schema privileges

| Role | public CREATE | private CREATE | private USAGE |
|---|---:|---:|---:|
| `anon` | false | false | false |
| `authenticated` | false | false | true |
| `service_role` | false | false | false |

The authenticated `private.USAGE` grant is necessary for the explicitly granted lifecycle functions; it does not grant table access.

### Tables and RLS

- Public owner-sensitive tables `items` and `condition_snapshots` have RLS and FORCE RLS enabled with owner-bound policies.
- Other client-readable public catalog tables have authenticated read policies.
- `private.alpha_events` has RLS enabled and an explicit deny policy for authenticated direct access.
- Seven remaining private tables have RLS disabled, but none has direct client-role table grants:
  `buyer_intents`, `item_market_state`, `liquidity_contracts`, `match_condition_evidence`, `match_events`, `matches`, `trade_receipts`.

### RPC review

Externally executable private lifecycle functions reviewed:

- `private.buyer_reconfirm`
- `private.confirm_handover`
- `private.create_reservation`
- `private.refresh_trade_condition`

They are authenticated-only; `private.claim_candidate` is not executable by `anon` or `authenticated`.

Public authenticated command functions reviewed:

- `public.add_private_device`
- `public.add_private_thing`
- `public.track_alpha_event`
- `public.alpha_backend_info`

The first three intentionally use SECURITY DEFINER to cross from an authenticated client into protected tables. Each checks authentication and ownership/input constraints. `alpha_backend_info` is SECURITY INVOKER in the live database.

## Advisor and migration findings

Supabase Security Advisor reports no ERROR and does not flag the seven non-exposed private tables as missing-RLS vulnerabilities.

It does report WARN `0029_authenticated_security_definer_function_executable` for:

- `public.add_private_device`
- `public.add_private_thing`
- `public.track_alpha_event`

Reference: [Supabase database linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

These warnings describe privileged authenticated RPC entry points. Blindly revoking EXECUTE would break the app; each should remain only if regression tests prove owner isolation and denied cross-owner access.

The live migration history contains `alpha_backend_info_invoker` after `alpha_backend_info`, explaining why the live function is SECURITY INVOKER. The repository snapshot reviewed contains the earlier SECURITY DEFINER definition but did not contain the follow-up migration. A clean replay from the repository can therefore diverge from production and recreate a weaker function definition.

The advisor also reports leaked-password protection disabled. Reference: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Ranked handoff

### P0 — repository owner, before merge/replay

1. Add the missing `alpha_backend_info_invoker` migration to the repository, or add an idempotent successor that explicitly sets `public.alpha_backend_info()` to SECURITY INVOKER.
2. Add a schema-drift regression asserting that repository migrations reproduce the live function security mode.

### P1 — PR owner, before closed alpha

1. Harden the three intentional public SECURITY DEFINER RPCs to `search_path = ''` and schema-qualify every referenced object/builtin that needs resolution.
2. Retain authenticated EXECUTE only with tests for:
   - unauthenticated denial,
   - cross-owner denial,
   - owner success,
   - invalid input denial,
   - idempotency/state constraints.
3. Add a hosted gate asserting:
   - exposed schemas remain exactly `public, graphql_public`,
   - no client role gains private-table privileges,
   - `anon` cannot execute authenticated RPCs,
   - private profile requests fail closed.

### P2 — architecture owner

1. Keep `private` unexposed. If a future client API is needed, expose a purpose-built API schema or narrow wrapper functions rather than `private`.
2. Treat RLS on private tables as defense in depth and design policies around the command model before enabling it.
3. Enable leaked-password protection when the project plan and owner account allow it.

## Release implication

This audit does **not** make PR #3 merge-ready. The live authenticated hosted smoke still needs a dedicated non-privileged test identity and secrets, and the repository migration drift plus authenticated SECURITY DEFINER warnings should be resolved or explicitly accepted first.

**User action now:** none. The next work belongs to the repository/PR owner; no personal account or password should be placed in chat.


## Remediation executed — 2026-08-24

**Status:** `P0_CLOSED__RPC_BOUNDARIES_HARDENED`

Repository delivery:

- `b47500caed180ed11b0fde113de2c6491a06a99d` adds the idempotent successor migration `20260824115500_rpc_security_reproducibility.sql`.
- `c48f9cbd695b4ee433e8503cc38be4a9e42ad279` adds a 10-assertion pgTAP contract covering SECURITY INVOKER/DEFINER modes, empty search paths, anonymous denial, authenticated allowlisting, and conditional hardening of the generic Things command.

Hosted migration `rpc_security_reproducibility` applied successfully without touching application data. Exact live readback now proves:

| Function | Mode | search_path | anon EXECUTE | authenticated EXECUTE |
|---|---|---|---:|---:|
| `alpha_backend_info()` | SECURITY INVOKER | empty | false | true |
| `add_private_device(...)` | SECURITY DEFINER | empty | false | true |
| `add_private_thing(text,text)` | SECURITY DEFINER | empty | false | true |
| `track_alpha_event(text,uuid)` | SECURITY DEFINER | empty | false | true |

The live migration ledger records `rpc_security_reproducibility`. Supabase Security Advisor still reports the three expected lint-0029 warnings for intentional authenticated command RPCs, plus leaked-password protection disabled. It reports no ERROR. These three warnings are accepted architecture signals pending authenticated owner/cross-owner behavior evidence; the dangerous mutable search path has been removed.

The repository backend workflow is push-triggered and will rebuild migrations, run pgTAP, lint, and the real concurrency gate. Its check-run identifier was not exposed through the available commit-status interface during this run, so no green GitHub Actions claim is made here. The hosted schema assertions and migration application are green; PR #3 remains unmerged.
