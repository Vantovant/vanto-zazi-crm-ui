ALTER TABLE public.contact_birthdays
ADD COLUMN IF NOT EXISTS pasted_phone TEXT NOT NULL DEFAULT '';