import React, { useState } from 'react';
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  CheckCircle2,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import type { YearlyPerformanceRecord, MonthlyPerformanceRecord } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';

interface YearlyPerformanceTabProps {
  yearlyRecords: YearlyPerformanceRecord[];
  monthlyRecords: MonthlyPerformanceRecord[];
  onSelectYearFilter?: (year: number) => void;
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const YearlyPerformanceTab: React.FC<YearlyPerformanceTabProps> = ({
  yearlyRecords,
  monthlyRecords,
  onSelectYearFilter,
  onViewOrders
}) => {
  const [inspectedYear, setInspectedYear] = useState<number | null>(null);

  if (yearlyRecords.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
        No yearly records available for the selected period.
      </div>
    );
  }

  // Active year inspection breakdown (guaranteed full 12 calendar months Jan-Dec)
  const yearMonthlyBreakdown = inspectedYear != null
    ? yearlyRecords.find(y => y.year === inspectedYear)?.monthlyBreakdown || monthlyRecords.filter(m => m.year === inspectedYear)
    : null;

  return (
    <div className="space-y-5">
      {/* 1. Yearly Charts Grid (4 Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Yearly Revenue Comparison */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={13} className="text-emerald-400" />
              1. Yearly Revenue Comparison (₹)
            </span>
            <span className="text-[10px] text-slate-500">Gross vs Net Sales</span>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyRecords} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="yearLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as YearlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">Year {d.yearLabel}</p>
                          <p className="text-emerald-400">Gross: ₹{d.grossOrderValue.toLocaleString('en-IN')}</p>
                          <p className="text-cyan-400">Net: ₹{d.netSales.toLocaleString('en-IN')}</p>
                          {d.yoyRevenueGrowthPercent != null && (
                            <p className={d.yoyRevenueGrowthPercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              YoY Growth: {d.yoyRevenueGrowthPercent >= 0 ? `+${d.yoyRevenueGrowthPercent}%` : `${d.yoyRevenueGrowthPercent}%`}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="grossOrderValue" name="Gross (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netSales" name="Net Sales (₹)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Yearly Order Comparison */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={13} className="text-purple-400" />
              2. Yearly Order Comparison
            </span>
            <span className="text-[10px] text-slate-500">Total placed orders</span>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="yearLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as YearlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">Year {d.yearLabel}</p>
                          <p className="text-purple-300">Total Orders: {d.totalOrders.toLocaleString('en-IN')}</p>
                          {d.yoyOrdersGrowthPercent != null && (
                            <p className={d.yoyOrdersGrowthPercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              YoY Orders: {d.yoyOrdersGrowthPercent >= 0 ? `+${d.yoyOrdersGrowthPercent}%` : `${d.yoyOrdersGrowthPercent}%`}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="totalOrders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Yearly Units Sold Performance */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Package size={13} className="text-cyan-400" />
              3. Yearly Units Sold
            </span>
            <span className="text-[10px] text-slate-500">Volume across valid orders</span>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="yearLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as YearlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">Year {d.yearLabel}</p>
                          <p className="text-cyan-300">Units Sold: {d.unitsSold.toLocaleString('en-IN')}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="unitsSold" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Yearly Delivered vs RTO vs Cancelled Comparison */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-green-400" />
              4. Yearly Delivered vs RTO vs Cancelled
            </span>
            <span className="text-[10px] text-slate-500">Fulfillment outcomes</span>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="yearLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as YearlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">Year {d.yearLabel}</p>
                          <p className="text-green-400">Delivered: {d.deliveredOrders.toLocaleString('en-IN')}</p>
                          <p className="text-amber-400">RTO: {d.rtoOrders.toLocaleString('en-IN')}</p>
                          <p className="text-rose-400">Cancelled: {d.cancelledOrders.toLocaleString('en-IN')}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="deliveredOrders" name="Delivered" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rtoOrders" name="RTO" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="cancelledOrders" name="Cancelled" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. Comprehensive Yearly Performance Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3">Year</th>
              <th className="py-2.5 px-3 text-right">Orders</th>
              <th className="py-2.5 px-3 text-right">YoY Orders</th>
              <th className="py-2.5 px-3 text-right">Gross Revenue</th>
              <th className="py-2.5 px-3 text-right">YoY Revenue</th>
              <th className="py-2.5 px-3 text-right">Net Sales</th>
              <th className="py-2.5 px-3 text-right">Units</th>
              <th className="py-2.5 px-3 text-right">AOV</th>
              <th className="py-2.5 px-3 text-right text-green-400">Delivered</th>
              <th className="py-2.5 px-3 text-right text-green-400">Delivered Rev</th>
              <th className="py-2.5 px-3 text-right text-amber-400">RTO</th>
              <th className="py-2.5 px-3 text-right text-amber-400">RTO Value</th>
              <th className="py-2.5 px-3 text-right text-rose-400">Cancelled</th>
              <th className="py-2.5 px-3 text-right text-rose-400">Cancel Val</th>
              <th className="py-2.5 px-3 text-right text-indigo-300">Repeat Cust</th>
              <th className="py-2.5 px-3 text-right text-slate-400">New Cust</th>
              <th className="py-2.5 px-3 text-center">Breakdown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {yearlyRecords.map((y) => (
              <tr
                key={y.year}
                onClick={() => setInspectedYear(prev => prev === y.year ? null : y.year)}
                className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
              >
                <td className="py-2.5 px-3 font-semibold text-white font-sans flex items-center gap-1.5">
                  <Calendar size={12} className="text-purple-400" />
                  <span>{y.yearLabel}</span>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-white">{y.totalOrders.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right">
                  {y.yoyOrdersGrowthPercent != null ? (
                    <span className={`inline-flex items-center text-[11px] font-bold ${
                      y.yoyOrdersGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {y.yoyOrdersGrowthPercent >= 0 ? `+${y.yoyOrdersGrowthPercent}%` : `${y.yoyOrdersGrowthPercent}%`}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400">₹{y.grossOrderValue.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right">
                  {y.yoyRevenueGrowthPercent != null ? (
                    <span className={`inline-flex items-center text-[11px] font-bold ${
                      y.yoyRevenueGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {y.yoyRevenueGrowthPercent >= 0 ? `+${y.yoyRevenueGrowthPercent}%` : `${y.yoyRevenueGrowthPercent}%`}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-cyan-400">₹{y.netSales.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right text-slate-300">{y.unitsSold.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right text-slate-300">₹{y.aov}</td>
                <td className="py-2.5 px-3 text-right text-green-400">{y.deliveredOrders}</td>
                <td className="py-2.5 px-3 text-right text-green-400">₹{y.deliveredRevenue.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right text-amber-400">{y.rtoOrders}</td>
                <td className="py-2.5 px-3 text-right text-amber-400">₹{y.rtoValue.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right text-rose-400">{y.cancelledOrders}</td>
                <td className="py-2.5 px-3 text-right text-rose-400">₹{y.cancellationValue.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-3 text-right text-indigo-300">{y.repeatCustomers}</td>
                <td className="py-2.5 px-3 text-right text-slate-400">{y.newCustomers}</td>
                <td className="py-2.5 px-3 text-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedYear(prev => prev === y.year ? null : y.year);
                    }}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-slate-700 text-[10px] font-sans font-medium transition-colors"
                  >
                    {inspectedYear === y.year ? 'Hide' : 'Months'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Drilldown Monthly Breakdown for Selected Year */}
      {inspectedYear != null && yearMonthlyBreakdown && (
        <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/50 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-purple-400" />
              <h4 className="text-sm font-bold text-white">
                Monthly Breakdown for Year <span className="text-purple-300">{inspectedYear}</span> ({yearMonthlyBreakdown.length} months)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setInspectedYear(null)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              Close
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2 px-2.5">Month</th>
                  <th className="py-2 px-2.5 text-right">Orders</th>
                  <th className="py-2 px-2.5 text-right">Gross Value</th>
                  <th className="py-2 px-2.5 text-right">Net Sales</th>
                  <th className="py-2 px-2.5 text-right">Units</th>
                  <th className="py-2 px-2.5 text-right">Delivered</th>
                  <th className="py-2 px-2.5 text-right">RTO</th>
                  <th className="py-2 px-2.5 text-right">Cancelled</th>
                  {onViewOrders && <th className="py-2 px-2.5 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {yearMonthlyBreakdown.map(m => (
                  <tr key={m.monthKey} className="hover:bg-slate-800/40">
                    <td className="py-2 px-2.5 font-sans font-semibold text-white">{m.monthLong}</td>
                    <td className="py-2 px-2.5 text-right font-bold text-white">{m.totalOrders.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2.5 text-right text-emerald-400">₹{m.grossOrderValue.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2.5 text-right text-cyan-400 font-bold">₹{m.netSales.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2.5 text-right">{m.unitsSold.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2.5 text-right text-green-400">{m.deliveredOrders}</td>
                    <td className="py-2 px-2.5 text-right text-amber-400">{m.rtoOrders}</td>
                    <td className="py-2 px-2.5 text-right text-rose-400">{m.cancelledOrders}</td>
                    {onViewOrders && (
                      <td className="py-2 px-2.5 text-center">
                        {m.totalOrders > 0 ? (
                          <button
                            type="button"
                            onClick={() => onViewOrders(`Orders for ${m.monthLong} ${m.year}`, m.matchingOrders)}
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-slate-700 text-[10px] font-sans font-medium transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-sans">0 orders</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default YearlyPerformanceTab;
