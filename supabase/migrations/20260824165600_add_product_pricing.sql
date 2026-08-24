-- Migration: Add product_pricing JSONB column to influencer_pricing_rows
ALTER TABLE influencer_pricing_rows ADD COLUMN IF NOT EXISTS product_pricing JSONB DEFAULT '{}'::jsonb;
