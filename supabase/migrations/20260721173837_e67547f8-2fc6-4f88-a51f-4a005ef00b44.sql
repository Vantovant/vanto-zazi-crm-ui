ALTER TABLE public.birthday_campaign_recipients ADD COLUMN IF NOT EXISTS hub_decision jsonb;
ALTER TABLE public.activation_campaign_recipients ADD COLUMN IF NOT EXISTS hub_decision jsonb;
ALTER TABLE public.zoom_campaign_recipients ADD COLUMN IF NOT EXISTS hub_decision jsonb;