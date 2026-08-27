ALTER TABLE public.admin_emails
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_emails'::regclass
      AND conname = 'admin_emails_role_chk'
  ) THEN
    ALTER TABLE public.admin_emails
      ADD CONSTRAINT admin_emails_role_chk
      CHECK (role IN ('admin', 'editor', 'viewer'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Job',
  customer_phone text,
  suburb text,
  description text,
  job_date date NOT NULL DEFAULT current_date,
  job_time time,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled')),
  source text,
  amount numeric(12,2),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage jobs" ON public.jobs;
CREATE POLICY "Admins manage jobs" ON public.jobs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS jobs_date_idx ON public.jobs (job_date);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);
DROP TRIGGER IF EXISTS jobs_touch ON public.jobs;
CREATE TRIGGER jobs_touch BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.marketing_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  consent_ip text,
  source text,
  unsubscribe_token text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.marketing_subscribers TO authenticated;
GRANT ALL ON public.marketing_subscribers TO service_role;
ALTER TABLE public.marketing_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage subscribers" ON public.marketing_subscribers;
CREATE POLICY "Admins manage subscribers" ON public.marketing_subscribers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS marketing_subscribers_active_idx
  ON public.marketing_subscribers (unsubscribed_at);