-- Lanky Services — Admin portal upgrade
-- Adds: business settings, quotes + invoices (+ line items), expenses,
-- a message/communications log, atomic document numbering, and storage
-- for generated PDFs and expense receipts.
-- RLS pattern matches 20260820035043_*.sql: admin-only via public.is_admin(),
-- full access for service_role.

-- ---------------------------------------------------------------------------
-- Helper: Australian financial year start year for a given date.
-- FY runs 1 Jul – 30 Jun; the "start year" of the FY containing 2026-08-24 is 2026.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.au_fy_start(d date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN extract(month FROM d) >= 7
              THEN extract(year FROM d)::int
              ELSE extract(year FROM d)::int - 1 END;
$$;

-- ---------------------------------------------------------------------------
-- Business settings (single row, id = 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_settings (
  id                integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name     text NOT NULL DEFAULT 'Lanky Services',
  abn               text,
  address           text,
  phone             text,
  email             text,
  gst_registered    boolean NOT NULL DEFAULT false,
  gst_rate          numeric(5,2) NOT NULL DEFAULT 10,
  bank_name         text,
  bank_bsb          text,
  bank_account      text,
  quote_prefix      text NOT NULL DEFAULT 'Q',
  invoice_prefix    text NOT NULL DEFAULT 'INV',
  quote_terms_days  integer NOT NULL DEFAULT 14,
  invoice_due_days  integer NOT NULL DEFAULT 7,
  logo_url          text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.business_settings (id, business_name, phone, email)
VALUES (1, 'Lanky Services', '0439 973 051', 'matt@lankyservices.com.au')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;

DROP POLICY IF EXISTS "Admins can read settings" ON public.business_settings;
CREATE POLICY "Admins can read settings" ON public.business_settings
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can update settings" ON public.business_settings;
CREATE POLICY "Admins can update settings" ON public.business_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Atomic per-financial-year document numbering
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_counters (
  doc_type    text NOT NULL,
  fy          integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, fy)
);
-- No direct grants to authenticated: allocation happens only through the
-- SECURITY DEFINER function below, which enforces admin access itself.
GRANT ALL ON public.document_counters TO service_role;

CREATE OR REPLACE FUNCTION public.next_document_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fy     integer := public.au_fy_start(current_date);
  v_num    integer;
  v_prefix text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.document_counters (doc_type, fy, last_number)
  VALUES (p_doc_type, v_fy, 0)
  ON CONFLICT (doc_type, fy) DO NOTHING;

  UPDATE public.document_counters
     SET last_number = last_number + 1
   WHERE doc_type = p_doc_type AND fy = v_fy
  RETURNING last_number INTO v_num;

  SELECT CASE p_doc_type
           WHEN 'quote'   THEN coalesce(quote_prefix, 'Q')
           WHEN 'invoice' THEN coalesce(invoice_prefix, 'INV')
           ELSE upper(substr(p_doc_type, 1, 3))
         END
    INTO v_prefix
    FROM public.business_settings
   LIMIT 1;

  RETURN coalesce(v_prefix, upper(substr(p_doc_type, 1, 3)))
         || '-' || v_fy::text
         || '-' || lpad(v_num::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Quotes + line items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text UNIQUE,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  customer_name    text NOT NULL,
  customer_email   text,
  customer_phone   text,
  customer_address text,
  suburb           text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','accepted','declined','expired','invoiced')),
  issue_date       date NOT NULL DEFAULT current_date,
  expiry_date      date,
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount       numeric(12,2) NOT NULL DEFAULT 0,
  total            numeric(12,2) NOT NULL DEFAULT 0,
  customer_notes   text,
  internal_notes   text,
  pdf_url          text,
  sent_at          timestamptz,
  accepted_at      timestamptz,
  xero_quote_id    text,
  xero_contact_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes (status);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(12,2) NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  line_total  numeric(12,2) NOT NULL DEFAULT 0,
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id, position);

-- ---------------------------------------------------------------------------
-- Invoices + line items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text UNIQUE,
  quote_id         uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  customer_name    text NOT NULL,
  customer_email   text,
  customer_phone   text,
  customer_address text,
  suburb           text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','paid','overdue','void')),
  issue_date       date NOT NULL DEFAULT current_date,
  due_date         date,
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount       numeric(12,2) NOT NULL DEFAULT 0,
  total            numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid      numeric(12,2) NOT NULL DEFAULT 0,
  paid_at          timestamptz,
  payment_method   text,
  customer_notes   text,
  internal_notes   text,
  pdf_url          text,
  sent_at          timestamptz,
  xero_invoice_id  text,
  xero_contact_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON public.invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_paid_at_idx ON public.invoices (paid_at);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(12,2) NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  line_total  numeric(12,2) NOT NULL DEFAULT 0,
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id, position);

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date   date NOT NULL DEFAULT current_date,
  category       text NOT NULL DEFAULT 'Other',
  description    text,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount     numeric(12,2),
  supplier       text,
  receipt_url    text,
  tax_deductible boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON public.expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses (category);

-- ---------------------------------------------------------------------------
-- Message / communications log (portal replies + quote/invoice sends)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  quote_id         uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id       uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  direction        text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  to_email         text,
  subject          text,
  body             text,
  email_status     text NOT NULL DEFAULT 'sent' CHECK (email_status IN ('sent','failed')),
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_quote_request_id_idx ON public.messages (quote_request_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS + grants for the admin-managed tables (identical pattern for each)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quotes','quote_items','invoices','invoice_items','expenses','messages'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I;', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %1$s" ON public.%1$I FOR ALL TO authenticated '
      || 'USING (public.is_admin()) WITH CHECK (public.is_admin());', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- keep updated_at fresh on the header tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_touch ON public.quotes;
CREATE TRIGGER quotes_touch BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS invoices_touch ON public.invoices;
CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS settings_touch ON public.business_settings;
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: generated PDFs (public-read, unguessable uuid keys) + receipts (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Receipts are admin-only (private bucket). Documents are written by the
-- server (service_role) and read publicly via their random URL.
DROP POLICY IF EXISTS "Admins manage receipts" ON storage.objects;
CREATE POLICY "Admins manage receipts" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'receipts' AND public.is_admin())
  WITH CHECK (bucket_id = 'receipts' AND public.is_admin());

DROP POLICY IF EXISTS "Admins manage documents" ON storage.objects;
CREATE POLICY "Admins manage documents" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());
