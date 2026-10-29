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

export type LogisticsSection = 
  | 'pending_awb' 
  | 'ready_to_ship' 
  | 'ready_for_pickup' 
  | 'in_transit' 
  | 'rto_in_transit' 
  | 'delivered' 
  | 'all_shipments' 
  | 'third_party';

export interface LogisticsFilterState {
  // Active Sidebar Section
  activeSection: LogisticsSection;

  // 1. General Date & Time (Order Date)
  datePreset: LogisticsDatePreset;
  dateField: LogisticsDateField;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD

  // 1b. Manifested Date (Dedicated courier dispatch date)
  manifestDatePreset: LogisticsDatePreset;
  manifestStartDate: string; // YYYY-MM-DD
  manifestEndDate: string; // YYYY-MM-DD

  // 1c. Delivered Date (Strictly delivery timestamp)
  deliveredDatePreset: LogisticsDatePreset;
  deliveredStartDate: string; // YYYY-MM-DD
  deliveredEndDate: string; // YYYY-MM-DD

  // 1d. Returned Date (RTO timestamp)
  returnedDatePreset: LogisticsDatePreset;
  returnedStartDate: string; // YYYY-MM-DD
  returnedEndDate: string; // YYYY-MM-DD

  // 2. Search & Bulk AWBs
  searchMode: 'awb' | 'order' | 'customer' | 'all';
  bulkAwbs: string[]; // up to 100 AWBs
  orderIdSearch: string;
  customerNameSearch: string;
  phoneSearch: string;
  productSearch: string;
  fulfillmentStatus: string; // 'all' | 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking'

  // 3. Shipment Status Multi-Select
  shipmentStatuses: string[];

  // 4. Pickup Location
  pickupLocations: string[];

  // 5. Transport Mode ('Surface', 'Express')
  transportModes: string[];

  // 6. Payment Mode ('COD', 'Prepaid', 'Pickup', 'Replacement')
  paymentModes: string[];

  // 7. Risk of Return ('Low (0 - 20)', 'Medium (21 - 51)', 'High (52+)')
  riskOfReturn: string[];

  // 8. Channel ('Online Store / Shopify', 'Website', 'Manual / Direct', 'Delhivery Direct')
  channels: string[];

  // 9. Verified Status ('Verified', 'Unverified')
  verifiedStatuses: string[];

  // 10. Order Tags
  orderTags: string[];

  // 11. Address Score ('Complete (100%)', 'Good (75-99%)', 'Partial (50-74%)', 'Poor (<50%)')
  addressScores: string[];

  // 12. Zone ('Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F', 'S1', 'S2', 'S3', 'S4')
  zones: string[];

  // 13. Cancellation Workflow Filter
  cancellationStatuses: string[];

  // 14. Customer Location
  states: string[];
  cities: string[];
  pincode: string;

  // 15. Dispatch & Courier
  dispatchStatus: 'all' | 'dispatched' | 'pending';
  couriers: string[];
  missingAwbOnly: boolean;
  batchId: string;

  // 16. Shipment Tracking
  trackingStatuses: string[];
  syncStatus: 'all' | 'synced' | 'never_synced';
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
  activeSection: 'all_shipments',
  datePreset: 'all',
  dateField: 'orderDate',
  startDate: '',
  endDate: '',
  manifestDatePreset: 'all',
  manifestStartDate: '',
  manifestEndDate: '',
  deliveredDatePreset: 'all',
  deliveredStartDate: '',
  deliveredEndDate: '',
  returnedDatePreset: 'all',
  returnedStartDate: '',
  returnedEndDate: '',
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
  paymentModes: [],
  riskOfReturn: [],
  channels: [],
  verifiedStatuses: [],
  orderTags: [],
  addressScores: [],
  zones: [],
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

  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

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
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
  }

  if (preset === 'prev_month' || preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
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
 * Canonical shipment status determination
 */
export function getOrderShipmentStatus(order: UnifiedLogisticsOrder): string {
  const st = (order.status || '').trim();
  const lower = st.toLowerCase();
  const stage = (order.workflowStage || order.stage || '').toLowerCase();

  if (lower === 'cancelled' || stage === 'trash' || (order.cancellationStatus && order.cancellationStatus.toLowerCase() === 'completed')) {
    return 'Cancelled';
  }
  if (lower.includes('returned') || lower.includes('rto delivered') || lower === 'rto - delivered' || lower === 'returned to origin') {
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

/* =========================================================================
   STATUS-SPECIFIC SECTION CRITERIA & HELPERS
   ========================================================================= */

/**
 * 1. Pending AWB:
 * Orders that meet application's pending-AWB definition:
 * Must NOT be cancelled, trash, or delivered.
 * Must NOT have an AWB assigned.
 * Workflow state must be active/prepare_dispatch/pending/unfulfilled.
 */
export function isOrderPendingAwb(order: UnifiedLogisticsOrder): boolean {
  const stage = (order.workflowStage || order.stage || '').toLowerCase();
  const st = (order.status || '').toLowerCase();
  if (stage === 'trash' || st === 'cancelled' || st.includes('delivered') || !!order.deliveredDate) return false;
  if (isDispatchedOrder(order)) return false;
  const hasAwb = !!(order.awbNumber && order.awbNumber.trim().length > 0);
  if (hasAwb) return false;
  return (
    stage === 'active' || 
    stage === 'prepare_dispatch' || 
    stage === 'pending' || 
    stage === 'order_data' ||
    st === 'unfulfilled' || 
    st.includes('pending') || 
    st === 'ready to ship'
  );
}

/**
 * 2. Ready to Ship:
 * Orders whose actual shipment/workflow state is Ready to Ship.
 */
export function isOrderReadyToShip(order: UnifiedLogisticsOrder): boolean {
  const stage = (order.workflowStage || order.stage || '').toLowerCase();
  const st = (order.status || '').toLowerCase();
  if (stage === 'trash' || st === 'cancelled' || st.includes('delivered') || !!order.deliveredDate) return false;
  if (st.includes('in transit') || st.includes('in-transit') || st.includes('out for delivery') || st.includes('rto')) return false;
  return stage === 'prepare_dispatch' || st === 'ready to ship';
}

/**
 * 3. Ready for Pickup:
 * Orders manifested with carrier awaiting initial pickup scan.
 */
export function isOrderReadyForPickup(order: UnifiedLogisticsOrder): boolean {
  const st = (order.status || '').toLowerCase();
  const stage = (order.workflowStage || order.stage || '').toLowerCase();
  if (stage === 'trash' || st === 'cancelled' || st.includes('delivered') || !!order.deliveredDate) return false;
  if (st.includes('rto') || st.includes('out for delivery')) return false;
  return (
    st.includes('ready for pickup') || 
    st.includes('pickup pending') || 
    st.includes('info received') || 
    st.includes('awaiting tracking') ||
    (isDispatchedOrder(order) && !order.lastEvent && !st.includes('transit'))
  );
}

/**
 * 4. In Transit:
 * Actively moving shipments (In-transit or Out for Delivery).
 */
export function isOrderInTransit(order: UnifiedLogisticsOrder): boolean {
  const st = (order.status || '').toLowerCase();
  const stage = (order.workflowStage || order.stage || '').toLowerCase();
  if (stage === 'trash' || st === 'cancelled' || st.includes('delivered') || !!order.deliveredDate) return false;
  if (st.includes('rto') || st.includes('return') || st.includes('exception')) return false;
  return (
    st.includes('in transit') || 
    st.includes('in-transit') || 
    st.includes('out for delivery') || 
    st.includes('shipped') || 
    st.includes('dispatched for delivery') ||
    (isDispatchedOrder(order) && !st.includes('ready for pickup') && !st.includes('delivered'))
  );
}

/**
 * 5. RTO - In Transit:
 * Returning to origin shipments.
 */
export function isOrderRto(order: UnifiedLogisticsOrder): boolean {
  const st = (order.status || '').toLowerCase();
  const stage = (order.workflowStage || order.stage || '').toLowerCase();
  if (stage === 'trash') return false;
  return (
    st.includes('rto') || 
    st.includes('return') || 
    st.includes('undelivered') || 
    st.includes('exception')
  );
}

/**
 * 6. Delivered:
 * Orders successfully delivered.
 */
export function isOrderDelivered(order: UnifiedLogisticsOrder): boolean {
  const st = (order.status || '').toLowerCase();
  const stage = (order.workflowStage || order.stage || '').toLowerCase();
  if (stage === 'trash') return false;
  return st.includes('delivered') || !!order.deliveredDate;
}

/**
 * 8. Shipped via Third Party:
 * External / non-integrated courier shipments.
 */
export function isOrderThirdParty(order: UnifiedLogisticsOrder): boolean {
  const courier = (order.courier || '').toLowerCase();
  if (!courier || courier === 'unassigned') return false;
  return !['delhivery', 'st courier', 'stcourier'].includes(courier) || (order as any).isThirdParty === true;
}

/**
 * Evaluates whether an order belongs to a given section.
 */
export function isOrderMatchingSection(order: UnifiedLogisticsOrder, section: LogisticsSection): boolean {
  if (order.stage === 'trash' || order.workflowStage === 'trash') return false;
  if (section === 'all_shipments') return true;
  if (section === 'pending_awb') return isOrderPendingAwb(order);
  if (section === 'ready_to_ship') return isOrderReadyToShip(order);
  if (section === 'ready_for_pickup') return isOrderReadyForPickup(order);
  if (section === 'in_transit') return isOrderInTransit(order);
  if (section === 'rto_in_transit') return isOrderRto(order);
  if (section === 'delivered') return isOrderDelivered(order);
  if (section === 'third_party') return isOrderThirdParty(order);
  return true;
}

/**
 * Calculates live counts for all 8 shipment sections.
 */
export function calculateSectionCounts(orders: UnifiedLogisticsOrder[]): Record<LogisticsSection, number> {
  const counts: Record<LogisticsSection, number> = {
    pending_awb: 0,
    ready_to_ship: 0,
    ready_for_pickup: 0,
    in_transit: 0,
    rto_in_transit: 0,
    delivered: 0,
    all_shipments: 0,
    third_party: 0
  };

  orders.forEach(order => {
    if (order.stage === 'trash' || order.workflowStage === 'trash') return;
    counts.all_shipments++;

    if (isOrderPendingAwb(order)) counts.pending_awb++;
    if (isOrderReadyToShip(order)) counts.ready_to_ship++;
    if (isOrderReadyForPickup(order)) counts.ready_for_pickup++;
    if (isOrderInTransit(order)) counts.in_transit++;
    if (isOrderRto(order)) counts.rto_in_transit++;
    if (isOrderDelivered(order)) counts.delivered++;
    if (isOrderThirdParty(order)) counts.third_party++;
  });

  return counts;
}

/* =========================================================================
   ALL-FILTERS ATTRIBUTE CALCULATORS
   ========================================================================= */

/**
 * Calculates risk of return tier: Low (0 - 20), Medium (21 - 51), High (52+)
 */
export function calculateOrderRiskOfReturn(order: UnifiedLogisticsOrder): 'Low (0 - 20)' | 'Medium (21 - 51)' | 'High (52+)' {
  const mode = (order.orderType || order.paymentMode || '').toUpperCase();
  const isCod = mode.includes('COD');
  const amt = order.amount ?? order.totalAmount ?? 0;
  const isMissingPhone = !order.phoneNumber || order.phoneNumber.length < 10;
  const isMissingAddress = !order.shippingAddress && !order.address;

  if (isCod) {
    if (amt > 2000 || isMissingPhone || isMissingAddress) {
      return 'High (52+)';
    }
    if (amt >= 800) {
      return 'Medium (21 - 51)';
    }
  }
  return 'Low (0 - 20)';
}

/**
 * Resolves canonical channel: 'Online Store / Shopify', 'Website', 'Manual / Direct', 'Delhivery Direct'
 */
export function calculateOrderChannel(order: UnifiedLogisticsOrder): string {
  const src = (order.source || (order as any).channel || '').toLowerCase();
  const tags = (order.tags || []).join(' ').toLowerCase();

  if (src.includes('shopify') || tags.includes('shopify')) return 'Online Store / Shopify';
  if (src.includes('website') || src.includes('web') || tags.includes('website')) return 'Website';
  if (src.includes('delhivery') || tags.includes('delhivery')) return 'Delhivery Direct';
  return 'Website';
}

/**
 * Calculates payment mode: 'COD', 'Prepaid', 'Pickup', 'Replacement'
 */
export function calculateOrderPaymentMode(order: UnifiedLogisticsOrder): 'COD' | 'Prepaid' | 'Pickup' | 'Replacement' {
  const mode = (order.orderType || order.paymentMode || '').toUpperCase();
  const tags = (order.tags || []).join(' ').toUpperCase();

  if (tags.includes('REPLACEMENT') || mode.includes('REPLACE')) return 'Replacement';
  if (tags.includes('PICKUP') || mode.includes('PICKUP')) return 'Pickup';
  if (mode.includes('COD')) return 'COD';
  return 'Prepaid';
}

/**
 * Determines verification status: 'Verified' | 'Unverified'
 */
export function calculateOrderVerified(order: UnifiedLogisticsOrder): 'Verified' | 'Unverified' {
  const hasPhone = !!(order.phoneNumber && order.phoneNumber.length >= 10);
  const hasAddress = !!((order.shippingAddress || order.address) && (order.pincode || order.state));
  const isPrepaid = !(order.orderType || order.paymentMode || '').toUpperCase().includes('COD');

  if (isPrepaid || (hasPhone && hasAddress)) {
    return 'Verified';
  }
  return 'Unverified';
}

/**
 * Calculates address score: 'Complete (100%)', 'Good (75-99%)', 'Partial (50-74%)', 'Poor (<50%)'
 */
export function calculateOrderAddressScore(order: UnifiedLogisticsOrder): 'Complete (100%)' | 'Good (75-99%)' | 'Partial (50-74%)' | 'Poor (<50%)' {
  let score = 0;
  const addr = (order.shippingAddress || order.address || '').trim();
  const phone = (order.phoneNumber || order.phone || '').trim();
  const pin = (order.pincode || '').trim();
  const city = (order.city || order.shippingCity || '').trim();
  const state = (order.state || order.shippingState || '').trim();

  if (addr.length >= 15) score += 30;
  else if (addr.length > 5) score += 15;

  if (phone.length >= 10) score += 25;
  if (pin.length === 6) score += 20;
  if (city.length > 2) score += 15;
  if (state.length > 2) score += 10;

  if (score >= 95) return 'Complete (100%)';
  if (score >= 75) return 'Good (75-99%)';
  if (score >= 50) return 'Partial (50-74%)';
  return 'Poor (<50%)';
}

/**
 * Calculates shipping zone: Zone A - F, S1 - S4
 */
export function calculateOrderZone(order: UnifiedLogisticsOrder): string {
  const st = (order.state || order.shippingState || '').toLowerCase();
  
  // Tamil Nadu local -> Zone A
  if (st.includes('tamil nadu') || st === 'tn') return 'Zone A';

  // Regional South India -> Zone B
  if (
    st.includes('kerala') || 
    st.includes('karnataka') || 
    st.includes('andhra') || 
    st.includes('telangana') || 
    st.includes('puducherry') || 
    st.includes('pondicherry')
  ) {
    return 'Zone B';
  }

  // Metro destinations -> Zone C
  if (
    st.includes('maharashtra') || 
    st.includes('delhi') || 
    st.includes('west bengal') || 
    st.includes('gujarat')
  ) {
    return 'Zone C';
  }

  // Rest of India -> Zone D
  if (
    st.includes('uttar pradesh') || 
    st.includes('madhya pradesh') || 
    st.includes('rajasthan') || 
    st.includes('punjab') || 
    st.includes('haryana') || 
    st.includes('bihar') || 
    st.includes('odisha')
  ) {
    return 'Zone D';
  }

  // North East & J&K -> Zone E
  if (
    st.includes('assam') || 
    st.includes('jammu') || 
    st.includes('kashmir') || 
    st.includes('manipur') || 
    st.includes('meghalaya') || 
    st.includes('tripura') || 
    st.includes('nagaland') || 
    st.includes('mizoram')
  ) {
    return 'Zone E';
  }

  return 'Zone F';
}

/**
 * Counts active filter restrictions
 */
export function countActiveLogisticsFilters(filters: LogisticsFilterState): number {
  let count = 0;
  if (filters.datePreset !== 'all' || filters.startDate || filters.endDate) count++;
  if (filters.manifestDatePreset !== 'all' || filters.manifestStartDate || filters.manifestEndDate) count++;
  if (filters.deliveredDatePreset !== 'all' || filters.deliveredStartDate || filters.deliveredEndDate) count++;
  if (filters.returnedDatePreset !== 'all' || filters.returnedStartDate || filters.returnedEndDate) count++;
  if (filters.bulkAwbs.length > 0) count++;
  if (filters.shipmentStatuses.length > 0) count++;
  if (filters.pickupLocations.length > 0) count++;
  if (filters.transportModes.length > 0) count++;
  if (filters.paymentModes.length > 0) count++;
  if (filters.riskOfReturn.length > 0) count++;
  if (filters.channels.length > 0) count++;
  if (filters.verifiedStatuses.length > 0) count++;
  if (filters.orderTags.length > 0) count++;
  if (filters.addressScores.length > 0) count++;
  if (filters.zones.length > 0) count++;
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
  if (filters.minAmount.trim() || filters.maxAmount.trim()) count++;
  return count;
}

/**
 * Non-destructively filters logistics orders based on complete filter state
 */
export function applyLogisticsFilters(
  orders: UnifiedLogisticsOrder[],
  filters: LogisticsFilterState
): UnifiedLogisticsOrder[] {
  // 1. Section matching first
  let targetOrders = orders;
  if (filters.activeSection && filters.activeSection !== 'all_shipments') {
    targetOrders = targetOrders.filter(o => isOrderMatchingSection(o, filters.activeSection));
  }

  // 2. Resolve effective dates
  let effectiveStart = filters.startDate;
  let effectiveEnd = filters.endDate;
  if (filters.datePreset !== 'all' && filters.datePreset !== 'custom') {
    const resolved = resolveDateRangeForPreset(filters.datePreset);
    effectiveStart = resolved.start;
    effectiveEnd = resolved.end;
  }

  let manifestStart = filters.manifestStartDate;
  let manifestEnd = filters.manifestEndDate;
  if (filters.manifestDatePreset !== 'all' && filters.manifestDatePreset !== 'custom') {
    const resM = resolveDateRangeForPreset(filters.manifestDatePreset);
    manifestStart = resM.start;
    manifestEnd = resM.end;
  }

  let deliveredStart = filters.deliveredStartDate;
  let deliveredEnd = filters.deliveredEndDate;
  if (filters.deliveredDatePreset !== 'all' && filters.deliveredDatePreset !== 'custom') {
    const resD = resolveDateRangeForPreset(filters.deliveredDatePreset);
    deliveredStart = resD.start;
    deliveredEnd = resD.end;
  }

  let returnedStart = filters.returnedStartDate;
  let returnedEnd = filters.returnedEndDate;
  if (filters.returnedDatePreset !== 'all' && filters.returnedDatePreset !== 'custom') {
    const resR = resolveDateRangeForPreset(filters.returnedDatePreset);
    returnedStart = resR.start;
    returnedEnd = resR.end;
  }

  return targetOrders.filter(order => {
    // A. GENERAL DATE (Order Date)
    if (effectiveStart || effectiveEnd) {
      const rawTargetDate = order.orderDate || '';
      if (!rawTargetDate) return false;
      const parsed = parseAndFormatLogisticsDate(rawTargetDate);
      const ymd = parsed.isoDate || (rawTargetDate.length >= 10 && rawTargetDate.includes('-') ? rawTargetDate.slice(0, 10) : '');
      if (!ymd) return false;
      if (effectiveStart && ymd < effectiveStart) return false;
      if (effectiveEnd && ymd > effectiveEnd) return false;
    }

    // B. MANIFESTED DATE (Dispatch / Manifest Date)
    if (manifestStart || manifestEnd) {
      const rawManifest = order.dispatchDate || '';
      if (!rawManifest) return false;
      const parsed = parseAndFormatLogisticsDate(rawManifest);
      const ymd = parsed.isoDate || (rawManifest.length >= 10 && rawManifest.includes('-') ? rawManifest.slice(0, 10) : '');
      if (!ymd) return false;
      if (manifestStart && ymd < manifestStart) return false;
      if (manifestEnd && ymd > manifestEnd) return false;
    }

    // C. DELIVERED DATE (Strictly delivery timestamp)
    if (deliveredStart || deliveredEnd) {
      const rawDelivered = order.deliveredDate || '';
      if (!rawDelivered) return false;
      const parsed = parseAndFormatLogisticsDate(rawDelivered);
      const ymd = parsed.isoDate || (rawDelivered.length >= 10 && rawDelivered.includes('-') ? rawDelivered.slice(0, 10) : '');
      if (!ymd) return false;
      if (deliveredStart && ymd < deliveredStart) return false;
      if (deliveredEnd && ymd > deliveredEnd) return false;
    }

    // D. RETURNED DATE (RTO timestamp)
    if (returnedStart || returnedEnd) {
      const rawReturned = (order as any).rtoDeliveredDate || order.syncedAt || order.lastUpdated || order.dispatchDate || '';
      if (!rawReturned) return false;
      const parsed = parseAndFormatLogisticsDate(rawReturned);
      const ymd = parsed.isoDate || (rawReturned.length >= 10 && rawReturned.includes('-') ? rawReturned.slice(0, 10) : '');
      if (!ymd) return false;
      if (returnedStart && ymd < returnedStart) return false;
      if (returnedEnd && ymd > returnedEnd) return false;
    }

    // E. BULK AWB SEARCH
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

    // F. SHIPMENT STATUS
    if (filters.shipmentStatuses.length > 0) {
      const currentStatus = getOrderShipmentStatus(order).toLowerCase();
      const matchedStatus = filters.shipmentStatuses.some(st => {
        const stLower = st.toLowerCase();
        if (stLower === 'all') return true;
        if (stLower === 'not picked') return currentStatus.includes('ready') || currentStatus.includes('pending');
        return currentStatus === stLower || currentStatus.includes(stLower);
      });
      if (!matchedStatus) return false;
    }

    // G. PICKUP LOCATION
    if (filters.pickupLocations.length > 0) {
      const loc = (order.pickupLocation || 'VELMORA CONSUMER B2C Erode 638002').toLowerCase();
      const matchedLoc = filters.pickupLocations.some(pl => loc.includes(pl.toLowerCase()));
      if (!matchedLoc) return false;
    }

    // H. TRANSPORT MODE ('Surface', 'Express' / 'Air')
    if (filters.transportModes.length > 0) {
      const tm = (order.transportMode || 'Surface').toLowerCase();
      const matchedTm = filters.transportModes.some(m => {
        const mLower = m.toLowerCase();
        if (mLower === 'express') return tm.includes('express') || tm.includes('air');
        if (mLower === 'surface') return tm.includes('surface') || !tm.includes('express');
        return tm === mLower;
      });
      if (!matchedTm) return false;
    }

    // I. PAYMENT MODE ('COD', 'Prepaid', 'Pickup', 'Replacement')
    if (filters.paymentModes.length > 0) {
      const pMode = calculateOrderPaymentMode(order);
      const matchedPayment = filters.paymentModes.some(m => {
        if (m.toUpperCase() === 'COD') return pMode === 'COD';
        if (m.toUpperCase() === 'PREPAID') return pMode === 'Prepaid';
        if (m.toUpperCase() === 'PICKUP') return pMode === 'Pickup';
        if (m.toUpperCase() === 'REPLACEMENT') return pMode === 'Replacement';
        return pMode.toLowerCase() === m.toLowerCase();
      });
      if (!matchedPayment) return false;
    }

    // J. RISK OF RETURN
    if (filters.riskOfReturn.length > 0) {
      const risk = calculateOrderRiskOfReturn(order);
      if (!filters.riskOfReturn.includes(risk)) return false;
    }

    // K. CHANNELS
    if (filters.channels.length > 0) {
      const ch = calculateOrderChannel(order);
      const matchedCh = filters.channels.some(c => c.toLowerCase() === ch.toLowerCase() || ch.toLowerCase().includes(c.toLowerCase()));
      if (!matchedCh) return false;
    }

    // L. VERIFIED STATUS
    if (filters.verifiedStatuses.length > 0) {
      const v = calculateOrderVerified(order);
      if (!filters.verifiedStatuses.includes(v)) return false;
    }

    // M. ORDER TAGS
    if (filters.orderTags.length > 0) {
      const orderTags = (order.tags || []).map(t => t.toLowerCase());
      const hasTag = filters.orderTags.some(t => orderTags.includes(t.toLowerCase()));
      if (!hasTag) return false;
    }

    // N. ADDRESS SCORE
    if (filters.addressScores.length > 0) {
      const score = calculateOrderAddressScore(order);
      if (!filters.addressScores.includes(score)) return false;
    }

    // O. ZONE
    if (filters.zones.length > 0) {
      const zone = calculateOrderZone(order);
      if (!filters.zones.includes(zone)) return false;
    }

    // P. CANCELLATION STATUS
    if (filters.cancellationStatuses.length > 0) {
      const cs = (order.cancellationStatus || (order.status === 'Cancelled' ? 'Completed' : '')).toLowerCase();
      const matchedCs = filters.cancellationStatuses.some(c => cs === c.toLowerCase());
      if (!matchedCs) return false;
    }

    // Q. ORDER TEXT SEARCHES
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

    // R. LOCATION
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

    // S. DISPATCH & COURIER
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

    // T. SHIPMENT TRACKING
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
