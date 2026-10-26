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

interface ManifestDateDropdownProps {
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

export const ManifestDateDropdown: React.FC<ManifestDateDropdownProps> = ({
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

  // Handle outside click
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

  // Handle preset selection
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

  // Calendar Month Navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Build Calendar Days for viewMonth starting on Monday (Mon=0, Sun=6)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);

    // JavaScript getDay(): Sun=0, Mon=1, ..., Sat=6
    // In Monday-first: Mon=0, ..., Sun=6
    const startDayIndex = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = formatLocalYMD(new Date());

    // Previous month padding
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dNum);
      const str = formatLocalYMD(prevDate);
      days.push({
        dateStr: str,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: str === todayStr
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(viewYear, viewMonth, d);
      const str = formatLocalYMD(curDate);
      days.push({
        dateStr: str,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: str === todayStr
      });
    }

    // Next month padding (complete 35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(viewYear, viewMonth + 1, i);
      const str = formatLocalYMD(nextDate);
      days.push({
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: str === todayStr
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Click on date cell
  const handleDateClick = (dateStr: string) => {
    setDraftPreset('custom');

    if (rangeStage === 'idle' || !draftStart || (draftStart && draftEnd)) {
      setDraftStart(dateStr);
      setDraftEnd('');
      setRangeStage('selecting_end');
    } else if (rangeStage === 'selecting_end') {
      if (dateStr < draftStart) {
        setDraftEnd(draftStart);
        setDraftStart(dateStr);
      } else {
        setDraftEnd(dateStr);
      }
      setRangeStage('idle');
    }
  };

  const isDateSelected = (dateStr: string) => {
    return dateStr === draftStart || dateStr === draftEnd;
  };

  const isDateInRange = (dateStr: string) => {
    if (draftStart && draftEnd) {
      return dateStr > draftStart && dateStr < draftEnd;
    }
    if (rangeStage === 'selecting_end' && draftStart && hoverDate) {
      const [min, max] = draftStart < hoverDate ? [draftStart, hoverDate] : [hoverDate, draftStart];
      return dateStr > min && dateStr < max;
    }
    return false;
  };

  const handleApply = () => {
    onApply({
      preset: draftPreset,
      startDate: draftStart,
      endDate: draftEnd || draftStart
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setIsOpen(false);
  };

  const isActive = preset !== 'all' || !!startDate || !!endDate;

  const displayButtonText = useMemo(() => {
    if (!isActive) return 'Manifested date';
    if (preset !== 'all' && preset !== 'custom') {
      const match = PRESET_OPTIONS.find(p => p.id === preset);
      return `Manifest: ${match ? match.label : preset}`;
    }
    if (startDate && endDate) {
      return `Manifest: ${formatRangeDisplay(startDate, endDate)}`;
    }
    if (startDate) {
      return `Manifest: ${startDate}`;
    }
    return 'Manifested date';
  }, [isActive, preset, startDate, endDate]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
          isActive
            ? 'bg-purple-950/70 border-purple-600 text-purple-200 shadow-sm'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
        }`}
      >
        <Calendar size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
        <span>{displayButtonText}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-[540px] max-w-[95vw] bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80">
            
            {/* Left Column: Quick Preset List */}
            <div className="w-full sm:w-44 p-2.5 bg-[#0b1220]/70 flex flex-col gap-1 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Quick Presets
              </span>
              {PRESET_OPTIONS.map(opt => {
                const isSelected = draftPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Right Column: Month Calendar */}
            <div className="flex-1 p-3.5 flex flex-col">
              
              {/* Month & Year Navigation */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-slate-100">
                  {MONTH_NAMES_FULL[viewMonth]} {viewYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day Headers (Mon -> Sun) */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {WEEKDAY_NAMES.map(day => (
                  <span key={day} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-0.5">
                    {day}
                  </span>
                ))}
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 gap-1 text-center" onMouseLeave={() => setHoverDate(null)}>
                {calendarDays.map((cell, idx) => {
                  const selected = isDateSelected(cell.dateStr);
                  const inRange = isDateInRange(cell.dateStr);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDateClick(cell.dateStr)}
                      onMouseEnter={() => rangeStage === 'selecting_end' && setHoverDate(cell.dateStr)}
                      className={`h-7.5 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                        selected
                          ? 'bg-purple-600 text-white font-bold shadow-sm'
                          : inRange
                          ? 'bg-purple-950/60 text-purple-200 rounded-none'
                          : cell.isCurrentMonth
                          ? 'text-slate-200 hover:bg-slate-800'
                          : 'text-slate-600 hover:bg-slate-800/40'
                      } ${cell.isToday && !selected ? 'border border-purple-500/50' : ''}`}
                    >
                      {cell.dayNumber}
                    </button>
                  );
                })}
              </div>

              {/* Selected Range Display */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/70 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {draftStart ? (
                    <>
                      Range: <strong className="text-purple-300">{formatRangeDisplay(draftStart, draftEnd || draftStart)}</strong>
                    </>
                  ) : (
                    'Click a start date to begin range'
                  )}
                </span>
                {rangeStage === 'selecting_end' && (
                  <span className="text-[10px] text-amber-400 font-semibold animate-pulse">
                    Select end date
                  </span>
                )}
              </div>

            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-2.5 border-t border-slate-800/80 bg-[#0b1220]/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
            >
              Clear Date Filter
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 px-3 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="h-8 px-4 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors cursor-pointer"
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
