-- Phase 2 — Social (Kairo Implementation Plan v3)
-- 2.1 Usernames and public profile
-- 2.2 Social tables: friend_requests, friendships, blocks
-- 2.3 Strict RLS and SECURITY DEFINER RPCs
-- 2.4 Automatic notifications via triggers

-- ============================================================================
-- 1. Username additions to user_profiles
-- ============================================================================
alter table public.user_profiles
  add column if not exists username text,
  add column if not exists username_changed_at timestamptz;

-- Case-insensitive unique index for usernames
create unique index if not exists user_profiles_username_ci
  on public.user_profiles (lower(username));

-- Format constraint: 3-20 lowercase alphanumeric + underscores
alter table public.user_profiles drop constraint if exists username_format;
alter table public.user_profiles
  add constraint username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- ============================================================================
-- 2. Reserved usernames catalog
-- ============================================================================
create table if not exists public.reserved_usernames (
  username text primary key
);

insert into public.reserved_usernames (username) values
  ('admin'),
  ('support'),
  ('kairo'),
  ('help'),
  ('system'),
  ('moderator'),
  ('official'),
  ('root'),
  ('staff'),
  ('security'),
  ('terms'),
  ('privacy'),
  ('api'),
  ('null'),
  ('undefined'),
  ('anonymous'),
  ('superuser')
on conflict do nothing;

alter table public.reserved_usernames enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'reserved_usernames' and policyname = 'Anyone can view reserved usernames') then
    create policy "Anyone can view reserved usernames" on public.reserved_usernames
      for select using (true);
  end if;
end $$;

-- ============================================================================
-- 3. Social Tables: friend_requests, friendships, blocks
-- ============================================================================
create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references auth.users(id) on delete cascade,
  to_user      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);

create unique index if not exists friend_requests_one_pending
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user))
  where status = 'pending';

create index if not exists friend_requests_to_user_idx on public.friend_requests (to_user, status);
create index if not exists friend_requests_from_user_idx on public.friend_requests (from_user, status);

create table if not exists public.friendships (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_a_idx on public.friendships (user_a);
create index if not exists friendships_user_b_idx on public.friendships (user_b);

create table if not exists public.blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create index if not exists blocks_blocker_idx on public.blocks (blocker);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

-- ============================================================================
-- 4. Row Level Security on Social Tables
-- Users can only select records where they are a party.
-- Direct client insert/update/delete is disabled; all changes go through RPCs.
-- ============================================================================
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

do $$
begin
  -- friend_requests policies
  if not exists (select 1 from pg_policies where tablename = 'friend_requests' and policyname = 'Users select own friend requests') then
    create policy "Users select own friend requests" on public.friend_requests
      for select using (auth.uid() = from_user or auth.uid() = to_user);
  end if;

  -- friendships policies
  if not exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'Users select own friendships') then
    create policy "Users select own friendships" on public.friendships
      for select using (auth.uid() = user_a or auth.uid() = user_b);
  end if;

  -- blocks policies
  if not exists (select 1 from pg_policies where tablename = 'blocks' and policyname = 'Users select own blocks') then
    create policy "Users select own blocks" on public.blocks
      for select using (auth.uid() = blocker);
  end if;
end $$;

-- ============================================================================
-- 5. Social RPCs (SECURITY DEFINER)
-- ============================================================================

-- A. find_user_by_username
-- Exact case-insensitive match only to prevent username enumeration.
-- Returns minimal public info only.
-- Hides user if either party has blocked the other.
create or replace function public.find_user_by_username(p_username text)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text
)
language plpgsql
security definer
as $$
declare
  v_me uuid;
  v_clean text;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  v_clean := lower(trim(p_username));
  if v_clean = '' then
    return;
  end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url
  from public.user_profiles p
  where lower(p.username) = v_clean
    and p.id <> v_me
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = v_me and b.blocked = p.id)
         or (b.blocker = p.id and b.blocked = v_me)
    );
end;
$$;

-- B. set_username
-- Sets or updates the caller's username with format checks, uniqueness, and 30-day throttle.
create or replace function public.set_username(p_username text)
returns text
language plpgsql
security definer
as $$
declare
  v_me uuid;
  v_clean text;
  v_last_changed timestamptz;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  v_clean := lower(trim(p_username));

  -- Validate regex
  if not (v_clean ~ '^[a-z0-9_]{3,20}$') then
    raise exception 'Username must be 3-20 characters long and contain only lowercase letters, numbers, and underscores';
  end if;

  -- Check reserved list
  if exists (select 1 from public.reserved_usernames where lower(username) = v_clean) then
    raise exception 'This username is reserved and cannot be claimed';
  end if;

  -- Check 30-day throttle
  select username_changed_at into v_last_changed
  from public.user_profiles
  where id = v_me;

  if v_last_changed is not null and (now() - v_last_changed) < interval '30 days' then
    raise exception 'Usernames can only be changed once every 30 days';
  end if;

  -- Check uniqueness (excluding current user)
  if exists (select 1 from public.user_profiles where lower(username) = v_clean and id <> v_me) then
    raise exception 'Username is already taken';
  end if;

  update public.user_profiles
  set
    username = v_clean,
    username_changed_at = now(),
    updated_at = now()
  where id = v_me;

  return v_clean;
end;
$$;

-- C. send_friend_request
-- Sends a friend request by target user UUID.
-- Rejects if either user has blocked the other, if already friends, or if a pending request exists.
-- If the target user already sent a pending request to caller, auto-accepts it!
create or replace function public.send_friend_request(p_to uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_me               uuid;
  v_my_username      text;
  v_their_username   text;
  v_existing_reverse record;
  v_new_req_id       uuid;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if v_me = p_to then
    raise exception 'Cannot send a friend request to yourself';
  end if;

  -- Require username on caller
  select username into v_my_username from public.user_profiles where id = v_me;
  if v_my_username is null or trim(v_my_username) = '' then
    raise exception 'You must set a username before sending friend requests';
  end if;

  -- Require username on recipient
  select username into v_their_username from public.user_profiles where id = p_to;
  if v_their_username is null or trim(v_their_username) = '' then
    raise exception 'Recipient has not chosen a username yet';
  end if;

  -- Check for block in either direction
  if exists (
    select 1 from public.blocks
    where (blocker = v_me and blocked = p_to)
       or (blocker = p_to and blocked = v_me)
  ) then
    raise exception 'Cannot send friend request to this user';
  end if;

  -- Check if already friends
  if exists (
    select 1 from public.friendships
    where (user_a = least(v_me, p_to) and user_b = greatest(v_me, p_to))
  ) then
    raise exception 'You are already friends with this user';
  end if;

  -- Check if recipient already sent caller a pending request -> auto-accept!
  select * into v_existing_reverse
  from public.friend_requests
  where from_user = p_to and to_user = v_me and status = 'pending';

  if found then
    -- Accept the incoming request
    update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = v_existing_reverse.id;

    -- Create friendship
    insert into public.friendships (user_a, user_b, created_at)
    values (least(v_me, p_to), greatest(v_me, p_to), now())
    on conflict do nothing;

    return jsonb_build_object(
      'status', 'accepted',
      'request_id', v_existing_reverse.id,
      'auto_accepted', true
    );
  end if;

  -- Check if caller already has a pending request to recipient
  if exists (
    select 1 from public.friend_requests
    where from_user = v_me and to_user = p_to and status = 'pending'
  ) then
    raise exception 'A friend request is already pending for this user';
  end if;

  -- Insert new friend request
  insert into public.friend_requests (from_user, to_user, status, created_at)
  values (v_me, p_to, 'pending', now())
  returning id into v_new_req_id;

  return jsonb_build_object(
    'status', 'pending',
    'request_id', v_new_req_id,
    'auto_accepted', false
  );
end;
$$;

-- D. respond_friend_request
-- Accepts or declines an incoming friend request. Only recipient can call.
create or replace function public.respond_friend_request(
  p_id     uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_me   uuid;
  v_req  record;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.friend_requests
  where id = p_id;

  if not found then
    raise exception 'Friend request not found';
  end if;

  if v_req.to_user <> v_me then
    raise exception 'Only the recipient can respond to this friend request';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Friend request has already been handled';
  end if;

  if p_accept then
    update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = p_id;

    insert into public.friendships (user_a, user_b, created_at)
    values (least(v_req.from_user, v_req.to_user), greatest(v_req.from_user, v_req.to_user), now())
    on conflict do nothing;

    return jsonb_build_object('status', 'accepted', 'request_id', p_id);
  else
    update public.friend_requests
    set status = 'declined', responded_at = now()
    where id = p_id;

    return jsonb_build_object('status', 'declined', 'request_id', p_id);
  end if;
end;
$$;

-- E. cancel_friend_request
-- Cancels an outgoing friend request. Only sender can call.
create or replace function public.cancel_friend_request(p_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_me  uuid;
  v_req record;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.friend_requests
  where id = p_id;

  if not found then
    raise exception 'Friend request not found';
  end if;

  if v_req.from_user <> v_me then
    raise exception 'Only the sender can cancel this friend request';
  end if;

  update public.friend_requests
  set status = 'cancelled', responded_at = now()
  where id = p_id;

  return jsonb_build_object('status', 'cancelled', 'request_id', p_id);
end;
$$;

-- F. remove_friend
-- Removes an existing friendship.
create or replace function public.remove_friend(p_user uuid)
returns boolean
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

  delete from public.friendships
  where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);

  return true;
end;
$$;

-- G. block_user / unblock_user
-- Blocking deletes friendship and cancels pending requests between them.
create or replace function public.block_user(p_user uuid)
returns boolean
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

  if v_me = p_user then
    raise exception 'Cannot block yourself';
  end if;

  -- Add to blocks
  insert into public.blocks (blocker, blocked, created_at)
  values (v_me, p_user, now())
  on conflict do nothing;

  -- Remove friendship if exists
  delete from public.friendships
  where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);

  -- Cancel any pending friend requests
  update public.friend_requests
  set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and ((from_user = v_me and to_user = p_user) or (from_user = p_user and to_user = v_me));

  return true;
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns boolean
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

  delete from public.blocks
  where blocker = v_me and blocked = p_user;

  return true;
end;
$$;

-- H. get_my_friends
-- Returns list of friend profiles for the authenticated user.
create or replace function public.get_my_friends()
returns table (
  id                    uuid,
  username              text,
  display_name          text,
  avatar_url            text,
  friendship_created_at timestamptz
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
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.created_at as friendship_created_at
  from public.friendships f
  join public.user_profiles p
    on p.id = case when f.user_a = v_me then f.user_b else f.user_a end
  where f.user_a = v_me or f.user_b = v_me
  order by p.display_name asc, p.username asc;
end;
$$;

-- I. get_my_friend_requests
-- Returns incoming and outgoing friend requests with sender/recipient profiles.
create or replace function public.get_my_friend_requests()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_me      uuid;
  v_incoming jsonb;
  v_outgoing jsonb;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  -- Incoming pending requests
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'from_user', r.from_user,
      'to_user', r.to_user,
      'status', r.status,
      'created_at', r.created_at,
      'sender', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url
      )
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_incoming
  from public.friend_requests r
  join public.user_profiles p on p.id = r.from_user
  where r.to_user = v_me and r.status = 'pending';

  -- Outgoing pending requests
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'from_user', r.from_user,
      'to_user', r.to_user,
      'status', r.status,
      'created_at', r.created_at,
      'recipient', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url
      )
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_outgoing
  from public.friend_requests r
  join public.user_profiles p on p.id = r.to_user
  where r.from_user = v_me and r.status = 'pending';

  return jsonb_build_object(
    'incoming', v_incoming,
    'outgoing', v_outgoing
  );
end;
$$;

-- J. get_my_blocks
-- Returns list of users blocked by the caller.
create or replace function public.get_my_blocks()
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  blocked_at   timestamptz
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
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    b.created_at as blocked_at
  from public.blocks b
  join public.user_profiles p on p.id = b.blocked
  where b.blocker = v_me
  order by b.created_at desc;
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.find_user_by_username(text) to authenticated;
grant execute on function public.set_username(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.get_my_friend_requests() to authenticated;
grant execute on function public.get_my_blocks() to authenticated;

-- ============================================================================
-- 6. Friend Request Triggers -> notify()
-- Emits notifications automatically on request insert and acceptance.
-- The client never calls notify() directly.
-- ============================================================================
create or replace function public.trigger_friend_request_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sender   record;
  v_receiver record;
begin
  if (tg_op = 'INSERT') and new.status = 'pending' then
    select username, display_name into v_sender
    from public.user_profiles
    where id = new.from_user;

    perform public.notify(
      new.to_user,
      'friend.request_received',
      jsonb_build_object(
        'title', 'Friend Request',
        'body', coalesce(v_sender.display_name, '@' || coalesce(v_sender.username, 'someone')) || ' sent you a friend request.',
        'action_url', '/friends?tab=requests',
        'sender_id', new.from_user,
        'request_id', new.id
      )
    );
  elsif (tg_op = 'UPDATE') and old.status = 'pending' and new.status = 'accepted' then
    select username, display_name into v_receiver
    from public.user_profiles
    where id = new.to_user;

    perform public.notify(
      new.from_user,
      'friend.request_accepted',
      jsonb_build_object(
        'title', 'Friend Request Accepted',
        'body', coalesce(v_receiver.display_name, '@' || coalesce(v_receiver.username, 'someone')) || ' accepted your friend request.',
        'action_url', '/friends',
        'friend_id', new.to_user
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_friend_request_notify on public.friend_requests;
create trigger trg_friend_request_notify
  after insert or update on public.friend_requests
  for each row
  execute function public.trigger_friend_request_notification();

