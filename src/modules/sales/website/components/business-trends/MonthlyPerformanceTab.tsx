import React, { useState } from 'react';
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Users,
  ChevronRight,
  Eye,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import type { MonthlyPerformanceRecord } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';

interface MonthlyPerformanceTabProps {
  monthlyRecords: MonthlyPerformanceRecord[];
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const MonthlyPerformanceTab: React.FC<MonthlyPerformanceTabProps> = ({
  monthlyRecords,
  onViewOrders
}) => {
  const [selectedMonth, setSelectedMonth] = useState<MonthlyPerformanceRecord | null>(null);

  if (monthlyRecords.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
        No monthly records available for the selected period.
      </div>
    );
  }

  // Aggregate totals across active records
  const totalOrders = monthlyRecords.reduce((s, m) => s + m.totalOrders, 0);
  const totalGross = monthlyRecords.reduce((s, m) => s + m.grossOrderValue, 0);
  const totalNet = monthlyRecords.reduce((s, m) => s + m.netSales, 0);
  const totalUnits = monthlyRecords.reduce((s, m) => s + m.unitsSold, 0);
  const totalDelivered = monthlyRecords.reduce((s, m) => s + m.deliveredOrders, 0);
  const totalRto = monthlyRecords.reduce((s, m) => s + m.rtoOrders, 0);
  const totalCancelled = monthlyRecords.reduce((s, m) => s + m.cancelledOrders, 0);

  return (
    <div className="space-y-5">
      {/* 1. Monthly Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Orders</span>
          <div className="text-lg font-black font-mono text-white mt-0.5">{totalOrders.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500">{monthlyRecords.length} calendar months</span>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Gross Value</span>
          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">₹{totalGross.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500">Total placed orders</span>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-cyan-400 tracking-wider">Net Sales</span>
          <div className="text-lg font-black font-mono text-cyan-400 mt-0.5">₹{totalNet.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500">Excl. cancellations</span>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-green-400 tracking-wider">Delivered</span>
          <div className="text-lg font-black font-mono text-green-400 mt-0.5">{totalDelivered.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500">{totalOrders > 0 ? ((totalDelivered / totalOrders) * 100).toFixed(1) : 0}% success</span>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">Total RTO</span>
          <div className="text-lg font-black font-mono text-amber-400 mt-0.5">{totalRto.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500">{totalOrders > 0 ? ((totalRto / totalOrders) * 100).toFixed(1) : 0}% return rate</span>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-rose-400 tracking-wider">Cancelled</span>
          <div className="text-lg font-black font-mono text-rose-400 mt-0.5">{totalCancelled.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500">Pre-dispatch cancelled</span>
        </div>
      </div>

      {/* 2. Monthly Charts Grid (All 6 Required Charts with Jan-Dec XAxis) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Monthly Order Trend */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={13} className="text-purple-400" />
              1. Monthly Order Trend
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Jan → Dec</span>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as MonthlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                          <p className="text-purple-300 font-mono mt-0.5">
                            Total Orders: <span className="font-bold">{d.totalOrders.toLocaleString('en-IN')}</span>
                          </p>
                          {d.totalOrders === 0 && <p className="text-slate-500 text-[10px]">No orders in this month</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="totalOrders" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Monthly Revenue Trend (Gross Revenue) */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={13} className="text-emerald-400" />
              2. Monthly Revenue Trend (Gross Revenue)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Gross Order Value (₹)</span>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRecords} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as MonthlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                          <p className="text-emerald-400 font-mono mt-0.5">
                            Gross Revenue: <span className="font-bold">₹{d.grossOrderValue.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-slate-400 text-[10px] font-mono">Orders: {d.totalOrders}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="grossOrderValue" name="Gross Revenue (₹)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Monthly Net Sales Trend */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={13} className="text-cyan-400" />
              3. Monthly Net Sales Trend
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Excl. Cancellations (₹)</span>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRecords} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as MonthlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                          <p className="text-cyan-400 font-mono mt-0.5">
                            Net Sales: <span className="font-bold">₹{d.netSales.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-slate-400 text-[10px] font-mono">AOV: ₹{d.aov}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="netSales" name="Net Sales (₹)" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Monthly Units Sold */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Package size={13} className="text-cyan-400" />
              4. Monthly Units Sold
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Cumulative Items Sold</span>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as MonthlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                          <p className="text-cyan-300 font-mono mt-0.5">
                            Units Sold: <span className="font-bold">{d.unitsSold.toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="unitsSold" name="Units" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Delivered vs RTO vs Cancelled Orders */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-green-400" />
              5. Delivered vs RTO vs Cancelled Orders
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Fulfillment Outcomes</span>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as MonthlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                          <p className="text-green-400 font-mono">Delivered: {d.deliveredOrders.toLocaleString('en-IN')}</p>
                          <p className="text-amber-400 font-mono">RTO: {d.rtoOrders.toLocaleString('en-IN')}</p>
                          <p className="text-rose-400 font-mono">Cancelled: {d.cancelledOrders.toLocaleString('en-IN')}</p>
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

        {/* Chart 6: Monthly Repeat vs New Customer Trend */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users size={13} className="text-indigo-400" />
              6. Monthly Repeat vs New Customer Trend
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Buyer Retention & Cohorts</span>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRecords} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as MonthlyPerformanceRecord;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                          <p className="text-indigo-300 font-mono">Repeat Buyers: {d.repeatCustomers.toLocaleString('en-IN')}</p>
                          <p className="text-slate-400 font-mono">New Buyers: {d.newCustomers.toLocaleString('en-IN')}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="repeatCustomers" name="Repeat Buyers" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="newCustomers" name="New Buyers" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Monthly Performance Table (All 12 Calendar Months Jan-Dec) */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-purple-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              12-Month Calendar Performance Breakdown ({monthlyRecords[0]?.year || 'Full Year'})
            </h4>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">12 Calendar Months (Jan – Dec)</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3 min-w-[130px]">Month</th>
              <th className="py-2.5 px-3 text-right">Orders</th>
              <th className="py-2.5 px-3 text-right">Gross Value</th>
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
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {monthlyRecords.map((m) => {
              const hasOrders = m.totalOrders > 0;
              return (
                <tr
                  key={m.monthKey}
                  onClick={() => hasOrders && setSelectedMonth(m)}
                  className={`transition-colors ${hasOrders ? 'hover:bg-slate-900/60 cursor-pointer group' : 'opacity-60 bg-slate-950/20'}`}
                >
                  <td className="py-2.5 px-3 font-semibold text-white font-sans flex items-center gap-1.5">
                    <Calendar size={12} className={hasOrders ? 'text-purple-400' : 'text-slate-600'} />
                    <span>{m.monthLong}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">{m.totalOrders.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{m.grossOrderValue.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-cyan-400">₹{m.netSales.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{m.unitsSold.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{hasOrders ? `₹${m.aov}` : '—'}</td>
                  <td className="py-2.5 px-3 text-right text-green-400">{m.deliveredOrders}</td>
                  <td className="py-2.5 px-3 text-right text-green-400">₹{m.deliveredRevenue.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">{m.rtoOrders}</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">₹{m.rtoValue.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">{m.cancelledOrders}</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">₹{m.cancellationValue.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-indigo-300">{m.repeatCustomers}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{m.newCustomers}</td>
                  <td className="py-2.5 px-3 text-center">
                    {hasOrders ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewOrders) {
                            onViewOrders(`Orders for ${m.monthLong} ${m.year}`, m.matchingOrders);
                          } else {
                            setSelectedMonth(m);
                          }
                        }}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-slate-700 text-[10px] font-sans font-medium transition-colors"
                        title="Inspect Month Orders"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600 font-sans">0 orders</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Month Details Drilldown Card (if selected) */}
      {selectedMonth && (
        <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/50 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-purple-400" />
              <h4 className="text-sm font-bold text-white">
                Detailed Month Inspection: <span className="text-purple-300">{selectedMonth.monthLong} {selectedMonth.year}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {onViewOrders && (
                <button
                  type="button"
                  onClick={() => onViewOrders(`Orders for ${selectedMonth.monthLong} ${selectedMonth.year}`, selectedMonth.matchingOrders)}
                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                >
                  View All {selectedMonth.matchingOrders.length} Orders
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Total Orders</span>
              <div className="text-white font-mono font-bold">{selectedMonth.totalOrders}</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Net Sales</span>
              <div className="text-cyan-400 font-mono font-bold">₹{selectedMonth.netSales.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Delivered (Success %)</span>
              <div className="text-green-400 font-mono font-bold">
                {selectedMonth.deliveredOrders} ({selectedMonth.totalOrders > 0 ? ((selectedMonth.deliveredOrders / selectedMonth.totalOrders) * 100).toFixed(1) : 0}%)
              </div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold">RTO Rate</span>
              <div className="text-amber-400 font-mono font-bold">
                {selectedMonth.rtoOrders} ({selectedMonth.totalOrders > 0 ? ((selectedMonth.rtoOrders / selectedMonth.totalOrders) * 100).toFixed(1) : 0}%)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPerformanceTab;
