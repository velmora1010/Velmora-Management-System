import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { getCanonicalStatus } from './logisticsAnalyticsUtils';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';
import { parseOrderAmount } from '../../../utils/logisticsOrderUtils';
import { formatLocalYMD } from '../types/logisticsFilters';

export type DelaySeverity = 'none' | 'moderate' | 'severe' | 'critical' | 'missing_eta';

export interface DeliveryDelayInfo {
  isDelayed: boolean;         // true strictly if overdueDays >= 10, undelivered, and not cancelled
  overdueDays: number;        // calendar days overdue relative to expected delivery date (>= 0)
  hasEdd: boolean;            // true if valid expected delivery date exists
  eddIsoDate: string;         // YYYY-MM-DD
  eddDisplayDate: string;     // e.g. "25 Oct 2026"
  isDelivered: boolean;       // confirmed delivered
  isCancelled: boolean;       // confirmed cancelled
  severity: DelaySeverity;
  alertLabel: string;
}

export interface DeliveryDelaySummary {
  totalDelayed: number;
  totalDelayedValue: number;
  avgDelayedValue: number;
  moderateCount: number;      // 10 - 14 days
  severeCount: number;        // 15 - 20 days
  criticalCount: number;      // 21+ days
  missingEtaCount: number;    // In-transit / active shipments without EDD
  oldestOverdueDays: number;
  courierBreakdown: Array<{
    courier: string;
    count: number;
    value: number;
  }>;
}

/**
 * Universal delay evaluator for logistics shipments.
 * Primary reference: Expected Delivery Date (EDD).
 *
 * Rules:
 * 1. Overdue when reference date (default: today) is >= 10 calendar days after expected delivery date.
 * 2. Only includes shipments that are NOT delivered.
 * 3. Excludes cancelled shipments.
 * 4. Does NOT guess or classify shipments as 10+ days delayed if expected delivery date is missing.
 */
export function getDeliveryDelayInfo(order: any, referenceDate?: string | Date): DeliveryDelayInfo {
  const emptyInfo: DeliveryDelayInfo = {
    isDelayed: false,
    overdueDays: 0,
    hasEdd: false,
    eddIsoDate: '',
    eddDisplayDate: '',
    isDelivered: false,
    isCancelled: false,
    severity: 'none',
    alertLabel: 'On Schedule'
  };

  if (!order) return emptyInfo;

  // 1. Cancellation check
  const canonical = getCanonicalStatus(order);
  const statusStr = (order.status || order.shipment_status || order.order_status || '').toLowerCase().trim();
  const rawStatusStr = (order.rawStatus || order.raw_status || '').toLowerCase().trim();
  const isCancelled =
    canonical === 'Cancelled' ||
    statusStr === 'cancelled' ||
    order.workflowStage === 'trash' ||
    order.stage === 'trash' ||
    rawStatusStr.includes('cancel') ||
    (order.cancellation && order.cancellation.status === 'CANCELLED') ||
    order.cancellationStatus === 'Completed' ||
    order.isCancelled;

  if (isCancelled) {
    return { ...emptyInfo, isCancelled: true };
  }

  // 2. Confirmed delivery check
  const isDelivered =
    canonical === 'Delivered' ||
    statusStr === 'delivered' ||
    rawStatusStr === 'delivered' ||
    Boolean(order.deliveredDate && String(order.deliveredDate).trim() !== '' && String(order.deliveredDate).trim() !== '-');

  if (isDelivered) {
    return { ...emptyInfo, isDelivered: true };
  }

  // 3. Expected Delivery Date check
  const rawEdd = order.estimatedDeliveryDate || order.expectedDeliveryDate || order.expected_delivery_date || order.edd;
  if (!rawEdd) {
    return {
      ...emptyInfo,
      hasEdd: false,
      severity: 'missing_eta',
      alertLabel: 'Missing ETA'
    };
  }

  const parsedEdd = parseAndFormatLogisticsDate(rawEdd);
  if (!parsedEdd.isoDate) {
    return {
      ...emptyInfo,
      hasEdd: false,
      severity: 'missing_eta',
      alertLabel: 'Missing ETA'
    };
  }

  // 4. Overdue days computation based on calendar days
  const todayIso = referenceDate 
    ? (typeof referenceDate === 'string' ? referenceDate.slice(0, 10) : formatLocalYMD(referenceDate))
    : formatLocalYMD(new Date());

  const dEdd = new Date(`${parsedEdd.isoDate}T00:00:00`);
  const dToday = new Date(`${todayIso}T00:00:00`);

  const diffMs = dToday.getTime() - dEdd.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 10) {
    return {
      isDelayed: false,
      overdueDays: Math.max(0, diffDays),
      hasEdd: true,
      eddIsoDate: parsedEdd.isoDate,
      eddDisplayDate: parsedEdd.displayDate || parsedEdd.isoDate,
      isDelivered: false,
      isCancelled: false,
      severity: 'none',
      alertLabel: diffDays <= 0 ? 'On Track' : `${diffDays}d past ETA`
    };
  }

  // Overdue threshold met: >= 10 days
  let severity: DelaySeverity = 'moderate';
  let alertLabel = `${diffDays} Days Overdue`;

  if (diffDays >= 21) {
    severity = 'critical';
    alertLabel = `${diffDays}d Critical Delay`;
  } else if (diffDays >= 15) {
    severity = 'severe';
    alertLabel = `${diffDays}d Severe Delay`;
  }

  return {
    isDelayed: true,
    overdueDays: diffDays,
    hasEdd: true,
    eddIsoDate: parsedEdd.isoDate,
    eddDisplayDate: parsedEdd.displayDate || parsedEdd.isoDate,
    isDelivered: false,
    isCancelled: false,
    severity,
    alertLabel
  };
}

/**
 * Filter and sort shipments for Delivery Delays view.
 * Default sorts by most overdue first.
 */
export function getDelayedShipments(
  orders: UnifiedLogisticsOrder[], 
  options?: {
    filterSeverity?: 'all' | 'moderate' | 'severe' | 'critical' | 'missing_eta';
    courier?: string;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Array<{ order: UnifiedLogisticsOrder; delayInfo: DeliveryDelayInfo }> {
  const result: Array<{ order: UnifiedLogisticsOrder; delayInfo: DeliveryDelayInfo }> = [];
  const seenIds = new Set<string>();

  for (const o of orders) {
    if (!o) continue;
    const cleanId = String(o.orderId || o.id || '').replace(/^[#]/, '').trim().toLowerCase();
    if (cleanId) {
      if (seenIds.has(cleanId)) continue;
      seenIds.add(cleanId);
    }

    const delayInfo = getDeliveryDelayInfo(o);

    // Filter severity mode
    const mode = options?.filterSeverity || 'all';
    if (mode === 'missing_eta') {
      if (delayInfo.severity !== 'missing_eta') continue;
    } else if (mode === 'all') {
      if (!delayInfo.isDelayed) continue;
    } else if (delayInfo.severity !== mode) {
      continue;
    }

    // Courier filter
    if (options?.courier && options.courier !== 'All') {
      const orderCourier = (o.courier || '').toLowerCase();
      if (!orderCourier.includes(options.courier.toLowerCase())) continue;
    }

    // Status filter
    if (options?.status && options.status !== 'All') {
      const canonical = getCanonicalStatus(o);
      const st = (o.status || '').toLowerCase();
      if (canonical.toLowerCase() !== options.status.toLowerCase() && !st.includes(options.status.toLowerCase())) {
        continue;
      }
    }

    // Search query filter
    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      const oid = String(o.orderId || o.displayOrderId || '').toLowerCase();
      const awb = String(o.awbNumber || '').toLowerCase();
      const name = String(o.customerName || '').toLowerCase();
      const phone = String(o.phoneNumber || o.phone || '').toLowerCase();
      const courier = String(o.courier || '').toLowerCase();

      if (!oid.includes(q) && !awb.includes(q) && !name.includes(q) && !phone.includes(q) && !courier.includes(q)) {
        continue;
      }
    }

    // Date range filter based on expected delivery date or dispatch date
    if (options?.dateFrom || options?.dateTo) {
      const targetDate = delayInfo.eddIsoDate || (o.dispatchDate ? o.dispatchDate.slice(0, 10) : '');
      if (targetDate) {
        if (options.dateFrom && targetDate < options.dateFrom) continue;
        if (options.dateTo && targetDate > options.dateTo) continue;
      }
    }

    result.push({ order: o, delayInfo });
  }

  // Sort by most overdue first
  result.sort((a, b) => b.delayInfo.overdueDays - a.delayInfo.overdueDays);

  return result;
}

/**
 * Calculates summary metrics for the Delivery Delays dashboard banner.
 */
export function calculateDeliveryDelaySummary(orders: UnifiedLogisticsOrder[]): DeliveryDelaySummary {
  let totalDelayed = 0;
  let totalDelayedValue = 0;
  let moderateCount = 0;
  let severeCount = 0;
  let criticalCount = 0;
  let missingEtaCount = 0;
  let oldestOverdueDays = 0;

  const courierMap = new Map<string, { count: number; value: number }>();
  const seenIds = new Set<string>();

  for (const o of orders) {
    if (!o) continue;
    const cleanId = String(o.orderId || o.id || '').replace(/^[#]/, '').trim().toLowerCase();
    if (cleanId) {
      if (seenIds.has(cleanId)) continue;
      seenIds.add(cleanId);
    }

    const delayInfo = getDeliveryDelayInfo(o);
    const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;

    if (delayInfo.severity === 'missing_eta') {
      missingEtaCount++;
      continue;
    }

    if (delayInfo.isDelayed) {
      totalDelayed++;
      totalDelayedValue += amt;
      if (delayInfo.overdueDays > oldestOverdueDays) {
        oldestOverdueDays = delayInfo.overdueDays;
      }

      if (delayInfo.severity === 'critical') criticalCount++;
      else if (delayInfo.severity === 'severe') severeCount++;
      else if (delayInfo.severity === 'moderate') moderateCount++;

      const cName = o.courier ? o.courier.trim() : 'Unassigned';
      const cur = courierMap.get(cName) || { count: 0, value: 0 };
      courierMap.set(cName, { count: cur.count + 1, value: cur.value + amt });
    }
  }

  const avgDelayedValue = totalDelayed > 0 ? Math.round(totalDelayedValue / totalDelayed) : 0;

  const courierBreakdown = Array.from(courierMap.entries())
    .map(([courier, data]) => ({ courier, count: data.count, value: data.value }))
    .sort((a, b) => b.count - a.count);

  return {
    totalDelayed,
    totalDelayedValue,
    avgDelayedValue,
    moderateCount,
    severeCount,
    criticalCount,
    missingEtaCount,
    oldestOverdueDays,
    courierBreakdown
  };
}
