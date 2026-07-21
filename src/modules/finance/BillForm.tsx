import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useBills, type FinanceBill } from '../../hooks/finance/useBills';
import { useDepartmentSelection } from '../../hooks/tasks/useDepartmentSelection';
import { supabase } from '../../lib/supabase';

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
      sub_category2: '',
      sub_category3: '',
    }
  );

  // Init Department Selection hook
  const {
    departments,
    sections,
    selectedDeptId,
    selectedSectionId,
    setSelectedSectionId,
    handleDepartmentChange,
    isDeptsLoading,
    isSectionsLoading,
    deptsError,
    sectionsError
  } = useDepartmentSelection(
    bill?.main_category || '',
    bill?.sub_category1 || ''
  );

  const [sub2Options, setSub2Options] = useState<string[]>([]);
  const [sub3Options, setSub3Options] = useState<string[]>([]);

  // Fetch sub2 options from categories table
  useEffect(() => {
    let mounted = true;
    const fetchSub2 = async () => {
      if (!selectedDeptId || !selectedSectionId) {
        if (mounted) setSub2Options([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('finance_categories_rows')
          .select('sub2')
          .eq('main', selectedDeptId)
          .eq('sub1', selectedSectionId)
          .eq('status', 'active');
        if (!error && data && mounted) {
          const unique = Array.from(new Set(data.map(d => d.sub2).filter(Boolean))) as string[];
          setSub2Options(unique);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSub2();
    return () => { mounted = false; };
  }, [selectedDeptId, selectedSectionId]);

  // Fetch sub3 options from categories table
  useEffect(() => {
    let mounted = true;
    const fetchSub3 = async () => {
      if (!selectedDeptId || !selectedSectionId || !formData.sub_category2) {
        if (mounted) setSub3Options([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('finance_categories_rows')
          .select('sub_sub_sub_category')
          .eq('main', selectedDeptId)
          .eq('sub1', selectedSectionId)
          .eq('sub2', formData.sub_category2)
          .eq('status', 'active');
        if (!error && data && mounted) {
          const unique = Array.from(new Set(data.map(d => d.sub_sub_sub_category || d.sub3).filter(Boolean))) as string[];
          setSub3Options(unique);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSub3();
    return () => { mounted = false; };
  }, [selectedDeptId, selectedSectionId, formData.sub_category2]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'amount' ? (value ? Number(value) : null) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !selectedSectionId || !formData.amount) {
      setError('Please fill in Department, Section, and Amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      ...formData,
      main_category: selectedDeptId,
      sub_category1: selectedSectionId,
      sub_category2: formData.sub_category2 || '',
      sub_category3: formData.sub_category3 || '',
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
              
              {/* Department Dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Department *</label>
                <select
                  required
                  value={selectedDeptId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={isDeptsLoading}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">{isDeptsLoading ? 'Loading departments...' : 'Select Department'}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.department_name}</option>
                  ))}
                </select>
                {deptsError && <span className="text-xs text-red-500 mt-1">{deptsError}</span>}
              </div>

              {/* Section Dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Section *</label>
                <select
                  required
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  disabled={!selectedDeptId || isSectionsLoading}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">
                    {!selectedDeptId 
                      ? 'Select a department first' 
                      : isSectionsLoading 
                      ? 'Loading sections...' 
                      : sections.length === 0 
                      ? 'No sections available' 
                      : 'Select Section'
                    }
                  </option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.section_name}</option>
                  ))}
                </select>
                {sectionsError && <span className="text-xs text-red-500 mt-1">{sectionsError}</span>}
              </div>

              {/* Sub Category 2 Dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Sub Category 2</label>
                <select
                  name="sub_category2"
                  value={formData.sub_category2 || ''}
                  onChange={handleChange}
                  disabled={!selectedSectionId || sub2Options.length === 0}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">Select Sub Category 2</option>
                  {sub2Options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sub Category 3 Dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Sub Category 3</label>
                <select
                  name="sub_category3"
                  value={formData.sub_category3 || ''}
                  onChange={handleChange}
                  disabled={!formData.sub_category2 || sub3Options.length === 0}
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
