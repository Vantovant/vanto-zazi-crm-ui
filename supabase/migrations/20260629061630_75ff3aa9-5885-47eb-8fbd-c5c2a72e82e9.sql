
-- 1. Profiles: restrict SELECT to owner
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_self_profile(id));

-- 2. contact_activities: add UPDATE policy
CREATE POLICY "Users can update their own activities"
  ON public.contact_activities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. prospector_send_log: allow owners to read their own rows
CREATE POLICY "Users can view their own prospector send log"
  ON public.prospector_send_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Lock down SECURITY DEFINER functions from being exposed over PostgREST.
--    Trigger functions and maintenance routines should never be callable by
--    anon or authenticated. Keep only functions the app/UI legitimately calls.
REVOKE EXECUTE ON FUNCTION public.validate_maytapi_gate_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_maytapi_messages_update_scope() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_maytapi_gate_action() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_integration_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_invite_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_unmatched_update_scope() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_webhook_safety_tables() FROM PUBLIC, anon, authenticated;

-- has_role / is_self_profile remain executable by authenticated (used in RLS evaluation
-- via SECURITY DEFINER; revoking from anon is safe).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_self_profile(uuid) FROM PUBLIC, anon;

-- mark_maytapi_thread_read/unread and create_offline_order_and_deduct_stock are
-- intentionally called by signed-in users — revoke anon only.
REVOKE EXECUTE ON FUNCTION public.mark_maytapi_thread_read(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_maytapi_thread_unread(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_offline_order_and_deduct_stock(uuid, uuid, text, text, integer, numeric, numeric, text, text, text, date, text, text[], text) FROM PUBLIC, anon;

-- sanitize_contact_aplgo_id is a trigger function
REVOKE EXECUTE ON FUNCTION public.sanitize_contact_aplgo_id() FROM PUBLIC, anon, authenticated;
