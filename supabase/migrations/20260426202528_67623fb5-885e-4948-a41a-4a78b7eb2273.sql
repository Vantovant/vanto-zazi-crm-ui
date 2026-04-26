-- I2A: Cycle protection + depth auto-calc (no data writes, schema/trigger only)
-- Replaces validate_contact_tree() with recursive cycle guard, depth bounds enforcement,
-- and parent-derived depth auto-calculation. No mass updates. No data mutations.

CREATE OR REPLACE FUNCTION public.validate_contact_tree()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_depth smallint;
  v_parent_user uuid;
  v_walker uuid;
  v_next uuid;
  v_hops smallint := 0;
BEGIN
  -- 1. leg enum (unchanged)
  IF NEW.leg IS NULL OR NEW.leg NOT IN ('L','R','') THEN
    RAISE EXCEPTION 'Invalid leg: % (allowed: L, R, empty)', NEW.leg;
  END IF;

  -- 2. tree_depth bounds (unchanged)
  IF NEW.tree_depth IS NOT NULL AND (NEW.tree_depth < 0 OR NEW.tree_depth > 13) THEN
    RAISE EXCEPTION 'Invalid tree_depth: % (allowed: 0-13)', NEW.tree_depth;
  END IF;

  -- 3. self-parent guard (unchanged)
  IF NEW.parent_contact_id IS NOT NULL AND NEW.parent_contact_id = NEW.id THEN
    RAISE EXCEPTION 'A contact cannot be its own parent';
  END IF;

  -- 4. No parent → depth 0
  IF NEW.parent_contact_id IS NULL THEN
    NEW.tree_depth := 0;
    RETURN NEW;
  END IF;

  -- 5. Parent must exist, belong to same user, and have valid depth
  SELECT tree_depth, user_id INTO v_parent_depth, v_parent_user
    FROM public.contacts WHERE id = NEW.parent_contact_id;

  IF v_parent_depth IS NULL THEN
    RAISE EXCEPTION 'parent_contact_id % not found', NEW.parent_contact_id;
  END IF;

  IF v_parent_user IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'parent_contact_id must belong to the same user';
  END IF;

  IF v_parent_depth >= 13 THEN
    RAISE EXCEPTION 'Cannot link: parent depth is % (max 13)', v_parent_depth;
  END IF;

  -- 6. Auto-derive depth from parent
  NEW.tree_depth := v_parent_depth + 1;

  -- 7. Recursive cycle guard (walk up parents, max 14 hops)
  v_walker := NEW.parent_contact_id;
  WHILE v_walker IS NOT NULL AND v_hops < 14 LOOP
    IF v_walker = NEW.id THEN
      RAISE EXCEPTION 'Cycle detected: contact % would become its own ancestor', NEW.id;
    END IF;
    SELECT parent_contact_id INTO v_next FROM public.contacts WHERE id = v_walker;
    v_walker := v_next;
    v_hops := v_hops + 1;
  END LOOP;

  IF v_hops >= 14 THEN
    RAISE EXCEPTION 'Ancestor chain exceeds safe walk depth (14 hops)';
  END IF;

  RETURN NEW;
END;
$$;