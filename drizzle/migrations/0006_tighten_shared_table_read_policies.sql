DROP POLICY IF EXISTS "Authenticated users can read team patterns" ON public.ai_team_patterns;
CREATE POLICY "Admins can read team patterns" ON public.ai_team_patterns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "authenticated read hub mirror" ON public.hub_contacts_mirror;
CREATE POLICY "Admins can read hub mirror" ON public.hub_contacts_mirror FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DO $$ DECLARE p record; BEGIN
FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND cmd='SELECT' LOOP
EXECUTE format('DROP POLICY %I ON public.message_templates', p.policyname); END LOOP; END $$;
CREATE POLICY "Signed-in users can read active templates" ON public.message_templates FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND active = true);