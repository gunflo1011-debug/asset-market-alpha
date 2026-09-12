-- Bound chat history payloads for mobile while preserving participant isolation.
-- The newest messages are selected first for efficiency, then returned oldest->newest
-- so existing UI ordering semantics remain unchanged.
create or replace function public.load_my_marketplace_messages_v2(
  p_conversation_id uuid,
  p_limit integer default 100
)
returns table(message_id uuid,sender_role text,body text,created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select recent.message_id, recent.sender_role, recent.body, recent.created_at
  from (
    select m.id as message_id,
      case when m.sender_id=auth.uid() then 'ME' else 'OTHER' end as sender_role,
      m.body,
      m.created_at
    from private.marketplace_messages m
    join private.marketplace_conversations c on c.id=m.conversation_id
    where c.id=p_conversation_id
      and auth.uid() in (c.buyer_id,c.seller_id)
    order by m.created_at desc, m.id desc
    limit least(greatest(coalesce(p_limit,100),1),200)
  ) recent
  order by recent.created_at asc, recent.message_id asc;
$$;

revoke all on function public.load_my_marketplace_messages_v2(uuid,integer) from public, anon;
grant execute on function public.load_my_marketplace_messages_v2(uuid,integer) to authenticated;
