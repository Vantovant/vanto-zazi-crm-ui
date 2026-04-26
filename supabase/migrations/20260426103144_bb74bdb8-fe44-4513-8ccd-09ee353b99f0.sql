-- E.2 — Prospector Send Log (observability only)
CREATE TABLE public.prospector_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  contact_id uuid,
  zazi_action_id uuid REFERENCES public.zazi_actions(id) ON DELETE SET NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  mode text NOT NULL CHECK (mode IN ('test','prod')),
  intended_send_type text NOT NULL,
  maytapi_message_id text,
  request_status text NOT NULL CHECK (request_status IN ('ok','fail','blocked')),
  payload_hash text,
  response_status_code integer,
  error_code text,
  phone_hash text,
  content_length integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_prospector_send_log_zazi_action ON public.prospector_send_log(zazi_action_id);
CREATE INDEX idx_prospector_send_log_created_at ON public.prospector_send_log(created_at DESC);
CREATE INDEX idx_prospector_send_log_user ON public.prospector_send_log(user_id);

ALTER TABLE public.prospector_send_log ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT. No public INSERT/UPDATE/DELETE policies — service role bypasses RLS.
CREATE POLICY "Admins can view prospector send log"
ON public.prospector_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));