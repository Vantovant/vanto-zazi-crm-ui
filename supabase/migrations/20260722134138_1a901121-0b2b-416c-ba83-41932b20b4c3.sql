
ALTER TABLE public.activation_campaign_recipients
  ADD COLUMN IF NOT EXISTS amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS activity_month text;

INSERT INTO public.activation_campaign_recipients
  (user_id, contact_id, order_id, member_id, name, first_name,
   phone_normalized, email, sponsor_name, amount, activity_month, status)
SELECT
  o.user_id,
  c.id,
  o.id,
  c.aplgo_id,
  c.full_name,
  split_part(coalesce(c.full_name,''), ' ', 1),
  c.phone_normalized,
  c.email_address,
  c.sponsor_name,
  o.amount,
  'July 2026',
  'queued'
FROM public.orders o
JOIN public.contacts c ON c.id = o.contact_id
WHERE o.source = 'monthly-activity-paste'
  AND o.product = 'Monthly Activity - July 2026'
  AND c.phone_normalized IS NOT NULL
  AND length(c.phone_normalized) >= 8
ON CONFLICT (phone_normalized) DO NOTHING;
