-- Prevent a RESERVED/SOLD source item from ever becoming publicly listed again.
-- This is a database-level lifecycle invariant so future RPC/client changes cannot bypass it.

create or replace function private.guard_marketplace_listing_republish()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.status = 'PUBLISHED' and (
    exists (
      select 1
      from private.marketplace_conversations c
      where c.item_id = new.item_id
        and c.status in ('RESERVED', 'SOLD')
    )
    or exists (
      select 1
      from private.item_market_state s
      where s.item_id = new.item_id
        and s.market_state in ('RESERVED', 'SOLD')
    )
  ) then
    raise exception 'MARKETPLACE_TRANSACTION_LOCKED';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_marketplace_listing_republish() from public, anon, authenticated;

drop trigger if exists marketplace_listing_republish_guard on private.marketplace_listings;
create trigger marketplace_listing_republish_guard
before insert or update of status on private.marketplace_listings
for each row
execute function private.guard_marketplace_listing_republish();
