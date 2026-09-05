-- Migration: Add qr_image_url column to customer_tickets table
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS qr_image_url text;

-- Create storage bucket for customer ticket QR codes if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-qr-codes', 'ticket-qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Public SELECT policy for ticket-qr-codes bucket
CREATE POLICY "Allow public SELECT on ticket-qr-codes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ticket-qr-codes');

-- Public/Authenticated INSERT policy for ticket-qr-codes bucket
CREATE POLICY "Allow public INSERT on ticket-qr-codes"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'ticket-qr-codes');

-- Public/Authenticated UPDATE policy for ticket-qr-codes bucket
CREATE POLICY "Allow public UPDATE on ticket-qr-codes"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'ticket-qr-codes');

-- Public/Authenticated DELETE policy for ticket-qr-codes bucket
CREATE POLICY "Allow public DELETE on ticket-qr-codes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'ticket-qr-codes');
