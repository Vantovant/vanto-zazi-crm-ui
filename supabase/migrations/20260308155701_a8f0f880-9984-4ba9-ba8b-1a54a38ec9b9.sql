
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  category TEXT NOT NULL DEFAULT '',
  template_name TEXT NOT NULL DEFAULT '',
  send_when_condition TEXT NOT NULL DEFAULT '',
  subject TEXT DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  merge_fields_supported TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read templates"
  ON public.message_templates FOR SELECT
  TO authenticated
  USING (true);
