-- Migration: Add payment details columns to influencers_info_rows
ALTER TABLE public.influencers_info_rows ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.influencers_info_rows ADD COLUMN IF NOT EXISTS account_holder_name text;
ALTER TABLE public.influencers_info_rows ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.influencers_info_rows ADD COLUMN IF NOT EXISTS ifsc_code text;
ALTER TABLE public.influencers_info_rows ADD COLUMN IF NOT EXISTS bank_name text;

-- Backfill payment_method for existing records that already have upi_number
UPDATE public.influencers_info_rows
SET payment_method = 'UPI'
WHERE upi_number IS NOT NULL
  AND TRIM(upi_number) != ''
  AND (payment_method IS NULL OR TRIM(payment_method) = '');
