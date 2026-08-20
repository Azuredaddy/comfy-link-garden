ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS handled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_emails TO service_role;

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_emails (email) VALUES ('matt@lankyservices.com.au')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

GRANT SELECT, UPDATE ON public.quote_requests TO authenticated;

CREATE POLICY "Admins can view quote requests"
  ON public.quote_requests FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update quote requests"
  ON public.quote_requests FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());