INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-payment-proofs', 'ticket-payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on ticket-payment-proofs"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'ticket-payment-proofs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public INSERT on ticket-payment-proofs"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'ticket-payment-proofs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public UPDATE on ticket-payment-proofs"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'ticket-payment-proofs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public DELETE on ticket-payment-proofs"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'ticket-payment-proofs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
