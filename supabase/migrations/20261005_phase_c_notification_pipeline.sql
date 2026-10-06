-- ============================================================================
-- Phase C: Notification Core Pipeline
-- Reconciles notifications schema, notification_preferences, devices,
-- and creates domain-event notify() dispatcher with triggers.
-- ============================================================================

-- 1. RECONCILE NOTIFICATIONS TABLE
-- Add payload and read_at columns if not present
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Automatically synchronize read boolean and read_at timestamp
CREATE OR REPLACE FUNCTION sync_notification_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read = true AND (OLD.read IS NULL OR OLD.read = false) AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  ELSIF NEW.read_at IS NOT NULL AND NEW.read = false THEN
    NEW.read := true;
  ELSIF NEW.read = false AND OLD.read = true THEN
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notification_read ON notifications;
CREATE TRIGGER trg_sync_notification_read
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION sync_notification_read_status();

-- Ensure indexes for querying notifications
CREATE INDEX IF NOT EXISTS notifications_user_type_idx ON notifications (user_id, type);
CREATE INDEX IF NOT EXISTS notifications_user_read_at_idx ON notifications (user_id, read_at);


-- 2. NOTIFICATION PREFERENCES TABLE
-- Stores user preferences per event type across in_app, email, and push channels
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  in_app      BOOLEAN NOT NULL DEFAULT true,
  email       BOOLEAN NOT NULL DEFAULT false,
  push        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, event_type)
);

-- Enable RLS on notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notification preferences" ON notification_preferences;
CREATE POLICY "Users view own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own notification preferences" ON notification_preferences;
CREATE POLICY "Users manage own notification preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);


-- 3. DEVICES TABLE
-- Multi-platform push tokens (web, PWA, iOS, Android)
CREATE TABLE IF NOT EXISTS devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'pwa')),
  push_token   TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, push_token)
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices (user_id);

-- Enable RLS on devices
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own devices" ON devices;
CREATE POLICY "Users manage own devices" ON devices
  FOR ALL USING (auth.uid() = user_id);


-- 4. DEFAULT PREFERENCES HELPER (C2 Event Catalog Defaults)
CREATE OR REPLACE FUNCTION get_notification_defaults(p_event_type TEXT)
RETURNS TABLE(def_in_app BOOLEAN, def_email BOOLEAN, def_push BOOLEAN) AS $$
BEGIN
  CASE p_event_type
    WHEN 'project.member_joined' THEN
      RETURN QUERY SELECT true, false, true;
    WHEN 'share.invited' THEN
      RETURN QUERY SELECT true, true, true;
    WHEN 'friend.request_received' THEN
      RETURN QUERY SELECT true, true, true;
    WHEN 'friend.request_accepted' THEN
      RETURN QUERY SELECT true, false, false;
    WHEN 'note.shared' THEN
      RETURN QUERY SELECT true, false, false;
    WHEN 'book.recommended' THEN
      RETURN QUERY SELECT true, false, false;
    WHEN 'finance.budget_warning' THEN
      RETURN QUERY SELECT true, true, true;
    WHEN 'task.reminder' THEN
      RETURN QUERY SELECT true, false, true;
    ELSE
      RETURN QUERY SELECT true, false, false;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 5. NOTIFY DISPATCHER FUNCTION
-- Emits in-app notification row (unless muted) and records event payload
CREATE OR REPLACE FUNCTION notify(
  p_user_id UUID,
  p_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  pref_in_app BOOLEAN;
  pref_email BOOLEAN;
  pref_push BOOLEAN;
  notif_id UUID := NULL;
  v_title TEXT;
  v_body TEXT;
  v_action_url TEXT;
BEGIN
  -- 1. Check user preferences or fallback to catalog defaults
  SELECT np.in_app, np.email, np.push
  INTO pref_in_app, pref_email, pref_push
  FROM notification_preferences np
  WHERE np.user_id = p_user_id AND np.event_type = p_type;

  IF NOT FOUND THEN
    SELECT def_in_app, def_email, def_push
    INTO pref_in_app, pref_email, pref_push
    FROM get_notification_defaults(p_type);
  END IF;

  -- 2. Extract display fields with fallbacks
  v_title := COALESCE(p_payload->>'title', 'New Notification');
  v_body := COALESCE(p_payload->>'body', '');
  v_action_url := p_payload->>'action_url';

  -- 3. In-App Delivery (Insert into notifications table if in_app preference enabled)
  IF COALESCE(pref_in_app, true) = true THEN
    INSERT INTO notifications (
      user_id,
      title,
      body,
      type,
      action_url,
      payload,
      read,
      created_at
    )
    VALUES (
      p_user_id,
      v_title,
      v_body,
      p_type,
      v_action_url,
      p_payload,
      false,
      now()
    )
    RETURNING id INTO notif_id;
  END IF;

  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. REALTIME EVENT TRIGGERS

-- A. Project Member Joined & Share Accepted Trigger
CREATE OR REPLACE FUNCTION on_share_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_project_title TEXT := 'Project';
  v_member_name TEXT := 'A member';
BEGIN
  -- When status changes to accepted
  IF (TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted')) THEN
    -- Try to get member display name
    IF NEW.shared_with_id IS NOT NULL THEN
      SELECT COALESCE(display_name, 'A member')
      INTO v_member_name
      FROM user_profiles
      WHERE id = NEW.shared_with_id;
    ELSIF NEW.shared_with_email IS NOT NULL THEN
      v_member_name := NEW.shared_with_email;
    END IF;

    -- If sharing a project, notify project owner (shared_by)
    IF NEW.item_type = 'project' THEN
      SELECT COALESCE(name, 'Project')
      INTO v_project_title
      FROM projects
      WHERE id = NEW.item_id;

      PERFORM notify(
        NEW.shared_by,
        'project.member_joined',
        jsonb_build_object(
          'title', 'New Project Member 👋',
          'body', v_member_name || ' joined "' || v_project_title || '".',
          'action_url', '/projects',
          'project_id', NEW.item_id,
          'member_id', NEW.shared_with_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_share_status_change ON shared_items;
CREATE TRIGGER trg_share_status_change
  AFTER UPDATE OF status ON shared_items
  FOR EACH ROW EXECUTE FUNCTION on_share_status_change();


-- B. Share Invitation Trigger (notify recipient if user exists)
CREATE OR REPLACE FUNCTION on_share_invited()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT := 'Someone';
BEGIN
  IF NEW.shared_with_id IS NOT NULL THEN
    SELECT COALESCE(display_name, 'Someone')
    INTO v_sender_name
    FROM user_profiles
    WHERE id = NEW.shared_by;

    PERFORM notify(
      NEW.shared_with_id,
      'share.invited',
      jsonb_build_object(
        'title', 'New Invite Received 📬',
        'body', v_sender_name || ' invited you to collaborate on a ' || NEW.item_type || '.',
        'action_url', '/projects',
        'item_type', NEW.item_type,
        'item_id', NEW.item_id,
        'shared_by', NEW.shared_by,
        'code', NEW.code
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_share_invited ON shared_items;
CREATE TRIGGER trg_share_invited
  AFTER INSERT ON shared_items
  FOR EACH ROW EXECUTE FUNCTION on_share_invited();


-- C. Update check_budget_limit() to emit C2 standard event finance.budget_warning
CREATE OR REPLACE FUNCTION check_budget_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_budget NUMERIC(10,2);
  current_spend NUMERIC(12,2);
  has_notified BOOLEAN;
  prefs JSONB;
  budget_enabled BOOLEAN;
BEGIN
  IF NEW.type <> 'expense' THEN
    RETURN NEW;
  END IF;

  SELECT daily_budget, notification_preferences 
  INTO user_budget, prefs
  FROM user_settings 
  WHERE user_id = NEW.user_id;

  budget_enabled := COALESCE((prefs->>'budget_alert')::BOOLEAN, true);
  IF NOT budget_enabled THEN
    RETURN NEW;
  END IF;

  IF user_budget IS NULL OR user_budget <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO current_spend
  FROM transactions
  WHERE user_id = NEW.user_id 
    AND date = NEW.date 
    AND type = 'expense';

  IF current_spend >= (user_budget * 0.8) THEN
    SELECT EXISTS (
      SELECT 1 FROM notifications 
      WHERE user_id = NEW.user_id 
        AND (type = 'finance.budget_warning' OR type = 'budget_alert')
        AND created_at::DATE = NEW.date
    ) INTO has_notified;

    IF NOT has_notified THEN
      PERFORM notify(
        NEW.user_id,
        'finance.budget_warning',
        jsonb_build_object(
          'title', 'Budget Warning ⚠️',
          'body', 'You have used ' || ROUND((current_spend / user_budget * 100)) || '% of your daily budget.',
          'action_url', '/finance',
          'current_spend', current_spend,
          'daily_budget', user_budget,
          'percent', ROUND((current_spend / user_budget * 100))
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-register the budget trigger so it points to the updated function.
-- (The original trigger was created in 20260607_fix_budget_warning.sql;
--  re-creating it here ensures a fresh-DB deployment always has it wired.)
DROP TRIGGER IF EXISTS trg_check_budget_limit ON transactions;
CREATE TRIGGER trg_check_budget_limit
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_budget_limit();
