import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
      <div className="bg-black/90 text-white p-3 rounded-lg shadow-xl text-sm border border-white/10 z-50 relative">
        <div className="font-semibold mb-1">{data.name}</div>
        <div>{formatINR(data.value)} ({pct}%)</div>
        <div className="text-white/60 text-xs mt-1">{data.count} Expense{data.count !== 1 ? 's' : ''}</div>
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
        wrapperClass += "bg-primary/15 text-primary";
      } else if (isStart && isEnd) {
        wrapperClass += "text-white";
      } else if (isStart && tempRange.to) {
        wrapperClass += "bg-gradient-to-r from-transparent via-primary/15 to-primary/15 text-white";
      } else if (isEnd && tempRange.from) {
        wrapperClass += "bg-gradient-to-l from-transparent via-primary/15 to-primary/15 text-white";
      } else if (isStart || isEnd) {
        wrapperClass += "text-white";
      } else {
        wrapperClass += "text-slate-300 hover:text-white";
      }

      let circleClass = "absolute inset-0 m-auto flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 z-10 ";
      if (isStart || isEnd) {
        circleClass += "bg-primary shadow-lg shadow-primary/40 font-bold text-white";
      } else if (!isSelected) {
        circleClass += "hover:bg-slate-700 hover:scale-105";
      }
      
      if (isToday && !isStart && !isEnd && !isSelected) {
        circleClass += " ring-1 ring-inset ring-primary/50 text-primary";
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

  // Reusable Chart Component Helper
  const renderChartCard = (
    title: string, 
    data: any[], 
    total: number, 
    palette: string[], 
    activeItem: string | null,
    onClick: (name: string) => void,
    emptyMessage: string
  ) => (
    <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col h-full fade-in">
      <h3 className="text-sm font-semibold text-slate-100 mb-6">{title}</h3>
      
      {data.length === 0 || (data.length === 1 && data[0].name === 'Other' && total === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-center">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1">
          <div className="relative w-full h-48 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={0}
                  dataKey="value"
                  onClick={(e) => { if(e && e.name) onClick(e.name); }}
                  cursor="pointer"
                  stroke="none"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
              <span className="text-xl font-bold text-white tracking-tight">{formatINR(total)}</span>
              <span className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">TOTAL</span>
            </div>
          </div>
          <div className="w-full flex flex-col gap-2 overflow-y-auto max-h-48 custom-scrollbar">
            {data.map((item, index) => (
              <button
                key={item.name}
                onClick={() => onClick(item.name)}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-colors text-left w-full group ${
                  activeItem === item.name 
                    ? 'bg-slate-700 border-l-2 border-l-purple-500' 
                    : 'bg-[#252d41] hover:bg-slate-700/80 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: palette[index % palette.length] }} 
                  />
                  <span className={`text-xs font-medium truncate ${activeItem === item.name ? 'text-white' : 'text-slate-300'}`}>
                    {item.name}
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">{formatINR(item.value)}</span>
                  <div className="h-3 w-px bg-slate-600 mx-1"></div>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{item.count} Expense{item.count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* Header Controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-100">Analytics Dashboard</h2>
        <div className="relative">
          <button 
            onClick={() => {
              setTempRange(appliedRange);
              setIsDatePickerOpen(true);
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-[#1e2536] border border-slate-700/60 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-700/50 hover:border-slate-600 transition-all shadow-sm group"
          >
            <Calendar size={16} className="text-primary group-hover:text-primary-light transition-colors" />
            {getAppliedRangeText()}
          </button>
          
          {/* Date Picker Modal/Dropdown */}
          {isDatePickerOpen && (
            <>
              {/* Invisible Backdrop to close on click outside */}
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsDatePickerOpen(false)}
              />
              <div className="absolute right-0 mt-3 p-6 bg-[#161b27]/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-black/80 z-50 flex gap-8 fade-in min-w-[720px] ring-1 ring-black/20">
                
                {/* Quick Ranges */}
                <div className="flex flex-col gap-1.5 w-48 border-r border-slate-700/50 pr-6">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-2">Quick Ranges</span>
                  {['Today', 'Yesterday', 'This Week', 'Last 7 Days', 'This Month', 'Previous Month', 'Last 30 Days', 'This Year'].map(range => (
                    <button
                      key={range}
                      onClick={() => applyQuickRange(range)}
                      className="text-left px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-all"
                    >
                      {range}
                    </button>
                  ))}
                </div>
                
                {/* Calendars */}
                <div className="flex flex-col flex-1 pl-2">
                  <div className="flex justify-between items-center mb-6">
                    <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white active:scale-95">
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex gap-14">
                      {renderCalendarMonth(viewDate.getFullYear(), viewDate.getMonth())}
                      {renderCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)}
                    </div>
                    <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white active:scale-95">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex justify-between items-center mt-2 pt-5 border-t border-slate-700/50">
                    <button 
                      onClick={() => {
                        setAppliedRange({ from: null, to: null });
                        setTempRange({ from: null, to: null });
                        setIsDatePickerOpen(false);
                      }}
                      className="px-2 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      Clear Filter
                    </button>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsDatePickerOpen(false)}
                        className="px-5 py-2.5 text-sm font-bold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          setAppliedRange(tempRange);
                          setIsDatePickerOpen(false);
                        }}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-light rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:translate-y-0"
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

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted">
          <div className="text-4xl mb-4">📊</div>
          <p>No expense data available for analytics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          {/* 1. Main Category */}
          {renderChartCard(
            'Main Category Total Expenses',
            mainData,
            mainTotal,
            PALETTE_MAIN,
            activeMain,
            handleMainClick,
            'No expense data in this date range.'
          )}

          {/* 2. Sub Category 1 */}
          {renderChartCard(
            activeMain ? `${activeMain} Breakdown` : 'Operations Breakdown',
            sub1Data,
            sub1Total,
            PALETTE_L2,
            activeSub1,
            handleSub1Click,
            activeMain ? `No breakdown data available for ${activeMain}.` : 'Select a main category'
          )}

          {/* 3. Sub Category 2 */}
          {renderChartCard(
            activeSub1 ? `${activeSub1} Breakdown` : 'Infrastructure Breakdown',
            sub2Data,
            sub2Total,
            PALETTE_L3,
            activeSub2,
            handleSub2Click,
            activeSub1 ? `No deeper breakdown available for ${activeSub1}.` : 'Select a sub-category'
          )}

          {/* 4. Sub Category 3 */}
          {renderChartCard(
            activeSub2 ? `${activeSub2} Details` : 'Rent Details',
            sub3Data,
            sub3Total,
            PALETTE_L4,
            null, 
            () => {}, 
            activeSub2 ? `No deeper breakdown available for ${activeSub2}.` : 'Select a sub-category'
          )}
        </div>
      )}
    </div>
  );
};
