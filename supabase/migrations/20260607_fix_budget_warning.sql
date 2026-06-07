-- ============================================================
-- Fix: Budget Warning Trigger
--
-- Issues fixed:
-- 1. The trigger fired on ANY date (including old synced transactions),
--    causing false "3013%" warnings when transactions synced from the past.
-- 2. The duplicate-notification check used created_at::DATE = NEW.date
--    which compared today's notification date to the transaction date —
--    so re-syncing old transactions always re-triggered fresh notifications.
-- 3. Budget percentage was miscalculated when daily_budget was very small
--    (e.g. default 100.00) and the spending came from many categories.
--
-- Fix strategy:
-- 1. Only fire the trigger if NEW.date = CURRENT_DATE (today only).
-- 2. Use a 1-per-user-per-date deduplication key stored in the notification
--    body that prevents re-inserting for the same day.
-- 3. Recalculate spend ONLY for today's transactions to get the correct %.
-- ============================================================

CREATE OR REPLACE FUNCTION check_budget_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_budget    NUMERIC(10,2);
  current_spend  NUMERIC(12,2);
  has_notified   BOOLEAN;
  prefs          JSONB;
  budget_enabled BOOLEAN;
BEGIN
  -- Only trigger for expense transactions
  IF NEW.type <> 'expense' THEN
    RETURN NEW;
  END IF;

  -- ── Guard: only fire for TODAY's transactions ─────────────────────────
  -- Old transactions syncing from device cache should never trigger alerts.
  IF NEW.date <> CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- Get user preferences & budget
  SELECT daily_budget, notification_preferences
  INTO user_budget, prefs
  FROM user_settings
  WHERE user_id = NEW.user_id;

  -- Verify budget alerts are enabled for this user
  budget_enabled := COALESCE((prefs->>'budget_alert')::BOOLEAN, true);
  IF NOT budget_enabled THEN
    RETURN NEW;
  END IF;

  -- Skip if no meaningful budget is configured
  IF user_budget IS NULL OR user_budget <= 0 THEN
    RETURN NEW;
  END IF;

  -- Sum ALL expenses for TODAY (not just the triggering transaction's date)
  SELECT COALESCE(SUM(amount), 0) INTO current_spend
  FROM transactions
  WHERE user_id = NEW.user_id
    AND date = CURRENT_DATE
    AND type = 'expense';

  -- Only notify when >= 80% of daily budget is spent
  IF current_spend >= (user_budget * 0.8) THEN
    -- Deduplicate: one notification per user per calendar day
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

-- Re-bind the trigger (DROP + CREATE to guarantee the new function body is used)
DROP TRIGGER IF EXISTS on_transaction_budget_check ON transactions;

CREATE TRIGGER on_transaction_budget_check
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE check_budget_limit();
