ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enrolled_on date, ADD COLUMN IF NOT EXISTS activated_on date;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS outcome text, ADD COLUMN IF NOT EXISTS follow_up_on date;

-- Backfill enrolled/activated dates from notes
WITH src AS (
  SELECT c.id,
    substring(t.txt from 'Enrolled\s+(\d{2}\.\d{2}\.\d{4})') AS e,
    substring(t.txt from 'Activated\s+(\d{2}\.\d{2}\.\d{4})') AS a
  FROM public.contacts c
  CROSS JOIN LATERAL (
    SELECT c.additional_notes || ' ' || coalesce((
      SELECT string_agg(coalesce(ca.notes,'') || ' ' || ca.summary, ' ')
      FROM public.contact_activities ca WHERE ca.contact_id = c.id
        AND (coalesce(ca.notes,'') || ' ' || ca.summary) ~* 'Enrolled\s+\d{2}\.\d{2}\.\d{4}'), '') AS txt
  ) t
  WHERE t.txt ~* 'Enrolled\s+\d{2}\.\d{2}\.\d{4}'
)
UPDATE public.contacts c
SET enrolled_on = CASE WHEN src.e IS NOT NULL THEN to_date(src.e,'DD.MM.YYYY') END,
    activated_on = CASE WHEN src.a IS NOT NULL THEN to_date(src.a,'DD.MM.YYYY') END,
    updated_at = now()
FROM src WHERE src.id = c.id AND c.enrolled_on IS NULL AND c.activated_on IS NULL;

CREATE TABLE public.call_sheet_settings (
  user_id uuid PRIMARY KEY,
  min_level smallint NOT NULL DEFAULT 1,
  max_level smallint NOT NULL DEFAULT 5,
  new_days integer NOT NULL DEFAULT 30,
  steady_days integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_sheet_settings TO authenticated;
GRANT ALL ON public.call_sheet_settings TO service_role;
ALTER TABLE public.call_sheet_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings select" ON public.call_sheet_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own settings insert" ON public.call_sheet_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings update" ON public.call_sheet_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings delete" ON public.call_sheet_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_call_sheet_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.min_level < 1 OR NEW.min_level > 12 OR NEW.max_level < 1 OR NEW.max_level > 12 THEN
    RAISE EXCEPTION 'Levels must be between 1 and 12';
  END IF;
  IF NEW.min_level > NEW.max_level THEN RAISE EXCEPTION 'min_level cannot exceed max_level'; END IF;
  IF NEW.new_days < 1 OR NEW.steady_days < 1 THEN RAISE EXCEPTION 'Day windows must be positive'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER call_sheet_settings_validate BEFORE INSERT OR UPDATE ON public.call_sheet_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_call_sheet_settings();

CREATE OR REPLACE VIEW public.call_sheet_cards WITH (security_invoker = true) AS
WITH s AS (
  SELECT coalesce((SELECT min_level FROM public.call_sheet_settings WHERE user_id = auth.uid()), 1) AS mn,
         coalesce((SELECT max_level FROM public.call_sheet_settings WHERE user_id = auth.uid()), 5) AS mx,
         coalesce((SELECT new_days FROM public.call_sheet_settings WHERE user_id = auth.uid()), 30) AS nd,
         coalesce((SELECT steady_days FROM public.call_sheet_settings WHERE user_id = auth.uid()), 60) AS sd
),
base AS (
  SELECT DISTINCT ON (c.user_id, coalesce(nullif(c.aplgo_id,''), c.phone_normalized, c.id::text)) c.*
  FROM public.contacts c, s
  WHERE c.level ~ '^\s*\d{1,2}\s*$' AND trim(c.level)::int BETWEEN s.mn AND s.mx
    AND coalesce(c.lead_type,'') <> 'Expired'
  ORDER BY c.user_id, coalesce(nullif(c.aplgo_id,''), c.phone_normalized, c.id::text), c.updated_at DESC
),
x AS (
  SELECT b.*, lc.created_at AS last_call_at, lc.outcome AS last_call_outcome,
    mi.received_at AS last_inbound_at, mi.body AS last_inbound_preview, mo.received_at AS last_outbound_at,
    coalesce(o.total, 0) AS orders_last_60d, o.last_at AS last_order_at, s.nd
  FROM base b CROSS JOIN s
  LEFT JOIN LATERAL (SELECT ca.created_at, coalesce(ca.outcome, ca.summary) AS outcome FROM public.contact_activities ca
    WHERE ca.contact_id = b.id AND ca.activity_type = 'call' ORDER BY ca.created_at DESC LIMIT 1) lc ON true
  LEFT JOIN LATERAL (SELECT m.received_at, left(coalesce(m.body_preview, m.body), 200) AS body FROM public.maytapi_messages m
    WHERE m.contact_id = b.id AND m.direction = 'inbound' AND nullif(trim(coalesce(m.body, m.body_preview, '')), '') IS NOT NULL
    ORDER BY m.received_at DESC LIMIT 1) mi ON true
  LEFT JOIN LATERAL (SELECT m.received_at FROM public.maytapi_messages m
    WHERE m.contact_id = b.id AND m.direction = 'outbound' AND nullif(trim(coalesce(m.body, m.body_preview, '')), '') IS NOT NULL
    ORDER BY m.received_at DESC LIMIT 1) mo ON true
  LEFT JOIN LATERAL (SELECT sum(od.amount) AS total, max(od.order_date) AS last_at FROM public.orders od
    WHERE od.contact_id = b.id AND od.order_date >= (current_date - s.sd)) o ON true
)
SELECT x.id, x.full_name, x.phone_number, x.phone_normalized, x.city, x.province, x.go_status, x.leg, trim(x.level) AS level,
  x.aplgo_id, x.lead_type, x.communication_status, x.auto_send_opt_out, x.enrolled_on, x.activated_on, x.next_action,
  x.sponsor_name, x.additional_notes, x.created_at, x.last_call_at, x.last_call_outcome,
  coalesce((x.last_call_at AT TIME ZONE 'Africa/Johannesburg')::date = (now() AT TIME ZONE 'Africa/Johannesburg')::date, false) AS called_today,
  x.last_inbound_at, x.last_outbound_at, x.last_inbound_preview,
  (x.last_inbound_at IS NOT NULL AND (x.last_outbound_at IS NULL OR x.last_inbound_at > x.last_outbound_at)) AS unanswered_inbound,
  x.orders_last_60d, x.last_order_at,
  CASE
    WHEN (x.last_inbound_at IS NOT NULL AND (x.last_outbound_at IS NULL OR x.last_inbound_at > x.last_outbound_at))
      OR x.next_action ~* '(promised|outstanding|waiting)'
      OR x.last_call_outcome = 'Call back' THEN 'open'
    WHEN (x.enrolled_on IS NULL AND x.activated_on IS NULL AND x.created_at >= now() - make_interval(days => x.nd))
      OR x.enrolled_on >= current_date - x.nd OR x.activated_on >= current_date - x.nd THEN 'new'
    WHEN x.orders_last_60d > 0 THEN 'steady'
    ELSE 'little'
  END AS bucket,
  x.user_id
FROM x;
GRANT SELECT ON public.call_sheet_cards TO authenticated;
GRANT SELECT ON public.call_sheet_cards TO service_role;

CREATE OR REPLACE FUNCTION public.save_call(p_contact_id uuid, p_outcome text, p_notes text, p_next_action text, p_follow_up_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF coalesce(trim(p_outcome),'') = '' THEN RAISE EXCEPTION 'Choose an outcome'; END IF;
  INSERT INTO public.contact_activities (user_id, contact_id, activity_type, summary, outcome, notes, next_action, follow_up_on)
  VALUES (v_uid, p_contact_id, 'call', p_outcome, p_outcome, nullif(p_notes,''), nullif(p_next_action,''), p_follow_up_on)
  RETURNING id INTO v_id;
  IF coalesce(trim(p_next_action),'') <> '' THEN
    UPDATE public.contacts SET next_action = trim(p_next_action), updated_at = now()
    WHERE id = p_contact_id AND user_id = v_uid;
  END IF;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.save_call(uuid, text, text, text, date) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maytapi_messages;