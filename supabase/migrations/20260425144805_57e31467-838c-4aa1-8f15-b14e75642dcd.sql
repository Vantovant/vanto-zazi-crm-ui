-- Phase B.1: nullable supervisor scores + drop 0 defaults
ALTER TABLE public.zazi_actions
  ALTER COLUMN supervisor_quality_score DROP NOT NULL,
  ALTER COLUMN supervisor_safety DROP NOT NULL,
  ALTER COLUMN supervisor_grounding DROP NOT NULL,
  ALTER COLUMN supervisor_cultural_fit DROP NOT NULL,
  ALTER COLUMN supervisor_clarity DROP NOT NULL,
  ALTER COLUMN supervisor_relevance DROP NOT NULL,
  ALTER COLUMN supervisor_tone_fit DROP NOT NULL,
  ALTER COLUMN supervisor_leadership_fit DROP NOT NULL,
  ALTER COLUMN supervisor_quality_score DROP DEFAULT,
  ALTER COLUMN supervisor_safety DROP DEFAULT,
  ALTER COLUMN supervisor_grounding DROP DEFAULT,
  ALTER COLUMN supervisor_cultural_fit DROP DEFAULT,
  ALTER COLUMN supervisor_clarity DROP DEFAULT,
  ALTER COLUMN supervisor_relevance DROP DEFAULT,
  ALTER COLUMN supervisor_tone_fit DROP DEFAULT,
  ALTER COLUMN supervisor_leadership_fit DROP DEFAULT;

-- Backfill existing Phase B drafts: set supervisor fields to NULL
UPDATE public.zazi_actions
SET supervisor_quality_score = NULL,
    supervisor_safety = NULL,
    supervisor_grounding = NULL,
    supervisor_cultural_fit = NULL,
    supervisor_clarity = NULL,
    supervisor_relevance = NULL,
    supervisor_tone_fit = NULL,
    supervisor_leadership_fit = NULL,
    supervisor_block_reason = NULL
WHERE status = 'draft';