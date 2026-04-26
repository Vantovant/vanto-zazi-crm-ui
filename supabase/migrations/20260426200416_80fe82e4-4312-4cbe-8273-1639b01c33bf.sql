-- I1: Binary tree schema foundation
-- Adds parent_contact_id + tree_depth, normalizes leg to L/R/'', adds validation trigger + indexes.
-- Does NOT touch lead_type, Maytapi/H-phase tables, or any send path.

-- 1. Add columns if missing
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS parent_contact_id uuid NULL,
  ADD COLUMN IF NOT EXISTS tree_depth smallint NULL DEFAULT 0;

-- 2. Normalize existing leg values (deterministic mapping, no ambiguous rows)
UPDATE public.contacts
SET leg = CASE
  WHEN lower(btrim(leg)) IN ('1','1 leg','left','l') THEN 'L'
  WHEN lower(btrim(leg)) IN ('2','2 leg','right','r') THEN 'R'
  WHEN leg IS NULL OR btrim(leg) = '' THEN ''
  ELSE leg
END
WHERE leg IS NULL OR leg NOT IN ('L','R','');

-- 3. Validation trigger (matches project pattern of enum-validation triggers)
CREATE OR REPLACE FUNCTION public.validate_contact_tree()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- leg enum
  IF NEW.leg IS NULL OR NEW.leg NOT IN ('L','R','') THEN
    RAISE EXCEPTION 'Invalid leg: % (allowed: L, R, empty)', NEW.leg;
  END IF;

  -- tree_depth bounds
  IF NEW.tree_depth IS NOT NULL AND (NEW.tree_depth < 0 OR NEW.tree_depth > 13) THEN
    RAISE EXCEPTION 'Invalid tree_depth: % (allowed: 0-13)', NEW.tree_depth;
  END IF;

  -- self-parent guard
  IF NEW.parent_contact_id IS NOT NULL AND NEW.parent_contact_id = NEW.id THEN
    RAISE EXCEPTION 'A contact cannot be its own parent';
  END IF;

  -- if no parent, depth must be 0
  IF NEW.parent_contact_id IS NULL THEN
    NEW.tree_depth := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_contact_tree_trigger ON public.contacts;
CREATE TRIGGER validate_contact_tree_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.validate_contact_tree();

-- 4. Safe indexes
CREATE INDEX IF NOT EXISTS idx_contacts_parent ON public.contacts(parent_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_parent ON public.contacts(user_id, parent_contact_id);