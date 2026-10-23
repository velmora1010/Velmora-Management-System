import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  XCircle, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  Eye, 
  RotateCcw,
  Clock,
  ChevronDown
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import type { WebsiteConsolidatedOrder } from '../types';
import { formatSalesDateShort } from '../websiteSalesUtils';

interface SalesRevenueIntelligenceSectionProps {
  orders: WebsiteConsolidatedOrder[];
  previousOrders: WebsiteConsolidatedOrder[];
  startDate: string;
  endDate: string;
  onSelectOrder: (order: WebsiteConsolidatedOrder) => void;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const SalesRevenueIntelligenceSection: React.FC<SalesRevenueIntelligenceSectionProps> = ({
  orders,
  previousOrders,
  startDate,
  endDate,
  onSelectOrder
}) => {
  // Chart Granularity Toggle
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'orders'>('revenue');

  // Filtered Orders Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // --- KPI CALCULATIONS ---
  // Current period metrics
  const totalOrders = orders.length;
  const grossSales = useMemo(() => orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [orders]);
  
  const cancelledOrders = useMemo(() => orders.filter(o => 
    o.order_status === 'CANCELLED' || 
    (o.fulfillment_status || '').toLowerCase() === 'cancelled'
  ), [orders]);
  const cancelledCount = cancelledOrders.length;
  const cancelledAmount = useMemo(() => cancelledOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [cancelledOrders]);

  const netSales = Math.max(0, grossSales - cancelledAmount);
  const aov = totalOrders > 0 ? Math.round(grossSales / totalOrders) : 0;

  // Previous period metrics
  const prevTotalOrders = previousOrders.length;
  const prevGrossSales = useMemo(() => previousOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [previousOrders]);
  const prevCancelledOrders = useMemo(() => previousOrders.filter(o => 
    o.order_status === 'CANCELLED' || 
    (o.fulfillment_status || '').toLowerCase() === 'cancelled'
  ), [previousOrders]);
  const prevCancelledAmount = useMemo(() => prevCancelledOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [prevCancelledOrders]);
  const prevNetSales = Math.max(0, prevGrossSales - prevCancelledAmount);
  const prevAov = prevTotalOrders > 0 ? Math.round(prevGrossSales / prevTotalOrders) : 0;

  // Growth Rates
  const revenueGrowthPct = prevGrossSales > 0 
    ? ((grossSales - prevGrossSales) / prevGrossSales) * 100 
    : (grossSales > 0 && prevGrossSales === 0 ? 100 : 0);
  
  const ordersGrowthPct = prevTotalOrders > 0 
    ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 
    : (totalOrders > 0 && prevTotalOrders === 0 ? 100 : 0);

  const aovGrowthPct = prevAov > 0 
    ? ((aov - prevAov) / prevAov) * 100 
    : (aov > 0 && prevAov === 0 ? 100 : 0);

  // --- CHART DATA: SALES TREND ---
  const trendData = useMemo(() => {
    const map: Record<string, { date: string; displayDate: string; revenue: number; orders: number; aov: number }> = {};
    
    orders.forEach(o => {
      const d = o.order_date || 'Unknown';
      if (!map[d]) {
        map[d] = {
          date: d,
          displayDate: formatSalesDateShort(d),
          revenue: 0,
          orders: 0,
          aov: 0
        };
      }
      map[d].orders += 1;
      map[d].revenue += Number(o.price) || 0;
    });

    const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(item => {
      item.aov = item.orders > 0 ? Math.round(item.revenue / item.orders) : 0;
    });

    // Handle weekly / monthly aggregation if toggled
    if (trendGranularity === 'weekly' && sorted.length > 7) {
      const weeks: typeof sorted = [];
      for (let i = 0; i < sorted.length; i += 7) {
        const chunk = sorted.slice(i, i + 7);
        const wRev = chunk.reduce((s, c) => s + c.revenue, 0);
        const wOrd = chunk.reduce((s, c) => s + c.orders, 0);
        weeks.push({
          date: chunk[0].date,
          displayDate: `${chunk[0].displayDate} - ${chunk[chunk.length - 1].displayDate}`,
          revenue: wRev,
          orders: wOrd,
          aov: wOrd > 0 ? Math.round(wRev / wOrd) : 0
        });
      }
      return weeks;
    }

    return sorted;
  }, [orders, trendGranularity]);

  // --- CHART DATA: REVENUE BREAKDOWN (PAYMENT & STATUS) ---
  const paymentBreakdown = useMemo(() => {
    let prepaidRev = 0;
    let prepaidCount = 0;
    let codRev = 0;
    let codCount = 0;
    let partialRev = 0;
    let partialCount = 0;

    orders.forEach(o => {
      const mode = (o.payment_mode || '').toUpperCase();
      const val = Number(o.price) || 0;
      if (mode === 'PREPAID') {
        prepaidRev += val;
        prepaidCount++;
      } else if (mode === 'PARTIAL COD') {
        partialRev += val;
        partialCount++;
      } else {
        codRev += val;
        codCount++;
      }
    });

    return [
      { name: 'Prepaid', value: prepaidRev, orders: prepaidCount, color: '#06b6d4' },
      { name: 'Cash on Delivery', value: codRev, orders: codCount, color: '#f59e0b' },
      ...(partialCount > 0 ? [{ name: 'Partial COD', value: partialRev, orders: partialCount, color: '#8b5cf6' }] : [])
    ];
  }, [orders]);

  // --- CHART DATA: WEEKDAY PERFORMANCE ---
  const weekdayData = useMemo(() => {
    const days = [
      { name: 'Mon', fullName: 'Monday', revenue: 0, orders: 0 },
      { name: 'Tue', fullName: 'Tuesday', revenue: 0, orders: 0 },
      { name: 'Wed', fullName: 'Wednesday', revenue: 0, orders: 0 },
      { name: 'Thu', fullName: 'Thursday', revenue: 0, orders: 0 },
      { name: 'Fri', fullName: 'Friday', revenue: 0, orders: 0 },
      { name: 'Sat', fullName: 'Saturday', revenue: 0, orders: 0 },
      { name: 'Sun', fullName: 'Sunday', revenue: 0, orders: 0 }
    ];

    orders.forEach(o => {
      if (!o.order_date) return;
      const parts = o.order_date.split('-').map(Number);
      if (parts.length === 3) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayIdx = dt.getDay(); // 0 is Sunday
        const targetIdx = dayIdx === 0 ? 6 : dayIdx - 1; // 0=Mon, 6=Sun
        days[targetIdx].revenue += Number(o.price) || 0;
        days[targetIdx].orders += 1;
      }
    });

    return days;
  }, [orders]);

  // --- FILTERED ORDERS LIST ---
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (selectedPaymentFilter !== 'ALL' && (o.payment_mode || '').toUpperCase() !== selectedPaymentFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'ALL') {
        const s = (o.order_status || '').toUpperCase();
        if (selectedStatusFilter === 'CANCELLED' && s !== 'CANCELLED') return false;
        if (selectedStatusFilter === 'CONFIRMED' && s !== 'CONFIRMED') return false;
      }
      if (selectedDateFilter && o.order_date !== selectedDateFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.order_id.toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.phone || '').includes(q) ||
          (o.city || '').toLowerCase().includes(q) ||
          (o.state || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, selectedPaymentFilter, selectedStatusFilter, selectedDateFilter, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* 1. COMPACT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Orders */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShoppingBag size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {totalOrders.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold">
            {ordersGrowthPct >= 0 ? (
              <span className="text-emerald-400 flex items-center">
                <ArrowUpRight size={13} /> +{ordersGrowthPct.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center">
                <ArrowDownRight size={13} /> {ordersGrowthPct.toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500 text-[10px]">vs prev</span>
          </div>
        </div>

        {/* Gross Sales */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono">
            ₹{Math.round(grossSales).toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold">
            {revenueGrowthPct >= 0 ? (
              <span className="text-emerald-400 flex items-center">
                <ArrowUpRight size={13} /> +{revenueGrowthPct.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center">
                <ArrowDownRight size={13} /> {revenueGrowthPct.toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500 text-[10px]">vs prev</span>
          </div>
        </div>

        {/* Net Sales */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Sales</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
            ₹{Math.round(netSales).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 truncate" title="Gross minus cancellations">
            Excl. ₹{Math.round(cancelledAmount).toLocaleString('en-IN')} cancelled
          </div>
        </div>

        {/* Average Order Value */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Order Value</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <CreditCard size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            ₹{aov.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold">
            {aovGrowthPct >= 0 ? (
              <span className="text-emerald-400 flex items-center">
                <ArrowUpRight size={13} /> +{aovGrowthPct.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center">
                <ArrowDownRight size={13} /> {aovGrowthPct.toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500 text-[10px]">vs prev</span>
          </div>
        </div>

        {/* Revenue Growth % */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Revenue Growth</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold font-mono ${revenueGrowthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {revenueGrowthPct >= 0 ? `+${revenueGrowthPct.toFixed(1)}%` : `${revenueGrowthPct.toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Prev: ₹{Math.round(prevGrossSales).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Cancelled Orders */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cancelled Orders</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <XCircle size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 font-mono">
            {cancelledCount}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            ₹{Math.round(cancelledAmount).toLocaleString('en-IN')} lost
          </div>
        </div>
      </div>

      {/* 2. MAIN CHARTS GRID (BALANCED TWO-COLUMN LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Sales Trend */}
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Sales Trend
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {trendMetric === 'revenue' ? 'Revenue trajectory across selected period' : 'Order volume trajectory'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Metric Toggle */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setTrendMetric('revenue')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    trendMetric === 'revenue' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setTrendMetric('orders')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    trendMetric === 'orders' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Orders
                </button>
              </div>

              {/* Granularity Toggle */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setTrendGranularity('daily')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    trendGranularity === 'daily' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setTrendGranularity('weekly')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    trendGranularity === 'weekly' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No orders recorded in this date range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={trendData} 
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const clickedDate = state.activePayload[0].payload.date;
                      setSelectedDateFilter(prev => prev === clickedDate ? null : clickedDate);
                      setCurrentPage(1);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendMetric === 'revenue' ? '#8b5cf6' : '#06b6d4'} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={trendMetric === 'revenue' ? '#8b5cf6' : '#06b6d4'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="#64748b" 
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => trendMetric === 'revenue' ? `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}` : val}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    formatter={(val: any, name: any) => [
                      name === 'revenue' ? `₹${Number(val).toLocaleString('en-IN')}` : val,
                      name === 'revenue' ? 'Revenue' : 'Orders'
                    ]}
                    labelFormatter={(label, items) => {
                      const item = items[0]?.payload;
                      return item ? `${item.displayDate} (${item.orders} orders)` : label;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={trendMetric} 
                    stroke={trendMetric === 'revenue' ? '#8b5cf6' : '#06b6d4'} 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#salesTrendGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {selectedDateFilter && (
            <div className="flex items-center justify-between p-2 px-3 bg-purple-950/40 border border-purple-800/60 rounded-xl text-xs text-purple-300">
              <span>Filtered to date: <strong>{formatSalesDateShort(selectedDateFilter)}</strong></span>
              <button 
                onClick={() => setSelectedDateFilter(null)}
                className="text-[11px] underline hover:text-white cursor-pointer"
              >
                Clear date filter
              </button>
            </div>
          )}
        </div>

        {/* Right: Revenue Breakdown by Payment Mode & Status */}
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Revenue Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Payment method composition (Prepaid vs Cash on Delivery)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Donut Chart */}
            <div className="h-52 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total</span>
                <span className="text-sm font-bold text-white font-mono">₹{Math.round(grossSales).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="space-y-2.5">
              {paymentBreakdown.map((item) => {
                const sharePct = grossSales > 0 ? (item.value / grossSales) * 100 : 0;
                return (
                  <div 
                    key={item.name} 
                    onClick={() => {
                      const modeKey = item.name === 'Prepaid' ? 'PREPAID' : (item.name === 'Partial COD' ? 'PARTIAL COD' : 'COD');
                      setSelectedPaymentFilter(prev => prev === modeKey ? 'ALL' : modeKey);
                      setCurrentPage(1);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedPaymentFilter === (item.name === 'Prepaid' ? 'PREPAID' : (item.name === 'Partial COD' ? 'PARTIAL COD' : 'COD'))
                        ? 'border-purple-500 bg-purple-950/30'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-950/90'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-white">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-white">
                        ₹{Math.round(item.value).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                      <span>{item.orders} orders</span>
                      <span className="font-mono font-bold text-slate-300">{sharePct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SALES PERFORMANCE: WEEKDAY BREAKDOWN */}
      <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Sales Performance by Weekday
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identify top-converting days of the week for campaign scheduling
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Total Revenue: <strong className="text-emerald-400 font-mono">₹{Math.round(grossSales).toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis 
                stroke="#64748b" 
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                labelFormatter={(name, items) => {
                  const it = items[0]?.payload;
                  return it ? `${it.fullName} (${it.orders} orders)` : name;
                }}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. COMPACT RECENT ORDERS TABLE */}
      <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Orders in Selected Period</span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-800 text-purple-400 border border-purple-500/20">
                {filteredOrders.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any order row to inspect full itemization and customer attributes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search orders, customers..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-56 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
              />
            </div>

            {/* Payment Filter */}
            <select
              value={selectedPaymentFilter}
              onChange={e => { setSelectedPaymentFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
            >
              <option value="ALL">All Payments</option>
              <option value="PREPAID">Prepaid</option>
              <option value="COD">Cash on Delivery</option>
              <option value="PARTIAL COD">Partial COD</option>
            </select>

            {/* Reset Filters */}
            {(selectedPaymentFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || selectedDateFilter || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedPaymentFilter('ALL');
                  setSelectedStatusFilter('ALL');
                  setSelectedDateFilter(null);
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Reset filters"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Items / Products</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                      No matching orders found for current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map(o => (
                    <tr 
                      key={o.id}
                      onClick={() => onSelectOrder(o)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-white">
                        #{o.order_id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {formatSalesDateShort(o.order_date)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-200 truncate max-w-[140px]">
                        {o.customer_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[130px]">
                        {o.city}, {o.state}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 truncate max-w-[200px]" title={o.order_formatted || o.product_name}>
                        {o.order_formatted || o.product_name}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.payment_mode === 'PREPAID'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {o.payment_mode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        ₹{Number(o.price || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(o);
                          }}
                          className="p-1 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded transition-colors"
                          title="View order details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded text-slate-300 cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 text-white font-mono">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded text-slate-300 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
