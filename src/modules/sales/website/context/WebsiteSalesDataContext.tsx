import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch } from '../types';
import { websiteSalesService } from '../websiteSalesService';
import { useWebsiteSalesDateRange } from './WebsiteSalesDateRangeContext';

export interface WebsiteSalesDataContextType {
  startDate: string;
  endDate: string;
  rangeKey: string;
  orders: WebsiteConsolidatedOrder[];
  batches: WebsiteUploadBatch[];
  loading: boolean;
  error: string | null;
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

  // Stale request guard counter to prevent race conditions
  const requestIdRef = useRef<number>(0);

  const fetchRangeData = useCallback(async () => {
    if (!startDate || !endDate) return;

    const thisRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      // Fetch batches and consolidated orders in parallel for maximum performance
      const [bList, fetchedOrders] = await Promise.all([
        websiteSalesService.getUploadBatches(),
        websiteSalesService.getConsolidatedOrders({ startDate, endDate })
      ]);

      // RACE CONDITION PROTECTION: Only update state if this request is still active
      if (thisRequestId === requestIdRef.current) {
        setBatches(bList);
        setOrders(fetchedOrders);
        setLoading(false);
      }
    } catch (err: any) {
      if (thisRequestId === requestIdRef.current) {
        console.error('[WebsiteSalesDataProvider Error]', err);
        setError(err.message || 'Failed to load sales data for selected date range');
        setLoading(false);
      }
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchRangeData();
  }, [fetchRangeData]);

  return (
    <WebsiteSalesDataContext.Provider
      value={{
        startDate,
        endDate,
        rangeKey,
        orders,
        batches,
        loading,
        error,
        refreshData: fetchRangeData
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
