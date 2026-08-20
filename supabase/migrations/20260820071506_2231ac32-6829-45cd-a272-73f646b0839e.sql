CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_new_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM extensions.net.http_post(
    url := 'https://lankyservices.com.au/api/public/notify-quote',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quote_request_created ON public.quote_requests;
CREATE TRIGGER on_quote_request_created
AFTER INSERT ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_new_quote();