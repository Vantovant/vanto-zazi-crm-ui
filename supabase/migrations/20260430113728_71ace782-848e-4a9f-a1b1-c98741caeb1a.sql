-- Import audit log: one row per spreadsheet row processed
CREATE TABLE public.import_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  file_name text NOT NULL DEFAULT '',
  sheet_row integer NOT NULL,
  incoming_full_name text NOT NULL DEFAULT '',
  incoming_aplgo_id text NOT NULL DEFAULT '',
  incoming_phone text NOT NULL DEFAULT '',
  incoming_email text NOT NULL DEFAULT '',
  match_method text NOT NULL DEFAULT 'none', -- aplgo_id | phone | email | none
  action text NOT NULL DEFAULT 'skip',        -- create | update | skip | fail
  matched_contact_id uuid,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own import audit"
  ON public.import_audit FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own import audit"
  ON public.import_audit FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_import_audit_batch ON public.import_audit(user_id, batch_id, sheet_row);
CREATE INDEX idx_import_audit_aplgo ON public.import_audit(user_id, incoming_aplgo_id) WHERE incoming_aplgo_id <> '';