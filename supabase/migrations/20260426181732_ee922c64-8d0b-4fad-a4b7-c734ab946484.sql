-- H4: Maytapi Inbox operational hardening
-- - read/unread state on maytapi_messages
-- - safe gate audit trail
-- All writes constrained: no body/phone/contact mutation; admin-only.

-- 1. Add read state columns
ALTER TABLE public.maytapi_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS read_by uuid NULL;

CREATE INDEX IF NOT EXISTS idx_maytapi_messages_conv_read
  ON public.maytapi_messages (conversation_key, read_at);

-- 2. Allow admin UPDATE on maytapi_messages, but enforce immutability of all
--    columns except read_at/read_by via trigger.
DROP POLICY IF EXISTS "Admins can mark maytapi messages read" ON public.maytapi_messages;
CREATE POLICY "Admins can mark maytapi messages read"
  ON public.maytapi_messages
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.enforce_maytapi_messages_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Hard-immutable columns: only read_at and read_by may be updated.
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'id is immutable on maytapi_messages'; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'user_id is immutable on maytapi_messages'; END IF;
  IF NEW.contact_id IS DISTINCT FROM OLD.contact_id THEN RAISE EXCEPTION 'contact_id is immutable on maytapi_messages'; END IF;
  IF NEW.direction IS DISTINCT FROM OLD.direction THEN RAISE EXCEPTION 'direction is immutable on maytapi_messages'; END IF;
  IF NEW.body IS DISTINCT FROM OLD.body THEN RAISE EXCEPTION 'body is immutable on maytapi_messages'; END IF;
  IF NEW.body_preview IS DISTINCT FROM OLD.body_preview THEN RAISE EXCEPTION 'body_preview is immutable on maytapi_messages'; END IF;
  IF NEW.phone_hash IS DISTINCT FROM OLD.phone_hash THEN RAISE EXCEPTION 'phone_hash is immutable on maytapi_messages'; END IF;
  IF NEW.phone_e164 IS DISTINCT FROM OLD.phone_e164 THEN RAISE EXCEPTION 'phone_e164 is immutable on maytapi_messages'; END IF;
  IF NEW.phone_last4 IS DISTINCT FROM OLD.phone_last4 THEN RAISE EXCEPTION 'phone_last4 is immutable on maytapi_messages'; END IF;
  IF NEW.conversation_key IS DISTINCT FROM OLD.conversation_key THEN RAISE EXCEPTION 'conversation_key is immutable on maytapi_messages'; END IF;
  IF NEW.maytapi_message_id IS DISTINCT FROM OLD.maytapi_message_id THEN RAISE EXCEPTION 'maytapi_message_id is immutable on maytapi_messages'; END IF;
  IF NEW.zazi_action_id IS DISTINCT FROM OLD.zazi_action_id THEN RAISE EXCEPTION 'zazi_action_id is immutable on maytapi_messages'; END IF;
  IF NEW.media_type IS DISTINCT FROM OLD.media_type THEN RAISE EXCEPTION 'media_type is immutable on maytapi_messages'; END IF;
  IF NEW.media_url IS DISTINCT FROM OLD.media_url THEN RAISE EXCEPTION 'media_url is immutable on maytapi_messages'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'status is immutable on maytapi_messages'; END IF;
  IF NEW.received_at IS DISTINCT FROM OLD.received_at THEN RAISE EXCEPTION 'received_at is immutable on maytapi_messages'; END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable on maytapi_messages'; END IF;
  IF NEW.raw IS DISTINCT FROM OLD.raw THEN RAISE EXCEPTION 'raw is immutable on maytapi_messages'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maytapi_messages_update_scope ON public.maytapi_messages;
CREATE TRIGGER trg_maytapi_messages_update_scope
  BEFORE UPDATE ON public.maytapi_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_maytapi_messages_update_scope();

-- 3. Gate audit table — safe metadata only (no raw phone, no body, no payload).
CREATE TABLE IF NOT EXISTS public.maytapi_gate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gate_id uuid NULL,
  action text NOT NULL,
  linked_contact_id uuid NULL,
  phone_last4 text NULL,
  actor_user_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maytapi_gate_audit_created_at
  ON public.maytapi_gate_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maytapi_gate_audit_gate_id
  ON public.maytapi_gate_audit (gate_id);

-- Validate enum + safety on insert
CREATE OR REPLACE FUNCTION public.validate_maytapi_gate_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.action NOT IN ('linked','ignored','marked_read','marked_unread') THEN
    RAISE EXCEPTION 'Invalid gate audit action: %', NEW.action;
  END IF;
  -- Reject any disallowed metadata keys to keep the trail safe.
  IF NEW.metadata ? 'phone_e164' OR NEW.metadata ? 'phone_number'
     OR NEW.metadata ? 'phone_normalized' OR NEW.metadata ? 'body'
     OR NEW.metadata ? 'body_preview' OR NEW.metadata ? 'raw'
     OR NEW.metadata ? 'message' THEN
    RAISE EXCEPTION 'maytapi_gate_audit.metadata may not contain raw phone, body, or payload fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_maytapi_gate_audit ON public.maytapi_gate_audit;
CREATE TRIGGER trg_validate_maytapi_gate_audit
  BEFORE INSERT ON public.maytapi_gate_audit
  FOR EACH ROW EXECUTE FUNCTION public.validate_maytapi_gate_audit();

ALTER TABLE public.maytapi_gate_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view gate audit" ON public.maytapi_gate_audit;
CREATE POLICY "Admins can view gate audit"
  ON public.maytapi_gate_audit
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No client INSERT/UPDATE/DELETE policies. Writes only via SECURITY DEFINER
-- RPCs below.

-- 4. Trigger on maytapi_inbound_unmatched: when status flips to linked or
--    ignored, write a safe audit row. Phone_hash and raw phone are NEVER
--    written — only phone_last4 (already masked) and gate_id.
CREATE OR REPLACE FUNCTION public.log_maytapi_gate_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'linked' AND OLD.status <> 'linked' THEN
    INSERT INTO public.maytapi_gate_audit
      (user_id, gate_id, action, linked_contact_id, phone_last4, actor_user_id, metadata)
    VALUES
      (NEW.user_id, NEW.id, 'linked', NEW.linked_contact_id, NEW.phone_last4,
       COALESCE(v_actor, NEW.linked_by, NEW.user_id),
       jsonb_build_object('message_count', NEW.message_count));
  ELSIF NEW.status = 'ignored' AND OLD.status <> 'ignored' THEN
    INSERT INTO public.maytapi_gate_audit
      (user_id, gate_id, action, linked_contact_id, phone_last4, actor_user_id, metadata)
    VALUES
      (NEW.user_id, NEW.id, 'ignored', NULL, NEW.phone_last4,
       COALESCE(v_actor, NEW.user_id),
       jsonb_build_object('message_count', NEW.message_count));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_maytapi_gate_action ON public.maytapi_inbound_unmatched;
CREATE TRIGGER trg_log_maytapi_gate_action
  AFTER UPDATE ON public.maytapi_inbound_unmatched
  FOR EACH ROW EXECUTE FUNCTION public.log_maytapi_gate_action();

-- 5. RPCs for read/unread (SECURITY DEFINER, admin-gated)
CREATE OR REPLACE FUNCTION public.mark_maytapi_thread_read(p_conversation_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.maytapi_messages
     SET read_at = COALESCE(read_at, now()),
         read_by = COALESCE(read_by, v_uid)
   WHERE conversation_key = p_conversation_key
     AND direction = 'inbound'
     AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.maytapi_gate_audit
      (user_id, gate_id, action, linked_contact_id, phone_last4, actor_user_id, metadata)
    SELECT v_uid, NULL, 'marked_read', NULL, NULL, v_uid,
           jsonb_build_object('thread_count', v_count);
  END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_maytapi_thread_unread(p_conversation_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.maytapi_messages
     SET read_at = NULL,
         read_by = NULL
   WHERE conversation_key = p_conversation_key
     AND direction = 'inbound'
     AND read_at IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.maytapi_gate_audit
      (user_id, gate_id, action, linked_contact_id, phone_last4, actor_user_id, metadata)
    SELECT v_uid, NULL, 'marked_unread', NULL, NULL, v_uid,
           jsonb_build_object('thread_count', v_count);
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_maytapi_thread_read(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_maytapi_thread_unread(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_maytapi_thread_read(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_maytapi_thread_unread(text) TO authenticated;