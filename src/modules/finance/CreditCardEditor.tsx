import { useState } from 'react';
import { useCredits, type FinanceCredit } from '../../hooks/finance/useCredits';

interface CreditCardEditorProps {
  credit: FinanceCredit;
  formId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreditCardEditor = ({ credit, formId, onClose, onSuccess }: CreditCardEditorProps) => {
  const { updateCredit } = useCredits();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<FinanceCredit>>({
    amount: credit.amount,
    payment_mode: credit.payment_mode || '',
    bank_account: credit.bank_account || '',
    source: credit.source || '',
    notes: credit.notes || '',
    main_category: credit.main_category || '',
    sub_category1: credit.sub_category1 || '',
    sub_category2: credit.sub_category2 || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'amount' ? (value ? Number(value) : null) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      setError('Please provide an Amount.');
      return;
    }

    setError(null);

    try {
      if (credit.id) {
        const res = await updateCredit(credit.id, formData);
        if (!res.success) throw new Error(res.error);
      }
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update credit transaction');
      }
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}
      
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Transaction Details */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Transaction Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Amount *</label>
              <input
                type="number"
                name="amount"
                required
                value={formData.amount || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Source</label>
              <input
                type="text"
                name="source"
                value={formData.source || ''}
                onChange={handleChange}
                placeholder="Where did this come from?"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Payment Mode</label>
              <select
                name="payment_mode"
                value={formData.payment_mode}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">Select Mode</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Bank Account</label>
              <input
                type="text"
                name="bank_account"
                value={formData.bank_account || ''}
                onChange={handleChange}
                placeholder="E.g. HDFC 1234"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Categories (Manual for now since we aren't pulling from finance_categories yet for Credit) */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Categories</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Main Category</label>
              <input
                type="text"
                name="main_category"
                value={formData.main_category || ''}
                onChange={handleChange}
                placeholder="E.g. Sales, Refund, Loan"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Category 1</label>
              <input
                type="text"
                name="sub_category1"
                value={formData.sub_category1 || ''}
                onChange={handleChange}
                placeholder="E.g. Product Sales"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Category 2</label>
              <input
                type="text"
                name="sub_category2"
                value={formData.sub_category2 || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Additional */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Additional</h4>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Notes (Extracted Text)</label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>
        </div>

      </form>
    </>
  );
};
