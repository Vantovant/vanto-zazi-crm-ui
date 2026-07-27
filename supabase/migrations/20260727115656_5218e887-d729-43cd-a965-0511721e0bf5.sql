CREATE TABLE public.google_contacts_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_contacts_tokens TO authenticated;
GRANT ALL ON public.google_contacts_tokens TO service_role;

ALTER TABLE public.google_contacts_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google tokens"
  ON public.google_contacts_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_google_contacts_tokens_updated_at
  BEFORE UPDATE ON public.google_contacts_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Short-lived OAuth state store for CSRF protection (state -> user_id).
CREATE TABLE public.google_contacts_oauth_state (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_after TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes')
);

GRANT ALL ON public.google_contacts_oauth_state TO service_role;
ALTER TABLE public.google_contacts_oauth_state ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.