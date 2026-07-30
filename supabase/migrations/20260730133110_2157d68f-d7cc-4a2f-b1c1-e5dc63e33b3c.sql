WITH ranked AS (
  SELECT id, user_id,
    COALESCE(NULLIF(associate_id,''), lower(full_name)) AS gkey,
    cycle_year, pasted_phone, contact_id, status, congratulated_at, birth_date, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, COALESCE(NULLIF(associate_id,''), lower(full_name)), cycle_year
      ORDER BY (status = 'congratulated') DESC,
               (COALESCE(pasted_phone,'') <> '') DESC,
               (contact_id IS NOT NULL) DESC,
               (birth_date IS NOT NULL) DESC,
               created_at ASC
    ) AS rn
  FROM public.contact_birthdays
),
keepers AS (SELECT * FROM ranked WHERE rn = 1),
losers AS (SELECT * FROM ranked WHERE rn > 1),
merged AS (
  SELECT k.id,
    COALESCE(NULLIF(k.pasted_phone,''), (array_agg(NULLIF(l.pasted_phone,'')) FILTER (WHERE l.pasted_phone <> ''))[1]) AS pasted_phone,
    COALESCE(k.contact_id, (array_agg(l.contact_id) FILTER (WHERE l.contact_id IS NOT NULL))[1]) AS contact_id,
    COALESCE(k.birth_date, (array_agg(l.birth_date) FILTER (WHERE l.birth_date IS NOT NULL))[1]) AS birth_date,
    COALESCE(k.congratulated_at, max(l.congratulated_at)) AS congratulated_at,
    CASE WHEN k.status = 'congratulated' OR bool_or(l.status = 'congratulated') THEN 'congratulated' ELSE k.status END AS status
  FROM keepers k
  JOIN losers l ON l.user_id = k.user_id AND l.gkey = k.gkey AND l.cycle_year = k.cycle_year
  GROUP BY k.id, k.pasted_phone, k.contact_id, k.birth_date, k.congratulated_at, k.status
)
UPDATE public.contact_birthdays cb
SET pasted_phone = COALESCE(m.pasted_phone, cb.pasted_phone),
    contact_id = m.contact_id,
    birth_date = m.birth_date,
    congratulated_at = m.congratulated_at,
    status = m.status,
    updated_at = now()
FROM merged m WHERE cb.id = m.id;

WITH ranked2 AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, COALESCE(NULLIF(associate_id,''), lower(full_name)), cycle_year
      ORDER BY (status = 'congratulated') DESC,
               (COALESCE(pasted_phone,'') <> '') DESC,
               (contact_id IS NOT NULL) DESC,
               (birth_date IS NOT NULL) DESC,
               created_at ASC
    ) AS rn
  FROM public.contact_birthdays
)
DELETE FROM public.contact_birthdays WHERE id IN (SELECT id FROM ranked2 WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS contact_birthdays_unique_associate_cycle
  ON public.contact_birthdays (user_id, associate_id, cycle_year)
  WHERE associate_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS contact_birthdays_unique_name_cycle
  ON public.contact_birthdays (user_id, lower(full_name), cycle_year)
  WHERE associate_id = '';