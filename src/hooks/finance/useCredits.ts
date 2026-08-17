import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export interface FinanceCredit {
  id?: string;
  main_category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  amount: number | null;
  source: string | null;
  payment_mode: string | null;
  bank_account: string | null;
  notes: string | null;
  status?: string;
  created_at?: string;
  import_batch_id?: string | null;
  import_file_name?: string | null;
  import_status?: string | null;
  sequence?: number;
  transaction_date?: string | null;
  posted_datetime?: string | null;
}

export interface CreditImport {
  id: string;
  batch_id: string;
  file_name: string;
  file_hash: string;
  import_status: string;
  transaction_count: number;
  created_at: string;
}

export const useCredits = () => {
  const [credits, setCredits] = useState<FinanceCredit[]>([]);
  const [imports, setImports] = useState<CreditImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    setError(null);
    try {
      console.log('Loading', SUPABASE_TABLES.creditsRow, '...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from(SUPABASE_TABLES.creditsRow)
        .select('*')
        .eq('status', 'active')
        .order('transaction_date', { ascending: false });

      if (fetchError && fetchError.code === '42703') {
        const retry = await supabase
          .from(SUPABASE_TABLES.creditsRow)
          .select('*')
          .order('transaction_date', { ascending: false });
        fetchResult = retry.data;
        fetchError = retry.error;
      }

      if (fetchError) {
        console.error('credits_row fetch error:', fetchError.message);
        throw fetchError;
      }
      
      const activeCredits = (fetchResult || []).filter(e => e.status !== 'archived');
      setCredits(activeCredits);
    } catch (e: unknown) {
      console.error('Failed to load credits:', e);
      setError(e instanceof Error ? e.message : 'Failed to load credits');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCredits();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCredits]);

  const refreshCredits = useCallback(async () => {
    setIsLoading(true);
    await fetchCredits();
  }, [fetchCredits]);

  const fetchImports = useCallback(async () => {
    setIsLoadingImports(true);
    try {
      const { data, error: fetchError } = await supabase
        .from(SUPABASE_TABLES.creditImports)
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setImports(data || []);
    } catch (e: unknown) {
      console.error('Failed to load credit imports:', e);
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
    creditsData: FinanceCredit[]
  ) => {
    try {
      const batch_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const trackingRecord = {
        batch_id,
        file_name,
        file_hash,
        transaction_count: creditsData.length,
        import_status: 'completed'
      };

      const { error: importError } = await supabase
        .from(SUPABASE_TABLES.creditImports)
        .insert([trackingRecord]);

      if (importError) throw importError;

      const rowsToInsert = creditsData.map(cred => {
        return {
          ...cred,
          status: 'active',
          import_batch_id: batch_id,
          import_file_name: file_name,
          import_status: 'Imported'
        };
      });

      const { error: insertError } = await supabase
        .from(SUPABASE_TABLES.creditsRow)
        .insert(rowsToInsert);

      if (insertError) throw insertError;

      await fetchImports();
      await fetchCredits();
      return { success: true, batch_id };
    } catch (e: unknown) {
      console.error('Failed to upload batch:', e);
      return { success: false, error: (e as any)?.message || 'Unknown error' };
    }
  };

  const deleteBatch = async (batch_id: string) => {
    try {
      // For credit, deleting the import automatically cascades to credits_row
      const { error: deleteImportError } = await supabase
        .from(SUPABASE_TABLES.creditImports)
        .delete()
        .eq('batch_id', batch_id);

      if (deleteImportError) throw deleteImportError;

      await fetchImports();
      await fetchCredits();
      return { success: true };
    } catch (e: unknown) {
      console.error('Failed to delete batch:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const updateCredit = async (id: string, updates: Partial<FinanceCredit>) => {
    try {
      console.log('Credit Update Payload', updates);
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.creditsRow)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`${error.message} - ${error.details}`);
      }

      setCredits(prev => prev.map(c => c.id === id ? data : c));
      return { success: true, data };
    } catch (e: unknown) {
      console.error('Failed to update credit:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const archiveCredit = async (id: string) => {
    return updateCredit(id, { status: 'archived' });
  };

  return {
    credits,
    imports,
    isLoading,
    isLoadingImports,
    error,
    refreshCredits,
    fetchImports,
    uploadBatch,
    deleteBatch,
    updateCredit,
    archiveCredit
  };
};
