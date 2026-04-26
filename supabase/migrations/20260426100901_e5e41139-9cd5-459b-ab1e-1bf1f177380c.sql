-- ── Idempotency table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  scope text NOT NULL DEFAULT 'crm-webhook',
  request_hash text NOT NULL DEFAULT '',
  response_status int NOT NULL DEFAULT 200,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_webhook_idem_expires
  ON public.webhook_idempotency_keys (expires_at);

ALTER TABLE public.webhook_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Admin-only read; backend uses service role and bypasses RLS.
CREATE POLICY "Admins can view idempotency keys"
  ON public.webhook_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Rate-limit buckets ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'crm-webhook',
  identity text NOT NULL, -- hashed email or source token; never raw PII
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, identity, window_start)
);

CREATE INDEX IF NOT EXISTS idx_webhook_rl_window
  ON public.webhook_rate_limit_buckets (window_start);

ALTER TABLE public.webhook_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate-limit buckets"
  ON public.webhook_rate_limit_buckets
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Cleanup helper (called opportunistically by webhook) ─────────────────
CREATE OR REPLACE FUNCTION public.cleanup_webhook_safety_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webhook_idempotency_keys WHERE expires_at < now();
  DELETE FROM public.webhook_rate_limit_buckets
   WHERE window_start < (now() - interval '10 minutes');
END;
$$;