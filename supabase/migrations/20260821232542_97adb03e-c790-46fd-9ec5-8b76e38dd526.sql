GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT SELECT ON public.admin_emails TO authenticated;
GRANT ALL ON public.admin_emails TO service_role;
INSERT INTO public.admin_emails (email) VALUES ('matt@lankyservices.com.au') ON CONFLICT DO NOTHING;