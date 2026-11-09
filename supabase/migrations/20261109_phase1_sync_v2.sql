-- Phase 1 — Sync Foundation (Kairo Implementation Plan v3)
-- 1.1 Data contract: updated_at, deleted_at, server triggers, and indexes on all synced tables
-- 1.3 Conflict resolution RPC for notes (upsert_note)
-- 1.5 Realtime publication setup
-- 1.6 Note version history table & triggers

-- ============================================================================
-- 1. Server-enforced updated_at trigger function
-- ============================================================================
create or replace function public.set_updated_at_server()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 2. Add updated_at, deleted_at, triggers, and indexes to all 20 synced tables
-- ============================================================================
do $$
declare
  t text;
  synced_tables text[] := array[
    'notes',
    'inbox_items',
    'tasks',
    'recurring_tasks',
    'transactions',
    'wallets',
    'budgets',
    'savings_goals',
    'debts',
    'goals',
    'goal_events',
    'habit_logs',
    'milestones',
    'books',
    'quotes',
    'reading_goals',
    'agenda_blocks',
    'daily_records',
    'projects',
    'user_settings'
  ];
begin
  foreach t in array synced_tables loop
    -- Check if table exists
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      -- Add updated_at if not present
      execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now();', t);
      
      -- Add deleted_at if not present (tombstone for soft deletes)
      execute format('alter table public.%I add column if not exists deleted_at timestamptz null;', t);

      -- Backfill updated_at where null
      execute format('update public.%I set updated_at = now() where updated_at is null;', t);

      -- Create updated_at trigger to ensure server enforcement
      execute format('drop trigger if exists trg_set_updated_at on public.%I;', t);
      execute format('create trigger trg_set_updated_at before insert or update on public.%I for each row execute function public.set_updated_at_server();', t);

      -- Create index on (user_id, updated_at desc) for fast delta pull
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'user_id'
      ) then
        execute format('create index if not exists %I_user_updated_idx on public.%I (user_id, updated_at desc);', t, t);
        execute format('create index if not exists %I_user_deleted_idx on public.%I (user_id, deleted_at);', t, t);
      end if;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 3. Note Conflict Resolution RPC: upsert_note
-- Prevents silent overwrite on concurrent text edits.
-- If server updated_at > p_base AND content/title differs:
--   Inserts client version as "<title> (conflict copy)" with new UUID
--   Returns { conflict: true, note: <inserted_row> }
-- Else:
--   Updates or inserts existing note
--   Returns { conflict: false, note: <updated_or_inserted_row> }
-- ============================================================================
create or replace function public.upsert_note(
  p_row  jsonb,
  p_base timestamptz default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id     uuid;
  v_note_id     uuid;
  v_existing    record;
  v_result_note record;
  v_title       text;
  v_content     text;
  v_is_conflict boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required to upsert note';
  end if;

  v_note_id := (p_row->>'id')::uuid;
  v_title   := coalesce(p_row->>'title', 'Untitled');
  v_content := coalesce(p_row->>'content', '');

  -- Prevent updating another user's note
  if p_row ? 'user_id' and (p_row->>'user_id')::uuid <> v_user_id then
    raise exception 'Unauthorized note update';
  end if;

  -- Check if note already exists
  select * into v_existing
  from public.notes
  where id = v_note_id and user_id = v_user_id;

  if found then
    -- Check for concurrent conflict:
    -- If server updated_at > client's base AND content or title has diverged
    if p_base is not null
       and v_existing.updated_at > p_base
       and (v_existing.content <> v_content or v_existing.title <> v_title) then
      
      -- Create conflict copy
      insert into public.notes (
        id,
        user_id,
        title,
        content,
        date,
        template,
        folder,
        pinned,
        is_template,
        pin_hash,
        word_count,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        v_user_id,
        v_title || ' (conflict copy)',
        v_content,
        coalesce(p_row->>'date', to_char(now(), 'YYYY-MM-DD')),
        p_row->>'template',
        coalesce(p_row->>'folder', 'All'),
        coalesce((p_row->>'pinned')::boolean, false),
        coalesce((p_row->>'is_template')::boolean, false),
        p_row->>'pin_hash',
        coalesce((p_row->>'word_count')::int, 0),
        now(),
        now()
      )
      returning * into v_result_note;

      return jsonb_build_object(
        'conflict', true,
        'note', to_jsonb(v_result_note)
      );
    else
      -- No conflict or client is up to date: apply update to existing note
      update public.notes
      set
        title       = v_title,
        content     = v_content,
        date        = coalesce(p_row->>'date', v_existing.date),
        template    = case when p_row ? 'template' then p_row->>'template' else v_existing.template end,
        folder      = coalesce(p_row->>'folder', v_existing.folder),
        pinned      = coalesce((p_row->>'pinned')::boolean, v_existing.pinned),
        is_template = coalesce((p_row->>'is_template')::boolean, v_existing.is_template),
        pin_hash    = case when p_row ? 'pin_hash' then p_row->>'pin_hash' else v_existing.pin_hash end,
        word_count  = coalesce((p_row->>'word_count')::int, v_existing.word_count),
        deleted_at  = case when p_row ? 'deleted_at' then (p_row->>'deleted_at')::timestamptz else v_existing.deleted_at end,
        updated_at  = now()
      where id = v_note_id and user_id = v_user_id
      returning * into v_result_note;

      return jsonb_build_object(
        'conflict', false,
        'note', to_jsonb(v_result_note)
      );
    end if;
  else
    -- Note does not exist yet: insert new note
    insert into public.notes (
      id,
      user_id,
      title,
      content,
      date,
      template,
      folder,
      pinned,
      is_template,
      pin_hash,
      word_count,
      created_at,
      updated_at
    ) values (
      v_note_id,
      v_user_id,
      v_title,
      v_content,
      coalesce(p_row->>'date', to_char(now(), 'YYYY-MM-DD')),
      p_row->>'template',
      coalesce(p_row->>'folder', 'All'),
      coalesce((p_row->>'pinned')::boolean, false),
      coalesce((p_row->>'is_template')::boolean, false),
      p_row->>'pin_hash',
      coalesce((p_row->>'word_count')::int, 0),
      coalesce((p_row->>'created_at')::timestamptz, now()),
      now()
    )
    returning * into v_result_note;

    return jsonb_build_object(
      'conflict', false,
      'note', to_jsonb(v_result_note)
    );
  end if;
end;
$$;

revoke execute on function public.upsert_note(jsonb, timestamptz) from public, anon;
grant  execute on function public.upsert_note(jsonb, timestamptz) to authenticated, service_role;

-- ============================================================================
-- 4. Note Version History
-- Automatically keeps snapshots of note edits on the server
-- Throttled to at most 1 snapshot per 5 minutes per note, keeping last 30
-- ============================================================================
create table if not exists public.note_versions (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.note_versions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'note_versions' and policyname = 'Users select own note versions') then
    create policy "Users select own note versions" on public.note_versions
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'note_versions' and policyname = 'Users insert own note versions') then
    create policy "Users insert own note versions" on public.note_versions
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'note_versions' and policyname = 'Users delete own note versions') then
    create policy "Users delete own note versions" on public.note_versions
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists note_versions_note_idx on public.note_versions (note_id, created_at desc);
create index if not exists note_versions_user_idx on public.note_versions (user_id);

-- Trigger function to record note versions
create or replace function public.record_note_version()
returns trigger
language plpgsql
security definer
as $$
declare
  v_last_snapshot timestamptz;
begin
  -- Only record when content or title changed
  if (old.content is not distinct from new.content) and (old.title is not distinct from new.title) then
    return new;
  end if;

  -- Check if a version was recorded for this note in the last 5 minutes
  select created_at into v_last_snapshot
  from public.note_versions
  where note_id = new.id
  order by created_at desc
  limit 1;

  if v_last_snapshot is null or (now() - v_last_snapshot) > interval '5 minutes' then
    -- Record snapshot of the previous version before the update
    insert into public.note_versions (note_id, user_id, title, content, created_at)
    values (old.id, old.user_id, old.title, coalesce(old.content, ''), now());

    -- Prune versions older than the 30 most recent for this note
    delete from public.note_versions
    where note_id = new.id
      and id not in (
        select id from public.note_versions
        where note_id = new.id
        order by created_at desc
        limit 30
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_record_note_version on public.notes;
create trigger trg_record_note_version
  before update on public.notes
  for each row
  execute function public.record_note_version();

-- ============================================================================
-- 5. Add synced tables to supabase_realtime publication
-- ============================================================================
do $$
declare
  t text;
  synced_tables text[] := array[
    'notes',
    'inbox_items',
    'tasks',
    'recurring_tasks',
    'transactions',
    'wallets',
    'budgets',
    'savings_goals',
    'debts',
    'goals',
    'goal_events',
    'habit_logs',
    'milestones',
    'books',
    'quotes',
    'agenda_blocks',
    'daily_records',
    'projects',
    'user_settings'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array synced_tables loop
      if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = t
      ) and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I;', t);
      end if;
    end loop;
  end if;
end $$;

