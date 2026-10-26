import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { normalizeCourier } from '../../../config/courierConfig';
import { isDispatchedOrder } from '../../../utils/logisticsOrderUtils';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

export type LogisticsDatePreset = 
  | 'all' 
  | 'today' 
  | 'yesterday' 
  | 'this_week'
  | 'last_week'
  | '7d' 
  | 'this_month' 
  | 'prev_month' 
  | 'last_month'
  | '30d' 
  | 'last_90_days'
  | 'this_year'
  | 'custom';

export type LogisticsDateField = 'orderDate' | 'dispatchDate' | 'deliveredDate' | 'syncedAt';

export interface LogisticsFilterState {
  // 1. General Date & Time
  datePreset: LogisticsDatePreset;
  dateField: LogisticsDateField;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD

  // 1b. Manifested Date (Dedicated courier filter matching reference)
  manifestDatePreset: LogisticsDatePreset;
  manifestStartDate: string; // YYYY-MM-DD
  manifestEndDate: string; // YYYY-MM-DD

  // 2. Search & Bulk AWBs
  searchMode: 'awb' | 'order' | 'customer' | 'all';
  bulkAwbs: string[]; // up to 100 AWBs
  orderIdSearch: string;
  customerNameSearch: string;
  phoneSearch: string;
  productSearch: string;
  fulfillmentStatus: string; // 'all' | 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking'

  // 3. Shipment Status Multi-Select
  shipmentStatuses: string[]; // ['Ready to Ship', 'Ready for Pickup', 'In-transit', 'Out for Delivery', 'Delivered', 'RTO - In Transit', 'Returned to Origin', 'Cancelled']

  // 4. Pickup Location
  pickupLocations: string[];

  // 5. Transport Mode
  transportModes: string[]; // ['Surface', 'Air']

  // 6. Cancellation Workflow Filter
  cancellationStatuses: string[]; // ['Requested', 'Approved', 'Rejected', 'Completed']

  // 7. Customer Location
  states: string[];
  cities: string[];
  pincode: string;

  // 8. Dispatch & Courier
  dispatchStatus: 'all' | 'dispatched' | 'pending';
  couriers: string[];
  missingAwbOnly: boolean;
  batchId: string;

  // 9. Shipment Tracking
  trackingStatuses: string[];
  syncStatus: 'all' | 'synced' | 'never_synced';

  // 10. Payment & Amount
  paymentModes: string[]; // e.g. ['PREPAID', 'COD', 'PARTIAL COD', 'UNKNOWN']
  minAmount: string;
  maxAmount: string;
}

export const CANONICAL_SHIPMENT_STATUSES = [
  'Ready to Ship',
  'Ready for Pickup',
  'In-transit',
  'Out for Delivery',
  'Delivered',
  'RTO - In Transit',
  'Returned to Origin',
  'Cancelled'
] as const;

export const INITIAL_LOGISTICS_FILTER_STATE: LogisticsFilterState = {
  datePreset: 'all',
  dateField: 'orderDate',
  startDate: '',
  endDate: '',
  manifestDatePreset: 'all',
  manifestStartDate: '',
  manifestEndDate: '',
  searchMode: 'awb',
  bulkAwbs: [],
  orderIdSearch: '',
  customerNameSearch: '',
  phoneSearch: '',
  productSearch: '',
  fulfillmentStatus: 'all',
  shipmentStatuses: [],
  pickupLocations: [],
  transportModes: [],
  cancellationStatuses: [],
  states: [],
  cities: [],
  pincode: '',
  dispatchStatus: 'all',
  couriers: [],
  missingAwbOnly: false,
  batchId: '',
  trackingStatuses: [],
  syncStatus: 'all',
  paymentModes: [],
  minAmount: '',
  maxAmount: ''
};

export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats a local Date into YYYY-MM-DD without UTC timezone skew
 */
export function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parses YYYY-MM-DD into a local Date object
 */
export function parseLocalYMD(ymdStr: string): Date {
  if (!ymdStr) return new Date();
  const parts = ymdStr.split('-');
  const y = parseInt(parts[0], 10) || new Date().getFullYear();
  const m = parseInt(parts[1], 10) || 1;
  const d = parseInt(parts[2], 10) || 1;
  return new Date(y, m - 1, d);
}

/**
 * Formats a YYYY-MM-DD string into "15-Oct-2026"
 */
export function formatInputDate(ymd: string): string {
  if (!ymd || !ymd.includes('-')) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, '0')}-${MONTH_NAMES_SHORT[m - 1]}-${y}`;
}

/**
 * Formats date range into "15 Oct 2026 – 20 Oct 2026"
 */
export function formatRangeDisplay(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'All Historical Time';
  if (startDate && !endDate) {
    const [y, m, d] = startDate.split('-').map(Number);
    return `${d} ${MONTH_NAMES_SHORT[m - 1]} ${y}`;
  }
  if (!startDate && endDate) {
    const [y, m, d] = endDate.split('-').map(Number);
    return `Up to ${d} ${MONTH_NAMES_SHORT[m - 1]} ${y}`;
  }
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  const s1 = `${d1} ${MONTH_NAMES_SHORT[m1 - 1]} ${y1}`;
  const s2 = `${d2} ${MONTH_NAMES_SHORT[m2 - 1]} ${y2}`;
  if (startDate === endDate) return s1;
  return `${s1} – ${s2}`;
}

/**
 * Parses human typed dates (e.g. "15-Oct-2026", "2026-10-15", "15/10/2026") into YYYY-MM-DD
 */
export function parseUserInputDate(inputStr: string): string | null {
  const str = inputStr.trim();
  if (!str) return null;

  // 1. Matches DD-MMM-YYYY or DD MMM YYYY (e.g. 15-Oct-2026 or 15 Oct 2026)
  const dMmmYMatch = str.match(/^(\d{1,2})[\s\-]([a-zA-Z]{3,9})[\s\-](\d{4})$/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1], 10);
    const mStr = dMmmYMatch[2].slice(0, 3).toLowerCase();
    const year = parseInt(dMmmYMatch[3], 10);
    const mIndex = MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase() === mStr);
    if (mIndex !== -1 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      return `${year}-${String(mIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. Matches YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. Matches DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Resolves standard date ranges based on preset using local calendar boundaries
 */
export function resolveDateRangeForPreset(preset: LogisticsDatePreset): { start: string; end: string } {
  const now = new Date();

  if (preset === 'today') {
    const today = formatLocalYMD(now);
    return { start: today, end: today };
  }

  if (preset === 'yesterday') {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterday = formatLocalYMD(y);
    return { start: yesterday, end: yesterday };
  }

  if (preset === 'this_week') {
    const day = now.getDay();
    const diff = (day + 6) % 7; // Monday = 0
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return { start: formatLocalYMD(mon), end: formatLocalYMD(sun) };
  }

  if (preset === 'last_week') {
    const day = now.getDay();
    const diff = (day + 6) % 7; // Monday = 0
    const lastMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff - 7);
    const lastSun = new Date(lastMon.getFullYear(), lastMon.getMonth(), lastMon.getDate() + 6);
    return { start: formatLocalYMD(lastMon), end: formatLocalYMD(lastSun) };
  }

  if (preset === '7d') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { start: formatLocalYMD(start), end: formatLocalYMD(now) };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
    return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
  }

  if (preset === 'prev_month' || preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
    return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
  }

  if (preset === '30d') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { start: formatLocalYMD(start), end: formatLocalYMD(now) };
  }

  if (preset === 'last_90_days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
    return { start: formatLocalYMD(start), end: formatLocalYMD(now) };
  }

  if (preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
  }

  return { start: '', end: '' };
}

/**
 * Determines canonical shipment status for an order based on current data
 */
export function getOrderShipmentStatus(order: UnifiedLogisticsOrder): string {
  const st = (order.status || '').trim();
  const lower = st.toLowerCase();
  const stage = order.workflowStage || order.stage;

  if (lower === 'cancelled' || stage === 'trash' || (order.cancellationStatus && order.cancellationStatus.toLowerCase() === 'completed')) {
    return 'Cancelled';
  }
  if (lower.includes('returned') || lower.includes('rto delivered') || lower === 'rto - delivered') {
    return 'Returned to Origin';
  }
  if (lower.includes('rto') || lower.includes('return') || lower.includes('exception')) {
    return 'RTO - In Transit';
  }
  if (lower.includes('delivered') || order.deliveredDate) {
    return 'Delivered';
  }
  if (lower.includes('out for delivery') || lower.includes('dispatched for delivery')) {
    return 'Out for Delivery';
  }
  if (lower.includes('in transit') || lower.includes('in-transit') || lower.includes('shipped') || lower.includes('transit') || lower.includes('handed over')) {
    return 'In-transit';
  }
  if (lower.includes('ready for pickup') || lower.includes('pickup pending') || lower.includes('info received') || lower.includes('awaiting tracking') || (isDispatchedOrder(order) && !order.lastEvent)) {
    return 'Ready for Pickup';
  }
  if (stage === 'prepare_dispatch' || stage === 'active' || lower.includes('unfulfilled') || lower.includes('ready to ship') || lower.includes('pending')) {
    return 'Ready to Ship';
  }

  return 'Ready to Ship';
}

/**
 * Counts how many filter conditions are actively restricting data
 */
export function countActiveLogisticsFilters(filters: LogisticsFilterState): number {
  let count = 0;
  if (filters.datePreset !== 'all' || filters.startDate || filters.endDate) count++;
  if (filters.manifestDatePreset !== 'all' || filters.manifestStartDate || filters.manifestEndDate) count++;
  if (filters.bulkAwbs.length > 0) count++;
  if (filters.shipmentStatuses.length > 0) count++;
  if (filters.pickupLocations.length > 0) count++;
  if (filters.transportModes.length > 0) count++;
  if (filters.cancellationStatuses.length > 0) count++;
  if (filters.orderIdSearch.trim()) count++;
  if (filters.customerNameSearch.trim()) count++;
  if (filters.phoneSearch.trim()) count++;
  if (filters.productSearch.trim()) count++;
  if (filters.fulfillmentStatus !== 'all') count++;
  if (filters.states.length > 0) count++;
  if (filters.cities.length > 0) count++;
  if (filters.pincode.trim()) count++;
  if (filters.dispatchStatus !== 'all') count++;
  if (filters.couriers.length > 0) count++;
  if (filters.missingAwbOnly) count++;
  if (filters.batchId.trim()) count++;
  if (filters.trackingStatuses.length > 0) count++;
  if (filters.syncStatus !== 'all') count++;
  if (filters.paymentModes.length > 0) count++;
  if (filters.minAmount.trim() || filters.maxAmount.trim()) count++;
  return count;
}

/**
 * Non-destructively filters logistics orders based on filter state
 */
export function applyLogisticsFilters(
  orders: UnifiedLogisticsOrder[],
  filters: LogisticsFilterState
): UnifiedLogisticsOrder[] {
  // 1. Resolve effective date boundaries for general date filter
  let effectiveStart = filters.startDate;
  let effectiveEnd = filters.endDate;

  if (filters.datePreset !== 'all' && filters.datePreset !== 'custom') {
    const resolved = resolveDateRangeForPreset(filters.datePreset);
    effectiveStart = resolved.start;
    effectiveEnd = resolved.end;
  }

  // 1b. Resolve effective date boundaries for manifested date filter
  let manifestStart = filters.manifestStartDate;
  let manifestEnd = filters.manifestEndDate;

  if (filters.manifestDatePreset !== 'all' && filters.manifestDatePreset !== 'custom') {
    const resolvedManifest = resolveDateRangeForPreset(filters.manifestDatePreset);
    manifestStart = resolvedManifest.start;
    manifestEnd = resolvedManifest.end;
  }

  return orders.filter(order => {
    // 1. GENERAL DATE & TIME FILTER
    if (effectiveStart || effectiveEnd) {
      let rawTargetDate = '';
      if (filters.dateField === 'orderDate') {
        rawTargetDate = order.orderDate || '';
      } else if (filters.dateField === 'dispatchDate') {
        rawTargetDate = order.dispatchDate || '';
      } else if (filters.dateField === 'deliveredDate') {
        rawTargetDate = order.deliveredDate || '';
      } else if (filters.dateField === 'syncedAt') {
        rawTargetDate = order.syncedAt || order.lastUpdated || '';
      }

      if (rawTargetDate) {
        const parsed = parseAndFormatLogisticsDate(rawTargetDate);
        const ymd = parsed.isoDate || (rawTargetDate.length >= 10 && rawTargetDate.includes('-') ? rawTargetDate.slice(0, 10) : '');

        if (ymd) {
          if (effectiveStart && ymd < effectiveStart) return false;
          if (effectiveEnd && ymd > effectiveEnd) return false;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    // 1b. MANIFESTED DATE FILTER (Never substitute orderDate silently)
    if (manifestStart || manifestEnd) {
      const rawManifest = order.dispatchDate || '';
      if (!rawManifest) {
        // Exclude orders that do not have a manifested / dispatch date
        return false;
      }
      const parsed = parseAndFormatLogisticsDate(rawManifest);
      const ymd = parsed.isoDate || (rawManifest.length >= 10 && rawManifest.includes('-') ? rawManifest.slice(0, 10) : '');
      if (!ymd) return false;
      if (manifestStart && ymd < manifestStart) return false;
      if (manifestEnd && ymd > manifestEnd) return false;
    }

    // 2. BULK AWB SEARCH (Up to 100 AWBs)
    if (filters.bulkAwbs.length > 0) {
      const cleanAwb = (order.awbNumber || '').trim().toLowerCase();
      const cleanId = (order.orderId || '').trim().toLowerCase();
      const cleanDisplay = (order.displayOrderId || '').trim().toLowerCase();
      
      const matched = filters.bulkAwbs.some(rawItem => {
        const item = rawItem.trim().toLowerCase();
        if (!item) return false;
        return cleanAwb === item || cleanId === item || cleanDisplay === item || cleanAwb.includes(item);
      });
      if (!matched) return false;
    }

    // 3. SHIPMENT STATUS MULTI-SELECT
    if (filters.shipmentStatuses.length > 0) {
      const currentShipmentStatus = getOrderShipmentStatus(order);
      const matchedStatus = filters.shipmentStatuses.some(
        st => st.toLowerCase() === currentShipmentStatus.toLowerCase()
      );
      if (!matchedStatus) return false;
    }

    // 4. PICKUP LOCATION FILTER
    if (filters.pickupLocations.length > 0) {
      const loc = (order.pickupLocation || 'VELMORA CONSUMER B2C Erode 638002').toLowerCase();
      const matchedLoc = filters.pickupLocations.some(pl => loc.includes(pl.toLowerCase()));
      if (!matchedLoc) return false;
    }

    // 5. TRANSPORT MODE FILTER
    if (filters.transportModes.length > 0) {
      const tm = (order.transportMode || 'Surface').toLowerCase();
      const matchedTm = filters.transportModes.some(m => tm === m.toLowerCase());
      if (!matchedTm) return false;
    }

    // 6. CANCELLATION STATUS FILTER
    if (filters.cancellationStatuses.length > 0) {
      const cs = (order.cancellationStatus || (order.status === 'Cancelled' ? 'Completed' : '')).toLowerCase();
      const matchedCs = filters.cancellationStatuses.some(c => cs === c.toLowerCase());
      if (!matchedCs) return false;
    }

    // 7. ORDER SEARCH
    if (filters.orderIdSearch.trim()) {
      const q = filters.orderIdSearch.trim().toLowerCase();
      const matchId = (order.orderId || '').toLowerCase().includes(q) ||
        (order.displayOrderId || '').toLowerCase().includes(q);
      if (!matchId) return false;
    }

    if (filters.customerNameSearch.trim()) {
      const q = filters.customerNameSearch.trim().toLowerCase();
      if (!(order.customerName || '').toLowerCase().includes(q)) return false;
    }

    if (filters.phoneSearch.trim()) {
      const q = filters.phoneSearch.trim();
      const phone = order.phoneNumber || order.phone || '';
      if (!phone.includes(q)) return false;
    }

    if (filters.productSearch.trim()) {
      const q = filters.productSearch.trim().toLowerCase();
      const prod = order.products || order.productSummary || '';
      if (!prod.toLowerCase().includes(q)) return false;
    }

    if (filters.fulfillmentStatus !== 'all') {
      if (order.workflowStage !== filters.fulfillmentStatus) return false;
    }

    // 8. LOCATION
    if (filters.states.length > 0) {
      const orderState = (order.state || order.shippingState || '').toLowerCase();
      const matchState = filters.states.some(s => orderState.includes(s.toLowerCase()));
      if (!matchState) return false;
    }

    if (filters.cities.length > 0) {
      const orderCity = (order.city || order.shippingCity || '').toLowerCase();
      const matchCity = filters.cities.some(c => orderCity.includes(c.toLowerCase()));
      if (!matchCity) return false;
    }

    if (filters.pincode.trim()) {
      const pin = (order.pincode || '').trim();
      if (!pin.includes(filters.pincode.trim())) return false;
    }

    // 9. DISPATCH & COURIER
    if (filters.dispatchStatus === 'dispatched') {
      if (!isDispatchedOrder(order)) return false;
    } else if (filters.dispatchStatus === 'pending') {
      if (isDispatchedOrder(order)) return false;
    }

    if (filters.couriers.length > 0) {
      const norm = normalizeCourier(order.courier);
      if (!filters.couriers.includes(norm)) return false;
    }

    if (filters.missingAwbOnly) {
      const hasAwb = !!(order.awbNumber && order.awbNumber.trim().length > 0);
      if (hasAwb) return false;
    }

    if (filters.batchId.trim()) {
      const bId = order.batchId || '';
      if (!bId.toLowerCase().includes(filters.batchId.trim().toLowerCase())) return false;
    }

    // 10. SHIPMENT TRACKING
    if (filters.trackingStatuses.length > 0) {
      const st = order.status || '';
      const matchSt = filters.trackingStatuses.some(ts => {
        if (ts === 'Info Received') {
          return st === 'Info Received' || st === 'Awaiting Tracking Update';
        }
        if (ts === 'Exception') {
          return st === 'Exception' || st.toLowerCase().includes('rto') || st.toLowerCase().includes('return');
        }
        return st.toLowerCase() === ts.toLowerCase();
      });
      if (!matchSt) return false;
    }

    if (filters.syncStatus === 'synced') {
      if (!order.syncedAt) return false;
    } else if (filters.syncStatus === 'never_synced') {
      if (order.syncedAt) return false;
    }

    // 11. PAYMENT & AMOUNT
    if (filters.paymentModes.length > 0) {
      const mode = (order.orderType || '').toUpperCase();
      const matchesMode = filters.paymentModes.some(m => {
        if (m === 'PREPAID') return mode.includes('PREPAID') || (!mode.includes('COD') && mode.length > 0);
        if (m === 'COD') return mode.includes('COD') && !mode.includes('PARTIAL');
        if (m === 'PARTIAL COD') return mode.includes('PARTIAL');
        if (m === 'UNKNOWN') return !mode || mode === 'UNKNOWN' || mode === '-';
        return mode.includes(m);
      });
      if (!matchesMode) return false;
    }

    const orderAmt = order.amount ?? order.totalAmount ?? 0;
    if (filters.minAmount.trim()) {
      const min = parseFloat(filters.minAmount);
      if (!isNaN(min) && orderAmt < min) return false;
    }

    if (filters.maxAmount.trim()) {
      const max = parseFloat(filters.maxAmount);
      if (!isNaN(max) && orderAmt > max) return false;
    }

    return true;
  });
}
