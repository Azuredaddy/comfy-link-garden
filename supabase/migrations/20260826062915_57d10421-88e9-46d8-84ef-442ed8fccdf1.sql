REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.au_fy_start(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated, service_role;