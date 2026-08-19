# CI verification

This branch exists to force the first pull-request-triggered execution of the backend security gate.

Expected gate:
1. start local Supabase
2. rebuild from migrations
3. run pgTAP tests
4. lint database
5. run real two-process PostgreSQL concurrency test
