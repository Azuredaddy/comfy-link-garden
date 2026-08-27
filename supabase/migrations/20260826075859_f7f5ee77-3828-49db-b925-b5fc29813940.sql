CREATE POLICY "Admins can add portal users"
ON public.admin_emails
FOR INSERT
TO authenticated
WITH CHECK (public.my_role() = 'admin');

CREATE POLICY "Admins can update portal users"
ON public.admin_emails
FOR UPDATE
TO authenticated
USING (public.my_role() = 'admin')
WITH CHECK (public.my_role() = 'admin');

CREATE POLICY "Admins can remove portal users"
ON public.admin_emails
FOR DELETE
TO authenticated
USING (public.my_role() = 'admin');