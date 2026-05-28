CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: Replace YOUR_SUPABASE_PROJECT and YOUR_ANON_KEY with actual values

-- Schedule morning push (8 AM GMT)
SELECT cron.schedule(
  'morning-push',
  '0 8 * * *',
  $$
    SELECT net.http_post(
        url:='https://YOUR_SUPABASE_PROJECT.functions.supabase.co/send-push',
        headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"type":"morning"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule night push (8 PM GMT)
SELECT cron.schedule(
  'night-push',
  '0 20 * * *',
  $$
    SELECT net.http_post(
        url:='https://YOUR_SUPABASE_PROJECT.functions.supabase.co/send-push',
        headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"type":"night"}'::jsonb
    ) as request_id;
  $$
);
