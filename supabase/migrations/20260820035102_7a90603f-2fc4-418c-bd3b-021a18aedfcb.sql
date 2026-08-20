REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.admin_emails TO authenticated;

CREATE POLICY "Admins can view the admin list"
  ON public.admin_emails FOR SELECT TO authenticated
  USING (public.is_admin());