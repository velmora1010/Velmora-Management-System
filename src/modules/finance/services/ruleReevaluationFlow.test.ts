import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  runHistoricalReevaluationWithToast,
  type ReevaluationToast,
} from './ruleReevaluationFlow';
import type { ReevaluationOptions, ReevaluationSummary } from './expenseReevaluationService';

interface ToastCall {
  type: 'loading' | 'success' | 'error' | 'warn';
  message: string;
  options?: { id?: string; icon?: string };
}

function createMockToast() {
  const calls: ToastCall[] = [];
  let nextId = 1;

  const toastFn = ((message: string, options?: { id?: string; icon?: string }) => {
    calls.push({ type: 'warn', message, options });
    return options?.id ?? `toast-${nextId++}`;
  }) as ReevaluationToast;

  toastFn.loading = (message: string) => {
    const id = `toast-${nextId++}`;
    calls.push({ type: 'loading', message, options: { id } });
    return id;
  };

  toastFn.success = (message: string, options?: { id?: string }) => {
    calls.push({ type: 'success', message, options });
    return options?.id ?? 'success';
  };

  toastFn.error = (message: string, options?: { id?: string }) => {
    calls.push({ type: 'error', message, options });
    return options?.id ?? 'error';
  };

  return { toast: toastFn, calls };
}

async function runTests() {
  console.log('=== TEST SUITE: Rule Save & Reuse Historical Re-evaluation Flow ===');

  // 1. New rule insertion triggers re-evaluation with excludeExpenseId & callback
  {
    const { toast, calls } = createMockToast();
    const reevalCalls: ReevaluationOptions[] = [];
    let callbackCount = 0;

    const result = await runHistoricalReevaluationWithToast({
      source: 'new',
      excludeExpenseId: '9455',
      reevaluate: async (opts) => {
        reevalCalls.push(opts);
        return { updated: 3, unmatched: 1, conflicts: 0, skipped: 1, failed: 0 };
      },
      onRuleSavedAndReevaluated: async () => {
        callbackCount += 1;
      },
      toast,
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(reevalCalls, [{ excludeExpenseId: '9455' }]);
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(calls[0].type, 'loading');
    assert.strictEqual(calls[0].message, 'Rule saved. Re-evaluating existing transactions...');
    assert.strictEqual(calls[1].type, 'success');
    assert.strictEqual(
      calls[1].message,
      'Rule saved! 3 existing transactions categorized, 1 unmatched, 0 conflicts, 1 skipped.'
    );
    assert.strictEqual(calls[1].options?.id, calls[0].options?.id);
    console.log('PASS: Test 1 - New rule insertion triggers re-evaluation & summary toast');
  }

  // 2. Existing identical rule reuse triggers re-evaluation with excludeExpenseId & callback
  {
    const { toast, calls } = createMockToast();
    const reevalCalls: ReevaluationOptions[] = [];
    let callbackCount = 0;

    const result = await runHistoricalReevaluationWithToast({
      source: 'reused',
      excludeExpenseId: '9455',
      reevaluate: async (opts) => {
        reevalCalls.push(opts);
        return { updated: 3, unmatched: 0, conflicts: 0, skipped: 0, failed: 0 };
      },
      onRuleSavedAndReevaluated: async () => {
        callbackCount += 1;
      },
      toast,
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(reevalCalls, [{ excludeExpenseId: '9455' }]);
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(calls[0].type, 'loading');
    assert.strictEqual(
      calls[0].message,
      'Existing rule matched. Re-evaluating historical transactions...'
    );
    assert.strictEqual(calls[1].type, 'success');
    assert.strictEqual(
      calls[1].message,
      'Existing rule reused! 3 existing transactions categorized, 0 unmatched, 0 conflicts.'
    );
    assert.strictEqual(calls[1].options?.id, calls[0].options?.id);
    console.log('PASS: Test 2 - Existing identical rule reuse triggers re-evaluation & reuse toast');
  }

  // 3. Concurrent re-evaluation (queuedRerun) reports queued status & still refreshes
  {
    const { toast, calls } = createMockToast();
    let callbackCount = 0;

    const result = await runHistoricalReevaluationWithToast({
      source: 'reused',
      excludeExpenseId: '9455',
      reevaluate: async () => ({
        updated: 0,
        unmatched: 0,
        conflicts: 0,
        skipped: 0,
        failed: 0,
        queuedRerun: true,
      }),
      onRuleSavedAndReevaluated: () => {
        callbackCount += 1;
      },
      toast,
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(calls[1].type, 'success');
    assert.strictEqual(
      calls[1].message,
      'Existing rule reused! Re-evaluation queued behind active run.'
    );
    console.log('PASS: Test 3 - Concurrent re-evaluation (queuedRerun) handled safely');
  }

  // 4. Conflicts or partial failures show warning toast; all-failed shows error toast
  {
    const { toast: toastWarn, calls: warnCalls } = createMockToast();
    await runHistoricalReevaluationWithToast({
      source: 'reused',
      excludeExpenseId: '9455',
      reevaluate: async (): Promise<ReevaluationSummary> => ({
        updated: 2,
        unmatched: 1,
        conflicts: 1,
        skipped: 0,
        failed: 0,
      }),
      toast: toastWarn,
    });
    assert.strictEqual(warnCalls[1].type, 'warn');
    assert.strictEqual(warnCalls[1].options?.icon, '⚠️');

    const { toast: toastAllFail, calls: failCalls } = createMockToast();
    await runHistoricalReevaluationWithToast({
      source: 'reused',
      excludeExpenseId: '9455',
      reevaluate: async (): Promise<ReevaluationSummary> => ({
        updated: 0,
        unmatched: 0,
        conflicts: 0,
        skipped: 0,
        failed: 2,
      }),
      toast: toastAllFail,
    });
    assert.strictEqual(failCalls[1].type, 'error');
    assert.ok(failCalls[1].message.includes('2 failed'));
    console.log('PASS: Test 4 - Conflict warning and failure-only error toasts work accurately');
  }

  // 5. Re-evaluation error reports clear error toast and does NOT invoke refresh callback
  {
    const { toast, calls } = createMockToast();
    let callbackCount = 0;

    const origError = console.error;
    console.error = () => {};
    try {
      const result = await runHistoricalReevaluationWithToast({
        source: 'reused',
        excludeExpenseId: '9455',
        reevaluate: async () => {
          throw new Error('RPC lock timeout');
        },
        onRuleSavedAndReevaluated: () => {
          callbackCount += 1;
        },
        toast,
      });

      assert.strictEqual(result.ok, false);
      assert.strictEqual(callbackCount, 0);
      assert.strictEqual(calls.length, 2);
      assert.strictEqual(calls[1].type, 'error');
      assert.strictEqual(
        calls[1].message,
        'Existing rule matched, but historical re-evaluation failed: RPC lock timeout'
      );
      assert.strictEqual(calls[1].options?.id, calls[0].options?.id);
    } finally {
      console.error = origError;
    }
    console.log('PASS: Test 5 - Re-evaluation errors report failure clearly without calling refresh');
  }

  // 6. Verify ExpenseCardEditor.tsx preserves duplicate-rule conflict guard, exclusion, and reuse flow
  {
    const editorPath = path.resolve(
      process.cwd(),
      'src/modules/finance/ExpenseCardEditor.tsx'
    );
    const editorSrc = fs.readFileSync(editorPath, 'utf8');
    assert.ok(
      editorSrc.includes(
        "Expense updated, but automation rule was NOT created because this keyword combination already has a different mapping."
      ),
      'Different-mapping duplicate guard must be preserved'
    );
    assert.ok(
      editorSrc.includes("source: 'reused'") &&
        editorSrc.includes("source: 'new'") &&
        editorSrc.includes('excludeExpenseId: expense.id'),
      'Both reused and new rule branches must pass excludeExpenseId: expense.id'
    );
    console.log('PASS: Test 6 - ExpenseCardEditor preserves conflict guard & current-expense exclusion');
  }

  // 7. Verify expenseReevaluationService.ts preserves manual-edit protection, exclusion, and lock recovery
  {
    const servicePath = path.resolve(
      process.cwd(),
      'src/modules/finance/services/expenseReevaluationService.ts'
    );
    const serviceSrc = fs.readFileSync(servicePath, 'utf8');
    assert.ok(
      serviceSrc.includes(".eq('manually_edited', false)"),
      'Manual-edit protection predicate must be present'
    );
    assert.ok(
      serviceSrc.includes(".or('main_category.eq.Uncategorized,main_category.is.null')"),
      'Uncategorized-only predicate must be present'
    );
    assert.ok(
      serviceSrc.includes('options.excludeExpenseId && row.id === options.excludeExpenseId'),
      'Current expense exclusion check must be present'
    );
    assert.ok(
      serviceSrc.includes('p_stale_after_seconds') &&
        serviceSrc.includes('heartbeat_expense_reevaluation') &&
        serviceSrc.includes('complete_expense_reevaluation'),
      'Concurrent lock, heartbeat, and stale lock recovery RPCs must be present'
    );
    console.log('PASS: Test 7 - expenseReevaluationService preserves manual protection & lock safety');
  }

  console.log('ALL 7 REGRESSION TESTS PASSED.');
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
