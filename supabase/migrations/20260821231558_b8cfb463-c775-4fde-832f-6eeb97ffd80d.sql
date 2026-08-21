ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS submission_key uuid,
  ADD COLUMN IF NOT EXISTS notification_attempted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS notification_error text,
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_submission_key_key
  ON public.quote_requests (submission_key)
  WHERE submission_key IS NOT NULL;

DROP TRIGGER IF EXISTS notify_new_quote_trigger ON public.quote_requests;
DROP TRIGGER IF EXISTS on_quote_request_created ON public.quote_requests;
DROP TRIGGER IF EXISTS notify_new_quote ON public.quote_requests;
DROP FUNCTION IF EXISTS public.notify_new_quote();