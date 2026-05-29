
DO $$
DECLARE
  v_owner uuid := 'b8028d7d-6a08-45ef-a369-b438c440bea3';
  v_tag text := '[EXPIRED 2026-05-29]';
BEGIN
  -- Normalize staging
  UPDATE public.import_staging_expired_20260529
  SET phone_normalized = NULLIF(regexp_replace(COALESCE(phone_normalized,''), '[^0-9]', '', 'g'), ''),
      aplgo_id = NULLIF(regexp_replace(COALESCE(aplgo_id,''), '[^0-9]', '', 'g'), '');

  -- Stage 1: match by aplgo_id
  UPDATE public.contacts c
  SET full_name = CASE WHEN COALESCE(c.full_name,'') = '' THEN COALESCE(s.full_name, c.full_name) ELSE c.full_name END,
      level = CASE WHEN COALESCE(c.level,'') = '' THEN COALESCE(s.level,'') ELSE c.level END,
      leg = CASE WHEN COALESCE(c.leg,'') = '' AND s.leg IN ('L','R') THEN s.leg ELSE c.leg END,
      country = CASE WHEN COALESCE(c.country,'') = '' THEN COALESCE(s.country, c.country) ELSE c.country END,
      lead_type = 'Expired',
      additional_notes = CASE
        WHEN c.additional_notes ILIKE '%' || v_tag || '%' THEN c.additional_notes
        WHEN COALESCE(c.additional_notes,'') = '' THEN v_tag
        ELSE c.additional_notes || E'\n' || v_tag
      END
  FROM public.import_staging_expired_20260529 s
  WHERE c.user_id = v_owner
    AND c.aplgo_id IS NOT NULL AND c.aplgo_id <> ''
    AND s.aplgo_id IS NOT NULL
    AND c.aplgo_id = s.aplgo_id;

  -- Stage 2: match remaining by phone (only where existing contact has no aplgo_id)
  UPDATE public.contacts c
  SET aplgo_id = s.aplgo_id,
      full_name = CASE WHEN COALESCE(c.full_name,'') = '' THEN COALESCE(s.full_name, c.full_name) ELSE c.full_name END,
      level = CASE WHEN COALESCE(c.level,'') = '' THEN COALESCE(s.level,'') ELSE c.level END,
      leg = CASE WHEN COALESCE(c.leg,'') = '' AND s.leg IN ('L','R') THEN s.leg ELSE c.leg END,
      country = CASE WHEN COALESCE(c.country,'') = '' THEN COALESCE(s.country, c.country) ELSE c.country END,
      lead_type = 'Expired',
      additional_notes = CASE
        WHEN c.additional_notes ILIKE '%' || v_tag || '%' THEN c.additional_notes
        WHEN COALESCE(c.additional_notes,'') = '' THEN v_tag
        ELSE c.additional_notes || E'\n' || v_tag
      END
  FROM public.import_staging_expired_20260529 s
  WHERE c.user_id = v_owner
    AND (c.aplgo_id IS NULL OR c.aplgo_id = '')
    AND s.phone_normalized IS NOT NULL
    AND regexp_replace(COALESCE(c.phone_normalized,''), '[^0-9]', '', 'g') = s.phone_normalized
    AND s.aplgo_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.contacts c2
      WHERE c2.user_id = v_owner AND c2.aplgo_id = s.aplgo_id
    );

  -- Stage 3: insert net-new (no aplgo_id match, no phone collision)
  INSERT INTO public.contacts (
    user_id, full_name, phone_number, country, leg, level,
    aplgo_id, lead_type, additional_notes
  )
  SELECT
    v_owner,
    COALESCE(s.full_name, ''),
    COALESCE('+' || s.phone_normalized, ''),
    COALESCE(s.country, 'South Africa'),
    CASE WHEN s.leg IN ('L','R') THEN s.leg ELSE '' END,
    COALESCE(s.level, ''),
    s.aplgo_id,
    'Expired',
    v_tag
  FROM public.import_staging_expired_20260529 s
  WHERE s.aplgo_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.user_id = v_owner AND c.aplgo_id = s.aplgo_id
    )
    AND (
      s.phone_normalized IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.contacts c2
        WHERE c2.user_id = v_owner
          AND regexp_replace(COALESCE(c2.phone_normalized,''), '[^0-9]', '', 'g') = s.phone_normalized
      )
    );

  -- Insert rows that DID have phone collision but no aplgo_id match (Stage 2 didn't link)
  -- with blank phone, so they still get created and surface via Phone Rescue.
  INSERT INTO public.contacts (
    user_id, full_name, phone_number, country, leg, level,
    aplgo_id, lead_type, additional_notes
  )
  SELECT
    v_owner,
    COALESCE(s.full_name, ''),
    '',
    COALESCE(s.country, 'South Africa'),
    CASE WHEN s.leg IN ('L','R') THEN s.leg ELSE '' END,
    COALESCE(s.level, ''),
    s.aplgo_id,
    'Expired',
    v_tag || E'\n[PHONE COLLISION ON IMPORT — review]'
  FROM public.import_staging_expired_20260529 s
  WHERE s.aplgo_id IS NOT NULL
    AND s.phone_normalized IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.contacts c WHERE c.user_id = v_owner AND c.aplgo_id = s.aplgo_id
    )
    AND EXISTS (
      SELECT 1 FROM public.contacts c2
      WHERE c2.user_id = v_owner
        AND regexp_replace(COALESCE(c2.phone_normalized,''), '[^0-9]', '', 'g') = s.phone_normalized
    );
END $$;

DROP TABLE IF EXISTS public.import_staging_expired_20260529;
