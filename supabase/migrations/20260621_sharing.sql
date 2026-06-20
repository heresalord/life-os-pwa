-- ============================================================
-- Sprint Feature: User-to-User Collaborative Sharing via Email Codes
--
-- Creates shared_items table and configures RLS policies on projects,
-- tasks, and inbox_items to allow shared users to view and edit.
-- ============================================================

-- Create shared_items table
CREATE TABLE IF NOT EXISTS shared_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  shared_with_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('project', 'task', 'inbox')),
  item_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS shared_items_code_idx ON shared_items(code);
CREATE INDEX IF NOT EXISTS shared_items_shared_with_id_idx ON shared_items(shared_with_id);
CREATE INDEX IF NOT EXISTS shared_items_item_id_idx ON shared_items(item_id);

-- Enable RLS on shared_items
ALTER TABLE shared_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view shares they created or sent to their email/id
CREATE POLICY "Users view own or received shares" ON shared_items
  FOR SELECT USING (
    auth.uid() = shared_by OR
    auth.uid() = shared_with_id OR
    lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

-- Policy: Owner can manage (insert/delete) their own shares
CREATE POLICY "Users manage own shares" ON shared_items
  FOR ALL USING (auth.uid() = shared_by);

-- Policy: Recipient can update status to accept share
CREATE POLICY "Users accept shares" ON shared_items
  FOR UPDATE USING (
    auth.uid() = shared_with_id OR
    lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  ) WITH CHECK (
    status = 'accepted'
  );


-- ============================================================
-- RLS Updates for Projects, Tasks, and Inbox Items
-- ============================================================

-- 1. Projects
DROP POLICY IF EXISTS "Users access own projects" ON projects;

CREATE POLICY "Users access own or shared projects" ON projects
  FOR ALL USING (
    auth.uid() = user_id OR
    id IN (
      SELECT item_id FROM shared_items
      WHERE item_type = 'project'
        AND (shared_with_id = auth.uid() OR lower(shared_with_email) = lower(auth.jwt() ->> 'email'))
        AND status = 'accepted'
    )
  );

-- 2. Tasks (Enable RLS and add policies)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own tasks" ON tasks;
DROP POLICY IF EXISTS "Users manage own tasks" ON tasks;

CREATE POLICY "Users access own or shared tasks" ON tasks
  FOR ALL USING (
    auth.uid() = user_id OR
    project_id IN (
      SELECT item_id FROM shared_items
      WHERE item_type = 'project'
        AND (shared_with_id = auth.uid() OR lower(shared_with_email) = lower(auth.jwt() ->> 'email'))
        AND status = 'accepted'
    ) OR
    id IN (
      SELECT item_id FROM shared_items
      WHERE item_type = 'task'
        AND (shared_with_id = auth.uid() OR lower(shared_with_email) = lower(auth.jwt() ->> 'email'))
        AND status = 'accepted'
    )
  );

-- 3. Inbox Items (Enable RLS and add policies)
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own inbox items" ON inbox_items;
DROP POLICY IF EXISTS "Users manage own inbox items" ON inbox_items;

CREATE POLICY "Users access own or shared inbox items" ON inbox_items
  FOR ALL USING (
    auth.uid() = user_id OR
    id IN (
      SELECT item_id FROM shared_items
      WHERE item_type = 'inbox'
        AND (shared_with_id = auth.uid() OR lower(shared_with_email) = lower(auth.jwt() ->> 'email'))
        AND status = 'accepted'
    )
  );
