import { useState, useEffect, useCallback } from 'react';
import { Plus, RotateCcw, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { useExpenses, type FinanceExpense } from '../../hooks/finance/useExpenses';
import { useRBAC } from '../../hooks/useRBAC';
import { supabase } from '../../lib/supabase';
import { CategoryPathSelector, validateCategoryPathHierarchy } from './components/CategoryPathSelector';
import {
  type ExpenseCategoryPath,
  resolveExpenseCategoryPaths,
  getCategoryPathKey,
  hasDuplicateCategoryPaths,
  sanitizeCategoryPathForRpc,
  isValidRowVersion
} from './services/expenseCategoryPathUtils';
import { ExpenseRuleEngine, type ExpenseRule } from '../../utils/rules/ExpenseRuleEngine';
import {
  reevaluateHistoricalExpenses,
  resyncExpensesForRule
} from './services/expenseReevaluationService';
import { runHistoricalReevaluationWithToast } from './services/ruleReevaluationFlow';
import toast from 'react-hot-toast';

interface ExpenseCardEditorProps {
  expense: FinanceExpense;
  formId: string;
  onClose: () => void;
  onSuccess: () => void;
  onRuleSavedAndReevaluated?: () => void | Promise<void>;
}

const suggestKeyword = (notes: string | null | undefined): string => {
  if (!notes) return '';
  const parts = notes.toLowerCase().split(/[\/\-\s]+/);
  const ignored = new Set([
    'mmt', 'imps', 'neft', 'rtgs', 'upi', 'rev', 'pos', 'inf', 'vin', 'bil', 
    'trf', 'min', 'cr', 'dr', 'to', 'from', 'by', 'transfer', 'payment', 'bank', 'net'
  ]);

  for (const part of parts) {
    const cleaned = part.replace(/[^a-z0-9]/g, '');
    if (!cleaned) continue;
    if (/^\d+$/.test(cleaned)) continue;
    if (ignored.has(cleaned)) continue;
    if (/\d/.test(cleaned) && cleaned.length > 8) continue;
    return cleaned;
  }
  return '';
};

export const ExpenseCardEditor = ({
  expense,
  formId,
  onClose,
  onSuccess,
  onRuleSavedAndReevaluated
}: ExpenseCardEditorProps) => {
  const {
    saveExpenseWithCategories,
    resetExpenseToUncategorized,
    refreshExpenseById
  } = useExpenses();
  const { role, isEnabled } = useRBAC();
  const isExactAdmin = role === 'Admin' && isEnabled;
  const isImported = Boolean(expense.import_batch_id);

  const [error, setError] = useState<string | null>(null);
  const [staleVersionWarning, setStaleVersionWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState(() => suggestKeyword(expense.notes));
  const [expectedRowVersion, setExpectedRowVersion] = useState<number | undefined>(() =>
    isValidRowVersion(expense.row_version) ? expense.row_version : undefined
  );

  // Form State
  const [formData, setFormData] = useState<Partial<FinanceExpense>>({
    amount: expense.amount,
    quantity: expense.quantity || null,
    payment_mode: expense.payment_mode || '',
    bank_account: expense.bank_account || '',
    purchased_by: expense.purchased_by || '',
    approved_by: expense.approved_by || '',
    gst_status: expense.gst_status || '',
    vendor: expense.vendor || '',
    notes: expense.notes || ''
  });

  // Multi-Category Paths State
  const initialResolved = resolveExpenseCategoryPaths(expense);
  const [pathLoadError, setPathLoadError] = useState<boolean>(
    initialResolved.source === 'load_error'
  );
  const [categoryPaths, setCategoryPaths] = useState<ExpenseCategoryPath[]>(() => {
    if (initialResolved.paths.length > 0) {
      return initialResolved.paths;
    }
    return [
      {
        main_category: '',
        sub_category1: '',
        sub_category2: null,
        sub_category3: null,
        sub_category3_values: []
      }
    ];
  });
  const [existingRulePrompt, setExistingRulePrompt] = useState<{
    ruleId: string;
    keyword: string;
    paths: ExpenseCategoryPath[];
  } | null>(null);
  const [isUpdatingExistingRule, setIsUpdatingExistingRule] = useState(false);

  // Preload Vendors
  useEffect(() => {
    let mounted = true;
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from('vendors_row')
          .select('name')
          .eq('status', 'active')
          .order('name');
        
        if (!error && data && mounted) {
          setVendors(data.map(v => v.name));
        } else if (error && error.code === '42P01') {
           const retry = await supabase.from('vendors').select('name').eq('status', 'active').order('name');
           if (!retry.error && retry.data && mounted) {
             setVendors(retry.data.map(v => v.name));
           }
        }
      } catch (e) {}
    };
    fetchVendors();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? (value ? Number(value) : null) : value
    }));
  };

  const handleAddCategoryPath = () => {
    setCategoryPaths(prev => [
      ...prev,
      {
        main_category: '',
        sub_category1: '',
        sub_category2: null,
        sub_category3: null,
        sub_category3_values: []
      }
    ]);
  };

  const handleUpdateCategoryPath = (index: number, nextPath: ExpenseCategoryPath) => {
    setCategoryPaths(prev => prev.map((item, idx) => (idx === index ? nextPath : item)));
  };

  const handleRemoveCategoryPath = (index: number) => {
    if (categoryPaths.length <= 1) return;
    setCategoryPaths(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRefreshLatest = useCallback(async (syncPathsFromServer: boolean) => {
    if (!expense.id) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await refreshExpenseById(String(expense.id));
      if (!res.success || !res.data) {
        setError(res.error || 'Failed to refresh expense from database.');
        return;
      }

      if (isValidRowVersion(res.data.row_version)) {
        setExpectedRowVersion(res.data.row_version);
      }
      setStaleVersionWarning(null);

      if (!res.pathLoadError) {
        setPathLoadError(false);
        if (syncPathsFromServer) {
          const resolved = resolveExpenseCategoryPaths(res.data);
          if (resolved.paths.length > 0) {
            setCategoryPaths(resolved.paths);
          }
        }
        toast.success('Expense version refreshed. You can retry saving now.');
      } else {
        setPathLoadError(true);
        setError('Category paths could not be loaded. Please try refreshing again.');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [expense.id, refreshExpenseById]);

  const buildExpenseUpdates = (): Record<string, unknown> => {
    const updates: Record<string, unknown> = {
      quantity:
        formData.quantity !== undefined && formData.quantity !== null && String(formData.quantity) !== ''
          ? Number(formData.quantity)
          : null,
      vendor: formData.vendor || null,
      gst_status: formData.gst_status || null,
      payment_mode: formData.payment_mode || null,
      bank_account: formData.bank_account || null,
      purchased_by: formData.purchased_by || null,
      approved_by: formData.approved_by || null,
      notes: formData.notes || null
    };
    if (!isImported) {
      updates.amount = Number(formData.amount);
    }
    return updates;
  };

  const duplicateIndices = new Set<number>();
  {
    const seenKeys = new Map<string, number>();
    categoryPaths.forEach((path, idx) => {
      if (!path.main_category?.trim() || !path.sub_category1?.trim()) return;
      const key = getCategoryPathKey(path);
      if (seenKeys.has(key)) {
        duplicateIndices.add(seenKeys.get(key)!);
        duplicateIndices.add(idx);
      } else {
        seenKeys.set(key, idx);
      }
    });
  }

  const handleResetToUncategorized = async () => {
    if (!isExactAdmin) {
      setError('Only enabled Admin users can reset expense categories.');
      return;
    }
    if (pathLoadError) {
      setError('Category paths failed to load. Refresh the expense before resetting.');
      return;
    }
    if (!expense.id) return;

    setError(null);
    setStaleVersionWarning(null);
    setIsSubmitting(true);

    try {
      const res = await resetExpenseToUncategorized({
        expenseId: String(expense.id),
        expectedRowVersion,
        expenseUpdates: buildExpenseUpdates()
      });

      if (!res.success) {
        if (res.isStaleVersion) {
          setStaleVersionWarning(
            res.error || 'This expense was modified elsewhere. Refresh the version and retry.'
          );
        }
        setError(res.error || 'Failed to reset expense to uncategorized.');
        return;
      }

      if (res.data && isValidRowVersion(res.data.row_version)) {
        setExpectedRowVersion(res.data.row_version);
      }
      toast.success('Expense reset to uncategorized.');
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isExactAdmin) {
      setError('Only enabled Admin users can modify categorized expenses.');
      return;
    }

    if (pathLoadError) {
      setError(
        'Category paths failed to load. Refresh the expense before saving to prevent overwriting existing categories.'
      );
      return;
    }

    if (!isImported && (!formData.amount || Number(formData.amount) <= 0)) {
      setError('Please enter a valid Amount.');
      return;
    }

    if (categoryPaths.length === 0) {
      setError("At least one category path is required. Use 'Reset to Uncategorized' to clear categories.");
      return;
    }

    for (let i = 0; i < categoryPaths.length; i++) {
      const check = validateCategoryPathHierarchy(categoryPaths[i]);
      if (!check.valid) {
        setError(`Category Path ${i + 1}: ${check.error}`);
        return;
      }
    }

    if (hasDuplicateCategoryPaths(categoryPaths)) {
      setError('Duplicate category paths are not allowed. Please remove or change duplicate entries.');
      return;
    }

    if (saveAsRule && ExpenseRuleEngine.parseRuleKeywords(ruleKeyword).length === 0) {
      setError('Please specify at least one valid keyword for the automation rule.');
      return;
    }

    if (!expense.id) {
      setError('Expense ID is missing.');
      return;
    }

    setError(null);
    setStaleVersionWarning(null);
    setExistingRulePrompt(null);
    setIsSubmitting(true);

    const sanitizedPaths = categoryPaths.map(sanitizeCategoryPathForRpc);

    try {
      const res = await saveExpenseWithCategories({
        expenseId: String(expense.id),
        expectedRowVersion,
        expenseUpdates: buildExpenseUpdates(),
        categoryPaths: sanitizedPaths
      });

      if (!res.success) {
        if (res.isStaleVersion) {
          setStaleVersionWarning(
            res.error || 'This expense was updated by another session. Click Refresh Version and retry without losing your edits.'
          );
        }
        setError(res.error || 'Failed to update expense');
        return;
      }

      if (res.data && isValidRowVersion(res.data.row_version)) {
        setExpectedRowVersion(res.data.row_version);
      }

      if (saveAsRule && sanitizedPaths.length > 0) {
        const tokens = ExpenseRuleEngine.parseRuleKeywords(ruleKeyword);
        const signature = ExpenseRuleEngine.getKeywordSignature(tokens);
        const canonicalKeyword = tokens.join('/');

        const { data: existingRules, error: fetchErr } = await supabase
          .from('expense_rules')
          .select('*')
          .eq('keyword_signature', signature);

        if (fetchErr) {
          toast.error('Expense updated, but rule creation failed (Database Error).');
        } else if (existingRules && existingRules.length > 0) {
          const existing = existingRules[0] as ExpenseRule;
          const { data: existingPathRows, error: existingPathErr } = await supabase
            .from('expense_rule_category_paths')
            .select('id, main_category, sub_category1, sub_category2, sub_category3, sub_category3_values, sort_order')
            .eq('rule_id', existing.id)
            .order('sort_order', { ascending: true });

          const existingWithPaths: ExpenseRule = {
            ...existing,
            category_paths: !existingPathErr && Array.isArray(existingPathRows)
              ? (existingPathRows as ExpenseCategoryPath[])
              : undefined,
          };

          const existingPathsSig = ExpenseRuleEngine.getRulePathsSignature(
            ExpenseRuleEngine.getEffectiveRulePaths(existingWithPaths)
          );
          const newPathsSig = ExpenseRuleEngine.getRulePathsSignature(sanitizedPaths);
          const isSameMapping =
            existingPathsSig === newPathsSig &&
            (existing.vendor || '') === (formData.vendor || '');

          if (isSameMapping) {
            await runHistoricalReevaluationWithToast({
              source: 'reused',
              excludeExpenseId: expense.id,
              reevaluate: reevaluateHistoricalExpenses,
              onRuleSavedAndReevaluated,
              toast,
            });
          } else {
            setExistingRulePrompt({
              ruleId: existing.id,
              keyword: canonicalKeyword,
              paths: sanitizedPaths,
            });
            toast.error('Expense updated, but automation rule was NOT created because this keyword combination already has a different mapping.');
            return;
          }
        } else {
          const { error: rpcErr } = await supabase.rpc('save_expense_rule_with_paths', {
            p_keyword: canonicalKeyword,
            p_category_paths: sanitizedPaths,
            p_vendor: formData.vendor || null,
            p_payment_mode: formData.payment_mode || null,
            p_gst_status: formData.gst_status || null,
            p_purchased_by: formData.purchased_by || null,
            p_approved_by: formData.approved_by || null,
            p_notes: formData.notes || null,
            p_priority: 50,
            p_rule_id: null,
            p_update_existing: false,
          });

          if (rpcErr) {
            toast.error(`Expense updated, but rule creation failed: ${rpcErr.message}`);
          } else {
            await runHistoricalReevaluationWithToast({
              source: 'new',
              excludeExpenseId: expense.id,
              reevaluate: reevaluateHistoricalExpenses,
              onRuleSavedAndReevaluated,
              toast,
            });
          }
        }
      } else {
        toast.success('Expense updated successfully.');
      }

      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update expense');
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <>
      {!isExactAdmin && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-medium flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            Category editing and resetting are restricted to enabled Admin users. This expense is read-only for your role ({role || 'Unknown'}).
          </span>
        </div>
      )}

      {pathLoadError && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Category paths failed to load. Saving is blocked to prevent accidentally overwriting existing categories.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRefreshLatest(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-200 font-semibold shrink-0 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {staleVersionWarning && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-medium flex items-center justify-between gap-3">
          <span>{staleVersionWarning}</span>
          <button
            type="button"
            onClick={() => handleRefreshLatest(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-200 font-semibold shrink-0 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Version'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}
      
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Expense Details */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Expense Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Amount *</label>
                {isImported && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
                    <Lock className="w-3 h-3" />
                    Imported (Locked)
                  </span>
                )}
              </div>
              <input
                type="number"
                name="amount"
                required={!isImported}
                disabled={!isExactAdmin || isImported}
                value={formData.amount || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                name="quantity"
                disabled={!isExactAdmin}
                value={formData.quantity || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Vendor</label>
              <select
                name="vendor"
                disabled={!isExactAdmin}
                value={formData.vendor || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">GST Status</label>
              <select
                name="gst_status"
                disabled={!isExactAdmin}
                value={formData.gst_status || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Select GST Status</option>
                <option value="With GST">With GST</option>
                <option value="Without GST">Without GST</option>
                <option value="Exempt">Exempt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Payment */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Payment</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Payment Mode</label>
              <select
                name="payment_mode"
                disabled={!isExactAdmin}
                value={formData.payment_mode || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Select Mode</option>
                <option value="UPI">UPI</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Bank Account</label>
              <input
                type="text"
                name="bank_account"
                disabled={!isExactAdmin}
                value={formData.bank_account || ''}
                onChange={handleChange}
                placeholder="E.g. HDFC 1234"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Approval */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Approval</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Purchased By</label>
              <select
                name="purchased_by"
                disabled={!isExactAdmin}
                value={formData.purchased_by || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Select</option>
                <option value="Self">Self</option>
                <option value="Employee">Employee</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Approved By</label>
              <input
                type="text"
                name="approved_by"
                disabled={!isExactAdmin}
                value={formData.approved_by || ''}
                onChange={handleChange}
                placeholder="Manager Name"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Categories */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
              Categories ({categoryPaths.length})
            </h4>

            {isExactAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToUncategorized}
                  disabled={isSubmitting || isRefreshing || pathLoadError}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Uncategorized
                </button>
                <button
                  type="button"
                  onClick={handleAddCategoryPath}
                  disabled={isSubmitting || pathLoadError}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 bg-primary/10 border border-primary/25 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Category
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {categoryPaths.map((path, index) => (
              <CategoryPathSelector
                key={`editor-cat-path-${index}`}
                index={index}
                value={path}
                onChange={(nextPath) => handleUpdateCategoryPath(index, nextPath)}
                onRemove={() => handleRemoveCategoryPath(index)}
                canRemove={isExactAdmin && categoryPaths.length > 1}
                disabled={!isExactAdmin || pathLoadError || isSubmitting}
                variant="editor"
                isDuplicate={duplicateIndices.has(index)}
                showRuleSelector={false}
              />
            ))}
          </div>
        </div>

        {/* Section 5: Additional */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Additional</h4>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Notes</label>
            <textarea
              name="notes"
              disabled={!isExactAdmin}
              value={formData.notes || ''}
              onChange={handleChange as any}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Section 6: Automation */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`saveAsRule-${expense.id}`}
              disabled={!isExactAdmin}
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background bg-background cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor={`saveAsRule-${expense.id}`} className={`text-sm font-medium text-main select-none ${!isExactAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
              Save this correction as an automation rule for future transactions
            </label>
          </div>
          
          {saveAsRule && (
            <div className="space-y-2 pl-6 fade-in">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Keyword Confirmation</label>
              <input
                type="text"
                required
                disabled={!isExactAdmin}
                value={ruleKeyword}
                onChange={(e) => setRuleKeyword(e.target.value)}
                placeholder="Enter automation keyword(s) (e.g., wififoundersoff/airte/paymentsb)"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary font-mono disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-muted leading-tight">
                Separate multiple keywords using /. All keywords must be present in the transaction description.
                {categoryPaths.length > 1 && ` All ${categoryPaths.length} configured category paths will be saved to this rule.`}
              </p>

              {existingRulePrompt && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                  <p className="text-xs text-amber-200 font-medium">
                    An automation rule already exists for <span className="font-mono">{existingRulePrompt.keyword}</span> with a different category mapping. Update it with all {existingRulePrompt.paths.length} path(s) and re-sync matching transactions?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingExistingRule}
                      onClick={async () => {
                        setIsUpdatingExistingRule(true);
                        try {
                          const { error: updErr } = await supabase.rpc('save_expense_rule_with_paths', {
                            p_keyword: existingRulePrompt.keyword,
                            p_category_paths: existingRulePrompt.paths,
                            p_vendor: formData.vendor || null,
                            p_payment_mode: formData.payment_mode || null,
                            p_gst_status: formData.gst_status || null,
                            p_purchased_by: formData.purchased_by || null,
                            p_approved_by: formData.approved_by || null,
                            p_notes: formData.notes || null,
                            p_rule_id: existingRulePrompt.ruleId,
                            p_update_existing: true,
                          });
                          if (updErr) {
                            toast.error(`Failed to update existing rule: ${updErr.message}`);
                            return;
                          }
                          await runHistoricalReevaluationWithToast({
                            source: 'reused',
                            excludeExpenseId: expense.id,
                            reevaluate: async (opts) => {
                              const hist = await reevaluateHistoricalExpenses(opts);
                              const resync = await resyncExpensesForRule(existingRulePrompt.ruleId, {
                                excludeExpenseId: opts.excludeExpenseId,
                              });
                              return {
                                updated: hist.updated + resync.updated,
                                unmatched: hist.unmatched + resync.unmatched,
                                conflicts: hist.conflicts + resync.conflicts,
                                skipped: hist.skipped + resync.skipped,
                                failed: hist.failed + resync.failed,
                                queuedRerun: hist.queuedRerun,
                                lostLock: hist.lostLock,
                              };
                            },
                            onRuleSavedAndReevaluated,
                            toast,
                          });
                          setExistingRulePrompt(null);
                          onSuccess();
                        } finally {
                          setIsUpdatingExistingRule(false);
                        }
                      }}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 transition-colors disabled:opacity-50"
                    >
                      {isUpdatingExistingRule ? 'Updating...' : 'Update Existing Rule & Re-sync'}
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingExistingRule}
                      onClick={() => {
                        setExistingRulePrompt(null);
                        onSuccess();
                      }}
                      className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      Keep Existing Rule
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </>
  );
};
