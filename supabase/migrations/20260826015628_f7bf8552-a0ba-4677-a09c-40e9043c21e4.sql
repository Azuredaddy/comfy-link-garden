ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT role FROM public.admin_emails
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      LIMIT 1),
    'viewer');
$$;

REVOKE ALL ON FUNCTION public.my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;