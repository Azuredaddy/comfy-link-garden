-- Link a calendar job back to the quote it came from.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jobs_quote_id_idx ON public.jobs (quote_id);
