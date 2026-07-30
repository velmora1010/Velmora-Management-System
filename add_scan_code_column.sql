-- Migration: Add scan_code column to public.product_barcodes
ALTER TABLE public.product_barcodes
ADD COLUMN IF NOT EXISTS scan_code text;

-- Add unique index on scan_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_barcodes_scan_code 
ON public.product_barcodes(scan_code) 
WHERE scan_code IS NOT NULL;
