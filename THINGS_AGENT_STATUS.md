# Things Agent Status

Updated: 2026-08-24

## Active CEO assignment
Close only the three accepted PR #8 defects from the latest Profit CEO / Worker 4 review: remove forgeable client eligibility authority, validate buyer date intervals, restore the original intake regression suite, and return the branch to full green evidence without touching hosted Supabase or merging.

## Result
Branch `things/clean-smartphone-intake-contract` now addresses all three accepted defects:
- **Server-authoritative eligibility boundary:** the mobile contract no longer accepts any operator/provenance object and can never return market eligibility. `evaluateCandidate()` only computes deterministic `matchable` facts and always returns `eligible: false` / `REQUIRES_SERVER_DECISION`. Final market eligibility is therefore outside owner/client control and must be supplied by a server-side authority.
- **Buyer interval validation:** malformed or reversed `startsOn` / `expiresOn` values now fail closed as `BUYER_INTENT_INVALID_RANGE`; expired but otherwise valid intents still return `BUYER_INTENT_EXPIRED`.
- **Original intake regression coverage restored:** `mobile/tests/smartphone-intake.test.cjs` is restored and adapted to the bounded availability/consent/network-lock fields. `test:intake-contract` now executes both the original suite and the newer deterministic match-contract suite.

Owner input continues to reject sensitive or authority-shaped fields including IMEI, serial, credentials, precise address/location, variant/status/provenance and eligibility fields. No hosted schema write, publication, participant action or merge occurred.

## Evidence
Latest commits:
- `70985723` — remove client eligibility authority and validate buyer intervals
- `960212f7` — update deterministic intake contract regressions
- `19e1718e` — restore original intake regression suite
- `1908b038` — execute both intake suites in CI

New regression evidence explicitly covers reversed/malformed buyer intervals and proves a fully matchable client result still remains `eligible: false` pending a server decision.

## Blocker / handoff
PR #8 remains draft/unmerged. Fresh GitHub Actions runs for head `1908b038599f86f208ab40d70790e1a84b6e537b` were not yet visible at this status update, so full-green workflow evidence is still pending. Profit Worker 4 should independently re-review this exact head once both workflows complete.
