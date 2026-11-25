-- Checkpoint 2: Additive, idempotent migration for Historical Expense Re-evaluation
-- tracking columns, backfill, partial index, cross-session lock table, and ownership-checked RPCs.
-- Non-destructive: preserves all existing rows and does not drop any data.

BEGIN;

-- 1. Add tracking columns to public.expenses_row
ALTER TABLE public.expenses_row
  ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS categorization_source TEXT NOT NULL DEFAULT 'unassigned';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'expenses_row'
      AND c.conname = 'expenses_row_categorization_source_check'
  ) THEN
    ALTER TABLE public.expenses_row
      ADD CONSTRAINT expenses_row_categorization_source_check
      CHECK (categorization_source IN ('unassigned', 'auto_rule', 'conflict', 'manual'));
  END IF;
END $$;

-- 2. Idempotent historical backfill
-- 2a. Mark manual entries (import_batch_id IS NULL) and rows with 'Expense Updated' in audit_logs
UPDATE public.expenses_row e
SET
  manually_edited = TRUE,
  categorization_source = 'manual'
WHERE (
    e.import_batch_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.audit_logs a
      WHERE a.action = 'Expense Updated'
        AND (
          a.record_id::text = e.id::text
          OR (a.metadata->>'numeric_record_id') = e.id::text
          OR COALESCE(a.metadata->>'description', '') ~ ('(^|[^[:alnum:]-])' || e.id::text || '([^[:alnum:]-]|$)')
        )
    )
  )
  AND (e.manually_edited IS DISTINCT FROM TRUE OR e.categorization_source <> 'manual');

-- 2b. Mark already-categorized uploaded rows (not flagged manual above) as auto_rule
UPDATE public.expenses_row e
SET categorization_source = 'auto_rule'
WHERE e.import_batch_id IS NOT NULL
  AND e.manually_edited = FALSE
  AND e.main_category IS NOT NULL
  AND e.main_category <> 'Uncategorized'
  AND e.categorization_source = 'unassigned';

-- 3. Partial index for fast keyset pagination of eligible Uncategorized uploaded rows
CREATE INDEX IF NOT EXISTS idx_expenses_row_reeval_eligible
  ON public.expenses_row (id)
  WHERE status = 'active'
    AND import_batch_id IS NOT NULL
    AND manually_edited = FALSE
    AND (main_category = 'Uncategorized' OR main_category IS NULL);

-- 4. Cross-session singleton coordination table
CREATE TABLE IF NOT EXISTS public.expense_reevaluation_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_running BOOLEAN NOT NULL DEFAULT FALSE,
  needs_rerun BOOLEAN NOT NULL DEFAULT FALSE,
  current_run_id UUID,
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_summary JSONB
);

INSERT INTO public.expense_reevaluation_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.expense_reevaluation_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read reevaluation state" ON public.expense_reevaluation_state;
CREATE POLICY "Authenticated users can read reevaluation state"
  ON public.expense_reevaluation_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5. Ownership-checked coordination RPCs
CREATE OR REPLACE FUNCTION public.request_expense_reevaluation(
  p_stale_after_seconds INTEGER DEFAULT 180
)
RETURNS TABLE (
  acquired BOOLEAN,
  queued_rerun BOOLEAN,
  run_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.expense_reevaluation_state%ROWTYPE;
  v_new_run_id UUID;
  v_stale_interval INTERVAL;
BEGIN
  v_stale_interval := make_interval(secs => GREATEST(COALESCE(p_stale_after_seconds, 180), 30));

  INSERT INTO public.expense_reevaluation_state (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_state
  FROM public.expense_reevaluation_state
  WHERE id = 1
  FOR UPDATE;

  IF v_state.is_running = FALSE
     OR v_state.heartbeat_at IS NULL
     OR v_state.heartbeat_at < (now() - v_stale_interval) THEN
    v_new_run_id := gen_random_uuid();

    UPDATE public.expense_reevaluation_state
    SET
      is_running = TRUE,
      needs_rerun = FALSE,
      current_run_id = v_new_run_id,
      started_at = now(),
      heartbeat_at = now()
    WHERE id = 1;

    RETURN QUERY SELECT TRUE, FALSE, v_new_run_id;
  ELSE
    UPDATE public.expense_reevaluation_state
    SET needs_rerun = TRUE
    WHERE id = 1;

    RETURN QUERY SELECT FALSE, TRUE, NULL::UUID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_expense_reevaluation(
  p_run_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_run_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.expense_reevaluation_state
  SET heartbeat_at = now()
  WHERE id = 1
    AND is_running = TRUE
    AND current_run_id = p_run_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_expense_reevaluation(
  p_run_id UUID,
  p_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  released BOOLEAN,
  should_rerun BOOLEAN,
  lost_lock BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needs_rerun BOOLEAN;
BEGIN
  IF p_run_id IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, TRUE;
    RETURN;
  END IF;

  SELECT s.needs_rerun INTO v_needs_rerun
  FROM public.expense_reevaluation_state s
  WHERE s.id = 1
    AND s.is_running = TRUE
    AND s.current_run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, TRUE;
    RETURN;
  END IF;

  IF v_needs_rerun THEN
    UPDATE public.expense_reevaluation_state
    SET
      needs_rerun = FALSE,
      heartbeat_at = now()
    WHERE id = 1
      AND is_running = TRUE
      AND current_run_id = p_run_id;

    RETURN QUERY SELECT FALSE, TRUE, FALSE;
  ELSE
    UPDATE public.expense_reevaluation_state
    SET
      is_running = FALSE,
      needs_rerun = FALSE,
      current_run_id = NULL,
      finished_at = now(),
      last_summary = COALESCE(p_summary, '{}'::jsonb)
    WHERE id = 1
      AND is_running = TRUE
      AND current_run_id = p_run_id;

    RETURN QUERY SELECT TRUE, FALSE, FALSE;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.request_expense_reevaluation(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.heartbeat_expense_reevaluation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_expense_reevaluation(UUID, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_expense_reevaluation(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_expense_reevaluation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_expense_reevaluation(UUID, JSONB) TO authenticated;

COMMIT;
