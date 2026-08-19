create or replace function private.claim_candidate(p_buyer_intent uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
  v_match uuid;
begin
  perform 1 from private.buyer_intents bi
  where bi.id=p_buyer_intent and bi.status in ('ACTIVE','MATCHING')
  for update;
  if not found then return null; end if;

  select i.id into v_item
  from public.items i
  join private.item_market_state ims on ims.item_id=i.id
  join private.buyer_intents bi on bi.id=p_buyer_intent
  join lateral (
    select cs.* from public.condition_snapshots cs
    where cs.item_id=i.id order by cs.captured_at desc limit 1
  ) c on true
  where i.variant_id=bi.variant_id
    and ims.market_state='MARKET_ELIGIBLE'
    and ims.possession_status='VERIFIED'
    and (bi.min_battery is null or c.battery_health >= bi.min_battery)
    and (not bi.require_intact_display or c.display_state='INTACT')
    and (not bi.require_biometrics or c.biometrics_working)
    and not exists (
      select 1 from private.matches m where m.item_id=i.id
      and m.status in ('OWNER_CONTACTED','OWNER_INTERESTED','CONDITION_REFRESHED','BUYER_RECONFIRMED','RESERVED','MEETING_AGREED')
    )
  order by c.captured_at desc
  for update of ims skip locked
  limit 1;

  if v_item is null then return null; end if;

  insert into private.matches(item_id,buyer_intent_id,status,response_deadline)
  values(v_item,p_buyer_intent,'OWNER_CONTACTED',now()+interval '6 hours')
  returning id into v_match;

  update private.item_market_state set market_state='ACTIVATING',updated_at=now() where item_id=v_item;
  update private.buyer_intents set status='MATCHING' where id=p_buyer_intent;

  insert into private.match_events(match_id,actor_id,event_type,idempotency_key,payload)
  values(v_match,null,'OWNER_CONTACTED',gen_random_uuid(),jsonb_build_object('source','matcher'));

  return v_match;
end;
$$;

revoke execute on function private.claim_candidate(uuid) from public, anon, authenticated;
