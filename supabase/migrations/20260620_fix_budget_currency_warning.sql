-- ============================================================
-- Fix: Budget Warning Trigger False Positives (Currency Mismatch)
--
-- Issue:
-- When transactions are logged in secondary currencies (e.g. XOF, EUR),
-- their raw amount (e.g. 6000 XOF) was directly added to current_spend
-- and compared to the user's primary currency budget (e.g. 100 USD),
-- causing false "1000%+ exceeded" alerts.
--
-- Fix:
-- Only sum expenses for today whose wallet currency matches the
-- user's primary settings currency.
-- ============================================================

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
  -- Only trigger for expense transactions
  IF NEW.type <> 'expense' THEN
    RETURN NEW;
  END IF;

  -- Guard: only fire for TODAY's transactions
  IF NEW.date <> CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- Get user preferences & budget
  SELECT daily_budget, currency, notification_preferences
  INTO user_budget, user_currency, prefs
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

  -- Sum ALL expenses for TODAY in the user's primary currency
  SELECT COALESCE(SUM(t.amount), 0) INTO current_spend
  FROM transactions t
  LEFT JOIN wallets w ON t.wallet_id = w.id
  WHERE t.user_id = NEW.user_id
    AND t.date = CURRENT_DATE
    AND t.type = 'expense'
    AND COALESCE(w.currency, user_currency) = user_currency;

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
