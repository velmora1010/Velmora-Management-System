import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { FinanceCredit } from '../../hooks/finance/useCredits';
import { useCreditAnalytics } from '../../hooks/finance/useCreditAnalytics';

interface CreditAnalyticsProps {
  credits: FinanceCredit[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

const PALETTE_MAIN = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#a855f7', '#f97316', '#06b6d4', '#84cc16'];
const PALETTE_L2 = ['#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#e11d48', '#a855f7', '#3b82f6', '#f59e0b', '#22c55e', '#ec4899'];
const PALETTE_SOURCES = ['#10b981', '#f43f5e', '#0ea5e9', '#d946ef', '#eab308', '#22d3ee', '#a3e635', '#fb923c', '#818cf8', '#2dd4bf'];
const PALETTE_MODES = ['#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#10b981', '#3b82f6'];

const formatINR = (val: number) => '₹' + Number(val).toLocaleString('en-IN');

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; count: number; amount?: number } }>;
  total: number;
}

const CustomTooltip = ({ active, payload, total }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = data.value !== undefined ? data.value : data.amount || 0;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-black/90 text-white p-3 rounded-lg shadow-xl text-sm border border-white/10 z-50 relative">
        <div className="font-semibold mb-1">{data.name}</div>
        <div>{formatINR(value)} {total > 0 && `(${pct}%)`}</div>
        <div className="text-white/60 text-xs mt-1">{data.count} Transaction{data.count !== 1 ? 's' : ''}</div>
      </div>
    );
  }
  return null;
};

const CustomLineTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/90 text-white p-3 rounded-lg shadow-xl text-sm border border-white/10 z-50 relative">
        <div className="font-semibold mb-1">{data.name}</div>
        <div>{formatINR(data.amount)}</div>
        <div className="text-white/60 text-xs mt-1">{data.count} Transaction{data.count !== 1 ? 's' : ''}</div>
      </div>
    );
  }
  return null;
};

const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const getStartOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const CreditAnalytics = ({ credits, onRefresh, isRefreshing }: CreditAnalyticsProps) => {
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedSub1, setSelectedSub1] = useState<string | null>(null);
  const [selectedSub2, setSelectedSub2] = useState<string | null>(null);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [appliedRange, setAppliedRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [tempRange, setTempRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [viewDate, setViewDate] = useState(new Date());

  const data = useCreditAnalytics(credits, appliedRange, selectedMain, selectedSub1, selectedSub2);

  const applyQuickRange = (rangeName: string) => {
    const today = new Date();
    let from: Date | null = null;
    let to: Date | null = today;

    switch (rangeName) {
      case 'Today': from = today; break;
      case 'Yesterday': from = addDays(today, -1); to = addDays(today, -1); break;
      case 'This Week': from = getStartOfWeek(new Date()); break;
      case 'Last 7 Days': from = addDays(today, -6); break;
      case 'This Month': from = new Date(today.getFullYear(), today.getMonth(), 1); break;
      case 'Previous Month': from = new Date(today.getFullYear(), today.getMonth() - 1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); break;
      case 'Last 30 Days': from = addDays(today, -29); break;
      case 'This Year': from = new Date(today.getFullYear(), 0, 1); break;
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
      const isSelected = tempRange.from && tempRange.to && normalizeDate(date).getTime() >= normalizeDate(tempRange.from).getTime() && normalizeDate(date).getTime() <= normalizeDate(tempRange.to).getTime();
      const isStart = tempRange.from && normalizeDate(date).getTime() === normalizeDate(tempRange.from).getTime();
      const isEnd = tempRange.to && normalizeDate(date).getTime() === normalizeDate(tempRange.to).getTime();
      const isToday = normalizeDate(date).getTime() === normalizeDate(new Date()).getTime();
      
      let wrapperClass = "w-9 h-9 relative flex items-center justify-center cursor-pointer text-sm font-medium transition-colors ";
      if (isSelected && !isStart && !isEnd) wrapperClass += "bg-primary/15 text-primary";
      else if (isStart && isEnd) wrapperClass += "text-white";
      else if (isStart && tempRange.to) wrapperClass += "bg-gradient-to-r from-transparent via-primary/15 to-primary/15 text-white";
      else if (isEnd && tempRange.from) wrapperClass += "bg-gradient-to-l from-transparent via-primary/15 to-primary/15 text-white";
      else if (isStart || isEnd) wrapperClass += "text-white";
      else wrapperClass += "text-slate-300 hover:text-white";

      let circleClass = "absolute inset-0 m-auto flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 z-10 ";
      if (isStart || isEnd) circleClass += "bg-primary shadow-lg shadow-primary/40 font-bold text-white";
      else if (!isSelected) circleClass += "hover:bg-slate-700 hover:scale-105";
      
      if (isToday && !isStart && !isEnd && !isSelected) circleClass += " ring-1 ring-inset ring-primary/50 text-primary";
      
      days.push(
        <div key={i} className={wrapperClass} onClick={() => {
          const normDate = normalizeDate(date).getTime();
          const normFrom = tempRange.from ? normalizeDate(tempRange.from).getTime() : null;
          const normTo = tempRange.to ? normalizeDate(tempRange.to).getTime() : null;
          if (!normFrom || !normTo) setTempRange({ from: date, to: date });
          else if (normFrom === normTo) {
            if (normDate < normFrom) setTempRange({ from: date, to: tempRange.from });
            else setTempRange({ from: tempRange.from, to: date });
          } else setTempRange({ from: date, to: date });
        }}>
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
        <div className="grid grid-cols-7 gap-y-1">{days}</div>
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

  const renderChartCard = (title: string, chartData: any[], total: number, palette: string[], activeItem: string | null, onClick: (name: string) => void, emptyMessage: string) => (
    <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col h-full fade-in">
      <h3 className="text-sm font-semibold text-slate-100 mb-6">{title}</h3>
      {chartData.length === 0 || (chartData.length === 1 && chartData[0].name === 'Other' && total === 0) ? (
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
                  data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={0} dataKey="value"
                  onClick={(e) => { if(e && e.name) onClick(e.name); }} cursor="pointer" stroke="none"
                >
                  {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />)}
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
            {chartData.map((item, index) => (
              <button
                key={item.name}
                onClick={() => onClick(item.name)}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-colors text-left w-full group ${
                  activeItem === item.name ? 'bg-slate-700 border-l-2 border-l-purple-500' : 'bg-[#252d41] hover:bg-slate-700/80 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette[index % palette.length] }} />
                  <span className={`text-xs font-medium truncate ${activeItem === item.name ? 'text-white' : 'text-slate-300'}`}>{item.name}</span>
                </div>
                <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">{formatINR(item.value)}</span>
                  <div className="h-3 w-px bg-slate-600 mx-1"></div>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{item.count} Txns</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col fade-in">
      {/* Header Controls */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-xl font-bold text-slate-100">Credit Analytics Dashboard</h2>
        <div className="flex gap-3">
          <button 
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-sm font-semibold text-primary hover:bg-primary/20 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => { setTempRange(appliedRange); setIsDatePickerOpen(true); }}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-[#1e2536] border border-slate-700/60 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-700/50 hover:border-slate-600 transition-all shadow-sm group"
            >
              <Calendar size={16} className="text-primary group-hover:text-primary-light transition-colors" />
              {getAppliedRangeText()}
            </button>
            {isDatePickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDatePickerOpen(false)} />
                <div className="absolute right-0 mt-3 p-6 bg-[#161b27]/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-black/80 z-50 flex gap-8 fade-in min-w-[720px] ring-1 ring-black/20">
                  <div className="flex flex-col gap-1.5 w-48 border-r border-slate-700/50 pr-6">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-2">Quick Ranges</span>
                    {['Today', 'Yesterday', 'This Week', 'Last 7 Days', 'This Month', 'Previous Month', 'Last 30 Days', 'This Year'].map(range => (
                      <button key={range} onClick={() => applyQuickRange(range)} className="text-left px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-all">{range}</button>
                    ))}
                  </div>
                  <div className="flex flex-col flex-1 pl-2">
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white active:scale-95"><ChevronLeft size={20} /></button>
                      <div className="flex gap-14">
                        {renderCalendarMonth(viewDate.getFullYear(), viewDate.getMonth())}
                        {renderCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)}
                      </div>
                      <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white active:scale-95"><ChevronRight size={20} /></button>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-5 border-t border-slate-700/50">
                      <button onClick={() => { setAppliedRange({ from: null, to: null }); setTempRange({ from: null, to: null }); setIsDatePickerOpen(false); }} className="px-2 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">Clear Filter</button>
                      <div className="flex gap-3">
                        <button onClick={() => setIsDatePickerOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-all">Cancel</button>
                        <button onClick={() => { setAppliedRange(tempRange); setIsDatePickerOpen(false); }} className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-light rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">Apply Range</button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#1e2536] p-4 sm:p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center min-h-[100px]">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2 line-clamp-1">Total Credits</span>
          <span className="text-lg sm:text-2xl font-bold text-white break-words">{formatINR(data.totalAmount)}</span>
        </div>
        <div className="bg-[#1e2536] p-4 sm:p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center min-h-[100px]">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2 line-clamp-1">Transactions</span>
          <span className="text-lg sm:text-2xl font-bold text-white break-words">{data.totalTransactions}</span>
        </div>
        <div className="bg-[#1e2536] p-4 sm:p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center min-h-[100px]">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2 line-clamp-1">Categorized</span>
          <span className="text-lg sm:text-2xl font-bold text-emerald-400 break-words">{formatINR(data.categorizedAmount)}</span>
        </div>
        <div className="bg-[#1e2536] p-4 sm:p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center min-h-[100px]">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2 line-clamp-1">Uncategorized</span>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-lg sm:text-2xl font-bold text-amber-400 break-words">{formatINR(data.uncategorizedAmount)}</span>
            {data.uncategorizedPercentage > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {data.uncategorizedPercentage.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="bg-[#1e2536] p-4 sm:p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center min-h-[100px] col-span-2 md:col-span-1">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2 line-clamp-1">Average Credit</span>
          <span className="text-lg sm:text-2xl font-bold text-white break-words">{formatINR(data.averageCredit)}</span>
        </div>
      </div>

      {data.totalTransactions === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted bg-[#1e2536] rounded-xl border border-slate-700">
          <div className="text-4xl mb-4">📊</div>
          <p>No credit data available for this range.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-12">
          {/* Trend Chart */}
          <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700 shadow-sm w-full">
            <h3 className="text-sm font-semibold text-slate-100 mb-6">Credit Inflow Trend</h3>
            <div className="w-full h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    width={45}
                    dx={-5}
                  />
                  <Tooltip 
                    content={<CustomLineTooltip />} 
                    cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '3 3' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#6366f1" 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1', stroke: '#1e2536', strokeWidth: 2 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderChartCard('Main Department', data.departmentData, data.totalAmount, PALETTE_MAIN, selectedMain, (n) => { setSelectedMain(n); setSelectedSub1(null); setSelectedSub2(null); }, 'No department data')}
            {renderChartCard(selectedMain ? `${selectedMain} Breakdown` : 'Category Breakdown', data.sub1Data, data.sub1Data.reduce((s,i) => s + i.value, 0), PALETTE_L2, selectedSub1, (n) => { setSelectedSub1(n); setSelectedSub2(null); }, selectedMain ? `No deeper breakdown available.` : 'Select a Main Department first')}
            {renderChartCard('Payment Modes', data.paymentModeData, data.totalAmount, PALETTE_MODES, null, () => {}, 'No payment mode data')}
            {renderChartCard('Top Credit Sources', data.sourceData, data.totalAmount, PALETTE_SOURCES, null, () => {}, 'No source data')}
          </div>
        </div>
      )}
    </div>
  );
};
