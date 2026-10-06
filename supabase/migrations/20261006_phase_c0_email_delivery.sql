-- ============================================================================
-- Phase C0: Email Delivery via notify() dispatcher
-- Extends the notify() function to call the send-email Edge Function
-- via pg_net whenever a user's email preference is enabled.
--
-- Prerequisites:
--   • pg_net extension must be enabled (Supabase → Database → Extensions)
--   • send-email Edge Function must be deployed
--   • SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as DB secrets
--     (or hardcoded here as env-style constants — see step 1 below)
-- ============================================================================


-- 1. Store the Edge Function URL and service role key as DB-level secrets
--    using Supabase Vault (available in all Supabase projects).
--    Run this ONCE manually, filling in your real values:
--
--    SELECT vault.create_secret('https://<your-project-ref>.supabase.co/functions/v1/send-email', 'email_function_url');
--    SELECT vault.create_secret('<your-service-role-key>', 'email_service_key');
--
--    After running the above, the secrets are referenced by name below.


-- 2. Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Optional internal config table (fallback if Supabase Vault is not enabled)
CREATE TABLE IF NOT EXISTS internal_app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE internal_app_config ENABLE ROW LEVEL SECURITY;
-- With RLS enabled and no public policies, only superuser/service_role and SECURITY DEFINER functions can access this.



-- 3. Helper: look up a user's email address from auth.users
CREATE OR REPLACE FUNCTION get_user_email(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT email::TEXT FROM auth.users WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 4. Helper: dispatch an email via the send-email Edge Function using pg_net
--    Called inside notify() when pref_email = true.
CREATE OR REPLACE FUNCTION dispatch_email(
  p_user_id   UUID,
  p_type      TEXT,
  p_payload   JSONB
)
RETURNS VOID AS $$
DECLARE
  v_email      TEXT;
  v_func_url   TEXT;
  v_svc_key    TEXT;
  v_variables  JSONB;
BEGIN
  -- Retrieve recipient email
  v_email := get_user_email(p_user_id);
  IF v_email IS NULL OR v_email = '' THEN
    RETURN; -- No email address on file; skip silently
  END IF;

  -- Retrieve secrets from Vault (if available) or internal_app_config fallback
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
  ) THEN
    BEGIN
      EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
        INTO v_func_url USING 'email_function_url';
      EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
        INTO v_svc_key USING 'email_service_key';
    EXCEPTION WHEN OTHERS THEN
      v_func_url := NULL;
      v_svc_key := NULL;
    END;
  END IF;

  -- Fallback to internal_app_config table if not found in Vault
  IF v_func_url IS NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'internal_app_config'
  ) THEN
    SELECT value INTO v_func_url FROM internal_app_config WHERE key = 'email_function_url' LIMIT 1;
  END IF;

  IF v_svc_key IS NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'internal_app_config'
  ) THEN
    SELECT value INTO v_svc_key FROM internal_app_config WHERE key = 'email_service_key' LIMIT 1;
  END IF;

  IF v_func_url IS NULL OR v_svc_key IS NULL THEN
    RAISE WARNING '[dispatch_email] Secrets not configured (email_function_url / email_service_key). Skipping.';
    RETURN;
  END IF;

  -- Build the variables object from the payload.
  -- The payload already contains title, body, action_url plus event-specific keys.
  v_variables := p_payload;

  -- Fire-and-forget HTTP POST to the send-email Edge Function
  PERFORM net.http_post(
    url     := v_func_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_svc_key
    ),
    body    := jsonb_build_object(
      'to',         v_email,
      'event_type', p_type,
      'variables',  v_variables
    )
  );

EXCEPTION WHEN OTHERS THEN
  -- Never let an email failure crash the in-app notification path
  RAISE WARNING '[dispatch_email] pg_net call failed for user % type %: %', p_user_id, p_type, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Replace notify() to also call dispatch_email when pref_email is true
CREATE OR REPLACE FUNCTION notify(
  p_user_id UUID,
  p_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  pref_in_app BOOLEAN;
  pref_email  BOOLEAN;
  pref_push   BOOLEAN;
  notif_id    UUID := NULL;
  v_title     TEXT;
  v_body      TEXT;
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
  v_title      := COALESCE(p_payload->>'title', 'New Notification');
  v_body       := COALESCE(p_payload->>'body', '');
  v_action_url := p_payload->>'action_url';

  -- 3. In-App Delivery
  IF COALESCE(pref_in_app, true) = true THEN
    INSERT INTO notifications (
      user_id, title, body, type, action_url, payload, read, created_at
    )
    VALUES (
      p_user_id, v_title, v_body, p_type, v_action_url, p_payload, false, now()
    )
    RETURNING id INTO notif_id;
  END IF;

  -- 4. Email Delivery (fire-and-forget via pg_net; never blocks or fails the insert)
  IF COALESCE(pref_email, false) = true THEN
    PERFORM dispatch_email(p_user_id, p_type, p_payload);
  END IF;

  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
