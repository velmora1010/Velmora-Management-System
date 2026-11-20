import { useState, useEffect, useCallback } from 'react';
import { useExpenses, type FinanceExpense } from '../../hooks/finance/useExpenses';
import { supabase } from '../../lib/supabase';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { ExpenseRuleEngine } from '../../utils/rules/ExpenseRuleEngine';
import { reevaluateHistoricalExpenses } from './services/expenseReevaluationService';
import toast from 'react-hot-toast';

interface ExpenseCardEditorProps {
  expense: FinanceExpense;
  formId: string;
  onClose: () => void;
  onSuccess: () => void;
  onRuleSavedAndReevaluated?: () => void | Promise<void>;
}

const suggestKeyword = (notes: string | null | undefined): string => {
  if (!notes) return '';
  const parts = notes.toLowerCase().split(/[\/\-\s]+/);
  const ignored = new Set([
    'mmt', 'imps', 'neft', 'rtgs', 'upi', 'rev', 'pos', 'inf', 'vin', 'bil', 
    'trf', 'min', 'cr', 'dr', 'to', 'from', 'by', 'transfer', 'payment', 'bank', 'net'
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

export const ExpenseCardEditor = ({
  expense,
  formId,
  onClose,
  onSuccess,
  onRuleSavedAndReevaluated
}: ExpenseCardEditorProps) => {
  const { updateExpense } = useExpenses();
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<string[]>([]);
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState(() => suggestKeyword(expense.notes));


  // Form State
  const [formData, setFormData] = useState<Partial<FinanceExpense>>({
    amount: expense.amount,
    quantity: expense.quantity || null,
    payment_mode: expense.payment_mode || '',
    bank_account: expense.bank_account || '',
    purchased_by: expense.purchased_by || '',
    approved_by: expense.approved_by || '',
    gst_status: expense.gst_status || '',
    vendor: expense.vendor || '',
    notes: expense.notes || ''
  });

  // Hierarchy State
  const [selectedMain, setSelectedMain] = useState(expense.main_category || '');
  const [selectedSub1, setSelectedSub1] = useState(expense.sub_category1 || '');
  const [selectedSub2, setSelectedSub2] = useState(expense.sub_category2 || '');
  const [selectedSub3, setSelectedSub3] = useState(expense.sub_category3 || '');
  const [selectedSub4Values, setSelectedSub4Values] = useState<string[]>(
    expense.sub_category3_values || []
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
           const retry = await supabase.from('vendors').select('name').eq('status', 'active').order('name');
           if (!retry.error && retry.data && mounted) {
             setVendors(retry.data.map(v => v.name));
           }
        }
      } catch (e) {}
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'amount' ? (value ? Number(value) : null) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMain || !selectedSub1 || !formData.amount) {
      setError('Please fill in Department, Category, and Amount.');
      return;
    }

    if (saveAsRule && ExpenseRuleEngine.parseRuleKeywords(ruleKeyword).length === 0) {
      setError('Please specify at least one valid keyword for the automation rule.');
      return;
    }

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
      if (expense.id) {
        const res = await updateExpense(expense.id, payload);
        if (!res.success) throw new Error(res.error);
      }

      if (saveAsRule) {
        const tokens = ExpenseRuleEngine.parseRuleKeywords(ruleKeyword);
        const signature = ExpenseRuleEngine.getKeywordSignature(tokens);
        const canonicalKeyword = tokens.join('/');
        const normalizedSub4 = ExpenseRuleEngine.normalizeLevel5Values(selectedSub4Values);

        const { data: existingRules, error: fetchErr } = await supabase
          .from('expense_rules')
          .select('*')
          .eq('keyword_signature', signature);

        if (fetchErr) {
          toast.error('Expense updated, but rule creation failed (Database Error).');
        } else if (existingRules && existingRules.length > 0) {
          const existing = existingRules[0];
          const existingSub4 = ExpenseRuleEngine.normalizeLevel5Values(existing.sub_category3_values);
          const isSameMapping =
            (existing.department || '') === (selectedMain || '') &&
            (existing.category || '') === (selectedSub1 || '') &&
            (existing.sub_category1 || '') === (selectedSub2 || '') &&
            (existing.sub_category2 || '') === (selectedSub3 || '') &&
            JSON.stringify(existingSub4) === JSON.stringify(normalizedSub4) &&
            (existing.vendor || '') === (formData.vendor || '');

          if (isSameMapping) {
            toast.success('Expense updated. (Automation rule already exists)');
          } else {
            toast.error('Expense updated, but automation rule was NOT created because this keyword combination already has a different mapping.');
          }
        } else {
          const { error: insertErr } = await supabase
            .from('expense_rules')
            .insert([{
              keyword: canonicalKeyword,
              keywords: tokens,
              keyword_signature: signature,
              department: selectedMain,
              category: selectedSub1,
              sub_category1: selectedSub2,
              sub_category2: selectedSub3,
              sub_category3_values: normalizedSub4,
              vendor: formData.vendor || null,
              payment_mode: formData.payment_mode || null,
              gst_status: formData.gst_status || null,
              purchased_by: formData.purchased_by || null,
              approved_by: formData.approved_by || null,
              notes: formData.notes || null,
              priority: 50,
              is_active: true
            }]);
            
          if (insertErr) {
            toast.error(`Expense updated, but rule creation failed: ${insertErr.message}`);
          } else {
            const reevalToastId = toast.loading('Rule saved. Re-evaluating existing transactions...');
            try {
              const summary = await reevaluateHistoricalExpenses({
                excludeExpenseId: expense.id
              });

              if (summary.queuedRerun) {
                toast.success('Rule saved! Re-evaluation queued behind active run.', {
                  id: reevalToastId
                });
              } else {
                const extraParts: string[] = [];
                if (summary.skipped > 0) extraParts.push(`${summary.skipped} skipped`);
                if (summary.failed > 0) extraParts.push(`${summary.failed} failed`);
                const suffix = extraParts.length > 0 ? `, ${extraParts.join(', ')}` : '';
                const msg = `Rule saved! ${summary.updated} existing transactions categorized, ${summary.unmatched} unmatched, ${summary.conflicts} conflicts${suffix}.`;

                if (summary.failed > 0 && summary.updated === 0) {
                  toast.error(msg, { id: reevalToastId });
                } else if (summary.conflicts > 0 || summary.failed > 0) {
                  toast(msg, { id: reevalToastId, icon: '⚠️' });
                } else {
                  toast.success(msg, { id: reevalToastId });
                }
              }

              await onRuleSavedAndReevaluated?.();
            } catch (reevalErr: any) {
              console.error('Historical expense re-evaluation failed:', reevalErr);
              toast.error(
                `Rule saved, but historical re-evaluation failed: ${reevalErr?.message || 'Unexpected error'}`,
                { id: reevalToastId }
              );
            }
          }
        }
      } else {
        toast.success('Expense updated successfully.');
      }
      
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update expense');
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
        
        {/* Section 1: Expense Details */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Expense Details</h4>
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
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Vendor</label>
              <select
                name="vendor"
                value={formData.vendor || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">GST Status</label>
              <select
                name="gst_status"
                value={formData.gst_status || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">Select GST Status</option>
                <option value="With GST">With GST</option>
                <option value="Without GST">Without GST</option>
                <option value="Exempt">Exempt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Payment */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Payment</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Payment Mode</label>
              <select
                name="payment_mode"
                value={formData.payment_mode || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">Select Mode</option>
                <option value="UPI">UPI</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash">Cash</option>
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

        {/* Section 3: Approval */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Approval</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Purchased By</label>
              <select
                name="purchased_by"
                value={formData.purchased_by || ''}
                onChange={handleChange}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">Select</option>
                <option value="Self">Self</option>
                <option value="Employee">Employee</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Approved By</label>
              <input
                type="text"
                name="approved_by"
                value={formData.approved_by || ''}
                onChange={handleChange}
                placeholder="Manager Name"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Categories */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Categories</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Department *</label>
              <select
                required
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
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Category *</label>
              <select
                required
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
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Cat 1</label>
                <select
                  value={selectedSub2}
                  onChange={(e) => handleSub2Change(e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                >
                  <option value="">Select</option>
                  {sub2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}
            
            {sub3Options.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Cat 2</label>
                <select
                  value={selectedSub3}
                  onChange={(e) => handleSub3Change(e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                >
                  <option value="">Select</option>
                  {sub3Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}
            
            {sub4Options.length > 0 && (
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Cat 3</label>
                <MultiSelect
                  options={sub4Options}
                  selectedValues={selectedSub4Values}
                  onChange={setSelectedSub4Values}
                  placeholder="Select Sub Category 3"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Additional */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Additional</h4>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Notes</label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange as any}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Section 6: Automation */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`saveAsRule-${expense.id}`}
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background bg-background cursor-pointer"
            />
            <label htmlFor={`saveAsRule-${expense.id}`} className="text-sm font-medium text-main cursor-pointer select-none">
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
                placeholder="Enter automation keyword(s) (e.g., wififoundersoff/airte/paymentsb)"
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary font-mono"
              />
              <p className="text-[11px] text-muted leading-tight">
                Separate multiple keywords using /. All keywords must be present in the transaction description.
              </p>
            </div>
          )}
        </div>
      </form>
    </>
  );
};
