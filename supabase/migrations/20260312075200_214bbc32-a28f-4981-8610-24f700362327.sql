
-- Follow-up states table: tracks reply status per contact per channel
CREATE TABLE IF NOT EXISTS public.follow_up_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  reply_status text NOT NULL DEFAULT 'unknown',
  last_inbound_at timestamp with time zone,
  last_outbound_at timestamp with time zone,
  follow_up_attempts integer NOT NULL DEFAULT 0,
  recommended_action text NOT NULL DEFAULT '',
  last_message_preview text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id, channel)
);

-- Enable RLS
ALTER TABLE public.follow_up_states ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own follow_up_states"
  ON public.follow_up_states FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own follow_up_states"
  ON public.follow_up_states FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own follow_up_states"
  ON public.follow_up_states FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own follow_up_states"
  ON public.follow_up_states FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for quick lookups
CREATE INDEX idx_follow_up_states_contact ON public.follow_up_states(user_id, contact_id);
CREATE INDEX idx_follow_up_states_status ON public.follow_up_states(user_id, reply_status);
