CREATE TABLE IF NOT EXISTS public.import_staging_expired_20260529 (
  aplgo_id text,
  full_name text,
  level text,
  leg text,
  go_status text,
  phone_normalized text,
  country text
);

GRANT SELECT, INSERT, DELETE ON public.import_staging_expired_20260529 TO authenticated;
GRANT ALL ON public.import_staging_expired_20260529 TO service_role;

ALTER TABLE public.import_staging_expired_20260529 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stg_expired_all_auth" ON public.import_staging_expired_20260529
  FOR ALL TO authenticated USING (true) WITH CHECK (true);