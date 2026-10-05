-- Migration: Add platform and video tracking fields to influencer_tracking_links
-- Purpose: Enable multi-platform and multi-video UTM tracking generation per influencer

ALTER TABLE public.influencer_tracking_links 
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS platform_category text,
  ADD COLUMN IF NOT EXISTS video_number text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS creator_code text,
  ADD COLUMN IF NOT EXISTS base_product_url text;

-- Composite index for deduplication and fast queries
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_links_comp 
  ON public.influencer_tracking_links(campaign_id, influencer_id, product, platform, video_number);
