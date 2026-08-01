import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useExpenses, type FinanceExpense } from '../../hooks/finance/useExpenses';
import { supabase } from '../../lib/supabase';
import { MultiSelect } from '../../components/ui/MultiSelect';

interface ExpenseFormProps {
  expense: FinanceExpense | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseForm = ({ expense, onClose, onSuccess }: ExpenseFormProps) => {
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
      const { data, err } = await query;
      if (err) throw err;
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

  return (
    <div className="bg-card w-full rounded-2xl shadow-sm border border-border flex flex-col fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold text-main">
            {expense ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <p className="text-sm text-muted mt-1">Enter expense details and categorization.</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-muted hover:text-main bg-background rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form id="expenseForm" onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Categorization */}
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Categorization</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Department *</label>
                <select
                  required
                  value={selectedMain}
                  onChange={(e) => handleMainChange(e.target.value)}
                  disabled={isLoadingLevels && mainOptions.length === 0}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">{isLoadingLevels && mainOptions.length === 0 ? 'Loading departments...' : 'Select Department'}</option>
                  {mainOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Category *</label>
                <select
                  required
                  value={selectedSub1}
                  onChange={(e) => handleSub1Change(e.target.value)}
                  disabled={!selectedMain}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">Select Category</option>
                  {sub1Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sub Category 1 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Sub Category 1</label>
                <select
                  value={selectedSub2}
                  onChange={(e) => handleSub2Change(e.target.value)}
                  disabled={!selectedSub1 || sub2Options.length === 0}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">Select Sub Category 1</option>
                  {sub2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sub Category 2 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Sub Category 2</label>
                <select
                  value={selectedSub3}
                  onChange={(e) => handleSub3Change(e.target.value)}
                  disabled={!selectedSub2 || sub3Options.length === 0}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">Select Sub Category 2</option>
                  {sub3Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sub Category 3 (MultiSelect) */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-main">Sub Category 3</label>
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

          {/* Section: Expense Details */}
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Expense Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  required
                  value={formData.amount || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  placeholder="e.g., 10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Vendor</label>
                <select
                  name="vendor"
                  value={formData.vendor || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">GST Status</label>
                <select
                  name="gst_status"
                  value={formData.gst_status || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Select GST Status</option>
                  <option value="Included">Included</option>
                  <option value="Excluded">Excluded</option>
                  <option value="Exempt">Exempt</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Payment Mode</label>
                <select
                  name="payment_mode"
                  value={formData.payment_mode || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Select</option>
                  <option value="GPay">GPay</option>
                  <option value="Account Transfer">Account Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Bank Account</label>
                <input
                  type="text"
                  name="bank_account"
                  value={formData.bank_account || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  placeholder="e.g. ICICI Current"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Purchased By</label>
                <input
                  type="text"
                  name="purchased_by"
                  value={formData.purchased_by || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  placeholder="Name of purchaser"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Approved By</label>
                <input
                  type="text"
                  name="approved_by"
                  value={formData.approved_by || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  placeholder="Name of approver"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-medium text-main">Notes (Optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formData.notes || ''}
                  onChange={handleChange}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors resize-none"
                  placeholder="Additional context or references..."
                />
              </div>
            </div>
          </div>

        </form>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0 bg-black/5 dark:bg-white/5 rounded-b-2xl">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium text-main bg-background border border-border rounded-xl hover:brightness-95 dark:hover:brightness-110 transition-colors"
        >
          Cancel
        </button>
        <button
          form="expenseForm"
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:brightness-110 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Expense'
          )}
        </button>
      </div>

    </div>
  );
};
