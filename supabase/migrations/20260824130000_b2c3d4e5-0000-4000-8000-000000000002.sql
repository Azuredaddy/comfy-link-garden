-- Xero connection storage.
-- Tokens are secret: these tables are service-role only (no grants to
-- authenticated, RLS on with no permissive policy → blocked for clients).
-- The admin UI only ever sees connection *status* via a server route.

CREATE TABLE IF NOT EXISTS public.xero_connection (
  id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  tenant_id     text,
  tenant_name   text,
  connected_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xero_connection ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.xero_connection TO service_role;

CREATE TABLE IF NOT EXISTS public.xero_oauth_state (
  state      text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xero_oauth_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.xero_oauth_state TO service_role;
