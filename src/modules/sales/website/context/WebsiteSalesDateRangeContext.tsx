import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getTodayInBusinessTimezone, 
  shiftDateRange 
} from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
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
}

const WebsiteSalesDateRangeContext = createContext<WebsiteSalesDateRangeContextType | undefined>(undefined);

export const WebsiteSalesDateRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayStr = getTodayInBusinessTimezone();
  
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [preset, setPreset] = useState<DateRangePreset | undefined>('today');
  const [latestAvailableDate, setLatestAvailableDate] = useState<string>(todayStr);

  useEffect(() => {
    let isMounted = true;
    websiteSalesService.getLatestSalesDate().then(latestDate => {
      if (!isMounted) return;
      setLatestAvailableDate(latestDate);
      // If latest order date exists and is different from today, intelligently start with the latest date that has orders
      if (latestDate && latestDate !== todayStr) {
        setStartDate(latestDate);
        setEndDate(latestDate);
        setPreset('custom');
      }
    });
    return () => { isMounted = false; };
  }, [todayStr]);

  const setDateRange = (start: string, end: string, newPreset?: DateRangePreset) => {
    setStartDate(start);
    setEndDate(end);
    setPreset(newPreset);
  };

  const resetToToday = () => {
    setStartDate(todayStr);
    setEndDate(todayStr);
    setPreset('today');
  };

  const resetToLatestSalesDate = () => {
    if (latestAvailableDate) {
      setStartDate(latestAvailableDate);
      setEndDate(latestAvailableDate);
      setPreset(latestAvailableDate === todayStr ? 'today' : 'custom');
    } else {
      resetToToday();
    }
  };

  const shiftRange = (direction: -1 | 1) => {
    const { startDate: nextStart, endDate: nextEnd } = shiftDateRange(startDate, endDate, direction);
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
        shiftRange
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
