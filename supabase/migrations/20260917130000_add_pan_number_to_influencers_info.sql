-- Migration: Add pan_number column to influencers_info_rows
ALTER TABLE public.influencers_info_rows 
ADD COLUMN IF NOT EXISTS pan_number TEXT;
