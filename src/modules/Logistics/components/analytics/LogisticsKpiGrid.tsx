import React, { useMemo } from 'react';
import { 
  Package, 
  Clock, 
  Layers, 
  Truck, 
  TrendingUp, 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  RotateCcw, 
  AlertTriangle, 
  RefreshCw, 
  XCircle, 
  IndianRupee, 
  CalendarClock, 
  Timer, 
  CheckCheck,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  checkDeliverySla, 
  formatINR, 
  isCodOrder, 
  calculatePeriodComparison 
} from '../../utils/logisticsAnalyticsUtils';
import type { LogisticsFilterState } from '../../types/logisticsFilters';
import { isDispatchedOrder, parseOrderAmount } from '../../../../utils/logisticsOrderUtils';

interface LogisticsKpiGridProps {
  orders: UnifiedLogisticsOrder[];
  allOrders: UnifiedLogisticsOrder[];
  filters: LogisticsFilterState;
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
  onNavigateStage?: (stage: 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking') => void;
}

export const LogisticsKpiGrid: React.FC<LogisticsKpiGridProps> = ({
  orders,
  allOrders,
  filters,
  onDrillDown,
  onNavigateStage
}) => {
  // 1. Calculate Period Comparison metrics
  const periodComp = useMemo(() => {
    return calculatePeriodComparison(orders, allOrders, filters);
  }, [orders, allOrders, filters]);

  // 2. Compute the 20 KPI metrics accurately from `orders`
  const metrics = useMemo(() => {
    let unfulfilled = 0;
    let readyForDispatch = 0;
    let dispatched = 0;
    let inTransit = 0;
    let outForDelivery = 0;
    let delivered = 0;
    let rtoTotal = 0;
    let failedAttempts = 0;
    let pendingTracking = 0;
    let cancelled = 0;
    let exceptionsDelayed = 0;
    let totalVal = 0;
    let prepaidVal = 0;
    let codVal = 0;
    let codPendingCollection = 0;
    let totalDeliveryDays = 0;
    let deliveredCountWithDays = 0;
    let deliveredWithinSla = 0;

    orders.forEach(o => {
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
      totalVal += amt;

      const isCod = isCodOrder(o);
      if (isCod) {
        codVal += amt;
      } else {
        prepaidVal += amt;
      }

      if (o.workflowStage === 'active') {
        unfulfilled++;
      } else if (o.workflowStage === 'prepare_dispatch') {
        readyForDispatch++;
      }

      const isDisp = isDispatchedOrder(o);
      if (isDisp) {
        dispatched++;
      }

      const canonical = getCanonicalStatus(o);
      const slaInfo = checkDeliverySla(o);

      if (canonical === 'Delivered') {
        delivered++;
        if (slaInfo.deliveryDays !== null && slaInfo.deliveryDays >= 0) {
          totalDeliveryDays += slaInfo.deliveryDays;
          deliveredCountWithDays++;
        }
        if (slaInfo.isOnTime) {
          deliveredWithinSla++;
        }
      } else if (canonical === 'In Transit') {
        inTransit++;
        if (isCod) codPendingCollection += amt;
      } else if (canonical === 'Out for Delivery') {
        outForDelivery++;
        if (isCod) codPendingCollection += amt;
      } else if (canonical.includes('RTO')) {
        rtoTotal++;
      } else if (canonical === 'Delivery Attempt Failed') {
        failedAttempts++;
        if (isCod) codPendingCollection += amt;
      } else if (canonical === 'Pending Tracking Update') {
        pendingTracking++;
        if (isCod && isDisp) codPendingCollection += amt;
      } else if (canonical === 'Cancelled') {
        cancelled++;
      } else if (canonical === 'Delayed / SLA Breached' || canonical === 'Shipment Exception') {
        exceptionsDelayed++;
        if (isCod && isDisp) codPendingCollection += amt;
      }
    });

    // Concluded outcomes: Delivered + RTO
    const concludedOrders = delivered + rtoTotal;
    const deliverySuccessRate = concludedOrders > 0
      ? Math.round((delivered / concludedOrders) * 100)
      : (dispatched > 0 ? Math.round((delivered / dispatched) * 100) : 0);

    // Documented Denominator: RTO / (Delivered + RTO)
    const rtoRate = concludedOrders > 0
      ? ((rtoTotal / concludedOrders) * 100).toFixed(1)
      : '0.0';

    const avgDeliveryTimeDays = deliveredCountWithDays > 0
      ? (totalDeliveryDays / deliveredCountWithDays).toFixed(1)
      : null;

    return {
      totalImported: orders.length,
      unfulfilled,
      readyForDispatch,
      dispatched,
      inTransit,
      outForDelivery,
      delivered,
      deliverySuccessRate,
      rtoTotal,
      rtoRate,
      failedAttempts,
      pendingTracking,
      cancelled,
      exceptionsDelayed,
      totalVal,
      prepaidVal,
      codVal,
      codPendingCollection,
      avgDeliveryTimeDays,
      deliveredWithinSla
    };
  }, [orders]);

  // Comparison helper badge
  const renderCompBadge = (changePct: number | null, isHigherGood: boolean = true) => {
    if (!periodComp.hasComparison || changePct === null) return null;
    const isPositive = changePct > 0;
    const isNeutral = changePct === 0;
    const isGood = isHigherGood ? isPositive : !isPositive;

    return (
      <div className={`inline-flex items-center gap-0.5 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
        isNeutral 
          ? 'bg-slate-800 text-slate-400'
          : isGood 
            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' 
            : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
      }`}>
        {isPositive ? '+' : ''}{changePct}%
      </div>
    );
  };

  // Definitions for all 20 KPI Cards
  const kpiCards = [
    {
      id: 'kpi-1',
      title: 'Total Imported',
      value: metrics.totalImported.toLocaleString('en-IN'),
      desc: 'All distinct customer orders in current view',
      icon: <Package size={15} />,
      colorClass: 'border-slate-800 hover:border-slate-700 text-white',
      iconColor: 'bg-blue-500/10 text-blue-400',
      compBadge: renderCompBadge(periodComp.orderCountChangePct, true),
      onClick: () => onDrillDown('Total Imported Orders', 'All distinct customer orders', () => true)
    },
    {
      id: 'kpi-2',
      title: 'Active / Unfulfilled',
      value: metrics.unfulfilled.toLocaleString('en-IN'),
      desc: 'Orders awaiting dispatch preparation',
      icon: <Clock size={15} />,
      colorClass: 'border-slate-800 hover:border-purple-600/50 text-purple-300',
      iconColor: 'bg-purple-500/10 text-purple-400',
      compBadge: null,
      onClick: () => onNavigateStage ? onNavigateStage('active') : onDrillDown('Active / Unfulfilled Orders', 'Orders in active unfulfilled stage', o => o.workflowStage === 'active')
    },
    {
      id: 'kpi-3',
      title: 'Ready for Dispatch',
      value: metrics.readyForDispatch.toLocaleString('en-IN'),
      desc: 'Grouped orders assigned for courier handover',
      icon: <Layers size={15} />,
      colorClass: 'border-slate-800 hover:border-purple-600/50 text-purple-300',
      iconColor: 'bg-purple-500/10 text-purple-400',
      compBadge: null,
      onClick: () => onNavigateStage ? onNavigateStage('prepare_dispatch') : onDrillDown('Ready for Dispatch Orders', 'Grouped orders awaiting AWB / courier handover', o => o.workflowStage === 'prepare_dispatch')
    },
    {
      id: 'kpi-4',
      title: 'Dispatched Shipments',
      value: metrics.dispatched.toLocaleString('en-IN'),
      desc: 'Shipments with courier & AWB handed over',
      icon: <Truck size={15} />,
      colorClass: 'border-slate-800 hover:border-indigo-600/50 text-indigo-300',
      iconColor: 'bg-indigo-500/10 text-indigo-400',
      compBadge: null,
      onClick: () => onNavigateStage ? onNavigateStage('dispatched') : onDrillDown('Dispatched Shipments', 'All shipments handed over to couriers', o => isDispatchedOrder(o))
    },
    {
      id: 'kpi-5',
      title: 'In Transit',
      value: metrics.inTransit.toLocaleString('en-IN'),
      desc: 'Moving through courier transit hubs',
      icon: <TrendingUp size={15} />,
      colorClass: 'border-slate-800 hover:border-blue-600/50 text-blue-400',
      iconColor: 'bg-blue-500/10 text-blue-400',
      compBadge: null,
      onClick: () => onDrillDown('In Transit Shipments', 'Shipments currently between hubs', o => getCanonicalStatus(o) === 'In Transit')
    },
    {
      id: 'kpi-6',
      title: 'Out for Delivery',
      value: metrics.outForDelivery.toLocaleString('en-IN'),
      desc: 'On delivery vehicle with delivery executive',
      icon: <Send size={15} />,
      colorClass: 'border-slate-800 hover:border-cyan-600/50 text-cyan-400',
      iconColor: 'bg-cyan-500/10 text-cyan-400',
      compBadge: null,
      onClick: () => onDrillDown('Out for Delivery Orders', 'Shipments on final delivery run', o => getCanonicalStatus(o) === 'Out for Delivery')
    },
    {
      id: 'kpi-7',
      title: 'Delivered Orders',
      value: metrics.delivered.toLocaleString('en-IN'),
      desc: 'Successfully delivered to customer',
      icon: <CheckCircle2 size={15} />,
      colorClass: 'border-slate-800 hover:border-emerald-600/50 text-emerald-400',
      iconColor: 'bg-emerald-500/10 text-emerald-400',
      compBadge: renderCompBadge(periodComp.deliveredChangePct, true),
      onClick: () => onDrillDown('Delivered Orders', 'Orders confirmed delivered', o => getCanonicalStatus(o) === 'Delivered')
    },
    {
      id: 'kpi-8',
      title: 'Delivery Success Rate',
      value: `${metrics.deliverySuccessRate}%`,
      desc: 'Delivered vs all concluded outcomes',
      icon: <ShieldCheck size={15} />,
      colorClass: 'border-slate-800 hover:border-emerald-600/50 text-emerald-400',
      iconColor: 'bg-emerald-500/10 text-emerald-400',
      compBadge: null,
      onClick: () => onDrillDown('Concluded Delivery Outcomes', 'Delivered & RTO shipments', o => {
        const st = getCanonicalStatus(o);
        return st === 'Delivered' || st.includes('RTO');
      })
    },
    {
      id: 'kpi-9',
      title: 'RTO Orders',
      value: metrics.rtoTotal.toLocaleString('en-IN'),
      desc: 'Returned to origin (undelivered)',
      icon: <RotateCcw size={15} />,
      colorClass: 'border-slate-800 hover:border-rose-600/50 text-rose-400',
      iconColor: 'bg-rose-500/10 text-rose-400',
      compBadge: renderCompBadge(periodComp.rtoChangePct, false),
      onClick: () => onDrillDown('RTO Shipments', 'Shipments returned or returning to origin', o => getCanonicalStatus(o).includes('RTO'))
    },
    {
      id: 'kpi-10',
      title: 'RTO Rate',
      value: `${metrics.rtoRate}%`,
      desc: 'RTO / (Delivered + RTO orders)',
      icon: <AlertTriangle size={15} />,
      colorClass: 'border-slate-800 hover:border-rose-600/50 text-rose-400',
      iconColor: 'bg-rose-500/10 text-rose-400',
      compBadge: null,
      onClick: () => onDrillDown('RTO Orders List', 'Orders flagged as RTO', o => getCanonicalStatus(o).includes('RTO'))
    },
    {
      id: 'kpi-11',
      title: 'Failed Attempts',
      value: metrics.failedAttempts.toLocaleString('en-IN'),
      desc: 'Customer unreachable or door locked',
      icon: <AlertTriangle size={15} />,
      colorClass: 'border-slate-800 hover:border-orange-600/50 text-orange-400',
      iconColor: 'bg-orange-500/10 text-orange-400',
      compBadge: null,
      onClick: () => onDrillDown('Failed Delivery Attempts', 'Shipments with failed delivery attempts', o => getCanonicalStatus(o) === 'Delivery Attempt Failed')
    },
    {
      id: 'kpi-12',
      title: 'Pending Tracking Updates',
      value: metrics.pendingTracking.toLocaleString('en-IN'),
      desc: 'Dispatched but awaiting first scan',
      icon: <RefreshCw size={15} />,
      colorClass: 'border-slate-800 hover:border-amber-600/50 text-amber-400',
      iconColor: 'bg-amber-500/10 text-amber-400',
      compBadge: null,
      onClick: () => onDrillDown('Pending Tracking Updates', 'Dispatched shipments awaiting initial carrier scan', o => getCanonicalStatus(o) === 'Pending Tracking Update')
    },
    {
      id: 'kpi-13',
      title: 'Cancelled Orders',
      value: metrics.cancelled.toLocaleString('en-IN'),
      desc: 'Cancelled prior to or during fulfillment',
      icon: <XCircle size={15} />,
      colorClass: 'border-slate-800 hover:border-slate-700 text-slate-400',
      iconColor: 'bg-slate-700/20 text-slate-400',
      compBadge: null,
      onClick: () => onDrillDown('Cancelled Orders', 'Orders marked cancelled or voided', o => getCanonicalStatus(o) === 'Cancelled')
    },
    {
      id: 'kpi-14',
      title: 'Exceptions / Delayed',
      value: metrics.exceptionsDelayed.toLocaleString('en-IN'),
      desc: 'SLA overdue or courier transit issue',
      icon: <AlertTriangle size={15} />,
      colorClass: 'border-slate-800 hover:border-yellow-600/50 text-yellow-400',
      iconColor: 'bg-yellow-500/10 text-yellow-400',
      compBadge: null,
      onClick: () => onDrillDown('Exceptions & Delayed Shipments', 'Shipments with transit delay or exception', o => {
        const st = getCanonicalStatus(o);
        return st === 'Delayed / SLA Breached' || st === 'Shipment Exception';
      })
    },
    {
      id: 'kpi-15',
      title: 'Total Order Value',
      value: formatINR(metrics.totalVal),
      desc: 'Gross revenue of filtered orders',
      icon: <IndianRupee size={15} />,
      colorClass: 'border-slate-800 hover:border-cyan-600/50 text-white',
      iconColor: 'bg-cyan-500/10 text-cyan-400',
      compBadge: renderCompBadge(periodComp.valueChangePct, true),
      onClick: () => onDrillDown('All Orders Value', 'Total order value breakdown', () => true)
    },
    {
      id: 'kpi-16',
      title: 'Prepaid Value',
      value: formatINR(metrics.prepaidVal),
      desc: 'Pre-collected payments (Gateway / UPI)',
      icon: <IndianRupee size={15} />,
      colorClass: 'border-slate-800 hover:border-purple-600/50 text-purple-400',
      iconColor: 'bg-purple-500/10 text-purple-400',
      compBadge: null,
      onClick: () => onDrillDown('Prepaid Orders', 'Orders paid in advance', o => !isCodOrder(o))
    },
    {
      id: 'kpi-17',
      title: 'COD Value',
      value: formatINR(metrics.codVal),
      desc: 'Cash on delivery order value',
      icon: <IndianRupee size={15} />,
      colorClass: 'border-slate-800 hover:border-cyan-600/50 text-cyan-400',
      iconColor: 'bg-cyan-500/10 text-cyan-400',
      compBadge: null,
      onClick: () => onDrillDown('COD Orders', 'Cash on delivery orders', o => isCodOrder(o))
    },
    {
      id: 'kpi-18',
      title: 'COD Pending Collection',
      value: formatINR(metrics.codPendingCollection),
      desc: 'In-transit & pending delivery COD',
      icon: <CalendarClock size={15} />,
      colorClass: 'border-slate-800 hover:border-amber-600/50 text-amber-400',
      iconColor: 'bg-amber-500/10 text-amber-400',
      compBadge: null,
      onClick: () => onDrillDown('COD Pending Collection', 'Dispatched COD orders not yet delivered', o => {
        return isCodOrder(o) && isDispatchedOrder(o) && getCanonicalStatus(o) !== 'Delivered' && !getCanonicalStatus(o).includes('RTO');
      })
    },
    {
      id: 'kpi-19',
      title: 'Avg Delivery Time',
      value: metrics.avgDeliveryTimeDays ? `${metrics.avgDeliveryTimeDays} days` : '—',
      desc: 'From dispatch to doorstep delivery',
      icon: <Timer size={15} />,
      colorClass: 'border-slate-800 hover:border-blue-600/50 text-blue-300',
      iconColor: 'bg-blue-500/10 text-blue-400',
      compBadge: null,
      onClick: () => onDrillDown('Delivered Orders with Transit Time', 'Delivered orders transit duration', o => getCanonicalStatus(o) === 'Delivered')
    },
    {
      id: 'kpi-20',
      title: 'Delivered Within SLA',
      value: metrics.deliveredWithinSla.toLocaleString('en-IN'),
      desc: 'Delivered on or before estimated date',
      icon: <CheckCheck size={15} />,
      colorClass: 'border-slate-800 hover:border-emerald-600/50 text-emerald-400',
      iconColor: 'bg-emerald-500/10 text-emerald-400',
      compBadge: null,
      onClick: () => onDrillDown('Orders Delivered Within SLA', 'Delivered on or before SLA deadline', o => {
        const sla = checkDeliverySla(o);
        return sla.isDelivered && sla.isOnTime;
      })
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers size={16} className="text-purple-400" />
            <span>Logistics Overview — Key Performance Indicators (20)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Click any KPI card to view matching records in the paginated drill-down table
          </p>
        </div>
        {periodComp.hasComparison && (
          <div className="text-[11px] font-mono text-slate-400 bg-[#0e1626] border border-slate-800 px-2.5 py-1 rounded-lg">
            Compared with: <span className="text-cyan-300 font-semibold">{periodComp.prevRangeDisplay}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.id}
            onClick={card.onClick}
            className={`bg-[#0b1220] border rounded-2xl p-3.5 shadow-md flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg group ${card.colorClass}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-200 truncate">
                  {card.title}
                </span>
                <div className={`p-1.5 rounded-lg shrink-0 ${card.iconColor}`}>
                  {card.icon}
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                  {card.value}
                </span>
                {card.compBadge}
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 line-clamp-1">
                {card.desc}
              </span>
              <ChevronRight size={12} className="text-slate-500 group-hover:text-white shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
