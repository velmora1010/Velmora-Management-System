-- Migration: Add universal scan_code column and unique indexes across all barcode tables
ALTER TABLE public.raw_material_barcodes ADD COLUMN IF NOT EXISTS scan_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rm_barcodes_scan_code ON public.raw_material_barcodes(scan_code) WHERE scan_code IS NOT NULL;

ALTER TABLE public.product_barcodes ADD COLUMN IF NOT EXISTS scan_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_barcodes_scan_code ON public.product_barcodes(scan_code) WHERE scan_code IS NOT NULL;

ALTER TABLE public.combo_boxes ADD COLUMN IF NOT EXISTS scan_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_combo_boxes_scan_code ON public.combo_boxes(scan_code) WHERE scan_code IS NOT NULL;

ALTER TABLE public.qc_barcodes ADD COLUMN IF NOT EXISTS scan_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_qc_barcodes_scan_code ON public.qc_barcodes(scan_code) WHERE scan_code IS NOT NULL;
