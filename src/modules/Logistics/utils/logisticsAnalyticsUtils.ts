import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../config/courierConfig';
import { isDispatchedOrder, normalizeState, resolveStateFromPincode, parseOrderAmount } from '../../../utils/logisticsOrderUtils';
import { decodeHtmlEntities } from '../../../utils/textSanitizer';
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
  | 'Shipment Exception'
  | 'Deleted';

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
  'Shipment Exception',
  'Deleted'
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
  },
  'Deleted': {
    label: 'Deleted',
    color: '#ef4444', // red
    badgeBg: 'bg-rose-950/70',
    badgeBorder: 'border-rose-600/50',
    badgeText: 'text-rose-400',
    category: 'cancelled'
  }
};

/**
 * Robust predicate to determine whether an order is marked as DELETED or trashed across Sales and Logistics.
 * Genuinely deleted orders carry explicit tombstones or explicit deletion flags.
 * Orders with verified terminal delivery events are protected from spurious local cache/staging deletion flags.
 */
export function isDeletedOrder(order: any): boolean {
  if (!order) return false;
  const extra = order.extra_data || {};
  const orderStatusStr = String(order.order_status || '').toLowerCase().trim();
  const statusStr = String(order.status || order.shipment_status || extra.delhivery_status_type || '').toLowerCase().trim();
  const rawStatusStr = String(order.rawStatus || order.raw_status || extra.delhivery_current_status || extra.raw_status || '').toLowerCase().trim();
  const dispatchStatusStr = String(order.dispatch_status || '').toLowerCase().trim();

  // Authoritative protection: Orders with verified terminal delivery cannot be marked deleted
  const isDelivered = 
    statusStr === 'delivered' || 
    rawStatusStr === 'delivered' || 
    dispatchStatusStr === 'delivered' ||
    (order.fulfillment_status || '').toLowerCase() === 'fulfilled' ||
    (extra.fulfillment_status || '').toLowerCase() === 'fulfilled' ||
    Boolean(order.delivered_date || order.deliveredDate || extra.delivered_date || order.fulfilled_date || extra.fulfilled_date);

  if (isDelivered) {
    return false;
  }

  // Authoritative protection: Orders cancelled in source/Shopify cannot be marked deleted
  const isCancelled =
    orderStatusStr === 'cancelled' ||
    statusStr === 'cancelled' ||
    rawStatusStr.includes('cancel') ||
    Boolean(order.cancellation && (order.cancellation.status === 'CANCELLED' || String(order.cancellation.status).toLowerCase() === 'cancelled')) ||
    Boolean(extra.cancellation && (extra.cancellation.status === 'CANCELLED' || String(extra.cancellation.status).toLowerCase() === 'cancelled')) ||
    order.cancellationStatus === 'Completed' ||
    Boolean(order.isCancelled) ||
    Boolean(extra.cancellation_requested_at || extra.cancelled_at);

  if (isCancelled) {
    return false;
  }

  if (orderStatusStr === 'deleted') return true;
  if (Boolean(order.isDeleted || order.is_deleted || extra.is_deleted || extra.tombstone)) return true;

  // Explicit tracking tombstone
  if (statusStr === 'order deleted' || rawStatusStr === 'order deleted' || (statusStr === 'deleted' && rawStatusStr === 'deleted')) {
    return true;
  }

  // Deletion timestamp on an un-delivered, non-cancelled order
  if (Boolean(order.deletedAt || order.deleted_at || extra.deleted_at)) {
    return true;
  }

  // Explicit deletion in staging Dexie orders (status: 'Deleted' with explicit deletion reason, not just staging trash)
  const stage = String(order.stage || order.workflowStage || '').toLowerCase().trim();
  if (stage === 'trash' && statusStr === 'deleted' && (order.trashReason?.toLowerCase().includes('delete') || order.remarks?.toLowerCase().includes('delete'))) {
    return true;
  }

  return false;
}

/**
 * Universal canonical status classification for all standard statuses.
 * Guarantees zero duplicate counting and deterministic stage assignment.
 */
export function getCanonicalStatus(order: any): CanonicalLogisticsStatus {
  const extra = order.extra_data || {};
  const statusStr = (order.status || order.shipment_status || order.order_status || order.dispatch_status || order.fulfillment_status || extra.delhivery_status_type || '').toLowerCase().trim();
  const rawStatusStr = (order.rawStatus || order.raw_status || extra.delhivery_current_status || extra.raw_status || '').toLowerCase().trim();
  const eventStr = (order.lastEvent || extra.delhivery_remarks || '').toLowerCase().trim();
  const remarksStr = (order.remarks || extra.delhivery_remarks || '').toLowerCase().trim();
  const finStr = (order.financialStatus || order.financial_status || extra.financial_status || '').toLowerCase().trim();
  const todayStr = formatLocalYMD(new Date());

  // === TIER 1: BOT Verified Tracking Events Precedence ===
  const stTrack = extra.st_courier_tracking || {};
  const botEvents: Array<{ activity?: string; location?: string; timestamp?: string }> = Array.isArray(stTrack.events) ? stTrack.events : [];
  let botHasRtoEvent = false;
  let botHasTerminalDelivery = false;

  if (botEvents.length > 0) {
    for (let i = 0; i < botEvents.length; i++) {
      const act = (botEvents[i]?.activity || '').toLowerCase().trim();
      if (
        act.includes('rto') ||
        act.includes('return to origin') ||
        act.includes('return to orgin') ||
        act.includes('returntoorigin') ||
        act.includes('returntoorgin') ||
        act.includes('returned to seller') ||
        act.includes('party refused') ||
        act.includes('address not found') ||
        act.includes('no service')
      ) {
        botHasRtoEvent = true;
      }
      // If the latest event (index 0) is explicitly Delivered, it confirms physical delivery
      if (i === 0 && (act === 'delivered' || act.includes('delivered to consignee'))) {
        botHasTerminalDelivery = true;
      }
    }
  }

  const botStatusStr = String(stTrack.status || '').toLowerCase().trim();
  if (botStatusStr === 'rto' || botStatusStr.includes('rto')) {
    botHasRtoEvent = true;
  }
  if (botStatusStr === 'delivered') {
    botHasTerminalDelivery = true;
  }

  // === TIER 2: Carrier File Current Status / Current stauts Precedence ===
  const currentStatusStr = String(
    extra.current_status ||
    extra['Current Status'] ||
    extra['Current stauts'] ||
    extra.st_current_status ||
    order.current_status ||
    order.currentStatus ||
    rawStatusStr ||
    ''
  ).toLowerCase().trim();

  const isCurrentStatusRto =
    currentStatusStr.includes('return to origin') ||
    currentStatusStr.includes('return to orgin') ||
    currentStatusStr.includes('returntoorigin') ||
    currentStatusStr.includes('returntoorgin') ||
    currentStatusStr === 'rto' ||
    currentStatusStr.startsWith('rto ') ||
    currentStatusStr.includes(' rto ') ||
    currentStatusStr.endsWith(' rto') ||
    currentStatusStr.includes('returned to origin') ||
    currentStatusStr.includes('delivered to seller') ||
    currentStatusStr.includes('returned to seller');

  const isCurrentStatusCancelled =
    currentStatusStr === 'cancelled' ||
    currentStatusStr === 'canceled' ||
    currentStatusStr.includes('cancel');

  const isCurrentStatusDelivered =
    currentStatusStr === 'delivered' ||
    currentStatusStr.includes('delivered to consignee');

  // === TIER 3: Status Type Fallback ===
  const statusTypeStr = String(
    extra.status_type ||
    extra['Status Type'] ||
    order.status_type ||
    ''
  ).toLowerCase().trim();

  // 0. Explicit RTO Detection (Carrier return confirmation takes absolute precedence over stale dispatch flags)
  // Precedence 1 (BOT RTO without subsequent delivery) or Precedence 2 (Carrier file Current Status confirms RTO)
  const isExplicitRto =
    (botHasRtoEvent && !botHasTerminalDelivery) ||
    isCurrentStatusRto ||
    statusStr.includes('rto') ||
    statusStr.includes('return to origin') ||
    statusStr.includes('return to orgin') ||
    statusStr.includes('returntoorigin') ||
    statusStr.includes('returntoorgin') ||
    statusStr.includes('delivered to seller') ||
    statusStr.includes('delivered to sender') ||
    statusStr.includes('returned to origin') ||
    statusStr.includes('returned to seller') ||
    rawStatusStr.includes('rto') ||
    rawStatusStr.includes('return to origin') ||
    rawStatusStr.includes('return to orgin') ||
    rawStatusStr.includes('returntoorigin') ||
    rawStatusStr.includes('returntoorgin') ||
    rawStatusStr.includes('delivered_seller') ||
    rawStatusStr.includes('delivered to seller') ||
    rawStatusStr.includes('delivered to sender') ||
    rawStatusStr.includes('returned_to_origin') ||
    rawStatusStr.includes('returned to origin') ||
    rawStatusStr.includes('returned to seller') ||
    rawStatusStr.includes('returning to origin') ||
    rawStatusStr.includes('returning_to_origin') ||
    eventStr.includes('rto') ||
    eventStr.includes('return to origin') ||
    eventStr.includes('return to orgin') ||
    eventStr.includes('returntoorigin') ||
    eventStr.includes('returntoorgin') ||
    eventStr.includes('delivered to seller') ||
    remarksStr.includes('rto') ||
    remarksStr.includes('return to origin') ||
    remarksStr.includes('return to orgin') ||
    remarksStr.includes('returntoorigin') ||
    remarksStr.includes('returntoorgin') ||
    remarksStr.includes('delivered to seller');

  // 1. Cancelled (Commercial source cancellation or carrier file cancellation takes precedence over generic Un Delivered)
  const isCancelled =
    isCurrentStatusCancelled ||
    order.order_status === 'CANCELLED' ||
    (order.order_status || '').toLowerCase() === 'cancelled' ||
    statusStr === 'cancelled' || 
    statusStr === 'canceled' ||
    finStr === 'voided' || 
    rawStatusStr.includes('cancel') ||
    Boolean(order.cancellation && (order.cancellation.status === 'CANCELLED' || String(order.cancellation.status).toLowerCase() === 'cancelled')) ||
    Boolean(extra.cancellation && (extra.cancellation.status === 'CANCELLED' || String(extra.cancellation.status).toLowerCase() === 'cancelled')) ||
    order.cancellationStatus === 'Completed' ||
    Boolean(order.isCancelled) ||
    Boolean(extra.cancellation_requested_at || extra.cancelled_at);

  if (isCancelled && !isExplicitRto) {
    return 'Cancelled';
  }

  // 2. RTO (Return to Origin) categories
  if (isExplicitRto) {
    if (
      statusStr.includes('delivered to seller') || 
      statusStr.includes('delivered to sender') || 
      statusStr === 'returned' ||
      statusStr.includes('returned to origin') ||
      rawStatusStr.includes('delivered to seller') || 
      rawStatusStr.includes('delivered_seller') || 
      rawStatusStr.includes('returned_to_origin') ||
      rawStatusStr.includes('returned to origin') ||
      rawStatusStr === 'returned' ||
      eventStr.includes('delivered to seller') ||
      remarksStr.includes('delivered to seller')
    ) {
      return 'RTO Delivered to Seller';
    }
    if (
      statusStr.includes('in transit') || 
      rawStatusStr.includes('transit') || 
      rawStatusStr.includes('returning_to_origin') ||
      rawStatusStr.includes('returning to origin') ||
      rawStatusStr.includes('return to origin') ||
      rawStatusStr.includes('return to orgin') ||
      statusStr.includes('return to origin') ||
      statusStr.includes('return to orgin') ||
      eventStr.includes('in transit') ||
      eventStr.includes('dispatched') ||
      remarksStr.includes('transit')
    ) {
      return 'RTO In Transit';
    }
    return 'RTO Initiated';
  }

  // 3. Deleted (Genuinely deleted orders with no terminal delivery or valid cancellation)
  if (isDeletedOrder(order)) {
    return 'Deleted';
  }

  // 4. Delivered (Terminal delivery protection: physical delivery takes precedence when not RTO)
  const isDelivered = 
    botHasTerminalDelivery ||
    isCurrentStatusDelivered ||
    statusTypeStr === 'delivered' ||
    statusStr === 'delivered' || 
    rawStatusStr === 'delivered' || 
    String(order.dispatch_status || '').toLowerCase().trim() === 'delivered' ||
    Boolean(order.delivered_date || order.deliveredDate) ||
    (eventStr.includes('delivered') && !eventStr.includes('undelivered') && !eventStr.includes('un delivered') && !eventStr.includes('attempt'));

  if (isDelivered) {
    return 'Delivered';
  }

  // 5. Delivery Attempt Failed / Undelivered (Never map generic Un Delivered to RTO)
  if (
    statusTypeStr.includes('undelivered') ||
    statusTypeStr.includes('un delivered') ||
    statusStr.includes('failed attempt') || 
    statusStr === 'failed attempt' ||
    rawStatusStr.includes('undelivered') || 
    rawStatusStr.includes('un delivered') ||
    rawStatusStr.includes('attempt failed') || 
    rawStatusStr.includes('delivery failed') ||
    eventStr.includes('failed attempt') ||
    eventStr.includes('customer not available') ||
    eventStr.includes('undelivered') ||
    eventStr.includes('un delivered')
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
    const rawDisp = order.dispatchDate || (order as any).manifestDate || (order as any).pickupDate;
    const parsedDispatch = parseAndFormatLogisticsDate(rawDisp);
    const parsedEdd = parseAndFormatLogisticsDate(order.estimatedDeliveryDate);
    const estIso = order.estimatedDeliveryDateIso || parsedEdd.isoDate;
    const dispIso = order.dispatchDateIso || parsedDispatch.isoDate;
    const hasValidEdd = !!(estIso && (!dispIso || estIso >= dispIso));

    // Check SLA Breach / Overdue with valid date parsing
    if (hasValidEdd) {
      if (estIso < todayStr) {
        return 'Delayed / SLA Breached';
      }
    } else if (dispIso) {
      // Only fallback to transit elapsed days when no valid carrier EDD is provided
      const d1 = new Date(dispIso).getTime();
      const now = new Date(todayStr).getTime();
      const diffDays = Math.floor((now - d1) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        return 'Delayed / SLA Breached';
      }
    }

    // Do NOT classify upload parsing errors or sync unavailability as delivery exceptions
    const trackingErrLower = (order.trackingError || '').toLowerCase();
    const isUploadParsingError = trackingErrLower.includes('parsing error') || trackingErrLower.includes('upload parsing');

    if (
      !isUploadParsingError &&
      (statusStr.includes('exception') || 
       rawStatusStr.includes('exception') || 
       (order.trackingError && order.trackingError.trim() && !trackingErrLower.includes('sync not available')))
    ) {
      return 'Shipment Exception';
    }

    if (
      statusStr.includes('in transit') || 
      rawStatusStr.includes('in transit') || 
      rawStatusStr.includes('transit') || 
      rawStatusStr.includes('shipped') ||
      eventStr.includes('in transit') ||
      eventStr.includes('bagging') ||
      eventStr.includes('hub') ||
      eventStr.includes('vehicle departed') ||
      eventStr.includes('departed') ||
      eventStr.includes('facility') ||
      eventStr.includes('arrived') ||
      remarksStr.includes('vehicle departed') ||
      remarksStr.includes('departed') ||
      remarksStr.includes('facility')
    ) {
      return 'In Transit';
    }

    // Dispatched but no tracking events yet
    if (
      (statusStr === 'awaiting tracking update' || 
       statusStr === 'info received' || 
       statusStr === 'pending' || 
       statusStr === 'not tracked') &&
      !eventStr &&
      !remarksStr
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

  const rawDisp = order.dispatchDate || (order as any).manifestDate || (order as any).pickupDate;
  const parsedDisp = parseAndFormatLogisticsDate(rawDisp);
  const dispIso = order.dispatchDateIso || parsedDisp.isoDate;

  if (dispIso) {
    const dispTime = new Date(dispIso).getTime();
    
    if (isDelivered && order.deliveredDate) {
      const parsedDel = parseAndFormatLogisticsDate(order.deliveredDate);
      const delIso = order.deliveredDateIso || parsedDel.isoDate;
      if (delIso) {
        const delTime = new Date(delIso).getTime();
        if (delTime >= dispTime) {
          deliveryDays = Math.round((delTime - dispTime) / (1000 * 60 * 60 * 24));
        }
      }
    }

    const nowTime = new Date(todayStr).getTime();
    ageDays = Math.max(0, Math.floor((nowTime - dispTime) / (1000 * 60 * 60 * 24)));
  }

  const parsedEst = parseAndFormatLogisticsDate(order.estimatedDeliveryDate);
  const estIso = order.estimatedDeliveryDateIso || parsedEst.isoDate;
  const hasValidEdd = !!(estIso && (!dispIso || estIso >= dispIso));

  if (hasValidEdd && dispIso) {
    const diff = Math.round((new Date(estIso).getTime() - new Date(dispIso).getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) {
      slaDays = diff;
      isEstimatedSla = false;
    }
  }

  // Delivery evaluation
  let isOnTime = false;
  let isLate = false;
  let isOverdue = false;
  let isApproaching = false;

  if (isDelivered) {
    const parsedDel = parseAndFormatLogisticsDate(order.deliveredDate);
    const delIso = order.deliveredDateIso || parsedDel.isoDate;
    if (hasValidEdd && delIso) {
      isOnTime = delIso <= estIso;
      isLate = !isOnTime;
    } else if (deliveryDays !== null) {
      isOnTime = deliveryDays <= slaDays;
      isLate = deliveryDays > slaDays;
    } else {
      isOnTime = true; // Default fallback for delivered without dates
    }
  } else if (isDispatchedOrder(order) && !status.includes('RTO') && status !== 'Cancelled') {
    // Check if order is affected by an upload parsing error
    const rawError = `${order.trackingError || ''} ${order.remarks || ''}`.toLowerCase();
    const isUploadParsingError = rawError.includes('parsing error') || rawError.includes('upload parsing');

    if (!isUploadParsingError) {
      if (hasValidEdd) {
        if (estIso < todayStr) {
          isOverdue = true;
        } else {
          const estTime = new Date(estIso).getTime();
          const nowTime = new Date(todayStr).getTime();
          const diffDays = Math.floor((estTime - nowTime) / (1000 * 60 * 60 * 24));
          if (diffDays <= 2 && diffDays >= 0) {
            isApproaching = true;
          }
        }
      } else if (dispIso) {
        if (ageDays > standardSlaDays) {
          isOverdue = true;
        } else if (ageDays >= standardSlaDays - 1) {
          isApproaching = true;
        }
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
 * Helper to check if order is RTO
 */
export function isRtoOrder(order: any): boolean {
  const canonical = getCanonicalStatus(order);
  return canonical === 'RTO Initiated' || canonical === 'RTO In Transit' || canonical === 'RTO Delivered to Seller';
}

export type CanonicalPaymentCategory = 'PREPAID' | 'COD' | 'PARTIAL_COD' | 'UNKNOWN';

/**
 * Authoritative classification of order payment type based on ERP / Shopify financial data.
 * Does NOT rely on courier manifest alone (couriers mark partial COD shipments as COD).
 *
 * Rules:
 * 1. Financial status 'paid' -> PREPAID
 * 2. Financial status 'partially_paid' or explicit 'PARTIAL COD' / advance payment -> PARTIAL_COD
 * 3. Financial status 'pending' or explicit 'COD' / Cash on delivery -> COD
 * 4. Missing or unrecognized -> UNKNOWN (never silently assumed)
 */
export function classifyOrderPaymentType(o: any): CanonicalPaymentCategory {
  if (!o) return 'UNKNOWN';

  // 1. Authoritative financial status from source ERP / Shopify
  const fin = (o.financialStatus || o.financial_status || '').toString().toLowerCase().trim();
  if (fin === 'paid') return 'PREPAID';
  if (fin === 'partially_paid') return 'PARTIAL_COD';

  // 2. Authoritative payment mode / method strings
  const rawType = (
    o.orderType ||
    o.payment_mode ||
    o.paymentMode ||
    o.source_payment_mode ||
    o.source_payment_method ||
    o.payment_method ||
    ''
  ).toString().toUpperCase().trim();

  // Explicit Partial COD indicators (check BEFORE generic COD substring!)
  if (
    rawType === 'PARTIAL COD' ||
    rawType === 'PARTIAL_COD' ||
    rawType === 'PARTIAL' ||
    rawType.includes('PARTIAL') ||
    rawType.includes('UPI + CASH ON DELIVERY') ||
    rawType.includes('ADVANCE')
  ) {
    return 'PARTIAL_COD';
  }

  // Tags check for Partial COD / BreezeCart
  const tagsStr = Array.isArray(o.tags) ? o.tags.join(' ').toUpperCase() : String(o.tags || '').toUpperCase();
  if (tagsStr.includes('PARTIALLY_PAID') || (tagsStr.includes('PREPAID') && tagsStr.includes('COD'))) {
    return 'PARTIAL_COD';
  }

  // Prepaid variations
  if (
    rawType === 'PREPAID' ||
    rawType.includes('PREPAID') ||
    rawType.includes('PAID') ||
    rawType.includes('ONLINE') ||
    rawType.includes('UPI') ||
    rawType.includes('CARD') ||
    rawType.includes('RAZORPAY') ||
    rawType.includes('CASHFREE') ||
    rawType.includes('PHONEPE') ||
    rawType.includes('GPAY') ||
    rawType.includes('NETBANKING') ||
    rawType.includes('NET BANKING') ||
    rawType.includes('SHOPFLO') ||
    rawType.includes('STRIPE')
  ) {
    return 'PREPAID';
  }

  // Pure COD variations
  if (
    rawType === 'COD' ||
    rawType === 'CASH ON DELIVERY' ||
    rawType === 'PAY ON DELIVERY' ||
    rawType === 'CASH' ||
    rawType.includes('CASH ON DELIVERY') ||
    rawType.includes('PAY ON DELIVERY')
  ) {
    return 'COD';
  }

  // Pending financial status in Indian D2C is pure COD when not marked partial
  if (fin === 'pending') {
    return 'COD';
  }

  // Unknown / unrecognized payment method
  return 'UNKNOWN';
}

/**
 * Helper to check if order is pure COD
 */
export function isCodOrder(o: any): boolean {
  return classifyOrderPaymentType(o) === 'COD';
}

/**
 * Helper to check if order has prepaid funds (Pure Prepaid OR Partial COD with online advance)
 */
export function isPrepaidOrder(o: any): boolean {
  const cat = classifyOrderPaymentType(o);
  return cat === 'PREPAID' || cat === 'PARTIAL_COD';
}

/**
 * Helper to check if order is 100% pure prepaid
 */
export function isPurePrepaidOrder(o: any): boolean {
  return classifyOrderPaymentType(o) === 'PREPAID';
}

/**
 * Helper to check if order is Partial COD
 */
export function isPartialCodOrder(o: any): boolean {
  return classifyOrderPaymentType(o) === 'PARTIAL_COD';
}

/**
 * Helper to check if order has unknown/unrecognized payment mode
 */
export function isUnknownPaymentOrder(o: any): boolean {
  return classifyOrderPaymentType(o) === 'UNKNOWN';
}

export interface CourierPerformanceSummary {
  courier: string;
  total: number;
  delivered: number;
  rto: number;
  inTransit: number;
  otherStatuses: number;
  cancelled: number;
  deleted?: number;
  deliveryRate: string;
  rtoRate: string;
  orders: any[];
  deliveredOrders?: any[];
  rtoOrders?: any[];
  inTransitOrders?: any[];
  otherOrders?: any[];
  cancelledOrders?: any[];
  deletedOrders?: any[];
  otherStatusBreakdown?: Record<string, number>;
}

export interface OtherStatusOrderDetail {
  orderId: string;
  awbNumber: string;
  customerName: string;
  courier: string;
  originalCarrierStatus: string;
  normalizedStatus: string;
  orderDate: string;
  latestTrackingEvent: string;
  classificationReason: string;
  city?: string;
  state?: string;
  orderAmount?: number;
  order: any;
}

/**
 * Retrieves the genuine, un-normalized carrier status or operational tracking remark
 * for an order classified under Other Statuses. Preserves carrier source integrity.
 */
export function getOrderOriginalCarrierStatus(order: any): string {
  if (!order) return 'Awaiting Tracking Update';
  const extra = order.extra_data || {};

  // 1. Explicit carrier remarks (e.g. "Shipment damaged", "Package found in Audit", "Consignee Unavailable")
  const remark = order.remarks || extra.delhivery_remarks || extra.remarks || order.lastEvent || extra.lastEvent;
  if (remark && typeof remark === 'string' && remark.trim()) {
    const rLower = remark.toLowerCase().trim();
    if (!rLower.includes('sync not available') && !rLower.includes('parsing error') && !rLower.includes('tracking not uploaded')) {
      const trimmed = remark.trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }

  // 2. Carrier Current Status (from consignment register or tracking API)
  const currentStatus = extra.current_status || extra['Current Status'] || extra['Current stauts'] || extra.delhivery_current_status || order.current_status || order.currentStatus;
  if (currentStatus && typeof currentStatus === 'string' && currentStatus.trim() && currentStatus !== 'undefined' && currentStatus !== 'null') {
    const cs = currentStatus.trim();
    return cs.charAt(0).toUpperCase() + cs.slice(1);
  }

  // 3. Carrier Status Type
  const statusType = extra.status_type || extra['Status Type'] || extra.delhivery_status_type || order.status_type;
  if (statusType && typeof statusType === 'string' && statusType.trim() && statusType !== 'undefined' && statusType !== 'null') {
    const st = statusType.trim();
    return st.charAt(0).toUpperCase() + st.slice(1);
  }

  // 4. Shipment / Tracking status (e.g. "Awaiting Tracking Update")
  const stat = order.status || order.shipment_status || extra.status;
  if (stat && typeof stat === 'string' && stat.trim() && stat !== 'undefined' && stat !== 'null') {
    return stat.trim();
  }

  // 5. Raw status
  const raw = order.raw_status || order.rawStatus || extra.raw_status;
  if (raw && typeof raw === 'string' && raw.trim() && raw !== 'undefined' && raw !== 'null') {
    return raw.trim();
  }

  // 6. Dispatch status
  const disp = order.dispatch_status || order.dispatchStatus;
  if (disp && typeof disp === 'string' && disp.trim() && disp !== 'undefined' && disp !== 'null') {
    return disp.trim();
  }

  return 'Awaiting Tracking Update';
}

/**
 * Builds a comprehensive, transparent diagnostics object for any order in Other Statuses.
 */
export function getOtherStatusDetail(order: any): OtherStatusOrderDetail {
  const extra = order.extra_data || {};
  const rawId = order.order_id || order.orderId || order.id || '';
  const orderId = String(rawId).replace(/^[#]/, '').trim();
  const awbNumber = String(order.awb_number || order.awbNumber || extra.awb_number || extra.awb || '').trim() || 'No AWB';
  const customerName = order.customer_name || order.customerName || 'Customer';
  const courier = normalizeCourierName(order.courier || order.courier_name || extra.courier);
  const originalCarrierStatus = getOrderOriginalCarrierStatus(order);
  const normalizedStatus = getCanonicalStatus(order);
  const orderDate = order.order_date || order.orderDate || 'N/A';
  const city = order.city || extra.city || '';
  const state = order.state || extra.state || '';
  const orderAmount = parseOrderAmount(order.amount ?? order.totalAmount ?? order.price ?? order.order_total) || 0;

  // Determine latest tracking event
  const stTrack = extra.st_courier_tracking || {};
  const botEvents: Array<{ activity?: string; location?: string; timestamp?: string }> = Array.isArray(stTrack.events) ? stTrack.events : [];
  let latestTrackingEvent = 'Awaiting initial carrier report scan';

  if (botEvents.length > 0 && botEvents[0]?.activity) {
    latestTrackingEvent = `${botEvents[0].activity}${botEvents[0].location ? ` (${botEvents[0].location})` : ''}`;
  } else if (order.remarks || extra.delhivery_remarks) {
    const loc = order.last_location || order.lastLocation || extra.last_location;
    latestTrackingEvent = `${order.remarks || extra.delhivery_remarks}${loc ? ` at ${loc}` : ''}`;
  } else if (order.lastEvent || extra.lastEvent) {
    latestTrackingEvent = order.lastEvent || extra.lastEvent;
  } else if (order.dispatch_date || order.dispatchDate) {
    latestTrackingEvent = `Dispatched on ${order.dispatch_date || order.dispatchDate}; awaiting courier milestone update`;
  }

  // Determine classification reason
  let classificationReason = '';
  const isSt = courier.toLowerCase().includes('st');
  const cleanAwb = awbNumber.replace(/[^0-9]/g, '');

  if (isSt && cleanAwb && cleanAwb.length !== 11) {
    classificationReason = `Manual AWB (${awbNumber}, ${cleanAwb.length} digits) does not match standard 11-digit ST Courier format; not found in carrier consignment file.`;
  } else if (isSt && cleanAwb.length === 11) {
    classificationReason = `ST Courier waybill present but no delivery, RTO, or transit scan found in consignment files.`;
  } else if (originalCarrierStatus.toLowerCase().includes('damaged')) {
    classificationReason = `Carrier reported shipment damaged in transit; held at hub without delivery or RTO resolution.`;
  } else if (originalCarrierStatus.toLowerCase().includes('audit')) {
    classificationReason = `Package flagged during carrier hub audit; held in transit pending clearance.`;
  } else if (originalCarrierStatus.toLowerCase().includes('unavailable') || originalCarrierStatus.toLowerCase().includes('attempt')) {
    classificationReason = `Delivery attempt failed (consignee unavailable); awaiting carrier reattempt.`;
  } else if (awbNumber === 'No AWB' || !cleanAwb) {
    classificationReason = `Order has no waybill generated; excluded from carrier manifests.`;
  } else {
    classificationReason = `Dispatched order with AWB ${awbNumber}; awaiting terminal delivery or RTO confirmation.`;
  }

  return {
    orderId,
    awbNumber,
    customerName,
    courier,
    originalCarrierStatus,
    normalizedStatus,
    orderDate,
    latestTrackingEvent,
    classificationReason,
    city,
    state,
    orderAmount,
    order
  };
}

export function normalizeCourierName(courierName?: string | null): string {
  if (!courierName || !courierName.trim()) return 'Unknown / Not Available';
  const lower = courierName.toLowerCase().trim();
  if (lower.includes('ekart')) return 'Ekart';
  if (lower.includes('amazon')) return 'Amazon Shipping';
  if (lower.includes('india post') || lower.includes('speed post')) return 'India Post';
  if (
    lower === 'st' ||
    lower.startsWith('st ') ||
    lower.includes('st courier') ||
    lower.includes('st-courier') ||
    lower.includes('st_courier') ||
    lower.includes('stcourier')
  ) return 'ST Courier';
  if (lower.includes('delhivery')) return 'Delhivery';
  if (
    lower === 'house' ||
    lower === 'house courier' ||
    lower === 'in-house' ||
    lower === 'in house' ||
    lower === 'internal' ||
    lower === 'internal courier' ||
    lower === 'direct delivery' ||
    lower === 'self delivery'
  ) return 'House';
  return courierName.trim();
}

export interface RtoMetricsSummary {
  totalRtoOrders: number;
  totalRtoValue: number;
  totalRto: number;
  rtoVal: number;
  codRtoCount: number;
  codRtoVal: number;
  prepaidRtoCount: number;
  prepaidRtoVal: number;
  rtoAvgValue: number;
  rtoCodOrders: number;
  rtoCodValue: number;
  rtoPrepaidOrders: number;
  rtoPrepaidValue: number;
  rtoUnknownOrders: number;
  rtoUnknownValue: number;
  rtoPurePrepaidOrders: number;
  rtoPurePrepaidValue: number;
  rtoPartialCodOrders: number;
  rtoPartialCodValue: number;
  rtoPartialCodAdvance: number;
  rtoPartialCodRemaining: number;
  rtoInitiated: number;
  rtoInTransit: number;
  rtoDeliveredToSeller: number;
  deliveredCount: number;
  concluded: number;
  rtoRate: string;
  rtoOrders: any[];
  // Delivered extensions
  deliveredOrders: any[];
  totalDeliveredOrders: number;
  totalDeliveredValue: number;
  deliveredAvgValue: number;
  deliveredCodOrders: number;
  deliveredCodValue: number;
  deliveredPrepaidOrders: number;
  deliveredPrepaidValue: number;
  deliveredPurePrepaidOrders: number;
  deliveredPurePrepaidValue: number;
  deliveredPartialCodOrders: number;
  deliveredPartialCodValue: number;
  deliveryRate: string;
  // In Transit & Cancelled
  inTransitOrders: any[];
  inTransitCount: number;
  inTransitValue: number;
  cancelledOrders: any[];
  cancelledCount: number;
  cancelledValue: number;
  // Deleted metrics
  deletedOrders?: any[];
  deletedCount?: number;
  deletedValue?: number;
  // Courier Performance
  courierPerformance: CourierPerformanceSummary[];
}

/**
 * Canonical RTO metrics calculation shared across Sales and Logistics dashboards.
 * Ensures consistent deduplication, lifecycle classification, and payment mode split.
 */
export function calculateCanonicalRtoMetrics(orders: any[], options?: { deliveredCount?: number }): RtoMetricsSummary {
  let totalRtoOrders = 0;
  let totalRtoValue = 0;
  let rtoCodOrders = 0;
  let rtoCodValue = 0;
  let rtoPrepaidOrders = 0;
  let rtoPrepaidValue = 0;
  let rtoUnknownOrders = 0;
  let rtoUnknownValue = 0;
  let rtoPurePrepaidOrders = 0;
  let rtoPurePrepaidValue = 0;
  let rtoPartialCodOrders = 0;
  let rtoPartialCodValue = 0;
  let rtoPartialCodAdvance = 0;
  let rtoPartialCodRemaining = 0;
  let rtoInitiated = 0;
  let rtoInTransit = 0;
  let rtoDeliveredToSeller = 0;
  let deliveredCount = options?.deliveredCount ?? 0;

  // Delivered metrics
  const deliveredOrders: any[] = [];
  let totalDeliveredValue = 0;
  let deliveredCodOrders = 0;
  let deliveredCodValue = 0;
  let deliveredPrepaidOrders = 0;
  let deliveredPrepaidValue = 0;
  let deliveredPurePrepaidOrders = 0;
  let deliveredPurePrepaidValue = 0;
  let deliveredPartialCodOrders = 0;
  let deliveredPartialCodValue = 0;

  // In Transit metrics
  const inTransitOrders: any[] = [];
  let inTransitCount = 0;
  let inTransitValue = 0;

  // Cancelled metrics
  const cancelledOrders: any[] = [];
  let cancelledCount = 0;
  let cancelledValue = 0;

  // Deleted metrics
  const deletedOrders: any[] = [];
  let deletedCount = 0;
  let deletedValue = 0;

  const rtoOrders: any[] = [];
  const seenOrderIds = new Set<string>();
  const courierMap = new Map<string, { 
    courier: string; 
    total: number; 
    delivered: number; 
    rto: number; 
    inTransit: number; 
    otherStatuses: number;
    cancelled: number;
    deleted: number;
    orders: any[];
    deliveredOrders: any[];
    rtoOrders: any[];
    inTransitOrders: any[];
    otherOrders: any[];
    cancelledOrders: any[];
    deletedOrders: any[];
    otherStatusBreakdown: Record<string, number>;
  }>();

  orders.forEach(order => {
    const rawAmt = parseOrderAmount(order.amount ?? order.totalAmount ?? order.price ?? order.order_total) || 0;
    const rawId = order.orderId || order.order_id || order.id;
    const cleanId = String(rawId || '').replace(/^[#]/, '').trim().toLowerCase();
    if (cleanId) {
      if (seenOrderIds.has(cleanId)) return;
      seenOrderIds.add(cleanId);
    }

    const canonical = getCanonicalStatus(order);
    const courier = normalizeCourierName(order.courier || order.extra_data?.courier);
    if (!courierMap.has(courier)) {
      courierMap.set(courier, { 
        courier, 
        total: 0, 
        delivered: 0, 
        rto: 0, 
        inTransit: 0, 
        otherStatuses: 0,
        cancelled: 0,
        deleted: 0,
        orders: [],
        deliveredOrders: [],
        rtoOrders: [],
        inTransitOrders: [],
        otherOrders: [],
        cancelledOrders: [],
        deletedOrders: [],
        otherStatusBreakdown: {}
      });
    }
    const cEntry = courierMap.get(courier)!;
    cEntry.total++;
    cEntry.orders.push(order);

    // 0. Handle deleted orders (tracked under courier reconciliation, excluded from active shipments and delivery/RTO rates)
    if (canonical === 'Deleted') {
      deletedCount++;
      deletedValue += rawAmt;
      deletedOrders.push(order);
      cEntry.deleted++;
      cEntry.deletedOrders.push(order);
      return;
    }

    // 1. Handle cancelled orders (tracked under courier reconciliation, excluded from delivery/RTO rates)
    if (canonical === 'Cancelled') {
      cancelledCount++;
      cancelledValue += rawAmt;
      cancelledOrders.push(order);
      cEntry.cancelled++;
      cEntry.cancelledOrders.push(order);
      return;
    }

    if (canonical === 'Delivered') {
      deliveredCount++;
      totalDeliveredValue += rawAmt;
      deliveredOrders.push(order);
      cEntry.delivered++;
      cEntry.deliveredOrders.push(order);

      const cat = classifyOrderPaymentType(order);
      if (cat === 'COD') {
        deliveredCodOrders++;
        deliveredCodValue += rawAmt;
      } else if (cat === 'PARTIAL_COD') {
        deliveredPrepaidOrders++;
        deliveredPrepaidValue += rawAmt;
        deliveredPartialCodOrders++;
        deliveredPartialCodValue += rawAmt;
      } else if (cat === 'PREPAID') {
        deliveredPrepaidOrders++;
        deliveredPrepaidValue += rawAmt;
        deliveredPurePrepaidOrders++;
        deliveredPurePrepaidValue += rawAmt;
      } else {
        deliveredPrepaidOrders++;
        deliveredPrepaidValue += rawAmt;
      }
    } else if (canonical.includes('RTO')) {
      totalRtoOrders++;
      totalRtoValue += rawAmt;
      rtoOrders.push(order);
      cEntry.rto++;
      cEntry.rtoOrders.push(order);

      if (canonical === 'RTO Initiated') rtoInitiated++;
      else if (canonical === 'RTO In Transit') rtoInTransit++;
      else if (canonical === 'RTO Delivered to Seller') rtoDeliveredToSeller++;

      const cat = classifyOrderPaymentType(order);
      if (cat === 'COD') {
        rtoCodOrders++;
        rtoCodValue += rawAmt;
      } else if (cat === 'PARTIAL_COD') {
        rtoPrepaidOrders++;
        rtoPrepaidValue += rawAmt;

        rtoPartialCodOrders++;
        rtoPartialCodValue += rawAmt;
        const adv = Number(order.advance_paid) || (order.extra_data?.advance_paid ? Number(order.extra_data.advance_paid) : 185);
        rtoPartialCodAdvance += adv;
        rtoPartialCodRemaining += Math.max(0, rawAmt - adv);
      } else if (cat === 'PREPAID') {
        rtoPrepaidOrders++;
        rtoPrepaidValue += rawAmt;

        rtoPurePrepaidOrders++;
        rtoPurePrepaidValue += rawAmt;
      } else {
        rtoUnknownOrders++;
        rtoUnknownValue += rawAmt;
      }
    } else if (canonical === 'In Transit' || canonical === 'Out for Delivery') {
      inTransitCount++;
      inTransitValue += rawAmt;
      inTransitOrders.push(order);
      cEntry.inTransit++;
      cEntry.inTransitOrders.push(order);
    } else {
      cEntry.otherStatuses++;
      cEntry.otherOrders.push(order);
      const origStatus = getOrderOriginalCarrierStatus(order);
      cEntry.otherStatusBreakdown[origStatus] = (cEntry.otherStatusBreakdown[origStatus] || 0) + 1;
    }
  });

  const rtoAvgValue = totalRtoOrders > 0 ? Math.round(totalRtoValue / totalRtoOrders) : 0;
  const deliveredAvgValue = deliveredCount > 0 ? Math.round(totalDeliveredValue / deliveredCount) : 0;
  const concluded = deliveredCount + totalRtoOrders;
  const rtoRate = concluded > 0 ? ((totalRtoOrders / concluded) * 100).toFixed(1) : '0.0';
  const deliveryRate = concluded > 0 ? ((deliveredCount / concluded) * 100).toFixed(1) : '0.0';

  const courierPerformance: CourierPerformanceSummary[] = Array.from(courierMap.values()).map(c => {
    const activeTotal = c.total - c.cancelled - (c.deleted || 0);
    const conc = c.delivered + c.rto;
    return {
      courier: c.courier,
      total: c.total,
      delivered: c.delivered,
      rto: c.rto,
      inTransit: c.inTransit,
      otherStatuses: c.otherStatuses,
      cancelled: c.cancelled,
      deleted: c.deleted || 0,
      deliveryRate: conc > 0 
        ? `${((c.delivered / conc) * 100).toFixed(1)}%` 
        : (activeTotal > 0 ? `${((c.delivered / activeTotal) * 100).toFixed(1)}%` : '0.0%'),
      rtoRate: conc > 0 
        ? `${((c.rto / conc) * 100).toFixed(1)}%` 
        : (activeTotal > 0 ? `${((c.rto / activeTotal) * 100).toFixed(1)}%` : '0.0%'),
      orders: c.orders,
      deliveredOrders: c.deliveredOrders,
      rtoOrders: c.rtoOrders,
      inTransitOrders: c.inTransitOrders,
      otherOrders: c.otherOrders,
      cancelledOrders: c.cancelledOrders,
      deletedOrders: c.deletedOrders || [],
      otherStatusBreakdown: c.otherStatusBreakdown
    };
  }).sort((a, b) => b.total - a.total);

  return {
    totalRtoOrders,
    totalRtoValue,
    totalRto: totalRtoOrders,
    rtoVal: totalRtoValue,
    codRtoCount: rtoCodOrders,
    codRtoVal: rtoCodValue,
    prepaidRtoCount: rtoPrepaidOrders,
    prepaidRtoVal: rtoPrepaidValue,
    rtoAvgValue,
    rtoCodOrders,
    rtoCodValue,
    rtoPrepaidOrders,
    rtoPrepaidValue,
    rtoUnknownOrders,
    rtoUnknownValue,
    rtoPurePrepaidOrders,
    rtoPurePrepaidValue,
    rtoPartialCodOrders,
    rtoPartialCodValue,
    rtoPartialCodAdvance,
    rtoPartialCodRemaining,
    rtoInitiated,
    rtoInTransit,
    rtoDeliveredToSeller,
    deliveredCount,
    concluded,
    rtoRate,
    rtoOrders,
    // Delivered extensions
    deliveredOrders,
    totalDeliveredOrders: deliveredCount,
    totalDeliveredValue,
    deliveredAvgValue,
    deliveredCodOrders,
    deliveredCodValue,
    deliveredPrepaidOrders,
    deliveredPrepaidValue,
    deliveredPurePrepaidOrders,
    deliveredPurePrepaidValue,
    deliveredPartialCodOrders,
    deliveredPartialCodValue,
    deliveryRate,
    // In Transit & Cancelled & Deleted
    inTransitOrders,
    inTransitCount,
    inTransitValue,
    cancelledOrders,
    cancelledCount,
    cancelledValue,
    deletedOrders,
    deletedCount,
    deletedValue,
    // Courier Performance
    courierPerformance
  };
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
