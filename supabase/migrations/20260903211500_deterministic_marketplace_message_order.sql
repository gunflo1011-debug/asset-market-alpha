-- Keep listing-bound chat ordering stable when multiple messages share the same timestamp.
-- The message id is an immutable tie-breaker and the covering index supports the exact read order.
create index if not exists marketplace_messages_conversation_created_id_idx
  on private.marketplace_messages(conversation_id, created_at asc, id asc);

create or replace function public.load_my_marketplace_messages(p_conversation_id uuid)
returns table(message_id uuid,sender_role text,body text,created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
 select m.id,
   case when m.sender_id=auth.uid() then 'ME' else 'OTHER' end,
   m.body,m.created_at
 from private.marketplace_messages m
 join private.marketplace_conversations c on c.id=m.conversation_id
 where c.id=p_conversation_id and auth.uid() in (c.buyer_id,c.seller_id)
 order by m.created_at asc, m.id asc;
$$;

revoke all on function public.load_my_marketplace_messages(uuid) from public, anon;
grant execute on function public.load_my_marketplace_messages(uuid) to authenticated;
