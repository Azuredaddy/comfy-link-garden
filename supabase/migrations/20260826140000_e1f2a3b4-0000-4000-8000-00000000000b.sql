-- Let the messages log record SMS (and link to a job).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_phone text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';
