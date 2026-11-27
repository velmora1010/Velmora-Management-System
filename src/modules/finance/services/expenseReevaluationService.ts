import { supabase } from '../../../lib/supabase';
import { SUPABASE_TABLES } from '../../../config/supabaseTables';
import { logActivity } from '../../../services/activityService';
import { ExpenseRuleEngine, type ExpenseRule } from '../../../utils/rules/ExpenseRuleEngine';
import type { NormalizedTransaction } from '../../../utils/documentPipeline/types';
import {
  isStaleRowVersionError,
  isValidRowVersion,
  sanitizeCategoryPathForRpc
} from './expenseCategoryPathUtils';

export type RowReevaluationOutcome = 'updated' | 'unmatched' | 'conflict' | 'skipped' | 'failed';

export interface ReevaluationSummary {
  updated: number;
  unmatched: number;
  conflicts: number;
  skipped: number;
  failed: number;
  queuedRerun?: boolean;
  lostLock?: boolean;
}

export interface EligibleExpenseRow {
  id: string;
  notes: string | null;
  amount: number | null;
  main_category: string | null;
  sub_category1?: string | null;
  sub_category2?: string | null;
  sub_category3?: string | null;
  sub_category3_values?: string[] | null;
  import_batch_id: string | null;
  manually_edited: boolean;
  categorization_source?: string | null;
  row_version?: number | null;
}

export interface ReevaluationOptions {
  excludeExpenseId?: string;
  pageSize?: number;
  updateConcurrency?: number;
  staleAfterSeconds?: number;
  heartbeatIntervalMs?: number;
}

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_UPDATE_CONCURRENCY = 5;
const DEFAULT_STALE_AFTER_SECONDS = 180;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Strict six-condition consistency check before allowing a no-op on an existing
 * 'unassigned' or 'conflict' row during historical re-evaluation.
 */
export function isHistoricalNoOpConsistent(
  row: EligibleExpenseRow,
  desiredSource: 'unassigned' | 'conflict',
  hasExistingCategoryPaths: boolean
): boolean {
  const hasEmptyLevel5 = Array.isArray(row.sub_category3_values)
    ? row.sub_category3_values.length === 0
    : row.sub_category3_values == null;

  return (
    row.categorization_source === desiredSource &&
    !hasExistingCategoryPaths &&
    row.main_category === 'Uncategorized' &&
    row.sub_category1 == null &&
    row.sub_category2 == null &&
    row.sub_category3 == null &&
    hasEmptyLevel5 &&
    row.manually_edited === false
  );
}

/**
 * Evaluates a single eligible historical expense row against active rules and
 * synchronizes category paths via sync_automated_expense_category_path().
 */
export async function evaluateAndUpdateRow(
  row: EligibleExpenseRow,
  activeRules: ExpenseRule[],
  hasExistingCategoryPaths: boolean = false,
  mode: 'historical_reevaluation' | 'targeted_rule_resync' = 'historical_reevaluation'
): Promise<RowReevaluationOutcome> {
  // Explicitly skip NULL, 'manual', 'auto_rule' (unless targeted_rule_resync), or unexpected sources without calling RPC
  const isAllowedSource =
    mode === 'targeted_rule_resync'
      ? row.categorization_source === 'auto_rule'
      : row.categorization_source === 'unassigned' || row.categorization_source === 'conflict';

  if (!isAllowedSource) {
    return 'skipped';
  }

  if (row.manually_edited) {
    return 'skipped';
  }

  if (!isValidRowVersion(row.row_version)) {
    console.error(`[expenseReevaluationService] Invalid row_version on expense ${row.id}:`, row.row_version);
    return 'failed';
  }

  const baseTx: NormalizedTransaction = {
    sequence: 0,
    amount: Number(row.amount || 0),
    notes: row.notes || ''
  };

  const ruled = ExpenseRuleEngine.applyExpenseRules(baseTx, activeRules);

  if (ruled.ruleConflict) {
    if (mode !== 'targeted_rule_resync' && isHistoricalNoOpConsistent(row, 'conflict', hasExistingCategoryPaths)) {
      return 'conflict';
    }

    const { error } = await supabase.rpc('sync_automated_expense_category_path', {
      p_expense_id: Number(row.id),
      p_expected_row_version: row.row_version,
      p_mode: mode,
      p_categorization_source: 'conflict',
      p_category_path: null,
      p_category_paths: null,
      p_matched_rule_id: null
    });

    if (error) {
      if (isStaleRowVersionError(error)) return 'skipped';
      console.error(`[expenseReevaluationService] Conflict sync failed for ${row.id}:`, error);
      return 'failed';
    }
    return 'conflict';
  }

  if (!ruled.main_category || ruled.main_category === 'Uncategorized') {
    if (mode !== 'targeted_rule_resync' && isHistoricalNoOpConsistent(row, 'unassigned', hasExistingCategoryPaths)) {
      return 'unmatched';
    }

    const { error } = await supabase.rpc('sync_automated_expense_category_path', {
      p_expense_id: Number(row.id),
      p_expected_row_version: row.row_version,
      p_mode: mode,
      p_categorization_source: 'unassigned',
      p_category_path: null,
      p_category_paths: null,
      p_matched_rule_id: null
    });

    if (error) {
      if (isStaleRowVersionError(error)) return 'skipped';
      console.error(`[expenseReevaluationService] Unassigned sync failed for ${row.id}:`, error);
      return 'failed';
    }
    return 'unmatched';
  }

  const rawPaths =
    Array.isArray(ruled.category_paths) && ruled.category_paths.length > 0
      ? ruled.category_paths
      : [
          {
            main_category: ruled.main_category,
            sub_category1: ruled.sub_category1 || '',
            sub_category2: ruled.sub_category2 || null,
            sub_category3: ruled.sub_category3 || null,
            sub_category3_values: ruled.sub_category3_values || []
          }
        ];

  let sanitizedPaths;
  try {
    sanitizedPaths = rawPaths.map(sanitizeCategoryPathForRpc);
  } catch (err) {
    console.error(`[expenseReevaluationService] Invalid rule hierarchy for row ${row.id}:`, err);
    return 'failed';
  }

  const { error } = await supabase.rpc('sync_automated_expense_category_path', {
    p_expense_id: Number(row.id),
    p_expected_row_version: row.row_version,
    p_mode: mode,
    p_categorization_source: 'auto_rule',
    p_category_path: sanitizedPaths[0],
    p_category_paths: sanitizedPaths,
    p_matched_rule_id: ruled.matchedRuleId || null
  });

  if (error) {
    if (isStaleRowVersionError(error)) return 'skipped';
    console.error(`[expenseReevaluationService] Auto-rule sync failed for ${row.id}:`, error);
    return 'failed';
  }
  return 'updated';
}

function summarizeOutcomes(
  outcomesById: Map<string, RowReevaluationOutcome>
): ReevaluationSummary {
  const summary: ReevaluationSummary = {
    updated: 0,
    unmatched: 0,
    conflicts: 0,
    skipped: 0,
    failed: 0
  };

  outcomesById.forEach(outcome => {
    if (outcome === 'updated') summary.updated += 1;
    else if (outcome === 'unmatched') summary.unmatched += 1;
    else if (outcome === 'conflict') summary.conflicts += 1;
    else if (outcome === 'skipped') summary.skipped += 1;
    else summary.failed += 1;
  });

  return summary;
}

/**
 * Re-evaluates all eligible historical uploaded Uncategorized expense rows
 * using the shared ExpenseRuleEngine and cross-session Postgres lock RPCs.
 */
export async function reevaluateHistoricalExpenses(
  options: ReevaluationOptions = {}
): Promise<ReevaluationSummary> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const concurrency = options.updateConcurrency ?? DEFAULT_UPDATE_CONCURRENCY;
  const staleAfterSeconds = options.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  const finalOutcomesById = new Map<string, RowReevaluationOutcome>();

  const { data: reqData, error: reqError } = await supabase.rpc('request_expense_reevaluation', {
    p_stale_after_seconds: staleAfterSeconds
  });

  if (reqError) {
    console.error('[expenseReevaluationService] Failed to acquire re-evaluation lock:', reqError);
    throw reqError;
  }

  const reqRow = Array.isArray(reqData) ? reqData[0] : reqData;
  if (!reqRow?.acquired || !reqRow?.run_id) {
    return {
      updated: 0,
      unmatched: 0,
      conflicts: 0,
      skipped: 0,
      failed: 0,
      queuedRerun: Boolean(reqRow?.queued_rerun)
    };
  }

  const runId: string = reqRow.run_id;
  let lockReleased = false;
  let lostLock = false;
  let inFlightHeartbeat: Promise<boolean> | null = null;

  const sendHeartbeatNonOverlapping = (): Promise<boolean> => {
    if (inFlightHeartbeat) return inFlightHeartbeat;
    inFlightHeartbeat = (async () => {
      try {
        const { data: hbOk, error: hbError } = await supabase.rpc('heartbeat_expense_reevaluation', {
          p_run_id: runId
        });
        if (hbError || hbOk !== true) {
          lostLock = true;
          lockReleased = true;
          return false;
        }
        return true;
      } catch {
        lostLock = true;
        lockReleased = true;
        return false;
      } finally {
        inFlightHeartbeat = null;
      }
    })();
    return inFlightHeartbeat;
  };

  // Background 30s timer ensures long rule fetches/queries never exceed the 180s stale threshold
  const heartbeatTimer = setInterval(() => {
    if (!lostLock && !lockReleased) {
      void sendHeartbeatNonOverlapping();
    }
  }, heartbeatIntervalMs);

  try {
    let shouldRerun = true;

    while (shouldRerun && !lostLock) {
      shouldRerun = false;

      const activeRules = await ExpenseRuleEngine.fetchActiveRules();
      if (lostLock) break;

      let lastId: string | null = null;

      while (!lostLock) {
        let query = supabase
          .from(SUPABASE_TABLES.expenses)
          .select(
            'id, notes, amount, main_category, sub_category1, sub_category2, sub_category3, sub_category3_values, import_batch_id, manually_edited, categorization_source, row_version'
          )
          .eq('status', 'active')
          .not('import_batch_id', 'is', null)
          .eq('manually_edited', false)
          .or('main_category.eq.Uncategorized,main_category.is.null')
          .order('id', { ascending: true })
          .limit(pageSize);

        if (lastId) {
          query = query.gt('id', lastId);
        }

        const { data: pageRows, error: fetchError } = await query;
        if (fetchError) {
          console.error('[expenseReevaluationService] Failed to fetch eligible expenses:', fetchError);
          throw fetchError;
        }
        if (lostLock) break;

        const rows = (pageRows || []) as EligibleExpenseRow[];
        if (rows.length === 0) break;

        lastId = rows[rows.length - 1].id;

        const candidates: EligibleExpenseRow[] = [];
        for (const row of rows) {
          if (options.excludeExpenseId && row.id === options.excludeExpenseId) {
            finalOutcomesById.set(row.id, 'skipped');
            continue;
          }
          candidates.push(row);
        }

        const rowsWithPaths = new Set<string>();
        if (candidates.length > 0) {
          const { data: existingPathRows, error: pathLookupError } = await supabase
            .from(SUPABASE_TABLES.expenseCategoryPaths)
            .select('expense_id')
            .in(
              'expense_id',
              candidates.map(c => c.id)
            );
          if (pathLookupError) {
            console.error('[expenseReevaluationService] Failed to verify expense_category_paths:', pathLookupError);
            throw pathLookupError;
          }
          for (const p of existingPathRows || []) {
            if (p && (p as { expense_id?: unknown }).expense_id != null) {
              rowsWithPaths.add(String((p as { expense_id: unknown }).expense_id));
            }
          }
        }

        for (let i = 0; i < candidates.length; i += concurrency) {
          if (lostLock) break;

          const chunk = candidates.slice(i, i + concurrency);
          const outcomes = await Promise.allSettled(
            chunk.map(row => evaluateAndUpdateRow(row, activeRules, rowsWithPaths.has(String(row.id))))
          );

          for (let j = 0; j < chunk.length; j += 1) {
            const row = chunk[j];
            const outcome = outcomes[j];
            if (outcome.status === 'rejected') {
              finalOutcomesById.set(row.id, 'failed');
            } else {
              finalOutcomesById.set(row.id, outcome.value);
            }
          }
        }

        if (lostLock) break;

        // Verify ownership & refresh heartbeat after each page
        const pageHbOk = await sendHeartbeatNonOverlapping();
        if (!pageHbOk || lostLock) break;

        if (rows.length < pageSize) break;
      }

      if (lostLock) break;

      const currentSummary = summarizeOutcomes(finalOutcomesById);
      const { data: compData, error: compError } = await supabase.rpc('complete_expense_reevaluation', {
        p_run_id: runId,
        p_summary: currentSummary
      });

      if (compError) {
        console.error('[expenseReevaluationService] Failed to complete re-evaluation lock:', compError);
        throw compError;
      }

      const compRow = Array.isArray(compData) ? compData[0] : compData;
      if (compRow?.lost_lock) {
        lostLock = true;
        lockReleased = true;
        break;
      }

      if (compRow?.should_rerun) {
        shouldRerun = true;
      } else {
        lockReleased = true;
      }
    }
  } finally {
    clearInterval(heartbeatTimer);
    if (inFlightHeartbeat) {
      await inFlightHeartbeat;
    }
    if (!lockReleased && !lostLock) {
      try {
        await supabase.rpc('complete_expense_reevaluation', {
          p_run_id: runId,
          p_summary: summarizeOutcomes(finalOutcomesById)
        });
      } catch (cleanupErr) {
        console.error('[expenseReevaluationService] Failed to release lock in finally:', cleanupErr);
      }
    }
  }

  const finalSummary = summarizeOutcomes(finalOutcomesById);
  if (lostLock) {
    finalSummary.lostLock = true;
  }

  logActivity({
    department: 'Finance',
    action: 'Historical Expense Re-evaluation',
    description: `Re-evaluation completed: ${finalSummary.updated} categorized, ${finalSummary.unmatched} unmatched, ${finalSummary.conflicts} conflicts, ${finalSummary.skipped} skipped, ${finalSummary.failed} failed.`,
    metadata: finalSummary
  });

  return finalSummary;
}

/**
 * Targeted re-sync for active, non-manually-edited auto_rule expenses currently
 * attributed to a specific ruleId (e.g. after updating a rule to assign multiple paths).
 */
export async function resyncExpensesForRule(
  ruleId: string,
  options: Pick<ReevaluationOptions, 'excludeExpenseId' | 'updateConcurrency'> = {}
): Promise<ReevaluationSummary> {
  if (!ruleId) {
    return { updated: 0, unmatched: 0, conflicts: 0, skipped: 0, failed: 0 };
  }

  const concurrency = options.updateConcurrency ?? DEFAULT_UPDATE_CONCURRENCY;
  const finalOutcomesById = new Map<string, RowReevaluationOutcome>();

  const { data: rulePathLinks, error: linkError } = await supabase
    .from(SUPABASE_TABLES.expenseCategoryPaths)
    .select('expense_id')
    .eq('matched_rule_id', ruleId);

  if (linkError) {
    console.error('[expenseReevaluationService] Failed to query matched_rule_id links:', linkError);
    throw linkError;
  }

  const candidateIds = Array.from(
    new Set(
      (rulePathLinks || [])
        .map(r => (r as { expense_id?: unknown }).expense_id)
        .filter(id => id != null)
        .map(id => String(id))
    )
  ).filter(id => !options.excludeExpenseId || id !== String(options.excludeExpenseId));

  if (candidateIds.length === 0) {
    return { updated: 0, unmatched: 0, conflicts: 0, skipped: 0, failed: 0 };
  }

  const { data: expenseRows, error: expError } = await supabase
    .from(SUPABASE_TABLES.expenses)
    .select(
      'id, notes, amount, main_category, sub_category1, sub_category2, sub_category3, sub_category3_values, import_batch_id, manually_edited, categorization_source, row_version'
    )
    .in('id', candidateIds)
    .eq('status', 'active')
    .not('import_batch_id', 'is', null)
    .eq('manually_edited', false)
    .eq('categorization_source', 'auto_rule')
    .order('id', { ascending: true });

  if (expError) {
    console.error('[expenseReevaluationService] Failed to fetch targeted re-sync expenses:', expError);
    throw expError;
  }

  const candidates = (expenseRows || []) as EligibleExpenseRow[];
  if (candidates.length === 0) {
    return { updated: 0, unmatched: 0, conflicts: 0, skipped: 0, failed: 0 };
  }

  const activeRules = await ExpenseRuleEngine.fetchActiveRules();

  for (let i = 0; i < candidates.length; i += concurrency) {
    const chunk = candidates.slice(i, i + concurrency);
    const outcomes = await Promise.allSettled(
      chunk.map(row => evaluateAndUpdateRow(row, activeRules, true, 'targeted_rule_resync'))
    );

    for (let j = 0; j < chunk.length; j += 1) {
      const row = chunk[j];
      const outcome = outcomes[j];
      finalOutcomesById.set(
        row.id,
        outcome.status === 'rejected' ? 'failed' : outcome.value
      );
    }
  }

  const summary = summarizeOutcomes(finalOutcomesById);

  logActivity({
    department: 'Finance',
    action: 'Rule Re-sync',
    description: `Targeted rule re-sync completed: ${summary.updated} updated, ${summary.unmatched} unmatched, ${summary.conflicts} conflicts, ${summary.skipped} skipped, ${summary.failed} failed.`,
    metadata: { rule_id: ruleId, ...summary }
  });

  return summary;
}
