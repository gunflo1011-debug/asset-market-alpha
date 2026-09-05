-- Allow legitimate numeric district/place labels such as "Hamburg 16" while
-- keeping Marketplace location deliberately coarse. The previous blanket digit
-- rejection was too strict and rejected valid user-entered area labels.

create or replace function public.save_my_marketplace_listing_v2(
  p_item_id uuid,
  p_asking_price_cents bigint,
  p_publish boolean,
  p_public_location text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
  v_public_location text := nullif(btrim(p_public_location), '');
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_asking_price_cents is null or p_asking_price_cents < 1 or p_asking_price_cents > 1000000000 then
    raise exception 'INVALID_ASKING_PRICE';
  end if;
  if v_public_location is not null and (
    char_length(v_public_location) > 80
    or v_public_location ~ '[\r\n]'
    or v_public_location ~* '(https?://|www\.|@)'
    or v_public_location ~ '^[[:space:]]*[+-]?[0-9]{1,3}([.,][0-9]+)?[[:space:]]*[,;/][[:space:]]*[+-]?[0-9]{1,3}([.,][0-9]+)?[[:space:]]*$'
  ) then
    raise exception 'INVALID_PUBLIC_LOCATION';
  end if;
  if not exists(select 1 from public.items i where i.id = p_item_id and i.owner_id = v_owner) then
    raise exception 'ITEM_NOT_OWNED';
  end if;

  v_status := case when p_publish then 'PUBLISHED' else 'DRAFT' end;

  insert into private.marketplace_listings(item_id, seller_id, asking_price_cents, public_location, status, published_at, updated_at)
  values (p_item_id, v_owner, p_asking_price_cents, v_public_location, v_status, case when p_publish then now() else null end, now())
  on conflict (item_id) do update set
    asking_price_cents = excluded.asking_price_cents,
    public_location = excluded.public_location,
    status = excluded.status,
    published_at = case
      when excluded.status = 'PUBLISHED' and private.marketplace_listings.status <> 'PUBLISHED' then now()
      when excluded.status = 'PUBLISHED' then private.marketplace_listings.published_at
      else null
    end,
    updated_at = now();

  return v_status;
end;
$$;

revoke all on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) from public, anon;
grant execute on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) to authenticated;

comment on function public.save_my_marketplace_listing_v2(uuid,bigint,boolean,text) is
  'Owner-only listing command. Optional public location accepts coarse city/town/district labels including numbers, while obvious contact, URL, newline and coordinate values are rejected.';
