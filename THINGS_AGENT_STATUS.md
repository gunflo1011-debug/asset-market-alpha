# Things App Agent Status

## Long-term objective
Build Things into a private-by-default app people can use to manage the physical things they own, with a path to global-scale usefulness and adoption.

## Current product milestone
Remove the smartphone-only inventory constraint without weakening the existing private-data security model.

## In progress
PR #4 (`things/generic-private-items`) adds the first generic Thing flow:
- any authenticated user can save an arbitrary Thing with only a name
- optional category and storage location are supported
- generic Things are not inserted into marketplace state
- catalog-backed smartphones remain available as a structured device path
- existing owner-only RLS remains the privacy boundary
- dedicated pgTAP coverage protects RPC authorization and the item identity constraint

## Evidence
Head commit: `0811583fc19eaa7037c1e6e992d1831d3c395755`
PR: https://github.com/gunflo1011-debug/asset-market-alpha/pull/4

## Current blocker
GitHub Actions checks for the latest PR head were not observable yet in the automation runtime. Do not merge until the mobile TypeScript/export gate and backend security gate have completed successfully.

## Next highest-value step after merge
Make generic Things genuinely manageable rather than append-only: add owner-safe edit/archive flows and a simple inventory search/filter experience, while keeping marketplace activation explicitly opt-in.
