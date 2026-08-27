ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS time_note text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS assigned_to text;