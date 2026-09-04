#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ITEM="00000000-0000-0000-0000-000000000401"
SELLER="00000000-0000-0000-0000-000000000101"
BUYER="00000000-0000-0000-0000-000000000201"
CONVERSATION="00000000-0000-0000-0000-0000000006f1"
IMAGE="00000000-0000-0000-0000-000000000bf1"

# Seed one published Thing with one seller-selected Marketplace image and one OPEN buyer conversation.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
delete from private.marketplace_offers where conversation_id in (select id from private.marketplace_conversations where item_id='$ITEM'::uuid);
delete from private.marketplace_conversations where item_id='$ITEM'::uuid;

insert into private.marketplace_listings(item_id,seller_id,asking_price_cents,status,published_at,updated_at,public_title,public_category,sold_price_cents)
values('$ITEM'::uuid,'$SELLER'::uuid,65000,'PUBLISHED',now(),now(),'Image race Thing','Test',null)
on conflict(item_id) do update set seller_id=excluded.seller_id,asking_price_cents=excluded.asking_price_cents,status='PUBLISHED',published_at=now(),updated_at=now(),public_title=excluded.public_title,public_category=excluded.public_category,sold_price_cents=null;

insert into private.item_images(id,item_id,owner_id,storage_path,sort_order,is_primary,marketplace_visible)
values('$IMAGE'::uuid,'$ITEM'::uuid,'$SELLER'::uuid,'$SELLER/$ITEM/reservation-race.jpg',0,true,true)
on conflict(id) do update set marketplace_visible=true;

insert into private.marketplace_conversations(id,item_id,buyer_id,seller_id,status)
values('$CONVERSATION'::uuid,'$ITEM'::uuid,'$BUYER'::uuid,'$SELLER'::uuid,'OPEN');

update private.item_market_state set market_state='MARKET_ELIGIBLE',updated_at=now() where item_id='$ITEM'::uuid;
SQL

# Reservation obtains the per-Thing lock and deliberately holds the transaction open.
# The image toggle starts while that lock is held. Correct behavior: it waits, then
# re-reads RESERVED and fails instead of committing an image mutation afterwards.
(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$SELLER',true);
select public.set_my_marketplace_conversation_status_v2('$CONVERSATION'::uuid,'RESERVED',null);
select pg_sleep(1);
commit;
SQL
) >/tmp/image_race_reserve.out 2>/tmp/image_race_reserve.err &
RESERVE_PID=$!

sleep 0.2
set +e
psql "$DB_URL" -v ON_ERROR_STOP=1 -At <<SQL >/tmp/image_race_toggle.out 2>/tmp/image_race_toggle.err
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$SELLER',true);
select public.set_my_item_image_marketplace_visibility('$ITEM'::uuid,'$IMAGE'::uuid,false);
commit;
SQL
TOGGLE_RC=$?
wait "$RESERVE_PID"
RESERVE_RC=$?
set -e

if [ "$RESERVE_RC" -ne 0 ]; then
  echo "FAIL: reservation transaction failed"
  cat /tmp/image_race_reserve.err
  exit 1
fi
if [ "$TOGGLE_RC" -eq 0 ]; then
  echo "FAIL: concurrent image toggle committed after reservation"
  cat /tmp/image_race_toggle.out
  exit 1
fi
if ! grep -q 'MARKETPLACE_IMAGES_LOCKED_FOR_TRANSACTION' /tmp/image_race_toggle.err; then
  echo "FAIL: image toggle failed for an unexpected reason"
  cat /tmp/image_race_toggle.err
  exit 1
fi

STATUS=$(psql "$DB_URL" -Atc "select status from private.marketplace_conversations where id='$CONVERSATION'::uuid;")
VISIBLE=$(psql "$DB_URL" -Atc "select marketplace_visible from private.item_images where id='$IMAGE'::uuid;")

if [ "$STATUS" != "RESERVED" ]; then echo "FAIL: conversation status=$STATUS expected=RESERVED"; exit 1; fi
if [ "$VISIBLE" != "t" ]; then echo "FAIL: selected Marketplace image changed after reservation"; exit 1; fi

echo "PASS: reservation serialized against concurrent image selection; RESERVED committed and the selected image remained frozen."
