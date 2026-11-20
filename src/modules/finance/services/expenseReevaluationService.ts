import { supabase } from '../../../lib/supabase';
import { SUPABASE_TABLES } from '../../../config/supabaseTables';
import { logActivity } from '../../../services/activityService';
import { ExpenseRuleEngine, type ExpenseRule } from '../../../utils/rules/ExpenseRuleEngine';
import type { NormalizedTransaction } from '../../../utils/documentPipeline/types';

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
  import_batch_id: string | null;
  manually_edited: boolean;
  categorization_source?: string | null;
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
 * Conditionally updates an eligible historical expense row with an optimistic
 * manual-edit and Uncategorized guard. Returns 'skipped' if 0 rows matched.
 */
async function conditionalUpdateExpense(
  rowId: string,
  payload: Record<string, unknown>
): Promise<'ok' | 'skipped' | 'failed'> {
  const { data: updatedRows, error } = await supabase
    .from(SUPABASE_TABLES.expenses)
    .update(payload)
    .eq('id', rowId)
    .eq('status', 'active')
    .eq('manually_edited', false)
    .or('main_category.eq.Uncategorized,main_category.is.null')
    .select('id');

  if (error) {
    console.error(`[expenseReevaluationService] Failed to update row ${rowId}:`, error);
    return 'failed';
  }

  if (!updatedRows || updatedRows.length === 0) {
    return 'skipped';
  }

  return 'ok';
}

/**
 * Evaluates a single eligible historical expense row against active rules and
 * updates only category fields + categorization_source with eligibility predicates.
 */
async function evaluateAndUpdateRow(
  row: EligibleExpenseRow,
  activeRules: ExpenseRule[]
): Promise<RowReevaluationOutcome> {
  const baseTx: NormalizedTransaction = {
    sequence: 0,
    amount: Number(row.amount || 0),
    notes: row.notes || ''
  };

  const ruled = ExpenseRuleEngine.applyExpenseRules(baseTx, activeRules);

  if (ruled.ruleConflict) {
    const res = await conditionalUpdateExpense(row.id, {
      main_category: 'Uncategorized',
      sub_category1: null,
      sub_category2: null,
      sub_category3: null,
      sub_category3_values: [],
      categorization_source: 'conflict'
    });
    if (res === 'failed') return 'failed';
    if (res === 'skipped') return 'skipped';
    return 'conflict';
  }

  if (!ruled.main_category || ruled.main_category === 'Uncategorized') {
    if (row.categorization_source === 'conflict') {
      const res = await conditionalUpdateExpense(row.id, {
        main_category: 'Uncategorized',
        categorization_source: 'unassigned'
      });
      if (res === 'failed') return 'failed';
      if (res === 'skipped') return 'skipped';
    }
    return 'unmatched';
  }

  const res = await conditionalUpdateExpense(row.id, {
    main_category: ruled.main_category,
    sub_category1: ruled.sub_category1 || null,
    sub_category2: ruled.sub_category2 || null,
    sub_category3: ruled.sub_category3 || null,
    sub_category3_values: ruled.sub_category3_values || [],
    categorization_source: 'auto_rule'
  });

  if (res === 'failed') return 'failed';
  if (res === 'skipped') return 'skipped';
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
          .select('id, notes, amount, main_category, import_batch_id, manually_edited, categorization_source')
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

        for (let i = 0; i < candidates.length; i += concurrency) {
          if (lostLock) break;

          const chunk = candidates.slice(i, i + concurrency);
          const outcomes = await Promise.allSettled(
            chunk.map(row => evaluateAndUpdateRow(row, activeRules))
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
