# Asset Market Alpha

Private-by-default smartphone ownership market experiment.

## Product hypothesis
Real buyer demand can activate privately held devices that were not publicly listed for sale.

## Alpha scope
- private smartphone inventory
- condition snapshots
- explicit offer permission
- anonymous buyer intents
- server-authoritative matching
- fresh condition check before reservation
- local handover only
- no integrated payment or shipping

## Core invariants
- private inventory is never publicly browseable
- one live match per item
- one live owner activation per buyer intent
- clients cannot set market/trust state directly
- reservations require match-bound fresh condition evidence
- a verified trade requires bilateral confirmation of the same final price

## Current milestone
Build and run the PostgreSQL/Supabase security + concurrency gate before connecting the alpha UI to a real backend.
