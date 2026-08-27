-- Assign jobs to a team member (by their login email).
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS assigned_to text;
CREATE INDEX IF NOT EXISTS jobs_assigned_idx ON public.jobs (assigned_to);
