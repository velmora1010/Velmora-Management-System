-- Migration: Add storage policies for influencer-profiles bucket

-- Allow SELECT (Read) access to all objects in the influencer-profiles bucket
CREATE POLICY "Allow public SELECT on influencer-profiles"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'influencer-profiles');

-- Allow INSERT (Upload) access to authenticated users in the influencer-profiles bucket
CREATE POLICY "Allow authenticated INSERT on influencer-profiles"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'influencer-profiles');
