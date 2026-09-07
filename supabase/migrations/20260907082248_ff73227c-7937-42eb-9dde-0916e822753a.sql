CREATE TABLE public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  waybill_number text NOT NULL UNIQUE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unknown',
  product_summary text NOT NULL DEFAULT '',
  collection_address text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  service_level text NOT NULL DEFAULT '',
  courier_reference text NOT NULL DEFAULT '',
  earliest_delivery_date date,
  last_status_update timestamp with time zone NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shipments" ON public.shipments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own shipments" ON public.shipments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shipments" ON public.shipments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_shipments_user ON public.shipments(user_id);
CREATE INDEX idx_shipments_contact ON public.shipments(contact_id);
CREATE INDEX idx_shipments_status ON public.shipments(status);

CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();