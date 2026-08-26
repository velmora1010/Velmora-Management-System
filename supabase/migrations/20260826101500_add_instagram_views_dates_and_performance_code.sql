-- Migration: Add video_views_dates and performance_code columns to influencer_platforms_details_rows
ALTER TABLE influencer_platforms_details_rows ADD COLUMN IF NOT EXISTS video_views_dates text[] DEFAULT '{}'::text[];
ALTER TABLE influencer_platforms_details_rows ADD COLUMN IF NOT EXISTS performance_code text;

