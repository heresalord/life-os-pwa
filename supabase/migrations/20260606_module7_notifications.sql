-- ========================================================
-- 1. NOTIFICATIONS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  action_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching unread notifications quickly
CREATE INDEX IF NOT EXISTS notifications_user_id_read_created_at_idx 
  ON notifications (user_id, read, created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users manage their own notifications
CREATE POLICY "Users manage own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ========================================================
-- 2. FCM TOKENS TABLE (For Native Android Push)
-- ========================================================
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  device      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON fcm_tokens (user_id);

-- Enable RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users manage their own FCM tokens
CREATE POLICY "Users manage own FCM tokens" ON fcm_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ========================================================
-- 3. USER SETTINGS UPDATES
-- ========================================================
ALTER TABLE user_settings
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

-- ========================================================
-- 4. REAL-TIME TRIGGERS
-- ========================================================

-- A. Budget Alert Trigger
CREATE OR REPLACE FUNCTION check_budget_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_budget NUMERIC(10,2);
  current_spend NUMERIC(12,2);
  has_notified BOOLEAN;
  prefs JSONB;
  budget_enabled BOOLEAN;
BEGIN
  -- Only trigger for expenses
  IF NEW.type <> 'expense' THEN
    RETURN NEW;
  END IF;

  -- Get user preferences & budget
  SELECT daily_budget, notification_preferences 
  INTO user_budget, prefs
  FROM user_settings 
  WHERE user_id = NEW.user_id;

  -- Verify preferences allow budget alerts
  budget_enabled := COALESCE((prefs->>'budget_alert')::BOOLEAN, true);
  IF NOT budget_enabled THEN
    RETURN NEW;
  END IF;

  IF user_budget IS NULL OR user_budget <= 0 THEN
    RETURN NEW;
  END IF;

  -- Sum spending for the transaction's date
  SELECT COALESCE(SUM(amount), 0) INTO current_spend
  FROM transactions
  WHERE user_id = NEW.user_id 
    AND date = NEW.date 
    AND type = 'expense';

  -- Trigger if current spend exceeds 80% of daily budget
  IF current_spend >= (user_budget * 0.8) THEN
    -- Check if we already notified for this user + date combo
    SELECT EXISTS (
      SELECT 1 FROM notifications 
      WHERE user_id = NEW.user_id 
        AND type = 'budget_alert' 
        AND created_at::DATE = NEW.date
    ) INTO has_notified;

    IF NOT has_notified THEN
      INSERT INTO notifications (user_id, title, body, type, action_url)
      VALUES (
        NEW.user_id,
        'Budget Warning ⚠️',
        'Whoa there, big spender! You''ve used up ' || ROUND((current_spend / user_budget * 100)) || '% of your daily budget. Let''s chill on the spending.',
        'budget_alert',
        '/finance'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_transaction_budget_check
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE check_budget_limit();


-- B. Goal Milestone Complete Trigger
CREATE OR REPLACE FUNCTION check_goal_completion()
RETURNS TRIGGER AS $$
DECLARE
  prefs JSONB;
  milestone_enabled BOOLEAN;
BEGIN
  -- Get user preferences
  SELECT notification_preferences INTO prefs
  FROM user_settings 
  WHERE user_id = NEW.user_id;

  milestone_enabled := COALESCE((prefs->>'goal_milestone')::BOOLEAN, true);
  IF NOT milestone_enabled THEN
    RETURN NEW;
  END IF;

  -- If goal is completed and was not completed before
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

CREATE OR REPLACE TRIGGER on_goal_completed
  AFTER INSERT OR UPDATE ON goals
  FOR EACH ROW EXECUTE PROCEDURE check_goal_completion();


-- C. Savings Goal Reached Trigger
CREATE OR REPLACE FUNCTION check_savings_goal_completion()
RETURNS TRIGGER AS $$
DECLARE
  prefs JSONB;
  savings_enabled BOOLEAN;
BEGIN
  -- Get user preferences
  SELECT notification_preferences INTO prefs
  FROM user_settings 
  WHERE user_id = NEW.user_id;

  savings_enabled := COALESCE((prefs->>'savings_goal_reached')::BOOLEAN, true);
  IF NOT savings_enabled THEN
    RETURN NEW;
  END IF;

  -- Notify when savings goal target is met or exceeded
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

CREATE OR REPLACE TRIGGER on_savings_goal_updated
  AFTER INSERT OR UPDATE ON savings_goals
  FOR EACH ROW EXECUTE PROCEDURE check_savings_goal_completion();
