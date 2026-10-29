import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  X, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import type { LogisticsDatePreset, LogisticsDateField } from '../types/logisticsFilters';
import { 
  formatLocalYMD, 
  parseLocalYMD, 
  formatInputDate, 
  formatRangeDisplay, 
  parseUserInputDate,
  resolveDateRangeForPreset,
  MONTH_NAMES_SHORT,
  MONTH_NAMES_FULL
} from '../types/logisticsFilters';

export interface DateRangeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preset?: LogisticsDatePreset;
  onApply: (range: { startDate: string; endDate: string; preset: LogisticsDatePreset }) => void;
  targetDateField?: LogisticsDateField;
  onTargetDateFieldChange?: (field: LogisticsDateField) => void;
}

const QUICK_RANGES: Array<{ id: LogisticsDatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: '7d', label: 'Last 7 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Previous Month' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' }
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateRangeCalendarModal: React.FC<DateRangeCalendarModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  preset = 'all',
  onApply,
  targetDateField,
  onTargetDateFieldChange
}) => {
  // Local uncommitted selection state
  const [draftStart, setDraftStart] = useState<string>(startDate);
  const [draftEnd, setDraftEnd] = useState<string>(endDate);
  const [draftPreset, setDraftPreset] = useState<LogisticsDatePreset>(preset);

  // Range selection mode: 'idle' = range selected or ready; 'range_in_progress' = clicked start, awaiting end
  const [selectingState, setSelectingState] = useState<'idle' | 'range_in_progress'>('idle');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Direct date text input states
  const [fromInputText, setFromInputText] = useState<string>('');
  const [toInputText, setToInputText] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Month navigation: viewYear and viewMonth (Month 1, 0-indexed)
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());

  // Initialize or reset draft whenever modal opens
  useEffect(() => {
    if (isOpen) {
      let initStart = startDate;
      let initEnd = endDate;
      let initPreset = preset;

      // If preset is not custom or all, resolve its current boundaries
      if (preset !== 'all' && preset !== 'custom') {
        const resolved = resolveDateRangeForPreset(preset);
        if (resolved.start && resolved.end) {
          initStart = resolved.start;
          initEnd = resolved.end;
        }
      }

      setDraftStart(initStart);
      setDraftEnd(initEnd);
      setDraftPreset(initPreset);
      setFromInputText(formatInputDate(initStart));
      setToInputText(formatInputDate(initEnd));
      setSelectingState('idle');
      setHoverDate(null);
      setInputError(null);

      // Center calendar on selected start date or today
      const refDate = initStart ? parseLocalYMD(initStart) : new Date();
      setViewYear(refDate.getFullYear());
      setViewMonth(refDate.getMonth());
    }
  }, [isOpen, startDate, endDate, preset]);

  // Handle ESC key to discard and close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Month 2 is viewMonth + 1
  const { m2Year, m2Month } = useMemo(() => {
    let y = viewYear;
    let m = viewMonth + 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    return { m2Year: y, m2Month: m };
  }, [viewYear, viewMonth]);

  // Previous month navigation
  const handlePrevMonth = () => {
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  // Next month navigation
  const handleNextMonth = () => {
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  // Quick range click handler
  const handleQuickRangeClick = (selectedPreset: LogisticsDatePreset) => {
    setInputError(null);
    if (selectedPreset === 'custom') {
      setDraftPreset('custom');
      return;
    }

    const resolved = resolveDateRangeForPreset(selectedPreset);
    setDraftStart(resolved.start);
    setDraftEnd(resolved.end);
    setDraftPreset(selectedPreset);
    setFromInputText(formatInputDate(resolved.start));
    setToInputText(formatInputDate(resolved.end));
    setSelectingState('idle');
    setHoverDate(null);

    // Scroll calendar view to start date's month
    if (resolved.start) {
      const d = parseLocalYMD(resolved.start);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  // Calendar Day click handler
  const handleDayClick = (ymd: string) => {
    setInputError(null);

    if (selectingState === 'idle') {
      // 1st click: selects this single date as both start & end
      setDraftStart(ymd);
      setDraftEnd(ymd);
      setFromInputText(formatInputDate(ymd));
      setToInputText(formatInputDate(ymd));
      setDraftPreset('custom');
      setSelectingState('range_in_progress');
    } else {
      // 2nd click: finalizes date range
      if (ymd < draftStart) {
        // If clicked date is earlier, normalize range
        setDraftStart(ymd);
        setDraftEnd(draftStart);
        setFromInputText(formatInputDate(ymd));
        setToInputText(formatInputDate(draftStart));
      } else {
        setDraftEnd(ymd);
        setToInputText(formatInputDate(ymd));
      }
      setDraftPreset('custom');
      setSelectingState('idle');
      setHoverDate(null);
    }
  };

  // Direct date input editing: From Date
  const handleFromInputChange = (val: string) => {
    setFromInputText(val);
    const parsed = parseUserInputDate(val);
    if (parsed) {
      setInputError(null);
      setDraftStart(parsed);
      setDraftPreset('custom');
      if (draftEnd && parsed > draftEnd) {
        setDraftEnd(parsed);
        setToInputText(formatInputDate(parsed));
      }
      const d = parseLocalYMD(parsed);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const handleFromInputBlur = () => {
    const parsed = parseUserInputDate(fromInputText);
    if (parsed) {
      setDraftStart(parsed);
      setFromInputText(formatInputDate(parsed));
    } else if (draftStart) {
      setFromInputText(formatInputDate(draftStart));
    }
  };

  // Direct date input editing: To Date
  const handleToInputChange = (val: string) => {
    setToInputText(val);
    const parsed = parseUserInputDate(val);
    if (parsed) {
      setInputError(null);
      if (draftStart && parsed < draftStart) {
        setInputError('End date cannot be earlier than start date');
        return;
      }
      setDraftEnd(parsed);
      setDraftPreset('custom');
    }
  };

  const handleToInputBlur = () => {
    const parsed = parseUserInputDate(toInputText);
    if (parsed) {
      if (draftStart && parsed < draftStart) {
        // Auto-correct to draftStart
        setDraftEnd(draftStart);
        setToInputText(formatInputDate(draftStart));
        setInputError(null);
      } else {
        setDraftEnd(parsed);
        setToInputText(formatInputDate(parsed));
      }
    } else if (draftEnd) {
      setToInputText(formatInputDate(draftEnd));
    }
  };

  // Commit and apply selected range
  const handleApply = () => {
    if (draftStart && draftEnd && draftStart > draftEnd) {
      setInputError('Start date cannot be after end date');
      return;
    }

    onApply({
      startDate: draftStart,
      endDate: draftEnd,
      preset: draftPreset
    });
    onClose();
  };

  if (!isOpen) return null;

  // Build grid data for a month
  const buildMonthGrid = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      day: number;
      ymd: string;
      isCurrentMonth: boolean;
    }> = [];

    // Previous month overflow days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevY = month === 0 ? year - 1 : year;
      const prevM = month === 0 ? 12 : month;
      const ymd = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, ymd, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, ymd, isCurrentMonth: true });
    }

    // Next month overflow days to complete 35 or 42 cells
    const targetLength = cells.length > 35 ? 42 : 35;
    const remaining = targetLength - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextY = month === 11 ? year + 1 : year;
      const nextM = month === 11 ? 1 : month + 2;
      const ymd = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, ymd, isCurrentMonth: false });
    }

    return cells;
  };

  const month1Grid = buildMonthGrid(viewYear, viewMonth);
  const month2Grid = buildMonthGrid(m2Year, m2Month);

  // Range preview boundaries during hover
  const effectiveRange = useMemo(() => {
    if (selectingState === 'range_in_progress' && hoverDate && draftStart) {
      const start = draftStart < hoverDate ? draftStart : hoverDate;
      const end = draftStart < hoverDate ? hoverDate : draftStart;
      return { start, end };
    }
    return { start: draftStart, end: draftEnd };
  }, [selectingState, hoverDate, draftStart, draftEnd]);

  const renderCalendarMonth = (year: number, month: number, grid: typeof month1Grid) => {
    const monthTitle = `${MONTH_NAMES_FULL[month]} ${year}`.toUpperCase();

    return (
      <div className="flex flex-col select-none">
        {/* Month Header */}
        <div className="text-cyan-400 font-bold text-xs uppercase tracking-wider text-center mb-3">
          {monthTitle}
        </div>

        {/* Weekday Labels (Su, Mo, Tu, We, Th, Fr, Sa) */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-500 mb-2">
          {WEEKDAY_NAMES.map(w => (
            <div key={w} className="py-0.5">{w}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {grid.map(({ day, ymd, isCurrentMonth }, idx) => {
            const isStart = draftStart === ymd;
            const isEnd = draftEnd === ymd;
            const isInCommittedRange = draftStart && draftEnd && ymd >= draftStart && ymd <= draftEnd;
            const isInPreviewRange = selectingState === 'range_in_progress' && 
              effectiveRange.start && effectiveRange.end && 
              ymd >= effectiveRange.start && ymd <= effectiveRange.end;

            // Highlight styling logic matching Screenshot 2
            let buttonStyle = 'text-slate-200 hover:bg-slate-800/80 hover:text-white rounded-lg';
            let containerBg = '';

            if (!isCurrentMonth) {
              buttonStyle = 'text-slate-600 hover:text-slate-400 hover:bg-slate-850/50 rounded-lg';
            }

            if (isStart || isEnd) {
              buttonStyle = 'bg-cyan-500 text-black font-extrabold rounded-lg shadow-sm z-10';
            } else if (isInCommittedRange) {
              buttonStyle = 'text-cyan-200 font-semibold';
              containerBg = 'bg-cyan-500/20';
            } else if (isInPreviewRange) {
              buttonStyle = 'text-cyan-300 font-medium';
              containerBg = 'bg-cyan-500/10';
            }

            return (
              <div 
                key={idx} 
                className={`relative flex items-center justify-center p-0.5 ${containerBg}`}
              >
                <button
                  type="button"
                  onClick={() => handleDayClick(ymd)}
                  onMouseEnter={() => {
                    if (selectingState === 'range_in_progress') {
                      setHoverDate(ymd);
                    }
                  }}
                  className={`w-8 h-8 flex items-center justify-center text-xs transition-colors cursor-pointer ${buttonStyle}`}
                  title={ymd}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const headerRangeTitle = `${MONTH_NAMES_FULL[viewMonth]} ${viewYear} — ${MONTH_NAMES_FULL[m2Month]} ${m2Year}`.toUpperCase();
  const selectedRangeDisplayText = formatRangeDisplay(draftStart, draftEnd);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Select Date Range Modal"
    >
      {/* Backdrop Click Dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Centered Modal Card */}
      <div className="relative w-full max-w-4xl bg-[#0b1220] border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* 1. MODAL HEADER (Calendar icon + title + close button) */}
        <div className="px-5 sm:px-6 py-4 bg-[#0e1626] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Calendar className="text-cyan-400" size={18} />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">Select Date Range</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Date Range Modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. MODAL BODY (Desktop: Sidebar + Dual Calendars; Mobile: Stacked) */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto">
          
          {/* LEFT SIDEBAR: QUICK RANGES */}
          <div className="w-full md:w-48 bg-[#090f1d] border-b md:border-b-0 md:border-r border-slate-800 p-4 shrink-0 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 px-1">
              Quick Ranges
            </div>

            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 custom-scrollbar">
              {QUICK_RANGES.map(item => {
                const isActive = draftPreset === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleQuickRangeClick(item.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center justify-between cursor-pointer border ${
                      isActive
                        ? 'bg-[#06202e] border-cyan-500/80 text-cyan-300 shadow-sm'
                        : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && <Clock size={13} className="text-cyan-400 ml-2 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Target Date Field Selector (Optional helper when supported) */}
            {onTargetDateFieldChange && (
              <div className="mt-auto pt-4 border-t border-slate-800/80 hidden md:block">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Target Field
                </div>
                <select
                  value={targetDateField || 'orderDate'}
                  onChange={e => onTargetDateFieldChange(e.target.value as LogisticsDateField)}
                  className="w-full bg-[#0e172a] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="orderDate">Order Date</option>
                  <option value="dispatchDate">Dispatch Date</option>
                  <option value="deliveredDate">Delivery Date</option>
                  <option value="syncedAt">Last Tracking Sync</option>
                </select>
              </div>
            )}
          </div>

          {/* MAIN CALENDAR AREA */}
          <div className="flex-1 p-4 sm:p-6 bg-[#0b1220] flex flex-col justify-between overflow-y-auto">
            
            <div>
              {/* FROM DATE & TO DATE INPUTS (Top Row) */}
              <div className="bg-[#0e172a] border border-slate-800 rounded-xl p-3 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  
                  {/* From Date Input */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      From Date
                    </label>
                    <div className="flex items-center justify-between bg-[#090f1d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus-within:border-cyan-500 transition-colors">
                      <input
                        type="text"
                        value={fromInputText}
                        onChange={e => handleFromInputChange(e.target.value)}
                        onBlur={handleFromInputBlur}
                        placeholder="DD-MMM-YYYY"
                        className="bg-transparent border-none outline-none w-full text-slate-200 placeholder-slate-500 text-xs font-mono font-medium"
                      />
                      <Calendar size={14} className="text-slate-500 ml-2 shrink-0 pointer-events-none" />
                    </div>
                  </div>

                  {/* To Date Input */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      To Date
                    </label>
                    <div className="flex items-center justify-between bg-[#090f1d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus-within:border-cyan-500 transition-colors">
                      <input
                        type="text"
                        value={toInputText}
                        onChange={e => handleToInputChange(e.target.value)}
                        onBlur={handleToInputBlur}
                        placeholder="DD-MMM-YYYY"
                        className="bg-transparent border-none outline-none w-full text-slate-200 placeholder-slate-500 text-xs font-mono font-medium"
                      />
                      <Calendar size={14} className="text-slate-500 ml-2 shrink-0 pointer-events-none" />
                    </div>
                  </div>

                </div>

                {inputError && (
                  <div className="mt-2 text-rose-400 text-[11px] flex items-center gap-1.5 font-medium animate-in fade-in">
                    <AlertCircle size={13} />
                    <span>{inputError}</span>
                  </div>
                )}
              </div>

              {/* MONTH NAVIGATION ROW (< OCTOBER 2026 — NOVEMBER 2026 >) */}
              <div className="flex items-center justify-between mb-4 px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg bg-[#0e172a] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Previous month"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-200 text-center">
                  {headerRangeTitle}
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg bg-[#0e172a] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Next month"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* DUAL CALENDARS (SIDE BY SIDE ON DESKTOP) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {renderCalendarMonth(viewYear, viewMonth, month1Grid)}
                <div className="hidden md:block">
                  {renderCalendarMonth(m2Year, m2Month, month2Grid)}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* 3. MODAL FOOTER (Selected text + Cancel + Apply Range) */}
        <div className="px-5 sm:px-6 py-4 bg-[#0e1626] border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Selected Range Display */}
          <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate max-w-full">
            <span>Selected:</span>
            <span className="text-cyan-300 font-mono font-bold truncate">
              {selectedRangeDisplayText}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-[#0b1220] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="h-9 px-5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition-all cursor-pointer shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
            >
              <Check size={14} className="stroke-[3]" />
              <span>Apply Range</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
