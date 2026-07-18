-- =============================================================================
-- LIFE OS — RLS Audit & Schema Fixes  (2026-07-07)
-- Safe to run multiple times (fully idempotent).
-- Run in Supabase SQL Editor — paste the entire file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Schema fixes — columns added by code but never migrated
-- ---------------------------------------------------------------------------

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS habit_streak  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin  text,
  ADD COLUMN IF NOT EXISTS tracker_type  text    NOT NULL DEFAULT 'target',
  ADD COLUMN IF NOT EXISTS habit_schedule jsonb,
  ADD COLUMN IF NOT EXISTS category      text,
  ADD COLUMN IF NOT EXISTS project_id    uuid REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kanban_status text NOT NULL DEFAULT 'todo';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL;

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS currency text    NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table
-- ---------------------------------------------------------------------------

ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE books             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_blocks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_goals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_items      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Drop ALL existing policies (both old names and new names)
--    This covers policies created by 20260621_sharing.sql and any previous
--    run of this script. Fully idempotent.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_profiles','tasks','transactions','goals','goal_events',
        'habit_logs','milestones','books','quotes','agenda_blocks',
        'inbox_items','notes','daily_records','user_settings',
        'recurring_tasks','wallets','budgets','savings_goals','debts',
        'projects','reading_goals','notifications','shared_items'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Standard owner-only policies — all tables keyed by user_id
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tbl text[] := ARRAY[
    'tasks','transactions','goals','goal_events',
    'habit_logs','milestones','books','quotes','agenda_blocks',
    'inbox_items','notes','daily_records','user_settings',
    'recurring_tasks','wallets','budgets','savings_goals','debts',
    'projects','reading_goals','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tbl LOOP
    EXECUTE format(
      'CREATE POLICY "select_own" ON %I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "insert_own" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "update_own" ON %I FOR UPDATE USING (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "delete_own" ON %I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. user_profiles — keyed by id (not user_id)
-- ---------------------------------------------------------------------------

CREATE POLICY "select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "delete_own" ON user_profiles
  FOR DELETE USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 5. shared_items — sender OR accepted recipient can see; only sender deletes
--    Column types (from 20260621_sharing.sql):
--      shared_by      uuid
--      shared_with_id uuid
--      item_id        uuid
-- ---------------------------------------------------------------------------

CREATE POLICY "select_own" ON shared_items
  FOR SELECT USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_id
    OR lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "insert_own" ON shared_items
  FOR INSERT WITH CHECK (auth.uid() = shared_by);

-- Recipient accepts; sender can also update (e.g. revoke)
CREATE POLICY "update_own" ON shared_items
  FOR UPDATE USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_id
    OR lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "delete_own" ON shared_items
  FOR DELETE USING (auth.uid() = shared_by);

-- ---------------------------------------------------------------------------
-- 6. Shared-item read/write access — recipients of accepted share codes
--    item_id is uuid; table primary keys are uuid — compare directly,
--    no casts required.
-- ---------------------------------------------------------------------------

CREATE POLICY "select_shared" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shared_items s
      WHERE s.item_type = 'project'
        AND s.item_id   = projects.id
        AND s.status    = 'accepted'
        AND (s.shared_with_id = auth.uid()
             OR lower(s.shared_with_email) = lower(auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "update_shared" ON projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shared_items s
      WHERE s.item_type = 'project'
        AND s.item_id   = projects.id
        AND s.status    = 'accepted'
        AND (s.shared_with_id = auth.uid()
             OR lower(s.shared_with_email) = lower(auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "select_shared" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shared_items s
      WHERE s.item_type = 'task'
        AND s.item_id   = tasks.id
        AND s.status    = 'accepted'
        AND (s.shared_with_id = auth.uid()
             OR lower(s.shared_with_email) = lower(auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "select_shared" ON inbox_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shared_items s
      WHERE s.item_type = 'inbox'
        AND s.item_id   = inbox_items.id
        AND s.status    = 'accepted'
        AND (s.shared_with_id = auth.uid()
             OR lower(s.shared_with_email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Verification — uncomment and run to confirm all policies are in place
-- ---------------------------------------------------------------------------
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
