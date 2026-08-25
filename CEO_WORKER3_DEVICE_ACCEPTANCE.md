# CEO Worker 3 — Device-ready Android acceptance packet

Status: **BLOCKED ON CURRENT APK ARTIFACT + LIVE SECOND ACCOUNT EVIDENCE**

This packet is the owner-test contract for the current Things alpha. It must not be marked PASS until the APK is built from the current tested commit and the two-account hosted isolation proof is available.

## Artifact gate

Before installation, record all four values:

- Git commit SHA
- GitHub Actions run ID
- artifact name (`things-alpha-android-standalone` in the current workflow)
- APK filename and non-zero size

Reject the artifact if its run is not successful, the commit is not the intended current product commit, or the APK integrity/existence check did not run successfully.

## Install

1. Download the APK only from the successful GitHub Actions run for the recorded commit.
2. On the Android test device, allow installation from the browser/files app only for this install if Android requests it.
3. Install the APK.
4. Launch Things from a fresh install. Do not reuse an older installed build when recording acceptance evidence.

## Single-account core smoke

Use a disposable normal Auth account. Do not use service-role/admin credentials.

1. **Fresh launch:** app opens without a fake-inventory fallback. Expected: real backend/auth screen appears.
2. **Register:** create the disposable account through the app. Expected: normal Supabase Auth behavior; if email confirmation is required, complete it normally.
3. **Login:** sign in. Expected: `My devices` private inventory screen loads.
4. **Capture/add:** select a catalog device and tap `Add privately`. Expected: success message says the device was saved privately and no public listing was created.
5. **Inventory:** expected: the new device appears after refresh/load and remains private.
6. **Value:** expected: total known inventory value remains unavailable until verified value evidence exists; unknown values must never be displayed/count as €0. Item sale surface must likewise avoid an invented asking price.
7. **Sell-start:** tap the item's sale action. Expected: only a private decision surface opens; no listing is created automatically.
8. **Relaunch/persistence:** fully close and reopen the app. Expected: session restores when valid and the private item is re-read from hosted storage.
9. **Logout/login:** sign out, then sign back in. Expected: the same owner's private inventory reappears.

## Two-account isolation acceptance

Requires two disposable accounts created through normal Auth.

1. Account A creates Item A and verifies it persists after relaunch/re-login.
2. Sign out A; sign in Account B.
3. Expected: B cannot see Item A or any condition data belonging to A.
4. B creates Item B and verifies it persists.
5. Sign out B; sign back in A.
6. Expected: A sees Item A and cannot see Item B or B's condition data.
7. Anonymous/not-signed-in state must never expose private owner inventory.

Any cross-account visibility is an immediate **STOP / P0 privacy failure**. Do not continue broader testing until fixed.

## Error / offline / retry sanity

1. With the app open, temporarily disable network access and trigger a refresh. Expected: an error is surfaced; fake inventory is not substituted.
2. Re-enable network and retry Refresh. Expected: hosted inventory can load again without duplicating an item.
3. Attempt an invalid login. Expected: user-friendly auth error; no private data appears.
4. Repeated taps while a save is busy should not be treated as evidence of multiple successful captures; verify inventory for accidental duplicates.

## Known limitations / expected alpha behavior

- Verified monetary value evidence is not yet connected, so truthful `unknown/unavailable` value states are expected.
- Sell-start is intentionally a private decision step; it does not publish a marketplace listing.
- Physical-device success must not be claimed from static tests or CI alone.
- Multi-user isolation must not be claimed from schema/RLS inspection alone; the two-account recipe above must pass against hosted Supabase.
- The current Android workflow requires `mobile/package-lock.json` for `npm ci`; if that lockfile is absent on the tested commit, the APK build is blocked before product acceptance.

## Bug report fields

For every failure record:

- tested commit SHA
- GitHub Actions run ID + artifact name
- Android device model
- Android version
- fresh install vs upgrade
- account label only (`A` or `B`; never email/token/password)
- exact test step
- expected result
- actual result
- reproducible yes/no and reproduction steps
- screenshot/screen recording if it contains no credentials/tokens
- network state (online/offline/recovered)

Never paste passwords, access/refresh tokens, service-role keys, private Supabase secrets, or full auth logs into a bug report.

## Acceptance decision

**PASS** only when: current APK artifact is successful and integrity-checked; fresh install succeeds; registration/login/logout succeeds; Capture → Inventory → truthful Value → explicit Sell-start succeeds; persistence/relaunch succeeds; A→B and B→A isolation succeeds; anon sees no private inventory; offline/retry sanity has no privacy/data-corruption failure.

Otherwise report **BLOCKED** or **FAIL** with the exact failing gate rather than masking it.
