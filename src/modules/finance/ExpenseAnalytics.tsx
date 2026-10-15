import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  BarChart3,
  Layers,
  Briefcase,
  Package,
  Tag,
  ChevronDown,
  FolderTree,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import type { FinanceExpense } from '../../hooks/finance/useExpenses';

interface ExpenseAnalyticsProps {
  expenses: FinanceExpense[];
}

const PALETTE_MAIN = [
  '#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#a855f7', '#f97316', '#06b6d4',
  '#84cc16', '#e11d48', '#8b5cf6', '#10b981'
];

const PALETTE_L2 = [
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16',
  '#e11d48', '#a855f7', '#3b82f6', '#f59e0b', '#22c55e',
  '#ec4899', '#6366f1', '#10b981', '#ef4444'
];

const PALETTE_L3 = [
  '#f43f5e', '#0ea5e9', '#d946ef', '#eab308', '#22d3ee',
  '#a3e635', '#fb923c', '#818cf8', '#2dd4bf', '#f472b6',
  '#38bdf8', '#facc15', '#c084fc', '#34d399'
];

const PALETTE_L4 = [
  '#e879f9', '#67e8f9', '#fbbf24', '#a78bfa', '#34d399',
  '#fb7185', '#38bdf8', '#bef264', '#f9a8d4', '#5eead4',
  '#fca5a5', '#93c5fd', '#d9f99d', '#c4b5fd'
];

const formatINR = (val: number) => '₹' + Number(val).toLocaleString('en-IN');

const getCenterFontSizeStyle = (str: string) => {
  const len = str.length;
  if (len >= 16) return { fontSize: '0.72rem', lineHeight: '0.95rem' };
  if (len >= 13) return { fontSize: '0.82rem', lineHeight: '1.1rem' };
  if (len >= 10) return { fontSize: '0.95rem', lineHeight: '1.25rem' };
  return { fontSize: '1.15rem', lineHeight: '1.4rem' };
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; count: number } }>;
  total: number;
}

const CustomTooltip = ({ active, payload, total }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl text-xs border border-slate-700/80 z-50 pointer-events-none">
        <div className="font-bold text-slate-100 mb-1 text-sm">{data.name}</div>
        <div className="text-purple-400 font-semibold">{formatINR(data.value)} <span className="text-slate-400 font-normal">({pct}%)</span></div>
        <div className="text-slate-400 text-[11px] mt-1 flex items-center gap-1">
          <span>{data.count}</span> {data.count !== 1 ? 'Expenses' : 'Expense'}
        </div>
      </div>
    );
  }
  return null;
};

// Date Helpers
const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const getStartOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
};

interface AnalyticsChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  data: Array<{ name: string; value: number; count: number }>;
  total: number;
  palette: string[];
  activeItem: string | null;
  onClick: (name: string) => void;
  canDrillDown?: boolean;
  emptyMessage: string;
}

const AnalyticsChartCard: React.FC<AnalyticsChartCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  data,
  total,
  palette,
  activeItem,
  onClick,
  canDrillDown = true,
  emptyMessage
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedTotal = formatINR(total);
  const visibleItems = isExpanded ? data : data.slice(0, 5);
  const isEmpty = data.length === 0 || (data.length === 1 && data[0].name === 'Other' && total === 0);

  return (
    <div className="bg-slate-900/60 hover:bg-slate-900/80 border border-slate-700/70 hover:border-slate-600/80 rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-sm flex flex-col h-full backdrop-blur-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Icon size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 tracking-tight uppercase truncate" title={title}>
              {title}
            </h3>
            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="text-right shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total</span>
            <span className="text-xs sm:text-sm font-bold text-purple-300 block">{formattedTotal}</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-xl bg-slate-800/30 border border-dashed border-slate-700/70 text-slate-400 text-center min-h-[220px]">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xl mb-3">
            📭
          </div>
          <p className="text-sm font-medium text-slate-300 mb-1">{emptyMessage}</p>
          <p className="text-xs text-slate-500 max-w-xs">
            No deeper breakdown items were defined for this hierarchy level.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 flex-1">
          {/* Donut Chart */}
          <div className="relative w-full max-w-[210px] h-[210px] flex items-center justify-center shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={82}
                  paddingAngle={data.length > 1 ? 1 : 0}
                  dataKey="value"
                  onClick={(e) => {
                    if (e && e.name && canDrillDown) onClick(e.name);
                  }}
                  cursor={canDrillDown ? "pointer" : "default"}
                  stroke="#131826"
                  strokeWidth={1.5}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={palette[index % palette.length]}
                      className="transition-opacity hover:opacity-85"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total with Dynamic Font Sizing */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
              <span
                className="font-bold text-white tracking-tight leading-tight block truncate max-w-[110px]"
                style={getCenterFontSizeStyle(formattedTotal)}
                title={formattedTotal}
              >
                {formattedTotal}
              </span>
              <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">
                TOTAL
              </span>
            </div>
          </div>

          {/* Legend Breakdown Rows */}
          <div className="flex-1 w-full flex flex-col justify-between min-w-0">
            <div className="space-y-2 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
              {visibleItems.map((item, index) => {
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
                const isSelected = activeItem === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    disabled={!canDrillDown}
                    onClick={() => canDrillDown && onClick(item.name)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left group ${
                      isSelected
                        ? 'bg-purple-600/15 border border-purple-500/40 shadow-sm'
                        : 'bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 hover:border-slate-700/80'
                    } ${!canDrillDown ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: palette[index % palette.length] }}
                      />
                      <span
                        className={`text-xs font-medium truncate ${
                          isSelected ? 'text-purple-200 font-semibold' : 'text-slate-300 group-hover:text-white'
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">
                        {formatINR(item.value)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50 whitespace-nowrap">
                        {pct}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                        {item.count} {item.count === 1 ? 'expense' : 'expenses'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {data.length > 5 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-1.5 border border-purple-500/20"
              >
                <span>{isExpanded ? 'Show Less' : `Show All (${data.length})`}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ExpenseAnalytics = ({ expenses }: ExpenseAnalyticsProps) => {
  // Cascading Selection State
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedSub1, setSelectedSub1] = useState<string | null>(null);
  const [selectedSub2, setSelectedSub2] = useState<string | null>(null);

  // Date Range State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [appliedRange, setAppliedRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [tempRange, setTempRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [viewDate, setViewDate] = useState(new Date());

  // Filter expenses by date range BEFORE analytics calculation
  const filteredExpensesForAnalytics = useMemo(() => {
    return expenses.filter(e => {
      if (!appliedRange.from && !appliedRange.to) return true;
      if (!e.created_at) return true; // Safety: preserve missing dates

      const d = new Date(e.created_at);
      if (isNaN(d.getTime())) return true; // Safety: preserve invalid dates

      const expDate = normalizeDate(d).getTime();

      if (appliedRange.from) {
        const from = normalizeDate(appliedRange.from).getTime();
        if (expDate < from) return false;
      }
      if (appliedRange.to) {
        const to = normalizeDate(appliedRange.to).getTime();
        if (expDate > to) return false;
      }
      return true;
    });
  }, [expenses, appliedRange]);

  // LEVEL 1: Main Category
  const mainData = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    filteredExpensesForAnalytics.forEach(e => {
      const cat = e.main_category || 'Uncategorized';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(e.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpensesForAnalytics]);

  const activeMain = selectedMain || (mainData.length > 0 ? mainData[0].name : null);
  const mainTotal = mainData.reduce((sum, item) => sum + item.value, 0);

  // LEVEL 2: Sub Category 1
  const sub1Data = useMemo(() => {
    if (!activeMain) return [];
    const filtered = filteredExpensesForAnalytics.filter(e => (e.main_category || 'Uncategorized') === activeMain);
    const map: Record<string, { amount: number; count: number }> = {};
    filtered.forEach(e => {
      const cat = e.sub_category1 || 'Other';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(e.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpensesForAnalytics, activeMain]);

  const activeSub1 = selectedSub1 || (sub1Data.length > 0 ? sub1Data[0].name : null);
  const sub1Total = sub1Data.reduce((sum, item) => sum + item.value, 0);

  // LEVEL 3: Sub Category 2
  const sub2Data = useMemo(() => {
    if (!activeMain || !activeSub1) return [];
    const filtered = filteredExpensesForAnalytics.filter(e =>
      (e.main_category || 'Uncategorized') === activeMain &&
      (e.sub_category1 || 'Other') === activeSub1
    );
    const map: Record<string, { amount: number; count: number }> = {};
    filtered.forEach(e => {
      const cat = e.sub_category2?.trim() || 'Other';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(e.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpensesForAnalytics, activeMain, activeSub1]);

  const activeSub2 = selectedSub2 || (sub2Data.length > 0 ? sub2Data[0].name : null);
  const sub2Total = sub2Data.reduce((sum, item) => sum + item.value, 0);

  // LEVEL 4: Sub Category 3
  const sub3Data = useMemo(() => {
    if (!activeMain || !activeSub1 || !activeSub2) return [];
    const filtered = filteredExpensesForAnalytics.filter(e =>
      (e.main_category || 'Uncategorized') === activeMain &&
      (e.sub_category1 || 'Other') === activeSub1 &&
      (e.sub_category2?.trim() || 'Other') === activeSub2
    );
    const map: Record<string, { amount: number; count: number }> = {};
    filtered.forEach(e => {
      const cat = e.sub_category3?.trim();
      if (!cat) return; // Legacy explicitly ignores empty sub_category3
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(e.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpensesForAnalytics, activeMain, activeSub1, activeSub2]);

  const sub3Total = sub3Data.reduce((sum, item) => sum + item.value, 0);

  // Handlers
  const handleMainClick = (name: string) => {
    setSelectedMain(name);
    setSelectedSub1(null);
    setSelectedSub2(null);
  };

  const handleSub1Click = (name: string) => {
    setSelectedSub1(name);
    setSelectedSub2(null);
  };

  const handleSub2Click = (name: string) => {
    setSelectedSub2(name);
  };

  const handleResetDrilldown = () => {
    setSelectedMain(null);
    setSelectedSub1(null);
    setSelectedSub2(null);
  };

  // Date Range Picker Logic
  const applyQuickRange = (rangeName: string) => {
    const today = new Date();
    let from: Date | null = null;
    let to: Date | null = today;

    switch (rangeName) {
      case 'Today':
        from = today;
        break;
      case 'Yesterday':
        from = addDays(today, -1);
        to = addDays(today, -1);
        break;
      case 'This Week':
        from = getStartOfWeek(new Date());
        break;
      case 'Last 7 Days':
        from = addDays(today, -6);
        break;
      case 'This Month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Previous Month':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'Last 30 Days':
        from = addDays(today, -29);
        break;
      case 'This Year':
        from = new Date(today.getFullYear(), 0, 1);
        break;
    }

    setTempRange({ from, to });
  };

  const renderCalendarMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="w-9 h-9" />);

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isSelected = tempRange.from && tempRange.to &&
                         normalizeDate(date).getTime() >= normalizeDate(tempRange.from).getTime() &&
                         normalizeDate(date).getTime() <= normalizeDate(tempRange.to).getTime();
      const isStart = tempRange.from && normalizeDate(date).getTime() === normalizeDate(tempRange.from).getTime();
      const isEnd = tempRange.to && normalizeDate(date).getTime() === normalizeDate(tempRange.to).getTime();
      const isToday = normalizeDate(date).getTime() === normalizeDate(new Date()).getTime();

      let wrapperClass = "w-9 h-9 relative flex items-center justify-center cursor-pointer text-sm font-medium transition-colors ";
      if (isSelected && !isStart && !isEnd) {
        wrapperClass += "bg-purple-600/15 text-purple-300";
      } else if (isStart && isEnd) {
        wrapperClass += "text-white";
      } else if (isStart && tempRange.to) {
        wrapperClass += "bg-gradient-to-r from-transparent via-purple-600/15 to-purple-600/15 text-white";
      } else if (isEnd && tempRange.from) {
        wrapperClass += "bg-gradient-to-l from-transparent via-purple-600/15 to-purple-600/15 text-white";
      } else if (isStart || isEnd) {
        wrapperClass += "text-white";
      } else {
        wrapperClass += "text-slate-300 hover:text-white";
      }

      let circleClass = "absolute inset-0 m-auto flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 z-10 ";
      if (isStart || isEnd) {
        circleClass += "bg-purple-600 shadow-lg shadow-purple-600/40 font-bold text-white";
      } else if (!isSelected) {
        circleClass += "hover:bg-slate-700 hover:scale-105";
      }

      if (isToday && !isStart && !isEnd && !isSelected) {
        circleClass += " ring-1 ring-inset ring-purple-500/50 text-purple-400";
      }

      days.push(
        <div
          key={i}
          className={wrapperClass}
          onClick={() => {
            const normDate = normalizeDate(date).getTime();
            const normFrom = tempRange.from ? normalizeDate(tempRange.from).getTime() : null;
            const normTo = tempRange.to ? normalizeDate(tempRange.to).getTime() : null;

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
        <div className="font-bold text-center text-slate-100 mb-2 tracking-wide text-[15px]">{monthName} {year}</div>
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days}
        </div>
      </div>
    );
  };

  const getAppliedRangeText = () => {
    if (!appliedRange.from && !appliedRange.to) return 'All Time';
    const formatStr = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (appliedRange.from && appliedRange.to) {
      if (appliedRange.from.getTime() === appliedRange.to.getTime()) return formatStr(appliedRange.from);
      return `${formatStr(appliedRange.from)} - ${formatStr(appliedRange.to)}`;
    }
    return 'Custom Range';
  };

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
        <div className="w-16 h-16 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4">
          📊
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No expense data available</h3>
        <p className="text-slate-400 text-sm max-w-md">
          There are currently no recorded expenses to generate category analytics and spending breakdowns.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 fade-in pb-12">
      {/* Dashboard Header inspired by Campaign Influencer Analytics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-700/70 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/10">
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              Expense Analytics
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Explore expense distribution, categories, and spending patterns across {filteredExpensesForAnalytics.length} records
            </p>
          </div>
        </div>

        {/* Right Controls: Summary Metrics & Date Range Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs flex items-center gap-2">
            <span className="text-slate-400 font-medium">Total Spend:</span>
            <span className="text-slate-100 font-bold">{formatINR(mainTotal)}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs flex items-center gap-2">
            <span className="text-slate-400 font-medium">Records:</span>
            <span className="text-purple-400 font-bold">{filteredExpensesForAnalytics.length}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs flex items-center gap-2">
            <span className="text-slate-400 font-medium">Categories:</span>
            <span className="text-slate-200 font-semibold">{mainData.length}</span>
          </div>

          {/* Date Range Picker Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setTempRange(appliedRange);
                setIsDatePickerOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-700/80 hover:border-purple-500/50 transition-all shadow-sm group"
            >
              <Calendar size={14} className="text-purple-400 group-hover:scale-105 transition-transform" />
              <span>{getAppliedRangeText()}</span>
              {(appliedRange.from || appliedRange.to) && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setAppliedRange({ from: null, to: null });
                    setTempRange({ from: null, to: null });
                  }}
                  className="ml-1 p-0.5 hover:text-rose-400 rounded transition-colors"
                  title="Clear date filter"
                >
                  <X size={12} />
                </span>
              )}
            </button>

            {/* Date Picker Modal/Dropdown */}
            {isDatePickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDatePickerOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 p-6 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 z-50 flex flex-col md:flex-row gap-6 fade-in max-w-[95vw] md:min-w-[680px]">

                  {/* Quick Ranges */}
                  <div className="flex flex-col gap-1 w-full md:w-44 border-b md:border-b-0 md:border-r border-slate-700/60 pb-4 md:pb-0 md:pr-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pl-2">Quick Ranges</span>
                    {['Today', 'Yesterday', 'This Week', 'Last 7 Days', 'This Month', 'Previous Month', 'Last 30 Days', 'This Year'].map(range => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => applyQuickRange(range)}
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
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-3 pt-4 border-t border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedRange({ from: null, to: null });
                          setTempRange({ from: null, to: null });
                          setIsDatePickerOpen(false);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                      >
                        Clear Filter
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsDatePickerOpen(false)}
                          className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedRange(tempRange);
                            setIsDatePickerOpen(false);
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
        </div>
      </div>

      {/* Drilldown Navigation Trail */}
      {(selectedMain || selectedSub1 || selectedSub2) && (
        <div className="flex items-center flex-wrap gap-2 px-4 py-2.5 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <FolderTree size={14} className="text-purple-400" />
            Drilldown Path:
          </span>
          <button
            type="button"
            onClick={handleResetDrilldown}
            className={`font-semibold hover:underline ${!selectedMain ? 'text-purple-400' : 'text-slate-300'}`}
          >
            All Categories
          </button>
          {activeMain && (
            <>
              <span className="text-slate-500">›</span>
              <button
                type="button"
                onClick={() => { setSelectedSub1(null); setSelectedSub2(null); }}
                className={`font-semibold hover:underline ${selectedMain && !selectedSub1 ? 'text-purple-400' : 'text-slate-300'}`}
              >
                {activeMain}
              </button>
            </>
          )}
          {activeSub1 && (
            <>
              <span className="text-slate-500">›</span>
              <button
                type="button"
                onClick={() => { setSelectedSub2(null); }}
                className={`font-semibold hover:underline ${selectedSub1 && !selectedSub2 ? 'text-purple-400' : 'text-slate-300'}`}
              >
                {activeSub1}
              </button>
            </>
          )}
          {activeSub2 && (
            <>
              <span className="text-slate-500">›</span>
              <span className="font-semibold text-purple-400">
                {activeSub2}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={handleResetDrilldown}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset Drilldown"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* 1. Main Category */}
        <AnalyticsChartCard
          title="Main Category Total Expenses"
          subtitle={`${mainData.length} ${mainData.length === 1 ? 'category' : 'categories'}`}
          icon={Layers}
          data={mainData}
          total={mainTotal}
          palette={PALETTE_MAIN}
          activeItem={activeMain}
          onClick={handleMainClick}
          canDrillDown={true}
          emptyMessage="No expense data in this date range."
        />

        {/* 2. Sub Category 1 */}
        <AnalyticsChartCard
          title={activeMain ? `${activeMain} Breakdown` : 'Operations Breakdown'}
          subtitle={activeMain ? `${sub1Data.length} ${sub1Data.length === 1 ? 'sub-category' : 'sub-categories'}` : 'Select a main category'}
          icon={Briefcase}
          data={sub1Data}
          total={sub1Total}
          palette={PALETTE_L2}
          activeItem={activeSub1}
          onClick={handleSub1Click}
          canDrillDown={true}
          emptyMessage={activeMain ? `No breakdown data available for ${activeMain}.` : 'Select a main category'}
        />

        {/* 3. Sub Category 2 */}
        <AnalyticsChartCard
          title={activeSub1 ? `${activeSub1} Breakdown` : 'Infrastructure Breakdown'}
          subtitle={activeSub1 ? `${sub2Data.length} ${sub2Data.length === 1 ? 'section' : 'sections'}` : 'Select a sub-category'}
          icon={Package}
          data={sub2Data}
          total={sub2Total}
          palette={PALETTE_L3}
          activeItem={activeSub2}
          onClick={handleSub2Click}
          canDrillDown={true}
          emptyMessage={activeSub1 ? `No deeper breakdown available for ${activeSub1}.` : 'Select a sub-category'}
        />

        {/* 4. Sub Category 3 */}
        <AnalyticsChartCard
          title={activeSub2 ? `${activeSub2} Details` : 'Rent Details'}
          subtitle={activeSub2 ? `${sub3Data.length} ${sub3Data.length === 1 ? 'item' : 'items'}` : 'Select a section'}
          icon={Tag}
          data={sub3Data}
          total={sub3Total}
          palette={PALETTE_L4}
          activeItem={null}
          onClick={() => {}}
          canDrillDown={false}
          emptyMessage={activeSub2 ? `No deeper breakdown available for ${activeSub2}.` : 'Select a sub-category'}
        />
      </div>
    </div>
  );
};
