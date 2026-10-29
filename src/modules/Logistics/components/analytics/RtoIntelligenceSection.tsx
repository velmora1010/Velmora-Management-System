import React, { useMemo, useState } from 'react';
import { 
  ShieldAlert, 
  RotateCcw, 
  Truck, 
  MapPin, 
  IndianRupee, 
  AlertTriangle, 
  CreditCard, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Users, 
  ArrowRight,
  Info,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  PieChart, 
  Pie, 
  Legend, 
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  formatINR, 
  isCodOrder 
} from '../../utils/logisticsAnalyticsUtils';
import { normalizeCourier } from '../../../../config/courierConfig';
import { normalizeState, resolveCustomerLocationDisplay, parseOrderAmount } from '../../../../utils/logisticsOrderUtils';
import { parseAndFormatLogisticsDate } from '../../../../utils/logisticsDateUtils';

interface RtoIntelligenceSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

export const RtoIntelligenceSection: React.FC<RtoIntelligenceSectionProps> = ({
  orders,
  onDrillDown
}) => {
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'week' | 'month'>('day');

  // 1. Core RTO Metrics & Lifecycle Separation
  const rtoMetrics = useMemo(() => {
    let rtoInitiated = 0;
    let rtoInTransit = 0;
    let rtoDeliveredToSeller = 0;
    let rtoVal = 0;
    let deliveredCount = 0;

    let codRtoCount = 0;
    let codRtoVal = 0;
    let prepaidRtoCount = 0;
    let prepaidRtoVal = 0;

    const rtoOrders: UnifiedLogisticsOrder[] = [];

    orders.forEach(o => {
      const canonical = getCanonicalStatus(o);
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
      const isCod = isCodOrder(o);

      if (canonical === 'Delivered') {
        deliveredCount++;
      } else if (canonical === 'RTO Initiated') {
        rtoInitiated++;
        rtoVal += amt;
        rtoOrders.push(o);
        if (isCod) { codRtoCount++; codRtoVal += amt; } else { prepaidRtoCount++; prepaidRtoVal += amt; }
      } else if (canonical === 'RTO In Transit') {
        rtoInTransit++;
        rtoVal += amt;
        rtoOrders.push(o);
        if (isCod) { codRtoCount++; codRtoVal += amt; } else { prepaidRtoCount++; prepaidRtoVal += amt; }
      } else if (canonical === 'RTO Delivered to Seller') {
        rtoDeliveredToSeller++;
        rtoVal += amt;
        rtoOrders.push(o);
        if (isCod) { codRtoCount++; codRtoVal += amt; } else { prepaidRtoCount++; prepaidRtoVal += amt; }
      }
    });

    const totalRto = rtoInitiated + rtoInTransit + rtoDeliveredToSeller;
    const concluded = deliveredCount + totalRto;
    
    // Documented Denominator: RTO Rate = RTO / (Delivered + RTO)
    const rtoRate = concluded > 0 ? ((totalRto / concluded) * 100).toFixed(1) : '0.0';

    return {
      totalRto,
      rtoRate,
      rtoVal,
      rtoInitiated,
      rtoInTransit,
      rtoDeliveredToSeller,
      deliveredCount,
      concluded,
      codRtoCount,
      codRtoVal,
      prepaidRtoCount,
      prepaidRtoVal,
      rtoOrders
    };
  }, [orders]);

  // 2. RTO by Courier Partner
  const rtoByCourier = useMemo(() => {
    const courierMap = new Map<string, { total: number; delivered: number; rto: number; rtoVal: number }>();

    orders.forEach(o => {
      const c = normalizeCourier(o.courier) || 'Unassigned / Unknown';
      if (!courierMap.has(c)) {
        courierMap.set(c, { total: 0, delivered: 0, rto: 0, rtoVal: 0 });
      }
      const data = courierMap.get(c)!;
      data.total++;

      const canonical = getCanonicalStatus(o);
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;

      if (canonical === 'Delivered') {
        data.delivered++;
      } else if (canonical.includes('RTO')) {
        data.rto++;
        data.rtoVal += amt;
      }
    });

    return Array.from(courierMap.entries())
      .map(([name, stats]) => {
        const conc = stats.delivered + stats.rto;
        const rate = conc > 0 ? ((stats.rto / conc) * 100).toFixed(1) : '0.0';
        return {
          courier: name,
          total: stats.total,
          delivered: stats.delivered,
          rto: stats.rto,
          rtoVal: stats.rtoVal,
          rtoRate: parseFloat(rate)
        };
      })
      .filter(item => item.total > 0)
      .sort((a, b) => b.rto - a.rto);
  }, [orders]);

  // 3. RTO by Order Value Range
  const rtoByValueRange = useMemo(() => {
    const buckets = [
      { range: 'Under ₹500', min: 0, max: 499, rto: 0, total: 0 },
      { range: '₹500 – ₹1,000', min: 500, max: 1000, rto: 0, total: 0 },
      { range: '₹1,001 – ₹2,000', min: 1001, max: 2000, rto: 0, total: 0 },
      { range: 'Above ₹2,000', min: 2001, max: Infinity, rto: 0, total: 0 }
    ];

    orders.forEach(o => {
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
      const b = buckets.find(item => amt >= item.min && amt <= item.max);
      if (b) {
        b.total++;
        if (getCanonicalStatus(o).includes('RTO')) {
          b.rto++;
        }
      }
    });

    return buckets.map(b => ({
      range: b.range,
      rto: b.rto,
      total: b.total,
      rate: b.total > 0 ? ((b.rto / b.total) * 100).toFixed(1) : '0.0'
    }));
  }, [orders]);

  // 4. RTO Reasons & Delivery Attempt Breakdown
  const { rtoReasons, attemptBuckets } = useMemo(() => {
    const reasonsMap = new Map<string, number>();
    const attempts = { '1 Attempt': 0, '2 Attempts': 0, '3+ Attempts': 0, 'No Attempt Recorded': 0 };

    rtoMetrics.rtoOrders.forEach(o => {
      // Reason extraction from remarks, lastEvent, or trackingError
      const rawText = `${o.remarks || ''} ${o.lastEvent || ''} ${o.trackingError || ''}`.toLowerCase();
      let reason = 'Consignee Refused / Cancelled';
      if (rawText.includes('address') || rawText.includes('pincode') || rawText.includes('incomplete')) {
        reason = 'Incomplete / Incorrect Address';
      } else if (rawText.includes('not available') || rawText.includes('unreachable') || rawText.includes('door closed') || rawText.includes('locked')) {
        reason = 'Customer Unreachable / Door Locked';
      } else if (rawText.includes('otp') || rawText.includes('cod amount') || rawText.includes('cash not ready')) {
        reason = 'COD Amount / OTP Not Provided';
      } else if (rawText.includes('out of delivery area') || rawText.includes('oda') || rawText.includes('restricted')) {
        reason = 'Non-Serviceable / ODA Location';
      } else if (rawText.includes('damaged') || rawText.includes('lost')) {
        reason = 'Transit Damage / Lost in Transit';
      }

      reasonsMap.set(reason, (reasonsMap.get(reason) || 0) + 1);

      // Attempt parsing
      if (rawText.includes('3rd') || rawText.includes('attempt 3') || rawText.includes('attempt 4')) {
        attempts['3+ Attempts']++;
      } else if (rawText.includes('2nd') || rawText.includes('attempt 2')) {
        attempts['2 Attempts']++;
      } else if (rawText.includes('1st') || rawText.includes('attempt 1') || rawText.includes('attempted')) {
        attempts['1 Attempt']++;
      } else {
        attempts['No Attempt Recorded']++;
      }
    });

    const reasonsList = Array.from(reasonsMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      rtoReasons: reasonsList,
      attemptBuckets: Object.entries(attempts).map(([name, count]) => ({ name, count }))
    };
  }, [rtoMetrics.rtoOrders]);

  // 5. High RTO Locations (Top States & Cities)
  const highRtoLocations = useMemo(() => {
    const locMap = new Map<string, { total: number; rto: number; state: string }>();

    orders.forEach(o => {
      const loc = resolveCustomerLocationDisplay(o.state, o.city, o.pincode);
      if (loc === '—') return;
      if (!locMap.has(loc)) {
        locMap.set(loc, { total: 0, rto: 0, state: normalizeState(o.state) });
      }
      const data = locMap.get(loc)!;
      data.total++;
      if (getCanonicalStatus(o).includes('RTO')) {
        data.rto++;
      }
    });

    return Array.from(locMap.entries())
      .map(([location, stat]) => ({
        location,
        total: stat.total,
        rto: stat.rto,
        rate: stat.total >= 5 ? parseFloat(((stat.rto / stat.total) * 100).toFixed(1)) : 0
      }))
      .filter(item => item.rto > 0)
      .sort((a, b) => b.rate - a.rate || b.rto - a.rto)
      .slice(0, 8);
  }, [orders]);

  // 6. RTO Trends by Day / Week / Month
  const rtoTrends = useMemo(() => {
    const map = new Map<string, { period: string; rto: number; rtoVal: number }>();

    rtoMetrics.rtoOrders.forEach(o => {
      const rawDate = o.dispatchDate || o.orderDate || o.deliveredDate;
      if (!rawDate) return;
      const parsed = parseAndFormatLogisticsDate(rawDate);
      if (!parsed.isoDate) return;

      let key = parsed.isoDate;
      if (trendGranularity === 'week') {
        const d = new Date(parsed.isoDate);
        const day = d.getDay();
        const diff = (day + 6) % 7;
        const weekStart = new Date(d.getTime() - diff * 24 * 60 * 60 * 1000);
        key = weekStart.toISOString().slice(0, 10);
      } else if (trendGranularity === 'month') {
        key = parsed.isoDate.slice(0, 7);
      }

      if (!map.has(key)) {
        map.set(key, { period: key, rto: 0, rtoVal: 0 });
      }
      const item = map.get(key)!;
      item.rto++;
      item.rtoVal += (parseOrderAmount(o.amount ?? o.totalAmount) || 0);
    });

    return Array.from(map.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-30);
  }, [rtoMetrics.rtoOrders, trendGranularity]);

  const paymentPieData = [
    { name: 'COD RTO', value: rtoMetrics.codRtoCount, amount: rtoMetrics.codRtoVal, color: '#f43f5e' },
    { name: 'Prepaid RTO', value: rtoMetrics.prepaidRtoCount, amount: rtoMetrics.prepaidRtoVal, color: '#8b5cf6' }
  ];

  return (
    <div className="space-y-4">
      {/* SECTION HEADER & LIFECYCLE STAGES */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-400" />
              <span>RTO Intelligence & Return Analytics</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive return root-cause analysis, geographic risk, and financial impact
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Info size={14} className="text-cyan-400 shrink-0" />
            <span className="text-slate-300">
              Denominator Rule: <strong className="text-cyan-300">RTO / (Delivered + RTO)</strong>
            </span>
          </div>
        </div>

        {/* 4 TOP RTO METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Card 1: Total RTO */}
          <div 
            onClick={() => onDrillDown('All RTO Orders', 'All returned orders across stages', o => getCanonicalStatus(o).includes('RTO'))}
            className="bg-[#0e1626] border border-slate-800 hover:border-rose-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Total RTO Orders</span>
              <RotateCcw size={14} className="text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-400">
              {rtoMetrics.totalRto.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              RTO Rate: <strong className="text-rose-300">{rtoMetrics.rtoRate}%</strong> of concluded
            </div>
          </div>

          {/* Card 2: RTO Value */}
          <div 
            onClick={() => onDrillDown('RTO Financial Impact', 'Orders with returned value', o => getCanonicalStatus(o).includes('RTO'))}
            className="bg-[#0e1626] border border-slate-800 hover:border-rose-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>RTO Order Value</span>
              <IndianRupee size={14} className="text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {formatINR(rtoMetrics.rtoVal)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Trapped in returned inventory
            </div>
          </div>

          {/* Card 3: COD RTO vs Prepaid RTO */}
          <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Payment Split</span>
              <CreditCard size={14} className="text-cyan-400" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block">COD</span>
                <span className="text-lg font-black font-mono text-rose-400">{rtoMetrics.codRtoCount}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 block">Prepaid</span>
                <span className="text-lg font-black font-mono text-purple-400">{rtoMetrics.prepaidRtoCount}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              COD comprises {rtoMetrics.totalRto > 0 ? Math.round((rtoMetrics.codRtoCount / rtoMetrics.totalRto) * 100) : 0}% of RTOs
            </div>
          </div>

          {/* Card 4: 3 Lifecycle Stages Separated */}
          <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              RTO Stages (Separated)
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div 
                onClick={() => onDrillDown('RTO Initiated', 'RTO flagged at destination hub', o => getCanonicalStatus(o) === 'RTO Initiated')}
                className="bg-[#0b1220] p-1.5 rounded cursor-pointer hover:bg-slate-800"
              >
                <div className="text-[9px] text-slate-400 truncate">Initiated</div>
                <div className="text-xs font-bold font-mono text-rose-400">{rtoMetrics.rtoInitiated}</div>
              </div>
              <div 
                onClick={() => onDrillDown('RTO In Transit', 'Return moving back to seller hub', o => getCanonicalStatus(o) === 'RTO In Transit')}
                className="bg-[#0b1220] p-1.5 rounded cursor-pointer hover:bg-slate-800"
              >
                <div className="text-[9px] text-slate-400 truncate">In Transit</div>
                <div className="text-xs font-bold font-mono text-rose-300">{rtoMetrics.rtoInTransit}</div>
              </div>
              <div 
                onClick={() => onDrillDown('RTO Delivered to Seller', 'Returns received at seller facility', o => getCanonicalStatus(o) === 'RTO Delivered to Seller')}
                className="bg-[#0b1220] p-1.5 rounded cursor-pointer hover:bg-slate-800"
              >
                <div className="text-[9px] text-slate-400 truncate">Delivered</div>
                <div className="text-xs font-bold font-mono text-emerald-400">{rtoMetrics.rtoDeliveredToSeller}</div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Distinct non-overlapping lifecycle states
            </div>
          </div>

        </div>
      </div>

      {/* CHARTS ROW 1: RTO BY COURIER & RTO TRENDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* CHART 1: RTO by Courier Partner */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck size={15} className="text-rose-400" />
                RTO Orders & Rate by Courier Partner
              </h4>
              <p className="text-xs text-slate-400">Comparing return volume and percentage across logistics partners</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {rtoByCourier.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No courier RTO data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rtoByCourier} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="courier" 
                    stroke="#64748b" 
                    fontSize={10} 
                    angle={-20} 
                    textAnchor="end" 
                    tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '…' : v}
                  />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} RTOs (${item.payload.rtoRate}% rate, ${formatINR(item.payload.rtoVal)})`,
                      'RTO Count'
                    ]}
                  />
                  <Bar
                    dataKey="rto"
                    fill="#f43f5e"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(entry) => {
                      if (entry && entry.courier) {
                        onDrillDown(
                          `RTO Orders for ${entry.courier}`,
                          `All return orders handled by ${entry.courier}`,
                          o => normalizeCourier(o.courier) === entry.courier && getCanonicalStatus(o).includes('RTO')
                        );
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: RTO Trends over Time */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingDown size={15} className="text-rose-400" />
                RTO Trend Over Time
              </h4>
              <p className="text-xs text-slate-400">Historical trend of returned shipments</p>
            </div>

            <div className="flex items-center bg-[#0e1626] border border-slate-800 rounded-lg p-0.5 text-xs">
              {(['day', 'week', 'month'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTrendGranularity(g)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold capitalize transition-all cursor-pointer ${
                    trendGranularity === g ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            {rtoTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No RTO trend records available for current filter
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rtoTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} RTOs (${formatINR(item.payload.rtoVal)})`,
                      'RTO Orders'
                    ]}
                  />
                  <Line type="monotone" dataKey="rto" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, fill: '#f43f5e' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* ROW 3: REASONS, ORDER VALUE RANGE, & HIGH-RTO LOCATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* 1. RTO Reasons Breakdown */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-rose-400" />
            <span>Root Cause / RTO Reasons</span>
          </h4>

          <div className="space-y-2">
            {rtoReasons.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No RTO exceptions logged</div>
            ) : (
              rtoReasons.map(r => {
                const pct = rtoMetrics.totalRto > 0 ? Math.round((r.count / rtoMetrics.totalRto) * 100) : 0;
                return (
                  <div key={r.reason} className="bg-[#0e1626] border border-slate-800/80 rounded-xl p-2.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-200 truncate pr-2">{r.reason}</span>
                      <span className="font-mono font-bold text-rose-400">{r.count}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">{pct}% of total returns</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. RTO by Order Value Range */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <IndianRupee size={14} className="text-cyan-400" />
            <span>RTO by Order Value Range</span>
          </h4>

          <div className="space-y-2">
            {rtoByValueRange.map(b => (
              <div 
                key={b.range}
                onClick={() => onDrillDown(
                  `RTO Orders in ${b.range}`,
                  `Returned shipments with order value ${b.range}`,
                  o => {
                    const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
                    const canonical = getCanonicalStatus(o);
                    return canonical.includes('RTO');
                  }
                )}
                className="bg-[#0e1626] border border-slate-800/80 hover:border-rose-600/50 rounded-xl p-2.5 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-300">{b.range}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 text-[11px]">{b.total} total</span>
                    <span className="font-mono font-bold text-rose-400">{b.rto} RTO ({b.rate}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, parseFloat(b.rate))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Top High-RTO Locations */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <MapPin size={14} className="text-yellow-400" />
            <span>High-RTO Locations (States / Cities)</span>
          </h4>

          <div className="space-y-2">
            {highRtoLocations.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No location returns recorded</div>
            ) : (
              highRtoLocations.map(loc => (
                <div 
                  key={loc.location}
                  onClick={() => onDrillDown(
                    `RTO Orders in ${loc.location}`,
                    `Returns from destination ${loc.location}`,
                    o => resolveCustomerLocationDisplay(o.state, o.city, o.pincode) === loc.location && getCanonicalStatus(o).includes('RTO')
                  )}
                  className="bg-[#0e1626] border border-slate-800/80 hover:border-yellow-600/50 rounded-xl p-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300 truncate pr-2">{loc.location}</span>
                    <span className="font-mono font-bold text-yellow-400">{loc.rto} RTO ({loc.rate}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, loc.rate)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
