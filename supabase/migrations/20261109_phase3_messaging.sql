-- Phase 3 — Messaging Module (Kairo Implementation Plan v3)
-- 3.2 Data model: conversations, conversation_members, messages
-- 3.3 Strict RLS and SECURITY DEFINER RPCs for sending, unsend, edit, read receipts
-- 3.5 Realtime and notification triggers

-- ============================================================================
-- 1. Tables: conversations, conversation_members, messages
-- ============================================================================

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'direct' check (kind in ('direct', 'group')),
  direct_key      text unique, -- least(a,b) || ':' || greatest(a,b) for direct chats
  created_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member',
  last_read_at    timestamptz,
  muted           boolean not null default false,
  hidden          boolean not null default false,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conv_members_user_idx on public.conversation_members (user_id);
create index if not exists conv_members_conv_idx on public.conversation_members (conversation_id);

create table if not exists public.messages (
  id              uuid primary key, -- client-generated UUID for idempotency
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  kind            text not null check (kind in ('text', 'attachment', 'system')),
  body            text check (body is null or char_length(body) <= 4000),
  attachment      jsonb, -- { type: 'note'|'task'|'inbox_item', schema_version: 1, snapshot: {...} }
  reply_to        uuid references public.messages(id) on delete set null,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);

create index if not exists messages_conv_created_idx on public.messages (conversation_id, created_at desc, id);
create index if not exists messages_sender_idx on public.messages (sender_id);

-- Enforce security snapshot constraints on attachment:
-- 1. Attachment size <= 100 KB
-- 2. Snapshot must NOT contain pin_hash
alter table public.messages drop constraint if exists message_attachment_safety;
alter table public.messages
  add constraint message_attachment_safety
  check (
    attachment is null or (
      pg_column_size(attachment) <= 102400
      and not (attachment->'snapshot' ? 'pin_hash')
    )
  );

-- ============================================================================
-- 2. Row Level Security
-- ============================================================================
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

do $$
begin
  -- Conversations: select allowed if caller is a member
  if not exists (select 1 from pg_policies where tablename = 'conversations' and policyname = 'Members select conversation') then
    create policy "Members select conversation" on public.conversations
      for select using (
        exists (
          select 1 from public.conversation_members m
          where m.conversation_id = conversations.id and m.user_id = auth.uid()
        )
      );
  end if;

  -- Conversation members: select allowed if caller is a fellow member
  if not exists (select 1 from pg_policies where tablename = 'conversation_members' and policyname = 'Members select fellow members') then
    create policy "Members select fellow members" on public.conversation_members
      for select using (
        exists (
          select 1 from public.conversation_members m
          where m.conversation_id = conversation_members.conversation_id and m.user_id = auth.uid()
        )
      );
  end if;

  -- Messages: select allowed if caller is a member
  if not exists (select 1 from pg_policies where tablename = 'messages' and policyname = 'Members select messages') then
    create policy "Members select messages" on public.messages
      for select using (
        exists (
          select 1 from public.conversation_members m
          where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Direct client insert/update/delete disabled: state changes must go through SECURITY DEFINER RPCs

-- ============================================================================
-- 3. Messaging RPCs (SECURITY DEFINER)
-- ============================================================================

-- A. get_or_create_direct_conversation
-- Finds or creates a 1:1 conversation between caller and a friend.
-- Requires friendship and absence of blocks.
create or replace function public.get_or_create_direct_conversation(p_friend_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_me         uuid;
  v_direct_key text;
  v_conv_id    uuid;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if v_me = p_friend_id then
    raise exception 'Cannot create a conversation with yourself';
  end if;

  -- Verify friendship
  if not exists (
    select 1 from public.friendships
    where (user_a = least(v_me, p_friend_id) and user_b = greatest(v_me, p_friend_id))
  ) then
    raise exception 'You can only message existing friends';
  end if;

  -- Verify absence of blocks
  if exists (
    select 1 from public.blocks
    where (blocker = v_me and blocked = p_friend_id)
       or (blocker = p_friend_id and blocked = v_me)
  ) then
    raise exception 'Cannot message this user';
  end if;

  v_direct_key := least(v_me, p_friend_id)::text || ':' || greatest(v_me, p_friend_id)::text;

  -- Check existing conversation
  select id into v_conv_id
  from public.conversations
  where direct_key = v_direct_key;

  if v_conv_id is null then
    -- Create new conversation
    insert into public.conversations (kind, direct_key, created_at, last_message_at)
    values ('direct', v_direct_key, now(), now())
    returning id into v_conv_id;

    -- Add both members
    insert into public.conversation_members (conversation_id, user_id, joined_at)
    values
      (v_conv_id, v_me, now()),
      (v_conv_id, p_friend_id, now())
    on conflict do nothing;
  else
    -- Unhide conversation if previously hidden
    update public.conversation_members
    set hidden = false
    where conversation_id = v_conv_id and user_id = v_me;
  end if;

  return v_conv_id;
end;
$$;

-- B. send_message
-- Sends a message into a conversation.
-- Client passes UUID for idempotency.
create or replace function public.send_message(
  p_id              uuid,
  p_conversation_id uuid,
  p_kind            text,
  p_body            text default null,
  p_attachment      jsonb default null,
  p_reply_to        uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_me         uuid;
  v_recipient  uuid;
  v_result     record;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  -- Verify caller is a member
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = v_me
  ) then
    raise exception 'You are not a member of this conversation';
  end if;

  -- Find the other member in a direct conversation
  select user_id into v_recipient
  from public.conversation_members
  where conversation_id = p_conversation_id and user_id <> v_me
  limit 1;

  if v_recipient is not null then
    -- Verify friendship still holds
    if not exists (
      select 1 from public.friendships
      where (user_a = least(v_me, v_recipient) and user_b = greatest(v_me, v_recipient))
    ) then
      raise exception 'Sending disabled: recipient is no longer on your friends list';
    end if;

    -- Verify no blocks
    if exists (
      select 1 from public.blocks
      where (blocker = v_me and blocked = v_recipient)
         or (blocker = v_recipient and blocked = v_me)
    ) then
      raise exception 'Sending disabled: user is blocked';
    end if;
  end if;

  -- Check attachment safety: strip pin_hash if present
  if p_attachment is not null and p_attachment->'snapshot' ? 'pin_hash' then
    p_attachment := jsonb_set(p_attachment, '{snapshot}', (p_attachment->'snapshot') - 'pin_hash');
  end if;

  -- Insert message (idempotent: on conflict do nothing)
  insert into public.messages (
    id,
    conversation_id,
    sender_id,
    kind,
    body,
    attachment,
    reply_to,
    created_at
  ) values (
    p_id,
    p_conversation_id,
    v_me,
    p_kind,
    p_body,
    p_attachment,
    p_reply_to,
    now()
  )
  on conflict (id) do update
    set created_at = messages.created_at -- no-op to return existing row
  returning * into v_result;

  -- Update conversation last_message_at
  update public.conversations
  set last_message_at = v_result.created_at
  where id = p_conversation_id;

  -- Unhide for all members & mark read for sender
  update public.conversation_members
  set
    hidden = false,
    last_read_at = case when user_id = v_me then v_result.created_at else last_read_at end
  where conversation_id = p_conversation_id;

  return to_jsonb(v_result);
end;
$$;

-- C. get_my_conversations
-- Returns caller's active conversations with peer profile, latest message, and unread count.
create or replace function public.get_my_conversations()
returns table (
  conversation_id   uuid,
  kind              text,
  peer_id           uuid,
  peer_username     text,
  peer_display_name text,
  peer_avatar_url   text,
  peer_last_read_at timestamptz,
  my_last_read_at   timestamptz,
  muted             boolean,
  last_message_at   timestamptz,
  latest_body       text,
  latest_kind       text,
  latest_sender_id  uuid,
  unread_count      bigint
)
language plpgsql
security definer
as $$
declare
  v_me uuid;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    c.id as conversation_id,
    c.kind,
    peer_p.id as peer_id,
    peer_p.username as peer_username,
    peer_p.display_name as peer_display_name,
    peer_p.avatar_url as peer_avatar_url,
    peer_m.last_read_at as peer_last_read_at,
    my_m.last_read_at as my_last_read_at,
    my_m.muted,
    c.last_message_at,
    last_msg.body as latest_body,
    last_msg.kind as latest_kind,
    last_msg.sender_id as latest_sender_id,
    count(unread_msg.id) as unread_count
  from public.conversation_members my_m
  join public.conversations c on c.id = my_m.conversation_id
  -- Join peer member
  left join public.conversation_members peer_m
    on peer_m.conversation_id = c.id and peer_m.user_id <> v_me
  left join public.user_profiles peer_p
    on peer_p.id = peer_m.user_id
  -- Latest message subquery
  left join lateral (
    select m.body, m.kind, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  -- Unread messages subquery
  left join public.messages unread_msg
    on unread_msg.conversation_id = c.id
   and unread_msg.sender_id <> v_me
   and (my_m.last_read_at is null or unread_msg.created_at > my_m.last_read_at)
   and unread_msg.deleted_at is null
  where my_m.user_id = v_me
    and my_m.hidden = false
  group by
    c.id, c.kind, peer_p.id, peer_p.username, peer_p.display_name, peer_p.avatar_url,
    peer_m.last_read_at, my_m.last_read_at, my_m.muted, c.last_message_at,
    last_msg.body, last_msg.kind, last_msg.sender_id
  order by c.last_message_at desc nulls last;
end;
$$;

-- D. get_conversation_messages
-- Fetches paginated messages for an open conversation.
create or replace function public.get_conversation_messages(
  p_conversation_id uuid,
  p_limit           int default 50,
  p_before          timestamptz default null
)
returns table (
  id              uuid,
  conversation_id uuid,
  sender_id       uuid,
  kind            text,
  body            text,
  attachment      jsonb,
  reply_to        uuid,
  created_at      timestamptz,
  edited_at       timestamptz,
  deleted_at      timestamptz
)
language plpgsql
security definer
as $$
declare
  v_me uuid;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  -- Ensure caller is member
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = v_me
  ) then
    raise exception 'Access denied';
  end if;

  return query
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    m.kind,
    m.body,
    m.attachment,
    m.reply_to,
    m.created_at,
    m.edited_at,
    m.deleted_at
  from public.messages m
  where m.conversation_id = p_conversation_id
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit p_limit;
end;
$$;

-- E. mark_conversation_read
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_me uuid;
begin
  v_me := auth.uid();
  if v_me is null then
    return false;
  end if;

  update public.conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = v_me;

  return true;
end;
$$;

-- F. unsend_message
create or replace function public.unsend_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_me  uuid;
  v_msg record;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_msg
  from public.messages
  where id = p_message_id;

  if not found then
    raise exception 'Message not found';
  end if;

  if v_msg.sender_id <> v_me then
    raise exception 'Only the sender can unsend a message';
  end if;

  update public.messages
  set
    deleted_at = now(),
    body = null,
    attachment = null
  where id = p_message_id;

  return true;
end;
$$;

-- G. edit_message
-- Allowed within 15 minutes of sending
create or replace function public.edit_message(
  p_message_id uuid,
  p_new_body   text
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_me  uuid;
  v_msg record;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_msg
  from public.messages
  where id = p_message_id;

  if not found then
    raise exception 'Message not found';
  end if;

  if v_msg.sender_id <> v_me then
    raise exception 'Only the sender can edit a message';
  end if;

  if v_msg.deleted_at is not null then
    raise exception 'Cannot edit an unsent message';
  end if;

  if (now() - v_msg.created_at) > interval '15 minutes' then
    raise exception 'Messages can only be edited within 15 minutes of sending';
  end if;

  update public.messages
  set
    body = p_new_body,
    edited_at = now()
  where id = p_message_id;

  return true;
end;
$$;

-- H. hide_conversation & mute_conversation
create or replace function public.hide_conversation(
  p_conversation_id uuid,
  p_hidden          boolean default true
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.conversation_members
  set hidden = p_hidden
  where conversation_id = p_conversation_id and user_id = auth.uid();
  return true;
end;
$$;

create or replace function public.mute_conversation(
  p_conversation_id uuid,
  p_muted           boolean default true
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.conversation_members
  set muted = p_muted
  where conversation_id = p_conversation_id and user_id = auth.uid();
  return true;
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.send_message(uuid, uuid, text, text, jsonb, uuid) to authenticated;
grant execute on function public.get_my_conversations() to authenticated;
grant execute on function public.get_conversation_messages(uuid, int, timestamptz) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.unsend_message(uuid) to authenticated;
grant execute on function public.edit_message(uuid, text) to authenticated;
grant execute on function public.hide_conversation(uuid, boolean) to authenticated;
grant execute on function public.mute_conversation(uuid, boolean) to authenticated;

-- ============================================================================
-- 4. Notification Triggers on messages
-- ============================================================================
create or replace function public.trigger_message_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sender      record;
  v_recipient_m record;
  v_preview     text;
begin
  if new.kind = 'attachment' then
    v_preview := 'sent an attachment';
    if new.attachment ? 'type' then
      v_preview := 'sent a ' || (new.attachment->>'type');
    end if;
  else
    v_preview := coalesce(new.body, 'sent a message');
  end if;

  -- Notify all members except the sender
  for v_recipient_m in
    select user_id, muted
    from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    if not v_recipient_m.muted then
      select username, display_name into v_sender
      from public.user_profiles
      where id = new.sender_id;

      perform public.notify(
        v_recipient_m.user_id,
        'message.received',
        jsonb_build_object(
          'title', coalesce(v_sender.display_name, '@' || coalesce(v_sender.username, 'Someone')),
          'body', v_preview,
          'action_url', '/messages/' || new.conversation_id::text,
          'conversation_id', new.conversation_id,
          'message_id', new.id
        )
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_message_notify on public.messages;
create trigger trg_message_notify
  after insert on public.messages
  for each row
  execute function public.trigger_message_notification();

-- ============================================================================
-- 5. Supabase Realtime Publication
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversation_members') then
      alter publication supabase_realtime add table public.conversation_members;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversations') then
      alter publication supabase_realtime add table public.conversations;
    end if;
  end if;
end $$;

