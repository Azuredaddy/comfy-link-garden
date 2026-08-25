-- Allow admins to delete leads (quote_requests). Quotes, invoices and expenses
-- already permit admin deletes from the portal migration. Related rows are safe:
-- quotes/invoices reference quote_requests with ON DELETE SET NULL.

GRANT DELETE ON public.quote_requests TO authenticated;

DROP POLICY IF EXISTS "Admins can delete quote requests" ON public.quote_requests;
CREATE POLICY "Admins can delete quote requests"
  ON public.quote_requests FOR DELETE TO authenticated
  USING (public.is_admin());
