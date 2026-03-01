
-- Temporarily drop the enum validation trigger
DROP TRIGGER IF EXISTS validate_contact_enums_trigger ON public.contacts;

-- Fix corrupted lead_temperature values
UPDATE public.contacts SET lead_temperature = 'Hot' WHERE lead_temperature NOT IN ('Hot', 'Warm', 'Cold', '');

-- 1) Add normalized columns
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT;

-- 2) Create normalization functions
CREATE OR REPLACE FUNCTION public.normalize_phone(raw TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN regexp_replace(raw, '[^0-9]', '', 'g') = '' THEN NULL
    ELSE regexp_replace(raw, '[^0-9]', '', 'g')
  END
$$;

CREATE OR REPLACE FUNCTION public.normalize_email(raw TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN btrim(lower(raw)) = '' THEN NULL
    ELSE btrim(lower(raw))
  END
$$;

-- 3) Auto-normalize trigger function
CREATE OR REPLACE FUNCTION public.auto_normalize_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_normalized := public.normalize_phone(NEW.phone_number);
  NEW.email_normalized := public.normalize_email(NEW.email_address);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_contact ON public.contacts;
CREATE TRIGGER trg_normalize_contact
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_normalize_contact();

-- 4) Backfill existing rows (trigger will handle normalization)
UPDATE public.contacts
SET phone_normalized = public.normalize_phone(phone_number),
    email_normalized = public.normalize_email(email_address);

-- 5) Re-create the enum validation trigger
CREATE TRIGGER validate_contact_enums_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contact_enums();

-- 6) Create merge_log table
CREATE TABLE IF NOT EXISTS public.merge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  primary_id UUID NOT NULL,
  merged_ids UUID[] NOT NULL DEFAULT '{}',
  key_type TEXT NOT NULL DEFAULT '',
  key_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own merge logs"
  ON public.merge_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own merge logs"
  ON public.merge_log FOR SELECT
  USING (auth.uid() = user_id);
