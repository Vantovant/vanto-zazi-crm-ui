-- Clean existing aplgo_id values: strip everything except digits
UPDATE public.contacts
   SET aplgo_id = regexp_replace(aplgo_id, '[^0-9]', '', 'g')
 WHERE aplgo_id ~ '[^0-9]'
   AND aplgo_id <> '';

-- Append audit note for the specifically requested record
UPDATE public.contacts
   SET additional_notes = CASE
         WHEN additional_notes IS NULL OR additional_notes = ''
           THEN 'Added manually from Level 4 spreadsheet to match Monthly Activity Paste. Source ID appeared as 1823834 new!'
         ELSE additional_notes || E'\n\n--- ' || to_char(now(), 'YYYY-MM-DD') || ' ---\nAPLGO ID cleaned from "1823834 new!" to "1823834". Source: Level 4 spreadsheet.'
       END
 WHERE id = 'abe1674a-d018-4a1f-a60f-1b2e240df5e0';

-- Trigger: auto-sanitize aplgo_id on insert/update so future imports cannot store "1823834 new!" etc.
CREATE OR REPLACE FUNCTION public.sanitize_contact_aplgo_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.aplgo_id IS NOT NULL AND NEW.aplgo_id <> '' THEN
    NEW.aplgo_id := regexp_replace(NEW.aplgo_id, '[^0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_contact_aplgo_id ON public.contacts;
CREATE TRIGGER trg_sanitize_contact_aplgo_id
BEFORE INSERT OR UPDATE OF aplgo_id ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_contact_aplgo_id();