
-- 1) Dedupe existing queued recipients: keep oldest row per (phone_normalized, cycle_year)
DELETE FROM public.birthday_campaign_recipients a
USING public.birthday_campaign_recipients b
WHERE a.phone_normalized = b.phone_normalized
  AND a.cycle_year = b.cycle_year
  AND a.ctid > b.ctid;

-- 2) Enforce uniqueness going forward
CREATE UNIQUE INDEX IF NOT EXISTS birthday_campaign_recipients_phone_year_uniq
  ON public.birthday_campaign_recipients (phone_normalized, cycle_year);

-- 3) Flip the Birthday Campaign kill-switch ON
UPDATE public.campaign_settings SET enabled = true WHERE campaign_key = 'birthday';

-- 4) Schedule the Birthday Campaign tick every 15 minutes
SELECT cron.unschedule('birthday-campaign-tick-15m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'birthday-campaign-tick-15m');

SELECT cron.schedule(
  'birthday-campaign-tick-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://urfyfuakgabieellbuce.supabase.co/functions/v1/birthday-campaign-tick',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZnlmdWFrZ2FiaWVlbGxidWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDE2NjcsImV4cCI6MjA4NjIxNzY2N30.4JaSzSQUsz0__rAqTLFc5W3sJUkayahwAHHLf0zUDAk"}'::jsonb,
    body:=jsonb_build_object('triggered_at', now())
  );
  $$
);
