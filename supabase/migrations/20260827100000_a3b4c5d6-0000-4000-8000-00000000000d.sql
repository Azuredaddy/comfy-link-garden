-- Photo gallery: admin uploads job photos that show on the website.
CREATE TABLE IF NOT EXISTS public.gallery_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text NOT NULL,
  caption    text,
  position   integer NOT NULL DEFAULT 0,
  show_home  boolean NOT NULL DEFAULT true,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_photos_pos_idx ON public.gallery_photos (position, created_at);

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gallery_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gallery_photos TO authenticated;
GRANT ALL ON public.gallery_photos TO service_role;

-- Anyone (website visitors) can read the active photos.
DROP POLICY IF EXISTS "Public reads active photos" ON public.gallery_photos;
CREATE POLICY "Public reads active photos" ON public.gallery_photos
  FOR SELECT TO anon, authenticated USING (active = true);
-- Editors/admins manage them.
DROP POLICY IF EXISTS "Editors manage photos" ON public.gallery_photos;
CREATE POLICY "Editors manage photos" ON public.gallery_photos
  FOR ALL TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());

-- Public bucket for the images (unguessable keys; public read).
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true)
  ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Editors manage gallery files" ON storage.objects;
CREATE POLICY "Editors manage gallery files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'gallery' AND public.can_edit())
  WITH CHECK (bucket_id = 'gallery' AND public.can_edit());
