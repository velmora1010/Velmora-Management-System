import React, { useState, useMemo } from 'react';
import {
  Truck,
  PackageCheck,
  RotateCcw,
  Clock,
  AlertTriangle,
  Search,
  X,
  ExternalLink,
  ChevronDown,
  Calendar,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  TrendingUp,
  ArrowUpDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import type { WebsiteConsolidatedOrder } from '../types';
import type { OperationalOrderRecord } from './AnalyticsFullPageDataView';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../../config/courierConfig';

interface OperationsForecastingSectionProps {
  orders: WebsiteConsolidatedOrder[];
  trackingShipments?: any[];
  onViewAllOperations?: (title: string, records: OperationalOrderRecord[]) => void;
  highlighted?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  'Delivered': '#10b981',
  'Out for Delivery': '#06b6d4',
  'In Transit': '#3b82f6',
  'Dispatched': '#6366f1',
  'Ready for dispatch': '#8b5cf6',
  'Awaiting Tracking Update': '#f59e0b',
  'Failed Attempt': '#ea580c',
  'RTO Initiated': '#f43f5e',
  'RTO Delivered': '#e11d48',
  'Exception': '#ef4444'
};

export const OperationsForecastingSection: React.FC<OperationsForecastingSectionProps> = ({
  orders,
  trackingShipments = [],
  onViewAllOperations,
  highlighted = false
}) => {
  const [courierFilter, setCourierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<'orderId' | 'orderDate' | 'courier' | 'shipmentStatus'>('orderDate');
  const [sortAsc, setSortAsc] = useState(false);

  // 1. Map orders & tracking shipments into canonical Operational Records
  const operationalRecords: OperationalOrderRecord[] = useMemo(() => {
    // Index tracking shipments by clean order ID
    const shipmentMap = new Map<string, any>();
    trackingShipments.forEach(s => {
      const oid = String(s.order_id || s.display_order_id || '').replace(/^[#]/, '').trim().toLowerCase();
      if (oid) shipmentMap.set(oid, s);
    });

    return orders.map(o => {
      const cleanOid = String(o.order_id).replace(/^[#]/, '').trim().toLowerCase();
      const ship = shipmentMap.get(cleanOid);

      const awb = ship?.awb_number || o.awb_number || '';
      const courier = ship?.courier || o.courier || (awb ? 'ST Courier' : 'Pending Courier Assignment');

      // Determine realistic operational shipment status
      let shipmentStatus = 'Ready for dispatch';
      const fStatus = (o.fulfillment_status || '').toLowerCase();
      const shipStatus = (ship?.status || '').toLowerCase();

      if (ship?.status) {
        shipmentStatus = ship.status;
      } else if (fStatus === 'fulfilled' || fStatus === 'delivered' || fStatus === 'shipped') {
        shipmentStatus = 'Delivered';
      } else if (awb) {
        shipmentStatus = 'Awaiting Tracking Update';
      } else if (fStatus === 'unfulfilled' || !fStatus) {
        shipmentStatus = 'Ready for dispatch';
      }

      // Check RTO
      const isRto =
        shipStatus.includes('rto') ||
        shipStatus.includes('return') ||
        shipmentStatus.toLowerCase().includes('rto');
      const rtoStatus = isRto ? (ship?.raw_status || 'RTO') : '';

      // Exception Reason
      const exceptionReason = ship?.sync_error || ship?.remarks || (isRto ? 'RTO Reported by Courier' : '');

      // Delivery attempts
      const deliveryAttempts = ship?.delivery_attempts || (shipStatus.includes('failed') ? 1 : 0);

      // Dates
      const dispatchDate = ship?.dispatch_date || o.fulfilled_date || '';
      const deliveryDate = ship?.delivered_date || (shipmentStatus === 'Delivered' ? (o.fulfilled_date || o.order_date) : '');

      return {
        orderId: o.order_id,
        orderDate: o.order_date,
        courier,
        awbNumber: awb,
        shipmentStatus,
        deliveryAttempts,
        rtoStatus,
        exceptionReason,
        dispatchDate,
        deliveryDate,
        customerName: o.customer_name,
        phone: o.phone,
        state: o.canonicalState || o.state,
        city: o.canonicalCity || o.city,
        pincode: o.canonicalPincode || o.pincode,
        productName: o.product_name,
        orderFormatted: o.order_formatted,
        totalQuantity: o.total_quantity,
        orderValue: o.price,
        paymentMode: o.payment_mode
      };
    });
  }, [orders, trackingShipments]);

  // 2. High-Level KPI Summary
  const kpis = useMemo(() => {
    const totalOrders = operationalRecords.length;
    let delivered = 0;
    let rto = 0;
    let failedAttempts = 0;
    let pending = 0;
    let awaitingUpdate = 0;
    let deliveryDaysSum = 0;
    let deliveryDaysCount = 0;

    operationalRecords.forEach(rec => {
      const st = rec.shipmentStatus.toLowerCase();
      if (st === 'delivered') {
        delivered++;
        if (rec.dispatchDate && rec.deliveryDate) {
          const d1 = new Date(rec.dispatchDate).getTime();
          const d2 = new Date(rec.deliveryDate).getTime();
          const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (days >= 0 && days <= 30) {
            deliveryDaysSum += days;
            deliveryDaysCount++;
          }
        }
      } else if (st.includes('rto') || rec.rtoStatus) {
        rto++;
      } else if (st === 'awaiting tracking update' || st === 'info received') {
        awaitingUpdate++;
        pending++;
      } else if (st === 'in transit' || st === 'out for delivery' || st === 'ready for dispatch') {
        pending++;
      }

      if (rec.deliveryAttempts > 0) {
        failedAttempts += rec.deliveryAttempts;
      }
    });

    const rtoRate = totalOrders > 0 ? ((rto / totalOrders) * 100).toFixed(1) : '0.0';
    const avgDeliveryTime = deliveryDaysCount > 0 ? (deliveryDaysSum / deliveryDaysCount).toFixed(1) : '—';

    return {
      totalOrders,
      delivered,
      rto,
      rtoRate,
      failedAttempts,
      pending,
      awaitingUpdate,
      avgDeliveryTime
    };
  }, [operationalRecords]);

  // 3. Courier Performance Breakdown
  const courierPerformance = useMemo(() => {
    const map = new Map<string, {
      name: string;
      total: number;
      delivered: number;
      rto: number;
      deliveryDaysSum: number;
      deliveryDaysCount: number;
    }>();

    operationalRecords.forEach(rec => {
      const cName = rec.courier || 'Pending Courier Assignment';
      if (!map.has(cName)) {
        map.set(cName, {
          name: cName,
          total: 0,
          delivered: 0,
          rto: 0,
          deliveryDaysSum: 0,
          deliveryDaysCount: 0
        });
      }
      const entry = map.get(cName)!;
      entry.total++;
      const st = rec.shipmentStatus.toLowerCase();
      if (st === 'delivered') {
        entry.delivered++;
        if (rec.dispatchDate && rec.deliveryDate) {
          const d1 = new Date(rec.dispatchDate).getTime();
          const d2 = new Date(rec.deliveryDate).getTime();
          const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (days >= 0 && days <= 30) {
            entry.deliveryDaysSum += days;
            entry.deliveryDaysCount++;
          }
        }
      } else if (st.includes('rto') || rec.rtoStatus) {
        entry.rto++;
      }
    });

    return Array.from(map.values()).map(c => {
      const successRate = c.total > 0 ? ((c.delivered / c.total) * 100).toFixed(1) : '0.0';
      const rtoRate = c.total > 0 ? ((c.rto / c.total) * 100).toFixed(1) : '0.0';
      const avgDays = c.deliveryDaysCount > 0 ? (c.deliveryDaysSum / c.deliveryDaysCount).toFixed(1) : '—';
      return {
        ...c,
        successRate,
        rtoRate,
        avgDays
      };
    }).sort((a, b) => b.total - a.total);
  }, [operationalRecords]);

  // 4. Shipment Status Distribution for Chart
  const statusDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    operationalRecords.forEach(r => {
      const st = r.shipmentStatus || 'Ready for dispatch';
      counts[st] = (counts[st] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      color: STATUS_COLORS[name] || '#64748b'
    })).sort((a, b) => b.count - a.count);
  }, [operationalRecords]);

  // 5. Daily Trend (Orders vs Delivered vs RTO)
  const dailyTrendData = useMemo(() => {
    const dateMap = new Map<string, { date: string; orders: number; delivered: number; rto: number }>();

    operationalRecords.forEach(r => {
      const d = (r.orderDate || '').slice(0, 10);
      if (!d) return;
      if (!dateMap.has(d)) {
        dateMap.set(d, { date: d, orders: 0, delivered: 0, rto: 0 });
      }
      const entry = dateMap.get(d)!;
      entry.orders++;
      const st = r.shipmentStatus.toLowerCase();
      if (st === 'delivered') entry.delivered++;
      if (st.includes('rto') || r.rtoStatus) entry.rto++;
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [operationalRecords]);

  // 6. Workload Forecasting (7 & 30 Days)
  const forecasting = useMemo(() => {
    const uniqueDates = Array.from(new Set(orders.map(o => o.order_date).filter(Boolean)));
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);

    if (uniqueDates.length < 3 || totalOrders === 0) {
      return {
        isSufficient: false,
        reason: 'Insufficient historical order days (< 3 days). Please expand your date range (e.g. 7 Days, 30 Days) to generate predictive projections.'
      };
    }

    const daysCount = uniqueDates.length;
    const dailyOrderVelocity = totalOrders / daysCount;
    const dailyRevenueVelocity = totalRevenue / daysCount;

    // Delivery rate from historical sample
    const deliveredCount = operationalRecords.filter(r => r.shipmentStatus === 'Delivered').length;
    const deliveryRate = totalOrders > 0 ? deliveredCount / totalOrders : 0.8;

    const forecast7DaysOrders = Math.round(dailyOrderVelocity * 7);
    const forecast30DaysOrders = Math.round(dailyOrderVelocity * 30);
    const forecast7DaysRevenue = Math.round(dailyRevenueVelocity * 7);
    const forecast30DaysRevenue = Math.round(dailyRevenueVelocity * 30);
    const expectedDeliveries7Days = Math.round(forecast7DaysOrders * deliveryRate);
    const expectedDeliveries30Days = Math.round(forecast30DaysOrders * deliveryRate);

    return {
      isSufficient: true,
      activeDays: daysCount,
      dailyVelocity: dailyOrderVelocity.toFixed(1),
      dailyRevenue: Math.round(dailyRevenueVelocity),
      forecast7DaysOrders,
      forecast30DaysOrders,
      forecast7DaysRevenue,
      forecast30DaysRevenue,
      expectedDeliveries7Days,
      expectedDeliveries30Days,
      deliveryRatePercent: (deliveryRate * 100).toFixed(1),
      method: 'Historical Daily Moving Run-Rate Model'
    };
  }, [orders, operationalRecords]);

  // 7. Filtered Table Preview
  const filteredOperations = useMemo(() => {
    let list = [...operationalRecords];

    if (courierFilter !== 'ALL') {
      list = list.filter(r => r.courier === courierFilter);
    }

    if (statusFilter !== 'ALL') {
      list = list.filter(r => r.shipmentStatus === statusFilter);
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(r => {
        return (
          r.orderId.toLowerCase().includes(q) ||
          r.awbNumber.toLowerCase().includes(q) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          r.courier.toLowerCase().includes(q) ||
          r.shipmentStatus.toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [operationalRecords, courierFilter, statusFilter, tableSearch, sortField, sortAsc]);

  const previewList = filteredOperations.slice(0, 6);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div
      id="analytics-operations-forecasting"
      className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-5 transition-all duration-300 ${
        highlighted ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Truck size={18} className="text-emerald-400" />
          <span>Operations & Forecasting</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Fulfilment & Projections
          </span>
        </div>
        <div className="text-xs text-slate-400">
          Tracking courier performance, delivery exceptions & operational demand
        </div>
      </div>

      {/* 1. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fulfilment Queue</span>
          <span className="text-base font-mono font-black text-white">{kpis.totalOrders.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Total orders</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Delivered</span>
          <span className="text-base font-mono font-black text-emerald-400">{kpis.delivered.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Completed</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">RTO Orders</span>
          <span className="text-base font-mono font-black text-rose-400">{kpis.rto.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Returns</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">RTO Rate</span>
          <span className="text-base font-mono font-black text-rose-300">{kpis.rtoRate}%</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Return ratio</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Failed Attempts</span>
          <span className="text-base font-mono font-black text-amber-400">{kpis.failedAttempts}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Exceptions</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Pending Shipments</span>
          <span className="text-base font-mono font-black text-cyan-300">{kpis.pending.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">In transit/prep</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Avg Delivery Time</span>
          <span className="text-base font-mono font-black text-purple-300">
            {kpis.avgDeliveryTime !== '—' ? `${kpis.avgDeliveryTime}d` : '—'}
          </span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Transit duration</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Awaiting Updates</span>
          <span className="text-base font-mono font-black text-blue-300">{kpis.awaitingUpdate}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Pending scan</span>
        </div>
      </div>

      {/* 2. Charts Row: Daily Trend & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily RTO & Delivery Trend */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Fulfilment & Delivery Trend</h4>
            <span className="text-[10px] text-slate-400 font-mono">Daily volume breakdown</span>
          </div>

          <div className="h-52 w-full pt-2">
            {dailyTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No daily operational trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                            <div className="font-bold text-white font-mono">{d.date}</div>
                            <div className="text-purple-300 font-mono">Total Orders: <b>{d.orders}</b></div>
                            <div className="text-emerald-400 font-mono">Delivered: <b>{d.delivered}</b></div>
                            <div className="text-rose-400 font-mono">RTO / Returned: <b>{d.rto}</b></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#8b5cf6" fill="url(#orderGrad)" strokeWidth={2} name="Orders" />
                  <Area type="monotone" dataKey="delivered" stroke="#10b981" fill="url(#delGrad)" strokeWidth={2} name="Delivered" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Shipment Status Distribution */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Shipment Status Breakdown</h4>
            <span className="text-[10px] text-slate-400 font-mono">Current stage split</span>
          </div>

          <div className="space-y-2 pt-1">
            {statusDistributionData.map(item => {
              const pct = kpis.totalOrders > 0 ? ((item.count / kpis.totalOrders) * 100).toFixed(1) : '0';
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </span>
                    <span className="font-mono text-slate-400">
                      <b className="text-white">{item.count.toLocaleString()}</b> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Courier Performance Table */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Courier Partner Performance</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300 whitespace-nowrap">
            <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Courier Partner</th>
                <th className="py-2.5 px-3 text-center">Total Shipments</th>
                <th className="py-2.5 px-3 text-center">Delivered</th>
                <th className="py-2.5 px-3 text-center">RTO Count</th>
                <th className="py-2.5 px-3 text-center">Delivery Success %</th>
                <th className="py-2.5 px-3 text-center">RTO Rate %</th>
                <th className="py-2.5 px-3 text-center">Avg Delivery Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {courierPerformance.map(c => (
                <tr key={c.name} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                  <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                    <Truck size={13} className="text-indigo-400" />
                    <span>{c.name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-white">{c.total}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-400">{c.delivered}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-400">{c.rto}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-300">{c.successRate}%</td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-300">{c.rtoRate}%</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">{c.avgDays !== '—' ? `${c.avgDays}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Workload Forecasting Card (Next 7 & 30 Days) */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 border border-indigo-900/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-900/40 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Operational Workload Projections (Forecast)
            </h4>
          </div>
          {forecasting.isSufficient && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {forecasting.method} ({forecasting.activeDays} days analyzed)
            </span>
          )}
        </div>

        {!forecasting.isSufficient ? (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
            <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-300">Predictive Forecasting Requires Historical Range</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{forecasting.reason}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Next 7 Days Orders</span>
                <span className="text-base font-mono font-black text-cyan-300">~{forecasting.forecast7DaysOrders?.toLocaleString()}</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Expected order intake</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Next 7 Days Revenue</span>
                <span className="text-base font-mono font-black text-emerald-400">~₹{forecasting.forecast7DaysRevenue?.toLocaleString('en-IN')}</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Projected revenue</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Next 30 Days Orders</span>
                <span className="text-base font-mono font-black text-purple-300">~{forecasting.forecast30DaysOrders?.toLocaleString()}</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Monthly workload</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Next 30 Days Revenue</span>
                <span className="text-base font-mono font-black text-emerald-400">~₹{forecasting.forecast30DaysRevenue?.toLocaleString('en-IN')}</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Monthly projected revenue</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic">
              * Projections are calculated using the active velocity of {forecasting.dailyVelocity} orders/day (₹{forecasting.dailyRevenue?.toLocaleString('en-IN')}/day) across {forecasting.activeDays} distinct order days. Forecasted values are statistical estimates for operational and courier capacity planning.
            </p>
          </div>
        )}
      </div>

      {/* 5. Operations Table Preview */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Operational Orders & Shipments</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {filteredOperations.length} Records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] max-w-[240px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search Order, AWB, Courier..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-6 py-1 text-[11px] text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
              {tableSearch && (
                <button onClick={() => setTableSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              value={courierFilter}
              onChange={e => setCourierFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Couriers</option>
              {courierPerformance.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            {onViewAllOperations && (
              <button
                onClick={() => onViewAllOperations('Operations & Shipment Tracking', filteredOperations)}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>View All ({filteredOperations.length})</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>

        {filteredOperations.length === 0 ? (
          <div className="py-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No operational records match the active filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th onClick={() => toggleSort('orderId')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                    <div className="flex items-center gap-1">Order ID <ArrowUpDown size={11} /></div>
                  </th>
                  <th onClick={() => toggleSort('orderDate')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                    <div className="flex items-center gap-1">Order Date <ArrowUpDown size={11} /></div>
                  </th>
                  <th onClick={() => toggleSort('courier')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                    <div className="flex items-center gap-1">Courier <ArrowUpDown size={11} /></div>
                  </th>
                  <th className="py-2.5 px-3">AWB / Tracking Number</th>
                  <th onClick={() => toggleSort('shipmentStatus')} className="py-2.5 px-3 text-center cursor-pointer hover:text-white">
                    <div className="flex items-center justify-center gap-1">Shipment Status <ArrowUpDown size={11} /></div>
                  </th>
                  <th className="py-2.5 px-3 text-center">Attempts</th>
                  <th className="py-2.5 px-3 text-center">RTO Status</th>
                  <th className="py-2.5 px-3">Exception Reason</th>
                  <th className="py-2.5 px-3">Dispatch Date</th>
                  <th className="py-2.5 px-3">Delivery Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {previewList.map((rec, idx) => (
                  <tr key={rec.orderId || idx} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">#{rec.orderId}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{rec.orderDate || '—'}</td>
                    <td className="py-2.5 px-3 font-medium text-white">{rec.courier}</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300">{rec.awbNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        rec.shipmentStatus === 'Delivered' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        rec.shipmentStatus === 'In Transit' || rec.shipmentStatus === 'Out for Delivery' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                        rec.shipmentStatus.includes('RTO') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                        'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {rec.shipmentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">{rec.deliveryAttempts || 0}</td>
                    <td className="py-2.5 px-3 text-center">
                      {rec.rtoStatus ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {rec.rtoStatus}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate" title={rec.exceptionReason}>
                      {rec.exceptionReason || 'None'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{rec.dispatchDate || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{rec.deliveryDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredOperations.length > 6 && onViewAllOperations && (
          <div className="pt-1 text-center">
            <button
              onClick={() => onViewAllOperations('Operations & Shipment Tracking', filteredOperations)}
              className="px-4 py-1.5 bg-slate-950 hover:bg-slate-800 text-emerald-300 font-bold text-[11px] rounded-lg border border-slate-800 transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>View All {filteredOperations.length} Operational Orders in Full Page Table</span>
              <ExternalLink size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
