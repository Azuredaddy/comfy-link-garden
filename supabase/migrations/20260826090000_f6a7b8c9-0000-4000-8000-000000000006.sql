-- Jobs calendar — track booked work (word-of-mouth, returning clients, etc.)
-- in one place, separate from website leads.

CREATE TABLE IF NOT EXISTS public.jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL DEFAULT 'Job',
  customer_phone text,
  suburb         text,
  description    text,
  job_date       date NOT NULL DEFAULT current_date,
  job_time       time,
  status         text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled')),
  source         text,
  amount         numeric(12,2),
  quote_id       uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id     uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_date_idx ON public.jobs (job_date);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
DROP POLICY IF EXISTS "Admins manage jobs" ON public.jobs;
CREATE POLICY "Admins manage jobs" ON public.jobs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS jobs_touch ON public.jobs;
CREATE TRIGGER jobs_touch BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
