import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Clock, 
  Truck, 
  Layers, 
  Calendar, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { getCanonicalStatus, checkDeliverySla } from '../../utils/logisticsAnalyticsUtils';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../../config/courierConfig';
import { isDispatchedOrder } from '../../../../utils/logisticsOrderUtils';
import { parseAndFormatLogisticsDate } from '../../../../utils/logisticsDateUtils';

interface LogisticsWorkloadForecastSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
  onNavigateStage?: (stage: 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking') => void;
}

export const LogisticsWorkloadForecastSection: React.FC<LogisticsWorkloadForecastSectionProps> = ({
  orders,
  onDrillDown,
  onNavigateStage
}) => {
  // 1. Current Workload Metrics
  const workloadMetrics = useMemo(() => {
    let awaitingDispatch = 0;
    let readyForDispatch = 0;
    let inTransit = 0;
    let pendingTracking = 0;
    let openExceptions = 0;
    let expected1Day = 0;
    let expected3Days = 0;
    let expected7Days = 0;

    const today = new Date();
    const todayMs = today.getTime();
    const ms1Day = 1 * 24 * 60 * 60 * 1000;
    const ms3Days = 3 * 24 * 60 * 60 * 1000;
    const ms7Days = 7 * 24 * 60 * 60 * 1000;

    // Courier assignment workload
    const courierWorkloadMap = new Map<string, number>();
    CONFIGURED_COURIERS.forEach(c => courierWorkloadMap.set(c.name, 0));

    orders.forEach(o => {
      const canonical = getCanonicalStatus(o);
      const isDisp = isDispatchedOrder(o);

      if (o.workflowStage === 'active') {
        awaitingDispatch++;
      } else if (o.workflowStage === 'prepare_dispatch') {
        readyForDispatch++;
      }

      if (canonical === 'In Transit' || canonical === 'Out for Delivery') {
        inTransit++;
        const c = normalizeCourier(o.courier);
        if (c && courierWorkloadMap.has(c)) {
          courierWorkloadMap.set(c, courierWorkloadMap.get(c)! + 1);
        }

        // Expected deliveries based on estimatedDeliveryDate or dispatch age
        if (o.estimatedDeliveryDate) {
          const parsedEst = parseAndFormatLogisticsDate(o.estimatedDeliveryDate);
          if (parsedEst.isoDate) {
            const diff = new Date(parsedEst.isoDate).getTime() - todayMs;
            if (diff >= 0 && diff <= ms1Day) expected1Day++;
            if (diff >= 0 && diff <= ms3Days) expected3Days++;
            if (diff >= 0 && diff <= ms7Days) expected7Days++;
          }
        } else {
          // Fallback based on standard 3-4 day cycle
          const sla = checkDeliverySla(o);
          if (sla.ageDays >= 3) expected1Day++;
          if (sla.ageDays >= 1) expected3Days++;
          expected7Days++;
        }
      } else if (canonical === 'Pending Tracking Update') {
        pendingTracking++;
      } else if (canonical === 'Delayed / SLA Breached' || canonical === 'Shipment Exception' || canonical === 'Delivery Attempt Failed') {
        openExceptions++;
      }
    });

    const courierWorkload = Array.from(courierWorkloadMap.entries())
      .map(([name, count]) => ({ name, count }))
      .filter(item => item.count > 0);

    return {
      awaitingDispatch,
      readyForDispatch,
      inTransit,
      pendingTracking,
      openExceptions,
      expected1Day,
      expected3Days,
      expected7Days,
      courierWorkload
    };
  }, [orders]);

  // 2. Historical Daily Volume & Short-Term Run-Rate Forecast
  const { historicalTrend, forecastTrend, avgDailyRunRate } = useMemo(() => {
    const dailyMap = new Map<string, number>();

    orders.forEach(o => {
      const rawDate = o.dispatchDate || o.orderDate;
      if (!rawDate) return;
      const parsed = parseAndFormatLogisticsDate(rawDate);
      if (!parsed.isoDate) return;
      dailyMap.set(parsed.isoDate, (dailyMap.get(parsed.isoDate) || 0) + 1);
    });

    const sortedDates = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30);

    const historicalTrend = sortedDates.map(([date, count]) => ({
      date,
      actual: count,
      forecast: null
    }));

    // Calculate 7-day moving average run-rate for projection
    const last7Days = sortedDates.slice(-7);
    const avgDailyRunRate = last7Days.length > 0
      ? Math.round(last7Days.reduce((sum, item) => sum + item[1], 0) / last7Days.length)
      : Math.round(orders.length / 30);

    // Generate 7-day forward projection
    const forecastTrend: Array<{ date: string; actual: number | null; forecast: number }> = [];
    if (sortedDates.length > 0) {
      const lastDateStr = sortedDates[sortedDates.length - 1][0];
      const lastDate = new Date(lastDateStr);

      // Connect last actual to forecast line
      forecastTrend.push({
        date: lastDateStr,
        actual: sortedDates[sortedDates.length - 1][1],
        forecast: sortedDates[sortedDates.length - 1][1]
      });

      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000);
        const ymd = nextDate.toISOString().slice(0, 10);
        // Add subtle weekend variance factor
        const isWeekend = nextDate.getDay() === 0 || nextDate.getDay() === 6;
        const projected = Math.round(isWeekend ? avgDailyRunRate * 0.75 : avgDailyRunRate * 1.05);

        forecastTrend.push({
          date: ymd,
          actual: null,
          forecast: projected
        });
      }
    }

    return {
      historicalTrend,
      forecastTrend,
      avgDailyRunRate
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-cyan-400" />
            <span>Workload & Operational Forecasting</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time fulfillment queue capacity, upcoming arrival projections, and demand run-rate
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
          <Sparkles size={14} className="text-purple-400 shrink-0" />
          <span className="text-slate-300">
            Daily Run-Rate: <strong className="text-cyan-300 font-mono">~{avgDailyRunRate} orders/day</strong>
          </span>
        </div>
      </div>

      {/* WORKLOAD PIPELINE CARDS (6 TILES) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Unfulfilled Orders */}
        <div 
          onClick={() => onNavigateStage ? onNavigateStage('active') : onDrillDown('Unfulfilled Queue', 'Orders awaiting preparation', o => o.workflowStage === 'active')}
          className="bg-[#0b1220] border border-slate-800 hover:border-purple-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Awaiting Dispatch</span>
            <Clock size={13} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-300">
            {workloadMetrics.awaitingDispatch.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Pending allocation</p>
        </div>

        {/* Ready for Handover */}
        <div 
          onClick={() => onNavigateStage ? onNavigateStage('prepare_dispatch') : onDrillDown('Ready for Dispatch', 'Orders packed awaiting courier', o => o.workflowStage === 'prepare_dispatch')}
          className="bg-[#0b1220] border border-slate-800 hover:border-cyan-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Ready for Handover</span>
            <Layers size={13} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-400">
            {workloadMetrics.readyForDispatch.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Packed & grouped</p>
        </div>

        {/* In-Transit Active */}
        <div 
          onClick={() => onDrillDown('Active In-Transit', 'Shipments currently between hubs', o => getCanonicalStatus(o) === 'In Transit' || getCanonicalStatus(o) === 'Out for Delivery')}
          className="bg-[#0b1220] border border-slate-800 hover:border-blue-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>In-Transit Active</span>
            <Truck size={13} className="text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-400">
            {workloadMetrics.inTransit.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Moving in carrier network</p>
        </div>

        {/* Deliveries Due: Next 24h */}
        <div 
          onClick={() => onDrillDown('Expected Deliveries Next 24 Hours', 'Shipments estimated to arrive today/tomorrow', o => {
            const sla = checkDeliverySla(o);
            return !sla.isDelivered && (sla.isApproaching || sla.ageDays >= 3);
          })}
          className="bg-[#0b1220] border border-slate-800 hover:border-emerald-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Due in 24 Hours</span>
            <Calendar size={13} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            ~{workloadMetrics.expected1Day}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Expected today/tomorrow</p>
        </div>

        {/* Deliveries Due: Next 3 Days */}
        <div 
          onClick={() => onDrillDown('Expected Deliveries Next 3 Days', 'Shipments expected within 3 days', o => {
            const sla = checkDeliverySla(o);
            return !sla.isDelivered && isDispatchedOrder(o);
          })}
          className="bg-[#0b1220] border border-slate-800 hover:border-cyan-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Due in 3 Days</span>
            <Calendar size={13} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            ~{workloadMetrics.expected3Days}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Near-term deliveries</p>
        </div>

        {/* Open Shipment Exceptions */}
        <div 
          onClick={() => onDrillDown('Open Exceptions & Delays', 'Shipments requiring operator action', o => {
            const st = getCanonicalStatus(o);
            return st === 'Delayed / SLA Breached' || st === 'Shipment Exception' || st === 'Delivery Attempt Failed';
          })}
          className="bg-[#0b1220] border border-slate-800 hover:border-rose-600/50 rounded-2xl p-3.5 cursor-pointer transition-all group"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Open Exceptions</span>
            <AlertTriangle size={13} className="text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {workloadMetrics.openExceptions}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Requires review/action</p>
        </div>

      </div>

      {/* FORECASTING CHART & COURIER WORKLOAD DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* CHART: Historical Daily Volume & Forward Projection (2 Columns) */}
        <div className="lg:col-span-2 bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span>Historical Volume & 7-Day Forward Demand Projection</span>
              </h4>
              <p className="text-xs text-slate-400">
                Solid line: Actual dispatches | Dashed line: Projected run-rate forecast
              </p>
            </div>

            <div className="text-[11px] font-mono text-slate-400 bg-[#0e1626] border border-slate-800 px-2.5 py-1 rounded-lg">
              Method: 7-Day Moving Average
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  data={historicalTrend}
                  type="monotone"
                  dataKey="actual"
                  name="Actual Historical Orders"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  data={forecastTrend}
                  type="monotone"
                  dataKey="forecast"
                  name="Projected Forecast"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#8b5cf6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
            <Info size={13} className="text-cyan-400 shrink-0" />
            <span>
              <strong>Forecasting Methodology:</strong> Baseline calculated from historical daily order intake and dispatch rate over the prior 7 active operating days, adjusted for weekend fulfillment cycles.
            </span>
          </div>
        </div>

        {/* COURIER WORKLOAD DISTRIBUTION (1 Column) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-cyan-400" />
                <span>Active Courier Network Load</span>
              </h4>
              <p className="text-[11px] text-slate-400">Active shipments currently held per carrier</p>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-64 pr-1 custom-scrollbar">
            {workloadMetrics.courierWorkload.length === 0 ? (
              <div className="text-xs text-slate-500 py-10 text-center">No shipments currently in-transit with couriers</div>
            ) : (
              workloadMetrics.courierWorkload.map(c => {
                const pct = workloadMetrics.inTransit > 0 ? Math.round((c.count / workloadMetrics.inTransit) * 100) : 0;
                return (
                  <div key={c.name} className="bg-[#0e1626] border border-slate-800/80 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-200">{c.name}</span>
                      <span className="font-mono font-bold text-cyan-400">{c.count} active ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
