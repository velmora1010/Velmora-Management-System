import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../useDebounce';
import type { POHeaderPayload } from '../../types';

export interface POHistoryRecord extends POHeaderPayload {
  id: string;
}

const poHistoryCache: Record<string, { data: POHistoryRecord[]; count: number; timestamp: number }> = {};
const CACHE_TTL = 30 * 1000; // 30 seconds for transactional history

export const usePOHistory = (pageSize = 10) => {
  const [page, setPage] = useState(0); // 0-indexed
  const [searchTerm, setSearchTerm] = useState('');
  
  // 300ms debounce as requested
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  const cacheKey = `${page}-${debouncedSearch}`;

  const [data, setData] = useState<POHistoryRecord[]>(() => poHistoryCache[cacheKey]?.data || []);
  const [totalCount, setTotalCount] = useState(() => poHistoryCache[cacheKey]?.count || 0);
  const [isLoading, setIsLoading] = useState(() => !poHistoryCache[cacheKey]);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    const cached = poHistoryCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setTotalCount(cached.count);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let query = supabase
        .from('purchase_orders')
        .select('*', { count: 'exact' });

      // Apply search filter (PO Number OR Vendor Name)
      if (debouncedSearch) {
        query = query.or(`po_number.ilike.%${debouncedSearch}%,vendor_name.ilike.%${debouncedSearch}%`);
      }

      // Apply Pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data: result, error: fetchErr, count } = await query;

      if (fetchErr) throw fetchErr;

      const newRecords = result as POHistoryRecord[];
      const newCount = count || 0;

      poHistoryCache[cacheKey] = {
        data: newRecords,
        count: newCount,
        timestamp: Date.now()
      };

      setData(newRecords);
      setTotalCount(newCount);

    } catch (err: unknown) {
      console.error('Failed to fetch PO History:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, pageSize, cacheKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, [fetchHistory]);

  // Reset page to 0 when search term changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
  }, [debouncedSearch]);

  const nextPage = () => {
    if ((page + 1) * pageSize < totalCount) {
      setPage(p => p + 1);
    }
  };

  const prevPage = () => {
    if (page > 0) {
      setPage(p => p - 1);
    }
  };

  return {
    data,
    totalCount,
    page,
    pageSize,
    searchTerm,
    setSearchTerm,
    isLoading,
    error,
    nextPage,
    prevPage,
    refresh: fetchHistory,
  };
};
