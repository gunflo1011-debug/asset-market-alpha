-- Reject checksum-invalid product codes at the authoritative owner-scoped RPC boundary.
-- Existing rows are left untouched; this is non-destructive hardening for future writes.
create or replace function private.is_valid_gtin_v1(p_gtin text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_gtin text := regexp_replace(coalesce(p_gtin, ''), '[^0-9]', '', 'g');
  v_sum integer := 0;
  v_weight integer := 3;
  v_index integer;
  v_expected integer;
begin
  if v_gtin !~ '^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$' then
    return false;
  end if;

  v_expected := substr(v_gtin, length(v_gtin), 1)::integer;
  v_index := length(v_gtin) - 1;
  while v_index >= 1 loop
    v_sum := v_sum + substr(v_gtin, v_index, 1)::integer * v_weight;
    v_weight := case when v_weight = 3 then 1 else 3 end;
    v_index := v_index - 1;
  end loop;

  return ((10 - (v_sum % 10)) % 10) = v_expected;
end;
$$;

revoke all on function private.is_valid_gtin_v1(text) from public, anon, authenticated;

create or replace function public.set_my_item_gtin_v1(
  p_item_id uuid,
  p_gtin text,
  p_source text default 'BARCODE_SCAN'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_gtin text := regexp_replace(coalesce(p_gtin, ''), '[^0-9]', '', 'g');
  v_source text := upper(coalesce(nullif(trim(p_source), ''), 'BARCODE_SCAN'));
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  if not exists (
    select 1 from public.items i
    where i.id = p_item_id and i.owner_id = v_owner
  ) then
    raise exception 'ITEM_NOT_OWNED' using errcode='42501';
  end if;

  if not private.is_valid_gtin_v1(v_gtin) then
    raise exception 'INVALID_GTIN';
  end if;

  if v_source not in ('BARCODE_SCAN', 'MANUAL_ENTRY', 'QR_PRODUCT_DATA') then
    raise exception 'INVALID_PRODUCT_IDENTITY_SOURCE';
  end if;

  insert into private.item_product_identifiers(item_id, gtin, source, confirmed_by_user)
  values (p_item_id, v_gtin, v_source, true)
  on conflict (item_id) do update
    set gtin = excluded.gtin,
        source = excluded.source,
        confirmed_by_user = true,
        updated_at = now();
end;
$$;

revoke all on function public.set_my_item_gtin_v1(uuid, text, text) from public, anon;
grant execute on function public.set_my_item_gtin_v1(uuid, text, text) to authenticated;

comment on function public.set_my_item_gtin_v1(uuid, text, text) is
  'Stores a normalized, checksum-valid, user-confirmed GTIN for an owned Thing as private product identity. It is not Marketplace-public data.';
