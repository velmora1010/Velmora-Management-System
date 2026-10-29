import React, { useMemo } from 'react';
import { 
  Clock, 
  CheckCheck, 
  AlertTriangle, 
  Hourglass, 
  Timer, 
  Truck, 
  MapPin, 
  CalendarClock, 
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  checkDeliverySla, 
  getCanonicalStatus, 
  getShipmentAgeBucket 
} from '../../utils/logisticsAnalyticsUtils';
import { normalizeCourier } from '../../../../config/courierConfig';
import { normalizeState, resolveCustomerLocationDisplay } from '../../../../utils/logisticsOrderUtils';

interface DeliverySlaSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

export const DeliverySlaSection: React.FC<DeliverySlaSectionProps> = ({
  orders,
  onDrillDown
}) => {
  // Compute SLA stats, median, age buckets, and courier/location delivery times
  const slaStats = useMemo(() => {
    let onTimeCount = 0;
    let lateCount = 0;
    let approachingCount = 0;
    let overdueCount = 0;
    const deliveryDaysList: number[] = [];

    // Age buckets for in-transit / active dispatches
    const ageBuckets = {
      '0–1': 0,
      '2–3': 0,
      '4–7': 0,
      '8–14': 0,
      '15+': 0
    };

    // Courier delivery times
    const courierTimesMap = new Map<string, { totalDays: number; count: number }>();
    // State delivery times
    const stateTimesMap = new Map<string, { totalDays: number; count: number }>();

    orders.forEach(o => {
      const sla = checkDeliverySla(o);
      const canonical = getCanonicalStatus(o);

      if (sla.isDelivered) {
        if (sla.isOnTime) onTimeCount++;
        if (sla.isLate) lateCount++;
        if (sla.deliveryDays !== null && sla.deliveryDays >= 0) {
          deliveryDaysList.push(sla.deliveryDays);

          // Courier avg
          const c = normalizeCourier(o.courier) || 'Unassigned';
          if (!courierTimesMap.has(c)) courierTimesMap.set(c, { totalDays: 0, count: 0 });
          const cData = courierTimesMap.get(c)!;
          cData.totalDays += sla.deliveryDays;
          cData.count++;

          // State avg
          const st = normalizeState(o.state) || 'Other';
          if (!stateTimesMap.has(st)) stateTimesMap.set(st, { totalDays: 0, count: 0 });
          const stData = stateTimesMap.get(st)!;
          stData.totalDays += sla.deliveryDays;
          stData.count++;
        }
      } else {
        if (sla.isApproaching) approachingCount++;
        if (sla.isOverdue) overdueCount++;
        if (canonical === 'In Transit' || canonical === 'Out for Delivery' || canonical === 'Pending Tracking Update') {
          const b = getShipmentAgeBucket(sla.ageDays);
          ageBuckets[b]++;
        }
      }
    });

    // Average & Median delivery time
    deliveryDaysList.sort((a, b) => a - b);
    const avgDeliveryDays = deliveryDaysList.length > 0
      ? (deliveryDaysList.reduce((sum, d) => sum + d, 0) / deliveryDaysList.length).toFixed(1)
      : null;

    let medianDeliveryDays: number | null = null;
    if (deliveryDaysList.length > 0) {
      const mid = Math.floor(deliveryDaysList.length / 2);
      medianDeliveryDays = deliveryDaysList.length % 2 !== 0
        ? deliveryDaysList[mid]
        : Math.round((deliveryDaysList[mid - 1] + deliveryDaysList[mid]) / 2);
    }

    const ageBucketChartData = [
      { bucket: '0–1 Days', count: ageBuckets['0–1'], color: '#10b981' },
      { bucket: '2–3 Days', count: ageBuckets['2–3'], color: '#06b6d4' },
      { bucket: '4–7 Days', count: ageBuckets['4–7'], color: '#f59e0b' },
      { bucket: '8–14 Days', count: ageBuckets['8–14'], color: '#f97316' },
      { bucket: '15+ Days', count: ageBuckets['15+'], color: '#f43f5e' }
    ];

    const courierDeliverySpeeds = Array.from(courierTimesMap.entries())
      .map(([name, data]) => ({
        name,
        avgDays: parseFloat((data.totalDays / data.count).toFixed(1)),
        count: data.count
      }))
      .filter(item => item.count >= 3)
      .sort((a, b) => a.avgDays - b.avgDays);

    const stateDeliverySpeeds = Array.from(stateTimesMap.entries())
      .map(([name, data]) => ({
        name,
        avgDays: parseFloat((data.totalDays / data.count).toFixed(1)),
        count: data.count
      }))
      .filter(item => item.count >= 5 && item.name !== 'Other')
      .sort((a, b) => a.avgDays - b.avgDays)
      .slice(0, 8);

    return {
      onTimeCount,
      lateCount,
      approachingCount,
      overdueCount,
      avgDeliveryDays,
      medianDeliveryDays,
      ageBucketChartData,
      courierDeliverySpeeds,
      stateDeliverySpeeds
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-cyan-400" />
            <span>Delivery SLA & Delay Analytics</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            On-time delivery benchmarks, overdue transit monitoring, and age distribution
          </p>
        </div>

        {/* View Delayed Orders Action */}
        <button
          type="button"
          onClick={() => onDrillDown(
            'Delayed & Overdue Orders',
            'Shipments that breached SLA or are overdue for delivery',
            o => {
              const sla = checkDeliverySla(o);
              return sla.isLate || sla.isOverdue;
            }
          )}
          className="px-4 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 hover:text-white border border-yellow-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <AlertTriangle size={14} className="text-yellow-400" />
          <span>View Delayed Orders ({slaStats.lateCount + slaStats.overdueCount})</span>
        </button>
      </div>

      {/* TOP SLA METRIC TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        
        {/* On-Time Deliveries */}
        <div 
          onClick={() => onDrillDown(
            'On-Time Deliveries',
            'Orders delivered on or before promised SLA',
            o => checkDeliverySla(o).isOnTime
          )}
          className="bg-[#0b1220] border border-slate-800 hover:border-emerald-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>On-Time</span>
            <CheckCheck size={14} className="text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {slaStats.onTimeCount.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Within delivery SLA</p>
        </div>

        {/* Late Deliveries */}
        <div 
          onClick={() => onDrillDown(
            'Late Deliveries',
            'Orders delivered after promised SLA',
            o => checkDeliverySla(o).isLate
          )}
          className="bg-[#0b1220] border border-slate-800 hover:border-rose-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>Late Delivered</span>
            <AlertTriangle size={14} className="text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            {slaStats.lateCount.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Delivered past deadline</p>
        </div>

        {/* Approaching SLA */}
        <div 
          onClick={() => onDrillDown(
            'Orders Approaching SLA',
            'In-transit orders within 24-48 hours of estimated delivery',
            o => checkDeliverySla(o).isApproaching
          )}
          className="bg-[#0b1220] border border-slate-800 hover:border-cyan-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>Approaching SLA</span>
            <Hourglass size={14} className="text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300">
            {slaStats.approachingCount.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Due within 48 hours</p>
        </div>

        {/* Overdue for Delivery */}
        <div 
          onClick={() => onDrillDown(
            'Overdue Deliveries',
            'In-transit orders overdue for delivery',
            o => checkDeliverySla(o).isOverdue
          )}
          className="bg-[#0b1220] border border-slate-800 hover:border-yellow-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>Overdue Transit</span>
            <CalendarClock size={14} className="text-yellow-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-yellow-400">
            {slaStats.overdueCount.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Breached expected date</p>
        </div>

        {/* Average Delivery Time */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>Avg Delivery Time</span>
            <Timer size={14} className="text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            {slaStats.avgDeliveryDays ? `${slaStats.avgDeliveryDays}d` : '—'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Dispatch to doorstep</p>
        </div>

        {/* Median Delivery Time */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>Median Transit</span>
            <Timer size={14} className="text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-purple-300">
            {slaStats.medianDeliveryDays !== null ? `${slaStats.medianDeliveryDays}d` : '—'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">50th percentile delivery</p>
        </div>

      </div>

      {/* CHARTS: SHIPMENT AGE BUCKETS & SPEED BY COURIER / STATE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* CHART 1: Shipment Age Buckets (In-Transit Orders) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Hourglass size={14} className="text-cyan-400" />
                <span>Shipment Age Buckets</span>
              </h4>
              <p className="text-[11px] text-slate-400">Current age of active/in-transit shipments</p>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slaStats.ageBucketChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="bucket" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} shipments`, 'Volume']}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => {
                    if (entry && entry.bucket) {
                      onDrillDown(
                        `Shipments Aged ${entry.bucket}`,
                        `In-transit orders in age bracket ${entry.bucket}`,
                        o => {
                          const sla = checkDeliverySla(o);
                          return !sla.isDelivered && getShipmentAgeBucket(sla.ageDays) === entry.bucket.replace(' Days', '') as any;
                        }
                      );
                    }
                  }}
                >
                  {slaStats.ageBucketChartData.map((e, idx) => (
                    <Cell key={`age-${idx}`} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Delivery Speed by Courier Partner */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-purple-400" />
                <span>Avg Delivery Days by Courier</span>
              </h4>
              <p className="text-[11px] text-slate-400">Average transit speed per partner</p>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
            {slaStats.courierDeliverySpeeds.length === 0 ? (
              <div className="text-xs text-slate-500 py-10 text-center">No delivered shipments with transit timestamps</div>
            ) : (
              slaStats.courierDeliverySpeeds.map(c => (
                <div key={c.name} className="bg-[#0e1626] border border-slate-800/80 rounded-xl p-2.5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200">{c.name}</span>
                    <span className="font-mono font-bold text-cyan-300">{c.avgDays} days</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-cyan-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (c.avgDays / 7) * 100)}%` }} 
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">{c.count} deliveries analyzed</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CHART 3: Delivery Speed by Top States */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-400" />
                <span>Fastest Destination States</span>
              </h4>
              <p className="text-[11px] text-slate-400">States with lowest transit turnaround</p>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
            {slaStats.stateDeliverySpeeds.length === 0 ? (
              <div className="text-xs text-slate-500 py-10 text-center">No state delivery records available</div>
            ) : (
              slaStats.stateDeliverySpeeds.map(st => (
                <div key={st.name} className="bg-[#0e1626] border border-slate-800/80 rounded-xl p-2.5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200">{st.name}</span>
                    <span className="font-mono font-bold text-emerald-400">{st.avgDays} days</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (st.avgDays / 7) * 100)}%` }} 
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">{st.count} completed deliveries</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
