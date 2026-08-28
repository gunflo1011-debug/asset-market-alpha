-- Privacy-safe buyer interest for explicitly published marketplace listings.
-- Buyer and seller identities stay private to the client; RPCs expose only owner-scoped state.
create table if not exists private.marketplace_interests (
  item_id uuid not null references public.items(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'INTERESTED' check (status in ('INTERESTED','WITHDRAWN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index if not exists marketplace_interests_seller_status_idx
  on private.marketplace_interests(seller_id, status, updated_at desc);

revoke all on table private.marketplace_interests from public, anon, authenticated;

create or replace function public.set_my_marketplace_interest(
  p_item_id uuid,
  p_interested boolean
)
returns text
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_status text;
begin
  if v_buyer is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  select l.seller_id into v_seller
  from private.marketplace_listings l
  where l.item_id = p_item_id and l.status = 'PUBLISHED';

  if v_seller is null then
    raise exception 'LISTING_NOT_AVAILABLE';
  end if;
  if v_seller = v_buyer then
    raise exception 'OWN_LISTING_INTEREST_NOT_ALLOWED';
  end if;

  v_status := case when p_interested then 'INTERESTED' else 'WITHDRAWN' end;

  insert into private.marketplace_interests(item_id, buyer_id, seller_id, status, updated_at)
  values (p_item_id, v_buyer, v_seller, v_status, now())
  on conflict (item_id, buyer_id) do update set
    seller_id = excluded.seller_id,
    status = excluded.status,
    updated_at = now();

  return v_status;
end;
$$;

create or replace function public.load_my_marketplace_interests()
returns table(item_id uuid, status text, updated_at timestamptz)
language sql
security definer
set search_path = public, private, auth, pg_temp
stable
as $$
  select i.item_id, i.status, i.updated_at
  from private.marketplace_interests i
  where i.buyer_id = auth.uid()
  order by i.updated_at desc;
$$;

create or replace function public.load_interest_summary_for_my_listings()
returns table(item_id uuid, interested_count bigint, latest_interest_at timestamptz)
language sql
security definer
set search_path = public, private, auth, pg_temp
stable
as $$
  select
    i.item_id,
    count(*) filter (where i.status = 'INTERESTED')::bigint as interested_count,
    max(i.updated_at) filter (where i.status = 'INTERESTED') as latest_interest_at
  from private.marketplace_interests i
  where i.seller_id = auth.uid()
  group by i.item_id
  order by latest_interest_at desc nulls last;
$$;

revoke all on function public.set_my_marketplace_interest(uuid,boolean) from public, anon;
revoke all on function public.load_my_marketplace_interests() from public, anon;
revoke all on function public.load_interest_summary_for_my_listings() from public, anon;
grant execute on function public.set_my_marketplace_interest(uuid,boolean) to authenticated;
grant execute on function public.load_my_marketplace_interests() to authenticated;
grant execute on function public.load_interest_summary_for_my_listings() to authenticated;

comment on function public.set_my_marketplace_interest(uuid,boolean) is
  'Stores buyer interest in a published listing without exposing buyer identity to the marketplace client.';
comment on function public.load_interest_summary_for_my_listings() is
  'Returns aggregate interest counts only for listings owned by the authenticated seller.';
