-- Cursor-page private Marketplace chat history without offset scans.
-- The cursor is the oldest currently loaded message; results are returned oldest->newest
-- so the existing mobile message ordering contract remains stable.
create or replace function public.load_my_marketplace_messages_v3(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_message_id uuid default null,
  p_limit integer default 101
)
returns table(message_id uuid,sender_role text,body text,created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select page.message_id, page.sender_role, page.body, page.created_at
  from (
    select m.id as message_id,
      case when m.sender_id=auth.uid() then 'ME' else 'OTHER' end as sender_role,
      m.body,
      m.created_at
    from private.marketplace_messages m
    join private.marketplace_conversations c on c.id=m.conversation_id
    where c.id=p_conversation_id
      and auth.uid() in (c.buyer_id,c.seller_id)
      and (
        (p_before_created_at is null and p_before_message_id is null)
        or (
          p_before_created_at is not null
          and p_before_message_id is not null
          and (m.created_at,m.id) < (p_before_created_at,p_before_message_id)
        )
      )
    order by m.created_at desc, m.id desc
    limit least(greatest(coalesce(p_limit,101),1),201)
  ) page
  order by page.created_at asc, page.message_id asc;
$$;

revoke all on function public.load_my_marketplace_messages_v3(uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.load_my_marketplace_messages_v3(uuid,timestamptz,uuid,integer) to authenticated;
