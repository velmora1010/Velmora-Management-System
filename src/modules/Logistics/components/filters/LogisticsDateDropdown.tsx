import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { LogisticsDatePreset } from '../../types/logisticsFilters';
import { 
  formatLocalYMD, 
  parseLocalYMD, 
  resolveDateRangeForPreset, 
  formatRangeDisplay, 
  MONTH_NAMES_SHORT, 
  MONTH_NAMES_FULL 
} from '../../types/logisticsFilters';

interface LogisticsDateDropdownProps {
  label?: string;
  preset: LogisticsDatePreset;
  startDate: string;
  endDate: string;
  onApply: (data: { preset: LogisticsDatePreset; startDate: string; endDate: string }) => void;
  onClear: () => void;
}

const PRESET_OPTIONS: Array<{ id: LogisticsDatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' }
];

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const LogisticsDateDropdown: React.FC<LogisticsDateDropdownProps> = ({
  label = 'Date Range',
  preset,
  startDate,
  endDate,
  onApply,
  onClear
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draft state
  const [draftPreset, setDraftPreset] = useState<LogisticsDatePreset>(preset);
  const [draftStart, setDraftStart] = useState<string>(startDate);
  const [draftEnd, setDraftEnd] = useState<string>(endDate);

  // Range selecting state
  const [rangeStage, setRangeStage] = useState<'idle' | 'selecting_end'>('idle');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Calendar month view
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());

  useEffect(() => {
    if (isOpen) {
      setDraftPreset(preset);
      setDraftStart(startDate);
      setDraftEnd(endDate);
      setRangeStage('idle');
      setHoverDate(null);

      const refDate = startDate ? parseLocalYMD(startDate) : new Date();
      setViewYear(refDate.getFullYear());
      setViewMonth(refDate.getMonth());
    }
  }, [isOpen, preset, startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectPreset = (pId: LogisticsDatePreset) => {
    setDraftPreset(pId);
    if (pId === 'custom') {
      setRangeStage('idle');
      return;
    }
    const resolved = resolveDateRangeForPreset(pId);
    setDraftStart(resolved.start);
    setDraftEnd(resolved.end);
    setRangeStage('idle');

    if (resolved.start) {
      const d = parseLocalYMD(resolved.start);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay() - 1; // Monday = 0
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{ dayNumber: number; ymd: string; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevD = new Date(viewYear, viewMonth - 1, dNum);
      days.push({ dayNumber: dNum, ymd: formatLocalYMD(prevD), isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const curD = new Date(viewYear, viewMonth, i);
      days.push({ dayNumber: i, ymd: formatLocalYMD(curD), isCurrentMonth: true });
    }

    // Next month padding
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextDNum = 1;
    while (days.length < totalCells) {
      const nextD = new Date(viewYear, viewMonth + 1, nextDNum);
      days.push({ dayNumber: nextDNum, ymd: formatLocalYMD(nextD), isCurrentMonth: false });
      nextDNum++;
    }

    return days;
  }, [viewYear, viewMonth]);

  const handleDayClick = (ymd: string) => {
    setDraftPreset('custom');
    if (rangeStage === 'idle') {
      setDraftStart(ymd);
      setDraftEnd('');
      setRangeStage('selecting_end');
    } else {
      if (draftStart && ymd < draftStart) {
        setDraftEnd(draftStart);
        setDraftStart(ymd);
      } else {
        setDraftEnd(ymd);
      }
      setRangeStage('idle');
      setHoverDate(null);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleApplyClick = () => {
    let finalStart = draftStart;
    let finalEnd = draftEnd;

    if (draftPreset !== 'all' && draftPreset !== 'custom') {
      const r = resolveDateRangeForPreset(draftPreset);
      finalStart = r.start;
      finalEnd = r.end;
    } else if (finalStart && !finalEnd) {
      finalEnd = finalStart;
    }

    onApply({
      preset: draftPreset,
      startDate: finalStart,
      endDate: finalEnd
    });
    setIsOpen(false);
  };

  const handleClearClick = () => {
    setDraftPreset('all');
    setDraftStart('');
    setDraftEnd('');
    setRangeStage('idle');
    setHoverDate(null);
    onClear();
    setIsOpen(false);
  };

  const isActive = preset !== 'all' || Boolean(startDate) || Boolean(endDate);

  const displayButtonLabel = useMemo(() => {
    if (!isActive) return label;
    if (preset !== 'all' && preset !== 'custom') {
      const matched = PRESET_OPTIONS.find(p => p.id === preset);
      return matched ? `${label}: ${matched.label}` : `${label}: ${preset}`;
    }
    if (startDate && endDate) {
      return formatRangeDisplay(startDate, endDate);
    }
    if (startDate) {
      return formatRangeDisplay(startDate, '');
    }
    return label;
  }, [isActive, preset, startDate, endDate, label]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
          isActive
            ? 'bg-cyan-950/70 border-cyan-500/80 text-white font-semibold'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
        }`}
        title={`Filter by ${label}`}
      >
        <Calendar size={13} className={isActive ? 'text-cyan-400' : 'text-slate-400'} />
        <span className="truncate max-w-[200px]">{displayButtonLabel}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-[330px] sm:w-[480px] rounded-2xl bg-[#0b1220] border border-slate-800 shadow-2xl z-50 p-3 sm:p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-purple-400" />
              <span className="text-xs font-bold text-slate-100">{label}</span>
            </div>
            {isActive && (
              <button
                type="button"
                onClick={handleClearClick}
                className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Presets Column */}
            <div className="sm:w-36 flex flex-col gap-1 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-800/80 pb-2 sm:pb-0 sm:pr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5">Presets</span>
              {PRESET_OPTIONS.map(opt => {
                const isSelected = draftPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Calendar Column */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-200">
                  {MONTH_NAMES_FULL[viewMonth]} {viewYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_NAMES.map(w => (
                  <span key={w} className="text-[10px] font-semibold text-slate-500 py-0.5">{w}</span>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(item => {
                  const isStart = draftStart === item.ymd;
                  const isEnd = draftEnd === item.ymd;
                  const effectiveEnd = draftEnd || (rangeStage === 'selecting_end' ? hoverDate : null);
                  const inRange = Boolean(
                    draftStart && 
                    effectiveEnd && 
                    item.ymd > draftStart && 
                    item.ymd < effectiveEnd
                  );

                  let cellClass = 'text-slate-300 hover:bg-slate-800';
                  if (!item.isCurrentMonth) {
                    cellClass = 'text-slate-600 hover:bg-slate-800/40';
                  }
                  if (isStart || isEnd) {
                    cellClass = 'bg-purple-600 text-white font-bold shadow-sm';
                  } else if (inRange) {
                    cellClass = 'bg-purple-950/60 text-purple-200';
                  }

                  return (
                    <button
                      key={item.ymd}
                      type="button"
                      onClick={() => handleDayClick(item.ymd)}
                      onMouseEnter={() => {
                        if (rangeStage === 'selecting_end') {
                          setHoverDate(item.ymd);
                        }
                      }}
                      className={`h-7 rounded text-xs flex items-center justify-center transition-all cursor-pointer ${cellClass}`}
                    >
                      {item.dayNumber}
                    </button>
                  );
                })}
              </div>

              {/* Range Preview / Instruction */}
              <div className="text-[11px] text-slate-400 bg-[#070c14] border border-slate-800/60 px-2.5 py-1.5 rounded-lg flex items-center justify-between mt-1">
                <span>
                  {rangeStage === 'selecting_end'
                    ? 'Click to select end date'
                    : draftStart
                    ? formatRangeDisplay(draftStart, draftEnd)
                    : 'Select a preset or custom range'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
            <button
              type="button"
              onClick={handleClearClick}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reset
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyClick}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
