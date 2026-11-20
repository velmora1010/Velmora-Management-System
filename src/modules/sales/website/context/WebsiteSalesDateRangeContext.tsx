import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getTodayInBusinessTimezone, 
  shiftDateRange 
} from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch } from '../types';
import type { DateRangePreset } from '../components/DateRangePickerModal';

export interface WebsiteSalesDateRangeContextType {
  startDate: string;
  endDate: string;
  preset?: DateRangePreset;
  latestAvailableDate?: string;
  setDateRange: (start: string, end: string, preset?: DateRangePreset) => void;
  resetToToday: () => void;
  resetToLatestSalesDate: () => void;
  shiftRange: (direction: -1 | 1) => void;
  // Shared Data & Synchronized Loading State
  orders: WebsiteConsolidatedOrder[];
  batches: WebsiteUploadBatch[];
  isLoading: boolean;
  loadingProgressText: string;
  error: string | null;
  refreshData: () => Promise<void>;
}

const WebsiteSalesDateRangeContext = createContext<WebsiteSalesDateRangeContextType | undefined>(undefined);

export const WebsiteSalesDateRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayStr = getTodayInBusinessTimezone();
  
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [preset, setPreset] = useState<DateRangePreset | undefined>('today');
  const [latestAvailableDate, setLatestAvailableDate] = useState<string>(todayStr);

  // Synchronized Dataset and Loading States
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgressText, setLoadingProgressText] = useState<string>('Updating sales data...');
  const [error, setError] = useState<string | null>(null);

  // Active Request Counter to prevent race conditions and out-of-order execution
  const activeRequestIdRef = useRef<number>(0);

  // Fetch data with cancellation & race condition protection
  const fetchData = useCallback(async (start: string, end: string, forceRefresh = false) => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setLoadingProgressText('Updating sales data...');

    try {
      const [fetchedBatches, fetchedOrders] = await Promise.all([
        websiteSalesService.getUploadBatches(forceRefresh),
        websiteSalesService.getConsolidatedOrders({
          startDate: start,
          endDate: end,
          forceRefresh
        })
      ]);

      // If a newer date selection occurred while this query was in flight, ignore this stale result
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      setBatches(fetchedBatches);
      setOrders(fetchedOrders);
      setError(null);
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        console.error('[WebsiteSalesDateRangeContext] Fetch failed:', err);
        setError(err?.message || 'Failed to update sales data');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initialize and check latest available date
  useEffect(() => {
    let isMounted = true;
    websiteSalesService.getLatestSalesDate().then(latestDate => {
      if (!isMounted) return;
      setLatestAvailableDate(latestDate);
      if (latestDate && latestDate !== todayStr) {
        setStartDate(latestDate);
        setEndDate(latestDate);
        setPreset('custom');
      }
    });
    return () => { isMounted = false; };
  }, [todayStr]);

  // Synchronize data fetch whenever startDate or endDate changes
  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate, fetchData]);

  // Listen to background sync / upload events to refresh sales data automatically
  useEffect(() => {
    const handleUpdate = () => {
      fetchData(startDate, endDate, true);
    };
    window.addEventListener('velmora:website_sales_updated', handleUpdate);
    window.addEventListener('velmora:batch_deleted', handleUpdate);
    return () => {
      window.removeEventListener('velmora:website_sales_updated', handleUpdate);
      window.removeEventListener('velmora:batch_deleted', handleUpdate);
    };
  }, [startDate, endDate, fetchData]);

  const refreshData = useCallback(async () => {
    websiteSalesService.clearCache();
    await fetchData(startDate, endDate, true);
  }, [startDate, endDate, fetchData]);

  const setDateRange = (start: string, end: string, newPreset?: DateRangePreset) => {
    if (start === startDate && end === endDate && newPreset === preset) return;
    setIsLoading(true);
    setLoadingProgressText('Updating sales data...');
    setStartDate(start);
    setEndDate(end);
    setPreset(newPreset);
  };

  const resetToToday = () => {
    if (startDate === todayStr && endDate === todayStr && preset === 'today') return;
    setIsLoading(true);
    setLoadingProgressText('Updating sales data...');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setPreset('today');
  };

  const resetToLatestSalesDate = () => {
    if (latestAvailableDate) {
      if (startDate === latestAvailableDate && endDate === latestAvailableDate) return;
      setIsLoading(true);
      setLoadingProgressText('Updating sales data...');
      setStartDate(latestAvailableDate);
      setEndDate(latestAvailableDate);
      setPreset(latestAvailableDate === todayStr ? 'today' : 'custom');
    } else {
      resetToToday();
    }
  };

  const shiftRange = (direction: -1 | 1) => {
    const { startDate: nextStart, endDate: nextEnd } = shiftDateRange(startDate, endDate, direction);
    setIsLoading(true);
    setLoadingProgressText('Updating sales data...');
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setPreset(nextStart === nextEnd && nextStart === todayStr ? 'today' : 'custom');
  };

  return (
    <WebsiteSalesDateRangeContext.Provider
      value={{
        startDate,
        endDate,
        preset,
        latestAvailableDate,
        setDateRange,
        resetToToday,
        resetToLatestSalesDate,
        shiftRange,
        orders,
        batches,
        isLoading,
        loadingProgressText,
        error,
        refreshData
      }}
    >
      {children}
    </WebsiteSalesDateRangeContext.Provider>
  );
};

export const useWebsiteSalesDateRange = (): WebsiteSalesDateRangeContextType => {
  const context = useContext(WebsiteSalesDateRangeContext);
  if (!context) {
    throw new Error('useWebsiteSalesDateRange must be used within a WebsiteSalesDateRangeProvider');
  }
  return context;
};
