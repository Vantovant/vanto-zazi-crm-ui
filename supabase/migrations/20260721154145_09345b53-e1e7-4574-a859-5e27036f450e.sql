
CREATE TABLE public.campaign_settings (
  campaign_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  daily_cap integer NOT NULL DEFAULT 40,
  per_tick_cap integer NOT NULL DEFAULT 10,
  active_windows text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_settings TO authenticated;
GRANT ALL ON public.campaign_settings TO service_role;
ALTER TABLE public.campaign_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camp_settings admin read"   ON public.campaign_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "camp_settings admin write"  ON public.campaign_settings FOR ALL    TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER camp_settings_updated_at BEFORE UPDATE ON public.campaign_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.campaign_settings (campaign_key, daily_cap, per_tick_cap) VALUES
  ('birthday', 24, 8),
  ('activation', 40, 10),
  ('zoom', 30, 10)
ON CONFLICT (campaign_key) DO NOTHING;
