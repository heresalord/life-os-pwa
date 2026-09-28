-- =============================================================================
-- LIFE OS — MASTER CONSOLIDATED DATABASE SCHEMA (IDEMPOTENT)
-- =============================================================================
-- This file contains the complete, consolidated Supabase schema for Life OS.
-- It is designed to be 100% safe to run multiple times on both empty and existing
-- databases. When executed, anything that already exists will be safely skipped.
--
-- How to apply:
-- 1. Open the Supabase Dashboard -> SQL Editor
-- 2. Paste this entire script and click "Run"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optional extensions for scheduled notifications & webhooks (ignored if unsupported)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_net";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net extension not available, skipping.';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- 1. USER PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  timezone     TEXT NOT NULL DEFAULT 'UTC',
  onboarded    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS timezone     TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS onboarded    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Trigger: auto-create user_profiles record on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Account deletion RPC for users to safely delete their own account & cascaded data
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deletes the authenticated user from auth.users; foreign keys with ON DELETE CASCADE
  -- will automatically purge all user records across all tables.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. USER SETTINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  currency               TEXT DEFAULT 'USD',
  daily_budget           NUMERIC(10,2) DEFAULT 100.00,
  expense_categories     TEXT[] DEFAULT ARRAY['food','coffee','transport','entertainment','utilities','health','shopping','personal','other'],
  income_categories      TEXT[] DEFAULT ARRAY['salary','freelance','business','investment','gift','refund','bonus','other'],
  category_budgets       JSONB DEFAULT '{}'::jsonb,
  theme                  TEXT DEFAULT 'dark',
  auto_theme             TEXT DEFAULT 'off',
  accent_color           TEXT,
  morning_reminder_time  TIME,
  night_reminder_time    TIME,
  notifications_enabled  BOOLEAN DEFAULT false,
  notification_preferences JSONB DEFAULT '{
    "morning_reminder": true,
    "evening_reminder": true,
    "task_due_today": true,
    "task_overdue": true,
    "streak_alert": true,
    "budget_alert": true,
    "goal_milestone": true,
    "savings_goal_reached": true,
    "weekly_review": true
  }'::jsonb,
  dashboard_widgets      JSONB DEFAULT '[]'::jsonb,
  updated_at             TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS auto_theme               TEXT DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS accent_color             TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "morning_reminder": true,
    "evening_reminder": true,
    "task_due_today": true,
    "task_overdue": true,
    "streak_alert": true,
    "budget_alert": true,
    "goal_milestone": true,
    "savings_goal_reached": true,
    "weekly_review": true
  }'::jsonb;

-- -----------------------------------------------------------------------------
-- 3. DAILY RECORDS (WELLBEING & JOURNAL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  mood             SMALLINT CHECK (mood BETWEEN 1 AND 5),
  intent           TEXT,
  reflections      JSONB DEFAULT '{}'::jsonb,
  energy_am        SMALLINT CHECK (energy_am BETWEEN 1 AND 5),
  energy_pm        SMALLINT CHECK (energy_pm BETWEEN 1 AND 5),
  gratitude        JSONB DEFAULT '[]'::jsonb,
  win_of_day       VARCHAR(280),
  went_well        TEXT,
  do_differently   TEXT,
  tomorrow_focus   TEXT,
  morning_complete BOOLEAN NOT NULL DEFAULT false,
  evening_complete BOOLEAN NOT NULL DEFAULT false,
  day_score        SMALLINT CHECK (day_score BETWEEN 0 AND 100) DEFAULT 0,
  journal          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_records
  ADD COLUMN IF NOT EXISTS energy_am        SMALLINT CHECK (energy_am BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS energy_pm        SMALLINT CHECK (energy_pm BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS gratitude        JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS win_of_day       VARCHAR(280),
  ADD COLUMN IF NOT EXISTS went_well        TEXT,
  ADD COLUMN IF NOT EXISTS do_differently   TEXT,
  ADD COLUMN IF NOT EXISTS tomorrow_focus   TEXT,
  ADD COLUMN IF NOT EXISTS morning_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evening_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS day_score        SMALLINT CHECK (day_score BETWEEN 0 AND 100) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS journal          TEXT;

CREATE INDEX IF NOT EXISTS daily_records_user_date_idx ON daily_records(user_id, date);

-- -----------------------------------------------------------------------------
-- 4. PROJECTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  description TEXT,
  archived    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id);

-- -----------------------------------------------------------------------------
-- 5. TASKS & RECURRING TASKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  title            TEXT NOT NULL,
  completed        BOOLEAN DEFAULT false,
  skipped          BOOLEAN DEFAULT false,
  priority         SMALLINT CHECK (priority BETWEEN 1 AND 5),
  completed_at     TIMESTAMPTZ,
  skipped_at       TIMESTAMPTZ,
  carried_from     DATE,
  from_inbox_id    UUID,
  due_date         DATE,
  description      TEXT,
  tags             JSONB DEFAULT '[]'::jsonb,
  subtasks         JSONB DEFAULT '[]'::jsonb,
  kanban_status    TEXT NOT NULL DEFAULT 'todo' CHECK (kanban_status IN ('backlog', 'todo', 'in_progress', 'done')),
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  time_block_start TIME,
  time_block_end   TIME,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS due_date         DATE,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS tags             JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtasks         JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kanban_status    TEXT NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_block_start TIME,
  ADD COLUMN IF NOT EXISTS time_block_end   TIME;

CREATE INDEX IF NOT EXISTS tasks_user_date_idx ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS tasks_user_project_idx ON tasks(user_id, project_id);

CREATE TABLE IF NOT EXISTS recurring_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  priority     SMALLINT,
  repeat       TEXT NOT NULL CHECK (repeat IN ('daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'monthly_ordinal')),
  days         INTEGER[],
  day_of_week  SMALLINT,
  day_of_month SMALLINT,
  ordinal      SMALLINT,
  weekday      SMALLINT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_tasks_user_id_idx ON recurring_tasks(user_id);

-- -----------------------------------------------------------------------------
-- 6. FINANCE (WALLETS, TRANSACTIONS, BUDGETS, SAVINGS, DEBTS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'credit', 'savings')),
  currency   TEXT NOT NULL DEFAULT 'USD',
  balance    NUMERIC(14,2) DEFAULT 0,
  color      TEXT,
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS wallets_user_idx ON wallets(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('expense', 'income', 'adjustment')),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category              TEXT NOT NULL,
  method                TEXT NOT NULL,
  description           TEXT,
  wallet_id             UUID REFERENCES wallets(id) ON DELETE SET NULL,
  transfer_to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Safely ensure transaction check constraint includes 'adjustment'
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('expense', 'income', 'adjustment'));

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS wallet_id             UUID REFERENCES wallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes                 TEXT;

CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS transactions_user_type_date_idx ON transactions(user_id, type, date);
CREATE INDEX IF NOT EXISTS transactions_wallet_idx ON transactions(wallet_id);

CREATE TABLE IF NOT EXISTS budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('daily', 'monthly', 'yearly')),
  limit_amount NUMERIC(14,2) NOT NULL,
  currency     TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budgets_user_idx ON budgets(user_id);

CREATE TABLE IF NOT EXISTS savings_goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  target     NUMERIC(14,2) NOT NULL,
  current    NUMERIC(14,2) DEFAULT 0,
  currency   TEXT NOT NULL,
  deadline   DATE,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_goals_user_idx ON savings_goals(user_id);

CREATE TABLE IF NOT EXISTS debts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  amount     NUMERIC(14,2) NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('i_owe', 'owe_me')),
  due_date   DATE,
  paid       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debts_user_idx ON debts(user_id);

-- -----------------------------------------------------------------------------
-- 7. GOALS, HABIT LOGS, AND MILESTONES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  goal_type        TEXT NOT NULL CHECK (goal_type IN ('year', 'general', 'binary')),
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('count', 'currency', 'time', 'percentage', 'binary')),
  target           NUMERIC(14,2),
  currency         TEXT,
  start_date       DATE,
  end_date         DATE,
  state            TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused', 'completed', 'abandoned')),
  is_completed     BOOLEAN DEFAULT false,
  sub_goals        JSONB DEFAULT '[]'::jsonb,
  tracker_type     TEXT NOT NULL DEFAULT 'target' CHECK (tracker_type IN ('target', 'habit', 'average', 'project')),
  category         TEXT,
  habit_schedule   JSONB DEFAULT '{"frequency": "daily", "days": []}'::jsonb,
  habit_streak     INTEGER DEFAULT 0,
  last_checkin     DATE,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS sub_goals      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tracker_type   TEXT NOT NULL DEFAULT 'target',
  ADD COLUMN IF NOT EXISTS category       TEXT,
  ADD COLUMN IF NOT EXISTS habit_schedule JSONB DEFAULT '{"frequency": "daily", "days": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS habit_streak   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin   DATE,
  ADD COLUMN IF NOT EXISTS project_id     UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS goals_user_state_idx ON goals(user_id, state);

CREATE TABLE IF NOT EXISTS goal_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id     UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  sub_goal_id UUID,
  event_type  TEXT NOT NULL CHECK (event_type IN ('add', 'subtract', 'state_change', 'target_change', 'complete')),
  value       NUMERIC(14,2) NOT NULL DEFAULT 0,
  date        DATE NOT NULL,
  note        TEXT,
  new_state   TEXT,
  old_target  NUMERIC(14,2),
  new_target  NUMERIC(14,2),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_events_goal_idx ON goal_events(goal_id);
CREATE INDEX IF NOT EXISTS goal_events_user_date_idx ON goal_events(user_id, date);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id    UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  value      NUMERIC(14,2) NOT NULL DEFAULT 1,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (goal_id, date)
);

CREATE INDEX IF NOT EXISTS habit_logs_goal_id_idx ON habit_logs(goal_id);
CREATE INDEX IF NOT EXISTS habit_logs_user_date_idx ON habit_logs(user_id, date);

CREATE TABLE IF NOT EXISTS milestones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id    UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT false,
  due_date   DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestones_goal_id_idx ON milestones(goal_id);
CREATE INDEX IF NOT EXISTS milestones_user_id_idx ON milestones(user_id);

-- -----------------------------------------------------------------------------
-- 8. BOOKS & QUOTES & READING GOALS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  author           TEXT,
  cover_url        TEXT,
  status           TEXT NOT NULL DEFAULT 'to-read' CHECK (status IN ('to-read', 'reading', 'finished', 'abandoned')),
  started_at       DATE,
  finished_at      DATE,
  current_page     INT DEFAULT 0,
  total_pages      INT,
  rating           INT CHECK (rating >= 1 AND rating <= 5),
  tags             TEXT[] DEFAULT '{}',
  reflection       TEXT,
  abandon_reason   TEXT,
  genre            TEXT,
  isbn             TEXT,
  language         TEXT,
  source           TEXT CHECK (source IN ('physical', 'ebook', 'audiobook', 'library')),
  reading_sessions JSONB DEFAULT '[]'::jsonb,
  shelves          JSONB DEFAULT '[]'::jsonb,
  added_at         DATE DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS cover_url        TEXT,
  ADD COLUMN IF NOT EXISTS started_at       DATE,
  ADD COLUMN IF NOT EXISTS finished_at      DATE,
  ADD COLUMN IF NOT EXISTS rating           INT CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS reflection       TEXT,
  ADD COLUMN IF NOT EXISTS abandon_reason   TEXT,
  ADD COLUMN IF NOT EXISTS reading_sessions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shelves          JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS books_user_status_idx ON books(user_id, status);

CREATE TABLE IF NOT EXISTS quotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  page       INT,
  date       DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_book_idx ON quotes(book_id);
CREATE INDEX IF NOT EXISTS quotes_user_idx ON quotes(user_id);

CREATE TABLE IF NOT EXISTS reading_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  target_books INTEGER NOT NULL,
  target_pages INTEGER,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, year)
);

CREATE INDEX IF NOT EXISTS reading_goals_user_idx ON reading_goals(user_id);

-- -----------------------------------------------------------------------------
-- 9. AGENDA BLOCKS (TIME BLOCKS WITH RECURRENCE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  description TEXT NOT NULL,
  all_day     BOOLEAN NOT NULL DEFAULT false,
  recurrence  JSONB DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time OR all_day = true)
);

ALTER TABLE agenda_blocks
  ADD COLUMN IF NOT EXISTS all_day    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence JSONB DEFAULT NULL;

-- Ensure check constraint allows all_day blocks where end_time may equal start_time
ALTER TABLE agenda_blocks DROP CONSTRAINT IF EXISTS end_after_start;
ALTER TABLE agenda_blocks ADD CONSTRAINT end_after_start
  CHECK (end_time > start_time OR all_day = true);

CREATE INDEX IF NOT EXISTS agenda_blocks_user_date_idx ON agenda_blocks(user_id, date);

-- -----------------------------------------------------------------------------
-- 10. INBOX ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  type         TEXT DEFAULT 'thought' CHECK (type IN ('thought', 'idea', 'worry', 'todo', 'other')),
  processed    BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processed_to TEXT CHECK (processed_to IN ('task', 'note', 'handled')),
  archived_at  TIMESTAMPTZ,
  captured_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbox_items_user_processed_idx ON inbox_items(user_id, processed);

-- -----------------------------------------------------------------------------
-- 11. NOTES (WITH PIN LOCK, FOLDERS, PINNED, TEMPLATES)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  template    TEXT,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  folder      TEXT NOT NULL DEFAULT 'All',
  word_count  INT NOT NULL DEFAULT 0,
  is_template BOOLEAN NOT NULL DEFAULT false,
  pin_hash    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS pinned      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS folder      TEXT NOT NULL DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS word_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash    TEXT;

-- Expand template check constraint to cover all 7 note templates
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_template_check;
ALTER TABLE notes ADD CONSTRAINT notes_template_check
  CHECK (template IN ('morning', 'evening', 'weekly-review', 'gratitude', 'book-notes', 'meeting-notes', null));

CREATE INDEX IF NOT EXISTS notes_user_date_idx ON notes(user_id, date);
CREATE INDEX IF NOT EXISTS notes_user_folder_idx ON notes(user_id, folder);
CREATE INDEX IF NOT EXISTS notes_user_pinned_idx ON notes(user_id, pinned);

-- -----------------------------------------------------------------------------
-- 12. PUSH SUBSCRIPTIONS & NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  keys       JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  device     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON fcm_tokens (user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_read_created_at_idx 
  ON notifications (user_id, read, created_at DESC);

-- -----------------------------------------------------------------------------
-- 13. SHARED ITEMS (COLLABORATION)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type         TEXT NOT NULL CHECK (item_type IN ('project', 'task', 'inbox')),
  item_id           UUID NOT NULL,
  code              TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_items_code_idx ON shared_items(code);
CREATE INDEX IF NOT EXISTS shared_items_shared_with_id_idx ON shared_items(shared_with_id);
CREATE INDEX IF NOT EXISTS shared_items_item_id_idx ON shared_items(item_id);

-- -----------------------------------------------------------------------------
-- 14. REAL-TIME NOTIFICATION TRIGGERS
-- -----------------------------------------------------------------------------

-- A. Budget Alert Trigger (fires when 80%+ of daily budget spent in primary currency)
CREATE OR REPLACE FUNCTION check_budget_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_budget    NUMERIC(10,2);
  user_currency  TEXT;
  current_spend  NUMERIC(12,2);
  has_notified   BOOLEAN;
  prefs          JSONB;
  budget_enabled BOOLEAN;
BEGIN
  IF NEW.type <> 'expense' THEN
    RETURN NEW;
  END IF;

  IF NEW.date <> CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  SELECT daily_budget, currency, notification_preferences
  INTO user_budget, user_currency, prefs
  FROM user_settings
  WHERE user_id = NEW.user_id;

  budget_enabled := COALESCE((prefs->>'budget_alert')::BOOLEAN, true);
  IF NOT budget_enabled THEN
    RETURN NEW;
  END IF;

  IF user_budget IS NULL OR user_budget <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(t.amount), 0) INTO current_spend
  FROM transactions t
  LEFT JOIN wallets w ON t.wallet_id = w.id
  WHERE t.user_id = NEW.user_id
    AND t.date = CURRENT_DATE
    AND t.type = 'expense'
    AND COALESCE(w.currency, user_currency) = user_currency;

  IF current_spend >= (user_budget * 0.8) THEN
    SELECT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id    = NEW.user_id
        AND type       = 'budget_alert'
        AND created_at >= CURRENT_DATE::TIMESTAMPTZ
        AND created_at <  (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMPTZ
    ) INTO has_notified;

    IF NOT has_notified THEN
      INSERT INTO notifications (user_id, title, body, type, action_url)
      VALUES (
        NEW.user_id,
        'Budget Warning ⚠️',
        'You''ve used ' || ROUND((current_spend / user_budget * 100)) ||
          '% of your daily budget today (' ||
          to_char(current_spend, 'FM999999990.00') || ' / ' ||
          to_char(user_budget,   'FM999999990.00') || ').',
        'budget_alert',
        '/finance'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_budget_check ON transactions;
CREATE TRIGGER on_transaction_budget_check
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE check_budget_limit();

-- B. Goal Completion Trigger
CREATE OR REPLACE FUNCTION check_goal_completion()
RETURNS TRIGGER AS $$
DECLARE
  prefs             JSONB;
  milestone_enabled BOOLEAN;
BEGIN
  SELECT notification_preferences INTO prefs
  FROM user_settings 
  WHERE user_id = NEW.user_id;

  milestone_enabled := COALESCE((prefs->>'goal_milestone')::BOOLEAN, true);
  IF NOT milestone_enabled THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND (NEW.is_completed = true OR NEW.state = 'completed')) OR
     (TG_OP = 'UPDATE' AND (
       (NEW.is_completed = true AND (OLD.is_completed IS NULL OR OLD.is_completed = false)) OR
       (NEW.state = 'completed' AND (OLD.state IS NULL OR OLD.state <> 'completed'))
     )) THEN
     
    INSERT INTO notifications (user_id, title, body, type, action_url)
    VALUES (
      NEW.user_id,
      'Goal Achieved! 🎉',
      'Target reached! You officially crushed your goal: "' || NEW.name || '". Time to celebrate!',
      'goal_milestone',
      '/goals/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_goal_completed ON goals;
CREATE TRIGGER on_goal_completed
  AFTER INSERT OR UPDATE ON goals
  FOR EACH ROW EXECUTE PROCEDURE check_goal_completion();

-- C. Savings Goal Reached Trigger
CREATE OR REPLACE FUNCTION check_savings_goal_completion()
RETURNS TRIGGER AS $$
DECLARE
  prefs           JSONB;
  savings_enabled BOOLEAN;
BEGIN
  SELECT notification_preferences INTO prefs
  FROM user_settings 
  WHERE user_id = NEW.user_id;

  savings_enabled := COALESCE((prefs->>'savings_goal_reached')::BOOLEAN, true);
  IF NOT savings_enabled THEN
    RETURN NEW;
  END IF;

  IF (NEW.current >= NEW.target) AND (TG_OP = 'INSERT' OR OLD.current < OLD.target) THEN
    INSERT INTO notifications (user_id, title, body, type, action_url)
    VALUES (
      NEW.user_id,
      'Savings Goal Reached! 💰',
      'Target hit! Your savings goal "' || NEW.name || '" is fully funded. Go you!',
      'savings_goal_reached',
      '/finance'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_savings_goal_updated ON savings_goals;
CREATE TRIGGER on_savings_goal_updated
  AFTER INSERT OR UPDATE ON savings_goals
  FOR EACH ROW EXECUTE PROCEDURE check_savings_goal_completion();

-- -----------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY (RLS) AUDIT & UNIFIED POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE books              ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_blocks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_items       ENABLE ROW LEVEL SECURITY;

-- Drop all old policies cleanly to ensure consistent, idempotent naming
DO $$
DECLARE
  r RECORD;
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
        'projects','reading_goals','notifications','push_subscriptions',
        'fcm_tokens','shared_items'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Standard user_id ownership policies
DO $$
DECLARE
  t TEXT;
  tbl TEXT[] := ARRAY[
    'tasks','transactions','goals','goal_events',
    'habit_logs','milestones','books','quotes','agenda_blocks',
    'inbox_items','notes','daily_records','user_settings',
    'recurring_tasks','wallets','budgets','savings_goals','debts',
    'projects','reading_goals','notifications','push_subscriptions','fcm_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tbl LOOP
    EXECUTE format('CREATE POLICY "select_own" ON %I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "insert_own" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "update_own" ON %I FOR UPDATE USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "delete_own" ON %I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;

-- user_profiles (keyed by id = auth.uid())
CREATE POLICY "select_own" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert_own" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "delete_own" ON user_profiles FOR DELETE USING (auth.uid() = id);

-- shared_items (sender or accepted recipient)
CREATE POLICY "select_own" ON shared_items
  FOR SELECT USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_id
    OR lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "insert_own" ON shared_items
  FOR INSERT WITH CHECK (auth.uid() = shared_by);

CREATE POLICY "update_own" ON shared_items
  FOR UPDATE USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_id
    OR lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "delete_own" ON shared_items
  FOR DELETE USING (auth.uid() = shared_by);

-- Collaboration policies on shared resources (projects, tasks, inbox_items)
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
    OR
    EXISTS (
      SELECT 1 FROM shared_items s
      WHERE s.item_type = 'project'
        AND s.item_id   = tasks.project_id
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

-- =============================================================================
-- End of Master Consolidated Schema
-- =============================================================================
