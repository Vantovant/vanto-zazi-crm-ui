DO $$
DECLARE u uuid := 'a1de025a-ea1d-4df1-ad08-bc01758d165f';
BEGIN
  DELETE FROM public.ai_action_log WHERE user_id = u;
  DELETE FROM public.contact_activities WHERE user_id = u;
  DELETE FROM public.contact_birthdays WHERE user_id = u;
  DELETE FROM public.contact_waiting_room WHERE user_id = u;
  DELETE FROM public.follow_up_states WHERE user_id = u;
  DELETE FROM public.zazi_actions WHERE user_id = u;
  DELETE FROM public.orders WHERE user_id = u;
  DELETE FROM public.inventory WHERE user_id = u;
  DELETE FROM public.contacts WHERE user_id = u;
  DELETE FROM public.import_audit WHERE user_id = u;
  DELETE FROM public.merge_log WHERE user_id = u;
  DELETE FROM public.activity_goals WHERE user_id = u;
  DELETE FROM public.integration_settings WHERE user_id = u;
  DELETE FROM public.user_api_keys WHERE user_id = u;
  DELETE FROM public.user_knowledge_docs WHERE user_id = u;
  DELETE FROM public.user_activity WHERE user_id = u;
  DELETE FROM public.invites WHERE created_by = u OR used_by = u;
  DELETE FROM public.user_roles WHERE user_id = u;
  DELETE FROM public.profiles WHERE id = u;
  DELETE FROM auth.users WHERE id = u;
END $$;