-- ====================================================================
-- Production-Ready Material Batches Schema & Migration
-- ====================================================================

-- 1. Production-Ready Material Batches Table
CREATE TABLE IF NOT EXISTS public.production_ready_material_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode TEXT UNIQUE NOT NULL,
    scan_code TEXT UNIQUE NOT NULL,
    material_name TEXT NOT NULL,
    material_key TEXT,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_units_per_batch INTEGER NOT NULL,
    prepared_batch_no INTEGER NOT NULL,
    quantity_grams BIGINT NOT NULL,
    display_unit TEXT DEFAULT 'kg',
    status TEXT NOT NULL,
    prepared_by TEXT,
    prepared_at TIMESTAMPTZ DEFAULT NOW(),
    inventory_in_person TEXT,
    inventory_in_at TIMESTAMPTZ,
    inventory_out_person TEXT,
    inventory_out_at TIMESTAMPTZ,
    reserved_for_production_batch_id UUID,
    reserved_at TIMESTAMPTZ,
    issued_by TEXT,
    issued_at TIMESTAMPTZ,
    consumed_by TEXT,
    consumed_at TIMESTAMPTZ,
    cancelled_by TEXT,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing instances:
ALTER TABLE public.production_ready_material_batches
  ADD COLUMN IF NOT EXISTS inventory_in_person TEXT,
  ADD COLUMN IF NOT EXISTS inventory_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventory_out_person TEXT,
  ADD COLUMN IF NOT EXISTS inventory_out_at TIMESTAMPTZ;

-- 2. Multi-Lot FIFO Source Allocation Table
CREATE TABLE IF NOT EXISTS public.production_ready_batch_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_ready_batch_id UUID NOT NULL REFERENCES public.production_ready_material_batches(id) ON DELETE CASCADE,
    source_intake_id UUID REFERENCES public.raw_material_barcodes(id),
    allocated_quantity_grams BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Raw Material Stock Movements Audit Ledger
CREATE TABLE IF NOT EXISTS public.raw_material_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name TEXT NOT NULL,
    source_intake_id UUID,
    production_ready_batch_id UUID REFERENCES public.production_ready_material_batches(id) ON DELETE CASCADE,
    production_batch_id UUID,
    movement_type TEXT NOT NULL,
    quantity_grams BIGINT NOT NULL,
    balance_after_grams BIGINT,
    performed_by TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Indexing for high performance
CREATE INDEX IF NOT EXISTS idx_prp_batches_status ON public.production_ready_material_batches(status);
CREATE INDEX IF NOT EXISTS idx_prp_batches_scan_code ON public.production_ready_material_batches(scan_code);
CREATE INDEX IF NOT EXISTS idx_prp_batches_barcode ON public.production_ready_material_batches(barcode);
CREATE INDEX IF NOT EXISTS idx_prp_batches_prod_code ON public.production_ready_material_batches(product_code);
CREATE INDEX IF NOT EXISTS idx_prp_batches_mat_name ON public.production_ready_material_batches(material_name);
CREATE INDEX IF NOT EXISTS idx_prp_sources_batch_id ON public.production_ready_batch_sources(production_ready_batch_id);
