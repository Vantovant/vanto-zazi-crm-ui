ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_note text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON public.shipments (order_id);