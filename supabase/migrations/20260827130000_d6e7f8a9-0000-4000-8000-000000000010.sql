-- A free-text "rough time" for a booking (e.g. "morning", "9–11am") since
-- times given to customers are usually approximate.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS time_note text;
