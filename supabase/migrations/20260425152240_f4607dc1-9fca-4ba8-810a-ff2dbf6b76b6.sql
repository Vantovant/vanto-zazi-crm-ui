ALTER TABLE public.zazi_actions
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS snooze_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_zazi_actions_snoozed_until
  ON public.zazi_actions (user_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;