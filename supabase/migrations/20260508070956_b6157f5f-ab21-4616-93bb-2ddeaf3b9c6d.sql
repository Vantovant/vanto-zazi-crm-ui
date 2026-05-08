
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS auto_send_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_send_birthdays_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_send_appreciation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_send_daily_cap integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS auto_send_quiet_start_hour smallint NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS auto_send_quiet_end_hour smallint NOT NULL DEFAULT 19;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS auto_send_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.auto_send_shadow_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lane text NOT NULL,                  -- 'birthday' | 'appreciation'
  contact_id uuid,
  contact_name text NOT NULL DEFAULT '',
  entry_key text NOT NULL DEFAULT '',  -- appreciation entry key, '' for birthday
  cycle_key text NOT NULL DEFAULT '',  -- 'YYYY' for birthday, 'YYYY-MM' for appreciation
  dedupe_key text NOT NULL,            -- auto:{lane}:{contact_or_entry_id}:{cycle_key}
  would_send_at timestamptz NOT NULL DEFAULT now(),
  eligibility text NOT NULL,           -- 'eligible' | 'blocked'
  block_reason text NOT NULL DEFAULT '',
  gates jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_style text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auto_send_shadow_log_dedupe_uniq
  ON public.auto_send_shadow_log (user_id, lane, dedupe_key);

CREATE INDEX IF NOT EXISTS auto_send_shadow_log_user_created_idx
  ON public.auto_send_shadow_log (user_id, created_at DESC);

ALTER TABLE public.auto_send_shadow_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shadow log" ON public.auto_send_shadow_log;
CREATE POLICY "Users can view their own shadow log"
  ON public.auto_send_shadow_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies → only service role (edge function) writes.
