import { supabase } from '../../../../lib/supabase';
import { db } from '../../../../lib/db';
import { cleanOrderId } from '../../../../services/unifiedLogisticsService';

export interface StCourierTimelineEvent {
  timestamp: string;
  activity: string;
  location: string;
}

export interface StCourierTrackedResult {
  success: boolean;
  awb: string;
  status: string;
  rawStatus: string;
  remarks?: string;
  origin?: string;
  destination?: string;
  deliveryDate?: string;
  dispatchedDate?: string;
  lastLocation?: string;
  trackingDateTime?: string;
  events?: StCourierTimelineEvent[];
  error?: string;
  notFound?: boolean;
}

export type StCourierRecordCategory = 
  | 'READY'            // ST Courier & valid 11-digit AWB
  | 'BLANK_COURIER'    // Courier is blank & valid 11-digit AWB
  | 'OTHER_CARRIER'    // Belongs to another courier
  | 'INVALID_AWB';     // ST Courier but missing/invalid AWB

export type BlankCourierAction = 'CONFIRM_ST' | 'ASSIGN_OTHER' | 'SKIP';

export type StCourierNormalizedStatus = 
  | 'Delivered'
  | 'RTO'
  | 'Out for Delivery'
  | 'In Transit'
  | 'Undelivered'
  | 'Needs Review';

export type StCourierStatusDiff = 
  | 'NEW_DELIVERY'
  | 'NEW_RTO'
  | 'STATUS_CHANGED'
  | 'UNCHANGED'
  | 'NEEDS_REVIEW'
  | 'NOT_FOUND';

export interface StCourierRecord {
  id: string; // unique key
  orderId: string;
  cleanOrderId: string;
  orderDate?: string;
  customerName?: string;
  phone?: string;
  city?: string;
  state?: string;
  paymentMode?: string;
  orderValue?: number;
  dispatchStatus?: string;
  awbNumber: string;
  cleanAwb: string;
  courier: string;
  productDescription?: string;
  quantity?: number;
  currentSalesStatus?: string;
  currentDeliveredDate?: string;
  
  category: StCourierRecordCategory;
  blankCourierAction?: BlankCourierAction;
  selected: boolean;
  
  trackingState: 'PENDING' | 'TRACKING' | 'TRACKED' | 'FAILED' | 'NOT_FOUND' | 'SKIPPED';
  retryCount: number;
  trackedResult?: StCourierTrackedResult;
  normalizedOutcome?: StCourierNormalizedStatus;
  statusDiff?: StCourierStatusDiff;
}

export interface StCourierPreflightSummary {
  totalRows: number;
  readyCount: number;
  blankCourierCount: number;
  otherCarrierCount: number;
  invalidAwbCount: number;
}

export interface StCourierBotJobState {
  jobId: string;
  status: 'IDLE' | 'PREFLIGHT' | 'RUNNING' | 'PAUSED' | 'REVIEW' | 'COMMITTING' | 'COMPLETED' | 'CANCELLED';
  records: StCourierRecord[];
  totalToTrack: number;
  processedCount: number;
  trackedCount: number;
  failedCount: number;
  notFoundCount: number;
  needsReviewCount: number;
  deliveredCount: number;
  rtoCount: number;
  inTransitCount: number;
  newDeliveredCount: number;
  newRtoCount: number;
  unchangedCount: number;
  currentAwb?: string;
  startTime?: number;
  estimatedRemainingSeconds?: number;
}

const LOCAL_STORAGE_JOB_KEY = 'velmora_st_courier_jobs';

/**
 * Normalizes ST Courier raw statuses according to business requirements:
 * - RTO / Return to Origin / Returned to Seller -> RTO
 * - Cancelled -> Needs Review (or kept as is)
 * - Undelivered / Attempted / Refused -> In Transit / Undelivered (NEVER Delivered!)
 * - Out for Delivery -> Out for Delivery
 * - Delivered / Delivered to Consignee -> Delivered (Strictly NOT undelivered!)
 * - In Transit / Dispatched / Consignment Booked -> In Transit
 * - Unknown / Ambiguous status -> Needs Review
 */
export function normalizeStCourierStatus(
  rawStatus?: string, 
  latestEvent?: string,
  events?: StCourierTimelineEvent[]
): StCourierNormalizedStatus {
  const s = ((rawStatus || '') + ' ' + (latestEvent || '')).toLowerCase().trim();

  // 0. Check all historical events for explicit RTO
  let hasRtoEvent = false;
  let hasLatestTerminalDelivery = false;
  if (Array.isArray(events) && events.length > 0) {
    for (let i = 0; i < events.length; i++) {
      const act = (events[i]?.activity || '').toLowerCase();
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
        hasRtoEvent = true;
      }
      if (i === 0 && (act.includes('delivered to consignee') || act === 'delivered')) {
        hasLatestTerminalDelivery = true;
      }
    }
  }

  if (hasRtoEvent && !hasLatestTerminalDelivery) {
    return 'RTO';
  }

  if (!s && !hasRtoEvent) return 'Needs Review';

  // 1. Explicit RTO checks (Check FIRST before any other status)
  if (
    s.includes('return to origin') ||
    s.includes('return to orgin') ||
    s.includes('returntoorigin') ||
    s.includes('returntoorgin') ||
    s.includes('returned to origin') ||
    s.includes('returned to seller') ||
    s.includes('return to seller') ||
    s.includes('rto delivered') ||
    s.includes('rto in transit') ||
    s.includes('rto initiated') ||
    s === 'rto' ||
    s.startsWith('rto ') ||
    s.includes(' rto ') ||
    s.endsWith(' rto')
  ) {
    return 'RTO';
  }

  // 2. Explicit Cancelled
  if (s.includes('cancel')) {
    return 'Needs Review';
  }

  // 3. Undelivered / Attempted / Refused (MUST BE CHECKED BEFORE Delivered, because "un delivered" contains "delivered")
  if (
    s.includes('un delivered') ||
    s.includes('undelivered') ||
    s.includes('failed attempt') ||
    s.includes('attempted') ||
    s.includes('delivery failed') ||
    s.includes('customer not available') ||
    s.includes('door locked') ||
    s.includes('consignee not available') ||
    s.includes('refused')
  ) {
    return 'In Transit';
  }

  // 4. Out for delivery
  if (s.includes('out for delivery') || s.includes('out_for_delivery') || s.includes('ofd')) {
    return 'Out for Delivery';
  }

  // 5. Delivered checks (STRICT: must not include undelivered)
  if (
    s.includes('delivered to consignee') ||
    (s.includes('delivered') && !s.includes('undelivered') && !s.includes('un delivered'))
  ) {
    return 'Delivered';
  }

  // 6. In Transit / Dispatched / Booked / Processed
  if (
    s.includes('in transit') ||
    s.includes('in-transit') ||
    s.includes('transit') ||
    s.includes('consignment booked') ||
    s.includes('processed & forwarded') ||
    s.includes('forwarded') ||
    s.includes('dispatched') ||
    s.includes('hub') ||
    s.includes('facility') ||
    s.includes('arrived') ||
    s.includes('departed') ||
    s.includes('shipped')
  ) {
    return 'In Transit';
  }

  return 'Needs Review';
}

/**
 * Clean and standardize an AWB string
 */
export function sanitizeAwb(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  return s.replace(/[^0-9]/g, '');
}

/**
 * Categorize records for pre-flight validation
 */
export function categorizeRawRecords(rawRows: any[][]): { records: StCourierRecord[]; summary: StCourierPreflightSummary } {
  if (!rawRows || rawRows.length <= 1) {
    return {
      records: [],
      summary: { totalRows: 0, readyCount: 0, blankCourierCount: 0, otherCarrierCount: 0, invalidAwbCount: 0 }
    };
  }

  const headerRow = rawRows[0].map(h => (h !== null && h !== undefined ? String(h).trim().toLowerCase() : ''));

  // Column Index Resolver
  const findCol = (keys: string[]): number => {
    for (const key of keys) {
      const idx = headerRow.findIndex(h => h.includes(key));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colOid = findCol(['order id', 'order_id', 'order number', 'order no']);
  const colDate = findCol(['order date', 'order_date', 'date']);
  const colCust = findCol(['customer name', 'customer', 'consignee']);
  const colPhone = findCol(['phone', 'mobile', 'contact']);
  const colCity = findCol(['city', 'destination city']);
  const colState = findCol(['state', 'destination state']);
  const colPay = findCol(['payment mode', 'payment type', 'payment method', 'payment']);
  const colVal = findCol(['order value', 'order value (inr)', 'amount', 'total', 'price']);
  const colDispatch = findCol(['dispatch status', 'fulfillment status', 'fulfillment']);
  const colAwb = findCol(['awb number', 'awb no', 'awb', 'waybill', 'tracking number', 'tracking']);
  const colCourier = findCol(['courier name', 'courier', 'carrier', 'transporter']);
  const colProd = findCol(['product description', 'product', 'items', 'item']);
  const colQty = findCol(['quantity', 'qty']);

  const records: StCourierRecord[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }

    const rawOid = colOid !== -1 ? String(row[colOid] ?? '').trim() : '';
    if (!rawOid) continue;

    const cleanOid = cleanOrderId(rawOid);
    const displayOid = rawOid.startsWith('#') ? rawOid : `#${rawOid}`;
    const rawAwb = colAwb !== -1 ? String(row[colAwb] ?? '').trim() : '';
    const cleanAwb = sanitizeAwb(rawAwb);
    const rawCourier = colCourier !== -1 ? String(row[colCourier] ?? '').trim() : '';

    const isStCourier = rawCourier.toLowerCase().includes('st courier') || rawCourier.toLowerCase().includes('stcourier');
    const isBlankCourier = !rawCourier || rawCourier === '-' || rawCourier.toLowerCase() === 'pending allocation' || rawCourier.toLowerCase() === 'unknown' || rawCourier.toLowerCase().includes('not available');
    const isValid11DigitAwb = cleanAwb.length === 11;

    let category: StCourierRecordCategory = 'READY';

    if (isStCourier && isValid11DigitAwb) {
      category = 'READY';
    } else if (isBlankCourier && isValid11DigitAwb) {
      category = 'BLANK_COURIER';
    } else if (!isStCourier && !isBlankCourier) {
      category = 'OTHER_CARRIER';
    } else {
      category = 'INVALID_AWB';
    }

    records.push({
      id: `${cleanOid}_${cleanAwb || i}`,
      orderId: displayOid,
      cleanOrderId: cleanOid,
      orderDate: colDate !== -1 && row[colDate] ? String(row[colDate]).trim() : undefined,
      customerName: colCust !== -1 && row[colCust] ? String(row[colCust]).trim() : undefined,
      phone: colPhone !== -1 && row[colPhone] ? String(row[colPhone]).trim() : undefined,
      city: colCity !== -1 && row[colCity] ? String(row[colCity]).trim() : undefined,
      state: colState !== -1 && row[colState] ? String(row[colState]).trim() : undefined,
      paymentMode: colPay !== -1 && row[colPay] ? String(row[colPay]).trim() : undefined,
      orderValue: colVal !== -1 && row[colVal] ? parseFloat(String(row[colVal]).replace(/[^0-9.]/g, '')) || 0 : 0,
      dispatchStatus: colDispatch !== -1 && row[colDispatch] ? String(row[colDispatch]).trim() : undefined,
      awbNumber: rawAwb,
      cleanAwb,
      courier: rawCourier || (category === 'BLANK_COURIER' ? 'Unassigned' : 'Unknown'),
      productDescription: colProd !== -1 && row[colProd] ? String(row[colProd]).trim() : undefined,
      quantity: colQty !== -1 && row[colQty] ? parseInt(String(row[colQty]), 10) || 1 : 1,
      category,
      selected: category === 'READY',
      trackingState: category === 'READY' ? 'PENDING' : 'SKIPPED',
      retryCount: 0
    });
  }

  const summary: StCourierPreflightSummary = {
    totalRows: records.length,
    readyCount: records.filter(r => r.category === 'READY').length,
    blankCourierCount: records.filter(r => r.category === 'BLANK_COURIER').length,
    otherCarrierCount: records.filter(r => r.category === 'OTHER_CARRIER').length,
    invalidAwbCount: records.filter(r => r.category === 'INVALID_AWB').length
  };

  return { records, summary };
}

/**
 * Categorize existing order records already in memory / Supabase
 */
export function categorizeExistingOrders(orders: any[]): { records: StCourierRecord[]; summary: StCourierPreflightSummary } {
  const records: StCourierRecord[] = [];

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const rawOid = o.order_id || o.display_order_id || '';
    const cleanOid = cleanOrderId(rawOid);
    const displayOid = rawOid.startsWith('#') ? rawOid : `#${rawOid}`;
    const rawAwb = o.awb_number || o.extra_data?.awb_number || '';
    const cleanAwb = sanitizeAwb(rawAwb);
    const rawCourier = o.courier || o.extra_data?.courier || '';

    const isStCourier = rawCourier.toLowerCase().includes('st courier') || rawCourier.toLowerCase().includes('stcourier');
    const isBlankCourier = !rawCourier || rawCourier === '-' || rawCourier.toLowerCase() === 'pending allocation' || rawCourier.toLowerCase() === 'unknown' || rawCourier.toLowerCase().includes('not available');
    const isValid11DigitAwb = cleanAwb.length === 11;

    let category: StCourierRecordCategory = 'READY';

    if (isStCourier && isValid11DigitAwb) {
      category = 'READY';
    } else if (isBlankCourier && isValid11DigitAwb) {
      category = 'BLANK_COURIER';
    } else if (!isStCourier && !isBlankCourier) {
      category = 'OTHER_CARRIER';
    } else {
      category = 'INVALID_AWB';
    }

    records.push({
      id: `${cleanOid}_${cleanAwb || i}`,
      orderId: displayOid,
      cleanOrderId: cleanOid,
      orderDate: o.order_date,
      customerName: o.customer_name,
      phone: o.phone,
      city: o.city,
      state: o.state,
      paymentMode: o.payment_mode,
      orderValue: Number(o.price || o.order_value || 0),
      dispatchStatus: o.dispatch_status,
      awbNumber: rawAwb,
      cleanAwb,
      courier: rawCourier || (category === 'BLANK_COURIER' ? 'Unassigned' : 'Unknown'),
      productDescription: o.items_summary || o.product_description,
      quantity: o.total_items_count || o.quantity || 1,
      currentSalesStatus: o.dispatch_status,
      currentDeliveredDate: o.fulfilled_date || o.delivered_date,
      category,
      selected: category === 'READY',
      trackingState: category === 'READY' ? 'PENDING' : 'SKIPPED',
      retryCount: 0
    });
  }

  const summary: StCourierPreflightSummary = {
    totalRows: records.length,
    readyCount: records.filter(r => r.category === 'READY').length,
    blankCourierCount: records.filter(r => r.category === 'BLANK_COURIER').length,
    otherCarrierCount: records.filter(r => r.category === 'OTHER_CARRIER').length,
    invalidAwbCount: records.filter(r => r.category === 'INVALID_AWB').length
  };

  return { records, summary };
}

/**
 * Call the local / production serverless tracking endpoint with skipDbUpdate=true
 */
export async function trackAwbViaBot(awb: string, retryMax = 2): Promise<StCourierTrackedResult> {
  const cleanAwb = sanitizeAwb(awb);
  if (!cleanAwb || cleanAwb.length !== 11) {
    return {
      success: false,
      awb: cleanAwb,
      status: 'Invalid AWB',
      rawStatus: 'AWB must be 11 digits',
      error: 'Invalid ST Courier AWB format'
    };
  }

  let attempts = 0;
  while (attempts <= retryMax) {
    attempts++;
    try {
      const res = await fetch(`/api/track?awb=${encodeURIComponent(cleanAwb)}&courier=ST+Courier&skipDbUpdate=true`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        if (attempts <= retryMax) {
          await new Promise(r => setTimeout(r, 800 * attempts));
          continue;
        }
        return {
          success: false,
          awb: cleanAwb,
          status: 'Failed',
          rawStatus: `HTTP Error ${res.status}`,
          error: `Server responded with status ${res.status}`
        };
      }

      const data = await res.json();
      return {
        success: Boolean(data.success),
        awb: data.awb || cleanAwb,
        status: data.status || 'Unable to fetch',
        rawStatus: data.rawStatus || data.status || '',
        remarks: data.remarks,
        origin: data.origin,
        destination: data.destination,
        deliveryDate: data.deliveryDate,
        dispatchedDate: data.dispatchedDate,
        lastLocation: data.lastLocation,
        trackingDateTime: data.trackingDateTime,
        events: data.events || [],
        error: data.error,
        notFound: Boolean(data.notFound)
      };
    } catch (err: any) {
      if (attempts <= retryMax) {
        await new Promise(r => setTimeout(r, 1000 * attempts));
        continue;
      }
      return {
        success: false,
        awb: cleanAwb,
        status: 'Network Error',
        rawStatus: err.message || 'Network failure',
        error: err.message || 'Failed to reach tracking server'
      };
    }
  }

  return {
    success: false,
    awb: cleanAwb,
    status: 'Failed',
    rawStatus: 'Exceeded maximum retries',
    error: 'Tracking timed out'
  };
}

/**
 * Direct Database Update Helper
 * Directly updates customer_tracking_shipments and sales_orders in Supabase,
 * and updates local Dexie logistics_orders without requiring manual confirmation.
 */
export async function directApplyTrackedItem(
  item: StCourierRecord,
  result: StCourierTrackedResult,
  normalized: StCourierNormalizedStatus
): Promise<boolean> {
  const isDelivered = normalized === 'Delivered';
  const isRto = normalized === 'RTO';
  const isCancelled = normalized === 'Needs Review' && (result.rawStatus || '').toLowerCase().includes('cancel');

  // Only apply when status is sufficiently clear and matched
  if (normalized === 'Needs Review' && !isCancelled) {
    return false;
  }

  const nowIso = new Date().toISOString();
  const shipmentStatus = isDelivered 
    ? 'Delivered' 
    : isRto 
    ? 'RTO - In Transit' 
    : isCancelled 
    ? 'Cancelled' 
    : (normalized === 'Out for Delivery' ? 'Out for Delivery' : 'In Transit');

  const deliveryDate = (isDelivered && result.deliveryDate) ? result.deliveryDate : null;

  try {
    // 1. Update customer_tracking_shipments in Supabase
    const shipmentPayload = {
      order_id: item.cleanOrderId,
      display_order_id: item.orderId.startsWith('#') ? item.orderId : `#${item.orderId}`,
      awb_number: item.cleanAwb,
      courier: 'ST Courier',
      status: shipmentStatus,
      raw_status: result.rawStatus || normalized,
      remarks: result.remarks || result.rawStatus || null,
      delivered_date: deliveryDate,
      dispatch_date: result.dispatchedDate || item.orderDate || null,
      last_location: result.lastLocation || null,
      tracking_date_time: result.trackingDateTime || deliveryDate || null,
      customer_name: item.customerName || 'Customer',
      amount: item.orderValue || 0,
      order_type: item.paymentMode || 'Prepaid',
      status_source: 'BOT_ST_COURIER',
      source_type: 'BOT_TRACKING',
      last_synced_at: nowIso,
      updated_at: nowIso
    };

    await supabase
      .from('customer_tracking_shipments')
      .upsert(shipmentPayload, { onConflict: 'courier,awb_number' });

    // 2. Update sales_orders in Supabase
    const { data: existingOrder } = await supabase
      .from('sales_orders')
      .select('extra_data, dispatch_status')
      .eq('order_id', item.cleanOrderId)
      .maybeSingle();

    const currentExtra = existingOrder?.extra_data || {};
    const isCarrierRto = String(currentExtra.current_status || currentExtra['Current Status'] || currentExtra['Current stauts'] || '').toLowerCase().includes('return to orgin') ||
      String(currentExtra.current_status || currentExtra['Current Status'] || currentExtra['Current stauts'] || '').toLowerCase().includes('return to origin');

    const updatePayload: Record<string, any> = {
      updated_at: nowIso
    };
    if (isDelivered) {
      updatePayload.dispatch_status = 'DELIVERED';
    } else if (isRto || isCarrierRto) {
      updatePayload.dispatch_status = 'RTO';
    } else if (isCancelled) {
      updatePayload.dispatch_status = 'CANCELLED';
    }

    updatePayload.extra_data = {
      ...currentExtra,
      awb_number: item.cleanAwb,
      courier: 'ST Courier',
      delivered_date: isDelivered ? (deliveryDate || currentExtra.delivered_date) : null,
      st_courier_tracking: {
        awb: item.cleanAwb,
        courier: 'ST Courier',
        status: normalized,
        raw_status: result.rawStatus,
        latest_activity: result.remarks,
        last_location: result.lastLocation,
        delivery_date: isDelivered ? deliveryDate : null,
        events: result.events || [],
        events_count: result.events?.length || 0,
        synced_at: nowIso,
        source: 'BOT_ST_COURIER'
      }
    };

    await supabase
      .from('sales_orders')
      .update(updatePayload)
      .eq('order_id', item.cleanOrderId);

    // 3. Update Dexie db.logistics_orders if available
    try {
      if (typeof window !== 'undefined' && db && db.logistics_orders) {
        const localOrders = await db.logistics_orders.where('order_id').equals(item.cleanOrderId).toArray();
        for (const lo of localOrders) {
          await db.logistics_orders.update(lo.id, {
            status: shipmentStatus,
            raw_status: result.rawStatus,
            delivered_date: deliveryDate || undefined,
            last_location: result.lastLocation,
            updated_at: nowIso
          });
        }
      }
    } catch (dexErr) {
      // Local Dexie non-blocking
    }

    return true;
  } catch (err) {
    console.warn(`[ST COURIER BOT] Direct update failed for #${item.cleanOrderId}:`, err);
    return false;
  }
}

/**
 * ST Courier BOT Execution Engine
 */
export class StCourierBotEngine {
  private records: StCourierRecord[] = [];
  private onStateChange: (state: StCourierBotJobState) => void;
  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private currentJobId: string;
  private startTime: number = 0;

  constructor(records: StCourierRecord[], onStateChange: (state: StCourierBotJobState) => void) {
    this.records = records;
    this.onStateChange = onStateChange;
    this.currentJobId = `st_courier_job_${Date.now()}`;
  }

  public getSnapshot(): StCourierBotJobState {
    const toTrack = this.records.filter(r => r.selected && r.category === 'READY');
    const processed = this.records.filter(r => r.trackingState === 'TRACKED' || r.trackingState === 'FAILED' || r.trackingState === 'NOT_FOUND');
    const tracked = this.records.filter(r => r.trackingState === 'TRACKED');
    const failed = this.records.filter(r => r.trackingState === 'FAILED' || r.trackingState === 'NOT_FOUND');
    const notFound = this.records.filter(r => r.trackingState === 'NOT_FOUND');
    const needsReview = this.records.filter(r => r.normalizedOutcome === 'Needs Review' || r.trackingState === 'FAILED');
    const deliveredCount = this.records.filter(r => r.trackingState === 'TRACKED' && r.normalizedOutcome === 'Delivered').length;
    const rtoCount = this.records.filter(r => r.trackingState === 'TRACKED' && r.normalizedOutcome === 'RTO').length;
    const inTransitCount = this.records.filter(r => r.trackingState === 'TRACKED' && (r.normalizedOutcome === 'In Transit' || r.normalizedOutcome === 'Out for Delivery' || r.normalizedOutcome === 'Undelivered')).length;
    const newDelivered = this.records.filter(r => r.statusDiff === 'NEW_DELIVERY');
    const newRto = this.records.filter(r => r.statusDiff === 'NEW_RTO');
    const unchanged = this.records.filter(r => r.statusDiff === 'UNCHANGED');

    // Estimate remaining seconds
    let estimatedRemainingSeconds: number | undefined;
    if (this.isRunning && this.startTime && processed.length > 0) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const ratePerSec = processed.length / elapsed;
      const remaining = toTrack.length - processed.length;
      if (ratePerSec > 0 && remaining > 0) {
        estimatedRemainingSeconds = Math.round(remaining / ratePerSec);
      }
    }

    const isDone = !this.isRunning && processed.length >= toTrack.length && toTrack.length > 0;

    return {
      jobId: this.currentJobId,
      status: this.isCancelled ? 'CANCELLED' : this.isPaused ? 'PAUSED' : this.isRunning ? 'RUNNING' : isDone ? 'COMPLETED' : 'IDLE',
      records: this.records,
      totalToTrack: toTrack.length,
      processedCount: processed.length,
      trackedCount: tracked.length,
      failedCount: failed.length,
      notFoundCount: notFound.length,
      needsReviewCount: needsReview.length,
      deliveredCount,
      rtoCount,
      inTransitCount,
      newDeliveredCount: newDelivered.length,
      newRtoCount: newRto.length,
      unchangedCount: unchanged.length,
      startTime: this.startTime,
      estimatedRemainingSeconds
    };
  }

  private persistState() {
    try {
      const snap = this.getSnapshot();
      localStorage.setItem(LOCAL_STORAGE_JOB_KEY, JSON.stringify(snap));
      this.onStateChange(snap);
    } catch (e) {
      console.warn('Failed to persist ST Courier job state:', e);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = Date.now();

    const queue = this.records.filter(r => r.selected && r.category === 'READY' && r.trackingState !== 'TRACKED');
    
    // Concurrency limit: 2 workers, with polite delay of ~350ms between requests
    const concurrency = 2;
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < queue.length && !this.isCancelled) {
        if (this.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        const idx = currentIndex++;
        const item = queue[idx];
        if (!item) break;

        item.trackingState = 'TRACKING';
        this.persistState();

        const result = await trackAwbViaBot(item.cleanAwb);
        item.trackedResult = result;

        if (result.success) {
          item.trackingState = 'TRACKED';
          const isResultRto = result.status && (result.status.toLowerCase().includes('rto') || result.status.toLowerCase() === 'rto');
          const normalized = isResultRto
            ? 'RTO'
            : normalizeStCourierStatus(result.rawStatus, result.remarks, result.events);
          item.normalizedOutcome = normalized;

          // Determine statusDiff compared with current sales status
          const cur = (item.currentSalesStatus || '').toLowerCase();
          if (normalized === 'Delivered') {
            item.statusDiff = cur.includes('deliv') ? 'UNCHANGED' : 'NEW_DELIVERY';
          } else if (normalized === 'RTO') {
            item.statusDiff = cur.includes('rto') ? 'UNCHANGED' : 'NEW_RTO';
          } else if (normalized === 'Needs Review') {
            item.statusDiff = 'NEEDS_REVIEW';
          } else {
            item.statusDiff = cur === normalized.toLowerCase() ? 'UNCHANGED' : 'STATUS_CHANGED';
          }

          // DIRECT UPDATE: Immediately apply verified tracking results to database
          if (normalized !== 'Needs Review') {
            await directApplyTrackedItem(item, result, normalized);
          }
        } else if (result.notFound) {
          item.trackingState = 'NOT_FOUND';
          item.statusDiff = 'NOT_FOUND';
          item.normalizedOutcome = 'Needs Review';
        } else {
          item.trackingState = 'FAILED';
          item.statusDiff = 'NEEDS_REVIEW';
          item.normalizedOutcome = 'Needs Review';
        }

        this.persistState();

        // Rate limiter polite delay
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    this.isRunning = false;
    this.persistState();

    // Broadcast synchronization events to Sales and Logistics
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', {
        detail: { source: 'BOT_ST_COURIER', timestamp: Date.now() }
      }));
      window.dispatchEvent(new CustomEvent('velmora:logistics_updated', {
        detail: { source: 'BOT_ST_COURIER', timestamp: Date.now() }
      }));
    }
  }

  public pause(): void {
    this.isPaused = true;
    this.persistState();
  }

  public resume(): void {
    this.isPaused = false;
    if (!this.isRunning) {
      this.start();
    } else {
      this.persistState();
    }
  }

  public cancel(): void {
    this.isCancelled = true;
    this.isRunning = false;
    this.persistState();
  }

  public async retryFailed(): Promise<void> {
    for (const item of this.records) {
      if (item.trackingState === 'FAILED' || item.trackingState === 'NOT_FOUND') {
        item.trackingState = 'PENDING';
        item.retryCount = 0;
      }
    }
    this.persistState();
    await this.start();
  }
}

/**
 * Approval & Database Update Commit
 * ONLY executed when administrator confirms approval.
 * Updates both customer_tracking_shipments and sales_orders in Supabase.
 * Preserves financial integrity and all order line items.
 */
export async function commitApprovedTrackingUpdates(
  records: StCourierRecord[],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ totalApproved: number; updatedShipments: number; updatedSalesOrders: number; skippedCount: number }> {
  // Only process items that were approved/selected and have valid tracked results
  const approved = records.filter(r => r.selected && r.trackingState === 'TRACKED' && r.trackedResult?.success);
  const nowIso = new Date().toISOString();

  let updatedShipments = 0;
  let updatedSalesOrders = 0;
  const skippedCount = records.length - approved.length;

  const total = approved.length;
  if (total === 0) {
    return { totalApproved: 0, updatedShipments: 0, updatedSalesOrders: 0, skippedCount };
  }

  // Process in chunks of 50 to prevent database payload limits
  const chunkSize = 50;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = approved.slice(i, i + chunkSize);
    onProgress?.(i, total, `Updating tracking shipments (${i + 1} - ${Math.min(i + chunkSize, total)} of ${total})...`);

    // 1. Batch upsert into customer_tracking_shipments
    const shipmentRows = chunk.map(r => {
      const res = r.trackedResult!;
      const isDelivered = r.normalizedOutcome === 'Delivered';
      const isRto = r.normalizedOutcome === 'RTO';

      return {
        order_id: r.cleanOrderId,
        display_order_id: r.orderId.startsWith('#') ? r.orderId : `#${r.orderId}`,
        awb_number: r.cleanAwb,
        courier: 'ST Courier',
        status: r.normalizedOutcome || 'In Transit',
        raw_status: res.rawStatus || r.normalizedOutcome || '',
        remarks: res.remarks || res.rawStatus || null,
        delivered_date: (isDelivered && res.deliveryDate) ? res.deliveryDate : null,
        dispatch_date: res.dispatchedDate || r.orderDate || null,
        last_location: res.lastLocation || null,
        tracking_date_time: res.trackingDateTime || res.deliveryDate || null,
        customer_name: r.customerName || 'Customer',
        amount: r.orderValue || 0,
        order_type: r.paymentMode || 'Prepaid',
        status_source: 'BOT_ST_COURIER',
        source_type: 'BOT_TRACKING',
        last_synced_at: nowIso,
        updated_at: nowIso
      };
    });

    const { error: shipError } = await supabase
      .from('customer_tracking_shipments')
      .upsert(shipmentRows, { onConflict: 'courier,awb_number' });

    if (shipError) {
      console.error('[ST COURIER BOT] Error updating customer_tracking_shipments:', shipError);
      // Fallback row-by-row
      for (const row of shipmentRows) {
        try {
          await supabase.from('customer_tracking_shipments').upsert(row, { onConflict: 'courier,awb_number' });
          updatedShipments++;
        } catch (e) {
          console.warn('[ST COURIER BOT] Row fallback error:', e);
        }
      }
    } else {
      updatedShipments += shipmentRows.length;
    }

    // 2. Update sales_orders dispatch_status, fulfilled_date, and extra_data
    onProgress?.(i, total, `Updating sales orders dispatch status (${i + 1} - ${Math.min(i + chunkSize, total)} of ${total})...`);
    for (const r of chunk) {
      const res = r.trackedResult!;
      const isDelivered = r.normalizedOutcome === 'Delivered';
      const isRto = r.normalizedOutcome === 'RTO';

      const updatePayload: Record<string, any> = {
        updated_at: nowIso
      };

      if (isDelivered) {
        updatePayload.dispatch_status = 'DELIVERED';
        if (res.deliveryDate) {
          updatePayload.fulfilled_date = res.deliveryDate;
        }
      } else if (isRto) {
        updatePayload.dispatch_status = 'RTO';
      }

      // Preserve existing extra_data and add tracking metadata
      try {
        const { data: existingOrder } = await supabase
          .from('sales_orders')
          .select('extra_data')
          .eq('order_id', r.cleanOrderId)
          .maybeSingle();

        const currentExtra = existingOrder?.extra_data || {};
        updatePayload.extra_data = {
          ...currentExtra,
          awb_number: r.cleanAwb,
          courier: 'ST Courier',
          st_courier_tracking: {
            awb: r.cleanAwb,
            courier: 'ST Courier',
            status: r.normalizedOutcome,
            raw_status: res.rawStatus,
            latest_activity: res.remarks,
            last_location: res.lastLocation,
            delivery_date: res.deliveryDate,
            events: res.events || [],
            events_count: res.events?.length || 0,
            synced_at: nowIso,
            source: 'BOT_ST_COURIER'
          }
        };

        const { error: salesError } = await supabase
          .from('sales_orders')
          .update(updatePayload)
          .eq('order_id', r.cleanOrderId);

        if (!salesError) {
          updatedSalesOrders++;
        }
      } catch (err) {
        console.warn(`[ST COURIER BOT] Error updating sales order #${r.cleanOrderId}:`, err);
      }
    }
  }

  // 3. Clear localStorage job cache & dispatch live update events
  localStorage.removeItem(LOCAL_STORAGE_JOB_KEY);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', {
      detail: { source: 'BOT_ST_COURIER', updatedCount: updatedShipments, timestamp: Date.now() }
    }));
    window.dispatchEvent(new CustomEvent('velmora:logistics_updated', {
      detail: { source: 'BOT_ST_COURIER', updatedCount: updatedShipments, timestamp: Date.now() }
    }));
  }

  return {
    totalApproved: approved.length,
    updatedShipments,
    updatedSalesOrders,
    skippedCount
  };
}

/**
 * Background Queue Manager for Automatic ST Courier Tracking
 * Handles automatic enqueueing upon upload, batching, rate limiting, persistence, and non-blocking background tracking.
 */
class StCourierBotQueueManager {
  private activeEngine: StCourierBotEngine | null = null;
  private listeners: Set<(state: StCourierBotJobState) => void> = new Set();
  private currentState: StCourierBotJobState | null = null;

  constructor() {
    this.loadPersistedState();
  }

  private loadPersistedState() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_JOB_KEY);
      if (saved) {
        this.currentState = JSON.parse(saved);
      }
    } catch (e) {}
  }

  public getSnapshot(): StCourierBotJobState | null {
    if (this.activeEngine) {
      return this.activeEngine.getSnapshot();
    }
    return this.currentState;
  }

  public subscribe(listener: (state: StCourierBotJobState) => void): () => void {
    this.listeners.add(listener);
    const snap = this.getSnapshot();
    if (snap) listener(snap);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(state: StCourierBotJobState) {
    this.currentState = state;
    this.listeners.forEach(fn => fn(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velmora:st_tracking_progress', { detail: state }));
    }
  }

  public async enqueueAndStart(items: any[]): Promise<StCourierBotJobState | null> {
    if (!items || items.length === 0) return null;

    // Filter and sanitize: identify ST Courier records with valid 11-digit AWBs
    const seenAwbs = new Set<string>();
    const eligibleRecords: StCourierRecord[] = [];

    for (const item of items) {
      const rawAwb = item.awbNumber || item.awb_number || item.awb || '';
      const cleanAwb = sanitizeAwb(rawAwb);
      if (!cleanAwb || cleanAwb.length !== 11) continue; // ignore blank or non-11 digit

      // Ignore duplicate AWBs within the same batch
      if (seenAwbs.has(cleanAwb)) continue;
      seenAwbs.add(cleanAwb);

      const rawCourier = (item.courier || item.courier_name || '').toLowerCase();
      const isStCourier = !rawCourier || rawCourier === '-' || rawCourier.includes('st courier') || rawCourier.includes('stcourier') || rawCourier.includes('unknown') || rawCourier.includes('pending allocation');
      if (!isStCourier) continue;

      const rawOid = item.orderId || item.order_id || '';
      const cleanOid = cleanOrderId(rawOid);
      const displayOid = rawOid.startsWith('#') ? rawOid : `#${rawOid}`;

      eligibleRecords.push({
        id: `${cleanOid}_${cleanAwb}`,
        orderId: displayOid,
        cleanOrderId: cleanOid,
        orderDate: item.orderDate || item.order_date,
        customerName: item.customerName || item.customer_name,
        phone: item.phone,
        city: item.city,
        state: item.state,
        paymentMode: item.paymentMode || item.payment_mode,
        orderValue: Number(item.amount || item.orderValue || item.order_value || item.price || 0),
        dispatchStatus: item.dispatchStatus || item.dispatch_status,
        awbNumber: rawAwb,
        cleanAwb,
        courier: 'ST Courier',
        productDescription: item.productDescription || item.product_description,
        quantity: item.quantity || 1,
        currentSalesStatus: item.currentSalesStatus || item.dispatchStatus || item.dispatch_status,
        currentDeliveredDate: item.currentDeliveredDate || item.deliveredDate || item.delivered_date,
        category: 'READY',
        selected: true,
        trackingState: 'PENDING',
        retryCount: 0
      });
    }

    if (eligibleRecords.length === 0) {
      return null;
    }

    // Stop existing engine if any
    if (this.activeEngine) {
      this.activeEngine.cancel();
    }

    const engine = new StCourierBotEngine(eligibleRecords, (state) => {
      this.notify(state);
    });

    this.activeEngine = engine;
    this.notify(engine.getSnapshot());

    // Run in background (non-blocking)
    engine.start().then(() => {
      const snap = engine.getSnapshot();
      this.notify(snap);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velmora:st_tracking_completed', { detail: snap }));
      }
    });

    return engine.getSnapshot();
  }

  public pause(): void {
    this.activeEngine?.pause();
  }

  public resume(): void {
    this.activeEngine?.resume();
  }

  public cancel(): void {
    this.activeEngine?.cancel();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_JOB_KEY);
    }
    this.currentState = null;
    this.notify({
      jobId: '',
      status: 'CANCELLED',
      records: [],
      totalToTrack: 0,
      processedCount: 0,
      trackedCount: 0,
      failedCount: 0,
      notFoundCount: 0,
      needsReviewCount: 0,
      newDeliveredCount: 0,
      newRtoCount: 0,
      unchangedCount: 0
    });
  }

  public retryFailed(): Promise<void> | undefined {
    return this.activeEngine?.retryFailed();
  }

  /**
   * Synchronize existing ST Courier shipments from Supabase / workspace
   * Queries customer_tracking_shipments & sales_orders for ST Courier AWBs and tracks them.
   */
  public async syncExistingShipments(existingOrders?: any[]): Promise<StCourierBotJobState | null> {
    let candidateItems: any[] = [];
    if (existingOrders && existingOrders.length > 0) {
      candidateItems = existingOrders;
    } else {
      try {
        const { data: shipments } = await supabase
          .from('customer_tracking_shipments')
          .select('*')
          .ilike('courier', '%ST%');

        if (shipments && shipments.length > 0) {
          candidateItems = shipments.map(s => ({
            orderId: s.order_id,
            awbNumber: s.awb_number,
            courier: s.courier || 'ST Courier',
            customerName: s.customer_name,
            currentSalesStatus: s.status,
            deliveredDate: s.delivered_date,
            amount: s.amount,
            paymentMode: s.order_type,
            orderDate: s.dispatch_date
          }));
        }
      } catch (err) {
        console.warn('Failed to query existing ST Courier shipments for sync:', err);
      }
    }

    return this.enqueueAndStart(candidateItems);
  }

  public clear(): void {
    this.cancel();
  }
}

export const stCourierBotQueue = new StCourierBotQueueManager();
