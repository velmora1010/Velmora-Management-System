import React from 'react';
import { Edit2, Trash2, Receipt } from 'lucide-react';
import type { FinanceBill } from '../../hooks/finance/useBills';

interface BillCardProps {
  bill: FinanceBill;
  departmentName: string;
  categoryHierarchy: string;
  onEdit: () => void;
  onDelete: () => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  renderEditForm?: () => React.ReactNode;
  formId?: string;
  formatDate: (date: string | null) => string;
}

export const BillCard: React.FC<BillCardProps> = ({
  bill,
  departmentName,
  categoryHierarchy,
  onEdit,
  onDelete,
  isEditing = false,
  onCancelEdit,
  renderEditForm,
  formId,
  formatDate
}) => {
  const getStatusBadgeStyle = (status: string | null | undefined) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (s === 'overdue') {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    if (s === 'pending' || s === 'unpaid') {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  };

  const statusLabel = bill.bill_status || 'Pending';

  return (
    <div className="bg-slate-800/60 hover:bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-5 transition-all duration-200 hover:shadow-[0_4px_25px_rgba(0,0,0,0.25)] flex flex-col justify-between group relative overflow-hidden backdrop-blur-sm fade-in">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Receipt size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-100 tracking-tight leading-snug truncate" title={departmentName}>
              {isEditing ? 'Edit Mode' : departmentName}
            </h3>
            {!isEditing && (
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5" title={categoryHierarchy}>
                {categoryHierarchy || 'General'}
              </p>
            )}
          </div>
        </div>

        {/* Top Right Actions / Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing ? (
            <>
              <span className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${getStatusBadgeStyle(bill.bill_status)}`}>
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={onEdit}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50 text-slate-400 hover:text-purple-300 rounded-lg transition-colors"
                title="Edit Bill"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                title="Archive Bill"
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

          {/* Grouped Information Grid (Campaign-inspired) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
            {/* Amount */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Amount
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-100 block">
                ₹{bill.amount != null ? Number(bill.amount).toLocaleString('en-IN') : '-'}
              </span>
            </div>

            {/* Due Date */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Due Date
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-200 block truncate">
                {formatDate(bill.due_date)}
              </span>
            </div>

            {/* Payment Type */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Payment Type
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate">
                {bill.payment_type || '-'}
              </span>
            </div>

            {/* Billing Cycle */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Billing Cycle
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate">
                {bill.billing_cycle || '-'}
              </span>
            </div>

            {/* Account */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Account
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate" title={bill.account || '-'}>
                {bill.account || '-'}
              </span>
            </div>

            {/* Mode of Pay */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Mode of Pay
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate" title={bill.mode_of_pay || '-'}>
                {bill.mode_of_pay || '-'}
              </span>
            </div>

            {/* Sub Category 3 Tags (if present) */}
            {bill.sub_category3_values && bill.sub_category3_values.length > 0 && (
              <div className="col-span-2 pt-2 border-t border-slate-700/40 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase font-semibold text-slate-500 mr-0.5">Tags:</span>
                {bill.sub_category3_values.map((val) => (
                  <span
                    key={val}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-700/60"
                  >
                    {val}
                  </span>
                ))}
              </div>
            )}

            {/* Notes (if present) */}
            {bill.notes && (
              <div className="col-span-2 pt-2 border-t border-slate-700/40">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Notes</span>
                <p className="text-xs text-slate-400 line-clamp-2 mt-0.5" title={bill.notes}>
                  {bill.notes}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
