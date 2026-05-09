
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.phone_rescue_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shadow_log_id uuid,
  contact_id uuid,
  lane text NOT NULL DEFAULT '',
  entry_key text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  old_phone text NOT NULL DEFAULT '',
  recovered_phone text NOT NULL DEFAULT '',
  recovered_full_name text NOT NULL DEFAULT '',
  recovered_aplgo_id text NOT NULL DEFAULT '',
  source_table text NOT NULL DEFAULT '',
  match_method text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'needs_review',
  audit jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE INDEX idx_prc_user_status ON public.phone_rescue_candidates(user_id, status);
CREATE INDEX idx_prc_shadow ON public.phone_rescue_candidates(shadow_log_id);
CREATE INDEX idx_prc_contact ON public.phone_rescue_candidates(contact_id);
CREATE INDEX idx_contacts_full_name_trgm ON public.contacts USING gin (lower(full_name) gin_trgm_ops);

ALTER TABLE public.phone_rescue_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rescue candidates"
  ON public.phone_rescue_candidates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own rescue candidates"
  ON public.phone_rescue_candidates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
