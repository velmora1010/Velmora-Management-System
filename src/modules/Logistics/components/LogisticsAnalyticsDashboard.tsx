import React, { useMemo } from 'react';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  IndianRupee, 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Layers, 
  RotateCcw,
  AlertCircle,
  FileText,
  Calendar,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  MapPin
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../config/courierConfig';
import { isDispatchedOrder } from '../../../utils/logisticsOrderUtils';
import type { LogisticsFilterState } from '../types/logisticsFilters';

interface LogisticsAnalyticsDashboardProps {
  orders: UnifiedLogisticsOrder[];
  allOrders: UnifiedLogisticsOrder[];
  filters: LogisticsFilterState;
  onResetFilters: () => void;
  onNavigateStage?: (stage: 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking') => void;
}

const STATUS_COLORS: Record<string, string> = {
  'Delivered': '#10b981',       // Emerald
  'In Transit': '#3b82f6',      // Blue
  'Out for Delivery': '#06b6d4',// Cyan
  'Info Received': '#6366f1',   // Indigo
  'Pending': '#f59e0b',         // Amber
  'Exception': '#f43f5e',       // Rose
  'Failed Attempt': '#fb923c',  // Orange
  'Expired': '#64748b'          // Slate
};

const COURIER_COLORS: Record<string, string> = {
  'Delhivery': '#06b6d4',
  'ST Courier': '#8b5cf6',
  'India Post': '#f43f5e',
  'iThink Logistics – Ekart': '#f59e0b',
  'iThink Logistics – Delhivery': '#6366f1',
  'iThink Logistics – Amazon': '#ea580c'
};

export const LogisticsAnalyticsDashboard: React.FC<LogisticsAnalyticsDashboardProps> = ({
  orders,
  allOrders,
  filters,
  onResetFilters,
  onNavigateStage
}) => {
  // 1. CALCULATE OVERVIEW KPIS
  const kpiData = useMemo(() => {
    let unfulfilled = 0;
    let prepareDispatch = 0;
    let dispatched = 0;
    let inTransit = 0;
    let delivered = 0;
    let exceptions = 0;
    let totalVal = 0;
    let prepaidVal = 0;
    let codVal = 0;

    orders.forEach(o => {
      const amt = o.amount ?? o.totalAmount ?? 0;
      totalVal += amt;

      const pType = (o.orderType || '').toUpperCase();
      if (pType.includes('COD') && !pType.includes('PARTIAL')) {
        codVal += amt;
      } else {
        prepaidVal += amt;
      }

      if (o.workflowStage === 'active') {
        unfulfilled++;
      } else if (o.workflowStage === 'prepare_dispatch') {
        prepareDispatch++;
      }

      if (isDispatchedOrder(o)) {
        dispatched++;
        const st = (o.status || '').toLowerCase();
        if (st === 'delivered') {
          delivered++;
        } else if (st === 'in transit' || st === 'out for delivery') {
          inTransit++;
        } else if (
          st === 'exception' || 
          st.includes('rto') || 
          st.includes('return') || 
          st === 'failed attempt' ||
          st.includes('fail')
        ) {
          exceptions++;
        }
      }
    });

    return {
      totalImported: orders.length,
      unfulfilled,
      prepareDispatch,
      totalDispatched: dispatched,
      inTransit,
      delivered,
      exceptions,
      totalOrderValue: Math.round(totalVal),
      prepaidOrderValue: Math.round(prepaidVal),
      codOrderValue: Math.round(codVal)
    };
  }, [orders]);

  // 2. DAILY TRENDS DATA (Imported, Dispatched, Revenue over Time)
  const dailyTrends = useMemo(() => {
    const map = new Map<string, { date: string; imported: number; dispatched: number; value: number }>();

    orders.forEach(o => {
      const rawDate = o.orderDate || o.dispatchDate;
      const d = rawDate ? rawDate.slice(0, 10) : 'Unknown Date';
      if (!map.has(d)) {
        map.set(d, { date: d, imported: 0, dispatched: 0, value: 0 });
      }
      const item = map.get(d)!;
      item.imported++;
      if (isDispatchedOrder(o)) {
        item.dispatched++;
      }
      item.value += (o.amount ?? o.totalAmount ?? 0);
    });

    return Array.from(map.values())
      .filter(item => item.date !== 'Unknown Date')
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  // 3. SHIPMENT STATUS DISTRIBUTION (Donut chart data)
  const statusDistribution = useMemo(() => {
    const dispatchedShipments = orders.filter(o => isDispatchedOrder(o));
    const counts: Record<string, number> = {};

    dispatchedShipments.forEach(s => {
      let st = s.status || 'Pending';
      if (st === 'Awaiting Tracking Update') st = 'Info Received';
      if (st.toLowerCase().includes('rto') || st.toLowerCase().includes('return')) st = 'Exception';
      counts[st] = (counts[st] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || '#94a3b8'
    }));
  }, [orders]);

  // 4. COURIER-WISE SHIPMENT DISTRIBUTION
  const courierDistribution = useMemo(() => {
    const dispatchedShipments = orders.filter(o => isDispatchedOrder(o));
    const counts: Record<string, number> = {};
    CONFIGURED_COURIERS.forEach(c => { counts[c.name] = 0; });

    dispatchedShipments.forEach(s => {
      const norm = normalizeCourier(s.courier);
      if (norm && counts[norm] !== undefined) {
        counts[norm]++;
      }
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: COURIER_COLORS[name] || '#8b5cf6'
    }));
  }, [orders]);

  // 5. PREPAID VS COD DISTRIBUTION
  const paymentDistribution = useMemo(() => {
    let prepaidCount = 0;
    let codCount = 0;
    let prepaidVal = 0;
    let codVal = 0;

    orders.forEach(o => {
      const amt = o.amount ?? o.totalAmount ?? 0;
      const type = (o.orderType || '').toUpperCase();
      if (type.includes('COD') && !type.includes('PARTIAL')) {
        codCount++;
        codVal += amt;
      } else {
        prepaidCount++;
        prepaidVal += amt;
      }
    });

    return [
      { name: 'Prepaid', value: prepaidCount, amount: Math.round(prepaidVal), color: '#8b5cf6' },
      { name: 'COD', value: codCount, amount: Math.round(codVal), color: '#06b6d4' }
    ];
  }, [orders]);

  // 6. COURIER PERFORMANCE DETAILED TABLE DATA
  const courierPerformanceTable = useMemo(() => {
    return CONFIGURED_COURIERS.map(courier => {
      const courierOrders = orders.filter(o => normalizeCourier(o.courier) === courier.name);
      const total = courierOrders.length;
      let delivered = 0;
      let inTransit = 0;
      let exceptions = 0;
      let totalDeliveryDays = 0;
      let deliveryDaysCount = 0;
      let latestSync = '';

      courierOrders.forEach(o => {
        const st = (o.status || '').toLowerCase();
        if (st === 'delivered') delivered++;
        else if (st === 'in transit' || st === 'out for delivery') inTransit++;
        else if (st === 'exception' || st.includes('rto') || st === 'failed attempt') exceptions++;

        if (o.syncedAt && (!latestSync || o.syncedAt > latestSync)) {
          latestSync = o.syncedAt;
        }

        // Calculate actual delivery days if both dispatch and delivery date exist
        if (o.dispatchDate && o.deliveredDate) {
          const d1 = new Date(o.dispatchDate).getTime();
          const d2 = new Date(o.deliveredDate).getTime();
          if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
            const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24);
            totalDeliveryDays += diffDays;
            deliveryDaysCount++;
          }
        }
      });

      const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const avgDeliveryDays = deliveryDaysCount > 0 ? (totalDeliveryDays / deliveryDaysCount).toFixed(1) : null;

      return {
        id: courier.id,
        name: courier.name,
        shortName: courier.shortName,
        total,
        delivered,
        inTransit,
        exceptions,
        successRate,
        avgDeliveryDays,
        latestSync: latestSync ? latestSync.slice(0, 16).replace('T', ' ') : null,
        badgeColor: courier.badgeColor
      };
    });
  }, [orders]);

  // 7. OPERATIONAL DISPATCH & BUSINESS INSIGHTS
  const insights = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Missing Courier or AWB in prepare dispatch
    const missingAwbCount = orders.filter(
      o => o.workflowStage === 'prepare_dispatch' && (!o.awbNumber || o.awbNumber.trim() === '')
    ).length;

    // Awaiting First Scan
    const awaitingScanCount = orders.filter(
      o => isDispatchedOrder(o) && (o.status === 'Awaiting Tracking Update' || o.status === 'Info Received')
    ).length;

    // Delayed Shipments (Estimated delivery date passed and not delivered)
    const delayedCount = orders.filter(o => {
      if (!isDispatchedOrder(o)) return false;
      if (o.status === 'Delivered') return false;
      if (!o.estimatedDeliveryDate) return false;
      return o.estimatedDeliveryDate < todayStr;
    }).length;

    // Incomplete Customer Phone or Address
    const incompleteContactCount = orders.filter(o => {
      const hasPhone = !!(o.phoneNumber || o.phone);
      const hasAddress = !!(o.address || o.shippingAddress);
      return !hasPhone || !hasAddress;
    }).length;

    return {
      missingAwbCount,
      awaitingScanCount,
      delayedCount,
      incompleteContactCount
    };
  }, [orders]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-8 custom-scrollbar text-slate-200">
      
      {/* SECTION A: OVERVIEW KPI CARDS (10 Responsive Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* 1. Total Imported Orders */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Imported</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Package size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{kpiData.totalImported.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">All orders in current dataset</p>
        </div>

        {/* 2. Unfulfilled Orders */}
        <div 
          onClick={() => onNavigateStage && onNavigateStage('active')}
          className="bg-[#0b1220] border border-slate-800 hover:border-purple-600/50 rounded-2xl p-4 shadow-md flex flex-col justify-between cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-purple-300">Unfulfilled Active</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{kpiData.unfulfilled.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting dispatch preparation</p>
        </div>

        {/* 3. In Prepare Dispatch */}
        <div 
          onClick={() => onNavigateStage && onNavigateStage('prepare_dispatch')}
          className="bg-[#0b1220] border border-slate-800 hover:border-purple-600/50 rounded-2xl p-4 shadow-md flex flex-col justify-between cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-purple-300">Prepare Dispatch</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Layers size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{kpiData.prepareDispatch.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Grouped orders awaiting AWB</p>
        </div>

        {/* 4. Total Dispatched */}
        <div 
          onClick={() => onNavigateStage && onNavigateStage('dispatched')}
          className="bg-[#0b1220] border border-slate-800 hover:border-emerald-600/50 rounded-2xl p-4 shadow-md flex flex-col justify-between cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-emerald-300">Total Dispatched</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Truck size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{kpiData.totalDispatched.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Shipments with courier & AWB</p>
        </div>

        {/* 5. In Transit */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Transit</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">{kpiData.inTransit.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">On vehicle or out for delivery</p>
        </div>

        {/* 6. Delivered */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Delivered</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">{kpiData.delivered.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Successfully delivered</p>
        </div>

        {/* 7. Exceptions / Failed */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Exceptions / RTO</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-400 font-mono">{kpiData.exceptions.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Delivery issues & returned shipments</p>
        </div>

        {/* 8. Total Order Value */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Value</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">₹{kpiData.totalOrderValue.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total order revenue</p>
        </div>

        {/* 9. Prepaid Value */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Prepaid Value</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <IndianRupee size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-400 font-mono">₹{kpiData.prepaidOrderValue.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Pre-collected orders</p>
        </div>

        {/* 10. COD Value */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">COD Value</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <IndianRupee size={15} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono">₹{kpiData.codOrderValue.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Cash on delivery collection</p>
        </div>

      </div>

      {/* SECTION B: ORDER & SHIPMENT TRENDS (CHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* CHART 1: Orders Imported vs Dispatched Over Time */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" />
                Orders Imported vs Dispatched Over Time
              </h3>
              <p className="text-xs text-slate-400">Daily breakdown of incoming volume vs fulfillment</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {dailyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No chronological date records available for current filter
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="importGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="imported" name="Imported Orders" stroke="#06b6d4" fillOpacity={1} fill="url(#importGrad)" />
                  <Area type="monotone" dataKey="dispatched" name="Dispatched Shipments" stroke="#8b5cf6" fillOpacity={1} fill="url(#dispatchGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: Order Revenue Volume Over Time */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <IndianRupee size={16} className="text-emerald-400" />
                Order Revenue Trend (₹)
              </h3>
              <p className="text-xs text-slate-400">Total order amount processed over time</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {dailyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No revenue records available for current filter
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip 
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Order Value']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="value" name="Order Value" stroke="#10b981" fillOpacity={1} fill="url(#valGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 3: Shipment Tracking Status Breakdown (Donut) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChartIcon size={16} className="text-purple-400" />
                Shipment Status Breakdown
              </h3>
              <p className="text-xs text-slate-400">Current tracking stages of dispatched shipments</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {statusDistribution.length === 0 ? (
              <div className="text-xs text-slate-500">No dispatched shipments to display status distribution</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [val, 'Shipments']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 4: Payment Distribution (Prepaid vs COD) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-400" />
                Prepaid vs COD Distribution
              </h3>
              <p className="text-xs text-slate-400">Order count and financial split by payment method</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {paymentDistribution.every(p => p.value === 0) ? (
              <div className="text-xs text-slate-500">No payment data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    {paymentDistribution.map((entry, idx) => (
                      <Cell key={`pay-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any, name: any, item: any) => [
                      `${val} orders (₹${item.payload.amount.toLocaleString('en-IN')})`,
                      name
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* SECTION C: COURIER PERFORMANCE DETAILED TABLE */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck size={17} className="text-purple-400" />
              Courier Service Performance Comparison
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live delivery metrics for each integrated logistics partner
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0e1626] text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Courier Partner</th>
                <th className="px-4 py-3.5 text-center">Total Shipments</th>
                <th className="px-4 py-3.5 text-center text-emerald-400">Delivered</th>
                <th className="px-4 py-3.5 text-center text-blue-400">In Transit</th>
                <th className="px-4 py-3.5 text-center text-rose-400">Exceptions / RTO</th>
                <th className="px-4 py-3.5 text-center">Success Rate</th>
                <th className="px-4 py-3.5 text-center">Avg Delivery Time</th>
                <th className="px-4 py-3.5 text-right">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {courierPerformanceTable.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.badgeColor.indicator}`} />
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-300">
                    {c.total}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400">
                    {c.delivered}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-blue-400">
                    {c.inTransit}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-rose-400">
                    {c.exceptions}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.total > 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-purple-950/60 border border-purple-800/60 text-purple-300">
                        {c.successRate}%
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-slate-300">
                    {c.avgDeliveryDays ? `${c.avgDeliveryDays} days` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-[11px] text-slate-400">
                    {c.latestSync || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION D: DISPATCH & BUSINESS OPERATIONAL INSIGHTS */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck size={16} className="text-purple-400" />
          Dispatch & Operational Action Insights
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Insight 1: Orders Awaiting Preparation */}
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold mb-2">
              <Clock size={15} />
              <span>Unfulfilled Queue</span>
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {kpiData.unfulfilled} Orders Awaiting Dispatch
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Unfulfilled orders waiting to be selected and moved to Prepare Dispatch.
            </p>
            {onNavigateStage && (
              <button
                type="button"
                onClick={() => onNavigateStage('active')}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer self-start"
              >
                <span>View Active Orders</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>

          {/* Insight 2: Orders in Prepare Dispatch */}
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-2">
              <Layers size={15} />
              <span>Ready for Courier & AWB</span>
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {kpiData.prepareDispatch} Orders in Preparation
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Orders currently grouped into batches awaiting AWB assignment.
            </p>
            {onNavigateStage && (
              <button
                type="button"
                onClick={() => onNavigateStage('prepare_dispatch')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer self-start"
              >
                <span>Go to Prepare Dispatch</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>

          {/* Insight 3: Awaiting First Scan */}
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2">
              <Truck size={15} />
              <span>First Scan Pending</span>
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {insights.awaitingScanCount} Dispatched Shipments
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Shipments confirmed dispatched waiting for initial carrier tracking update.
            </p>
            {onNavigateStage && (
              <button
                type="button"
                onClick={() => onNavigateStage('tracking')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer self-start"
              >
                <span>Sync Tracking Status</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>

          {/* Insight 4: Exceptions & Incomplete Contacts */}
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold mb-2">
              <AlertTriangle size={15} />
              <span>Exceptions & RTO Alert</span>
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {kpiData.exceptions} Delivery Issues Flagged
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Shipments marked Exception or RTO requiring review and re-attempt.
            </p>
            {onNavigateStage && (
              <button
                type="button"
                onClick={() => onNavigateStage('tracking')}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer self-start"
              >
                <span>Inspect Exceptions</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
