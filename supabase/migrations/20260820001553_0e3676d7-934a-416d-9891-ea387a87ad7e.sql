CREATE TABLE public.quote_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  email text,
  suburb text,
  service text,
  message text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.quote_requests TO anon;
GRANT SELECT, INSERT ON public.quote_requests TO authenticated;
GRANT ALL ON public.quote_requests TO service_role;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a quote request" ON public.quote_requests FOR INSERT TO anon, authenticated WITH CHECK (
  length(name) > 0 AND length(name) <= 100
  AND (phone IS NULL OR length(phone) <= 40)
  AND (email IS NULL OR length(email) <= 255)
  AND (suburb IS NULL OR length(suburb) <= 100)
  AND (service IS NULL OR length(service) <= 100)
  AND (message IS NULL OR length(message) <= 2000)
  AND (source_url IS NULL OR length(source_url) <= 500)
);