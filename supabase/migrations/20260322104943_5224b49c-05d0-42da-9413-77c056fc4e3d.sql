UPDATE storage.buckets SET public = true WHERE id = 'images';

CREATE POLICY "Public read access on images bucket"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'images');