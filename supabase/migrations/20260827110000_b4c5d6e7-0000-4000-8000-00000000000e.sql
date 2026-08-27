-- Remove the photo gallery feature (reverted).
DROP POLICY IF EXISTS "Public reads active photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Editors manage photos" ON public.gallery_photos;
DROP TABLE IF EXISTS public.gallery_photos;

DROP POLICY IF EXISTS "Editors manage gallery files" ON storage.objects;
DELETE FROM storage.objects WHERE bucket_id = 'gallery';
DELETE FROM storage.buckets WHERE id = 'gallery';
