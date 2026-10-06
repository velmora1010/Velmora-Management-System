-- Migration: Add thumbnail_path and thumbnail_url to influencer_post_dates_rows
-- Purpose: Persist video-specific selected thumbnail image for Post Date step
-- Created: 2026-10-06

ALTER TABLE IF EXISTS public.influencer_post_dates_rows 
ADD COLUMN IF NOT EXISTS thumbnail_path text,
ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Add index on (influencer_id, video_number) if not existing
CREATE INDEX IF NOT EXISTS idx_influencer_post_dates_inf_vid 
ON public.influencer_post_dates_rows (influencer_id, video_number);
