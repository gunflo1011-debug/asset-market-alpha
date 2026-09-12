-- Keep completed-purchase adoption state durable across app/session reloads.
-- Only the buyer may see the private adopted item id; sellers never receive it.
drop function if exists public.load_my_marketplace_conversations();

create function public.load_my_marketplace_conversations()
returns table(
  conversation_id uuid,
  item_id uuid,
  role text,
  status text,
  title text,
  final_sale_price_cents bigint,
  adopted_item_id uuid,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.item_id,
    case when c.buyer_id = auth.uid() then 'BUYER' else 'SELLER' end,
    c.status,
    coalesce(nullif(btrim(l.public_title), ''), 'Thing') as title,
    case when c.status = 'SOLD' then l.sold_price_cents else null end,
    case when c.buyer_id = auth.uid() then a.adopted_item_id else null end,
    c.updated_at
  from private.marketplace_conversations c
  left join private.marketplace_listings l
    on l.item_id = c.item_id
   and l.seller_id = c.seller_id
  left join private.marketplace_buyer_adoptions a
    on a.conversation_id = c.id
   and a.buyer_id = auth.uid()
  where auth.uid() in (c.buyer_id, c.seller_id)
  order by c.updated_at desc;
$$;

revoke all on function public.load_my_marketplace_conversations() from public;
revoke all on function public.load_my_marketplace_conversations() from anon;
grant execute on function public.load_my_marketplace_conversations() to authenticated;

comment on function public.load_my_marketplace_conversations() is
  'Participant-scoped Marketplace conversations with frozen public title, SOLD-only final price, and buyer-only adopted inventory item id.';
