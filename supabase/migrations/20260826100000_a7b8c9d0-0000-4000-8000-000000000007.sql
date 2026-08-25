-- Marketing subscribers — explicit opt-in only (Australian Spam Act / ACMA).
-- A row is created ONLY when someone ticks the (unticked-by-default) consent
-- box on the quote form. We log the consent time + IP as proof of consent.

CREATE TABLE IF NOT EXISTS public.marketing_subscribers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE,
  name             text,
  consented_at     timestamptz NOT NULL DEFAULT now(),
  consent_ip       text,
  source           text,
  unsubscribe_token text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  unsubscribed_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_subscribers_active_idx
  ON public.marketing_subscribers (unsubscribed_at);

ALTER TABLE public.marketing_subscribers ENABLE ROW LEVEL SECURITY;
-- Only admins read/manage the list; rows are written server-side (service role).
GRANT SELECT, UPDATE, DELETE ON public.marketing_subscribers TO authenticated;
GRANT ALL ON public.marketing_subscribers TO service_role;
DROP POLICY IF EXISTS "Admins manage subscribers" ON public.marketing_subscribers;
CREATE POLICY "Admins manage subscribers" ON public.marketing_subscribers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
