-- Private token for the jobs iCal feed (subscribe in Google Calendar → syncs
-- to the phone). Unguessable; only someone with the link can read the feed.
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS ical_token text;
UPDATE public.business_settings SET ical_token = gen_random_uuid()::text
  WHERE ical_token IS NULL OR ical_token = '';
