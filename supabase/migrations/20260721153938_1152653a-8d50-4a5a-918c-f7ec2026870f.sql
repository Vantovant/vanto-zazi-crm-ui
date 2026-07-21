
-- BIRTHDAY
CREATE TABLE public.birthday_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  member_id text, name text, first_name text,
  phone_normalized text NOT NULL,
  email text,
  birth_date date,
  congratulate_by_date date,
  cycle_year integer NOT NULL,
  tone text NOT NULL DEFAULT 'warm',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz, sent_at timestamptz,
  provider_message_id text,
  delivered_at timestamptz, read_at timestamptz, replied_at timestamptz,
  reply_preview text, error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_birthday_camp_phone_year ON public.birthday_campaign_recipients (phone_normalized, cycle_year);
CREATE INDEX ix_birthday_camp_status ON public.birthday_campaign_recipients (status, congratulate_by_date);
CREATE INDEX ix_birthday_camp_provider_msg ON public.birthday_campaign_recipients (provider_message_id) WHERE provider_message_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_campaign_recipients TO authenticated;
GRANT ALL ON public.birthday_campaign_recipients TO service_role;
ALTER TABLE public.birthday_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "birthday_camp admin read"   ON public.birthday_campaign_recipients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "birthday_camp admin insert" ON public.birthday_campaign_recipients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "birthday_camp admin update" ON public.birthday_campaign_recipients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "birthday_camp admin delete" ON public.birthday_campaign_recipients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER birthday_camp_updated_at BEFORE UPDATE ON public.birthday_campaign_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ACTIVATION
CREATE TABLE public.activation_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  member_id text, name text, first_name text,
  phone_normalized text NOT NULL,
  email text,
  activation_date date, pack_type text, sponsor_name text,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz, sent_at timestamptz,
  provider_message_id text,
  delivered_at timestamptz, read_at timestamptz, replied_at timestamptz,
  reply_preview text, error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_activation_camp_phone ON public.activation_campaign_recipients (phone_normalized);
CREATE INDEX ix_activation_camp_status ON public.activation_campaign_recipients (status, created_at);
CREATE INDEX ix_activation_camp_provider_msg ON public.activation_campaign_recipients (provider_message_id) WHERE provider_message_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activation_campaign_recipients TO authenticated;
GRANT ALL ON public.activation_campaign_recipients TO service_role;
ALTER TABLE public.activation_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activation_camp admin read"   ON public.activation_campaign_recipients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "activation_camp admin insert" ON public.activation_campaign_recipients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "activation_camp admin update" ON public.activation_campaign_recipients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "activation_camp admin delete" ON public.activation_campaign_recipients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER activation_camp_updated_at BEFORE UPDATE ON public.activation_campaign_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ZOOM
CREATE TABLE public.zoom_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_id text NOT NULL,
  event_name text,
  event_date timestamptz NOT NULL,
  zoom_url text NOT NULL,
  member_id text, name text, first_name text,
  phone_normalized text NOT NULL,
  email text,
  reminder_stage text NOT NULL DEFAULT 't_minus_48h',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz, sent_at timestamptz,
  provider_message_id text,
  delivered_at timestamptz, read_at timestamptz, replied_at timestamptz,
  reply_preview text, error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_zoom_camp_event_phone_stage ON public.zoom_campaign_recipients (event_id, phone_normalized, reminder_stage);
CREATE INDEX ix_zoom_camp_status ON public.zoom_campaign_recipients (status, event_date, reminder_stage);
CREATE INDEX ix_zoom_camp_provider_msg ON public.zoom_campaign_recipients (provider_message_id) WHERE provider_message_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoom_campaign_recipients TO authenticated;
GRANT ALL ON public.zoom_campaign_recipients TO service_role;
ALTER TABLE public.zoom_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zoom_camp admin read"   ON public.zoom_campaign_recipients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "zoom_camp admin insert" ON public.zoom_campaign_recipients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "zoom_camp admin update" ON public.zoom_campaign_recipients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "zoom_camp admin delete" ON public.zoom_campaign_recipients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER zoom_camp_updated_at BEFORE UPDATE ON public.zoom_campaign_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
