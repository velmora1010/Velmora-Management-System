import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export interface FinanceExpense {
  id?: string;
  main_category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  sub_category3: string | null;
  sub_category3_values: string[];
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
  import_batch_id?: string | null;
  import_file_name?: string | null;
  import_status?: string | null;
  imported_at?: string | null;
}

export interface ExpenseImport {
  id: string;
  batch_id: string;
  file_name: string;
  file_hash: string;
  source_type: string;
  document_type: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  imported_by: string | null;
  imported_at: string;
  status: string;
}

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [imports, setImports] = useState<ExpenseImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setError(null);
    try {
      console.log('Loading', SUPABASE_TABLES.expenses, '...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Fallback if status column doesn't exist
      if (fetchError && fetchError.code === '42703') {
        const retry = await supabase
          .from(SUPABASE_TABLES.expenses)
          .select('*')
          .order('created_at', { ascending: false });
        fetchResult = retry.data;
        fetchError = retry.error;
      }

      let data = fetchResult;
      console.log("Loaded table:", SUPABASE_TABLES.expenses, data?.length, fetchError);

      if (fetchError) {
        console.error('expenses_row fetch error:', fetchError.message);
        throw fetchError;
      }
      
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
      const payload = { ...expenseData, status: 'active' };
      console.log('Expense Payload', payload);

      const { data, error } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .insert([payload])
        .select()
        .single();
        
      console.log('Supabase Error:', error);
      console.log('Supabase Data:', data);

      if (error) {
        throw new Error(`${error.message} - ${error.details}`);
      }

      setExpenses(prev => [data, ...prev]);
      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to add expense:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const updateExpense = async (id: string, updates: Partial<FinanceExpense>) => {
    try {
      console.log('Expense Update Payload', updates);
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      console.log('Supabase Error:', error);
      console.log('Supabase Data:', data);

      if (error) {
        throw new Error(`${error.message} - ${error.details}`);
      }

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

  const fetchImports = useCallback(async () => {
    setIsLoadingImports(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('expense_imports')
        .select('*')
        .order('imported_at', { ascending: false });

      if (fetchError) throw fetchError;
      setImports(data || []);
    } catch (e: unknown) {
      console.error('Failed to load expense imports:', e);
    } finally {
      setIsLoadingImports(false);
    }
  }, []);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  const uploadBatch = async (
    file_name: string,
    file_hash: string,
    source_type: string,
    imported_by: string | null,
    expensesData: FinanceExpense[],
    document_type: string = 'UNKNOWN'
  ) => {
    try {
      // 1. Create tracking record
      const batch_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const trackingRecord = {
        batch_id,
        file_name,
        file_hash,
        source_type,
        document_type,
        total_rows: expensesData.length,
        imported_rows: expensesData.length,
        failed_rows: 0,
        imported_by,
        status: 'completed'
      };

      const { error: importError } = await supabase
        .from('expense_imports')
        .insert([trackingRecord]);

      if (importError) throw importError;

      // 2. Insert expense rows
      const rowsToInsert = expensesData.map(exp => ({
        ...exp,
        status: 'active',
        import_batch_id: batch_id,
        import_file_name: file_name,
        import_status: 'Imported'
      }));

      const { error: insertError } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .insert(rowsToInsert);

      if (insertError) throw insertError;

      await fetchImports();
      await fetchExpenses();
      return { success: true, batch_id };
    } catch (e: unknown) {
      console.error('Failed to upload batch:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const deleteBatch = async (batch_id: string) => {
    try {
      // 1. Delete associated expenses
      const { error: deleteExpError } = await supabase
        .from(SUPABASE_TABLES.expenses)
        .delete()
        .eq('import_batch_id', batch_id);

      if (deleteExpError) throw deleteExpError;

      // 2. Delete tracking record
      const { error: deleteImportError } = await supabase
        .from('expense_imports')
        .delete()
        .eq('batch_id', batch_id);

      if (deleteImportError) throw deleteImportError;

      await fetchImports();
      await fetchExpenses();
      return { success: true };
    } catch (e: unknown) {
      console.error('Failed to delete batch:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  return {
    expenses,
    imports,
    isLoading,
    isLoadingImports,
    error,
    refreshExpenses,
    fetchImports,
    addExpense,
    updateExpense,
    archiveExpense,
    uploadBatch,
    deleteBatch
  };
};
