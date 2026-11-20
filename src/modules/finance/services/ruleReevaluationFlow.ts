import type { ReevaluationOptions, ReevaluationSummary } from './expenseReevaluationService';

export type RuleReevaluationSource = 'new' | 'reused';

export interface ReevaluationToast {
  (message: string, options?: { id?: string; icon?: string }): unknown;
  loading: (message: string) => string;
  success: (message: string, options?: { id?: string }) => unknown;
  error: (message: string, options?: { id?: string }) => unknown;
}

export interface RunHistoricalReevaluationParams {
  source: RuleReevaluationSource;
  excludeExpenseId?: string;
  reevaluate: (options: ReevaluationOptions) => Promise<ReevaluationSummary>;
  onRuleSavedAndReevaluated?: () => void | Promise<void>;
  toast: ReevaluationToast;
}

/**
 * Triggers historical expense re-evaluation for a newly saved or reused rule,
 * updates the loading toast with summary counts or error details, and invokes
 * the refresh callback only when re-evaluation succeeds.
 */
export async function runHistoricalReevaluationWithToast({
  source,
  excludeExpenseId,
  reevaluate,
  onRuleSavedAndReevaluated,
  toast,
}: RunHistoricalReevaluationParams): Promise<{
  ok: boolean;
  summary?: ReevaluationSummary;
  error?: unknown;
}> {
  const isReused = source === 'reused';
  const loadingMessage = isReused
    ? 'Existing rule matched. Re-evaluating historical transactions...'
    : 'Rule saved. Re-evaluating existing transactions...';
  const prefix = isReused ? 'Existing rule reused!' : 'Rule saved!';
  const failurePrefix = isReused ? 'Existing rule matched' : 'Rule saved';

  const reevalToastId = toast.loading(loadingMessage);

  try {
    const summary = await reevaluate({
      excludeExpenseId,
    });

    if (summary.queuedRerun) {
      toast.success(`${prefix} Re-evaluation queued behind active run.`, {
        id: reevalToastId,
      });
    } else {
      const extraParts: string[] = [];
      if (summary.skipped > 0) extraParts.push(`${summary.skipped} skipped`);
      if (summary.failed > 0) extraParts.push(`${summary.failed} failed`);
      const suffix = extraParts.length > 0 ? `, ${extraParts.join(', ')}` : '';
      const msg = `${prefix} ${summary.updated} existing transactions categorized, ${summary.unmatched} unmatched, ${summary.conflicts} conflicts${suffix}.`;

      if (summary.failed > 0 && summary.updated === 0) {
        toast.error(msg, { id: reevalToastId });
      } else if (summary.conflicts > 0 || summary.failed > 0) {
        toast(msg, { id: reevalToastId, icon: '⚠️' });
      } else {
        toast.success(msg, { id: reevalToastId });
      }
    }

    await onRuleSavedAndReevaluated?.();
    return { ok: true, summary };
  } catch (reevalErr: unknown) {
    console.error('Historical expense re-evaluation failed:', reevalErr);
    const errMsg =
      reevalErr instanceof Error
        ? reevalErr.message
        : (reevalErr as { message?: string } | null)?.message || 'Unexpected error';
    toast.error(`${failurePrefix}, but historical re-evaluation failed: ${errMsg}`, {
      id: reevalToastId,
    });
    return { ok: false, error: reevalErr };
  }
}
