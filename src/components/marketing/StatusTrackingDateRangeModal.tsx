import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  X, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Check 
} from 'lucide-react';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export type QuickRangeKey = 
  | 'Today' 
  | 'Yesterday' 
  | 'This Week' 
  | 'Last 7 Days' 
  | 'This Month' 
  | 'Previous Month' 
  | 'Last 30 Days' 
  | 'This Year';

interface StatusTrackingDateRangeModalProps {
  isOpen: boolean;
  initialRange?: DateRange | null;
  onApply: (range: DateRange) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDisplayDate = (ymd: string): string => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const monthName = MONTH_SHORT[m - 1] || '';
  return `${String(d).padStart(2, '0')}-${monthName}-${y}`;
};

export const formatSelectedRangeText = (start: string, end: string): string => {
  if (!start) return '';
  const partsS = start.split('-');
  const yS = partsS[0];
  const mS = MONTH_SHORT[parseInt(partsS[1], 10) - 1] || '';
  const dS = String(parseInt(partsS[2], 10)).padStart(2, '0');
  const startStr = `${dS} ${mS} ${yS}`;

  if (!end || start === end) return `${startStr} — ${startStr}`;

  const partsE = end.split('-');
  const yE = partsE[0];
  const mE = MONTH_SHORT[parseInt(partsE[1], 10) - 1] || '';
  const dE = String(parseInt(partsE[2], 10)).padStart(2, '0');
  const endStr = `${dE} ${mE} ${yE}`;

  return `${startStr} — ${endStr}`;
};

const getQuickRangeDates = (key: QuickRangeKey, referenceDate = new Date()): DateRange => {
  const now = new Date(referenceDate);
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case 'Today': {
      const todayStr = toYMD(now);
      return { start: todayStr, end: todayStr };
    }
    case 'Yesterday': {
      const yest = new Date(y, m, d - 1);
      const yestStr = toYMD(yest);
      return { start: yestStr, end: yestStr };
    }
    case 'This Week': {
      // Week starting Sunday
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(y, m, d - dayOfWeek);
      const endOfWeek = new Date(y, m, d + (6 - dayOfWeek));
      return { start: toYMD(startOfWeek), end: toYMD(endOfWeek) };
    }
    case 'Last 7 Days': {
      const start = new Date(y, m, d - 6);
      return { start: toYMD(start), end: toYMD(now) };
    }
    case 'This Month': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { start: toYMD(start), end: toYMD(end) };
    }
    case 'Previous Month': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { start: toYMD(start), end: toYMD(end) };
    }
    case 'Last 30 Days': {
      const start = new Date(y, m, d - 29);
      return { start: toYMD(start), end: toYMD(now) };
    }
    case 'This Year': {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      return { start: toYMD(start), end: toYMD(end) };
    }
  }
};

const QUICK_RANGE_LIST: QuickRangeKey[] = [
  'Today',
  'Yesterday',
  'This Week',
  'Last 7 Days',
  'This Month',
  'Previous Month',
  'Last 30 Days',
  'This Year'
];

export const StatusTrackingDateRangeModal: React.FC<StatusTrackingDateRangeModalProps> = ({
  isOpen,
  initialRange,
  onApply,
  onClose
}) => {
  const todayYMD = useMemo(() => toYMD(new Date()), []);

  const [draftStart, setDraftStart] = useState<string>(() => initialRange?.start || todayYMD);
  const [draftEnd, setDraftEnd] = useState<string>(() => initialRange?.end || todayYMD);
  const [selectedQuickRange, setSelectedQuickRange] = useState<QuickRangeKey | null>(() => {
    if (!initialRange) return 'Today';
    for (const qr of QUICK_RANGE_LIST) {
      const r = getQuickRangeDates(qr);
      if (r.start === initialRange.start && r.end === initialRange.end) return qr;
    }
    return null;
  });

  // Calendar view month: leftMonth (year & month index 0..11)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (initialRange?.start) {
      return parseInt(initialRange.start.split('-')[0], 10) || new Date().getFullYear();
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (initialRange?.start) {
      return (parseInt(initialRange.start.split('-')[1], 10) - 1) || new Date().getMonth();
    }
    return new Date().getMonth();
  });

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const start = initialRange?.start || todayYMD;
      const end = initialRange?.end || todayYMD;
      setDraftStart(start);
      setDraftEnd(end);

      let matchedQuick: QuickRangeKey | null = null;
      for (const qr of QUICK_RANGE_LIST) {
        const r = getQuickRangeDates(qr);
        if (r.start === start && r.end === end) {
          matchedQuick = qr;
          break;
        }
      }
      setSelectedQuickRange(matchedQuick);

      const y = parseInt(start.split('-')[0], 10) || new Date().getFullYear();
      const m = (parseInt(start.split('-')[1], 10) - 1);
      setViewYear(y);
      setViewMonth(isNaN(m) ? new Date().getMonth() : m);
    }
  }, [isOpen, initialRange, todayYMD]);

  // Navigate months
  const handlePrevMonth = () => {
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  // Quick range select
  const handleSelectQuickRange = (key: QuickRangeKey) => {
    const range = getQuickRangeDates(key);
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setSelectedQuickRange(key);

    // Sync view month to start date of range
    const parts = range.start.split('-');
    setViewYear(parseInt(parts[0], 10));
    setViewMonth(parseInt(parts[1], 10) - 1);
  };

  // Day click on calendar
  const handleDayClick = (ymd: string) => {
    setSelectedQuickRange(null);

    // If starting a fresh range selection
    if (!draftStart || (draftStart && draftEnd && draftStart !== draftEnd)) {
      setDraftStart(ymd);
      setDraftEnd(ymd);
    } else if (draftStart && draftStart === draftEnd) {
      // Second click: either same date or extends range
      if (ymd < draftStart) {
        setDraftStart(ymd);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(ymd);
      }
    } else {
      setDraftStart(ymd);
      setDraftEnd(ymd);
    }
  };

  // Apply range
  const handleApply = () => {
    if (!draftStart) return;
    const finalStart = draftStart <= (draftEnd || draftStart) ? draftStart : (draftEnd || draftStart);
    const finalEnd = draftStart <= (draftEnd || draftStart) ? (draftEnd || draftStart) : draftStart;
    onApply({ start: finalStart, end: finalEnd });
    onClose();
  };

  // Build grid of days for a given year & month (index 0..11)
  const buildMonthGrid = (year: number, month: number) => {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      dayNumber: number;
      ymd: string;
      isCurrentMonth: boolean;
    }> = [];

    // Preceding days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dNum);
      cells.push({
        dayNumber: dNum,
        ymd: toYMD(prevDate),
        isCurrentMonth: false
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      cells.push({
        dayNumber: d,
        ymd: toYMD(curDate),
        isCurrentMonth: true
      });
    }

    // Trailing days from next month to fill grid to 35 or 42 cells
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      cells.push({
        dayNumber: d,
        ymd: toYMD(nextDate),
        isCurrentMonth: false
      });
    }

    return cells;
  };

  // Right month (next month after viewMonth)
  const rightMonthIndex = (viewMonth + 1) % 12;
  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const leftCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const rightCells = useMemo(() => buildMonthGrid(rightYear, rightMonthIndex), [rightYear, rightMonthIndex]);

  if (!isOpen) return null;

  const effectiveStart = draftStart && draftEnd && draftStart > draftEnd ? draftEnd : draftStart;
  const effectiveEnd = draftStart && draftEnd && draftStart > draftEnd ? draftStart : draftEnd;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-[#0b1329] border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col text-slate-100 ring-1 ring-cyan-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#080e1e]">
          <div className="flex items-center gap-2.5">
            <CalendarIcon size={18} className="text-cyan-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Select Date Range
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left Quick Ranges + Right 2-Month Calendar */}
        <div className="flex flex-col md:flex-row p-5 sm:p-6 gap-6">
          {/* Left Column: Quick Ranges */}
          <div className="w-full md:w-48 shrink-0 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
              Quick Ranges
            </span>
            <div className="flex flex-col gap-1.5">
              {QUICK_RANGE_LIST.map((key) => {
                const isSelected = selectedQuickRange === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectQuickRange(key)}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border border-cyan-500/70 bg-cyan-950/40 text-cyan-300 shadow-sm shadow-cyan-950/60 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <span>{key}</span>
                    {key === 'Today' && isSelected && (
                      <Clock size={13} className="text-cyan-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Area: Inputs + Months Navigation + Side-by-Side Calendar */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Top Inputs: FROM DATE & TO DATE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-0.5">
                  From Date
                </label>
                <div className="h-10 px-3.5 rounded-xl bg-[#070c18] border border-slate-700/80 flex items-center justify-between text-xs sm:text-sm text-slate-200 font-mono font-medium shadow-inner">
                  <span>{formatDisplayDate(effectiveStart)}</span>
                  <CalendarIcon size={14} className="text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-0.5">
                  To Date
                </label>
                <div className="h-10 px-3.5 rounded-xl bg-[#070c18] border border-slate-700/80 flex items-center justify-between text-xs sm:text-sm text-slate-200 font-mono font-medium shadow-inner">
                  <span>{formatDisplayDate(effectiveEnd)}</span>
                  <CalendarIcon size={14} className="text-slate-500" />
                </div>
              </div>
            </div>

            {/* Navigation Header: < OCTOBER 2026 — NOVEMBER 2026 > */}
            <div className="flex items-center justify-between px-2 pt-2 pb-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-xs sm:text-sm font-bold text-slate-200 tracking-wider uppercase font-mono">
                {MONTH_NAMES[viewMonth]} {viewYear} — {MONTH_NAMES[rightMonthIndex]} {rightYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 2-Month Side-by-Side Calendar View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
              {/* Left Month */}
              <div className="bg-[#070c18]/50 border border-slate-800/80 rounded-xl p-3">
                <div className="text-center font-bold text-cyan-400 text-xs sm:text-sm mb-3 tracking-wide">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </div>

                <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-2">
                  {WEEKDAYS.map((wd) => (
                    <div key={`left-wd-${wd}`}>{wd}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {leftCells.map((cell, idx) => {
                    const isStart = cell.ymd === effectiveStart;
                    const isEnd = cell.ymd === effectiveEnd;
                    const isInRange = effectiveStart && effectiveEnd && cell.ymd > effectiveStart && cell.ymd < effectiveEnd;
                    const isBoundary = isStart || isEnd;

                    return (
                      <button
                        key={`left-cell-${idx}-${cell.ymd}`}
                        type="button"
                        onClick={() => cell.isCurrentMonth && handleDayClick(cell.ymd)}
                        disabled={!cell.isCurrentMonth}
                        className={`h-8 w-full flex items-center justify-center text-xs transition-colors cursor-pointer font-medium select-none ${
                          !cell.isCurrentMonth
                            ? 'text-slate-600 opacity-40 cursor-not-allowed'
                            : isBoundary
                              ? 'bg-cyan-500 text-slate-950 font-black rounded-lg shadow-md shadow-cyan-500/40 z-10'
                              : isInRange
                                ? 'bg-cyan-950/60 text-cyan-200 font-semibold rounded-none'
                                : 'text-slate-200 hover:bg-slate-800 rounded-lg'
                        } ${isStart && isEnd ? 'rounded-lg' : isStart ? 'rounded-l-lg' : isEnd ? 'rounded-r-lg' : ''}`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Month */}
              <div className="bg-[#070c18]/50 border border-slate-800/80 rounded-xl p-3">
                <div className="text-center font-bold text-cyan-400 text-xs sm:text-sm mb-3 tracking-wide">
                  {MONTH_NAMES[rightMonthIndex]} {rightYear}
                </div>

                <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-2">
                  {WEEKDAYS.map((wd) => (
                    <div key={`right-wd-${wd}`}>{wd}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {rightCells.map((cell, idx) => {
                    const isStart = cell.ymd === effectiveStart;
                    const isEnd = cell.ymd === effectiveEnd;
                    const isInRange = effectiveStart && effectiveEnd && cell.ymd > effectiveStart && cell.ymd < effectiveEnd;
                    const isBoundary = isStart || isEnd;

                    return (
                      <button
                        key={`right-cell-${idx}-${cell.ymd}`}
                        type="button"
                        onClick={() => cell.isCurrentMonth && handleDayClick(cell.ymd)}
                        disabled={!cell.isCurrentMonth}
                        className={`h-8 w-full flex items-center justify-center text-xs transition-colors cursor-pointer font-medium select-none ${
                          !cell.isCurrentMonth
                            ? 'text-slate-600 opacity-40 cursor-not-allowed'
                            : isBoundary
                              ? 'bg-cyan-500 text-slate-950 font-black rounded-lg shadow-md shadow-cyan-500/40 z-10'
                              : isInRange
                                ? 'bg-cyan-950/60 text-cyan-200 font-semibold rounded-none'
                                : 'text-slate-200 hover:bg-slate-800 rounded-lg'
                        } ${isStart && isEnd ? 'rounded-lg' : isStart ? 'rounded-l-lg' : isEnd ? 'rounded-r-lg' : ''}`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-[#080e1e] gap-3">
          <div className="text-xs text-slate-300 font-mono">
            Selected: <span className="text-cyan-400 font-bold">{formatSelectedRangeText(effectiveStart, effectiveEnd)}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-slate-700/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-950/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Apply Range</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
