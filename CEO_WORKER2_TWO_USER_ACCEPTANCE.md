# CEO Worker 2 — Two-user Auth/RLS acceptance

Status: STATIC CONTRACT READY; LIVE TWO-USER EVIDENCE STILL REQUIRED.

## Safety boundary
Use only normal Supabase anon-key client authentication. Never use service-role/admin SQL to prove user isolation. Use disposable test accounts/items only. Do not expose emails, passwords, tokens, user IDs, or item IDs in the handoff.

## Preconditions
- Current app build points to the intended hosted Supabase project using `EXPO_PUBLIC_SUPABASE_URL` + anon key only.
- Two disposable normal accounts exist: Account A and Account B.
- Catalog contains at least one product variant.
- `load_my_inventory_market_states` is available; if not, inventory intentionally fails closed and the acceptance result is BLOCKED rather than PASS.

## Exact pass/fail matrix
| Step | Action | PASS | FAIL |
|---|---|---|---|
| A1 | Fresh app start, sign up/sign in as A | Auth succeeds through normal client path | Admin/service-role needed or auth fails |
| A2 | Add one disposable device as A | Device appears after refresh and remains private | Write fails or device not visible to A |
| A3 | Relaunch app while A session is expected to persist | Session restores and A device remains visible | Session unexpectedly lost or A device disappears |
| A4 | Sign out A | Authenticated inventory is no longer accessible | Private inventory remains accessible without session |
| B1 | Sign up/sign in as B | B authenticates normally | Admin/service-role needed or auth fails |
| B2 | Read inventory as B before creating anything | A device is absent | Any A-owned row or condition is visible: STOP / privacy failure |
| B3 | Add one disposable device as B | B device appears and A device remains absent | Wrong owner visibility or write failure |
| B4 | Relaunch as B | B session/data persist; A data remains absent | Cross-owner visibility or persistence failure |
| A5 | Sign out B, sign back in as A | A device visible; B device absent | Any B-owned row/condition visible: STOP / privacy failure |
| ANON | Sign out and attempt normal unauthenticated private read | No private item/condition rows readable | Any private row readable: STOP / privacy failure |

## Disposable data and cleanup
Prefer uniquely recognizable test-device metadata only if the normal product UI allows it; do not insert hidden identifiers. Current client has no safe owner-delete command, so do not add/delete production rows through privileged SQL merely to clean up this test. If disposable test rows cannot be safely deleted through a normal owner path, leave them in the disposable test accounts and record cleanup as a follow-up rather than weakening RLS.

## Evidence to retain
Record only: app commit/build identifier, PASS/BLOCKED/FAIL per matrix row, device/OS version, UTC test time, and redacted error text. Never retain credentials, access/refresh tokens, account emails, user UUIDs, or item UUIDs.

## Static automated gate
Run `node mobile/scripts/check-two-user-rls-acceptance.mjs`. It verifies the repository still contains normal signup/signin/logout/session restore, owner-scoped inventory access, FORCE RLS, owner-only item/condition policies, anonymous grant reset, privileged-key refusal, and a cross-owner leakage assertion in the hosted smoke.

## Remaining runtime gap
Static RLS is not equivalent to a real two-user test. Final PASS requires the complete A/B matrix above against the hosted project through normal app/auth clients.
