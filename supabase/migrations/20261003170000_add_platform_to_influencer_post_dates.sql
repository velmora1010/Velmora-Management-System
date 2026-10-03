-- Migration: Add platform and selected_platforms columns to influencer_post_dates_rows
-- Created: 2026-10-03

ALTER TABLE IF EXISTS influencer_post_dates_rows 
ADD COLUMN IF NOT EXISTS platform text,
ADD COLUMN IF NOT EXISTS selected_platforms text[];

-- Add index on (influencer_id, video_number) if not existing
CREATE INDEX IF NOT EXISTS idx_influencer_post_dates_inf_vid 
ON influencer_post_dates_rows (influencer_id, video_number);
