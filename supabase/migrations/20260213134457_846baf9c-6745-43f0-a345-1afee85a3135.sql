
-- AI Action Log table for tracking recommendations and outcomes
CREATE TABLE public.ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  recommended_action text NOT NULL DEFAULT '',
  executed_action text NOT NULL DEFAULT '',
  manual_mark_success boolean DEFAULT false,
  auto_detected_success boolean DEFAULT false,
  final_success boolean DEFAULT false,
  success_score integer DEFAULT 0,
  success_source text DEFAULT '',
  pattern_source text DEFAULT 'personal',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai_action_log"
ON public.ai_action_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ai_action_log"
ON public.ai_action_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai_action_log"
ON public.ai_action_log FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai_action_log"
ON public.ai_action_log FOR DELETE
USING (auth.uid() = user_id);

-- Team patterns table (anonymized, no PII)
CREATE TABLE public.ai_team_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  lifecycle_stage text NOT NULL,
  success_rate numeric DEFAULT 0,
  timing_pattern text DEFAULT '',
  sample_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_team_patterns ENABLE ROW LEVEL SECURITY;

-- Team patterns are readable by all authenticated users (anonymized data)
CREATE POLICY "Authenticated users can read team patterns"
ON public.ai_team_patterns FOR SELECT
TO authenticated
USING (true);

-- Only system can write (via service role in edge functions)
-- No INSERT/UPDATE/DELETE policies for regular users
