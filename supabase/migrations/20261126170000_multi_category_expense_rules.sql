-- Multi-Category Expense Automation Rules (V4 Extension)
-- 1. Child table: public.expense_rule_category_paths
-- 2. Idempotent backfill for all existing single-path rules
-- 3. RPC: public.save_expense_rule_with_paths()
-- 4. Compatible 7-arg replacement for public.sync_automated_expense_category_path()

BEGIN;

-- ============================================================================
-- 1. Child Table: public.expense_rule_category_paths
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expense_rule_category_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.expense_rules(id) ON DELETE CASCADE,
  main_category TEXT NOT NULL,
  sub_category1 TEXT,
  sub_category2 TEXT,
  sub_category3 TEXT,
  sub_category3_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  path_signature TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_rule_category_paths_sub3_values_is_array
    CHECK (jsonb_typeof(sub_category3_values) = 'array'),
  CONSTRAINT expense_rule_category_paths_sort_order_non_negative
    CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_rule_category_paths_unique
  ON public.expense_rule_category_paths (rule_id, path_signature);

CREATE INDEX IF NOT EXISTS idx_expense_rule_category_paths_rule_sort
  ON public.expense_rule_category_paths (rule_id, sort_order);

-- ============================================================================
-- 2. Row-Level Security & Explicit Privileges
-- ============================================================================
ALTER TABLE public.expense_rule_category_paths ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.expense_rule_category_paths FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.expense_rule_category_paths TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read expense rule category paths" ON public.expense_rule_category_paths;
CREATE POLICY "Authenticated users can read expense rule category paths"
  ON public.expense_rule_category_paths
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.expense_rules r
      WHERE r.id = expense_rule_category_paths.rule_id
    )
  );

-- ============================================================================
-- 3. Idempotent Backfill from Existing Single-Path Rules
-- ============================================================================
INSERT INTO public.expense_rule_category_paths (
  rule_id,
  main_category,
  sub_category1,
  sub_category2,
  sub_category3,
  sub_category3_values,
  path_signature,
  sort_order
)
SELECT
  r.id,
  btrim(r.department),
  NULLIF(btrim(r.category), ''),
  NULLIF(btrim(r.sub_category1), ''),
  NULLIF(btrim(r.sub_category2), ''),
  public.normalize_expense_level5_jsonb(COALESCE(to_jsonb(r.sub_category3_values), '[]'::jsonb)),
  public.build_expense_category_path_signature(
    r.department,
    r.category,
    r.sub_category1,
    r.sub_category2,
    COALESCE(to_jsonb(r.sub_category3_values), '[]'::jsonb)
  ),
  0
FROM public.expense_rules r
WHERE r.department IS NOT NULL
  AND btrim(r.department) <> ''
  AND r.department <> 'Uncategorized'
  AND r.category IS NOT NULL
  AND btrim(r.category) <> ''
ON CONFLICT (rule_id, path_signature) DO NOTHING;

-- ============================================================================
-- 4. RPC: public.save_expense_rule_with_paths()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_expense_rule_with_paths(
  p_keyword TEXT,
  p_category_paths JSONB,
  p_vendor TEXT DEFAULT NULL,
  p_payment_mode TEXT DEFAULT NULL,
  p_gst_status TEXT DEFAULT NULL,
  p_purchased_by TEXT DEFAULT NULL,
  p_approved_by TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_priority INTEGER DEFAULT 50,
  p_rule_id UUID DEFAULT NULL,
  p_update_existing BOOLEAN DEFAULT FALSE
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
  v_tokens TEXT[];
  v_signature TEXT;
  v_canonical_keyword TEXT;
  v_existing public.expense_rules%ROWTYPE;
  v_rule public.expense_rules%ROWTYPE;
  v_path JSONB;
  v_idx INTEGER := 0;
  v_main TEXT;
  v_sub1 TEXT;
  v_sub2 TEXT;
  v_sub3 TEXT;
  v_sub4 JSONB;
  v_path_sig TEXT;
  v_seen_sigs TEXT[] := '{}'::TEXT[];
  v_first_main TEXT;
  v_first_sub1 TEXT;
  v_first_sub2 TEXT;
  v_first_sub3 TEXT;
  v_first_sub4 TEXT[] := '{}'::TEXT[];
  v_paths_out JSONB := '[]'::jsonb;
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
    RAISE EXCEPTION 'Forbidden: active Admin role required to manage expense rules';
  END IF;

  IF p_category_paths IS NULL OR jsonb_typeof(p_category_paths) <> 'array' OR jsonb_array_length(p_category_paths) = 0 THEN
    RAISE EXCEPTION 'At least one category path is required';
  END IF;

  v_tokens := public.normalize_expense_rule_keywords(p_keyword);
  IF v_tokens IS NULL OR cardinality(v_tokens) = 0 THEN
    RAISE EXCEPTION 'At least one valid keyword token is required';
  END IF;
  v_signature := array_to_string(v_tokens, '/');
  v_canonical_keyword := v_signature;

  -- Validate all paths upfront before any write
  FOR v_path IN SELECT value FROM jsonb_array_elements(p_category_paths)
  LOOP
    v_main := btrim(COALESCE(v_path->>'main_category', ''));
    v_sub1 := NULLIF(btrim(COALESCE(v_path->>'sub_category1', '')), '');
    v_sub2 := NULLIF(btrim(COALESCE(v_path->>'sub_category2', '')), '');
    v_sub3 := NULLIF(btrim(COALESCE(v_path->>'sub_category3', '')), '');
    v_sub4 := public.normalize_expense_level5_jsonb(COALESCE(v_path->'sub_category3_values', '[]'::jsonb));

    IF v_main = '' OR v_main = 'Uncategorized' OR v_sub1 IS NULL THEN
      RAISE EXCEPTION 'Each rule category path requires Department and Category';
    END IF;
    IF v_sub3 IS NOT NULL AND v_sub2 IS NULL THEN
      RAISE EXCEPTION 'Cannot specify Sub Category 2 without Sub Category 1';
    END IF;
    IF jsonb_array_length(v_sub4) > 0 AND (v_sub2 IS NULL OR v_sub3 IS NULL) THEN
      RAISE EXCEPTION 'Cannot specify Sub Category 3 values without Sub Category 1 and Sub Category 2';
    END IF;

    v_path_sig := public.build_expense_category_path_signature(v_main, v_sub1, v_sub2, v_sub3, v_sub4);
    IF v_path_sig = ANY(v_seen_sigs) THEN
      RAISE EXCEPTION 'Duplicate category path in rule payload';
    END IF;
    v_seen_sigs := array_append(v_seen_sigs, v_path_sig);

    IF v_idx = 0 THEN
      v_first_main := v_main;
      v_first_sub1 := v_sub1;
      v_first_sub2 := v_sub2;
      v_first_sub3 := v_sub3;
      v_first_sub4 := COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_sub4)),
        '{}'::TEXT[]
      );
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF p_rule_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.expense_rules
    WHERE id = p_rule_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_existing
    FROM public.expense_rules
    WHERE keyword_signature = v_signature
    FOR UPDATE;
  END IF;

  IF FOUND THEN
    IF p_update_existing IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Rule with keyword_signature "%" already exists (id: %)', v_signature, v_existing.id;
    END IF;

    -- Preserve is_active, priority, keyword/keyword_signature, and existing metadata unless explicitly supplied
    UPDATE public.expense_rules
    SET
      department = v_first_main,
      category = v_first_sub1,
      sub_category1 = v_first_sub2,
      sub_category2 = v_first_sub3,
      sub_category3_values = v_first_sub4,
      vendor = COALESCE(NULLIF(btrim(COALESCE(p_vendor, '')), ''), vendor),
      payment_mode = COALESCE(NULLIF(btrim(COALESCE(p_payment_mode, '')), ''), payment_mode),
      gst_status = COALESCE(NULLIF(btrim(COALESCE(p_gst_status, '')), ''), gst_status),
      purchased_by = COALESCE(NULLIF(btrim(COALESCE(p_purchased_by, '')), ''), purchased_by),
      approved_by = COALESCE(NULLIF(btrim(COALESCE(p_approved_by, '')), ''), approved_by),
      notes = COALESCE(NULLIF(COALESCE(p_notes, ''), ''), notes),
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_rule;
  ELSE
    INSERT INTO public.expense_rules (
      keyword,
      keywords,
      keyword_signature,
      department,
      category,
      sub_category1,
      sub_category2,
      sub_category3_values,
      vendor,
      payment_mode,
      gst_status,
      purchased_by,
      approved_by,
      notes,
      priority,
      is_active
    )
    VALUES (
      v_canonical_keyword,
      v_tokens,
      v_signature,
      v_first_main,
      v_first_sub1,
      v_first_sub2,
      v_first_sub3,
      v_first_sub4,
      NULLIF(btrim(COALESCE(p_vendor, '')), ''),
      NULLIF(btrim(COALESCE(p_payment_mode, '')), ''),
      NULLIF(btrim(COALESCE(p_gst_status, '')), ''),
      NULLIF(btrim(COALESCE(p_purchased_by, '')), ''),
      NULLIF(btrim(COALESCE(p_approved_by, '')), ''),
      NULLIF(COALESCE(p_notes, ''), ''),
      COALESCE(p_priority, 50),
      TRUE
    )
    RETURNING * INTO v_rule;
  END IF;

  DELETE FROM public.expense_rule_category_paths
  WHERE rule_id = v_rule.id;

  v_idx := 0;
  FOR v_path IN SELECT value FROM jsonb_array_elements(p_category_paths)
  LOOP
    v_main := btrim(COALESCE(v_path->>'main_category', ''));
    v_sub1 := NULLIF(btrim(COALESCE(v_path->>'sub_category1', '')), '');
    v_sub2 := NULLIF(btrim(COALESCE(v_path->>'sub_category2', '')), '');
    v_sub3 := NULLIF(btrim(COALESCE(v_path->>'sub_category3', '')), '');
    v_sub4 := public.normalize_expense_level5_jsonb(COALESCE(v_path->'sub_category3_values', '[]'::jsonb));
    v_path_sig := public.build_expense_category_path_signature(v_main, v_sub1, v_sub2, v_sub3, v_sub4);

    INSERT INTO public.expense_rule_category_paths (
      rule_id,
      main_category,
      sub_category1,
      sub_category2,
      sub_category3,
      sub_category3_values,
      path_signature,
      sort_order
    )
    VALUES (
      v_rule.id,
      v_main,
      v_sub1,
      v_sub2,
      v_sub3,
      v_sub4,
      v_path_sig,
      v_idx
    );

    v_idx := v_idx + 1;
  END LOOP;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.sort_order), '[]'::jsonb)
  INTO v_paths_out
  FROM public.expense_rule_category_paths p
  WHERE p.rule_id = v_rule.id;

  RETURN jsonb_build_object(
    'rule', to_jsonb(v_rule),
    'category_paths', v_paths_out
  );
END;
$$;

-- ============================================================================
-- 5. Compatible 7-Arg Replacement: public.sync_automated_expense_category_path()
--    Drops the prior 6-arg signature inside this transaction to prevent
--    PostgREST PGRST203 overloading ambiguity while keeping 6-arg calls valid.
-- ============================================================================
DROP FUNCTION IF EXISTS public.sync_automated_expense_category_path(BIGINT, BIGINT, TEXT, TEXT, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.sync_automated_expense_category_path(
  p_expense_id BIGINT,
  p_expected_row_version BIGINT,
  p_mode TEXT,
  p_categorization_source TEXT,
  p_category_path JSONB DEFAULT NULL,
  p_matched_rule_id UUID DEFAULT NULL,
  p_category_paths JSONB DEFAULT NULL
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
  v_effective_paths JSONB;
  v_path JSONB;
  v_idx INTEGER := 0;
  v_main TEXT;
  v_sub1 TEXT;
  v_sub2 TEXT;
  v_sub3 TEXT;
  v_sub4 JSONB;
  v_sig TEXT;
  v_seen_sigs TEXT[] := '{}'::TEXT[];
  v_first_main TEXT;
  v_first_sub1 TEXT;
  v_first_sub2 TEXT;
  v_first_sub3 TEXT;
  v_first_sub4 JSONB := '[]'::jsonb;
  v_paths_out JSONB := '[]'::jsonb;
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
    RAISE EXCEPTION 'Forbidden: active Admin role required';
  END IF;

  IF p_mode NOT IN ('initial_upload', 'historical_reevaluation', 'targeted_rule_resync') THEN
    RAISE EXCEPTION 'Invalid sync mode: %', p_mode;
  END IF;

  IF p_categorization_source NOT IN ('auto_rule', 'unassigned', 'conflict') THEN
    RAISE EXCEPTION 'Invalid categorization_source for automated sync: %', p_categorization_source;
  END IF;

  SELECT * INTO v_expense
  FROM public.expenses_row
  WHERE id = p_expense_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active expense % not found', p_expense_id;
  END IF;

  IF v_expense.manually_edited IS TRUE THEN
    RAISE EXCEPTION 'Cannot overwrite manually edited expense %', p_expense_id;
  END IF;

  IF v_expense.row_version IS DISTINCT FROM p_expected_row_version THEN
    RAISE EXCEPTION 'Stale row_version on expense % (expected %, actual %)',
      p_expense_id, p_expected_row_version, v_expense.row_version;
  END IF;

  IF p_categorization_source IN ('unassigned', 'conflict') THEN
    DELETE FROM public.expense_category_paths
    WHERE expense_id = p_expense_id;

    UPDATE public.expenses_row
    SET
      main_category = 'Uncategorized',
      sub_category1 = NULL,
      sub_category2 = NULL,
      sub_category3 = NULL,
      sub_category3_values = '[]'::jsonb,
      categorization_source = p_categorization_source,
      manually_edited = FALSE
    WHERE id = p_expense_id
    RETURNING * INTO v_expense;

    RETURN jsonb_build_object(
      'expense', to_jsonb(v_expense),
      'category_paths', '[]'::jsonb,
      'row_version', v_expense.row_version
    );
  END IF;

  -- auto_rule: prefer p_category_paths array, fall back to single p_category_path
  IF p_category_paths IS NOT NULL THEN
    IF jsonb_typeof(p_category_paths) <> 'array' THEN
      RAISE EXCEPTION 'p_category_paths must be a JSON array';
    END IF;
    v_effective_paths := p_category_paths;
  ELSIF p_category_path IS NOT NULL THEN
    v_effective_paths := jsonb_build_array(p_category_path);
  ELSE
    v_effective_paths := '[]'::jsonb;
  END IF;

  IF jsonb_array_length(v_effective_paths) = 0 THEN
    RAISE EXCEPTION 'auto_rule sync requires at least one category path';
  END IF;

  FOR v_path IN SELECT value FROM jsonb_array_elements(v_effective_paths)
  LOOP
    v_main := btrim(COALESCE(v_path->>'main_category', ''));
    v_sub1 := NULLIF(btrim(COALESCE(v_path->>'sub_category1', '')), '');
    v_sub2 := NULLIF(btrim(COALESCE(v_path->>'sub_category2', '')), '');
    v_sub3 := NULLIF(btrim(COALESCE(v_path->>'sub_category3', '')), '');
    v_sub4 := public.normalize_expense_level5_jsonb(COALESCE(v_path->'sub_category3_values', '[]'::jsonb));

    IF v_main = '' OR v_main = 'Uncategorized' OR v_sub1 IS NULL THEN
      RAISE EXCEPTION 'Each category path requires Department and Category';
    END IF;
    IF v_sub3 IS NOT NULL AND v_sub2 IS NULL THEN
      RAISE EXCEPTION 'Cannot specify Sub Category 2 without Sub Category 1';
    END IF;
    IF jsonb_array_length(v_sub4) > 0 AND (v_sub2 IS NULL OR v_sub3 IS NULL) THEN
      RAISE EXCEPTION 'Cannot specify Sub Category 3 values without Sub Category 1 and Sub Category 2';
    END IF;

    v_sig := public.build_expense_category_path_signature(v_main, v_sub1, v_sub2, v_sub3, v_sub4);
    IF v_sig = ANY(v_seen_sigs) THEN
      RAISE EXCEPTION 'Duplicate category path in automated sync payload';
    END IF;
    v_seen_sigs := array_append(v_seen_sigs, v_sig);

    IF v_idx = 0 THEN
      v_first_main := v_main;
      v_first_sub1 := v_sub1;
      v_first_sub2 := v_sub2;
      v_first_sub3 := v_sub3;
      v_first_sub4 := v_sub4;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  DELETE FROM public.expense_category_paths
  WHERE expense_id = p_expense_id;

  v_idx := 0;
  FOR v_path IN SELECT value FROM jsonb_array_elements(v_effective_paths)
  LOOP
    v_main := btrim(COALESCE(v_path->>'main_category', ''));
    v_sub1 := NULLIF(btrim(COALESCE(v_path->>'sub_category1', '')), '');
    v_sub2 := NULLIF(btrim(COALESCE(v_path->>'sub_category2', '')), '');
    v_sub3 := NULLIF(btrim(COALESCE(v_path->>'sub_category3', '')), '');
    v_sub4 := public.normalize_expense_level5_jsonb(COALESCE(v_path->'sub_category3_values', '[]'::jsonb));
    v_sig := public.build_expense_category_path_signature(v_main, v_sub1, v_sub2, v_sub3, v_sub4);

    INSERT INTO public.expense_category_paths (
      expense_id,
      main_category,
      sub_category1,
      sub_category2,
      sub_category3,
      sub_category3_values,
      path_signature,
      matched_rule_id,
      sort_order
    )
    VALUES (
      p_expense_id,
      v_main,
      v_sub1,
      v_sub2,
      v_sub3,
      v_sub4,
      v_sig,
      p_matched_rule_id,
      v_idx
    );

    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.expenses_row
  SET
    main_category = v_first_main,
    sub_category1 = v_first_sub1,
    sub_category2 = v_first_sub2,
    sub_category3 = v_first_sub3,
    sub_category3_values = v_first_sub4,
    categorization_source = 'auto_rule',
    manually_edited = FALSE
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
-- 6. Function Privileges
-- ============================================================================
REVOKE ALL ON FUNCTION public.save_expense_rule_with_paths(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_expense_rule_with_paths(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_automated_expense_category_path(BIGINT, BIGINT, TEXT, TEXT, JSONB, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_automated_expense_category_path(BIGINT, BIGINT, TEXT, TEXT, JSONB, UUID, JSONB) TO authenticated;

COMMIT;
