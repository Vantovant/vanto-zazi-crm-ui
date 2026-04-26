-- H3: Restrict admin UPDATE on maytapi_inbound_unmatched to only the
-- columns required by link/ignore actions. Phone hash, last4, counts,
-- previews, and timestamps stay locked from client mutation.

-- Drop the broad existing admin update policy
DROP POLICY IF EXISTS "Admins can update unmatched queue" ON public.maytapi_inbound_unmatched;

-- Trigger: enforce that only allowed columns may change on UPDATE
CREATE OR REPLACE FUNCTION public.enforce_unmatched_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Immutable columns (must not change on UPDATE from any client)
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.phone_hash IS DISTINCT FROM OLD.phone_hash THEN
    RAISE EXCEPTION 'phone_hash is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.phone_last4 IS DISTINCT FROM OLD.phone_last4 THEN
    RAISE EXCEPTION 'phone_last4 is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.message_count IS DISTINCT FROM OLD.message_count THEN
    RAISE EXCEPTION 'message_count is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.first_seen_at IS DISTINCT FROM OLD.first_seen_at THEN
    RAISE EXCEPTION 'first_seen_at is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at THEN
    RAISE EXCEPTION 'last_seen_at is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.last_body_preview IS DISTINCT FROM OLD.last_body_preview THEN
    RAISE EXCEPTION 'last_body_preview is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable on maytapi_inbound_unmatched';
  END IF;

  -- Validate status enum
  IF NEW.status NOT IN ('open', 'linked', 'ignored') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;

  -- Touch updated_at
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_unmatched_update_scope_trg ON public.maytapi_inbound_unmatched;
CREATE TRIGGER enforce_unmatched_update_scope_trg
BEFORE UPDATE ON public.maytapi_inbound_unmatched
FOR EACH ROW
EXECUTE FUNCTION public.enforce_unmatched_update_scope();

-- Recreate admin UPDATE policy (column-level restriction enforced by trigger)
CREATE POLICY "Admins can update unmatched queue"
ON public.maytapi_inbound_unmatched
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
