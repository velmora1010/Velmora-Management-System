import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export type QuickRangeOption = 'Today' | 'Last 7 Days' | 'Last 15 Days' | 'Previous Month' | 'Custom Range';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  label?: string;
}

interface DateRangePickerModalProps {
  initialRange?: DateRange | null;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  initialRange,
  onClose,
  onApply
}) => {
  const [selectedQuickRange, setSelectedQuickRange] = useState<QuickRangeOption>(
    (initialRange?.label as QuickRangeOption) || 'Last 7 Days'
  );

  const now = new Date();
  
  // Internal date state
  const [fromDate, setFromDate] = useState<Date | null>(() => {
    if (initialRange?.startDate) return new Date(initialRange.startDate);
    // Default Last 7 Days
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [toDate, setToDate] = useState<Date | null>(() => {
    if (initialRange?.endDate) return new Date(initialRange.endDate);
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  // Calendar Month View Anchor (Left Month)
  const [leftMonthDate, setLeftMonthDate] = useState<Date>(() => {
    const start = fromDate || new Date();
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });

  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Derive Right Month Date
  const rightMonthDate = new Date(leftMonthDate.getFullYear(), leftMonthDate.getMonth() + 1, 1);

  // Helper to format date for display (01 Aug 2026)
  const formatDateString = (date: Date | null): string => {
    if (!date) return 'Select Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Helper for input values (01-Aug-2026)
  const formatInputString = (date: Date | null): string => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Calculate Quick Range Dates
  const handleQuickRangeSelect = (option: QuickRangeOption) => {
    setSelectedQuickRange(option);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    if (option === 'Today') {
      setFromDate(today);
      setToDate(endToday);
    } else if (option === 'Last 7 Days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setFromDate(start);
      setToDate(endToday);
    } else if (option === 'Last 15 Days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 14);
      setFromDate(start);
      setToDate(endToday);
    } else if (option === 'Previous Month') {
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      setFromDate(prevMonthStart);
      setToDate(prevMonthEnd);
    } else if (option === 'Custom Range') {
      // Keep current selection
    }
  };

  // Date click handler for calendar grid
  const handleDateClick = (date: Date) => {
    setSelectedQuickRange('Custom Range');
    const targetDate = new Date(date);
    
    if (!fromDate || (fromDate && toDate)) {
      // First click: set fromDate
      targetDate.setHours(0, 0, 0, 0);
      setFromDate(targetDate);
      setToDate(null);
    } else if (fromDate && !toDate) {
      // Second click: set toDate
      if (targetDate.getTime() < fromDate.getTime()) {
        targetDate.setHours(0, 0, 0, 0);
        setFromDate(targetDate);
        setToDate(null);
      } else {
        targetDate.setHours(23, 59, 59, 999);
        setToDate(targetDate);
      }
    }
  };

  const handlePrevMonth = () => {
    setLeftMonthDate(new Date(leftMonthDate.getFullYear(), leftMonthDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setLeftMonthDate(new Date(leftMonthDate.getFullYear(), leftMonthDate.getMonth() + 1, 1));
  };

  const handleConfirmApply = () => {
    if (!fromDate) return;
    const finalEnd = toDate ? toDate : new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 23, 59, 59, 999);
    
    let label = selectedQuickRange !== 'Custom Range' ? selectedQuickRange : undefined;
    onApply({
      startDate: fromDate,
      endDate: finalEnd,
      label
    });
  };

  // Render month grid days
  const renderMonthDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }

    return days.map((day, idx) => {
      if (!day) {
        return <div key={`empty-${idx}`} className="h-8 w-8" />;
      }

      const time = day.getTime();
      const isStart = fromDate && day.toDateString() === fromDate.toDateString();
      const isEnd = toDate && day.toDateString() === toDate.toDateString();
      
      let inRange = false;
      if (fromDate && toDate) {
        inRange = time > fromDate.getTime() && time < toDate.getTime();
      } else if (fromDate && hoverDate && !toDate) {
        const start = fromDate.getTime();
        const end = hoverDate.getTime();
        inRange = (time >= Math.min(start, end) && time <= Math.max(start, end));
      }

      const isToday = day.toDateString() === now.toDateString();

      return (
        <button
          key={day.toISOString()}
          type="button"
          onClick={() => handleDateClick(day)}
          onMouseEnter={() => setHoverDate(day)}
          className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all relative ${
            isStart || isEnd
              ? 'bg-primary text-white font-bold shadow-md shadow-primary/30 z-10'
              : inRange
              ? 'bg-primary/20 text-primary-light rounded-none'
              : isToday
              ? 'border border-primary text-primary font-bold'
              : 'text-slate-300 hover:bg-white/10'
          }`}
        >
          {day.getDate()}
        </button>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <CalendarIcon className="text-primary" size={20} />
            <span>Select Date Range</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
          
          {/* Quick Ranges Menu */}
          <div className="w-full md:w-56 p-4 space-y-1 bg-background/30 shrink-0">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3 px-3">
              QUICK RANGES
            </p>

            {(['Today', 'Last 7 Days', 'Last 15 Days', 'Previous Month', 'Custom Range'] as QuickRangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleQuickRangeSelect(option)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                  selectedQuickRange === option
                    ? 'bg-primary text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{option}</span>
                {selectedQuickRange === option && <Check size={14} />}
              </button>
            ))}
          </div>

          {/* Dual Month Calendar View */}
          <div className="flex-1 p-5 space-y-5">
            
            {/* Top Inputs: FROM DATE & TO DATE */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  FROM DATE
                </label>
                <div className="bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-white font-medium">
                  {formatInputString(fromDate)}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  TO DATE
                </label>
                <div className="bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-white font-medium">
                  {formatInputString(toDate || fromDate)}
                </div>
              </div>
            </div>

            {/* Month Navigation & Calendars Header */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-border text-muted hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <ChevronLeft size={16} /> Prev Month
              </button>
              
              <div className="text-xs font-bold text-white tracking-widest uppercase">
                {MONTH_NAMES[leftMonthDate.getMonth()]} {leftMonthDate.getFullYear()} — {MONTH_NAMES[rightMonthDate.getMonth()]} {rightMonthDate.getFullYear()}
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-border text-muted hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                Next Month <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendars Grid Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              
              {/* Left Month Calendar */}
              <div className="bg-background/40 p-3 rounded-xl border border-border/40">
                <div className="text-center text-xs font-bold text-primary mb-3">
                  {MONTH_NAMES[leftMonthDate.getMonth()]} {leftMonthDate.getFullYear()}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {WEEKDAY_NAMES.map(w => (
                    <span key={w} className="text-[10px] font-bold text-muted uppercase">{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 justify-items-center">
                  {renderMonthDays(leftMonthDate.getFullYear(), leftMonthDate.getMonth())}
                </div>
              </div>

              {/* Right Month Calendar */}
              <div className="bg-background/40 p-3 rounded-xl border border-border/40">
                <div className="text-center text-xs font-bold text-primary mb-3">
                  {MONTH_NAMES[rightMonthDate.getMonth()]} {rightMonthDate.getFullYear()}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {WEEKDAY_NAMES.map(w => (
                    <span key={w} className="text-[10px] font-bold text-muted uppercase">{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 justify-items-center">
                  {renderMonthDays(rightMonthDate.getFullYear(), rightMonthDate.getMonth())}
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-background/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-muted">
            <span className="font-semibold text-white">Selected: </span>
            <span className="text-primary font-medium">
              {formatDateString(fromDate)} {toDate && `– ${formatDateString(toDate)}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!fromDate}
              onClick={handleConfirmApply}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-primary/20"
            >
              <Check size={14} /> Apply Range
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
