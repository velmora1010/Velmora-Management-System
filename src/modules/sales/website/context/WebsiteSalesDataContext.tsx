import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch } from '../types';
import { websiteSalesService } from '../websiteSalesService';
import { useWebsiteSalesDateRange } from './WebsiteSalesDateRangeContext';

interface WebsiteSalesDataContextType {
  orders: WebsiteConsolidatedOrder[];
  batches: WebsiteUploadBatch[];
  loading: boolean;
  error: string | null;
  loadedRangeKey: string;
  refreshData: () => Promise<void>;
}

const WebsiteSalesDataContext = createContext<WebsiteSalesDataContextType | undefined>(undefined);

export const WebsiteSalesDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { startDate, endDate } = useWebsiteSalesDateRange();
  
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string>('');

  // Request race condition protection
  const requestIdRef = useRef<number>(0);

  const rangeKey = `${startDate}__${endDate}`;

  const fetchDataForRange = useCallback(async (start: string, end: string, force: boolean = false) => {
    const currentKey = `${start}__${end}`;

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      // Fetch upload batches and consolidated orders concurrently
      const [bList, fetchedOrders] = await Promise.all([
        websiteSalesService.getUploadBatches(),
        websiteSalesService.getConsolidatedOrders({ startDate: start, endDate: end })
      ]);

      // Check if a newer request was dispatched while this fetch was in flight
      if (currentRequestId !== requestIdRef.current) {
        console.log(`[Cache Data Provider] Discarding stale response for ${currentKey} (Request #${currentRequestId})`);
        return;
      }

      setBatches(bList);
      setOrders(fetchedOrders);
      setLoadedRangeKey(currentKey);
      setLoading(false);
    } catch (err: any) {
      if (currentRequestId === requestIdRef.current) {
        console.error('[Cache Data Provider] Error loading range data:', err);
        setError(err.message || 'Failed to load sales data');
        setOrders([]);
        setLoading(false);
      }
    }
  }, []);

  // Trigger data fetch whenever startDate or endDate changes
  useEffect(() => {
    fetchDataForRange(startDate, endDate);
  }, [startDate, endDate]);

  const refreshData = useCallback(async () => {
    await fetchDataForRange(startDate, endDate, true);
  }, [startDate, endDate, fetchDataForRange]);

  return (
    <WebsiteSalesDataContext.Provider
      value={{
        orders,
        batches,
        loading,
        error,
        loadedRangeKey,
        refreshData
      }}
    >
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
