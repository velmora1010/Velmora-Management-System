import React, { useState, useEffect, useCallback } from 'react';
import { X, Receipt, AlertCircle, Plus, RotateCcw, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
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

interface ExpenseFormProps {
  expense: FinanceExpense | null;
  onClose: () => void;
  onSuccess: () => void;
  isInline?: boolean;
  formId?: string;
}

export const ExpenseForm = ({ expense, onClose, onSuccess, isInline, formId = "expenseForm" }: ExpenseFormProps) => {
  const {
    addExpense,
    saveExpenseWithCategories,
    resetExpenseToUncategorized,
    refreshExpenseById
  } = useExpenses();
  const { role, isEnabled } = useRBAC();
  const isEditMode = Boolean(expense?.id);
  const isExactAdmin = role === 'Admin' && isEnabled;
  const isImported = Boolean(expense?.import_batch_id);
  const isReadOnlyEdit = isEditMode && !isExactAdmin;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleVersionWarning, setStaleVersionWarning] = useState<string | null>(null);
  const [expectedRowVersion, setExpectedRowVersion] = useState<number | undefined>(() =>
    expense && isValidRowVersion(expense.row_version) ? expense.row_version : undefined
  );

  const [vendors, setVendors] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<FinanceExpense>>(
    expense || {
      amount: null,
      quantity: null,
      vendor: '',
      gst_status: '',
      payment_mode: '',
      bank_account: '',
      purchased_by: '',
      approved_by: '',
      notes: '',
    }
  );

  // Multi-Category Paths State (single path for Create mode; multi-path for Edit mode)
  const initialResolved = expense
    ? resolveExpenseCategoryPaths(expense)
    : { paths: [], source: 'none' as const, hasSyncWarning: false };
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
          // fallback just in case the name is vendors instead of vendors_row
          const retry = await supabase.from('vendors').select('name').eq('status', 'active').order('name');
          if (!retry.error && retry.data && mounted) {
            setVendors(retry.data.map(v => v.name));
          }
        }
      } catch (e) {
        console.error('Error fetching vendors', e);
      }
    };
    fetchVendors();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'amount' || name === 'quantity') ? (value ? Number(value) : null) : value
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
    if (!expense?.id) return;
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
      } else {
        setPathLoadError(true);
        setError('Category paths could not be loaded. Please try refreshing again.');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [expense?.id, refreshExpenseById]);

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
    if (!isEditMode || !isExactAdmin) {
      setError('Only enabled Admin users can reset expense categories.');
      return;
    }
    if (pathLoadError) {
      setError('Category paths failed to load. Refresh the expense before resetting.');
      return;
    }
    if (!expense?.id) return;

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
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && !isExactAdmin) {
      setError('Only enabled Admin users can modify categorized expenses.');
      return;
    }

    if (isEditMode && pathLoadError) {
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
      setError('At least one category path is required.');
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

    setIsSubmitting(true);
    setError(null);
    setStaleVersionWarning(null);

    try {
      if (isEditMode && expense?.id) {
        const res = await saveExpenseWithCategories({
          expenseId: String(expense.id),
          expectedRowVersion,
          expenseUpdates: buildExpenseUpdates(),
          categoryPaths: categoryPaths.map(sanitizeCategoryPathForRpc)
        });
        if (!res.success) {
          if (res.isStaleVersion) {
            setStaleVersionWarning(
              res.error || 'This expense was updated elsewhere. Refresh version and retry without losing your edits.'
            );
          }
          setError(res.error || 'Failed to save expense');
          return;
        }
        if (res.data && isValidRowVersion(res.data.row_version)) {
          setExpectedRowVersion(res.data.row_version);
        }
      } else {
        // Keep new expense creation workflow unchanged
        const primaryPath = sanitizeCategoryPathForRpc(categoryPaths[0]);
        const payload = {
          ...formData,
          main_category: primaryPath.main_category,
          sub_category1: primaryPath.sub_category1,
          sub_category2: primaryPath.sub_category2 || '',
          sub_category3: primaryPath.sub_category3 || '',
          sub_category3_values: primaryPath.sub_category3_values,
        };
        const res = await addExpense(payload as FinanceExpense);
        if (!res.success) throw new Error(res.error);
      }
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save expense');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full h-[42px] bg-slate-900/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 placeholder:text-slate-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed";

  const selectClasses = "w-full h-[42px] bg-slate-900/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed";

  const textareaClasses = "w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 placeholder:text-slate-500 transition-all resize-none disabled:opacity-40 disabled:cursor-not-allowed";
  const isFormFieldsDisabled = isReadOnlyEdit || (isEditMode && pathLoadError);

  const formContent = (
    <>
      {isReadOnlyEdit && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-sm font-medium flex items-center gap-2.5">
          <Lock size={18} className="shrink-0 text-amber-400" />
          <span>
            Category editing and resetting are restricted to enabled Admin users. This expense is read-only for your role ({role || 'Unknown'}).
          </span>
        </div>
      )}

      {isEditMode && pathLoadError && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-400" />
            <span>
              Category paths failed to load. Saving is blocked to prevent overwriting existing categories.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRefreshLatest(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs font-semibold text-amber-200 shrink-0 transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {staleVersionWarning && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-medium flex items-center justify-between gap-3">
          <span>{staleVersionWarning}</span>
          <button
            type="button"
            onClick={() => handleRefreshLatest(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs font-semibold text-amber-200 shrink-0 transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Version'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium flex items-center gap-2.5">
          <AlertCircle size={18} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        {/* Section A: Categorization */}
        <div className="bg-slate-800/40 border border-slate-700/70 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Categorization {isEditMode ? `(${categoryPaths.length})` : ''}
              </h3>
            </div>

            {isEditMode && isExactAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToUncategorized}
                  disabled={isSubmitting || isRefreshing || pathLoadError}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} />
                  Reset to Uncategorized
                </button>
                <button
                  type="button"
                  onClick={handleAddCategoryPath}
                  disabled={isSubmitting || pathLoadError}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  Add Category
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {categoryPaths.map((path, index) => (
              <CategoryPathSelector
                key={`form-cat-path-${index}`}
                index={index}
                value={path}
                onChange={(nextPath) => handleUpdateCategoryPath(index, nextPath)}
                onRemove={() => handleRemoveCategoryPath(index)}
                canRemove={isEditMode && isExactAdmin && categoryPaths.length > 1}
                disabled={isReadOnlyEdit || (isEditMode && pathLoadError) || isSubmitting}
                showHeader={isEditMode}
                variant="form"
                isDuplicate={duplicateIndices.has(index)}
              />
            ))}
          </div>
        </div>

        {/* Section B: Expense Details */}
        <div className="bg-slate-800/40 border border-slate-700/70 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Expense Details
              </h3>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              Amount, quantity, vendor, and tax information
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Amount <span className="text-purple-400">*</span>
                </label>
                {isImported && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                    <Lock size={12} />
                    Imported (Locked)
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  name="amount"
                  required={!isImported}
                  disabled={isFormFieldsDisabled || isImported}
                  value={formData.amount || ''}
                  onChange={handleChange}
                  className={`${inputClasses} pl-8`}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Quantity
              </label>
              <input
                type="number"
                name="quantity"
                disabled={isFormFieldsDisabled}
                value={formData.quantity || ''}
                onChange={handleChange}
                className={inputClasses}
                placeholder="e.g., 10"
              />
            </div>

            {/* Vendor */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Vendor
              </label>
              <select
                name="vendor"
                disabled={isFormFieldsDisabled}
                value={formData.vendor || ''}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select Vendor</option>
                {vendors.map(v => (
                  <option key={v} value={v} className="bg-slate-900 text-slate-100">
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* GST Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                GST Status
              </label>
              <select
                name="gst_status"
                disabled={isFormFieldsDisabled}
                value={formData.gst_status || ''}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select GST Status</option>
                <option value="Included" className="bg-slate-900 text-slate-100">Included</option>
                <option value="Excluded" className="bg-slate-900 text-slate-100">Excluded</option>
                <option value="Exempt" className="bg-slate-900 text-slate-100">Exempt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section C: Additional Details */}
        <div className="bg-slate-800/40 border border-slate-700/70 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Additional Details
              </h3>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              Payment mode, accounts, and approvals
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Mode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Payment Mode
              </label>
              <select
                name="payment_mode"
                disabled={isFormFieldsDisabled}
                value={formData.payment_mode || ''}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select Payment Mode</option>
                <option value="GPay" className="bg-slate-900 text-slate-100">GPay</option>
                <option value="Account Transfer" className="bg-slate-900 text-slate-100">Account Transfer</option>
                <option value="Cash" className="bg-slate-900 text-slate-100">Cash</option>
                <option value="Card" className="bg-slate-900 text-slate-100">Card</option>
              </select>
            </div>

            {/* Bank Account */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Bank Account
              </label>
              <input
                type="text"
                name="bank_account"
                disabled={isFormFieldsDisabled}
                value={formData.bank_account || ''}
                onChange={handleChange}
                className={inputClasses}
                placeholder="e.g. ICICI Current"
              />
            </div>

            {/* Purchased By */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Purchased By
              </label>
              <input
                type="text"
                name="purchased_by"
                disabled={isFormFieldsDisabled}
                value={formData.purchased_by || ''}
                onChange={handleChange}
                className={inputClasses}
                placeholder="Name of purchaser"
              />
            </div>

            {/* Approved By */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Approved By
              </label>
              <input
                type="text"
                name="approved_by"
                disabled={isFormFieldsDisabled}
                value={formData.approved_by || ''}
                onChange={handleChange}
                className={inputClasses}
                placeholder="Name of approver"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                rows={2}
                disabled={isFormFieldsDisabled}
                value={formData.notes || ''}
                onChange={handleChange}
                className={textareaClasses}
                placeholder="Additional context or references..."
              />
            </div>
          </div>
        </div>
      </form>
    </>
  );

  if (isInline) {
    return formContent;
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/80 w-full rounded-2xl shadow-xl flex flex-col fade-in backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/60 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Receipt size={20} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              {expense ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Enter expense details and categorization.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
        {formContent}
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 border-t border-slate-700/60 bg-slate-900/60 shrink-0 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          disabled={isReadOnlyEdit || (isEditMode && pathLoadError) || isSubmitting}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white shadow-md shadow-purple-600/25 hover:bg-purple-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            'Save Expense'
          )}
        </button>
      </div>
    </div>
  );
};
