-- Migration: Add qr_image_url column to customer_tickets table
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS qr_image_url text;

-- Create storage bucket for customer ticket QR codes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-qr-codes', 'ticket-qr-codes', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on ticket-qr-codes"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'ticket-qr-codes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public INSERT on ticket-qr-codes"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'ticket-qr-codes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public UPDATE on ticket-qr-codes"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'ticket-qr-codes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public DELETE on ticket-qr-codes"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'ticket-qr-codes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
