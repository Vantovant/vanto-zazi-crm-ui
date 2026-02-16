
-- Invite tokens for controlled access
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  label text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_used boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Only the creator (admin) can see and manage invites
CREATE POLICY "Creator can view their invites"
ON public.invites FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Creator can insert invites"
ON public.invites FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update invites"
ON public.invites FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete invites"
ON public.invites FOR DELETE
USING (auth.uid() = created_by);

-- Allow anyone (including anon during signup) to validate a token via edge function
-- The edge function uses service_role key to check/mark tokens

CREATE INDEX idx_invites_token ON public.invites(token);
