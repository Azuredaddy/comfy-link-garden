ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS ical_token text NOT NULL DEFAULT gen_random_uuid()::text;
NOTIFY pgrst, 'reload schema';