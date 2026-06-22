import { useState } from 'react';
import { X } from 'lucide-react';
import { useBills, type FinanceBill } from '../../hooks/finance/useBills';
import { useCategories } from '../../hooks/useCategories';

interface BillFormProps {
  bill: FinanceBill | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BillForm = ({ bill, onClose, onSuccess }: BillFormProps) => {
  const { addBill, updateBill } = useBills();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<FinanceBill>>(
    bill || {
      amount: null,
      due_date: '',
      billing_cycle: '',
      payment_type: '',
      mode_of_pay: '',
      account: '',
      email: '',
      notes: '',
      bill_status: 'Pending',
      sub_category3: '',
    }
  );

  // Init Categories hook
  const {
    mainOptions, sub1Options, sub2Options, sub3Options,
    mainCategory, subCategory1, subCategory2,
    handleMainChange, handleSub1Change, handleSub2Change
  } = useCategories(bill?.main_category || '', bill?.sub_category1 || '', bill?.sub_category2 || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'amount' ? (value ? Number(value) : null) : value 
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
      if (bill?.id) {
        const res = await updateBill(bill.id, payload);
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await addBill(payload as FinanceBill);
        if (!res.success) throw new Error(res.error);
      }
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save bill');
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
              {bill ? 'Edit Bill' : 'Add New Bill'}
            </h2>
            <p className="text-sm text-muted mt-1">Enter finance bill details and categorization.</p>
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

          <form id="billForm" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Section: Categorization */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Categorization</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Main Category</label>
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Sub Category 3</label>
                  <select
                    name="sub_category3"
                    value={formData.sub_category3 || ''}
                    onChange={handleChange}
                    disabled={!subCategory2 || sub3Options.length === 0}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                  >
                    <option value="">Select Sub Category 3</option>
                    {sub3Options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Bill Details */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Bill Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Amount</label>
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
                  <label className="text-sm font-medium text-main">Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section: Billing Setup */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Billing Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Billing Cycle</label>
                  <input
                    type="text"
                    name="billing_cycle"
                    value={formData.billing_cycle || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. Monthly, Annually"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Payment Type</label>
                  <select
                    name="payment_type"
                    value={formData.payment_type || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Select</option>
                    <option value="Manual">Manual</option>
                    <option value="Autopay">Autopay</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Mode of Pay</label>
                  <select
                    name="mode_of_pay"
                    value={formData.mode_of_pay || ''}
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
                  <label className="text-sm font-medium text-main">Which Account</label>
                  <input
                    type="text"
                    name="account"
                    value={formData.account || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="Account Name/Number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="Contact Email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-main">Status</label>
                  <select
                    name="bill_status"
                    value={formData.bill_status || 'Pending'}
                    onChange={handleChange}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
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
            form="billForm"
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
              'Save Bill'
            )}
          </button>
        </div>

      </div>
  );
};
