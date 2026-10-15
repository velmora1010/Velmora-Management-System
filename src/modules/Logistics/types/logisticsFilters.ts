import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { normalizeCourier } from '../../../config/courierConfig';
import { isDispatchedOrder } from '../../../utils/logisticsOrderUtils';

export type LogisticsDatePreset = 
  | 'all' 
  | 'today' 
  | 'yesterday' 
  | '7d' 
  | '30d' 
  | 'this_month' 
  | 'prev_month' 
  | 'custom';

export type LogisticsDateField = 'orderDate' | 'dispatchDate' | 'deliveredDate';

export interface LogisticsFilterState {
  // 1. Date & Time
  datePreset: LogisticsDatePreset;
  dateField: LogisticsDateField;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD

  // 2. Order & Customer
  orderIdSearch: string;
  customerNameSearch: string;
  phoneSearch: string;
  productSearch: string;
  fulfillmentStatus: string; // 'all' | 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking'

  // 3. Customer Location
  states: string[];
  cities: string[];
  pincode: string;

  // 4. Dispatch & Courier
  dispatchStatus: 'all' | 'dispatched' | 'pending';
  couriers: string[];
  missingAwbOnly: boolean;
  batchId: string;

  // 5. Shipment Tracking
  trackingStatuses: string[];
  syncStatus: 'all' | 'synced' | 'never_synced';

  // 6. Payment & Amount
  paymentModes: string[]; // e.g. ['PREPAID', 'COD', 'PARTIAL COD', 'UNKNOWN']
  minAmount: string;
  maxAmount: string;
}

export const INITIAL_LOGISTICS_FILTER_STATE: LogisticsFilterState = {
  datePreset: 'all',
  dateField: 'orderDate',
  startDate: '',
  endDate: '',
  orderIdSearch: '',
  customerNameSearch: '',
  phoneSearch: '',
  productSearch: '',
  fulfillmentStatus: 'all',
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

/**
 * Resolves standard date ranges based on preset
 */
export function resolveDateRangeForPreset(preset: LogisticsDatePreset): { start: string; end: string } {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().slice(0, 10);

  if (preset === 'today') {
    const today = formatYmd(now);
    return { start: today, end: today };
  }

  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterday = formatYmd(y);
    return { start: yesterday, end: yesterday };
  }

  if (preset === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: formatYmd(d), end: formatYmd(now) };
  }

  if (preset === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { start: formatYmd(d), end: formatYmd(now) };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatYmd(start), end: formatYmd(now) };
  }

  if (preset === 'prev_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: formatYmd(start), end: formatYmd(end) };
  }

  return { start: '', end: '' };
}

/**
 * Counts how many filter conditions are actively restricting data
 */
export function countActiveLogisticsFilters(filters: LogisticsFilterState): number {
  let count = 0;
  if (filters.datePreset !== 'all' || filters.startDate || filters.endDate) count++;
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
  // Resolve effective date boundaries
  let effectiveStart = filters.startDate;
  let effectiveEnd = filters.endDate;

  if (filters.datePreset !== 'all' && filters.datePreset !== 'custom') {
    const resolved = resolveDateRangeForPreset(filters.datePreset);
    effectiveStart = resolved.start;
    effectiveEnd = resolved.end;
  }

  return orders.filter(order => {
    // 1. DATE & TIME FILTER
    if (effectiveStart || effectiveEnd) {
      let rawTargetDate = '';
      if (filters.dateField === 'orderDate') {
        rawTargetDate = order.orderDate || '';
      } else if (filters.dateField === 'dispatchDate') {
        rawTargetDate = order.dispatchDate || '';
      } else if (filters.dateField === 'deliveredDate') {
        rawTargetDate = order.deliveredDate || '';
      }

      if (rawTargetDate) {
        const ymd = rawTargetDate.slice(0, 10);
        if (effectiveStart && ymd < effectiveStart) return false;
        if (effectiveEnd && ymd > effectiveEnd) return false;
      } else {
        // If filtering by dispatch/delivered date and record doesn't have it, exclude
        if (filters.dateField !== 'orderDate') return false;
      }
    }

    // 2. ORDER SEARCH
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

    // 3. LOCATION
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

    // 4. DISPATCH & COURIER
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

    // 5. SHIPMENT TRACKING
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

    // 6. PAYMENT & AMOUNT
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
