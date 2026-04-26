-- H3A: Allow service-role audit advancement of last_seen_at and message_count
-- on already-linked rows (status='linked'). All other immutability rules stay.
-- Triggers run regardless of role, so we need a status='linked' exception
-- specifically for these two audit columns. user_id, phone_hash, phone_last4,
-- first_seen_at, created_at, and last_body_preview remain immutable always.

CREATE OR REPLACE FUNCTION public.enforce_unmatched_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always-immutable columns
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.phone_hash IS DISTINCT FROM OLD.phone_hash THEN
    RAISE EXCEPTION 'phone_hash is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.phone_last4 IS DISTINCT FROM OLD.phone_last4 THEN
    RAISE EXCEPTION 'phone_last4 is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.first_seen_at IS DISTINCT FROM OLD.first_seen_at THEN
    RAISE EXCEPTION 'first_seen_at is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.last_body_preview IS DISTINCT FROM OLD.last_body_preview THEN
    RAISE EXCEPTION 'last_body_preview is immutable on maytapi_inbound_unmatched';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable on maytapi_inbound_unmatched';
  END IF;

  -- message_count and last_seen_at: locked unless OLD.status = 'linked'
  -- (allows the inbound webhook to advance audit counters on linked rows only).
  IF OLD.status <> 'linked' THEN
    IF NEW.message_count IS DISTINCT FROM OLD.message_count THEN
      RAISE EXCEPTION 'message_count is immutable on maytapi_inbound_unmatched (status=%)', OLD.status;
    END IF;
    IF NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at THEN
      RAISE EXCEPTION 'last_seen_at is immutable on maytapi_inbound_unmatched (status=%)', OLD.status;
    END IF;
  ELSE
    -- On linked rows, message_count may only increase
    IF NEW.message_count < OLD.message_count THEN
      RAISE EXCEPTION 'message_count cannot decrease on linked rows';
    END IF;
  END IF;

  -- Validate status enum
  IF NEW.status NOT IN ('open', 'linked', 'ignored') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;

  -- Status transition guard: do not allow flipping a linked row back to open
  -- without an explicit linked_contact_id reset path. Allow linked -> ignored
  -- and open <-> linked/ignored.
  IF OLD.status = 'linked' AND NEW.status = 'open' THEN
    RAISE EXCEPTION 'Cannot revert a linked row directly to open';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;