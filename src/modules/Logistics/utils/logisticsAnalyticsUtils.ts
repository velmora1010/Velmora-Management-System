import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../config/courierConfig';
import { isDispatchedOrder, normalizeState, resolveStateFromPincode, parseOrderAmount } from '../../../utils/logisticsOrderUtils';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';
import type { LogisticsFilterState } from '../types/logisticsFilters';
import { resolveDateRangeForPreset, formatLocalYMD } from '../types/logisticsFilters';

export type CanonicalLogisticsStatus =
  | 'Delivered'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Ready for Dispatch'
  | 'Pending Dispatch'
  | 'Pending Tracking Update'
  | 'Delivery Attempt Failed'
  | 'Delayed / SLA Breached'
  | 'RTO Initiated'
  | 'RTO In Transit'
  | 'RTO Delivered to Seller'
  | 'Cancelled'
  | 'Shipment Exception';

export const ALL_CANONICAL_STATUSES: CanonicalLogisticsStatus[] = [
  'Delivered',
  'In Transit',
  'Out for Delivery',
  'Ready for Dispatch',
  'Pending Dispatch',
  'Pending Tracking Update',
  'Delivery Attempt Failed',
  'Delayed / SLA Breached',
  'RTO Initiated',
  'RTO In Transit',
  'RTO Delivered to Seller',
  'Cancelled',
  'Shipment Exception'
];

export interface StatusMetadata {
  label: CanonicalLogisticsStatus;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  category: 'delivered' | 'transit' | 'pending' | 'rto' | 'exception' | 'cancelled';
}

export const STATUS_METADATA_MAP: Record<CanonicalLogisticsStatus, StatusMetadata> = {
  'Delivered': {
    label: 'Delivered',
    color: '#10b981', // emerald
    badgeBg: 'bg-emerald-950/60',
    badgeBorder: 'border-emerald-600/40',
    badgeText: 'text-emerald-400',
    category: 'delivered'
  },
  'In Transit': {
    label: 'In Transit',
    color: '#3b82f6', // blue
    badgeBg: 'bg-blue-950/60',
    badgeBorder: 'border-blue-600/40',
    badgeText: 'text-blue-400',
    category: 'transit'
  },
  'Out for Delivery': {
    label: 'Out for Delivery',
    color: '#06b6d4', // cyan
    badgeBg: 'bg-cyan-950/60',
    badgeBorder: 'border-cyan-600/40',
    badgeText: 'text-cyan-400',
    category: 'transit'
  },
  'Ready for Dispatch': {
    label: 'Ready for Dispatch',
    color: '#8b5cf6', // purple
    badgeBg: 'bg-purple-950/60',
    badgeBorder: 'border-purple-600/40',
    badgeText: 'text-purple-400',
    category: 'pending'
  },
  'Pending Dispatch': {
    label: 'Pending Dispatch',
    color: '#6366f1', // indigo
    badgeBg: 'bg-indigo-950/60',
    badgeBorder: 'border-indigo-600/40',
    badgeText: 'text-indigo-400',
    category: 'pending'
  },
  'Pending Tracking Update': {
    label: 'Pending Tracking Update',
    color: '#f59e0b', // amber
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-600/40',
    badgeText: 'text-amber-400',
    category: 'pending'
  },
  'Delivery Attempt Failed': {
    label: 'Delivery Attempt Failed',
    color: '#f97316', // orange
    badgeBg: 'bg-orange-950/60',
    badgeBorder: 'border-orange-600/40',
    badgeText: 'text-orange-400',
    category: 'exception'
  },
  'Delayed / SLA Breached': {
    label: 'Delayed / SLA Breached',
    color: '#eab308', // yellow
    badgeBg: 'bg-yellow-950/60',
    badgeBorder: 'border-yellow-600/40',
    badgeText: 'text-yellow-400',
    category: 'exception'
  },
  'RTO Initiated': {
    label: 'RTO Initiated',
    color: '#f43f5e', // rose
    badgeBg: 'bg-rose-950/60',
    badgeBorder: 'border-rose-600/40',
    badgeText: 'text-rose-400',
    category: 'rto'
  },
  'RTO In Transit': {
    label: 'RTO In Transit',
    color: '#e11d48', // rose-red
    badgeBg: 'bg-rose-950/80',
    badgeBorder: 'border-rose-500/60',
    badgeText: 'text-rose-300',
    category: 'rto'
  },
  'RTO Delivered to Seller': {
    label: 'RTO Delivered to Seller',
    color: '#be123c', // deep rose
    badgeBg: 'bg-red-950/90',
    badgeBorder: 'border-red-600/50',
    badgeText: 'text-red-300',
    category: 'rto'
  },
  'Cancelled': {
    label: 'Cancelled',
    color: '#64748b', // slate
    badgeBg: 'bg-slate-900/80',
    badgeBorder: 'border-slate-700/60',
    badgeText: 'text-slate-400',
    category: 'cancelled'
  },
  'Shipment Exception': {
    label: 'Shipment Exception',
    color: '#ec4899', // pink
    badgeBg: 'bg-pink-950/60',
    badgeBorder: 'border-pink-600/40',
    badgeText: 'text-pink-400',
    category: 'exception'
  }
};

/**
 * Universal canonical status classification for all 13 standard statuses.
 * Guarantees zero duplicate counting and deterministic stage assignment.
 */
export function getCanonicalStatus(order: UnifiedLogisticsOrder): CanonicalLogisticsStatus {
  const statusStr = (order.status || '').toLowerCase().trim();
  const rawStatusStr = (order.rawStatus || '').toLowerCase().trim();
  const eventStr = (order.lastEvent || '').toLowerCase().trim();
  const finStr = (order.financialStatus || '').toLowerCase().trim();
  const todayStr = formatLocalYMD(new Date());

  // 1. Cancelled
  if (
    statusStr === 'cancelled' || 
    order.workflowStage === 'trash' || 
    finStr === 'voided' || 
    rawStatusStr.includes('cancel') ||
    order.stage === 'trash'
  ) {
    return 'Cancelled';
  }

  // 2. RTO (Return to Origin) categories
  const isRto = 
    statusStr.includes('rto') || 
    statusStr.includes('return') || 
    rawStatusStr.includes('rto') || 
    rawStatusStr.includes('return') ||
    eventStr.includes('rto') ||
    eventStr.includes('return to origin');

  if (isRto) {
    if (
      statusStr.includes('delivered to seller') || 
      statusStr.includes('delivered to sender') || 
      statusStr === 'returned' ||
      rawStatusStr.includes('delivered to seller') || 
      eventStr.includes('delivered to seller')
    ) {
      return 'RTO Delivered to Seller';
    }
    if (
      statusStr.includes('in transit') || 
      rawStatusStr.includes('transit') || 
      eventStr.includes('in transit') ||
      eventStr.includes('dispatched')
    ) {
      return 'RTO In Transit';
    }
    return 'RTO Initiated';
  }

  // 3. Delivered (Do not infer delivered merely because AWB exists)
  if (
    statusStr === 'delivered' || 
    rawStatusStr === 'delivered' || 
    (eventStr.includes('delivered') && !eventStr.includes('undelivered') && !eventStr.includes('attempt'))
  ) {
    return 'Delivered';
  }

  // 4. Delivery Attempt Failed / Undelivered
  if (
    statusStr.includes('failed attempt') || 
    statusStr === 'failed attempt' ||
    rawStatusStr.includes('undelivered') || 
    rawStatusStr.includes('attempt failed') || 
    rawStatusStr.includes('delivery failed') ||
    eventStr.includes('failed attempt') ||
    eventStr.includes('customer not available') ||
    eventStr.includes('undelivered')
  ) {
    return 'Delivery Attempt Failed';
  }

  // 5. Out for Delivery
  if (
    statusStr.includes('out for delivery') || 
    rawStatusStr.includes('out for delivery') || 
    eventStr.includes('out for delivery')
  ) {
    return 'Out for Delivery';
  }

  // 6. In Transit & Dispatched checks
  if (isDispatchedOrder(order)) {
    // Check SLA Breach / Overdue
    if (order.estimatedDeliveryDate && order.estimatedDeliveryDate < todayStr) {
      return 'Delayed / SLA Breached';
    }
    if (order.dispatchDate) {
      const parsedDispatch = parseAndFormatLogisticsDate(order.dispatchDate);
      if (parsedDispatch.isoDate) {
        const d1 = new Date(parsedDispatch.isoDate).getTime();
        const now = new Date(todayStr).getTime();
        const diffDays = Math.floor((now - d1) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          return 'Delayed / SLA Breached';
        }
      }
    }

    if (
      statusStr.includes('exception') || 
      rawStatusStr.includes('exception') || 
      (order.trackingError && order.trackingError.trim())
    ) {
      return 'Shipment Exception';
    }

    if (
      statusStr.includes('in transit') || 
      rawStatusStr.includes('in transit') || 
      rawStatusStr.includes('transit') || 
      eventStr.includes('in transit') ||
      eventStr.includes('bagging') ||
      eventStr.includes('hub')
    ) {
      return 'In Transit';
    }

    // Dispatched but no tracking events yet
    if (
      statusStr === 'awaiting tracking update' || 
      statusStr === 'info received' || 
      statusStr === 'pending' || 
      statusStr === 'not tracked' ||
      !order.syncedAt ||
      !order.lastEvent
    ) {
      return 'Pending Tracking Update';
    }

    return 'In Transit';
  }

  // 7. Non-dispatched orders
  if (order.workflowStage === 'prepare_dispatch' || order.stage === 'prepare_dispatch') {
    return 'Ready for Dispatch';
  }

  return 'Pending Dispatch';
}

/**
 * Checks SLA performance for a shipment
 */
export function checkDeliverySla(order: UnifiedLogisticsOrder): {
  isDelivered: boolean;
  isOnTime: boolean;
  isLate: boolean;
  isOverdue: boolean;
  isApproaching: boolean;
  deliveryDays: number | null;
  ageDays: number;
  slaDays: number;
  isEstimatedSla: boolean;
} {
  const status = getCanonicalStatus(order);
  const isDelivered = status === 'Delivered';
  const todayStr = formatLocalYMD(new Date());

  // Default SLA: 4 days standard if no promised date exists
  const standardSlaDays = 4;
  let slaDays = standardSlaDays;
  let isEstimatedSla = true;

  let deliveryDays: number | null = null;
  let ageDays = 0;

  if (order.dispatchDate) {
    const parsedDisp = parseAndFormatLogisticsDate(order.dispatchDate);
    if (parsedDisp.isoDate) {
      const dispTime = new Date(parsedDisp.isoDate).getTime();
      
      if (isDelivered && order.deliveredDate) {
        const parsedDel = parseAndFormatLogisticsDate(order.deliveredDate);
        if (parsedDel.isoDate) {
          const delTime = new Date(parsedDel.isoDate).getTime();
          if (delTime >= dispTime) {
            deliveryDays = Math.round((delTime - dispTime) / (1000 * 60 * 60 * 24));
          }
        }
      }

      const nowTime = new Date(todayStr).getTime();
      ageDays = Math.max(0, Math.floor((nowTime - dispTime) / (1000 * 60 * 60 * 24)));
    }
  }

  if (order.estimatedDeliveryDate && order.dispatchDate) {
    const parsedEst = parseAndFormatLogisticsDate(order.estimatedDeliveryDate);
    const parsedDisp = parseAndFormatLogisticsDate(order.dispatchDate);
    if (parsedEst.isoDate && parsedDisp.isoDate) {
      const diff = Math.round((new Date(parsedEst.isoDate).getTime() - new Date(parsedDisp.isoDate).getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        slaDays = diff;
        isEstimatedSla = false;
      }
    }
  }

  // Delivery evaluation
  let isOnTime = false;
  let isLate = false;
  let isOverdue = false;
  let isApproaching = false;

  if (isDelivered) {
    if (order.estimatedDeliveryDate && order.deliveredDate) {
      isOnTime = order.deliveredDate <= order.estimatedDeliveryDate;
      isLate = !isOnTime;
    } else if (deliveryDays !== null) {
      isOnTime = deliveryDays <= slaDays;
      isLate = deliveryDays > slaDays;
    } else {
      isOnTime = true; // Default fallback for delivered without dates
    }
  } else if (isDispatchedOrder(order) && !status.includes('RTO') && status !== 'Cancelled') {
    if (order.estimatedDeliveryDate) {
      if (order.estimatedDeliveryDate < todayStr) {
        isOverdue = true;
      } else {
        const estTime = new Date(order.estimatedDeliveryDate).getTime();
        const nowTime = new Date(todayStr).getTime();
        const diffDays = Math.floor((estTime - nowTime) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) {
          isApproaching = true;
        }
      }
    } else {
      if (ageDays > standardSlaDays) {
        isOverdue = true;
      } else if (ageDays >= standardSlaDays - 1) {
        isApproaching = true;
      }
    }
  }

  return {
    isDelivered,
    isOnTime,
    isLate,
    isOverdue,
    isApproaching,
    deliveryDays,
    ageDays,
    slaDays,
    isEstimatedSla
  };
}

/**
 * Calculates Previous-Period Comparison for KPIs
 */
export function calculatePeriodComparison(
  currentOrders: UnifiedLogisticsOrder[],
  allOrders: UnifiedLogisticsOrder[],
  filters: LogisticsFilterState
): {
  hasComparison: boolean;
  prevRangeDisplay: string;
  orderCountChangePct: number | null;
  valueChangePct: number | null;
  deliveredChangePct: number | null;
  rtoChangePct: number | null;
} {
  // If no date filter is active, or preset is 'all', comparison is not applicable
  if (filters.datePreset === 'all' && !filters.startDate && !filters.endDate) {
    return {
      hasComparison: false,
      prevRangeDisplay: '',
      orderCountChangePct: null,
      valueChangePct: null,
      deliveredChangePct: null,
      rtoChangePct: null
    };
  }

  let curStart = filters.startDate;
  let curEnd = filters.endDate;
  if (filters.datePreset !== 'all' && filters.datePreset !== 'custom') {
    const resolved = resolveDateRangeForPreset(filters.datePreset);
    curStart = resolved.start;
    curEnd = resolved.end;
  }

  if (!curStart || !curEnd) {
    return {
      hasComparison: false,
      prevRangeDisplay: '',
      orderCountChangePct: null,
      valueChangePct: null,
      deliveredChangePct: null,
      rtoChangePct: null
    };
  }

  const d1 = new Date(curStart);
  const d2 = new Date(curEnd);
  const spanMs = d2.getTime() - d1.getTime();
  const spanDays = Math.max(1, Math.round(spanMs / (1000 * 60 * 60 * 24)) + 1);

  // Previous period: same number of days immediately prior
  const prevEndObj = new Date(d1.getTime() - (1000 * 60 * 60 * 24));
  const prevStartObj = new Date(prevEndObj.getTime() - ((spanDays - 1) * 1000 * 60 * 60 * 24));
  const prevStartStr = formatLocalYMD(prevStartObj);
  const prevEndStr = formatLocalYMD(prevEndObj);

  // Filter allOrders for previous period
  const prevOrders = allOrders.filter(o => {
    let rawDate = '';
    if (filters.dateField === 'orderDate') rawDate = o.orderDate || '';
    else if (filters.dateField === 'dispatchDate') rawDate = o.dispatchDate || '';
    else if (filters.dateField === 'deliveredDate') rawDate = o.deliveredDate || '';
    else rawDate = o.syncedAt || o.lastUpdated || '';

    if (!rawDate) return false;
    const parsed = parseAndFormatLogisticsDate(rawDate);
    const ymd = parsed.isoDate || (rawDate.slice(0, 10));
    return ymd >= prevStartStr && ymd <= prevEndStr;
  });

  if (prevOrders.length === 0) {
    return {
      hasComparison: false,
      prevRangeDisplay: `${prevStartStr} to ${prevEndStr}`,
      orderCountChangePct: null,
      valueChangePct: null,
      deliveredChangePct: null,
      rtoChangePct: null
    };
  }

  const curCount = currentOrders.length;
  const prevCount = prevOrders.length;
  const orderCountChangePct = Math.round(((curCount - prevCount) / prevCount) * 100);

  const curVal = currentOrders.reduce((sum, o) => sum + (parseOrderAmount(o.amount ?? o.totalAmount) || 0), 0);
  const prevVal = prevOrders.reduce((sum, o) => sum + (parseOrderAmount(o.amount ?? o.totalAmount) || 0), 0);
  const valueChangePct = prevVal > 0 ? Math.round(((curVal - prevVal) / prevVal) * 100) : null;

  const curDel = currentOrders.filter(o => getCanonicalStatus(o) === 'Delivered').length;
  const prevDel = prevOrders.filter(o => getCanonicalStatus(o) === 'Delivered').length;
  const deliveredChangePct = prevDel > 0 ? Math.round(((curDel - prevDel) / prevDel) * 100) : null;

  const curRto = currentOrders.filter(o => getCanonicalStatus(o).includes('RTO')).length;
  const prevRto = prevOrders.filter(o => getCanonicalStatus(o).includes('RTO')).length;
  const rtoChangePct = prevRto > 0 ? Math.round(((curRto - prevRto) / prevRto) * 100) : null;

  return {
    hasComparison: true,
    prevRangeDisplay: `${prevStartStr} to ${prevEndStr}`,
    orderCountChangePct,
    valueChangePct,
    deliveredChangePct,
    rtoChangePct
  };
}

/**
 * Format currency in Indian Rupees
 */
export function formatINR(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0';
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

/**
 * Helper to check if order is COD
 */
export function isCodOrder(o: UnifiedLogisticsOrder): boolean {
  const type = (o.orderType || '').toUpperCase();
  return type.includes('COD');
}

/**
 * Safe Age Bucket calculation
 */
export function getShipmentAgeBucket(ageDays: number): '0–1' | '2–3' | '4–7' | '8–14' | '15+' {
  if (ageDays <= 1) return '0–1';
  if (ageDays <= 3) return '2–3';
  if (ageDays <= 7) return '4–7';
  if (ageDays <= 14) return '8–14';
  return '15+';
}
