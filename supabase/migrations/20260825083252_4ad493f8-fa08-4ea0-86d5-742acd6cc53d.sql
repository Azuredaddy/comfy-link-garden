CREATE TABLE IF NOT EXISTS public.other_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  income_date date NOT NULL DEFAULT current_date,
  source text,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS other_income_date_idx ON public.other_income (income_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.other_income TO authenticated;
GRANT ALL ON public.other_income TO service_role;

ALTER TABLE public.other_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage other_income" ON public.other_income;
CREATE POLICY "Admins manage other_income" ON public.other_income
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());