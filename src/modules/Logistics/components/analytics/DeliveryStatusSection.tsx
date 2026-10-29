import React, { useMemo, useState } from 'react';
import { 
  CheckCircle2, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Clock, 
  Calendar, 
  ChevronRight,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  AreaChart, 
  Area, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  ALL_CANONICAL_STATUSES, 
  STATUS_METADATA_MAP, 
  CanonicalLogisticsStatus 
} from '../../utils/logisticsAnalyticsUtils';
import { parseAndFormatLogisticsDate } from '../../../../utils/logisticsDateUtils';

interface DeliveryStatusSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

export const DeliveryStatusSection: React.FC<DeliveryStatusSectionProps> = ({
  orders,
  onDrillDown
}) => {
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly'>('daily');

  // 1. Status breakdown across all 13 canonical statuses
  const statusStats = useMemo(() => {
    const totalOrders = orders.length;
    const counts: Record<CanonicalLogisticsStatus, number> = {} as any;
    ALL_CANONICAL_STATUSES.forEach(st => { counts[st] = 0; });

    orders.forEach(o => {
      const canonical = getCanonicalStatus(o);
      counts[canonical] = (counts[canonical] || 0) + 1;
    });

    const list = ALL_CANONICAL_STATUSES.map(status => {
      const count = counts[status];
      const pct = totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(1) : '0.0';
      const meta = STATUS_METADATA_MAP[status];
      return {
        status,
        count,
        pct: parseFloat(pct),
        meta
      };
    });

    const deliveredCount = counts['Delivered'] || 0;
    const rtoCount = (counts['RTO Initiated'] || 0) + (counts['RTO In Transit'] || 0) + (counts['RTO Delivered to Seller'] || 0);
    const concludedCount = deliveredCount + rtoCount;
    const completionRate = concludedCount > 0 ? Math.round((deliveredCount / concludedCount) * 100) : 0;

    return {
      list,
      totalOrders,
      deliveredCount,
      rtoCount,
      completionRate
    };
  }, [orders]);

  // 2. Daily & Weekly Delivery Trends (Orders Delivered and Dispatched over Time)
  const deliveryTrends = useMemo(() => {
    const map = new Map<string, { period: string; delivered: number; dispatched: number; exceptions: number }>();

    orders.forEach(o => {
      let rawDate = o.deliveredDate || o.dispatchDate || o.orderDate;
      if (!rawDate) return;
      const parsed = parseAndFormatLogisticsDate(rawDate);
      if (!parsed.isoDate) return;

      let key = parsed.isoDate;
      if (trendGranularity === 'weekly') {
        const d = new Date(parsed.isoDate);
        const day = d.getDay();
        const diff = (day + 6) % 7;
        const weekStart = new Date(d.getTime() - diff * 24 * 60 * 60 * 1000);
        key = weekStart.toISOString().slice(0, 10);
      }

      if (!map.has(key)) {
        map.set(key, { period: key, delivered: 0, dispatched: 0, exceptions: 0 });
      }

      const item = map.get(key)!;
      const status = getCanonicalStatus(o);
      if (status === 'Delivered') {
        item.delivered++;
      }
      if (o.dispatchDate) {
        item.dispatched++;
      }
      if (status.includes('RTO') || status === 'Delivery Attempt Failed' || status === 'Shipment Exception') {
        item.exceptions++;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-30); // show last 30 intervals
  }, [orders, trendGranularity]);

  // Chart data for horizontal status bar
  const chartData = useMemo(() => {
    return statusStats.list
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [statusStats.list]);

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>Delivery Performance & Status Analytics</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Full lifecycle tracking breakdown across all 13 canonical logistics statuses
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Delivery Completion Rate</div>
            <div className="text-lg font-black font-mono text-emerald-400">{statusStats.completionRate}%</div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Tracked</div>
            <div className="text-lg font-black font-mono text-cyan-300">{statusStats.totalOrders.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN CHARTS: STATUS DISTRIBUTION & DELIVERY TRENDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* CHART 1: Canonical Status Distribution (Bar Chart) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 size={15} className="text-cyan-400" />
                Status Distribution (Active Counts)
              </h4>
              <p className="text-xs text-slate-400">Click any bar to drill down into exact orders</p>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-400 bg-[#0e1626] border border-slate-800 px-2 py-0.5 rounded">
              {chartData.length} Active States
            </span>
          </div>

          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No status data available for current filter
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="status"
                    stroke="#94a3b8"
                    fontSize={10}
                    width={110}
                    tickFormatter={(v) => v.length > 16 ? v.slice(0, 16) + '…' : v}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${Number(val).toLocaleString('en-IN')} orders (${item.payload.pct}%)`,
                      'Count'
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    cursor="pointer"
                    onClick={(entry) => {
                      if (entry && entry.status) {
                        onDrillDown(
                          `Status: ${entry.status}`,
                          `Orders currently in ${entry.status} stage`,
                          o => getCanonicalStatus(o) === entry.status
                        );
                      }
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.meta.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: Daily & Weekly Delivery Trends (Area Chart) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp size={15} className="text-emerald-400" />
                Delivery & Fulfillment Trends
              </h4>
              <p className="text-xs text-slate-400">Delivered vs dispatched volume over time</p>
            </div>

            {/* Granularity Switch */}
            <div className="flex items-center bg-[#0e1626] border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTrendGranularity('daily')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  trendGranularity === 'daily' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setTrendGranularity('weekly')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  trendGranularity === 'weekly' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {deliveryTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No delivery time-series available for current filter
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={deliveryTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dispGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="delivered" name="Delivered Orders" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#delivGrad)" />
                  <Area type="monotone" dataKey="dispatched" name="Dispatches" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#dispGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* 13 CANONICAL STATUS SUMMARY CARDS / DRILL-DOWN TILES */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Layers size={14} className="text-purple-400" />
          <span>Status Hierarchy & Breakdown (13 Canonical Stages)</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {statusStats.list.map((item) => (
            <div
              key={item.status}
              onClick={() => onDrillDown(
                `Status: ${item.status}`,
                `Orders currently in ${item.status} status`,
                o => getCanonicalStatus(o) === item.status
              )}
              className="bg-[#0e1626] border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.meta.color }} />
                  <span className="text-[11px] font-bold text-slate-300 group-hover:text-white truncate">
                    {item.status}
                  </span>
                </div>
                <div className="text-lg font-black font-mono text-white">
                  {item.count.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="font-mono text-slate-400 font-semibold">{item.pct}%</span>
                <ArrowUpRight size={11} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
