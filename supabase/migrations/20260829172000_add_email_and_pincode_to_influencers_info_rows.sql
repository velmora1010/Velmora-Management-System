-- Migration: Add email and pincode columns to influencers_info_rows
ALTER TABLE influencers_info_rows ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE influencers_info_rows ADD COLUMN IF NOT EXISTS pincode text;
