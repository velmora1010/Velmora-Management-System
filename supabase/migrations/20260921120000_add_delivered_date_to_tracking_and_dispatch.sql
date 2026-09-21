-- Migration: Add delivered_date and remarks to influencer_tracking_shipments and influencer_dispatch_details_rows
ALTER TABLE IF EXISTS public.influencer_tracking_shipments
  ADD COLUMN IF NOT EXISTS delivered_date text;

ALTER TABLE IF EXISTS public.influencer_tracking_shipments
  ADD COLUMN IF NOT EXISTS remarks text;

ALTER TABLE IF EXISTS public.influencer_dispatch_details_rows
  ADD COLUMN IF NOT EXISTS delivered_date text;

ALTER TABLE IF EXISTS public.influencer_dispatch_details_rows
  ADD COLUMN IF NOT EXISTS remarks text;

-- Create index on delivered_date for fast filtering/queries
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_shipments_delivered_date
  ON public.influencer_tracking_shipments(delivered_date);
