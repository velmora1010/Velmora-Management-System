import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface FinanceExpense {
  id?: string;
  main_category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  quantity: number | null;
  amount: number | null;
  vendor: string | null;
  gst_status: string | null;
  payment_mode: string | null;
  bank_account: string | null;
  purchased_by: string | null;
  approved_by: string | null;
  notes: string | null;
  status?: string;
  created_at?: string;
}

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setError(null);
    try {
      console.log('Loading expenses_row...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from('expenses_row')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Fallback if status column doesn't exist
      if (fetchError && fetchError.code === '42703') {
        const retry = await supabase
          .from('expenses_row')
          .select('*')
          .order('created_at', { ascending: false });
        fetchResult = retry.data;
        fetchError = retry.error;
      }

      let data = fetchResult;
      if (fetchError) {
        console.error('expenses_row fetch error:', fetchError.message);
        const fallback = localStorage.getItem('expenses');
        if (fallback) data = JSON.parse(fallback);
        else throw fetchError;
      }
      console.log('Loaded expenses_row:', data?.length);
      
      const activeExpenses = (data || []).filter(e => e.status !== 'archived');
      setExpenses(activeExpenses);
    } catch (e: unknown) {
      console.error('Failed to load expenses:', e);
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Failed to load expenses');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchExpenses]);

  const refreshExpenses = useCallback(async () => {
    setIsLoading(true);
    await fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (expenseData: FinanceExpense) => {
    try {
      const { data, error } = await supabase
        .from('expenses_row')
        .insert([{ ...expenseData, status: 'active' }])
        .select()
        .single();
        
      if (error) throw error;
      setExpenses(prev => [data, ...prev]);
      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to add expense:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const updateExpense = async (id: string, updates: Partial<FinanceExpense>) => {
    try {
      const { data, error } = await supabase
        .from('expenses_row')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => prev.map(e => e.id === id ? data : e));
      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to update expense:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const archiveExpense = async (id: string) => {
    return updateExpense(id, { status: 'archived' });
  };

  return {
    expenses,
    isLoading,
    error,
    refreshExpenses,
    addExpense,
    updateExpense,
    archiveExpense
  };
};
