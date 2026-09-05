-- Migration: Add storage policies for influencer-profiles bucket

DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on influencer-profiles"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'influencer-profiles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated INSERT on influencer-profiles"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'influencer-profiles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
