import type { FinanceExpense } from '../../../hooks/finance/useExpenses';

export interface ExpenseCategoryPath {
  id?: string;
  expense_id?: string | number;
  main_category: string;
  sub_category1: string | null;
  sub_category2?: string | null;
  sub_category3?: string | null;
  sub_category3_values: string[];
  path_signature?: string;
  matched_rule_id?: string | null;
  sort_order?: number;
  created_at?: string;
}

export type CategoryCompletionStatus =
  | 'load_error'
  | 'conflict'
  | 'fully_categorized'
  | 'uncategorized'
  | 'unsynced_scalar_fallback';

export interface ResolvedCategoryPaths {
  paths: ExpenseCategoryPath[];
  source: 'load_error' | 'paths' | 'scalar_fallback' | 'none';
  hasSyncWarning: boolean;
}

/**
 * Normalizes Level 5 category values (trimmed, deduplicated, sorted)
 * matching PostgreSQL public.normalize_expense_level5_jsonb().
 */
export function normalizePathLevel5Values(values: unknown): string[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const cleaned = values
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Builds the canonical path key matching PostgreSQL build_expense_category_path_signature().
 */
export function getCategoryPathKey(
  path: Pick<ExpenseCategoryPath, 'main_category' | 'sub_category1' | 'sub_category2' | 'sub_category3' | 'sub_category3_values'>
): string {
  return JSON.stringify([
    (path.main_category || '').trim(),
    (path.sub_category1 || '').trim(),
    (path.sub_category2 || '').trim(),
    (path.sub_category3 || '').trim(),
    normalizePathLevel5Values(path.sub_category3_values),
  ]);
}

/**
 * Validates and sanitizes a category path payload before sending it to the V4 RPC.
 */
export function sanitizeCategoryPathForRpc(path: ExpenseCategoryPath): {
  main_category: string;
  sub_category1: string;
  sub_category2: string | null;
  sub_category3: string | null;
  sub_category3_values: string[];
} {
  const main_category = (path.main_category || '').trim();
  const sub_category1 = (path.sub_category1 || '').trim();
  const sub_category2 = (path.sub_category2 || '').trim() || null;
  const sub_category3 = (path.sub_category3 || '').trim() || null;
  const sub_category3_values = normalizePathLevel5Values(path.sub_category3_values);

  if (!main_category || main_category === 'Uncategorized' || !sub_category1) {
    throw new Error('Each category path requires Department and Category.');
  }
  if (sub_category3 && !sub_category2) {
    throw new Error('Cannot specify Sub Category 2 without Sub Category 1.');
  }
  if (sub_category3_values.length > 0 && (!sub_category2 || !sub_category3)) {
    throw new Error('Cannot specify Sub Category 3 values without Sub Category 1 and Sub Category 2.');
  }

  return {
    main_category,
    sub_category1,
    sub_category2,
    sub_category3,
    sub_category3_values,
  };
}

/**
 * Returns true when two or more paths share the same canonical 5-level signature.
 */
export function hasDuplicateCategoryPaths(paths: ExpenseCategoryPath[]): boolean {
  const seen = new Set<string>();
  for (const path of paths) {
    const key = getCategoryPathKey(path);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * Attaches fetched expense_category_paths rows (ordered by sort_order ASC) to expenses.
 * When pathLoadError is true, marks every expense with pathLoadError=true instead of masking the failure.
 */
export function attachCategoryPathsToExpenses(
  expenses: FinanceExpense[],
  pathRows: ExpenseCategoryPath[] | null | undefined,
  pathLoadError: boolean
): FinanceExpense[] {
  const grouped = new Map<string, ExpenseCategoryPath[]>();

  if (!pathLoadError && Array.isArray(pathRows)) {
    for (const row of pathRows) {
      if (row.expense_id == null) continue;
      const key = String(row.expense_id);
      const list = grouped.get(key) || [];
      list.push({
        ...row,
        sub_category3_values: normalizePathLevel5Values(row.sub_category3_values),
      });
      grouped.set(key, list);
    }

    grouped.forEach(list => {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    });
  }

  return expenses.map(exp => {
    const expKey = exp.id != null ? String(exp.id) : '';
    const attached = expKey ? grouped.get(expKey) || [] : [];
    return {
      ...exp,
      category_paths: pathLoadError ? [] : attached,
      pathLoadError,
    };
  });
}

/**
 * Resolves category paths for an expense while distinguishing:
 * - failed path query (never silently falls back to scalar fields)
 * - synced V4 paths
 * - unsynced scalar fallback
 * - uncategorized / conflict
 */
export function resolveExpenseCategoryPaths(expense: FinanceExpense): ResolvedCategoryPaths {
  if (expense.pathLoadError) {
    return { paths: [], source: 'load_error', hasSyncWarning: false };
  }

  if (Array.isArray(expense.category_paths) && expense.category_paths.length > 0) {
    return {
      paths: expense.category_paths,
      source: 'paths',
      hasSyncWarning: false,
    };
  }

  if (expense.categorization_source === 'conflict') {
    return { paths: [], source: 'none', hasSyncWarning: false };
  }

  const main = (expense.main_category || '').trim();
  if (main && main !== 'Uncategorized') {
    return {
      paths: [
        {
          main_category: main,
          sub_category1: expense.sub_category1?.trim() || null,
          sub_category2: expense.sub_category2?.trim() || null,
          sub_category3: expense.sub_category3?.trim() || null,
          sub_category3_values: normalizePathLevel5Values(expense.sub_category3_values),
          sort_order: 0,
        },
      ],
      source: 'scalar_fallback',
      hasSyncWarning: true,
    };
  }

  return { paths: [], source: 'none', hasSyncWarning: false };
}

/**
 * Computes the UI completion status for an expense's category state.
 */
export function getCategoryCompletionStatus(expense: FinanceExpense): CategoryCompletionStatus {
  const resolved = resolveExpenseCategoryPaths(expense);
  if (resolved.source === 'load_error') return 'load_error';
  if (expense.categorization_source === 'conflict') return 'conflict';
  if (resolved.source === 'paths') return 'fully_categorized';
  if (resolved.source === 'scalar_fallback') return 'unsynced_scalar_fallback';
  return 'uncategorized';
}

/**
 * Strictly validates that row_version is a positive integer (never defaults to 1).
 */
export function isValidRowVersion(version: unknown): version is number {
  return typeof version === 'number' && Number.isInteger(version) && version >= 1;
}

/**
 * Detects PostgreSQL SQLSTATE 40001 / stale row_version errors from V4 RPCs.
 */
export function isStaleRowVersionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; details?: string };
  return (
    e.code === '40001' ||
    String(e.message || '').includes('Stale expense record') ||
    String(e.details || '').includes('Stale expense record')
  );
}
