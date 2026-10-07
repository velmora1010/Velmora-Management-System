-- Migration: Add post_time column to influencer_post_dates_rows
ALTER TABLE public.influencer_post_dates_rows ADD COLUMN IF NOT EXISTS post_time text;
