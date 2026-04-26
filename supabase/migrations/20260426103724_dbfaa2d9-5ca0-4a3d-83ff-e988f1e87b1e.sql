ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS prospector_write_activity_on_send boolean NOT NULL DEFAULT false;