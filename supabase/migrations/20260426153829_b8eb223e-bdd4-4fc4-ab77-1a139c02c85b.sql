-- H2: Maytapi inbound memory + unmatched review queue

CREATE TABLE public.maytapi_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  maytapi_message_id text NULL,
  zazi_action_id uuid NULL,
  phone_hash text NOT NULL,
  phone_e164 text NULL,
  phone_last4 text NULL,
  conversation_key text NOT NULL,
  body text NULL,
  body_preview text NULL,
  media_type text NULL,
  media_url text NULL,
  status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX maytapi_messages_user_msgid_uniq
  ON public.maytapi_messages (user_id, maytapi_message_id)
  WHERE maytapi_message_id IS NOT NULL;

CREATE INDEX maytapi_messages_conv_idx
  ON public.maytapi_messages (user_id, conversation_key, received_at DESC);

CREATE INDEX maytapi_messages_contact_idx
  ON public.maytapi_messages (user_id, contact_id, received_at DESC)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.maytapi_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view maytapi messages"
  ON public.maytapi_messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT/UPDATE/DELETE policies → only service_role bypasses RLS to write.

CREATE TABLE public.maytapi_inbound_unmatched (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_hash text NOT NULL,
  phone_last4 text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  message_count integer NOT NULL DEFAULT 1,
  last_body_preview text NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','linked','ignored')),
  linked_contact_id uuid NULL,
  linked_at timestamptz NULL,
  linked_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX maytapi_unmatched_user_hash_uniq
  ON public.maytapi_inbound_unmatched (user_id, phone_hash);

CREATE INDEX maytapi_unmatched_status_idx
  ON public.maytapi_inbound_unmatched (user_id, status, last_seen_at DESC);

ALTER TABLE public.maytapi_inbound_unmatched ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view unmatched queue"
  ON public.maytapi_inbound_unmatched
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update unmatched queue"
  ON public.maytapi_inbound_unmatched
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- INSERT/DELETE: service role only.

CREATE TRIGGER trg_maytapi_unmatched_updated_at
  BEFORE UPDATE ON public.maytapi_inbound_unmatched
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();