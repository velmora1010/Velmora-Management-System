import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Check, 
  Clock 
} from 'lucide-react';
import { 
  getTodayInBusinessTimezone, 
  formatSalesDateShort, 
  shiftDateString 
} from '../websiteSalesUtils';

export type DateRangePreset = 
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'last7Days'
  | 'thisMonth'
  | 'previousMonth'
  | 'last30Days'
  | 'thisYear'
  | 'custom';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string, preset?: DateRangePreset) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Shared Single Quick Ranges Config
export const QUICK_RANGES: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'last7Days', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'previousMonth', label: 'Previous Month' },
  { key: 'last30Days', label: 'Last 30 Days' },
  { key: 'thisYear', label: 'This Year' }
];

export const getPresetRange = (preset: DateRangePreset, todayStr: string): { start: string; end: string } => {
  let start = todayStr;
  let end = todayStr;

  if (preset === 'today') {
    start = todayStr;
    end = todayStr;
  } else if (preset === 'yesterday') {
    const yest = shiftDateString(todayStr, -1);
    start = yest;
    end = yest;
  } else if (preset === 'thisWeek') {
    const parts = todayStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = dt.getDay(); // 0 is Sunday
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monDt = new Date(dt);
    monDt.setDate(dt.getDate() + diffToMon);
    
    const monStr = `${monDt.getFullYear()}-${String(monDt.getMonth() + 1).padStart(2, '0')}-${String(monDt.getDate()).padStart(2, '0')}`;
    start = monStr;
    end = todayStr;
  } else if (preset === 'last7Days') {
    start = shiftDateString(todayStr, -6);
    end = todayStr;
  } else if (preset === 'thisMonth') {
    const parts = todayStr.split('-').map(Number);
    start = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
    end = todayStr;
  } else if (preset === 'previousMonth') {
    const parts = todayStr.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    end = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
  } else if (preset === 'last30Days') {
    start = shiftDateString(todayStr, -29);
    end = todayStr;
  } else if (preset === 'thisYear') {
    const parts = todayStr.split('-').map(Number);
    start = `${parts[0]}-01-01`;
    end = todayStr;
  }

  return { start, end };
};

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  onApply
}) => {
  const todayStr = getTodayInBusinessTimezone();

  // Local draft state
  const [draftStart, setDraftStart] = useState<string>(startDate || todayStr);
  const [draftEnd, setDraftEnd] = useState<string>(endDate || todayStr);
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');

  // Month navigation view state (YYYY, MM 0-indexed)
  const initialYearMonth = useMemo(() => {
    const s = startDate || todayStr;
    const parts = s.split('-').map(Number);
    return { year: parts[0] || 2026, month: (parts[1] || 8) - 1 };
  }, [startDate, todayStr]);

  const [viewYear, setViewYear] = useState<number>(initialYearMonth.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYearMonth.month);

  useEffect(() => {
    if (isOpen) {
      setDraftStart(startDate || todayStr);
      setDraftEnd(endDate || todayStr);
      const parts = (startDate || todayStr).split('-').map(Number);
      setViewYear(parts[0] || 2026);
      setViewMonth((parts[1] || 8) - 1);
      setSelectingStep('start');
    }
  }, [isOpen, startDate, endDate, todayStr]);

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Quick Preset Helper
  const applyPreset = (preset: DateRangePreset) => {
    const { start, end } = getPresetRange(preset, todayStr);

    setDraftStart(start);
    setDraftEnd(end);

    // Update view to preset start date
    const startParts = start.split('-').map(Number);
    setViewYear(startParts[0]);
    setViewMonth(startParts[1] - 1);

    // Immediately apply for presets
    onApply(start, end, preset);
    onClose();
  };

  const handlePrevMonthView = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonthView = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Calendar Day Click Logic
  const handleDayClick = (dateStr: string) => {
    if (selectingStep === 'start' || dateStr < draftStart) {
      setDraftStart(dateStr);
      setDraftEnd(dateStr);
      setSelectingStep('end');
    } else {
      setDraftEnd(dateStr);
      setSelectingStep('start');
    }
  };

  const handleApplyCustom = () => {
    let finalStart = draftStart;
    let finalEnd = draftEnd;
    if (finalStart > finalEnd) {
      const tmp = finalStart;
      finalStart = finalEnd;
      finalEnd = tmp;
    }
    onApply(finalStart, finalEnd, 'custom');
    onClose();
  };

  // Build calendar matrix for specified month/year
  const buildMonthDays = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const pDay = prevMonthDays - i;
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      const dateStr = `${py}-${String(pm + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: pDay, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Remaining trailing days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      const dateStr = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: false });
    }

    return days;
  };

  const month1Days = useMemo(() => buildMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  
  // Second month (viewMonth + 1)
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonthNum = viewMonth === 11 ? 0 : viewMonth + 1;
  const month2Days = useMemo(() => buildMonthDays(nextMonthYear, nextMonthNum), [nextMonthYear, nextMonthNum]);

  if (!isOpen) return null;

  const currentMin = draftStart < draftEnd ? draftStart : draftEnd;
  const currentMax = draftStart < draftEnd ? draftEnd : draftStart;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Select Sales Date Range"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        {/* HEADER */}
        <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-cyan-400">
            <CalendarIcon size={20} />
            <h2 className="text-lg font-extrabold text-white tracking-tight">Select Date Range</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close Date Range Selector"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY (QUICK PRESETS + DUAL CALENDARS) */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
          {/* QUICK RANGE PRESETS SIDEBAR */}
          <div className="p-4 lg:w-48 bg-slate-950/40 shrink-0 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1 mb-1">
              Quick Ranges
            </span>
            {QUICK_RANGES.map((item) => {
              const { start: pStart, end: pEnd } = getPresetRange(item.key, todayStr);
              const isActive = draftStart === pStart && draftEnd === pEnd;
              return (
                <button
                  key={item.key}
                  onClick={() => applyPreset(item.key)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.key === 'today' && <Clock size={13} className="text-cyan-400" />}
                </button>
              );
            })}
          </div>

          {/* DUAL CALENDAR MONTH VIEWS */}
          <div className="flex-1 p-5 space-y-5">
            {/* INPUT CONTROLS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">From Date</label>
                <input
                  type="date"
                  value={draftStart}
                  onChange={e => {
                    if (e.target.value) setDraftStart(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">To Date</label>
                <input
                  type="date"
                  value={draftEnd}
                  onChange={e => {
                    if (e.target.value) setDraftEnd(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* MONTH NAVIGATION */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonthView}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
                {MONTH_NAMES[viewMonth]} {viewYear} — {MONTH_NAMES[nextMonthNum]} {nextMonthYear}
              </div>
              <button
                type="button"
                onClick={handleNextMonthView}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* CALENDARS GRID (MONTH 1 & MONTH 2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MONTH 1 */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-cyan-400 text-center uppercase tracking-wider">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_NAMES.map(w => (
                    <span key={w} className="text-[10px] font-bold text-slate-400 py-1">{w}</span>
                  ))}
                  {month1Days.map((d, i) => {
                    const isStart = d.dateStr === currentMin;
                    const isEnd = d.dateStr === currentMax;
                    const inRange = d.dateStr >= currentMin && d.dateStr <= currentMax;

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleDayClick(d.dateStr)}
                        className={`h-8 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                          !d.isCurrentMonth ? 'text-slate-600 opacity-40' : 'text-slate-200'
                        } ${
                          isStart || isEnd
                            ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-md shadow-cyan-500/20'
                            : inRange
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'hover:bg-slate-800'
                        }`}
                      >
                        {d.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MONTH 2 */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-cyan-400 text-center uppercase tracking-wider">
                  {MONTH_NAMES[nextMonthNum]} {nextMonthYear}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_NAMES.map(w => (
                    <span key={w} className="text-[10px] font-bold text-slate-400 py-1">{w}</span>
                  ))}
                  {month2Days.map((d, i) => {
                    const isStart = d.dateStr === currentMin;
                    const isEnd = d.dateStr === currentMax;
                    const inRange = d.dateStr >= currentMin && d.dateStr <= currentMax;

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleDayClick(d.dateStr)}
                        className={`h-8 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                          !d.isCurrentMonth ? 'text-slate-600 opacity-40' : 'text-slate-200'
                        } ${
                          isStart || isEnd
                            ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-md shadow-cyan-500/20'
                            : inRange
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'hover:bg-slate-800'
                        }`}
                      >
                        {d.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Selected: <span className="text-cyan-300 font-bold">{formatSalesDateShort(currentMin)}</span> — <span className="text-cyan-300 font-bold">{formatSalesDateShort(currentMax)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
            >
              <Check size={14} /> Apply Range
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
