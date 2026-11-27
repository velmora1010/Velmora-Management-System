import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import {
  attachCategoryPathsToExpenses,
  hasDuplicateCategoryPaths,
  isStaleRowVersionError,
  isValidRowVersion,
  normalizePathLevel5Values,
  sanitizeCategoryPathForRpc,
  type ExpenseCategoryPath,
} from '../../modules/finance/services/expenseCategoryPathUtils';

export interface ExpenseInsertFailure {
  sequence?: number;
  notes?: string | null;
  amount?: number | null;
  error: string;
}

export interface ExpenseUncertainInsert {
  sequence?: number;
  notes?: string | null;
  amount?: number | null;
  reason: string;
}

export interface ExpensePathSyncFailure {
  expenseId: string;
  error: string;
}

export interface UploadBatchResult {
  success: boolean;
  batch_id?: string;
  insertedCount?: number;
  insertFailures?: ExpenseInsertFailure[];
  uncertainInserts?: ExpenseUncertainInsert[];
  pathSyncFailures?: ExpensePathSyncFailure[];
  partialInsertFailure?: boolean;
  hasUncertainInserts?: boolean;
  error?: string;
}

export interface FinanceExpense {
  id?: string;
  main_category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  sub_category3: string | null;
  sub_category3_values: string[];
  quantity: number | null;
  amount: number | null;
  vendor: string | null;
  gst_status: string | null;
  payment_mode: string | null;
  bank_account: string | null;
  purchased_by: string | null;
  approved_by: string | null;
  notes: string | null;
  status?: string;
  created_at?: string;
  import_batch_id?: string | null;
  import_file_name?: string | null;
  import_status?: string | null;
  imported_at?: string | null;
  sequence?: number;
  transaction_date?: string | null;
  posted_datetime?: string | null;
  manually_edited?: boolean;
  categorization_source?: 'unassigned' | 'auto_rule' | 'conflict' | 'manual';
  row_version?: number;
  category_paths?: ExpenseCategoryPath[];
  pathLoadError?: boolean;
  matched_rule_id?: string | null;
}

export interface ExpenseImport {
  id: string;
  batch_id: string;
  file_name: string;
  file_hash: string;
  source_type: string;
  document_type: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  imported_by: string | null;
  imported_at: string;
  status: string;
}

const UPLOAD_AUTO_RULE_CONCURRENCY = 5;

function isConfirmedDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; status?: unknown };
  if (typeof e.code === 'string' && e.code.trim().length > 0) return true;
  if (
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 408 &&
    e.status !== 429
  ) {
    return true;
  }
  return false;
}

function buildSubmissionCorrelationKey(row: {
  sequence?: number | null;
  transaction_date?: string | null;
  amount?: number | null;
  notes?: string | null;
}): string {
  return JSON.stringify([
    row.sequence ?? 0,
    row.transaction_date ?? '',
    Number(row.amount ?? 0),
    (row.notes ?? '').trim(),
  ]);
}

async function runBoundedWorkers<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    })
  );
}

/**
 * Executes a batch expense upload with fresh batch_id verification, bulk insert
 * for unassigned/conflict rows, individual bounded-concurrency (max 5) inserts
 * + sync_automated_expense_category_path RPC calls for auto_rule rows, and
 * strict four-way accounting.
 */
export async function executeUploadBatch(
  client: typeof supabase,
  file_name: string,
  file_hash: string,
  source_type: string,
  imported_by: string | null,
  expensesData: FinanceExpense[],
  document_type: string = 'UNKNOWN'
): Promise<UploadBatchResult> {
  try {
    const uniqueSuffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const batch_id = `batch_${uniqueSuffix}`;

    // 1a. Compulsory pre-check: ensure batch_id does not exist in expense_imports
    const { count: preImportCount, error: preImportError } = await client
      .from('expense_imports')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batch_id);

    if (preImportError || (preImportCount ?? 0) > 0) {
      return {
        success: false,
        error: preImportError
          ? `Failed to verify fresh batch ID in expense_imports: ${preImportError.message}`
          : `Batch ID collision detected (${batch_id}); aborting upload.`,
      };
    }

    // 1b. Insert tracking record and verify creation via .select('id, batch_id').single()
    const trackingRecord = {
      batch_id,
      file_name,
      file_hash,
      source_type,
      document_type,
      total_rows: expensesData.length,
      imported_rows: 0,
      failed_rows: 0,
      imported_by,
      status: 'processing',
    };

    const { data: createdImport, error: importError } = await client
      .from('expense_imports')
      .insert([trackingRecord])
      .select('id, batch_id')
      .single();

    if (importError || !createdImport?.id) {
      throw importError || new Error('Failed to verify created expense_imports tracking record.');
    }

    // 1c. Compulsory pre-check: ensure zero expenses_row records exist for this batch_id
    const { count: preExpenseCount, error: preExpenseError } = await client
      .from(SUPABASE_TABLES.expenses)
      .select('id', { count: 'exact', head: true })
      .eq('import_batch_id', batch_id);

    if ((preExpenseCount ?? 0) > 0) {
      await client
        .from('expense_imports')
        .update({ status: 'failed', imported_rows: 0, failed_rows: expensesData.length })
        .eq('batch_id', batch_id);
      return {
        success: false,
        batch_id,
        error: `Existing expenses_row records found for fresh batch_id ${batch_id}; aborting upload.`,
      };
    }

    const isFreshBatchId =
      !preImportError &&
      preImportCount === 0 &&
      Boolean(createdImport?.id) &&
      !preExpenseError &&
      preExpenseCount === 0;

    // 2. Prepare sanitized DB rows (strip transient matched_rule_id & category_paths) & correlation keys
    const submittedKeyCounts = new Map<string, number>();
    const preparedItems = expensesData.map(exp => {
      const { matched_rule_id, category_paths, ...rest } = exp;
      const categorization_source = exp.categorization_source || 'unassigned';
      const dbRow = {
        ...rest,
        status: 'active',
        import_batch_id: batch_id,
        import_file_name: file_name,
        import_status: 'Imported',
        manually_edited: exp.manually_edited ?? false,
        categorization_source,
      };
      const corrKey = buildSubmissionCorrelationKey(dbRow);
      submittedKeyCounts.set(corrKey, (submittedKeyCounts.get(corrKey) || 0) + 1);
      return {
        dbRow,
        matchedRuleId: categorization_source === 'auto_rule' ? matched_rule_id ?? null : null,
        categoryPaths: categorization_source === 'auto_rule' && Array.isArray(category_paths) ? category_paths : [],
        corrKey,
      };
    });

    const nonAutoItems = preparedItems.filter(
      item => item.dbRow.categorization_source !== 'auto_rule'
    );
    const autoRuleItems = preparedItems.filter(
      item => item.dbRow.categorization_source === 'auto_rule'
    );

    let bulkInsertedCount = 0;
    let autoInsertedCount = 0;
    const insertFailures: ExpenseInsertFailure[] = [];
    const uncertainInserts: ExpenseUncertainInsert[] = [];
    const pathSyncFailures: ExpensePathSyncFailure[] = [];

    // 3a. Bulk insert non-auto_rule rows (unassigned / conflict)
    if (nonAutoItems.length > 0) {
      const nonAutoDbRows = nonAutoItems.map(item => item.dbRow);
      const { error: bulkError } = await client
        .from(SUPABASE_TABLES.expenses)
        .insert(nonAutoDbRows);

      if (!bulkError) {
        bulkInsertedCount = nonAutoDbRows.length;
      } else if (isConfirmedDbError(bulkError)) {
        const msg = bulkError.message || 'Database error during bulk expense insert';
        for (const item of nonAutoItems) {
          insertFailures.push({
            sequence: item.dbRow.sequence,
            notes: item.dbRow.notes,
            amount: item.dbRow.amount,
            error: msg,
          });
        }
      } else {
        // Uncertain network/timeout outcome: read back scoped to batch_id
        const { count: readbackCount, error: readbackError } = await client
          .from(SUPABASE_TABLES.expenses)
          .select('id', { count: 'exact', head: true })
          .eq('import_batch_id', batch_id)
          .in('categorization_source', ['unassigned', 'conflict']);

        if (
          !readbackError &&
          readbackCount === nonAutoDbRows.length &&
          isFreshBatchId
        ) {
          bulkInsertedCount = nonAutoDbRows.length;
        } else {
          const reason = readbackError
            ? `Bulk insert network outcome uncertain and read-back failed: ${readbackError.message}`
            : !isFreshBatchId
            ? 'Bulk insert network outcome uncertain and fresh batch_id could not be verified.'
            : (readbackCount ?? 0) > nonAutoDbRows.length
            ? `Integrity anomaly: expected ${nonAutoDbRows.length} non-auto rows for batch ${batch_id}, found ${readbackCount}.`
            : `Bulk insert outcome uncertain (found ${readbackCount ?? 0} of ${nonAutoDbRows.length} rows); verify batch before retrying.`;

          for (const item of nonAutoItems) {
            uncertainInserts.push({
              sequence: item.dbRow.sequence,
              notes: item.dbRow.notes,
              amount: item.dbRow.amount,
              reason,
            });
          }
        }
      }
    }

    // Helper to sync a confirmed inserted auto_rule row via V4 RPC
    const syncAutoRuleRow = async (
      insertedRow: {
        id: string | number;
        row_version?: number | null;
        main_category?: string | null;
        sub_category1?: string | null;
        sub_category2?: string | null;
        sub_category3?: string | null;
        sub_category3_values?: string[] | null;
      },
      matchedRuleId: string | null,
      categoryPaths: ExpenseCategoryPath[] = []
    ) => {
      const expenseIdStr = String(insertedRow.id);
      const main = (insertedRow.main_category || '').trim();
      const sub1 = (insertedRow.sub_category1 || '').trim();

      if (categoryPaths.length === 0 && (!main || main === 'Uncategorized' || !sub1)) {
        pathSyncFailures.push({
          expenseId: expenseIdStr,
          error: 'Row marked auto_rule is missing required Department/Category.',
        });
        return;
      }

      if (!isValidRowVersion(insertedRow.row_version)) {
        pathSyncFailures.push({
          expenseId: expenseIdStr,
          error: `Missing or invalid row_version (${String(insertedRow.row_version)}) after insert.`,
        });
        return;
      }

      try {
        const rawPaths: ExpenseCategoryPath[] =
          categoryPaths.length > 0
            ? categoryPaths
            : [
                {
                  main_category: main,
                  sub_category1: sub1,
                  sub_category2: insertedRow.sub_category2 || null,
                  sub_category3: insertedRow.sub_category3 || null,
                  sub_category3_values: insertedRow.sub_category3_values || [],
                },
              ];

        const sanitizedPaths = rawPaths.map(sanitizeCategoryPathForRpc);

        const { error: rpcError } = await client.rpc('sync_automated_expense_category_path', {
          p_expense_id: Number(insertedRow.id),
          p_expected_row_version: insertedRow.row_version,
          p_mode: 'initial_upload',
          p_categorization_source: 'auto_rule',
          p_category_path: sanitizedPaths[0],
          p_category_paths: sanitizedPaths,
          p_matched_rule_id: matchedRuleId || null,
        });

        if (rpcError) {
          pathSyncFailures.push({
            expenseId: expenseIdStr,
            error: rpcError.message || 'Category-path sync RPC failed.',
          });
        }
      } catch (err: unknown) {
        pathSyncFailures.push({
          expenseId: expenseIdStr,
          error: err instanceof Error ? err.message : 'Failed to prepare category-path payload.',
        });
      }
    };

    // 3b. Individual auto_rule inserts + category-path RPC sync (max 5 concurrent workers)
    await runBoundedWorkers(autoRuleItems, UPLOAD_AUTO_RULE_CONCURRENCY, async item => {
      const { data: insertedRow, error: insertErr } = await client
        .from(SUPABASE_TABLES.expenses)
        .insert([item.dbRow])
        .select(
          'id, row_version, main_category, sub_category1, sub_category2, sub_category3, sub_category3_values, categorization_source'
        )
        .single();

      if (!insertErr && insertedRow) {
        autoInsertedCount += 1;
        await syncAutoRuleRow(insertedRow, item.matchedRuleId, item.categoryPaths);
        return;
      }

      if (isConfirmedDbError(insertErr)) {
        insertFailures.push({
          sequence: item.dbRow.sequence,
          notes: item.dbRow.notes,
          amount: item.dbRow.amount,
          error: (insertErr as { message?: string })?.message || 'Insert failed.',
        });
        return;
      }

      // Uncertain network/timeout error: only recover if correlation is genuinely unambiguous
      const keyCount = submittedKeyCounts.get(item.corrKey) || 0;
      if (!isFreshBatchId || keyCount !== 1) {
        uncertainInserts.push({
          sequence: item.dbRow.sequence,
          notes: item.dbRow.notes,
          amount: item.dbRow.amount,
          reason:
            'Network interrupted and transaction fingerprint is not unique in batch; verify imports before retrying.',
        });
        return;
      }

      let rbQuery = client
        .from(SUPABASE_TABLES.expenses)
        .select(
          'id, row_version, main_category, sub_category1, sub_category2, sub_category3, sub_category3_values, categorization_source'
        )
        .eq('import_batch_id', batch_id)
        .eq('sequence', item.dbRow.sequence ?? 0)
        .eq('amount', item.dbRow.amount)
        .eq('notes', item.dbRow.notes ?? '')
        .limit(2);

      if (item.dbRow.transaction_date) {
        rbQuery = rbQuery.eq('transaction_date', item.dbRow.transaction_date);
      } else {
        rbQuery = rbQuery.is('transaction_date', null);
      }

      const { data: rbRows, error: rbErr } = await rbQuery;
      if (!rbErr && rbRows && rbRows.length === 1) {
        autoInsertedCount += 1;
        await syncAutoRuleRow(rbRows[0], item.matchedRuleId, item.categoryPaths);
        return;
      }

      uncertainInserts.push({
        sequence: item.dbRow.sequence,
        notes: item.dbRow.notes,
        amount: item.dbRow.amount,
        reason: rbErr
          ? `Network interrupted and read-back failed (${rbErr.message}); verify batch before retrying.`
          : rbRows && rbRows.length > 1
          ? 'Ambiguous multiple database matches during read-back; verify batch before retrying.'
          : 'Network interrupted and no committed row was confirmed on read-back; verify batch before retrying.',
      });
    });

    // 4. Four-way accounting & expense_imports status update
    const insertedCount = bulkInsertedCount + autoInsertedCount;
    const failedInsertCount = insertFailures.length;
    const uncertainCount = uncertainInserts.length;

    const finalImportStatus =
      uncertainCount > 0
        ? 'partial'
        : insertedCount === 0
        ? 'failed'
        : failedInsertCount > 0
        ? 'partial'
        : 'completed';

    await client
      .from('expense_imports')
      .update({
        imported_rows: insertedCount,
        failed_rows: failedInsertCount,
        status: finalImportStatus,
      })
      .eq('batch_id', batch_id);

    const hasFailures = failedInsertCount > 0;
    const hasUncertain = uncertainCount > 0;

    return {
      success: insertedCount > 0,
      batch_id,
      insertedCount,
      insertFailures,
      uncertainInserts,
      pathSyncFailures,
      partialInsertFailure: hasFailures,
      hasUncertainInserts: hasUncertain,
      error:
        insertedCount === 0
          ? insertFailures[0]?.error ||
            uncertainInserts[0]?.reason ||
            'No expenses were inserted.'
          : undefined,
    };
  } catch (e: unknown) {
    console.error('Failed to upload batch:', e);
    return { success: false, error: (e as { message?: string })?.message || 'Unknown error' };
  }
}

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [imports, setImports] = useState<ExpenseImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setError(null);
    setPathError(null);
    try {
      console.log('Loading', SUPABASE_TABLES.expenses, '...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .select('*')
        .eq('status', 'active')
        .order('transaction_date', { ascending: false });

      // Fallback if status column doesn't exist
      if (fetchError && fetchError.code === '42703') {
        const retry = await supabase
          .from(SUPABASE_TABLES.expenses)
          .select('*')
          .order('transaction_date', { ascending: false });
        fetchResult = retry.data;
        fetchError = retry.error;
      }

      const data = fetchResult;
      console.log("Loaded table:", SUPABASE_TABLES.expenses, data?.length, fetchError);

      if (fetchError) {
        console.error('expenses_row fetch error:', fetchError.message);
        throw fetchError;
      }

      const activeExpenses = (data || []).filter(e => e.status !== 'archived');
      const expenseIds = activeExpenses
        .map(e => e.id)
        .filter((id): id is string => id != null);

      let pathRows: ExpenseCategoryPath[] = [];
      let hasPathLoadError = false;

      if (expenseIds.length > 0) {
        const { data: fetchedPaths, error: pathsFetchError } = await supabase
          .from(SUPABASE_TABLES.expenseCategoryPaths)
          .select('*')
          .in('expense_id', expenseIds)
          .order('sort_order', { ascending: true });

        if (pathsFetchError) {
          hasPathLoadError = true;
          console.error('expense_category_paths fetch error:', pathsFetchError.message);
          setPathError(`Failed to load multi-category paths: ${pathsFetchError.message}`);
        } else {
          pathRows = (fetchedPaths || []) as ExpenseCategoryPath[];
        }
      }

      setExpenses(attachCategoryPathsToExpenses(activeExpenses, pathRows, hasPathLoadError));
    } catch (e: unknown) {
      console.error('Failed to load expenses:', e);
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Failed to load expenses');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchExpenses]);

  const refreshExpenses = useCallback(async () => {
    setIsLoading(true);
    await fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (expenseData: FinanceExpense) => {
    try {
      const payload = {
        ...expenseData,
        status: 'active',
        manually_edited: true,
        categorization_source: 'manual' as const
      };
      console.log('Expense Payload', payload);

      const { data, error } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .insert([payload])
        .select()
        .single();

      console.log('Supabase Error:', error);
      console.log('Supabase Data:', data);

      if (error) {
        throw new Error(`${error.message} - ${error.details}`);
      }

      setExpenses(prev => [data, ...prev]);

      // Non-blocking activity logging
      logActivity(
        'Finance',
        'Expense Added',
        `Expense of ₹${data.amount || expenseData.amount} was added for vendor "${data.vendor || expenseData.vendor || 'Unknown'}" under category "${data.main_category || expenseData.main_category}".`
      );

      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to add expense:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const updateExpense = async (
    id: string,
    updates: Partial<FinanceExpense>,
    options?: { preserveEditTracking?: boolean }
  ) => {
    try {
      const isStatusOnly = Object.keys(updates).every(key => key === 'status');
      const finalUpdates: Partial<FinanceExpense> =
        options?.preserveEditTracking || isStatusOnly
          ? updates
          : {
              ...updates,
              manually_edited: true,
              categorization_source: 'manual'
            };
      console.log('Expense Update Payload', finalUpdates);
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .update(finalUpdates)
        .eq('id', id)
        .select()
        .single();

      console.log('Supabase Error:', error);
      console.log('Supabase Data:', data);

      if (error) {
        throw new Error(`${error.message} - ${error.details}`);
      }

      setExpenses(prev => prev.map(e => e.id === id ? data : e));

      // Non-blocking activity logging
      logActivity(
        'Finance',
        'Expense Updated',
        `Expense ID ${id} was updated (vendor: "${data.vendor || updates.vendor || 'Unknown'}").`
      );

      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to update expense:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const archiveExpense = async (id: string) => {
    return updateExpense(id, { status: 'archived' }, { preserveEditTracking: true });
  };

  const toDbExpenseId = (id: string | number): string | number => {
    const num = Number(id);
    return Number.isSafeInteger(num) && String(num) === String(id).trim() ? num : id;
  };

  /**
   * Refreshes a single expense row along with its ordered expense_category_paths.
   * Explicitly surfaces path-loading failures rather than silently falling back.
   */
  const refreshExpenseById = useCallback(async (id: string): Promise<{
    success: boolean;
    data?: FinanceExpense;
    pathLoadError?: boolean;
    error?: string;
  }> => {
    try {
      const dbId = toDbExpenseId(id);
      const [expRes, pathsRes] = await Promise.all([
        supabase
          .from(SUPABASE_TABLES.expenses)
          .select('*')
          .eq('id', dbId)
          .single(),
        supabase
          .from(SUPABASE_TABLES.expenseCategoryPaths)
          .select('*')
          .eq('expense_id', dbId)
          .order('sort_order', { ascending: true }),
      ]);

      if (expRes.error) {
        throw new Error(expRes.error.message);
      }

      const hasPathLoadError = Boolean(pathsRes.error);
      if (pathsRes.error) {
        console.error(`Failed to refresh expense_category_paths for ${id}:`, pathsRes.error.message);
        setPathError(`Failed to load multi-category paths: ${pathsRes.error.message}`);
      }

      const [hydrated] = attachCategoryPathsToExpenses(
        [expRes.data as FinanceExpense],
        (pathsRes.data || []) as ExpenseCategoryPath[],
        hasPathLoadError
      );

      setExpenses(prev => prev.map(e => (String(e.id) === String(id) ? hydrated : e)));

      return {
        success: !hasPathLoadError,
        data: hydrated,
        pathLoadError: hasPathLoadError,
        error: pathsRes.error ? `Failed to load multi-category paths: ${pathsRes.error.message}` : undefined,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh expense';
      return { success: false, error: msg };
    }
  }, []);

  const resolveVerifiedRowVersion = useCallback(async (
    expenseId: string,
    providedRowVersion?: number
  ): Promise<{ ok: true; rowVersion: number } | { ok: false; error: string }> => {
    if (isValidRowVersion(providedRowVersion)) {
      return { ok: true, rowVersion: providedRowVersion };
    }

    const refreshed = await refreshExpenseById(expenseId);
    if (!refreshed.success || !refreshed.data || !isValidRowVersion(refreshed.data.row_version)) {
      return {
        ok: false,
        error: refreshed.error || 'Missing expense row_version. Please refresh and try again.',
      };
    }

    return { ok: true, rowVersion: refreshed.data.row_version };
  }, [refreshExpenseById]);

  /**
   * Atomically updates an expense and replaces its category paths via V4 RPC
   * public.save_expense_with_category_paths().
   */
  const saveExpenseWithCategories = async ({
    expenseId,
    expectedRowVersion,
    expenseUpdates,
    categoryPaths,
  }: {
    expenseId: string;
    expectedRowVersion?: number;
    expenseUpdates: Record<string, unknown>;
    categoryPaths: ExpenseCategoryPath[];
  }): Promise<{
    success: boolean;
    data?: FinanceExpense;
    isStaleVersion?: boolean;
    error?: string;
  }> => {
    try {
      if (!Array.isArray(categoryPaths) || categoryPaths.length === 0) {
        return {
          success: false,
          error: 'At least one category path is required. Use Reset to Uncategorized to clear categories.',
        };
      }

      const sanitizedPaths = categoryPaths.map(sanitizeCategoryPathForRpc);
      if (hasDuplicateCategoryPaths(sanitizedPaths)) {
        return { success: false, error: 'Duplicate category paths are not allowed.' };
      }

      const versionCheck = await resolveVerifiedRowVersion(expenseId, expectedRowVersion);
      if (!versionCheck.ok) {
        return { success: false, error: versionCheck.error };
      }

      const { data, error: rpcError } = await supabase.rpc('save_expense_with_category_paths', {
        p_expense_id: toDbExpenseId(expenseId),
        p_expected_row_version: versionCheck.rowVersion,
        p_expense_updates: expenseUpdates,
        p_category_paths: sanitizedPaths,
      });

      if (rpcError) {
        if (isStaleRowVersionError(rpcError)) {
          await refreshExpenseById(expenseId);
          return {
            success: false,
            isStaleVersion: true,
            error: 'This expense was updated by another user. Latest data has been loaded — please review and retry.',
          };
        }
        throw rpcError;
      }

      const payload = data as {
        expense: FinanceExpense;
        category_paths: ExpenseCategoryPath[];
        row_version: number;
      };

      const updatedExpense: FinanceExpense = {
        ...payload.expense,
        row_version: payload.row_version ?? payload.expense?.row_version,
        category_paths: (payload.category_paths || []).map(p => ({
          ...p,
          sub_category3_values: normalizePathLevel5Values(p.sub_category3_values),
        })),
        pathLoadError: false,
      };

      setExpenses(prev => prev.map(e => (String(e.id) === String(expenseId) ? updatedExpense : e)));

      logActivity(
        'Finance',
        'Expense Updated',
        `Expense ID ${expenseId} was updated with ${updatedExpense.category_paths?.length || 0} category path(s).`
      );

      return { success: true, data: updatedExpense };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || 'Failed to save expense categories';
      console.error('Failed to save expense with category paths:', e);
      return { success: false, error: msg };
    }
  };

  /**
   * Intentionally clears all category paths and resets an expense to Uncategorized
   * via V4 RPC public.reset_expense_to_uncategorized().
   */
  const resetExpenseToUncategorized = async ({
    expenseId,
    expectedRowVersion,
    expenseUpdates = {},
  }: {
    expenseId: string;
    expectedRowVersion?: number;
    expenseUpdates?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    data?: FinanceExpense;
    isStaleVersion?: boolean;
    error?: string;
  }> => {
    try {
      const versionCheck = await resolveVerifiedRowVersion(expenseId, expectedRowVersion);
      if (!versionCheck.ok) {
        return { success: false, error: versionCheck.error };
      }

      const { data, error: rpcError } = await supabase.rpc('reset_expense_to_uncategorized', {
        p_expense_id: toDbExpenseId(expenseId),
        p_expected_row_version: versionCheck.rowVersion,
        p_expense_updates: expenseUpdates,
      });

      if (rpcError) {
        if (isStaleRowVersionError(rpcError)) {
          await refreshExpenseById(expenseId);
          return {
            success: false,
            isStaleVersion: true,
            error: 'This expense was updated by another user. Latest data has been loaded — please review and retry.',
          };
        }
        throw rpcError;
      }

      const payload = data as {
        expense: FinanceExpense;
        category_paths: ExpenseCategoryPath[];
        row_version: number;
      };

      const updatedExpense: FinanceExpense = {
        ...payload.expense,
        row_version: payload.row_version ?? payload.expense?.row_version,
        category_paths: [],
        pathLoadError: false,
      };

      setExpenses(prev => prev.map(e => (String(e.id) === String(expenseId) ? updatedExpense : e)));

      logActivity(
        'Finance',
        'Expense Updated',
        `Expense ID ${expenseId} was reset to Uncategorized.`
      );

      return { success: true, data: updatedExpense };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || 'Failed to reset expense';
      console.error('Failed to reset expense to Uncategorized:', e);
      return { success: false, error: msg };
    }
  };

  const fetchImports = useCallback(async () => {
    setIsLoadingImports(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('expense_imports')
        .select('*')
        .neq('status', 'archived')
        .order('imported_at', { ascending: false });

      if (fetchError) {
        const retry = await supabase
          .from('expense_imports')
          .select('*')
          .order('imported_at', { ascending: false });
        if (retry.error) throw retry.error;
        const activeOnly = (retry.data || []).filter((i: any) => i.status !== 'archived');
        setImports(activeOnly);
      } else {
        const activeOnly = (data || []).filter((i: any) => i.status !== 'archived');
        setImports(activeOnly);
      }
    } catch (e: unknown) {
      console.error('Failed to load expense imports:', e);
    } finally {
      setIsLoadingImports(false);
    }
  }, []);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  const uploadBatch = async (
    file_name: string,
    file_hash: string,
    source_type: string,
    imported_by: string | null,
    expensesData: FinanceExpense[],
    document_type: string = 'UNKNOWN'
  ): Promise<UploadBatchResult> => {
    const res = await executeUploadBatch(
      supabase,
      file_name,
      file_hash,
      source_type,
      imported_by,
      expensesData,
      document_type
    );
    if (res.batch_id) {
      await fetchImports();
      await fetchExpenses();
    }
    return res;
  };

  const deleteBatch = async (batch_id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Soft-delete tracking record by setting status = 'archived'
      const { error: deleteImportError } = await supabase
        .from('expense_imports')
        .update({ status: 'archived' })
        .eq('batch_id', batch_id);

      if (deleteImportError) throw deleteImportError;

      // 2. Archive associated expenses
      const { error: deleteExpError } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .update({ status: 'archived' })
        .eq('import_batch_id', batch_id);

      if (deleteExpError) {
        console.warn('Could not archive associated expenses:', deleteExpError);
      }

      await fetchImports();
      await fetchExpenses();
      return { success: true };
    } catch (e: unknown) {
      console.error('Failed to delete/archive batch:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  return {
    expenses,
    imports,
    isLoading,
    isLoadingImports,
    error,
    pathError,
    refreshExpenses,
    refreshExpenseById,
    fetchImports,
    addExpense,
    updateExpense,
    saveExpenseWithCategories,
    resetExpenseToUncategorized,
    archiveExpense,
    uploadBatch,
    deleteBatch
  };
};
