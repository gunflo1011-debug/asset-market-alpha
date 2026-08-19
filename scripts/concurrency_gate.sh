#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ITEM="00000000-0000-0000-0000-000000000401"
A="00000000-0000-0000-0000-000000000501"
B="00000000-0000-0000-0000-000000000502"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
delete from private.match_events where match_id in (select id from private.matches where item_id='$ITEM'::uuid);
delete from private.matches where item_id='$ITEM'::uuid;
update private.item_market_state set market_state='MARKET_ELIGIBLE' where item_id='$ITEM'::uuid;
update private.buyer_intents set status='ACTIVE' where id in ('$A'::uuid,'$B'::uuid);
SQL

(
  sleep 0.2
  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select private.claim_candidate('$A'::uuid);"
) >/tmp/claim_a.txt 2>/tmp/claim_a.err &
PA=$!
(
  sleep 0.2
  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select private.claim_candidate('$B'::uuid);"
) >/tmp/claim_b.txt 2>/tmp/claim_b.err &
PB=$!
wait "$PA"
wait "$PB"

ACTIVE=$(psql "$DB_URL" -Atc "select count(*) from private.matches where item_id='$ITEM'::uuid and status in ('OWNER_CONTACTED','OWNER_INTERESTED','CONDITION_REFRESHED','BUYER_RECONFIRMED','RESERVED','MEETING_AGREED');")
EVENTS=$(psql "$DB_URL" -Atc "select count(*) from private.match_events e join private.matches m on m.id=e.match_id where m.item_id='$ITEM'::uuid and e.event_type='OWNER_CONTACTED';")

if [ "$ACTIVE" != "1" ]; then echo "FAIL: live matches=$ACTIVE expected=1"; exit 1; fi
if [ "$EVENTS" != "1" ]; then echo "FAIL: OWNER_CONTACTED events=$EVENTS expected=1"; exit 1; fi

echo "PASS: contested item produced exactly one live match and one OWNER_CONTACTED event."
echo "Worker A: $(cat /tmp/claim_a.txt)"
echo "Worker B: $(cat /tmp/claim_b.txt)"
