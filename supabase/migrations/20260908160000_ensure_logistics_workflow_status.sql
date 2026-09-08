-- Migration: Ensure index on campaign_id and dispatch_status for fast logistics workflow queries
CREATE INDEX IF NOT EXISTS idx_influencer_dispatch_campaign_status 
ON public.influencer_dispatch_details_rows (campaign_id, dispatch_status);
