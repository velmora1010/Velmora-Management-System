-- Migration: Add average column to influencer_platforms_details_rows
ALTER TABLE influencer_platforms_details_rows ADD COLUMN IF NOT EXISTS average numeric;
