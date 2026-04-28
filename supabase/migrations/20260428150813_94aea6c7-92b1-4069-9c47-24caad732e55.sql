UPDATE public.contact_activities
SET 
  summary = summary || ' [monthly_activity_appreciation:2026-04] [monthly_activity_appreciation_entry:oid:baebc3f9-7a8d-4dc2-99b8-7cba70f119e6]',
  notes = notes || E'\n\n[monthly_activity_appreciation:2026-04] [monthly_activity_appreciation_entry:oid:baebc3f9-7a8d-4dc2-99b8-7cba70f119e6]'
WHERE id = 'b8a8bad5-7152-49a0-b658-0a9f880a0b6a'
  AND summary NOT LIKE '%monthly_activity_appreciation_entry%';

-- Also backfill the older April 10 R630 entry log (8ce035de) with its entry marker,
-- since the original log clearly references that send (R630) and was written before MP0.
UPDATE public.contact_activities
SET 
  summary = summary || ' [monthly_activity_appreciation:2026-04] [monthly_activity_appreciation_entry:oid:848a35dc-626b-4f15-a9d9-1070eb41c63f]',
  notes = notes || E'\n\n[monthly_activity_appreciation:2026-04] [monthly_activity_appreciation_entry:oid:848a35dc-626b-4f15-a9d9-1070eb41c63f]'
WHERE id = '8ce035de-425d-41ed-b393-52ce62401f81'
  AND summary NOT LIKE '%monthly_activity_appreciation_entry%';