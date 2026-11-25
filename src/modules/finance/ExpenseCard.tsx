import React from 'react';
import { Edit2, Trash2, Receipt } from 'lucide-react';
import type { FinanceExpense } from '../../hooks/finance/useExpenses';
import {
  resolveExpenseCategoryPaths,
  getCategoryCompletionStatus,
  type CategoryCompletionStatus
} from './services/expenseCategoryPathUtils';

const STATUS_BADGE_MAP: Record<CategoryCompletionStatus, { label: string; className: string }> = {
  fully_categorized: {
    label: 'Fully Categorized',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  uncategorized: {
    label: 'Uncategorized',
    className: 'bg-slate-700/60 text-slate-300 border-slate-600/60'
  },
  unsynced_scalar_fallback: {
    label: 'Legacy / Unsynced',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  conflict: {
    label: 'Conflict',
    className: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  },
  load_error: {
    label: 'Load Error',
    className: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  }
};

interface ExpenseCardProps {
  expense: FinanceExpense;
  onEdit: () => void;
  onDelete: () => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  renderEditForm?: () => React.ReactNode;
  formId?: string;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  onEdit,
  onDelete,
  isEditing = false,
  onCancelEdit,
  renderEditForm,
  formId
}) => {
  const resolved = resolveExpenseCategoryPaths(expense);
  const completionStatus = getCategoryCompletionStatus(expense);
  const statusBadge = STATUS_BADGE_MAP[completionStatus];
  const primaryPath = resolved.paths[0] ?? null;

  const departmentName =
    completionStatus === 'load_error'
      ? 'Categories Unavailable'
      : completionStatus === 'conflict'
      ? 'Categorization Conflict'
      : primaryPath?.main_category || 'Uncategorized';

  const categoryHierarchy =
    completionStatus === 'load_error'
      ? 'Failed to load category paths'
      : completionStatus === 'conflict'
      ? 'Conflicting category paths detected'
      : primaryPath
      ? [
          primaryPath.sub_category1,
          primaryPath.sub_category2,
          primaryPath.sub_category3
        ]
          .filter(Boolean)
          .join(' › ') || 'General'
      : 'General';

  const vendorName = expense.vendor?.trim() || 'No Vendor';
  const showAllPathsSection =
    resolved.paths.length > 1 ||
    resolved.paths.some(p => (p.sub_category3_values?.length ?? 0) > 0);

  return (
    <div className="bg-slate-800/60 hover:bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-5 transition-all duration-200 hover:shadow-[0_4px_25px_rgba(0,0,0,0.25)] flex flex-col justify-between group relative overflow-hidden backdrop-blur-sm fade-in">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-[160px]">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Receipt size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-base font-bold text-slate-100 tracking-tight leading-snug truncate" title={departmentName}>
                {isEditing ? 'Edit Mode' : departmentName}
              </h3>
              {!isEditing && resolved.paths.length > 1 && (
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  +{resolved.paths.length - 1} more
                </span>
              )}
            </div>
            {!isEditing && (
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5" title={categoryHierarchy}>
                {categoryHierarchy}
              </p>
            )}
            {!isEditing && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top Right Actions / Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing ? (
            <>
              <span
                className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full border bg-slate-900/90 text-slate-300 border-slate-700/70 max-w-[130px] truncate"
                title={vendorName}
              >
                {vendorName}
              </span>
              <button
                type="button"
                onClick={onEdit}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50 text-slate-400 hover:text-purple-300 rounded-lg transition-colors"
                title="Edit Expense"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                title="Archive Expense"
              >
                <Trash2 size={13} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (formId) {
                    const form = document.getElementById(formId) as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-600/20 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editing State Content */}
      {isEditing && renderEditForm ? (
        <div className="mt-4 border-t border-slate-700/60 pt-4 fade-in">
          {renderEditForm()}
        </div>
      ) : (
        <>
          {/* Subtle Divider */}
          <div className="h-px bg-slate-700/60 w-full mb-4"></div>

          {/* Grouped Information Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
            {/* Amount */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Amount
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-100 block">
                ₹{expense.amount != null ? Number(expense.amount).toLocaleString('en-IN') : '-'}
              </span>
            </div>

            {/* Payment Mode */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Payment Mode
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-200 block truncate" title={expense.payment_mode || '-'}>
                {expense.payment_mode || '-'}
              </span>
            </div>

            {/* Purchased By */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Purchased By
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate" title={expense.purchased_by || '-'}>
                {expense.purchased_by || '-'}
              </span>
            </div>

            {/* GST Status */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                GST Status
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate">
                {expense.gst_status || '-'}
              </span>
            </div>

            {/* Bank Account */}
            {expense.bank_account && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Bank Account
                </span>
                <span className="text-xs font-medium text-slate-300 block truncate" title={expense.bank_account}>
                  {expense.bank_account}
                </span>
              </div>
            )}

            {/* Approved By */}
            {expense.approved_by && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Approved By
                </span>
                <span className="text-xs font-medium text-slate-300 block truncate" title={expense.approved_by}>
                  {expense.approved_by}
                </span>
              </div>
            )}

            {/* Quantity (if present) */}
            {expense.quantity != null && expense.quantity > 0 && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Quantity
                </span>
                <span className="text-xs font-medium text-slate-300 block truncate">
                  {expense.quantity}
                </span>
              </div>
            )}

            {/* Assigned Category Paths & Level 5 Tags */}
            {showAllPathsSection && (
              <div className="col-span-2 pt-2 border-t border-slate-700/40 space-y-2">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                  {resolved.paths.length > 1 ? `Category Paths (${resolved.paths.length})` : 'Category Tags'}
                </span>
                <div className="space-y-1.5">
                  {resolved.paths.map((path, idx) => {
                    const pathLabel = [
                      path.main_category,
                      path.sub_category1,
                      path.sub_category2,
                      path.sub_category3
                    ]
                      .filter(Boolean)
                      .join(' › ');
                    return (
                      <div
                        key={`card-path-${idx}-${path.path_signature || pathLabel}`}
                        className="rounded-lg bg-slate-900/60 border border-slate-700/50 px-2.5 py-1.5 space-y-1"
                      >
                        {resolved.paths.length > 1 && (
                          <div className="text-[11px] font-medium text-slate-200 truncate" title={pathLabel}>
                            {pathLabel}
                          </div>
                        )}
                        {path.sub_category3_values && path.sub_category3_values.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            {path.sub_category3_values.map((val) => (
                              <span
                                key={`${idx}-${val}`}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-700/60"
                              >
                                {val}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes (if present) */}
            {expense.notes && (
              <div className="col-span-2 pt-2 border-t border-slate-700/40">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Notes</span>
                <p className="text-xs text-slate-400 line-clamp-2 mt-0.5" title={expense.notes}>
                  {expense.notes}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
