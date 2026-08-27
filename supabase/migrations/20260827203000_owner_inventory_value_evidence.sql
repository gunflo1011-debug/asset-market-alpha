-- Store verified value evidence separately from user-authored inventory metadata.
-- Clients can read only the latest evidence for items they own. Clients cannot
-- write evidence directly, which prevents user-authored values being presented
-- as verified market evidence.
create table if not exists private.item_value_evidence (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  estimated_value_cents bigint not null check (estimated_value_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  source_type text not null,
  source_ref text,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists item_value_evidence_item_observed_idx
  on private.item_value_evidence(item_id, observed_at desc, created_at desc);

revoke all on table private.item_value_evidence from public, anon, authenticated;

create or replace function public.load_my_inventory_values()
returns table(
  item_id uuid,
  estimated_value_cents bigint,
  currency text,
  source_type text,
  observed_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  return query
  select distinct on (e.item_id)
    e.item_id,
    e.estimated_value_cents,
    e.currency,
    e.source_type,
    e.observed_at
  from private.item_value_evidence e
  join public.items i on i.id = e.item_id
  where i.owner_id = auth.uid()
  order by e.item_id, e.observed_at desc, e.created_at desc;
end;
$$;

revoke all on function public.load_my_inventory_values() from public, anon;
grant execute on function public.load_my_inventory_values() to authenticated;

comment on table private.item_value_evidence is
  'Trusted value observations for inventory items. Not writable by mobile clients.';
comment on function public.load_my_inventory_values() is
  'Returns only the latest verified value evidence for inventory items owned by the authenticated caller.';
