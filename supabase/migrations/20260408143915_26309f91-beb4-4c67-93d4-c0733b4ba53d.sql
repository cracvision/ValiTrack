CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reset_tokens_hash ON public.password_reset_tokens(token_hash) WHERE used_at IS NULL;

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;