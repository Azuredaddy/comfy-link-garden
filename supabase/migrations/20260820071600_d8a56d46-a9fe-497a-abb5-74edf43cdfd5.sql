CREATE OR REPLACE FUNCTION public.notify_new_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lankyservices.com.au/api/public/notify-quote',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('id', NEW.id)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_new_quote() FROM PUBLIC, anon, authenticated;