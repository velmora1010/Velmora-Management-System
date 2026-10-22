-- Migration: Add product_ids column to campaign_scripts for multi-product support
-- Safe and backward-compatible: preserves all existing single-product rows

ALTER TABLE public.campaign_scripts 
ADD COLUMN IF NOT EXISTS product_ids text[];

COMMENT ON COLUMN public.campaign_scripts.product_ids IS 'Array of product catalog IDs associated with this script';
