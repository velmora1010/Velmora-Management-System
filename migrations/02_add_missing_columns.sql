-- 02_add_missing_columns.sql
ALTER TABLE public.raw_material_barcodes
ADD COLUMN IF NOT EXISTS po_reference text,
ADD COLUMN IF NOT EXISTS scanning_person_name text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS received_date timestamptz;
