-- Migration: Add draft_time column to influencer_post_dates_rows
-- Created: 2026-10-06

ALTER TABLE IF EXISTS public.influencer_post_dates_rows 
ADD COLUMN IF NOT EXISTS draft_time time;
