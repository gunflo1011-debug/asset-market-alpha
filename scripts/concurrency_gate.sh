#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ITEM="00000000-0000-0000-0000-000000000401"
A="00000000-0000-0000-0000-000000000501"
B="00000000-0000-0000-0000-000000000502"
SELLER="00000000-0000-0000-0000-000000000101"
BUYER_A="00000000-0000-0000-0000-000000000201"
BUYER_B="00000000-0000-0000-0000-000000000202"
CONVERSATION_A="00000000-0000-0000-0000-000000000601"
CONVERSATION_B="00000000-0000-0000-0000-000000000602"
OFFER_A="00000000-0000-0000-0000-000000000701"
OFFER_B="00000000-0000-0000-0000-000000000702"

# Existing contested-match concurrency contract.
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

# Marketplace offer acceptance has a different concurrency boundary: two OPEN buyer
# conversations can exist for the same Thing. Runtime-test the per-Thing transaction
# lock used by respond_to_my_marketplace_offer(), not only its static/pgTAP contract.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
delete from private.marketplace_conversations where item_id='$ITEM'::uuid;
update private.item_market_state set market_state='MARKET_ELIGIBLE' where item_id='$ITEM'::uuid;

insert into private.marketplace_conversations(id,item_id,buyer_id,seller_id,status)
values
  ('$CONVERSATION_A'::uuid,'$ITEM'::uuid,'$BUYER_A'::uuid,'$SELLER'::uuid,'OPEN'),
  ('$CONVERSATION_B'::uuid,'$ITEM'::uuid,'$BUYER_B'::uuid,'$SELLER'::uuid,'OPEN');

insert into private.marketplace_offers(id,conversation_id,proposer_id,amount_cents,message,status)
values
  ('$OFFER_A'::uuid,'$CONVERSATION_A'::uuid,'$BUYER_A'::uuid,61000,'runtime race A','PENDING'),
  ('$OFFER_B'::uuid,'$CONVERSATION_B'::uuid,'$BUYER_B'::uuid,62000,'runtime race B','PENDING');
SQL

run_seller_accept() {
  local offer_id="$1"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$SELLER',true);
select public.respond_to_my_marketplace_offer('$offer_id'::uuid,'ACCEPT',null,null);
commit;
SQL
}

(
  sleep 0.2
  run_seller_accept "$OFFER_A"
) >/tmp/offer_accept_a.txt 2>/tmp/offer_accept_a.err &
OA=$!
(
  sleep 0.2
  run_seller_accept "$OFFER_B"
) >/tmp/offer_accept_b.txt 2>/tmp/offer_accept_b.err &
OB=$!

set +e
wait "$OA"; RC_A=$?
wait "$OB"; RC_B=$?
set -e

if { [ "$RC_A" -eq 0 ] && [ "$RC_B" -eq 0 ]; } || { [ "$RC_A" -ne 0 ] && [ "$RC_B" -ne 0 ]; }; then
  echo "FAIL: expected exactly one concurrent offer ACCEPT to succeed; rc_a=$RC_A rc_b=$RC_B"
  echo "Accept A stderr: $(cat /tmp/offer_accept_a.err)"
  echo "Accept B stderr: $(cat /tmp/offer_accept_b.err)"
  exit 1
fi

RESERVED_CONVERSATIONS=$(psql "$DB_URL" -Atc "select count(*) from private.marketplace_conversations where item_id='$ITEM'::uuid and status='RESERVED';")
CLOSED_CONVERSATIONS=$(psql "$DB_URL" -Atc "select count(*) from private.marketplace_conversations where item_id='$ITEM'::uuid and status='CLOSED';")
ACCEPTED_OFFERS=$(psql "$DB_URL" -Atc "select count(*) from private.marketplace_offers o join private.marketplace_conversations c on c.id=o.conversation_id where c.item_id='$ITEM'::uuid and o.status='ACCEPTED';")
SOLD_CONVERSATIONS=$(psql "$DB_URL" -Atc "select count(*) from private.marketplace_conversations where item_id='$ITEM'::uuid and status='SOLD';")
ITEM_STATE=$(psql "$DB_URL" -Atc "select market_state from private.item_market_state where item_id='$ITEM'::uuid;")

if [ "$RESERVED_CONVERSATIONS" != "1" ]; then echo "FAIL: reserved conversations=$RESERVED_CONVERSATIONS expected=1"; exit 1; fi
if [ "$CLOSED_CONVERSATIONS" != "1" ]; then echo "FAIL: closed competing conversations=$CLOSED_CONVERSATIONS expected=1"; exit 1; fi
if [ "$ACCEPTED_OFFERS" != "1" ]; then echo "FAIL: accepted offers=$ACCEPTED_OFFERS expected=1"; exit 1; fi
if [ "$SOLD_CONVERSATIONS" != "0" ]; then echo "FAIL: offer acceptance must not imply SOLD; sold conversations=$SOLD_CONVERSATIONS"; exit 1; fi
if [ "$ITEM_STATE" != "RESERVED" ]; then echo "FAIL: item market state=$ITEM_STATE expected=RESERVED"; exit 1; fi

echo "PASS: concurrent Marketplace accepts produced exactly one RESERVED winner, one CLOSED competitor, one ACCEPTED offer, and no SOLD transition."
echo "Accept A rc=$RC_A output: $(tr '\n' ' ' </tmp/offer_accept_a.txt)"
echo "Accept B rc=$RC_B output: $(tr '\n' ' ' </tmp/offer_accept_b.txt)"
