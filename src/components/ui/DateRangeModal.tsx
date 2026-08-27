import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

export type QuickRangeKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'prev_month'
  | 'last_30_days'
  | 'this_year'
  | 'custom';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  quickRangeKey?: QuickRangeKey;
}

interface DateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: DateRange) => void;
  initialRange?: DateRange;
}

const QUICK_RANGES: { key: QuickRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'prev_month', label: 'Previous Month' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'this_year', label: 'This Year' },
];

export function getQuickRangeDates(key: QuickRangeKey): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  switch (key) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      end.setDate(now.getDate() - 1);
      break;
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      break;
    }
    case 'last_7_days':
      start.setDate(now.getDate() - 6);
      break;
    case 'this_month':
      start.setDate(1);
      end.setMonth(now.getMonth() + 1, 0);
      break;
    case 'prev_month':
      start.setMonth(now.getMonth() - 1, 1);
      end.setMonth(now.getMonth(), 0);
      break;
    case 'last_30_days':
      start.setDate(now.getDate() - 29);
      break;
    case 'this_year':
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      break;
    default:
      break;
  }
  return { start, end };
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function fmtShortDate(d: Date | null): string {
  if (!d) return '—';
  return `${d.getDate()} ${SHORT_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtInputDate(d: Date | null): string {
  if (!d) return 'Select Date';
  return `${String(d.getDate()).padStart(2, '0')}-${SHORT_MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

export const DateRangeModal: React.FC<DateRangeModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialRange,
}) => {
  const [selectedQuickRange, setSelectedQuickRange] = useState<QuickRangeKey>(
    initialRange?.quickRangeKey || 'last_7_days'
  );

  const defaultDates = getQuickRangeDates(initialRange?.quickRangeKey || 'last_7_days');
  const [startDate, setStartDate] = useState<Date | null>(initialRange?.startDate || defaultDates.start);
  const [endDate, setEndDate] = useState<Date | null>(initialRange?.endDate || defaultDates.end);
  const [selectingTarget, setSelectingTarget] = useState<'start' | 'end'>('start');

  // Month navigation (shows 2 months: currentViewMonth and currentViewMonth + 1)
  const [viewYear, setViewYear] = useState<number>((startDate || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState<number>((startDate || new Date()).getMonth());

  useEffect(() => {
    if (initialRange?.startDate && initialRange?.endDate) {
      setStartDate(initialRange.startDate);
      setEndDate(initialRange.endDate);
      setSelectedQuickRange(initialRange.quickRangeKey || 'custom');
      setViewYear(initialRange.startDate.getFullYear());
      setViewMonth(initialRange.startDate.getMonth());
    }
  }, [initialRange, isOpen]);

  if (!isOpen) return null;

  const handleSelectQuickRange = (key: QuickRangeKey) => {
    setSelectedQuickRange(key);
    const { start, end } = getQuickRangeDates(key);
    setStartDate(start);
    setEndDate(end);
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
  };

  const handlePrevMonths = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonths = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedQuickRange('custom');
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
      setSelectingTarget('end');
    } else if (startDate && !endDate) {
      if (date < startDate) {
        setStartDate(date);
        setEndDate(startDate);
      } else {
        setEndDate(date);
      }
      setSelectingTarget('start');
    }
  };

  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  const renderMonthCalendar = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Previous month padding days
    const prevMonthDays = new Date(year, month, 0).getDate();
    const prevDays = Array.from({ length: firstDay }, (_, i) => prevMonthDays - firstDay + i + 1);
    const currentDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const isSameDay = (d1: Date | null, year: number, month: number, day: number) => {
      if (!d1) return false;
      return d1.getFullYear() === year && d1.getMonth() === month && d1.getDate() === day;
    };

    const isInRange = (year: number, month: number, day: number) => {
      if (!startDate || !endDate) return false;
      const target = new Date(year, month, day).getTime();
      const s = new Date(startDate).setHours(0,0,0,0);
      const e = new Date(endDate).setHours(23,59,59,999);
      return target >= s && target <= e;
    };

    return (
      <div className="flex-1">
        <div className="text-center font-bold text-xs text-cyan-400 uppercase tracking-widest mb-3">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 mb-2">
          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {prevDays.map(d => (
            <div key={`prev-${d}`} className="h-8 flex items-center justify-center text-slate-700 select-none">
              {d}
            </div>
          ))}
          {currentDays.map(d => {
            const thisDate = new Date(year, month, d);
            const isStart = isSameDay(startDate, year, month, d);
            const isEnd = isSameDay(endDate, year, month, d);
            const inRange = isInRange(year, month, d);

            let bgClass = 'hover:bg-slate-800 text-slate-200';
            if (isStart || isEnd) {
              bgClass = 'bg-cyan-500 text-slate-950 font-bold rounded-lg shadow-[0_0_10px_rgba(6,182,212,0.4)]';
            } else if (inRange) {
              bgClass = 'bg-cyan-950/60 text-cyan-200 rounded-none';
            }

            return (
              <button
                key={d}
                type="button"
                onClick={() => handleDayClick(thisDate)}
                className={`h-8 w-full flex items-center justify-center transition-all ${bgClass}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleApplyClick = () => {
    let finalStart = startDate;
    let finalEnd = endDate;

    if (finalStart && !finalEnd) {
      finalEnd = new Date(finalStart);
    }
    if (!finalStart && finalEnd) {
      finalStart = new Date(finalEnd);
    }
    if (!finalStart && !finalEnd) {
      const d = getQuickRangeDates('last_7_days');
      finalStart = d.start;
      finalEnd = d.end;
    }

    const s = new Date(finalStart!);
    s.setHours(0, 0, 0, 0);
    const e = new Date(finalEnd!);
    e.setHours(23, 59, 59, 999);

    onApply({
      startDate: s,
      endDate: e,
      quickRangeKey: selectedQuickRange,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden text-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <CalendarIcon size={18} />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">Select Date Range</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col md:flex-row min-h-[380px]">
          
          {/* Left Column: Quick Ranges */}
          <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-slate-800 p-4 bg-slate-950/30 flex flex-col gap-1 shrink-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-3">
              Quick Ranges
            </div>
            {QUICK_RANGES.map(item => {
              const isSelected = selectedQuickRange === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectQuickRange(item.key)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isSelected
                      ? 'bg-cyan-950/60 border border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>{item.label}</span>
                  {isSelected && <Clock size={13} className="text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Right Column: Date Input Fields & 2-Month Calendars */}
          <div className="flex-1 p-6 flex flex-col justify-between">
            
            {/* Top Inputs: FROM DATE & TO DATE */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</span>
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>{fmtInputDate(startDate)}</span>
                  <CalendarIcon size={14} className="text-slate-500" />
                </div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</span>
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>{fmtInputDate(endDate)}</span>
                  <CalendarIcon size={14} className="text-slate-500" />
                </div>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonths}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {MONTH_NAMES[viewMonth]} {viewYear} — {MONTH_NAMES[nextMonth]} {nextMonthYear}
              </div>
              <button
                type="button"
                onClick={handleNextMonths}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Dual Calendars */}
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              {renderMonthCalendar(viewYear, viewMonth)}
              {renderMonthCalendar(nextMonthYear, nextMonth)}
            </div>

          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-slate-800 bg-slate-950/60 gap-4">
          <div className="text-xs font-bold text-slate-300">
            Selected: <span className="text-cyan-400">{fmtShortDate(startDate)} — {fmtShortDate(endDate)}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyClick}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5"
            >
              <Check size={14} /> Apply Range
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
