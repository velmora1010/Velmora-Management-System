import React, { createContext, useContext, useState } from 'react';
import { 
  getTodayInBusinessTimezone, 
  shiftDateRange 
} from '../websiteSalesUtils';
import type { DateRangePreset } from '../components/DateRangePickerModal';

export interface WebsiteSalesDateRangeContextType {
  startDate: string;
  endDate: string;
  preset?: DateRangePreset;
  setDateRange: (start: string, end: string, preset?: DateRangePreset) => void;
  resetToToday: () => void;
  shiftRange: (direction: -1 | 1) => void;
}

const WebsiteSalesDateRangeContext = createContext<WebsiteSalesDateRangeContextType | undefined>(undefined);

export const WebsiteSalesDateRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayStr = getTodayInBusinessTimezone();
  
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [preset, setPreset] = useState<DateRangePreset | undefined>('today');

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
        setDateRange,
        resetToToday,
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
