import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface FinanceBill {
  id?: string;
  main_category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  sub_category3: string | null;
  amount: number | null;
  due_date: string | null;
  billing_cycle: string | null;
  payment_type: string | null;
  mode_of_pay: string | null;
  account: string | null;
  email: string | null;
  notes: string | null;
  bill_status: string | null;
  status?: string;
  created_at?: string;
}

export const useBills = () => {
  const [bills, setBills] = useState<FinanceBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    setError(null);
    try {
      console.log('Loading finance_bills_rows...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from('finance_bills_rows')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Fallback if status column doesn't exist
      if (fetchError && fetchError.code === '42703') {
        const retry = await supabase
          .from('finance_bills_rows')
          .select('*')
          .order('created_at', { ascending: false });
        fetchResult = retry.data;
        fetchError = retry.error;
      }

      let data = fetchResult;
      if (fetchError) {
        console.error('finance_bills_rows fetch error:', fetchError.message);
        const fallback = localStorage.getItem('finance_bills');
        if (fallback) data = JSON.parse(fallback);
        else throw fetchError;
      }
      console.log('Loaded finance_bills_rows:', data?.length);
      
      // Filter out archived manually just in case
      const activeBills = (data || []).filter(b => b.status !== 'archived');
      setBills(activeBills);
    } catch (e: unknown) {
      console.error('Failed to load bills:', e);
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Failed to load bills');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchBills]);

  const refreshBills = useCallback(async () => {
    setIsLoading(true);
    await fetchBills();
  }, [fetchBills]);

  const addBill = async (billData: FinanceBill) => {
    try {
      const { data, error } = await supabase
        .from('finance_bills_rows')
        .insert([{ ...billData, status: 'active' }])
        .select()
        .single();
        
      if (error) throw error;
      setBills(prev => [data, ...prev]);
      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to add bill:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const updateBill = async (id: string, updates: Partial<FinanceBill>) => {
    try {
      const { data, error } = await supabase
        .from('finance_bills_rows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      // Fallback for missing bill_status column
      if (error && error.code === '42703' && error.message.includes('bill_status')) {
        const retryUpdates = { ...updates };
        delete retryUpdates.bill_status;
        const retry = await supabase
          .from('finance_bills_rows')
          .update(retryUpdates)
          .eq('id', id)
          .select()
          .single();
        if (retry.error) throw retry.error;
        setBills(prev => prev.map(b => b.id === id ? retry.data : b));
        return { success: true, data: retry.data };
      }

      if (error) throw error;
      setBills(prev => prev.map(b => b.id === id ? data : b));
      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to update bill:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const archiveBill = async (id: string) => {
    return updateBill(id, { status: 'archived' });
  };

  return {
    bills,
    isLoading,
    error,
    refreshBills,
    addBill,
    updateBill,
    archiveBill
  };
};
