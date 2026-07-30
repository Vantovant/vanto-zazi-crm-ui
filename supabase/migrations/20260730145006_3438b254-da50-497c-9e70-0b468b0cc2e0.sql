CREATE TABLE IF NOT EXISTS public.campaign_send_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_key text NOT NULL,
  phone_normalized text NOT NULL,
  cycle_key text NOT NULL,
  dedupe_key text NOT NULL,
  contact_id uuid,
  recipient_id uuid,
  maytapi_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.campaign_send_ledger TO authenticated;
GRANT ALL ON public.campaign_send_ledger TO service_role;

ALTER TABLE public.campaign_send_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own campaign ledger" ON public.campaign_send_ledger;
CREATE POLICY "Users view own campaign ledger"
  ON public.campaign_send_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_send_ledger_dedupe_uidx
  ON public.campaign_send_ledger (user_id, dedupe_key);
CREATE INDEX IF NOT EXISTS campaign_send_ledger_lookup_idx
  ON public.campaign_send_ledger (campaign_key, phone_normalized, cycle_key);

INSERT INTO public.campaign_send_ledger
  (user_id, campaign_key, phone_normalized, cycle_key, dedupe_key, contact_id, maytapi_message_id, sent_at)
SELECT DISTINCT ON (m.user_id, k.dedupe_key)
  m.user_id, k.campaign_key, k.phone, k.cycle_key, k.dedupe_key, m.contact_id, m.maytapi_message_id, m.received_at
FROM public.maytapi_messages m
CROSS JOIN LATERAL (
  SELECT
    m.raw->>'campaign' AS campaign_key,
    COALESCE(m.phone_e164, m.phone_last4) AS phone,
    CASE WHEN m.raw->>'campaign' = 'birthday'
         THEN to_char(m.received_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY')
         ELSE to_char(m.received_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM') END AS cycle_key
) k0
CROSS JOIN LATERAL (
  SELECT k0.campaign_key, k0.phone, k0.cycle_key,
         k0.campaign_key || ':' || k0.phone || ':' || k0.cycle_key AS dedupe_key
) k
WHERE m.direction = 'outbound'
  AND m.raw->>'campaign' IN ('birthday','activation','zoom')
  AND COALESCE(m.phone_e164, '') <> ''
ORDER BY m.user_id, k.dedupe_key, m.received_at ASC
ON CONFLICT DO NOTHING;