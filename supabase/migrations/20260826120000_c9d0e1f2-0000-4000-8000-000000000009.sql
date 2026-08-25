-- Roles for portal users:
--   admin  = full access + manage users
--   editor = full access, cannot manage users
--   viewer = read-only
--
-- Safety: new policies are CREATED before the old ones are DROPPED, and admins
-- satisfy has_access()/can_edit()/is_admin(), so an admin never loses access
-- part-way through. Existing rows default to 'admin' (so Matt stays admin).

ALTER TABLE public.admin_emails ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_emails_role_chk') THEN
    ALTER TABLE public.admin_emails ADD CONSTRAINT admin_emails_role_chk CHECK (role IN ('admin','editor','viewer'));
  END IF;
END $$;

-- ---- access helpers -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_access() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
CREATE OR REPLACE FUNCTION public.can_edit() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) AND role IN ('admin','editor'));
$$;
CREATE OR REPLACE FUNCTION public.my_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.admin_emails WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.has_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;

-- is_admin() now means the 'admin' role specifically (used for user mgmt + settings)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) AND role = 'admin');
$$;

-- editors (not just admins) must be able to allocate document numbers
CREATE OR REPLACE FUNCTION public.next_document_number(p_doc_type text) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fy integer := public.au_fy_start(current_date); v_num integer; v_prefix text;
BEGIN
  IF NOT public.can_edit() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.document_counters (doc_type, fy, last_number) VALUES (p_doc_type, v_fy, 0)
    ON CONFLICT (doc_type, fy) DO NOTHING;
  UPDATE public.document_counters SET last_number = last_number + 1
    WHERE doc_type = p_doc_type AND fy = v_fy RETURNING last_number INTO v_num;
  SELECT CASE p_doc_type WHEN 'quote' THEN coalesce(quote_prefix,'Q') WHEN 'invoice' THEN coalesce(invoice_prefix,'INV')
         ELSE upper(substr(p_doc_type,1,3)) END INTO v_prefix FROM public.business_settings LIMIT 1;
  RETURN coalesce(v_prefix, upper(substr(p_doc_type,1,3))) || '-' || v_fy::text || '-' || lpad(v_num::text,3,'0');
END; $$;

-- ---- table policies: read = has_access, write = can_edit ------------------
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['quotes','quote_items','invoices','invoice_items','expenses','messages','products','other_income','jobs','marketing_subscribers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "portal read %1$s" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "portal read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_access());', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal write %1$s" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "portal write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I;', t);
  END LOOP;
END $$;

-- leads (quote_requests): keep anon insert; read=has_access, write/delete=can_edit
DROP POLICY IF EXISTS "portal read leads" ON public.quote_requests;
CREATE POLICY "portal read leads" ON public.quote_requests FOR SELECT TO authenticated USING (public.has_access());
DROP POLICY IF EXISTS "portal update leads" ON public.quote_requests;
CREATE POLICY "portal update leads" ON public.quote_requests FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
DROP POLICY IF EXISTS "portal delete leads" ON public.quote_requests;
CREATE POLICY "portal delete leads" ON public.quote_requests FOR DELETE TO authenticated USING (public.can_edit());
DROP POLICY IF EXISTS "Admins can view quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Admins can update quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Admins can delete quote requests" ON public.quote_requests;

-- business settings: everyone with access reads; only admins change
DROP POLICY IF EXISTS "portal read settings" ON public.business_settings;
CREATE POLICY "portal read settings" ON public.business_settings FOR SELECT TO authenticated USING (public.has_access());
DROP POLICY IF EXISTS "portal update settings" ON public.business_settings;
CREATE POLICY "portal update settings" ON public.business_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can read settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.business_settings;

-- admin_emails: only admins manage users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_emails TO authenticated;
DROP POLICY IF EXISTS "portal manage users" ON public.admin_emails;
CREATE POLICY "portal manage users" ON public.admin_emails FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can view the admin list" ON public.admin_emails;

-- storage: read=has_access, write=can_edit (receipts + documents)
DROP POLICY IF EXISTS "access receipts" ON storage.objects;
CREATE POLICY "access receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts' AND public.has_access());
DROP POLICY IF EXISTS "write receipts" ON storage.objects;
CREATE POLICY "write receipts" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'receipts' AND public.can_edit()) WITH CHECK (bucket_id = 'receipts' AND public.can_edit());
DROP POLICY IF EXISTS "Admins manage receipts" ON storage.objects;

DROP POLICY IF EXISTS "access documents" ON storage.objects;
CREATE POLICY "access documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND public.has_access());
DROP POLICY IF EXISTS "write documents" ON storage.objects;
CREATE POLICY "write documents" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'documents' AND public.can_edit()) WITH CHECK (bucket_id = 'documents' AND public.can_edit());
DROP POLICY IF EXISTS "Admins manage documents" ON storage.objects;
