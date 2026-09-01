-- Preserve reservation compatibility for older alpha clients while preventing the
-- legacy lifecycle RPC from marking a Thing SOLD without an explicit final price.
-- SOLD completion must use v2 so asking price can never be mistaken for transaction price.
create or replace function public.set_my_marketplace_conversation_status(
  p_conversation_id uuid,
  p_status text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_status = 'SOLD' then
    raise exception 'FINAL_SALE_PRICE_REQUIRED_USE_V2';
  end if;
  if p_status <> 'RESERVED' then
    raise exception 'INVALID_LIFECYCLE_STATUS';
  end if;

  return public.set_my_marketplace_conversation_status_v2(
    p_conversation_id,
    'RESERVED',
    null
  );
end;
$$;

revoke all on function public.set_my_marketplace_conversation_status(uuid,text) from public, anon;
grant execute on function public.set_my_marketplace_conversation_status(uuid,text) to authenticated;

comment on function public.set_my_marketplace_conversation_status(uuid,text) is
  'Legacy compatibility wrapper: authenticated sellers may still reserve, but SOLD requires v2 with an explicit final transaction price.';
