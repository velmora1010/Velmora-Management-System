import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  QUICK_EXPENSE_DATE_RANGES,
  computeQuickExpenseDateRange,
  formatAppliedExpenseDateRange,
  normalizeExpenseDate,
  type DateRangeValue,
} from '../services/expenseDateRangeUtils';

interface ExpenseDateRangePickerProps {
  appliedRange: DateRangeValue;
  onApply: (range: DateRangeValue) => void;
  onClear: () => void;
}

export const ExpenseDateRangePicker: React.FC<ExpenseDateRangePickerProps> = ({
  appliedRange,
  onApply,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRangeValue>(appliedRange);
  const [viewDate, setViewDate] = useState(() => appliedRange.from || new Date());
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const hasActiveRange = Boolean(appliedRange.from || appliedRange.to);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedWidth = Math.min(window.innerWidth * 0.95, 680);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - estimatedWidth - 12));
      const top = rect.bottom + 8;
      setPopoverPos({ top, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const renderCalendarMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-9 h-9" />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const normDate = normalizeExpenseDate(date).getTime();
      const normFrom = tempRange.from ? normalizeExpenseDate(tempRange.from).getTime() : null;
      const normTo = tempRange.to ? normalizeExpenseDate(tempRange.to).getTime() : null;

      const isSelected = Boolean(normFrom && normTo && normDate >= normFrom && normDate <= normTo);
      const isStart = Boolean(normFrom && normDate === normFrom);
      const isEnd = Boolean(normTo && normDate === normTo);
      const isToday = normDate === normalizeExpenseDate(new Date()).getTime();

      let wrapperClass =
        'w-9 h-9 relative flex items-center justify-center cursor-pointer text-sm font-medium transition-colors ';
      if (isSelected && !isStart && !isEnd) {
        wrapperClass += 'bg-purple-600/15 text-purple-300';
      } else if (isStart && isEnd) {
        wrapperClass += 'text-white';
      } else if (isStart && tempRange.to) {
        wrapperClass += 'bg-gradient-to-r from-transparent via-purple-600/15 to-purple-600/15 text-white';
      } else if (isEnd && tempRange.from) {
        wrapperClass += 'bg-gradient-to-l from-transparent via-purple-600/15 to-purple-600/15 text-white';
      } else if (isStart || isEnd) {
        wrapperClass += 'text-white';
      } else {
        wrapperClass += 'text-slate-300 hover:text-white';
      }

      let circleClass =
        'absolute inset-0 m-auto flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 z-10 ';
      if (isStart || isEnd) {
        circleClass += 'bg-purple-600 shadow-lg shadow-purple-600/40 font-bold text-white';
      } else if (!isSelected) {
        circleClass += 'hover:bg-slate-700 hover:scale-105';
      }

      if (isToday && !isStart && !isEnd && !isSelected) {
        circleClass += ' ring-1 ring-inset ring-purple-500/50 text-purple-400';
      }

      days.push(
        <div
          key={i}
          className={wrapperClass}
          onClick={() => {
            if (!normFrom || !normTo) {
              setTempRange({ from: date, to: date });
            } else if (normFrom === normTo) {
              if (normDate < normFrom) {
                setTempRange({ from: date, to: tempRange.from });
              } else {
                setTempRange({ from: tempRange.from, to: date });
              }
            } else {
              setTempRange({ from: date, to: date });
            }
          }}
        >
          <div className={circleClass}>{i}</div>
        </div>
      );
    }

    const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

    return (
      <div className="flex flex-col gap-3">
        <div className="font-bold text-center text-slate-100 mb-2 tracking-wide text-[15px]">
          {monthName} {year}
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>
        <div className="grid grid-cols-7 gap-y-1">{days}</div>
      </div>
    );
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setTempRange(appliedRange);
          setViewDate(appliedRange.from || new Date());
          setIsOpen(true);
        }}
        className={`h-[42px] flex items-center gap-2 px-3.5 rounded-xl border text-xs font-semibold transition-all shadow-sm group whitespace-nowrap ${
          hasActiveRange
            ? 'bg-purple-600/15 border-purple-500/50 text-purple-200 hover:bg-purple-600/25'
            : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-700/80 hover:border-purple-500/50'
        }`}
        title="Filter by date range"
        aria-label="Filter by date range"
      >
        <Calendar size={14} className="text-purple-400 group-hover:scale-105 transition-transform shrink-0" />
        <span>{formatAppliedExpenseDateRange(appliedRange)}</span>
        {hasActiveRange && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setTempRange({ from: null, to: null });
            }}
            className="ml-0.5 p-0.5 hover:text-rose-400 rounded transition-colors"
            title="Clear date filter"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            style={popoverPos ? { top: popoverPos.top, left: popoverPos.left } : undefined}
            className="fixed p-6 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 z-50 flex flex-col md:flex-row gap-6 fade-in max-w-[95vw] md:min-w-[680px]"
          >
            {/* Quick Ranges */}
            <div className="flex flex-col gap-1 w-full md:w-44 border-b md:border-b-0 md:border-r border-slate-700/60 pb-4 md:pb-0 md:pr-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pl-2">
                Quick Ranges
              </span>
              {QUICK_EXPENSE_DATE_RANGES.map(range => (
                <button
                  key={range}
                  type="button"
                  onClick={() => {
                    const next = computeQuickExpenseDateRange(range);
                    setTempRange(next);
                    if (next.from) setViewDate(next.from);
                  }}
                  className="text-left px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-purple-600/15 hover:text-purple-200 rounded-lg transition-colors"
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Calendars */}
            <div className="flex flex-col flex-1">
              <div className="flex justify-between items-center mb-4">
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
                  {renderCalendarMonth(viewDate.getFullYear(), viewDate.getMonth())}
                  <div className="hidden sm:block">
                    {renderCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-3 pt-4 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setTempRange({ from: null, to: null });
                    setIsOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Clear Filter
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApply(tempRange);
                      setIsOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md shadow-purple-600/25 transition-all"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
