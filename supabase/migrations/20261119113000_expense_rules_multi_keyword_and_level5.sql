-- Phase 1 (Final): Additive, idempotent migration for multi-keyword (/) AND rules,
-- complete 5-level category hierarchy, and shared normalization between backfill and trigger.
-- Preserves all 105 existing expense_rules records and their original keyword values.

BEGIN;

-- 1. Add structured multi-keyword and Level 5 category columns safely
ALTER TABLE public.expense_rules
  ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS keyword_signature TEXT,
  ADD COLUMN IF NOT EXISTS sub_category3_values TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

-- 2. Shared normalization function used by BOTH the backfill and the trigger
CREATE OR REPLACE FUNCTION public.normalize_expense_rule_keywords(p_keyword TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT lower(regexp_replace(u.raw_part, '^\s+|\s+$', '', 'g')) AS t
      FROM unnest(string_to_array(COALESCE(p_keyword, ''), '/')) AS u(raw_part)
      WHERE regexp_replace(u.raw_part, '^\s+|\s+$', '', 'g') <> ''
      ORDER BY t
    ),
    '{}'::TEXT[]
  );
$$;

-- 3. Backfill existing rules idempotently using the shared normalization function.
--    Original keyword values are never modified.
UPDATE public.expense_rules er
SET
  keywords = parsed.tokens,
  keyword_signature = array_to_string(parsed.tokens, '/')
FROM (
  SELECT
    r.id,
    public.normalize_expense_rule_keywords(r.keyword) AS tokens
  FROM public.expense_rules r
) parsed
WHERE er.id = parsed.id
  AND cardinality(parsed.tokens) > 0
  AND (
    er.keyword_signature IS NULL
    OR er.keywords IS NULL
    OR cardinality(er.keywords) = 0
  );

-- 4. Authoritative trigger function: ALWAYS derives keywords and keyword_signature
--    from NEW.keyword on every INSERT or UPDATE using the same normalization function.
CREATE OR REPLACE FUNCTION public.sync_expense_rules_keywords()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tokens TEXT[];
BEGIN
  -- Preserve Level 5 values when supplied; default to empty array when omitted or NULL
  NEW.sub_category3_values := COALESCE(NEW.sub_category3_values, '{}'::TEXT[]);

  IF NEW.keyword IS NULL THEN
    RAISE EXCEPTION 'expense_rules.keyword cannot be NULL or empty';
  END IF;

  v_tokens := public.normalize_expense_rule_keywords(NEW.keyword);

  IF v_tokens IS NULL OR cardinality(v_tokens) = 0 THEN
    RAISE EXCEPTION 'expense_rules.keyword must contain at least one non-empty keyword token (received: %)', NEW.keyword;
  END IF;

  -- Always overwrite derived columns from NEW.keyword
  NEW.keywords := v_tokens;
  NEW.keyword_signature := array_to_string(v_tokens, '/');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_expense_rules_keywords ON public.expense_rules;
CREATE TRIGGER trg_sync_expense_rules_keywords
  BEFORE INSERT OR UPDATE ON public.expense_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_expense_rules_keywords();

-- 5a. Dynamically drop any single-column UNIQUE constraint on public.expense_rules(keyword)
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'expense_rules'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND (
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attnum = c.conkey[1]
      ) = 'keyword'
  LOOP
    EXECUTE format('ALTER TABLE public.expense_rules DROP CONSTRAINT IF EXISTS %I', v_conname);
  END LOOP;
END $$;

-- 5b. Dynamically drop any standalone single-column UNIQUE index on public.expense_rules(keyword)
DO $$
DECLARE
  v_idxname TEXT;
BEGIN
  FOR v_idxname IN
    SELECT idx_cls.relname
    FROM pg_index i
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    JOIN pg_class idx_cls ON idx_cls.oid = i.indexrelid
    LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid
    WHERE n.nspname = 'public'
      AND tbl.relname = 'expense_rules'
      AND i.indisunique = TRUE
      AND i.indisprimary = FALSE
      AND i.indnatts = 1
      AND c.oid IS NULL
      AND (
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = tbl.oid AND a.attnum = i.indkey[0]
      ) = 'keyword'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', v_idxname);
  END LOOP;
END $$;

-- 6. Enforce NOT NULL and full (non-partial) uniqueness on keyword_signature
ALTER TABLE public.expense_rules
  ALTER COLUMN keyword_signature SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_rules_keyword_signature_unique
  ON public.expense_rules (keyword_signature);

-- 7. Supporting GIN index for array containment queries on keywords
CREATE INDEX IF NOT EXISTS idx_expense_rules_keywords_gin
  ON public.expense_rules USING GIN (keywords);

COMMIT;
