-- Catch-up migrations for remaining fields/tables in Life OS DB
-- Created: 2026-06-14

-- 1. Theme/Accent Color Picker settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_theme text DEFAULT 'off';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS accent_color text;

-- 2. All-day / Recurring lightweight events in agenda
ALTER TABLE agenda_blocks ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;
ALTER TABLE agenda_blocks ADD COLUMN IF NOT EXISTS recurrence jsonb DEFAULT NULL;

-- 3. Projects assignment to Goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;


-- 5. Recurring Tasks table
CREATE TABLE IF NOT EXISTS recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  priority smallint,
  repeat text NOT NULL CHECK (repeat IN ('daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'monthly_ordinal')),
  days integer[],
  day_of_week smallint,
  day_of_month smallint,
  ordinal smallint,
  weekday smallint,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for recurring_tasks
ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;

-- Policy for recurring_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recurring_tasks' AND policyname = 'Users access own recurring tasks'
  ) THEN
    CREATE POLICY "Users access own recurring tasks" ON recurring_tasks 
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Index for recurring_tasks
CREATE INDEX IF NOT EXISTS recurring_tasks_user_id_idx ON recurring_tasks(user_id);
