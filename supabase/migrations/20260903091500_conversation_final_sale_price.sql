drop function if exists public.load_my_marketplace_conversations();

create function public.load_my_marketplace_conversations()
returns table(
  conversation_id uuid,
  item_id uuid,
  role text,
  status text,
  final_sale_price_cents bigint,
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
    case when c.status = 'SOLD' then l.sold_price_cents else null end,
    c.updated_at
  from private.marketplace_conversations c
  left join private.marketplace_listings l
    on l.item_id = c.item_id
   and l.seller_id = c.seller_id
  where auth.uid() in (c.buyer_id, c.seller_id)
  order by c.updated_at desc;
$$;

revoke all on function public.load_my_marketplace_conversations() from public;
revoke all on function public.load_my_marketplace_conversations() from anon;
grant execute on function public.load_my_marketplace_conversations() to authenticated;
