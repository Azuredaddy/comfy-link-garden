-- Quote/invoice discounts + a reusable saved price list (products).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed Lanky's current price list (only when the table is empty, so re-runs are safe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products) THEN
    INSERT INTO public.products (name, description, unit_price, position) VALUES
      ('Base Booking Fee', 'Initial call-out fee covering booking administration and equipment preparation.', 110, 0),
      ('Standard Removal Labour', 'Professional loading, unloading and heavy lifting services by Lanky Services.', 55, 1),
      ('Standard Labour', 'Standard labour, per hour.', 60, 2),
      ('Tip Fee', 'Per 200kg or less.', 110, 3),
      ('Van & Travel Fee', 'Distance-based fee (per km) covering fuel, maintenance and vehicle wear for the transport van.', 1.45, 4),
      ('Van & Travel Fee (first 30km free)', 'Distance-based fee (per km) after the first 30km free.', 1.45, 5),
      ('Disassembly & Reassembly Fee', 'Disassembly and reassembly of items as required.', 45, 6),
      ('Fuel Levy', 'Fuel levy.', 56, 7);
  END IF;
END $$;
