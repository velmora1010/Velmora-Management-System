-- ====================================================================
-- Migration: Add Production-Ready workflow columns to raw_material_barcodes
-- Safe: uses ADD COLUMN IF NOT EXISTS
-- ====================================================================

ALTER TABLE public.raw_material_barcodes
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS reserved_for_production_batch_id uuid,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_by text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_by text,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS quantity_grams bigint,
  ADD COLUMN IF NOT EXISTS prepared_by text,
  ADD COLUMN IF NOT EXISTS prepared_batch_no integer;

-- Indexes for production-ready lookup performance
CREATE INDEX IF NOT EXISTS idx_rmb_barcode_prefix ON public.raw_material_barcodes (barcode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_rmb_current_stage ON public.raw_material_barcodes (current_stage);
CREATE INDEX IF NOT EXISTS idx_rmb_product_code ON public.raw_material_barcodes (product_code);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
