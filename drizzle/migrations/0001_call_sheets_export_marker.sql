ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS export_seen_on date;
ALTER TABLE public.call_sheet_settings ADD COLUMN IF NOT EXISTS export_fresh_days integer NOT NULL DEFAULT 45;

CREATE OR REPLACE FUNCTION public.validate_call_sheet_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.min_level < 1 OR NEW.min_level > 12 OR NEW.max_level < 1 OR NEW.max_level > 12 THEN
    RAISE EXCEPTION 'Levels must be between 1 and 12';
  END IF;
  IF NEW.min_level > NEW.max_level THEN RAISE EXCEPTION 'min_level cannot exceed max_level'; END IF;
  IF NEW.new_days < 1 OR NEW.steady_days < 1 OR NEW.export_fresh_days < 1 THEN RAISE EXCEPTION 'Day windows must be positive'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE VIEW public.call_sheet_cards WITH (security_invoker = true) AS
WITH s AS (
  SELECT coalesce((SELECT min_level FROM public.call_sheet_settings WHERE user_id = auth.uid()), 1) AS mn,
         coalesce((SELECT max_level FROM public.call_sheet_settings WHERE user_id = auth.uid()), 5) AS mx,
         coalesce((SELECT new_days FROM public.call_sheet_settings WHERE user_id = auth.uid()), 30) AS nd,
         coalesce((SELECT steady_days FROM public.call_sheet_settings WHERE user_id = auth.uid()), 60) AS sd,
         coalesce((SELECT export_fresh_days FROM public.call_sheet_settings WHERE user_id = auth.uid()), 45) AS ef
),
base AS (
  SELECT DISTINCT ON (c.user_id, coalesce(nullif(c.aplgo_id,''), c.phone_normalized, c.id::text)) c.*
  FROM public.contacts c, s
  WHERE c.level ~ '^\s*\d{1,2}\s*$' AND trim(c.level)::int BETWEEN s.mn AND s.mx
    AND c.export_seen_on IS NOT NULL AND c.export_seen_on >= current_date - s.ef
  ORDER BY c.user_id, coalesce(nullif(c.aplgo_id,''), c.phone_normalized, c.id::text), c.export_seen_on DESC, c.updated_at DESC
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
  x.user_id,
  x.export_seen_on,
  (coalesce(x.lead_type,'') = 'Expired') AS tagged_expired
FROM x;