CREATE OR REPLACE FUNCTION public.au_fy_start(d date)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN extract(month FROM d) >= 7
              THEN extract(year FROM d)::int
              ELSE extract(year FROM d)::int - 1 END;
$$;

REVOKE EXECUTE ON FUNCTION public.au_fy_start(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;