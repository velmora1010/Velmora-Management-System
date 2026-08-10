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
  | 'this_week'
  | '7days'
  | 'this_month'
  | 'previous_month'
  | 'previousMonth'
  | '30days'
  | 'this_year'
  | 'custom';

export interface QuickRangeConfig {
  key: DateRangePreset;
  label: string;
}

export const QUICK_RANGES: QuickRangeConfig[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: '7days', label: 'Last 7 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'previous_month', label: 'Previous Month' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'this_year', label: 'This Year' }
];

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

  // Determine active preset key for sidebar highlight
  const activePresetKey = useMemo(() => {
    if (!draftStart || !draftEnd) return 'custom';
    if (draftStart === todayStr && draftEnd === todayStr) return 'today';

    const yest = shiftDateString(todayStr, -1);
    if (draftStart === yest && draftEnd === yest) return 'yesterday';

    const parts = todayStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = dt.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monDt = new Date(dt);
    monDt.setDate(dt.getDate() + diffToMon);
    const monStr = `${monDt.getFullYear()}-${String(monDt.getMonth() + 1).padStart(2, '0')}-${String(monDt.getDate()).padStart(2, '0')}`;
    if (draftStart === monStr && draftEnd === todayStr) return 'this_week';

    if (draftStart === shiftDateString(todayStr, -6) && draftEnd === todayStr) return '7days';

    const thisMonthStart = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
    if (draftStart === thisMonthStart && draftEnd === todayStr) return 'this_month';

    // Previous Month Check
    const currYear = parts[0];
    const currMonth = parts[1];
    const prevYear = currMonth === 1 ? currYear - 1 : currYear;
    const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    if (draftStart === prevStart && draftEnd === prevEnd) return 'previous_month';

    if (draftStart === shiftDateString(todayStr, -29) && draftEnd === todayStr) return '30days';

    const thisYearStart = `${parts[0]}-01-01`;
    if (draftStart === thisYearStart && draftEnd === todayStr) return 'this_year';

    return 'custom';
  }, [draftStart, draftEnd, todayStr]);

  // Quick Preset Helper
  const applyPreset = (preset: DateRangePreset) => {
    let start = todayStr;
    let end = todayStr;

    if (preset === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (preset === 'yesterday') {
      const yest = shiftDateString(todayStr, -1);
      start = yest;
      end = yest;
    } else if (preset === 'this_week') {
      const parts = todayStr.split('-').map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      const day = dt.getDay(); // 0 is Sunday
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monDt = new Date(dt);
      monDt.setDate(dt.getDate() + diffToMon);
      
      const monStr = `${monDt.getFullYear()}-${String(monDt.getMonth() + 1).padStart(2, '0')}-${String(monDt.getDate()).padStart(2, '0')}`;
      start = monStr;
      end = todayStr;
    } else if (preset === '7days') {
      start = shiftDateString(todayStr, -6);
      end = todayStr;
    } else if (preset === 'this_month') {
      const parts = todayStr.split('-').map(Number);
      start = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
      end = todayStr;
    } else if (preset === 'previous_month' || preset === 'previousMonth') {
      const parts = todayStr.split('-').map(Number);
      const currYear = parts[0];
      const currMonth = parts[1]; // 1 to 12

      const prevYear = currMonth === 1 ? currYear - 1 : currYear;
      const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();

      start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      end = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === '30days') {
      start = shiftDateString(todayStr, -29);
      end = todayStr;
    } else if (preset === 'this_year') {
      const parts = todayStr.split('-').map(Number);
      start = `${parts[0]}-01-01`;
      end = todayStr;
    }

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

    // Days from next month to fill 42 cells (6 rows x 7 cols)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      const dateStr = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return days;
  };

  // Next month parameters for dual month display
  const nextMonthNum = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const month1Days = useMemo(() => buildMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const month2Days = useMemo(() => buildMonthDays(nextMonthYear, nextMonthNum), [nextMonthYear, nextMonthNum]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2 text-cyan-400">
            <CalendarIcon size={18} />
            <h3 className="text-sm font-extrabold text-white tracking-tight">Select Date Range</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY (QUICK PRESETS + DUAL CALENDARS) */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-y-auto">
          {/* QUICK RANGE PRESETS SIDEBAR */}
          <div className="p-4 lg:w-48 bg-slate-950/40 shrink-0 space-y-1 max-h-[420px] overflow-y-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1 mb-1">
              Quick Ranges
            </span>
            {QUICK_RANGES.map(item => {
              const isSelected = activePresetKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => applyPreset(item.key)}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isSelected && <Clock size={13} className="text-cyan-400 shrink-0" />}
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

            {/* DUAL CALENDAR GRIDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MONTH 1 */}
              <div className="space-y-2">
                <div className="text-center text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 py-1">
                  {WEEKDAY_NAMES.map(w => (
                    <div key={`m1-w-${w}`}>{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs font-mono">
                  {month1Days.map((cell, idx) => {
                    const isSelectedStart = cell.dateStr === draftStart;
                    const isSelectedEnd = cell.dateStr === draftEnd;
                    const isInRange = cell.dateStr >= draftStart && cell.dateStr <= draftEnd;

                    let bgClass = 'hover:bg-slate-800 text-slate-300';
                    if (!cell.isCurrentMonth) bgClass = 'text-slate-600 hover:bg-slate-800/40';

                    if (isSelectedStart || isSelectedEnd) {
                      bgClass = 'bg-cyan-500 text-white font-bold rounded-lg shadow-md';
                    } else if (isInRange) {
                      bgClass = 'bg-cyan-500/20 text-cyan-200 font-semibold';
                    }

                    return (
                      <button
                        key={`m1-d-${cell.dateStr}-${idx}`}
                        type="button"
                        onClick={() => handleDayClick(cell.dateStr)}
                        className={`h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${bgClass}`}
                      >
                        {cell.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MONTH 2 */}
              <div className="space-y-2">
                <div className="text-center text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  {MONTH_NAMES[nextMonthNum]} {nextMonthYear}
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 py-1">
                  {WEEKDAY_NAMES.map(w => (
                    <div key={`m2-w-${w}`}>{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs font-mono">
                  {month2Days.map((cell, idx) => {
                    const isSelectedStart = cell.dateStr === draftStart;
                    const isSelectedEnd = cell.dateStr === draftEnd;
                    const isInRange = cell.dateStr >= draftStart && cell.dateStr <= draftEnd;

                    let bgClass = 'hover:bg-slate-800 text-slate-300';
                    if (!cell.isCurrentMonth) bgClass = 'text-slate-600 hover:bg-slate-800/40';

                    if (isSelectedStart || isSelectedEnd) {
                      bgClass = 'bg-cyan-500 text-white font-bold rounded-lg shadow-md';
                    } else if (isInRange) {
                      bgClass = 'bg-cyan-500/20 text-cyan-200 font-semibold';
                    }

                    return (
                      <button
                        key={`m2-d-${cell.dateStr}-${idx}`}
                        type="button"
                        onClick={() => handleDayClick(cell.dateStr)}
                        className={`h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${bgClass}`}
                      >
                        {cell.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs">
          <div className="text-slate-400 font-mono">
            Selected: <span className="text-cyan-300 font-bold">{formatSalesDateShort(draftStart)} — {formatSalesDateShort(draftEnd)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              <Check size={15} /> Apply Range
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
