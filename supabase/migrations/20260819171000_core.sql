create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  family text not null,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_gb integer,
  region text not null default 'EU',
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  color text,
  created_at timestamptz not null default now()
);

create table public.condition_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  purpose text not null check (purpose in ('PORTFOLIO','TRADE_REFRESH')),
  display_state text not null check (display_state in ('INTACT','DAMAGED')),
  housing_state text not null check (housing_state in ('CLEAN','LIGHT_WEAR','HEAVY_WEAR','DAMAGED')),
  cameras_working boolean not null,
  biometrics_working boolean not null,
  battery_health smallint check (battery_health between 0 and 100),
  network_locked boolean,
  other_defect boolean not null default false,
  captured_at timestamptz not null default now()
);

create table private.item_market_state (
  item_id uuid primary key references public.items(id) on delete cascade,
  market_state text not null default 'PRIVATE' check (market_state in ('PRIVATE','OFFERS_ENABLED','MARKET_ELIGIBLE','ACTIVATING','RESERVED','SOLD')),
  possession_status text not null default 'UNVERIFIED' check (possession_status in ('UNVERIFIED','VERIFIED','EXPIRED')),
  updated_at timestamptz not null default now()
);

create table private.buyer_intents (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  max_price_cents integer not null check (max_price_cents > 0),
  min_battery smallint check (min_battery between 0 and 100),
  require_intact_display boolean not null default true,
  require_biometrics boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','MATCHING','RESERVED','CLOSED','EXPIRED')),
  created_at timestamptz not null default now()
);

create table private.matches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  buyer_intent_id uuid not null references private.buyer_intents(id),
  status text not null check (status in ('OWNER_CONTACTED','OWNER_INTERESTED','CONDITION_REFRESHED','BUYER_RECONFIRMED','RESERVED','MEETING_AGREED','DECLINED','EXPIRED','CANCELLED','NO_SHOW','HANDOVER_CONFIRMED')),
  response_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_live_match_per_item on private.matches(item_id)
where status in ('OWNER_CONTACTED','OWNER_INTERESTED','CONDITION_REFRESHED','BUYER_RECONFIRMED','RESERVED','MEETING_AGREED');

create unique index one_live_match_per_intent on private.matches(buyer_intent_id)
where status in ('OWNER_CONTACTED','OWNER_INTERESTED','CONDITION_REFRESHED','BUYER_RECONFIRMED','RESERVED','MEETING_AGREED');

create table private.match_events (
  id bigserial primary key,
  match_id uuid not null references private.matches(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  idempotency_key uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(match_id,idempotency_key)
);

alter table public.items enable row level security;
alter table public.items force row level security;
alter table public.condition_snapshots enable row level security;
alter table public.condition_snapshots force row level security;

revoke all on public.items from anon, authenticated;
revoke all on public.condition_snapshots from anon, authenticated;
grant select, insert on public.items to authenticated;
grant select, insert on public.condition_snapshots to authenticated;
grant select on public.products, public.product_variants to authenticated;

create policy item_owner_select on public.items for select to authenticated
using ((select auth.uid()) = owner_id);
create policy item_owner_insert on public.items for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy condition_owner_select on public.condition_snapshots for select to authenticated
using (exists (select 1 from public.items i where i.id=condition_snapshots.item_id and i.owner_id=(select auth.uid())));
create policy condition_owner_insert on public.condition_snapshots for insert to authenticated
with check (purpose='PORTFOLIO' and exists (select 1 from public.items i where i.id=condition_snapshots.item_id and i.owner_id=(select auth.uid())));

create index items_owner_idx on public.items(owner_id);
create index conditions_item_idx on public.condition_snapshots(item_id);
