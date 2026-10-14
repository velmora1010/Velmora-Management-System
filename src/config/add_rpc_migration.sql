-- Add preparation_group_id column to raw_material_barcodes
ALTER TABLE public.raw_material_barcodes
  ADD COLUMN IF NOT EXISTS preparation_group_id uuid;

-- Index for idempotency queries
CREATE INDEX IF NOT EXISTS idx_rmb_prep_group ON public.raw_material_barcodes (preparation_group_id);

-- Atomic Concurrency-Safe RPC Transaction
CREATE OR REPLACE FUNCTION public.create_production_ready_packs(
  p_material_name text,
  p_material_code text,
  p_product_code text,
  p_product_name text,
  p_quantity numeric,
  p_quantity_grams bigint,
  p_pack_count integer,
  p_vendor text,
  p_prepared_by text,
  p_po_reference text,
  p_date_code text,
  p_preparation_group_id uuid
)
RETURNS SETOF public.raw_material_barcodes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text;
  v_max_seq integer := 0;
  v_cur_seq integer;
  v_i integer;
  v_seq_str text;
  v_barcode text;
  v_batch_no text;
  v_now timestamptz := now();
  v_existing_count integer;
BEGIN
  -- Idempotency check: if preparation_group_id already exists, return existing rows
  IF p_preparation_group_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_count 
    FROM public.raw_material_barcodes 
    WHERE preparation_group_id = p_preparation_group_id;

    IF v_existing_count > 0 THEN
      RETURN QUERY 
      SELECT * 
      FROM public.raw_material_barcodes 
      WHERE preparation_group_id = p_preparation_group_id
      ORDER BY prepared_batch_no ASC;
      RETURN;
    END IF;
  END IF;

  -- Build exact prefix: PRP-{p_material_code}-{p_product_code}-{p_date_code}-
  v_prefix := 'PRP-' || p_material_code || '-' || p_product_code || '-' || p_date_code || '-';

  -- Query max sequence for this exact scope
  SELECT COALESCE(
    MAX(
      NULLIF(
        REGEXP_REPLACE(barcode, '^.*-(\d+)$', '\1'),
        barcode
      )::integer
    ), 0
  ) INTO v_max_seq
  FROM public.raw_material_barcodes
  WHERE barcode LIKE v_prefix || '%';

  -- Generate and insert next unique values
  v_cur_seq := v_max_seq;
  
  FOR v_i IN 1..p_pack_count LOOP
    v_cur_seq := v_cur_seq + 1;
    v_seq_str := LPAD(v_cur_seq::text, 3, '0');
    v_barcode := v_prefix || v_seq_str;
    v_batch_no := 'PRP-' || p_date_code || '-' || v_seq_str;

    INSERT INTO public.raw_material_barcodes (
      id,
      barcode,
      material_name,
      batch_no,
      vendor,
      quantity,
      unit,
      price_per_kg,
      gst_percent,
      generated_by,
      current_stage,
      created_at,
      updated_at,
      received_date,
      po_reference,
      scanning_person_name,
      product_code,
      product_name,
      quantity_grams,
      prepared_by,
      prepared_batch_no,
      preparation_group_id
    ) VALUES (
      gen_random_uuid(),
      v_barcode,
      p_material_name,
      v_batch_no,
      p_vendor,
      p_quantity,
      'kg',
      0,
      0,
      p_prepared_by,
      'Incoming',
      v_now,
      v_now,
      v_now,
      p_po_reference,
      p_prepared_by,
      p_product_code,
      p_product_name,
      p_quantity_grams,
      p_prepared_by,
      v_i,
      p_preparation_group_id
    );
  END LOOP;

  -- Refresh schema cache notification
  NOTIFY pgrst, 'reload schema';

  RETURN QUERY 
  SELECT * 
  FROM public.raw_material_barcodes 
  WHERE preparation_group_id = p_preparation_group_id
  ORDER BY prepared_batch_no ASC;
END;
$$;
