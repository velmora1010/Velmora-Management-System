import { useState, useEffect, useCallback } from 'react';
import { useBills, type FinanceBill } from '../../hooks/finance/useBills';
import { supabase } from '../../lib/supabase';
import { MultiSelect } from '../../components/ui/MultiSelect';

interface BillCardEditorProps {
  bill: FinanceBill;
  formId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BillCardEditor = ({ bill, formId, onClose, onSuccess }: BillCardEditorProps) => {
  const { updateBill } = useBills();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<FinanceBill>>({
    amount: bill.amount,
    due_date: bill.due_date || '',
    billing_cycle: bill.billing_cycle || '',
    payment_type: bill.payment_type || '',
    account: bill.account || '',
    bill_status: bill.bill_status || 'Pending'
  });

  // Hierarchy State
  const [selectedMain, setSelectedMain] = useState(bill.main_category || '');
  const [selectedSub1, setSelectedSub1] = useState(bill.sub_category1 || '');
  const [selectedSub2, setSelectedSub2] = useState(bill.sub_category2 || '');
  const [selectedSub3, setSelectedSub3] = useState(bill.sub_category3 || '');
  const [selectedSub4Values, setSelectedSub4Values] = useState<string[]>(
    bill.sub_category3_values || []
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
      if (bill.id) {
        const res = await updateBill(bill.id, payload);
        if (!res.success) throw new Error(res.error);
      }
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update bill');
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
      
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        
        {/* Basic Info */}
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
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Due Date</label>
            <input
              type="date"
              name="due_date"
              value={formData.due_date || ''}
              onChange={handleChange}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary [color-scheme:dark]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Billing Cycle</label>
            <select
              name="billing_cycle"
              value={formData.billing_cycle}
              onChange={handleChange}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="">Select Cycle</option>
              <option value="One Time">One Time</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Payment Type</label>
            <select
              name="payment_type"
              value={formData.payment_type}
              onChange={handleChange}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="">Select Type</option>
              <option value="Prepaid">Prepaid</option>
              <option value="Postpaid">Postpaid</option>
              <option value="On Demand">On Demand</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Account</label>
            <input
              type="text"
              name="account"
              value={formData.account || ''}
              onChange={handleChange}
              placeholder="E.g. JIRA"
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Bill Status</label>
            <select
              name="bill_status"
              value={formData.bill_status}
              onChange={handleChange}
              className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="h-px bg-border w-full my-4"></div>

        {/* Hierarchy */}
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
      </form>
    </>
  );
};
