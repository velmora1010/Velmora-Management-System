import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { websiteSalesService } from '../websiteSalesService';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch } from '../types';
import { useWebsiteSalesDateRange } from './WebsiteSalesDateRangeContext';

export interface WebsiteSalesDataContextType {
  startDate: string;
  endDate: string;
  orders: WebsiteConsolidatedOrder[];
  batches: WebsiteUploadBatch[];
  loading: boolean;
  error: string | null;
  loadedRangeKey: string | null;
  refreshData: () => Promise<void>;
}

const WebsiteSalesDataContext = createContext<WebsiteSalesDataContextType | undefined>(undefined);

export const WebsiteSalesDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { startDate, endDate } = useWebsiteSalesDateRange();
  const rangeKey = `${startDate}__${endDate}`;

  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null);

  // In-flight fetch deduplication promise ref
  const activeFetchRef = useRef<{ rangeKey: string; promise: Promise<void> } | null>(null);

  const loadRangeData = useCallback(async (targetStart: string, targetEnd: string, forceRefresh = false) => {
    const key = `${targetStart}__${targetEnd}`;

    // Deduplicate if already loaded for this range and not force-refreshing
    if (!forceRefresh && loadedRangeKey === key && activeFetchRef.current === null) {
      return;
    }

    // Deduplicate if an identical fetch is already in flight
    if (activeFetchRef.current && activeFetchRef.current.rangeKey === key && !forceRefresh) {
      return activeFetchRef.current.promise;
    }

    setLoading(true);
    setError(null);

    const fetchPromise = (async () => {
      try {
        const [bList, fetchedOrders] = await Promise.all([
          websiteSalesService.getUploadBatches(),
          websiteSalesService.getConsolidatedOrders({ startDate: targetStart, endDate: targetEnd })
        ]);

        setBatches(bList);
        setOrders(fetchedOrders);
        setLoadedRangeKey(key);
      } catch (err: any) {
        console.error('[WebsiteSalesDataProvider] Failed to load data:', err);
        setError(err.message || 'Failed to load sales data');
      } finally {
        setLoading(false);
        activeFetchRef.current = null;
      }
    })();

    activeFetchRef.current = { rangeKey: key, promise: fetchPromise };
    return fetchPromise;
  }, [loadedRangeKey]);

  useEffect(() => {
    loadRangeData(startDate, endDate);
  }, [startDate, endDate, loadRangeData]);

  const refreshData = useCallback(async () => {
    await loadRangeData(startDate, endDate, true);
  }, [startDate, endDate, loadRangeData]);

  const value = useMemo(() => ({
    startDate,
    endDate,
    orders,
    batches,
    loading,
    error,
    loadedRangeKey,
    refreshData
  }), [startDate, endDate, orders, batches, loading, error, loadedRangeKey, refreshData]);

  return (
    <WebsiteSalesDataContext.Provider value={value}>
      {children}
    </WebsiteSalesDataContext.Provider>
  );
};

export const useWebsiteSalesData = (): WebsiteSalesDataContextType => {
  const context = useContext(WebsiteSalesDataContext);
  if (!context) {
    throw new Error('useWebsiteSalesData must be used within a WebsiteSalesDataProvider');
  }
  return context;
};
