ALTER TABLE public.contact_activities ADD COLUMN kairos_ref text;
CREATE UNIQUE INDEX contact_activities_kairos_ref_uniq
  ON public.contact_activities (user_id, contact_id, kairos_ref)
  WHERE kairos_ref IS NOT NULL;