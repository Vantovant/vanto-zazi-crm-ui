
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS auto_send_micro_live_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_send_micro_live_daily_cap integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS auto_send_micro_live_contact_allowlist uuid[] NOT NULL DEFAULT '{}'::uuid[];
