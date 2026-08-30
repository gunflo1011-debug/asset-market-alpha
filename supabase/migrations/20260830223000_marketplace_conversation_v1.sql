-- Listing-bound marketplace conversation foundation.
-- A conversation can only exist between the listing seller and a buyer who has
-- explicitly expressed interest. Messages never expose participant identities
-- through public marketplace discovery RPCs.
create table if not exists private.marketplace_conversations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN','RESERVED','SOLD','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_id, buyer_id),
  check (buyer_id <> seller_id)
);

create table if not exists private.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.marketplace_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_conversations_seller_updated_idx
  on private.marketplace_conversations(seller_id, updated_at desc);
create index if not exists marketplace_conversations_buyer_updated_idx
  on private.marketplace_conversations(buyer_id, updated_at desc);
create index if not exists marketplace_messages_conversation_created_idx
  on private.marketplace_messages(conversation_id, created_at asc);

revoke all on table private.marketplace_conversations from public, anon, authenticated;
revoke all on table private.marketplace_messages from public, anon, authenticated;

create or replace function public.open_my_marketplace_conversation(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_conversation uuid;
begin
  if v_buyer is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select l.seller_id into v_seller
  from private.marketplace_listings l
  where l.item_id = p_item_id and l.status = 'PUBLISHED';

  if v_seller is null then raise exception 'LISTING_NOT_AVAILABLE'; end if;
  if v_seller = v_buyer then raise exception 'OWN_LISTING_CHAT_NOT_ALLOWED'; end if;
  if not exists (
    select 1 from private.marketplace_interests i
    where i.item_id = p_item_id and i.buyer_id = v_buyer
      and i.seller_id = v_seller and i.status = 'INTERESTED'
  ) then raise exception 'INTEREST_REQUIRED'; end if;

  insert into private.marketplace_conversations(item_id,buyer_id,seller_id,status,updated_at)
  values(p_item_id,v_buyer,v_seller,'OPEN',now())
  on conflict(item_id,buyer_id) do update set updated_at=now()
  returning id into v_conversation;
  return v_conversation;
end;
$$;

create or replace function public.send_my_marketplace_message(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_message uuid;
  v_status text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select c.status into v_status from private.marketplace_conversations c
   where c.id=p_conversation_id and v_user in (c.buyer_id,c.seller_id);
  if v_status is null then raise exception 'NOT_ALLOWED'; end if;
  if v_status in ('SOLD','CLOSED') then raise exception 'CONVERSATION_CLOSED'; end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and 1200 then raise exception 'INVALID_MESSAGE'; end if;

  insert into private.marketplace_messages(conversation_id,sender_id,body)
  values(p_conversation_id,v_user,btrim(p_body)) returning id into v_message;
  update private.marketplace_conversations set updated_at=now() where id=p_conversation_id;
  return v_message;
end;
$$;

create or replace function public.load_my_marketplace_conversations()
returns table(conversation_id uuid,item_id uuid,role text,status text,updated_at timestamptz)
language sql
security definer
set search_path = public, private, auth, pg_temp
stable
as $$
 select c.id,c.item_id,
   case when c.buyer_id=auth.uid() then 'BUYER' else 'SELLER' end,
   c.status,c.updated_at
 from private.marketplace_conversations c
 where auth.uid() in (c.buyer_id,c.seller_id)
 order by c.updated_at desc;
$$;

create or replace function public.load_my_marketplace_messages(p_conversation_id uuid)
returns table(message_id uuid,sender_role text,body text,created_at timestamptz)
language sql
security definer
set search_path = public, private, auth, pg_temp
stable
as $$
 select m.id,
   case when m.sender_id=auth.uid() then 'ME' else 'OTHER' end,
   m.body,m.created_at
 from private.marketplace_messages m
 join private.marketplace_conversations c on c.id=m.conversation_id
 where c.id=p_conversation_id and auth.uid() in (c.buyer_id,c.seller_id)
 order by m.created_at asc;
$$;

revoke all on function public.open_my_marketplace_conversation(uuid) from public, anon;
revoke all on function public.send_my_marketplace_message(uuid,text) from public, anon;
revoke all on function public.load_my_marketplace_conversations() from public, anon;
revoke all on function public.load_my_marketplace_messages(uuid) from public, anon;
grant execute on function public.open_my_marketplace_conversation(uuid) to authenticated;
grant execute on function public.send_my_marketplace_message(uuid,text) to authenticated;
grant execute on function public.load_my_marketplace_conversations() to authenticated;
grant execute on function public.load_my_marketplace_messages(uuid) to authenticated;
