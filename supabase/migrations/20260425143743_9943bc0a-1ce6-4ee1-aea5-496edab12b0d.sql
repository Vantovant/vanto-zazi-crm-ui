-- Phase A.1: additive indexes + updated_at triggers (no schema/data changes beyond perf+hygiene)

CREATE INDEX IF NOT EXISTS zazi_actions_user_status_created_idx
  ON public.zazi_actions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS zazi_actions_user_contact_status_idx
  ON public.zazi_actions (user_id, contact_id, status);

CREATE INDEX IF NOT EXISTS zazi_actions_user_movement_stage_idx
  ON public.zazi_actions (user_id, movement_stage);

CREATE INDEX IF NOT EXISTS zazi_actions_user_leadership_need_idx
  ON public.zazi_actions (user_id, leadership_need);

CREATE INDEX IF NOT EXISTS zazi_actions_user_quality_idx
  ON public.zazi_actions (user_id, supervisor_quality_score);

-- updated_at triggers (function public.update_updated_at_column already exists; do NOT modify it)
DROP TRIGGER IF EXISTS update_zazi_actions_updated_at ON public.zazi_actions;
CREATE TRIGGER update_zazi_actions_updated_at
  BEFORE UPDATE ON public.zazi_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();