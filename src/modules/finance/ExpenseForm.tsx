import React, { useState, useEffect, useCallback } from 'react';
import { X, Receipt, AlertCircle } from 'lucide-react';
import { useExpenses, type FinanceExpense } from '../../hooks/finance/useExpenses';
import { supabase } from '../../lib/supabase';
import { MultiSelect } from '../../components/ui/MultiSelect';

interface ExpenseFormProps {
  expense: FinanceExpense | null;
  onClose: () => void;
  onSuccess: () => void;
  isInline?: boolean;
  formId?: string;
}

export const ExpenseForm = ({ expense, onClose, onSuccess, isInline, formId = "expenseForm" }: ExpenseFormProps) => {
  const { addExpense, updateExpense } = useExpenses();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Hierarchy State
  const [selectedMain, setSelectedMain] = useState(expense?.main_category || '');
  const [selectedSub1, setSelectedSub1] = useState(expense?.sub_category1 || '');
  const [selectedSub2, setSelectedSub2] = useState(expense?.sub_category2 || '');
  const [selectedSub3, setSelectedSub3] = useState(expense?.sub_category3 || '');
  const [selectedSub4Values, setSelectedSub4Values] = useState<string[]>(
    expense?.sub_category3_values || []
  );

  // Options State
  const [mainOptions, setMainOptions] = useState<string[]>([]);
  const [sub1Options, setSub1Options] = useState<string[]>([]);
  const [sub2Options, setSub2Options] = useState<string[]>([]);
  const [sub3Options, setSub3Options] = useState<string[]>([]);
  const [sub4Options, setSub4Options] = useState<string[]>([]);

  const [isLoadingLevels, setIsLoadingLevels] = useState(true);

  // Reusable Loader
  const loadOptions = useCallback(async (
    targetCol: string,
    filters: Record<string, string> = {}
  ): Promise<string[]> => {
    try {
      let query = supabase.from('finance_categories_rows').select(targetCol).eq('status', 'active');
      for (const [key, val] of Object.entries(filters)) {
        if (val) query = query.eq(key, val);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      const values = data.map((row: any) => row[targetCol]).filter(Boolean);
      return Array.from(new Set(values)) as string[];
    } catch (err) {
      console.error(`Failed to load ${targetCol} options:`, err);
      return [];
    }
  }, []);

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

  // Preload & Cascade Fetching
  useEffect(() => {
    let mounted = true;
    const preload = async () => {
      setIsLoadingLevels(true);

      const pMain = loadOptions('main');
      const pSub1 = selectedMain ? loadOptions('sub1', { main: selectedMain }) : Promise.resolve([]);
      const pSub2 = selectedMain && selectedSub1 ? loadOptions('sub2', { main: selectedMain, sub1: selectedSub1 }) : Promise.resolve([]);
      const pSub3 = selectedMain && selectedSub1 && selectedSub2 ? loadOptions('sub3', { main: selectedMain, sub1: selectedSub1, sub2: selectedSub2 }) : Promise.resolve([]);
      const pSub4 = selectedMain && selectedSub1 && selectedSub2 && selectedSub3 ? loadOptions('sub_sub_sub_category', { main: selectedMain, sub1: selectedSub1, sub2: selectedSub2, sub3: selectedSub3 }) : Promise.resolve([]);

      const [m, s1, s2, s3, s4] = await Promise.all([pMain, pSub1, pSub2, pSub3, pSub4]);

      if (mounted) {
        setMainOptions(m);
        setSub1Options(s1);
        setSub2Options(s2);
        setSub3Options(s3);
        setSub4Options(s4);
        setIsLoadingLevels(false);
      }
    };
    preload();
    return () => { mounted = false; };
  }, [loadOptions, selectedMain, selectedSub1, selectedSub2, selectedSub3]);

  // Hierarchy Reset Handlers
  const handleMainChange = (val: string) => {
    setSelectedMain(val);
    setSelectedSub1('');
    setSelectedSub2('');
    setSelectedSub3('');
    setSelectedSub4Values([]);
  };

  const handleSub1Change = (val: string) => {
    setSelectedSub1(val);
    setSelectedSub2('');
    setSelectedSub3('');
    setSelectedSub4Values([]);
  };

  const handleSub2Change = (val: string) => {
    setSelectedSub2(val);
    setSelectedSub3('');
    setSelectedSub4Values([]);
  };

  const handleSub3Change = (val: string) => {
    setSelectedSub3(val);
    setSelectedSub4Values([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'amount' || name === 'quantity') ? (value ? Number(value) : null) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMain || !selectedSub1 || !formData.amount) {
      setError('Please fill in Department, Category, and Amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      ...formData,
      main_category: selectedMain,
      sub_category1: selectedSub1,
      sub_category2: selectedSub2,
      sub_category3: selectedSub3,
      sub_category3_values: selectedSub4Values,
    };

    try {
      if (expense?.id) {
        const res = await updateExpense(expense.id, payload);
        if (!res.success) throw new Error(res.error);
      } else {
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

  const textareaClasses = "w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 placeholder:text-slate-500 transition-all resize-none";

  const formContent = (
    <>
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium flex items-center gap-2.5">
          <AlertCircle size={18} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        {/* Section A: Categorization */}
        <div className="bg-slate-800/40 border border-slate-700/70 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Categorization
              </h3>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              Department & category hierarchy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Department <span className="text-purple-400">*</span>
              </label>
              <select
                required
                value={selectedMain}
                onChange={(e) => handleMainChange(e.target.value)}
                disabled={isLoadingLevels && mainOptions.length === 0}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  {isLoadingLevels && mainOptions.length === 0 ? 'Loading departments...' : 'Select Department'}
                </option>
                {mainOptions.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Category <span className="text-purple-400">*</span>
              </label>
              <select
                required
                value={selectedSub1}
                onChange={(e) => handleSub1Change(e.target.value)}
                disabled={!selectedMain}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select Category</option>
                {sub1Options.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Category 1 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Sub Category 1
              </label>
              <select
                value={selectedSub2}
                onChange={(e) => handleSub2Change(e.target.value)}
                disabled={!selectedSub1 || sub2Options.length === 0}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select Sub Category 1</option>
                {sub2Options.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Category 2 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Sub Category 2
              </label>
              <select
                value={selectedSub3}
                onChange={(e) => handleSub3Change(e.target.value)}
                disabled={!selectedSub2 || sub3Options.length === 0}
                className={selectClasses}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select Sub Category 2</option>
                {sub3Options.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Category 3 (MultiSelect) */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Sub Category 3
              </label>
              <MultiSelect
                options={sub4Options}
                selectedValues={selectedSub4Values}
                onChange={setSelectedSub4Values}
                placeholder="Select Sub Category 3 Values..."
                disabled={!selectedSub3 || sub4Options.length === 0}
              />
            </div>
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
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Amount <span className="text-purple-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  name="amount"
                  required
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
          disabled={isSubmitting}
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
