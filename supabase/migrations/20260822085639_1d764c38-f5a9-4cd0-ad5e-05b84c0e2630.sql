CREATE TABLE public.server_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  route TEXT,
  method TEXT,
  status INTEGER,
  user_agent TEXT,
  context JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX server_errors_created_at_idx ON public.server_errors (created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.server_errors TO authenticated;
GRANT ALL ON public.server_errors TO service_role;

ALTER TABLE public.server_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read server errors"
  ON public.server_errors FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update server errors"
  ON public.server_errors FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete server errors"
  ON public.server_errors FOR DELETE TO authenticated
  USING (public.is_admin());