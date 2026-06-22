import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseQuery<T>(
  table: string,
  queryFn?: (query: any) => any,
  deps: any[] = []
) {
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from(table).select('*');
      if (queryFn) {
        query = queryFn(query);
      }
      
      // Add a 10-second timeout to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase query timed out after 10 seconds')), 10000)
      );

      const response = await Promise.race([query, timeoutPromise]) as any;
      
      const { data: result, error: fetchError } = response;
      
      if (fetchError) {
        console.error(`[useSupabaseQuery] Fetch error on table ${table}:`, fetchError);
        throw fetchError;
      }
      
      setData(result as T[]);
      setError(null);
    } catch (err: any) {
      console.error(`[useSupabaseQuery] Exception on table ${table}:`, err);
      setError(err instanceof Error ? err : new Error(err?.message || 'Unknown query error'));
    } finally {
      setLoading(false);
    }
  }, [table, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    fetchData();
  };

  return { data, error, loading, refetch };
}
