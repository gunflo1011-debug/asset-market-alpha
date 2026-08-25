# CEO Worker 3 — Owner-ready Android acceptance packet

Status: **BLOCKED ON DETERMINISTIC APK INPUT + LIVE TWO-USER EVIDENCE**

Packet target commit: `9626f6960e18d4072e0c12ac42bd427290f691e9` (current evidenced `main` when this packet was refreshed).

This is the owner-test contract for the current Things alpha. Do not mark it PASS until an APK is built from the intended current tested commit and the live two-account matrix passes through normal app/Auth clients. Static RLS evidence is not live two-user evidence.

## Pre-build gate — do this before spending a build attempt

1. `mobile/package-lock.json` must exist in the repository at the intended build commit.
2. From `mobile/`, `npm ci --no-audit --no-fund` must be satisfiable from `package.json` + the committed lockfile.
3. Run `npm run check:client-secrets` and `npm run typecheck`.
4. Run `node scripts/check-two-user-rls-acceptance.mjs`; expected output: `Two-user Auth/RLS acceptance static contract passed.`
5. Do not treat these static checks as proof of device behavior.

At the current target commit the lockfile is not yet evidenced as committed, so the packet remains BLOCKED before APK acceptance. The approved dependency-input path is to generate/review the lockfile first; do not substitute a hand-written or partial lockfile.

## APK artifact gate

Before installation, record all values below without credentials or tokens:

- intended/tested Git commit SHA
- successful Android workflow run ID
- artifact name (`things-alpha-android-standalone` in the current workflow contract)
- APK filename
- APK non-zero byte size

Reject the artifact if the workflow did not succeed, its SHA differs from the intended tested commit, the APK does not exist/is zero bytes, or the artifact came from an older run.

## Install path

1. Download the APK only from the successful Android workflow run recorded above.
2. Transfer/open the APK on the Android test device.
3. If Android requests permission to install unknown apps, enable it only for the browser/files source needed for this install.
4. Install the APK and launch Things from a fresh install. Do not record acceptance evidence against a previously installed older build.

## Single-account core smoke

Use a disposable normal Auth account; never service-role/admin credentials.

| Step | Action | PASS expectation |
|---|---|---|
| S1 | Fresh launch | Real backend/auth UI appears; no fake private inventory fallback. |
| S2 | Register/sign in | Normal Supabase Auth succeeds. If email confirmation is required, complete it normally. |
| S3 | Load inventory | `My devices` loads through the authenticated path. |
| S4 | Capture/add | Select a catalog device and `Add privately`; success is shown and no public listing is created. |
| S5 | Inventory | Added device appears after refresh/load and remains private. |
| S6 | Value | Unknown/unverified monetary value stays unknown/unavailable; it is never converted to €0 or an invented asking price. |
| S7 | Sell-start | Explicit owner tap opens only the private decision surface; no listing is auto-created. |
| S8 | Relaunch | Valid session restores and the private device is re-read from hosted storage. |
| S9 | Logout/login | Signed-out state exposes no private inventory; after normal re-login the same owner's device returns. |

## Exact two-account Auth/RLS matrix

This section consumes Worker 2's repository contract at `CEO_WORKER2_TWO_USER_ACCEPTANCE.md` (commits `3311a2d3` and `9626f696`). Use two disposable accounts created through normal Auth only.

| ID | Action | PASS | Immediate failure |
|---|---|---|---|
| A1 | Fresh app, sign up/sign in as A | Normal client auth succeeds | Admin/service-role required or auth fails |
| A2 | Add one disposable device as A | Device appears after refresh and remains private | Write fails/device not visible to A |
| A3 | Relaunch while A session should persist | Session restores; A device remains visible | Session lost/device disappears |
| A4 | Sign out A | Private inventory no longer accessible | Private inventory accessible signed out |
| B1 | Sign up/sign in as B | Normal client auth succeeds | Admin/service-role required or auth fails |
| B2 | Read B inventory before adding | A device/conditions absent | **STOP / P0 privacy failure:** any A-owned data visible |
| B3 | Add one disposable device as B | B device appears; A remains absent | Wrong-owner visibility/write failure |
| B4 | Relaunch as B | B session/data persist; A remains absent | Cross-owner visibility/persistence failure |
| A5 | Sign out B, sign back in A | A device visible; B device absent | **STOP / P0 privacy failure:** any B-owned data visible |
| ANON | Sign out; normal unauthenticated state | No private item/condition data exposed | **STOP / P0 privacy failure:** any private row exposed |

Do not weaken RLS for cleanup. The current client has no safe owner-delete path; disposable rows may remain in disposable accounts rather than using privileged SQL/admin cleanup.

## Error / offline / retry sanity

1. While authenticated, disable network and trigger Refresh. PASS: visible error/retry state; no fake inventory substitution.
2. Re-enable network and Refresh. PASS: hosted inventory recovers without accidental duplicate creation.
3. Attempt invalid login. PASS: user-facing auth error and no private data exposure.
4. Repeated taps while a save is busy are not evidence of repeated successful captures; inspect inventory for accidental duplicates.

## Known alpha limitations

- Verified monetary value evidence is not yet connected; truthful unknown/unavailable value states are expected.
- Sell-start is intentionally a private decision step and does not publish a marketplace listing.
- Physical-device success cannot be inferred from static tests or CI alone.
- Multi-user isolation cannot be inferred from schema/RLS inspection alone; the complete A/B matrix must pass against hosted Supabase through normal clients.
- APK acceptance is blocked until deterministic dependency input (`mobile/package-lock.json`) is committed and the intended build succeeds.

## Evidence to retain

For the acceptance run retain only:

- tested commit SHA
- workflow run ID + artifact name + APK filename/size
- Android device model and Android version
- fresh install vs upgrade
- account label only (`A`/`B`, never email/user ID)
- PASS/BLOCKED/FAIL for S1–S9, A1–A5, B1–B4 and ANON
- UTC test time
- exact failing step, expected result, actual result and reproducibility
- redacted screenshot/screen recording only if it contains no credentials/tokens
- network state where relevant

Never retain passwords, access/refresh tokens, service-role keys, private Supabase secrets, account emails, user UUIDs, item UUIDs or full auth logs.

## Acceptance decision

**PASS** only when the current intended APK is successful and integrity-checked; fresh install succeeds; normal registration/login/logout succeeds; Capture → Inventory → truthful Value → explicit Sell-start succeeds; persistence/relaunch succeeds; A→B and B→A isolation succeeds; signed-out state exposes no private inventory; and offline/retry sanity shows no privacy/data-corruption failure.

Use **BLOCKED** when a prerequisite such as deterministic lockfile/APK/two normal accounts is missing. Use **FAIL** when an executed acceptance step violates its expected behavior. Any cross-account or anonymous private-data visibility is an immediate **STOP / P0 privacy failure**.
