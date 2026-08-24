import { useState, useEffect, useCallback } from 'react';
import { useCredits, type FinanceCredit } from '../../hooks/finance/useCredits';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface CreditCardEditorProps {
  credit: FinanceCredit;
  formId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const suggestKeyword = (notes: string | null | undefined): string => {
  if (!notes) return '';
  const parts = notes.toLowerCase().split(/[\/\-\s]+/);
  const ignored = new Set([
    'mmt', 'imps', 'neft', 'rtgs', 'upi', 'rev', 'pos', 'inf', 'vin', 'bil', 
    'trf', 'min', 'cr', 'dr', 'to', 'from', 'by', 'transfer', 'payment', 'bank', 'net', 'ach', 'deposit'
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

export const CreditCardEditor = ({ credit, formId, onClose, onSuccess }: CreditCardEditorProps) => {
  const { updateCredit } = useCredits();
  const [error, setError] = useState<string | null>(null);

  const [saveAsRule, setSaveAsRule] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState(() => suggestKeyword(credit.notes));

  // Form State
  const [formData, setFormData] = useState<Partial<FinanceCredit>>({
    amount: credit.amount,
    payment_mode: credit.payment_mode || '',
    bank_account: credit.bank_account || '',
    source: credit.source || '',
    notes: credit.notes || '',
  });

  // Hierarchy State
  const [selectedMain, setSelectedMain] = useState(credit.main_category || '');
  const [selectedSub1, setSelectedSub1] = useState(credit.sub_category1 || '');
  const [selectedSub2, setSelectedSub2] = useState(credit.sub_category2 || '');

  // Options State
  const [mainOptions, setMainOptions] = useState<string[]>([]);
  const [sub1Options, setSub1Options] = useState<string[]>([]);
  const [sub2Options, setSub2Options] = useState<string[]>([]);
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
      const { data, error: err } = await query;
      if (err) throw err;
      if (!data) return [];
      
      const values = data.map((row: any) => row[targetCol]).filter(Boolean);
      return Array.from(new Set(values)) as string[];
    } catch (err) {
      console.error(`Failed to load ${targetCol} options:`, err);
      return [];
    }
  }, []);

  // Preload & Cascade Fetching
  useEffect(() => {
    let mounted = true;
    const preload = async () => {
      setIsLoadingLevels(true);
      
      const pMain = loadOptions('main');
      const pSub1 = selectedMain ? loadOptions('sub1', { main: selectedMain }) : Promise.resolve([]);
      const pSub2 = selectedMain && selectedSub1 ? loadOptions('sub2', { main: selectedMain, sub1: selectedSub1 }) : Promise.resolve([]);

      const [m, s1, s2] = await Promise.all([pMain, pSub1, pSub2]);
      
      if (mounted) {
        setMainOptions(m);
        setSub1Options(s1);
        setSub2Options(s2);
        setIsLoadingLevels(false);
      }
    };
    preload();
    return () => { mounted = false; };
  }, [loadOptions, selectedMain, selectedSub1]);

  const handleMainChange = (val: string) => {
    setSelectedMain(val);
    setSelectedSub1('');
    setSelectedSub2('');
  };

  const handleSub1Change = (val: string) => {
    setSelectedSub1(val);
    setSelectedSub2('');
  };

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

    if (saveAsRule && !ruleKeyword.trim()) {
      setError('Please specify a keyword for the automation rule.');
      return;
    }

    setError(null);

    const payload = {
      ...formData,
      main_category: selectedMain || null,
      sub_category1: selectedSub1 || null,
      sub_category2: selectedSub2 || null,
    };

    try {
      if (credit.id) {
        const res = await updateCredit(credit.id, payload);
        if (!res.success) throw new Error(res.error);
      }

      if (saveAsRule) {
        const kw = ruleKeyword.trim();
        const { data: existingRules, error: fetchErr } = await supabase
          .from('credit_rules')
          .select('*')
          .eq('keyword', kw);

        if (fetchErr) {
          toast.error('Credit updated, but rule creation failed (Database Error).');
        } else if (existingRules && existingRules.length > 0) {
          const existing = existingRules[0];
          const isSameMapping = 
            existing.main_category === selectedMain &&
            (existing.sub_category1 || '') === (selectedSub1 || '') &&
            (existing.sub_category2 || '') === (selectedSub2 || '') &&
            (existing.source || '') === (formData.source || '');

          if (isSameMapping) {
            toast.success('Credit updated. (Automation rule already exists)');
          } else {
            toast.error('Credit updated, but automation rule was NOT created because this keyword already has a different mapping.');
          }
        } else {
          const { error: insertErr } = await supabase
            .from('credit_rules')
            .insert([{
              keyword: kw,
              main_category: selectedMain || null,
              sub_category1: selectedSub1 || null,
              sub_category2: selectedSub2 || null,
              source: formData.source || null,
              payment_mode: formData.payment_mode || null,
              priority: 50,
              is_active: true
            }]);
            
          if (insertErr) {
            toast.error(`Credit updated, but rule creation failed: ${insertErr.message}`);
          } else {
            toast.success('Credit updated and automation rule created successfully!');
          }
        }
      } else {
        toast.success('Credit updated successfully.');
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
                value={formData.payment_mode || ''}
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

        {/* Section 2: Categories */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Categories</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Main Category</label>
              <select
                value={selectedMain}
                onChange={(e) => handleMainChange(e.target.value)}
                disabled={isLoadingLevels && mainOptions.length === 0}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">{isLoadingLevels ? '...' : 'Select'}</option>
                {mainOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Category 1</label>
              <select
                value={selectedSub1}
                onChange={(e) => handleSub1Change(e.target.value)}
                disabled={!selectedMain}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">Select</option>
                {sub1Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            {sub2Options.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Category 2</label>
                <select
                  value={selectedSub2}
                  onChange={(e) => setSelectedSub2(e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                >
                  <option value="">Select</option>
                  {sub2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}
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

        {/* Section 4: Automation */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`saveAsRule-${credit.id}`}
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background bg-background cursor-pointer"
            />
            <label htmlFor={`saveAsRule-${credit.id}`} className="text-sm font-medium text-main cursor-pointer select-none">
              Save this correction as an automation rule for future transactions
            </label>
          </div>
          
          {saveAsRule && (
            <div className="space-y-2 pl-6 fade-in">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Keyword Confirmation</label>
              <input
                type="text"
                required
                value={ruleKeyword}
                onChange={(e) => setRuleKeyword(e.target.value)}
                placeholder="Enter automation keyword (e.g., flipkart)"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary font-mono"
              />
              <p className="text-[11px] text-muted leading-tight">
                This exact keyword will be matched against future transactions to automatically categorize them. Ensure it is unique enough to avoid false positives.
              </p>
            </div>
          )}
        </div>

      </form>
    </>
  );
};
