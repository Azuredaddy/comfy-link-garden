-- Allow a "not yet confirmed / TBC" job status.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('unconfirmed','booked','completed','cancelled'));
