
-- =========================================================
-- PHASE A — Zazi MAM Prospector v3.1 (ADDITIVE ONLY)
-- =========================================================

-- 1) zazi_actions ------------------------------------------
CREATE TABLE IF NOT EXISTS public.zazi_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NULL,

  status text NOT NULL DEFAULT 'draft',
    -- draft | proposed | approved | rejected | snoozed | sent | blocked
  channel text NOT NULL DEFAULT 'whatsapp',

  -- Leadership Intelligence Layer (derived only; never writes contacts.lead_type)
  movement_stage text NOT NULL DEFAULT '',
  leadership_need text NOT NULL DEFAULT '',
  belief_risk smallint NOT NULL DEFAULT 0,
  recommended_tone text NOT NULL DEFAULT '',
  reason_for_message text NOT NULL DEFAULT '',
  next_best_business_action text NOT NULL DEFAULT '',
  expected_next_step text NOT NULL DEFAULT '',

  -- Single canonical draft + evidence fields
  proposed_message text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Supervisor 7-axis rubric
  supervisor_quality_score smallint NOT NULL DEFAULT 0,
  supervisor_safety smallint NOT NULL DEFAULT 0,
  supervisor_grounding smallint NOT NULL DEFAULT 0,
  supervisor_cultural_fit smallint NOT NULL DEFAULT 0,
  supervisor_clarity smallint NOT NULL DEFAULT 0,
  supervisor_relevance smallint NOT NULL DEFAULT 0,
  supervisor_tone_fit smallint NOT NULL DEFAULT 0,
  supervisor_leadership_fit smallint NOT NULL DEFAULT 0,
  supervisor_block_reason text NULL,

  -- Approval / send tracking
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  sent_at timestamptz NULL,
  maytapi_message_id text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT zazi_actions_status_chk CHECK (status IN
    ('draft','proposed','approved','rejected','snoozed','sent','blocked')),
  CONSTRAINT zazi_actions_belief_risk_chk CHECK (belief_risk BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_quality_chk CHECK (supervisor_quality_score BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_safety_chk CHECK (supervisor_safety BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_grounding_chk CHECK (supervisor_grounding BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_cultural_chk CHECK (supervisor_cultural_fit BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_clarity_chk CHECK (supervisor_clarity BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_relevance_chk CHECK (supervisor_relevance BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_tone_chk CHECK (supervisor_tone_fit BETWEEN 0 AND 100),
  CONSTRAINT zazi_actions_leadership_chk CHECK (supervisor_leadership_fit BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS zazi_actions_user_idx ON public.zazi_actions(user_id);
CREATE INDEX IF NOT EXISTS zazi_actions_contact_idx ON public.zazi_actions(contact_id);
CREATE INDEX IF NOT EXISTS zazi_actions_status_idx ON public.zazi_actions(user_id, status);
CREATE INDEX IF NOT EXISTS zazi_actions_created_idx ON public.zazi_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS zazi_actions_evidence_gin ON public.zazi_actions USING GIN(evidence);

ALTER TABLE public.zazi_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own zazi_actions"
  ON public.zazi_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own zazi_actions"
  ON public.zazi_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zazi_actions"
  ON public.zazi_actions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zazi_actions"
  ON public.zazi_actions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER zazi_actions_set_updated_at
  BEFORE UPDATE ON public.zazi_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) integration_settings ----------------------------------
CREATE TABLE IF NOT EXISTS public.integration_settings (
  user_id uuid PRIMARY KEY,

  zazi_prospector_enabled boolean NOT NULL DEFAULT false,
  prospector_can_propose boolean NOT NULL DEFAULT false,
  prospector_supervisor_required boolean NOT NULL DEFAULT true,
  prospector_can_auto_apply_low boolean NOT NULL DEFAULT false,
  prospector_can_send_autonomous boolean NOT NULL DEFAULT false,

  maytapi_enabled boolean NOT NULL DEFAULT false,
  maytapi_phone_allowlist text[] NOT NULL DEFAULT '{}'::text[],

  daily_send_cap integer NOT NULL DEFAULT 100,
  daily_token_cap integer NOT NULL DEFAULT 200000,

  supervisor_block_threshold smallint NOT NULL DEFAULT 60,
  supervisor_safety_threshold smallint NOT NULL DEFAULT 70,
  supervisor_leadership_fit_threshold smallint NOT NULL DEFAULT 60,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT integration_settings_block_chk
    CHECK (supervisor_block_threshold BETWEEN 0 AND 100),
  CONSTRAINT integration_settings_safety_chk
    CHECK (supervisor_safety_threshold BETWEEN 0 AND 100),
  CONSTRAINT integration_settings_leadership_chk
    CHECK (supervisor_leadership_fit_threshold BETWEEN 0 AND 100)
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integration_settings"
  ON public.integration_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integration_settings"
  ON public.integration_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integration_settings"
  ON public.integration_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integration_settings"
  ON public.integration_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER integration_settings_set_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) user_knowledge_docs.tags ------------------------------
ALTER TABLE public.user_knowledge_docs
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS user_knowledge_docs_tags_gin
  ON public.user_knowledge_docs USING GIN(tags);


-- 4) Auto-provision integration_settings for new users -----
-- Additive: separate function + trigger; does NOT touch handle_new_user.
CREATE OR REPLACE FUNCTION public.ensure_integration_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.integration_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_integration_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_integration_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_integration_settings();


-- 5) Backfill safe default rows for existing users ---------
INSERT INTO public.integration_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
