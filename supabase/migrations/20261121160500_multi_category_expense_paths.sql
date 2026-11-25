-- Checkpoint 3: Multi-Category Expense Database Migration
-- Additive, idempotent migration introducing:
--   1. public.expenses_row.row_version + BEFORE UPDATE trigger for optimistic concurrency
--   2. public.expense_category_paths supporting multiple 5-level category paths per expense
--   3. Read-only SELECT RLS policy on expense_category_paths (writes restricted to RPCs)
--   4. Dynamic, idempotent backfill of existing categorized expenses + diagnostic NOTICEs
--   5. Admin-authorized atomic RPCs:
--        - public.save_expense_with_category_paths(...)
--        - public.reset_expense_to_uncategorized(...)

BEGIN;

-- ============================================================================
-- 1. Optimistic Concurrency Column & Trigger on public.expenses_row
-- ============================================================================
ALTER TABLE public.expenses_row
  ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_expenses_row_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.row_version := COALESCE(OLD.row_version, 1) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_expenses_row_version ON public.expenses_row;
CREATE TRIGGER trg_bump_expenses_row_version
  BEFORE UPDATE ON public.expenses_row
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_expenses_row_version();

-- ============================================================================
-- 2. Child Table: public.expense_category_paths
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expense_category_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id BIGINT NOT NULL REFERENCES public.expenses_row(id) ON DELETE CASCADE,
  main_category TEXT NOT NULL,
  sub_category1 TEXT,
  sub_category2 TEXT,
  sub_category3 TEXT,
  sub_category3_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  path_signature TEXT NOT NULL,
  matched_rule_id UUID NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_category_paths_sub3_values_is_array
    CHECK (jsonb_typeof(sub_category3_values) = 'array'),
  CONSTRAINT expense_category_paths_sort_order_non_negative
    CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_category_paths_unique_path
  ON public.expense_category_paths (expense_id, path_signature);

CREATE INDEX IF NOT EXISTS idx_expense_category_paths_expense_sort
  ON public.expense_category_paths (expense_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_expense_category_paths_hierarchy
  ON public.expense_category_paths (main_category, sub_category1, sub_category2, sub_category3);

-- ============================================================================
-- 3. Normalization & Canonical Signature Helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_expense_level5_jsonb(
  p_values JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_values IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF jsonb_typeof(p_values) <> 'array' THEN
    RAISE EXCEPTION 'sub_category3_values must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_values) AS items(value)
    WHERE jsonb_typeof(items.value) <> 'string'
  ) THEN
    RAISE EXCEPTION 'sub_category3_values must contain string values only';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(val) ORDER BY val), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT DISTINCT btrim(items.value) AS val
    FROM jsonb_array_elements_text(p_values) AS items(value)
    WHERE btrim(items.value) <> ''
  ) dedup;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_expense_category_path_signature(
  p_main TEXT,
  p_sub1 TEXT,
  p_sub2 TEXT,
  p_sub3 TEXT,
  p_sub4_values JSONB
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_array(
    COALESCE(btrim(p_main), ''),
    COALESCE(btrim(p_sub1), ''),
    COALESCE(btrim(p_sub2), ''),
    COALESCE(btrim(p_sub3), ''),
    public.normalize_expense_level5_jsonb(p_sub4_values)
  )::TEXT;
$$;

-- ============================================================================
-- 4. Row-Level Security & Explicit Privileges on public.expense_category_paths
--    Read-only SELECT for authenticated users; mutations via authorized RPCs only.
-- ============================================================================
ALTER TABLE public.expense_category_paths ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.expense_category_paths FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.expense_category_paths TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read expense category paths" ON public.expense_category_paths;
CREATE POLICY "Authenticated users can read expense category paths"
  ON public.expense_category_paths
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.expenses_row e
      WHERE e.id = expense_category_paths.expense_id
    )
  );

-- ============================================================================
-- 5. Dynamic, Idempotent Backfill + Non-Destructive Diagnostics
-- ============================================================================
INSERT INTO public.expense_category_paths (
  expense_id,
  main_category,
  sub_category1,
  sub_category2,
  sub_category3,
  sub_category3_values,
  path_signature,
  sort_order
)
SELECT
  e.id,
  btrim(e.main_category),
  NULLIF(btrim(e.sub_category1), ''),
  NULLIF(btrim(e.sub_category2), ''),
  NULLIF(btrim(e.sub_category3), ''),
  CASE
    WHEN jsonb_typeof(e.sub_category3_values) = 'array' THEN
      CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(e.sub_category3_values) AS items(value)
          WHERE jsonb_typeof(items.value) <> 'string'
        ) THEN public.normalize_expense_level5_jsonb(e.sub_category3_values)
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb
  END,
  public.build_expense_category_path_signature(
    e.main_category,
    e.sub_category1,
    e.sub_category2,
    e.sub_category3,
    CASE
      WHEN jsonb_typeof(e.sub_category3_values) = 'array' THEN
        CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(e.sub_category3_values) AS items(value)
            WHERE jsonb_typeof(items.value) <> 'string'
          ) THEN e.sub_category3_values
          ELSE '[]'::jsonb
        END
      ELSE '[]'::jsonb
    END
  ),
  0
FROM public.expenses_row e
WHERE e.main_category IS NOT NULL
  AND btrim(e.main_category) <> ''
  AND e.main_category <> 'Uncategorized'
ON CONFLICT (expense_id, path_signature) DO NOTHING;

DO $$
DECLARE
  v_total_rows BIGINT;
  v_categorized_rows BIGINT;
  v_uncategorized_rows BIGINT;
  v_conflict_rows BIGINT;
  v_manual_rows BIGINT;
  v_backfilled_paths BIGINT;
  v_malformed_rows BIGINT;
  v_malformed_level5_rows BIGINT;
  v_legacy_unmatched_rows BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE main_category IS NOT NULL AND btrim(main_category) <> '' AND main_category <> 'Uncategorized'),
    COUNT(*) FILTER (WHERE main_category IS NULL OR btrim(main_category) = '' OR main_category = 'Uncategorized'),
    COUNT(*) FILTER (WHERE categorization_source = 'conflict'),
    COUNT(*) FILTER (WHERE manually_edited = TRUE),
    COUNT(*) FILTER (
      WHERE (NULLIF(btrim(sub_category2), '') IS NULL AND NULLIF(btrim(sub_category3), '') IS NOT NULL)
         OR (
           NULLIF(btrim(sub_category3), '') IS NULL
           AND CASE
             WHEN jsonb_typeof(sub_category3_values) = 'array' THEN jsonb_array_length(sub_category3_values) > 0
             ELSE FALSE
           END
         )
         OR (main_category IS NOT NULL AND btrim(main_category) <> '' AND main_category <> 'Uncategorized' AND NULLIF(btrim(sub_category1), '') IS NULL)
         OR CASE
           WHEN sub_category3_values IS NULL THEN FALSE
           WHEN jsonb_typeof(sub_category3_values) <> 'array' THEN TRUE
           ELSE EXISTS (
             SELECT 1
             FROM jsonb_array_elements(sub_category3_values) AS items(value)
             WHERE jsonb_typeof(items.value) <> 'string'
           )
         END
    ),
    COUNT(*) FILTER (
      WHERE CASE
        WHEN sub_category3_values IS NULL THEN FALSE
        WHEN jsonb_typeof(sub_category3_values) <> 'array' THEN TRUE
        ELSE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(sub_category3_values) AS items(value)
          WHERE jsonb_typeof(items.value) <> 'string'
        )
      END
    ),
    COUNT(*) FILTER (
      WHERE main_category IS NOT NULL
        AND btrim(main_category) <> ''
        AND main_category <> 'Uncategorized'
        AND (
          NOT EXISTS (
            SELECT 1
            FROM public.finance_categories_rows fc
            WHERE fc.status = 'active'
              AND fc.main = btrim(e.main_category)
              AND (NULLIF(btrim(e.sub_category1), '') IS NULL OR fc.sub1 = NULLIF(btrim(e.sub_category1), ''))
              AND (NULLIF(btrim(e.sub_category2), '') IS NULL OR fc.sub2 = NULLIF(btrim(e.sub_category2), ''))
              AND (NULLIF(btrim(e.sub_category3), '') IS NULL OR fc.sub3 = NULLIF(btrim(e.sub_category3), ''))
          )
          OR CASE
            WHEN jsonb_typeof(e.sub_category3_values) = 'array' THEN
              EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(e.sub_category3_values) AS items(value)
                WHERE btrim(items.value) <> ''
                  AND NOT EXISTS (
                    SELECT 1
                    FROM public.finance_categories_rows fc
                    WHERE fc.status = 'active'
                      AND fc.main = btrim(e.main_category)
                      AND fc.sub1 = NULLIF(btrim(e.sub_category1), '')
                      AND fc.sub2 = NULLIF(btrim(e.sub_category2), '')
                      AND fc.sub3 = NULLIF(btrim(e.sub_category3), '')
                      AND fc.sub_sub_sub_category = btrim(items.value)
                  )
              )
            ELSE FALSE
          END
        )
    )
  INTO
    v_total_rows,
    v_categorized_rows,
    v_uncategorized_rows,
    v_conflict_rows,
    v_manual_rows,
    v_malformed_rows,
    v_malformed_level5_rows,
    v_legacy_unmatched_rows
  FROM public.expenses_row e;

  SELECT COUNT(*) INTO v_backfilled_paths FROM public.expense_category_paths;

  RAISE NOTICE '[Multi-Category Backfill] total=%, categorized=%, uncategorized=%, conflicts=%, manually_edited=%, paths_in_table=%, malformed_paths=%, malformed_level5_jsonb=%, legacy_unmatched=%',
    v_total_rows, v_categorized_rows, v_uncategorized_rows, v_conflict_rows, v_manual_rows, v_backfilled_paths, v_malformed_rows, v_malformed_level5_rows, v_legacy_unmatched_rows;
END $$;

-- ============================================================================
-- 6. Atomic Save RPC (Requires >= 1 Valid Category Path)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_expense_with_category_paths(
  p_expense_id BIGINT,
  p_expected_row_version BIGINT,
  p_expense_updates JSONB,
  p_category_paths JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_is_enabled BOOLEAN;
  v_expense public.expenses_row%ROWTYPE;
  v_updates JSONB;
  v_key TEXT;
  v_path JSONB;
  v_path_key TEXT;
  v_idx INTEGER := 0;
  v_main TEXT;
  v_sub1 TEXT;
  v_sub2 TEXT;
  v_sub3 TEXT;
  v_sub4 JSONB;
  v_sig TEXT;
  v_first_main TEXT;
  v_first_sub1 TEXT;
  v_first_sub2 TEXT;
  v_first_sub3 TEXT;
  v_first_sub4 JSONB;
  v_new_amount DOUBLE PRECISION;
  v_paths_out JSONB := '[]'::jsonb;
BEGIN
  -- 6a. Explicit Admin authorization against public.user_profiles
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT up.role, up.is_enabled
  INTO v_role, v_is_enabled
  FROM public.user_profiles up
  WHERE up.id = v_uid;

  IF NOT FOUND OR v_is_enabled IS DISTINCT FROM TRUE OR v_role IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Forbidden: active Admin role required to modify expense categories';
  END IF;

  -- 6b. Lock target active expense row and verify optimistic concurrency version
  SELECT * INTO v_expense
  FROM public.expenses_row
  WHERE id = p_expense_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active expense % not found', p_expense_id;
  END IF;

  IF p_expected_row_version IS NULL OR v_expense.row_version <> p_expected_row_version THEN
    RAISE EXCEPTION 'Stale expense record (expected row_version %, current %). Please refresh and retry.',
      p_expected_row_version, v_expense.row_version
      USING ERRCODE = '40001';
  END IF;

  -- 6c. Validate p_expense_updates whitelist
  v_updates := COALESCE(p_expense_updates, '{}'::jsonb);
  IF jsonb_typeof(v_updates) <> 'object' THEN
    RAISE EXCEPTION 'p_expense_updates must be a JSON object';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_updates)
  LOOP
    IF v_key NOT IN (
      'amount', 'quantity', 'vendor', 'gst_status',
      'payment_mode', 'bank_account', 'purchased_by', 'approved_by', 'notes'
    ) THEN
      RAISE EXCEPTION 'Unsupported or protected field in p_expense_updates: %', v_key;
    END IF;
  END LOOP;

  IF v_updates ? 'amount' THEN
    IF v_expense.import_batch_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot modify amount of an imported bank transaction';
    END IF;
    v_new_amount := NULLIF(btrim(v_updates->>'amount'), '')::DOUBLE PRECISION;
    IF v_new_amount IS NULL
       OR v_new_amount = 'NaN'::DOUBLE PRECISION
       OR v_new_amount = 'Infinity'::DOUBLE PRECISION
       OR v_new_amount = '-Infinity'::DOUBLE PRECISION
       OR v_new_amount <= 0 THEN
      RAISE EXCEPTION 'Manual expense amount must be a finite number greater than zero';
    END IF;
  END IF;

  -- 6d. Validate p_category_paths (must be non-empty array for normal save)
  IF p_category_paths IS NULL OR jsonb_typeof(p_category_paths) <> 'array' THEN
    RAISE EXCEPTION 'p_category_paths must be a JSON array';
  END IF;

  IF jsonb_array_length(p_category_paths) = 0 THEN
    RAISE EXCEPTION 'At least one category path is required. Use reset_expense_to_uncategorized to clear categories.';
  END IF;

  -- Replace child paths atomically
  DELETE FROM public.expense_category_paths WHERE expense_id = p_expense_id;

  FOR v_path IN SELECT items.value FROM jsonb_array_elements(p_category_paths) AS items(value)
  LOOP
    IF jsonb_typeof(v_path) <> 'object' THEN
      RAISE EXCEPTION 'Each category path entry must be a JSON object';
    END IF;

    FOR v_path_key IN SELECT jsonb_object_keys(v_path)
    LOOP
      IF v_path_key NOT IN (
        'main_category', 'sub_category1', 'sub_category2', 'sub_category3', 'sub_category3_values'
      ) THEN
        RAISE EXCEPTION 'Unsupported field in category path: %', v_path_key;
      END IF;
    END LOOP;

    v_main := NULLIF(btrim(v_path->>'main_category'), '');
    v_sub1 := NULLIF(btrim(v_path->>'sub_category1'), '');
    v_sub2 := NULLIF(btrim(v_path->>'sub_category2'), '');
    v_sub3 := NULLIF(btrim(v_path->>'sub_category3'), '');
    v_sub4 := public.normalize_expense_level5_jsonb(v_path->'sub_category3_values');

    IF v_main IS NULL OR v_sub1 IS NULL THEN
      RAISE EXCEPTION 'Each category path requires Department (main_category) and Category (sub_category1)';
    END IF;

    IF v_sub3 IS NOT NULL AND v_sub2 IS NULL THEN
      RAISE EXCEPTION 'Cannot specify Sub Category 2 without Sub Category 1';
    END IF;

    IF jsonb_array_length(v_sub4) > 0 AND (v_sub2 IS NULL OR v_sub3 IS NULL) THEN
      RAISE EXCEPTION 'Cannot specify Level 5 values without Sub Category 1 and Sub Category 2';
    END IF;

    -- Exact full-chain validation against active finance_categories_rows
    IF NOT EXISTS (
      SELECT 1
      FROM public.finance_categories_rows fc
      WHERE fc.status = 'active'
        AND fc.main = v_main
        AND fc.sub1 = v_sub1
        AND (v_sub2 IS NULL OR fc.sub2 = v_sub2)
        AND (v_sub3 IS NULL OR fc.sub3 = v_sub3)
    ) THEN
      RAISE EXCEPTION 'Invalid Finance category hierarchy: % / % / % / %',
        v_main, v_sub1, COALESCE(v_sub2, ''), COALESCE(v_sub3, '');
    END IF;

    IF jsonb_array_length(v_sub4) > 0 THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_sub4) AS items(value)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.finance_categories_rows fc
          WHERE fc.status = 'active'
            AND fc.main = v_main
            AND fc.sub1 = v_sub1
            AND fc.sub2 = v_sub2
            AND fc.sub3 = v_sub3
            AND fc.sub_sub_sub_category = items.value
        )
      ) THEN
        RAISE EXCEPTION 'Invalid Level 5 (sub_sub_sub_category) selection under % / % / % / %',
          v_main, v_sub1, v_sub2, v_sub3;
      END IF;
    END IF;

    v_sig := public.build_expense_category_path_signature(v_main, v_sub1, v_sub2, v_sub3, v_sub4);

    BEGIN
      INSERT INTO public.expense_category_paths (
        expense_id,
        main_category,
        sub_category1,
        sub_category2,
        sub_category3,
        sub_category3_values,
        path_signature,
        sort_order
      ) VALUES (
        p_expense_id,
        v_main,
        v_sub1,
        v_sub2,
        v_sub3,
        v_sub4,
        v_sig,
        v_idx
      );
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate category path submitted for expense %: %', p_expense_id, v_sig;
    END;

    IF v_idx = 0 THEN
      v_first_main := v_main;
      v_first_sub1 := v_sub1;
      v_first_sub2 := v_sub2;
      v_first_sub3 := v_sub3;
      v_first_sub4 := v_sub4;
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- 6e. Single UPDATE on expenses_row (trigger increments row_version exactly once)
  UPDATE public.expenses_row
  SET
    amount = CASE WHEN v_updates ? 'amount' THEN v_new_amount ELSE amount END,
    quantity = CASE WHEN v_updates ? 'quantity' THEN NULLIF(btrim(v_updates->>'quantity'), '')::BIGINT ELSE quantity END,
    vendor = CASE WHEN v_updates ? 'vendor' THEN NULLIF(v_updates->>'vendor', '') ELSE vendor END,
    gst_status = CASE WHEN v_updates ? 'gst_status' THEN NULLIF(v_updates->>'gst_status', '') ELSE gst_status END,
    payment_mode = CASE WHEN v_updates ? 'payment_mode' THEN NULLIF(v_updates->>'payment_mode', '') ELSE payment_mode END,
    bank_account = CASE WHEN v_updates ? 'bank_account' THEN NULLIF(v_updates->>'bank_account', '') ELSE bank_account END,
    purchased_by = CASE WHEN v_updates ? 'purchased_by' THEN NULLIF(v_updates->>'purchased_by', '') ELSE purchased_by END,
    approved_by = CASE WHEN v_updates ? 'approved_by' THEN NULLIF(v_updates->>'approved_by', '') ELSE approved_by END,
    notes = CASE WHEN v_updates ? 'notes' THEN v_updates->>'notes' ELSE notes END,
    main_category = v_first_main,
    sub_category1 = v_first_sub1,
    sub_category2 = v_first_sub2,
    sub_category3 = v_first_sub3,
    sub_category3_values = v_first_sub4,
    manually_edited = TRUE,
    categorization_source = 'manual'
  WHERE id = p_expense_id
  RETURNING * INTO v_expense;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.sort_order), '[]'::jsonb)
  INTO v_paths_out
  FROM public.expense_category_paths p
  WHERE p.expense_id = p_expense_id;

  RETURN jsonb_build_object(
    'expense', to_jsonb(v_expense),
    'category_paths', v_paths_out,
    'row_version', v_expense.row_version
  );
END;
$$;

-- ============================================================================
-- 7. Explicit Intentional Reset-to-Uncategorized RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_expense_to_uncategorized(
  p_expense_id BIGINT,
  p_expected_row_version BIGINT,
  p_expense_updates JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_is_enabled BOOLEAN;
  v_expense public.expenses_row%ROWTYPE;
  v_updates JSONB;
  v_key TEXT;
  v_new_amount DOUBLE PRECISION;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT up.role, up.is_enabled
  INTO v_role, v_is_enabled
  FROM public.user_profiles up
  WHERE up.id = v_uid;

  IF NOT FOUND OR v_is_enabled IS DISTINCT FROM TRUE OR v_role IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Forbidden: active Admin role required to reset expense categories';
  END IF;

  SELECT * INTO v_expense
  FROM public.expenses_row
  WHERE id = p_expense_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active expense % not found', p_expense_id;
  END IF;

  IF p_expected_row_version IS NULL OR v_expense.row_version <> p_expected_row_version THEN
    RAISE EXCEPTION 'Stale expense record (expected row_version %, current %). Please refresh and retry.',
      p_expected_row_version, v_expense.row_version
      USING ERRCODE = '40001';
  END IF;

  v_updates := COALESCE(p_expense_updates, '{}'::jsonb);
  IF jsonb_typeof(v_updates) <> 'object' THEN
    RAISE EXCEPTION 'p_expense_updates must be a JSON object';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_updates)
  LOOP
    IF v_key NOT IN (
      'amount', 'quantity', 'vendor', 'gst_status',
      'payment_mode', 'bank_account', 'purchased_by', 'approved_by', 'notes'
    ) THEN
      RAISE EXCEPTION 'Unsupported or protected field in p_expense_updates: %', v_key;
    END IF;
  END LOOP;

  IF v_updates ? 'amount' THEN
    IF v_expense.import_batch_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot modify amount of an imported bank transaction';
    END IF;
    v_new_amount := NULLIF(btrim(v_updates->>'amount'), '')::DOUBLE PRECISION;
    IF v_new_amount IS NULL
       OR v_new_amount = 'NaN'::DOUBLE PRECISION
       OR v_new_amount = 'Infinity'::DOUBLE PRECISION
       OR v_new_amount = '-Infinity'::DOUBLE PRECISION
       OR v_new_amount <= 0 THEN
      RAISE EXCEPTION 'Manual expense amount must be a finite number greater than zero';
    END IF;
  END IF;

  DELETE FROM public.expense_category_paths WHERE expense_id = p_expense_id;

  UPDATE public.expenses_row
  SET
    amount = CASE WHEN v_updates ? 'amount' THEN v_new_amount ELSE amount END,
    quantity = CASE WHEN v_updates ? 'quantity' THEN NULLIF(btrim(v_updates->>'quantity'), '')::BIGINT ELSE quantity END,
    vendor = CASE WHEN v_updates ? 'vendor' THEN NULLIF(v_updates->>'vendor', '') ELSE vendor END,
    gst_status = CASE WHEN v_updates ? 'gst_status' THEN NULLIF(v_updates->>'gst_status', '') ELSE gst_status END,
    payment_mode = CASE WHEN v_updates ? 'payment_mode' THEN NULLIF(v_updates->>'payment_mode', '') ELSE payment_mode END,
    bank_account = CASE WHEN v_updates ? 'bank_account' THEN NULLIF(v_updates->>'bank_account', '') ELSE bank_account END,
    purchased_by = CASE WHEN v_updates ? 'purchased_by' THEN NULLIF(v_updates->>'purchased_by', '') ELSE purchased_by END,
    approved_by = CASE WHEN v_updates ? 'approved_by' THEN NULLIF(v_updates->>'approved_by', '') ELSE approved_by END,
    notes = CASE WHEN v_updates ? 'notes' THEN v_updates->>'notes' ELSE notes END,
    main_category = 'Uncategorized',
    sub_category1 = NULL,
    sub_category2 = NULL,
    sub_category3 = NULL,
    sub_category3_values = '[]'::jsonb,
    manually_edited = TRUE,
    categorization_source = 'manual'
  WHERE id = p_expense_id
  RETURNING * INTO v_expense;

  RETURN jsonb_build_object(
    'expense', to_jsonb(v_expense),
    'category_paths', '[]'::jsonb,
    'row_version', v_expense.row_version
  );
END;
$$;

-- ============================================================================
-- 8. Privileges
-- ============================================================================
REVOKE ALL ON FUNCTION public.save_expense_with_category_paths(BIGINT, BIGINT, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_expense_to_uncategorized(BIGINT, BIGINT, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_expense_with_category_paths(BIGINT, BIGINT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_expense_to_uncategorized(BIGINT, BIGINT, JSONB) TO authenticated;

COMMIT;
