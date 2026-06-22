import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useExpenses, type FinanceExpense } from '../../hooks/finance/useExpenses';
import { useCategories } from '../../hooks/useCategories';

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
      sub_category2: '',
    }
  );

  // Init Categories hook
  const {
    mainOptions, sub1Options, sub2Options,
    mainCategory, subCategory1, subCategory2,
    handleMainChange, handleSub1Change, handleSub2Change
  } = useCategories(expense?.main_category || '', expense?.sub_category1 || '', expense?.sub_category2 || '');

  // Fetch vendors
  useEffect(() => {
    let mounted = true;
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('name')
          .eq('status', 'active')
          .order('name');
        if (!error && data && mounted) {
          setVendors(data.map(v => v.name));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainCategory || !formData.amount) {
      setError('Please fill in at least the Category and Amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      ...formData,
      main_category: mainCategory,
      sub_category1: subCategory1,
      sub_category2: subCategory2,
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
              {expense ? 'Edit Expense' : 'Add Expense'}
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Main Category *</label>
                  <select
                    name="main_category"
                    required
                    value={mainCategory}
                    onChange={(e) => handleMainChange(e.target.value)}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Select Main Category</option>
                    {mainOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Sub Category 1</label>
                  <select
                    name="sub_category1"
                    value={subCategory1}
                    onChange={(e) => handleSub1Change(e.target.value)}
                    disabled={!mainCategory || sub1Options.length === 0}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                  >
                    <option value="">Select Sub Category 1</option>
                    {sub1Options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Sub Category 2</label>
                  <select
                    name="sub_category2"
                    value={subCategory2}
                    onChange={(e) => handleSub2Change(e.target.value)}
                    disabled={!subCategory1 || sub2Options.length === 0}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                  >
                    <option value="">Select Sub Category 2</option>
                    {sub2Options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Expense Details */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Expense Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="1"
                  />
                </div>
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
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Payment & Approval */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Payment & Approval</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Mode of Payment</label>
                  <select
                    name="payment_mode"
                    value={formData.payment_mode || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Select Mode</option>
                    <option value="GPay">GPay</option>
                    <option value="Account Transfer">Account Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Which Bank Account</label>
                  <input
                    type="text"
                    name="bank_account"
                    value={formData.bank_account || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="E.g. HDFC 1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Purchased by</label>
                  <input
                    type="text"
                    name="purchased_by"
                    value={formData.purchased_by || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="Name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Approved by</label>
                  <input
                    type="text"
                    name="approved_by"
                    value={formData.approved_by || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="Name"
                  />
                </div>
              </div>
            </div>

            {/* Section: Additional Info */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Additional Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Upload Bills</label>
                  <div className="w-full bg-background border border-border border-dashed text-main text-sm rounded-xl px-4 py-2.5 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer relative overflow-hidden">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span className="text-muted text-center flex flex-col items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      Click to upload or drag & drop
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-sm font-medium text-main">Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    value={formData.notes || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors resize-none"
                    placeholder="Expense details or references..."
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
