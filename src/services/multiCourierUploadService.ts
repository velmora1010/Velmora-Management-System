import * as XLSX from 'xlsx';
import db from '../lib/db';
import { supabase } from '../lib/supabase';
import type { LogisticsOrder } from '../types/logistics';
import { normalizeCourier, isCourierActive } from '../config/courierConfig';
import { cleanOrderId } from './unifiedLogisticsService';
import { normalizeTrackingStatus, normalizeAwb } from './courierTrackingFileService';
import { parseAndFormatLogisticsDate } from '../utils/logisticsDateUtils';

export type CourierUploadType = 'st_courier' | 'amazon_shipping' | 'india_post' | 'delhivery' | 'generic';

export type MatchClassification =
  | 'MATCHED_EXISTING'
  | 'MATCHED_NEW_AWB'
  | 'MATCHED_AWB_UPDATE'
  | 'UNMATCHED_ORDER'
  | 'DUPLICATE_IN_FILE'
  | 'CANCELLED_PRE_FULFILLMENT'
  | 'NEEDS_REVIEW'
  | 'INVALID_ROW';

export interface MultiCourierPreviewItem {
  rowNumber: number;
  orderId: string;
  cleanOrderId: string;
  awbNumber: string;
  courier: string;
  originalCourierCompany?: string;
  customerName?: string;
  phone?: string;
  city?: string;
  state?: string;
  paymentMode?: string;
  orderTotal?: number;
  products?: string;
  totalQuantity?: number;
  rawStatus?: string;
  statusType?: string;
  remarks?: string;
  normalizedStatus: string;
  orderDate?: string;
  dispatchDate?: string;
  deliveredDate?: string;
  estimatedDeliveryDate?: string;
  rtoInitiatedDate?: string;
  rtoDeliveredDate?: string;
  rtoReason?: string;
  classification: MatchClassification;
  isMatched: boolean;
  matchReason: string;
  isDuplicateAwb?: boolean;
  isConflict?: boolean;
  conflictReason?: string;
  isNeedsReview?: boolean;
  existingOrder?: {
    id?: number;
    orderId: string;
    existingAwb?: string;
    existingCourier?: string;
    existingStatus?: string;
    isCancelled?: boolean;
  };
}

export interface MultiCourierAnalysisResult {
  courierType: CourierUploadType;
  courierDisplayName: string;
  fileName: string;
  totalRows: number;
  uniqueOrdersCount: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateAwbCount: number;
  invalidRowsCount: number;
  cancelledCount: number;
  newAwbAssignmentsCount: number;
  existingAwbUpdatesCount: number;
  deliveredCount: number;
  rtoCount: number;
  inTransitCount: number;
  unDeliveredCount: number;
  needsReviewCount: number;
  detectedHeaders: string[];
  carrierBreakdown: Record<string, number>;
  previewItems: MultiCourierPreviewItem[];
  unmatchedItems: MultiCourierPreviewItem[];
}

export interface MultiCourierImportResult {
  success: boolean;
  totalProcessed: number;
  updatedShipmentsCount: number;
  salesOrdersUpdatedCount: number;
  unmatchedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Normalizes header keys for case-insensitive and punctuation-free matching.
 */
function normalizeKey(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Safely parse diverse date representations:
 * Handles DD-MM-YYYY HH:mm:ss, DD/MM/YYYY, YYYY-MM-DD, Excel serial numbers.
 */
export function parseDateFlexible(raw?: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'NULL' || str === '-') return '';

  // Excel serial date numbers
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    try {
      const serial = parseFloat(str);
      const parsedDate = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().slice(0, 10);
      }
    } catch {
      // fallback
    }
  }

  // DD-MM-YYYY or DD-MM-YYYY HH:mm:ss
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = parseAndFormatLogisticsDate(str);
  return parsed.isoDate || parsed.displayDate || str;
}

/**
 * Detects headers dynamically using flexible priority candidates.
 */
function findColumnIndex(headers: string[], candidates: string[]): number {
  const normHeaders = headers.map(normalizeKey);
  const normCandidates = candidates.map(normalizeKey);

  // Exact matches first
  for (const cand of normCandidates) {
    const idx = normHeaders.indexOf(cand);
    if (idx !== -1) return idx;
  }

  // Substring matches: header must contain candidate
  for (const cand of normCandidates) {
    const idx = normHeaders.findIndex(h => cand.length >= 4 && h.includes(cand));
    if (idx !== -1) return idx;
  }

  return -1;
}

export interface StCourierStatusResult {
  status: string;
  isConflict: boolean;
  conflictReason?: string;
  isNeedsReview: boolean;
}

/**
 * Explicit ST Courier status normalization handling exact variations:
 * Delivered -> Delivered
 * Un Delivered -> Un Delivered
 * Return to Origin / Return To Orgin -> RTO
 * Cancelled / Canceled -> Cancelled
 */
export function normalizeStCourierStatus(
  statusType?: string | null,
  currentStatus?: string | null,
  deliveredDate?: string | null,
  rtoDeliveredDate?: string | null,
  remarks?: string | null
): StCourierStatusResult {
  const st = (statusType || '').trim();
  const cs = (currentStatus || '').trim();
  const rem = (remarks || '').trim();

  const normSt = st.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normCs = cs.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normRem = rem.toLowerCase().replace(/[^a-z0-9]/g, '');

  const isStCancelled = normSt === 'cancelled' || normSt === 'canceled';
  const isCsCancelled = normCs === 'cancelled' || normCs === 'canceled';

  // 1. Cancellation check (if either Status Type or Current Status indicates cancelled)
  if (isStCancelled || isCsCancelled) {
    return {
      status: 'Cancelled',
      isConflict: false,
      isNeedsReview: false
    };
  }

  // 2. RTO check (Return to Origin, Return To Orgin, etc.)
  const isCsRto = normCs.includes('returntoorigin') || normCs.includes('returntoorgin') || normCs.includes('rto');
  const isStRto = normSt.includes('returntoorigin') || normSt.includes('returntoorgin') || normSt.includes('rto');
  const isRemRto = normRem.includes('returntoorigin') || normRem.includes('returntoorgin') || normRem.includes('rto');

  if (isCsRto || isStRto || isRemRto) {
    if (rtoDeliveredDate && rtoDeliveredDate !== 'N/A') {
      return {
        status: 'RTO Delivered to Seller',
        isConflict: false,
        isNeedsReview: false
      };
    }
    return {
      status: 'RTO - In Transit',
      isConflict: false,
      isNeedsReview: false
    };
  }

  // 3. Delivered check
  const isStDelivered = normSt === 'delivered';
  const isCsDelivered = normCs === 'delivered';
  const hasDeliveredDate = Boolean(deliveredDate && deliveredDate !== 'N/A' && deliveredDate !== '-');

  if (isStDelivered && isCsDelivered) {
    return {
      status: 'Delivered',
      isConflict: false,
      isNeedsReview: false
    };
  }

  // Conflict case: Status Type is Un Delivered, but Current Status is Delivered
  if (normSt === 'undelivered' && isCsDelivered) {
    return {
      status: 'Delivered',
      isConflict: true,
      conflictReason: `Status Type is 'Un Delivered' but Current Status is 'Delivered'${hasDeliveredDate ? ` (Delivered Date: ${deliveredDate})` : ''}`,
      isNeedsReview: true
    };
  }

  // Conflict case: Status Type is Delivered, but Current Status is Un Delivered
  if (isStDelivered && normCs === 'undelivered') {
    return {
      status: hasDeliveredDate ? 'Delivered' : 'Un Delivered',
      isConflict: true,
      conflictReason: `Status Type is 'Delivered' but Current Status is 'Un Delivered'`,
      isNeedsReview: true
    };
  }

  // 4. Undelivered / In transit
  if (normSt === 'undelivered' || normCs === 'undelivered') {
    return {
      status: 'Un Delivered',
      isConflict: false,
      isNeedsReview: false
    };
  }

  if (isCsDelivered || (isStDelivered && hasDeliveredDate)) {
    return {
      status: 'Delivered',
      isConflict: false,
      isNeedsReview: false
    };
  }

  // Fallback: Needs Review if unrecognized
  return {
    status: cs || st || 'Needs Review',
    isConflict: true,
    conflictReason: `Unrecognized status combination: Status Type='${st}', Current Status='${cs}'`,
    isNeedsReview: true
  };
}

/**
 * Parses raw spreadsheet/CSV lines into structured order groups.
 * Specifically handles Amazon multi-line continuation rows where subsequent product rows
 * omit customer or order-level information.
 */
export async function parseAndValidateCourierFile(
  rawRows: any[][],
  courierType: CourierUploadType,
  fileName: string = 'courier_report.csv'
): Promise<MultiCourierAnalysisResult> {
  if (!rawRows || rawRows.length === 0) {
    return {
      courierType,
      courierDisplayName: getCourierDisplayName(courierType),
      fileName,
      totalRows: 0,
      uniqueOrdersCount: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      duplicateAwbCount: 0,
      invalidRowsCount: 0,
      cancelledCount: 0,
      newAwbAssignmentsCount: 0,
      existingAwbUpdatesCount: 0,
      deliveredCount: 0,
      rtoCount: 0,
      inTransitCount: 0,
      detectedHeaders: [],
      carrierBreakdown: {},
      previewItems: [],
      unmatchedItems: []
    };
  }

  const rawHeaders = rawRows[0].map(h => String(h || '').replace(/^\ufeff/, '').trim());
  const dataRows = rawRows.slice(1);

  // Load existing orders from Dexie & Supabase for authoritative reconciliation
  let existingDexieOrders: LogisticsOrder[] = [];
  try {
    if (typeof indexedDB !== 'undefined') {
      existingDexieOrders = await db.logistics_orders.toArray();
    }
  } catch (dexieErr) {
    console.warn('Dexie logistics orders fallback (non-browser or IDB disabled):', dexieErr);
  }
  const dexieByCleanId = new Map<string, LogisticsOrder>();
  const dexieByAwb = new Map<string, LogisticsOrder>();

  existingDexieOrders.forEach(ord => {
    if (ord.orderId) {
      const clean = cleanOrderId(ord.orderId).toLowerCase();
      if (clean) dexieByCleanId.set(clean, ord);
    }
    if (ord.awbNumber && ord.awbNumber.trim()) {
      const normA = normalizeAwb(ord.awbNumber).toLowerCase();
      if (normA) dexieByAwb.set(normA, ord);
    }
  });

  // Also query Supabase sales_orders for cancellation & financial baseline
  const { data: salesOrderRecords } = await supabase
    .from('sales_orders')
    .select('id, order_id, customer_name, order_date, order_total, payment_mode, dispatch_status, order_status, extra_data')
    .limit(5000);

  const salesByCleanId = new Map<string, any>();
  (salesOrderRecords || []).forEach(so => {
    const clean = cleanOrderId(so.order_id).toLowerCase();
    if (clean) salesByCleanId.set(clean, so);
  });

  // Detect Column Indices - supporting ST Courier, Delhivery, Amazon Shipping, India Post, Ekart
  const orderIdIdx = findColumnIndex(rawHeaders, [
    'order', 'order#', 'orderid', 'order_id', 'ordernumber', 'order_number', 'orderno', 'order_no',
    'name', // Shopify standard header
    'orderreference', 'order_reference',
    'referenceno', 'referencenumber', 'reference_no', 'reference', 'refno', 'ref_no',
    'invoiceno', 'customerno'
  ]);

  const awbIdx = findColumnIndex(rawHeaders, [
    'trackingnumber', 'tracking_number', 'trackingno', 'tracking_no',
    'awbno', 'awb_no', 'awbnumber', 'awb_number', 'awb',
    'waybill', 'waybillno', 'waybillnumber',
    'consignmentno', 'consignmentnumber', 'consignment_no',
    'docketno', 'podno', 'articleno', 'articlenumber'
  ]);

  const courierCompanyIdx = findColumnIndex(rawHeaders, [
    'carrier', 'couriercompany', 'courier_company', 'couriername', 'courier_name', 'courier',
    'lastmilecarrier', 'serviceprovider', 'shippingcompany'
  ]);

  const orderStatusIdx = findColumnIndex(rawHeaders, [
    'currentstatus', 'current_status', 'orderstatus', 'order_status', 'shipmentstatus',
    'deliverystatus', 'status'
  ]);

  const statusTypeIdx = findColumnIndex(rawHeaders, [
    'statustype', 'status_type', 'type_status', 'substatus', 'sub_status'
  ]);

  const dispatchStatusIdx = findColumnIndex(rawHeaders, [
    'dispatchstatus', 'dispatch_status', 'fulfillmentstatus', 'fulfillment_status'
  ]);

  const remarksIdx = findColumnIndex(rawHeaders, [
    'lastevent', 'last_event', 'latestevent', 'latest_event',
    'remarks', 'lastscan', 'instructions', 'scandetails',
    'rtoreason', 'rto_reason', 'ndrremarks', 'exceptionreason', 'reason', 'event'
  ]);

  const customerNameIdx = findColumnIndex(rawHeaders, [
    'customername', 'customer_name', 'consigneename', 'consignee_name', 'buyername', 'client', 'name'
  ]);

  const phoneIdx = findColumnIndex(rawHeaders, [
    'customermobileno', 'customer_mobile_no', 'phone', 'phonenumber', 'mobile', 'customeralternateno'
  ]);

  const cityIdx = findColumnIndex(rawHeaders, [
    'customercity', 'customer_city', 'city', 'destination'
  ]);

  const stateIdx = findColumnIndex(rawHeaders, [
    'customerstate', 'customer_state', 'state', 'province'
  ]);

  const orderTotalIdx = findColumnIndex(rawHeaders, [
    'ordertotal', 'order_total', 'ordervalueinr', 'ordervalue', 'order_value', 'amount', 'invoicevalue', 'value'
  ]);

  const paymentMethodIdx = findColumnIndex(rawHeaders, [
    'paymentmethod', 'payment_method', 'paymentmode', 'payment_mode', 'type'
  ]);

  const productNameIdx = findColumnIndex(rawHeaders, [
    'productname', 'product_name', 'productdescription', 'product_description', 'itemname', 'sku'
  ]);

  const productQtyIdx = findColumnIndex(rawHeaders, [
    'productquantity', 'product_quantity', 'quantity', 'qty'
  ]);

  const orderDateIdx = findColumnIndex(rawHeaders, [
    'orderdate', 'order_date', 'bookingdate', 'booking_date', 'date'
  ]);

  const pickupDateIdx = findColumnIndex(rawHeaders, [
    'orderpickupdate', 'order_pickup_date', 'pickupdate', 'pickup_date', 'dispatchdate', 'dispatch_date'
  ]);

  const deliveredDateIdx = findColumnIndex(rawHeaders, [
    'orderdelivereddate', 'order_delivered_date', 'delivereddate', 'delivered_date', 'actualdeliverydate', 'deliverydate',
    'deliveredon', 'delivered_on'
  ]);

  const rtoInitiatedIdx = findColumnIndex(rawHeaders, [
    'rtoinitiateddate', 'rto_initiated_date', 'rtodate', 'rto_date'
  ]);

  const rtoDeliveredIdx = findColumnIndex(rawHeaders, [
    'rtodelivereddate', 'rto_delivered_date'
  ]);

  const eddIdx = findColumnIndex(rawHeaders, [
    'edd', 'estimateddeliverydate', 'estimated_delivery_date', 'expecteddeliverydate'
  ]);

  const rtoReasonIdx = findColumnIndex(rawHeaders, [
    'rtoreason', 'rto_reason'
  ]);

  // Aggregate continuation rows (Amazon Shipping multi-line products)
  interface RawOrderGroup {
    mainRowIndex: number;
    rawOrderId: string;
    cleanOid: string;
    rawAwb: string;
    courierCompany: string;
    customerName: string;
    phone: string;
    city: string;
    state: string;
    paymentMode: string;
    orderTotal: number;
    rawStatus: string;
    statusType: string;
    remarks: string;
    orderDate: string;
    pickupDate: string;
    deliveredDate: string;
    rtoInitiatedDate: string;
    rtoDeliveredDate: string;
    edd: string;
    rtoReason: string;
    products: Array<{ name: string; qty: number }>;
  }

  const orderGroups: RawOrderGroup[] = [];
  let currentGroup: RawOrderGroup | null = null;
  let invalidRowsCount = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const rawOrderIdVal = orderIdIdx !== -1 ? String(row[orderIdIdx] || '').trim() : '';
    const rawAwbVal = awbIdx !== -1 ? normalizeAwb(row[awbIdx]) : '';
    const cleanOidVal = cleanOrderId(rawOrderIdVal);

    // Check if this row is a continuation row of previous order
    const isContinuationRow = currentGroup && (
      (!cleanOidVal && !rawAwbVal) || 
      (cleanOidVal && cleanOidVal.toLowerCase() === currentGroup.cleanOid.toLowerCase() && !rawAwbVal)
    );

    if (isContinuationRow) {
      // Append product info to current group
      const pName = productNameIdx !== -1 ? String(row[productNameIdx] || '').trim() : '';
      const pQty = productQtyIdx !== -1 ? Number(row[productQtyIdx]) || 1 : 1;
      if (pName) {
        currentGroup.products.push({ name: pName, qty: pQty });
      }
      continue;
    }

    if (!cleanOidVal && !rawAwbVal) {
      invalidRowsCount++;
      continue;
    }

    const pName = productNameIdx !== -1 ? String(row[productNameIdx] || '').trim() : '';
    const pQty = productQtyIdx !== -1 ? Number(row[productQtyIdx]) || 1 : 1;
    const initialProducts: Array<{ name: string; qty: number }> = [];
    if (pName) {
      initialProducts.push({ name: pName, qty: pQty });
    }

    const rawTotalStr = orderTotalIdx !== -1 ? String(row[orderTotalIdx] || '').replace(/[^0-9.-]+/g, '') : '';
    const orderTotal = rawTotalStr ? parseFloat(rawTotalStr) || 0 : 0;

    const rawCourierCompany = courierCompanyIdx !== -1 ? String(row[courierCompanyIdx] || '').trim() : '';

    currentGroup = {
      mainRowIndex: idx + 2, // 1-indexed Excel row
      rawOrderId: rawOrderIdVal,
      cleanOid: cleanOidVal,
      rawAwb: rawAwbVal,
      courierCompany: rawCourierCompany,
      customerName: customerNameIdx !== -1 ? String(row[customerNameIdx] || '').trim() : '',
      phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
      city: cityIdx !== -1 ? String(row[cityIdx] || '').trim() : '',
      state: stateIdx !== -1 ? String(row[stateIdx] || '').trim() : '',
      paymentMode: paymentMethodIdx !== -1 ? String(row[paymentMethodIdx] || '').trim() : '',
      orderTotal,
      rawStatus: orderStatusIdx !== -1 ? String(row[orderStatusIdx] || '').trim() : '',
      statusType: statusTypeIdx !== -1 ? String(row[statusTypeIdx] || '').trim() : '',
      remarks: remarksIdx !== -1 ? String(row[remarksIdx] || '').trim() : '',
      orderDate: orderDateIdx !== -1 ? parseDateFlexible(row[orderDateIdx]) : '',
      pickupDate: pickupDateIdx !== -1 ? parseDateFlexible(row[pickupDateIdx]) : '',
      deliveredDate: deliveredDateIdx !== -1 ? parseDateFlexible(row[deliveredDateIdx]) : '',
      rtoInitiatedDate: rtoInitiatedIdx !== -1 ? parseDateFlexible(row[rtoInitiatedIdx]) : '',
      rtoDeliveredDate: rtoDeliveredIdx !== -1 ? parseDateFlexible(row[rtoDeliveredIdx]) : '',
      edd: eddIdx !== -1 ? parseDateFlexible(row[eddIdx]) : '',
      rtoReason: rtoReasonIdx !== -1 ? String(row[rtoReasonIdx] || '').trim() : '',
      products: initialProducts
    };

    orderGroups.push(currentGroup);
  }

  // Targeted query for all order IDs present in the uploaded file against Supabase
  const distinctFileOids = Array.from(new Set(orderGroups.map(g => g.cleanOid).filter(Boolean)));
  const missingFromMap = distinctFileOids.filter(oid => !salesByCleanId.has(oid.toLowerCase()));

  if (missingFromMap.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < missingFromMap.length; i += chunkSize) {
      const chunk = missingFromMap.slice(i, i + chunkSize);
      const idVariants = Array.from(new Set([...chunk, ...chunk.map(c => `#${c}`)]));
      const { data: chunkOrders } = await supabase
        .from('sales_orders')
        .select('id, order_id, customer_name, order_date, order_total, payment_mode, dispatch_status, order_status, extra_data')
        .in('order_id', idVariants);

      (chunkOrders || []).forEach(so => {
        const clean = cleanOrderId(so.order_id).toLowerCase();
        if (clean) salesByCleanId.set(clean, so);
      });
    }
  }

  // Also query customer_tracking_shipments by AWB to match existing tracking records
  const distinctFileAwbs = Array.from(new Set(orderGroups.map(g => g.rawAwb).filter(Boolean)));
  const trackingByAwb = new Map<string, any>();
  if (distinctFileAwbs.length > 0) {
    const awbChunkSize = 200;
    for (let i = 0; i < distinctFileAwbs.length; i += awbChunkSize) {
      const chunk = distinctFileAwbs.slice(i, i + awbChunkSize);
      const { data: trackingRows } = await supabase
        .from('customer_tracking_shipments')
        .select('*')
        .in('awb_number', chunk);
      (trackingRows || []).forEach(tr => {
        if (tr.awb_number) trackingByAwb.set(tr.awb_number.toLowerCase(), tr);
      });
    }
  }

  // Preview & Reconciliation against existing database records
  const previewItems: MultiCourierPreviewItem[] = [];
  const unmatchedItems: MultiCourierPreviewItem[] = [];
  const seenAwbsInFile = new Set<string>();

  // Track AWB frequencies across file to identify duplicate AWBs
  const awbFrequencyMap = new Map<string, number>();
  for (const grp of orderGroups) {
    if (grp.rawAwb) {
      const norm = grp.rawAwb.toLowerCase();
      awbFrequencyMap.set(norm, (awbFrequencyMap.get(norm) || 0) + 1);
    }
  }

  let matchedCount = 0;
  let unmatchedCount = 0;
  let duplicateAwbCount = 0;
  let cancelledCount = 0;
  let newAwbAssignmentsCount = 0;
  let existingAwbUpdatesCount = 0;
  let deliveredCount = 0;
  let rtoCount = 0;
  let inTransitCount = 0;
  let unDeliveredCount = 0;
  let needsReviewCount = 0;

  const carrierBreakdown: Record<string, number> = {};

  for (const grp of orderGroups) {
    const rawAwb = grp.rawAwb;
    const cleanOid = grp.cleanOid;
    const isDuplicateAwb = Boolean(rawAwb && (awbFrequencyMap.get(rawAwb.toLowerCase()) || 0) > 1);

    // Check duplicate AWB in this file
    if (rawAwb) {
      const lowerA = rawAwb.toLowerCase();
      if (seenAwbsInFile.has(lowerA)) {
        duplicateAwbCount++;
      } else {
        seenAwbsInFile.add(lowerA);
      }
    }

    // Determine normalized carrier
    let resolvedCourier = 'Delhivery';
    if (courierType === 'st_courier') {
      resolvedCourier = 'ST Courier';
    } else if (courierType === 'india_post') {
      resolvedCourier = 'India Post';
    } else if (courierType === 'amazon_shipping') {
      const cc = (grp.courierCompany || '').toLowerCase();
      if (cc.includes('ekart')) {
        resolvedCourier = 'Ekart';
      } else {
        resolvedCourier = 'Amazon Shipping';
      }
    } else if (grp.courierCompany) {
      resolvedCourier = normalizeCourier(grp.courierCompany) || 'Delhivery';
    }

    carrierBreakdown[resolvedCourier] = (carrierBreakdown[resolvedCourier] || 0) + 1;

    // Status Determination with explicit ST Courier precedence rules
    let finalNormalizedStatus = 'In Transit';
    let isConflict = false;
    let conflictReason: string | undefined;
    let isNeedsReview = false;

    if (courierType === 'st_courier') {
      const stRes = normalizeStCourierStatus(
        grp.statusType,
        grp.rawStatus,
        grp.deliveredDate,
        grp.rtoDeliveredDate,
        grp.remarks
      );
      finalNormalizedStatus = stRes.status;
      isConflict = stRes.isConflict;
      conflictReason = stRes.conflictReason;
      isNeedsReview = stRes.isNeedsReview;

      if (finalNormalizedStatus === 'Delivered') {
        deliveredCount++;
      } else if (finalNormalizedStatus.includes('RTO')) {
        rtoCount++;
      } else if (finalNormalizedStatus === 'Cancelled') {
        cancelledCount++;
      } else if (finalNormalizedStatus === 'Un Delivered') {
        unDeliveredCount++;
      } else {
        inTransitCount++;
      }
      if (isNeedsReview) {
        needsReviewCount++;
      }
    } else {
      const isRtoValid = (grp.rtoInitiatedDate && grp.rtoInitiatedDate !== 'N/A') || 
                         (grp.rtoReason && grp.rtoReason !== 'N/A') ||
                         grp.rawStatus.toLowerCase().includes('rto');
      const isDeliveredValid = (grp.deliveredDate && grp.deliveredDate !== 'N/A') || 
                               grp.rawStatus.toLowerCase() === 'delivered';

      if (grp.rtoDeliveredDate && grp.rtoDeliveredDate !== 'N/A') {
        finalNormalizedStatus = 'RTO Delivered to Seller';
        rtoCount++;
      } else if (isRtoValid) {
        finalNormalizedStatus = 'RTO - In Transit';
        rtoCount++;
      } else if (isDeliveredValid) {
        finalNormalizedStatus = 'Delivered';
        deliveredCount++;
      } else {
        finalNormalizedStatus = normalizeTrackingStatus(grp.rawStatus, grp.remarks, grp.statusType);
        if (finalNormalizedStatus === 'Delivered') {
          deliveredCount++;
        } else if (finalNormalizedStatus.includes('RTO')) {
          rtoCount++;
        } else if (finalNormalizedStatus === 'Cancelled') {
          cancelledCount++;
        } else if (finalNormalizedStatus === 'Un Delivered') {
          unDeliveredCount++;
        } else {
          inTransitCount++;
        }
      }
    }

    // Matching Priority:
    // 1. Exact AWB match
    let matchedDexie: LogisticsOrder | undefined;
    let matchedSales: any | undefined;
    let matchedTracking: any | undefined;

    if (rawAwb) {
      matchedDexie = dexieByAwb.get(rawAwb.toLowerCase());
      matchedTracking = trackingByAwb.get(rawAwb.toLowerCase());
    }

    // 2. Exact Order ID match
    if (!matchedDexie && cleanOid) {
      matchedDexie = dexieByCleanId.get(cleanOid.toLowerCase());
    }

    if (cleanOid) {
      matchedSales = salesByCleanId.get(cleanOid.toLowerCase());
    }

    if (!matchedSales && matchedTracking?.order_id) {
      const trOid = cleanOrderId(matchedTracking.order_id).toLowerCase();
      matchedSales = salesByCleanId.get(trOid);
    }

    const isMatched = Boolean(matchedDexie || matchedSales || matchedTracking);

    const isCancelledInSystem = matchedSales?.order_status === 'CANCELLED' || 
                                matchedSales?.dispatch_status === 'CANCELLED' ||
                                Boolean(matchedSales?.extra_data?.cancellation);

    const productsSummary = grp.products.length > 0
      ? grp.products.map(p => `${p.name} (${p.qty})`).join(' | ')
      : '';
    const totalQty = grp.products.reduce((acc, p) => acc + p.qty, 0) || 1;

    // Harmonize cancellation: if system is cancelled or courier report is cancelled
    if (isCancelledInSystem && finalNormalizedStatus !== 'Cancelled') {
      if (finalNormalizedStatus === 'Delivered') deliveredCount = Math.max(0, deliveredCount - 1);
      else if (finalNormalizedStatus.includes('RTO')) rtoCount = Math.max(0, rtoCount - 1);
      else if (finalNormalizedStatus === 'Un Delivered') unDeliveredCount = Math.max(0, unDeliveredCount - 1);
      else inTransitCount = Math.max(0, inTransitCount - 1);

      finalNormalizedStatus = 'Cancelled';
      cancelledCount++;
    }

    if (finalNormalizedStatus === 'Cancelled') {
      if (isMatched) {
        matchedCount++;
        const existingAwb = normalizeAwb(matchedDexie?.awbNumber || matchedSales?.extra_data?.awb_number || matchedTracking?.awb_number || '');
        const existingCourier = normalizeCourier(matchedDexie?.courier || matchedSales?.extra_data?.courier || matchedTracking?.courier) || '';

        previewItems.push({
          rowNumber: grp.mainRowIndex,
          orderId: grp.rawOrderId || (cleanOid ? `#${cleanOid}` : 'N/A'),
          cleanOrderId: cleanOid,
          awbNumber: rawAwb || existingAwb,
          courier: resolvedCourier,
          originalCourierCompany: grp.courierCompany,
          customerName: grp.customerName || matchedSales?.customer_name,
          phone: grp.phone || matchedSales?.phone,
          city: grp.city || matchedSales?.city,
          state: grp.state || matchedSales?.state,
          paymentMode: grp.paymentMode || matchedSales?.payment_mode,
          orderTotal: grp.orderTotal || matchedSales?.order_total,
          products: productsSummary,
          totalQuantity: totalQty,
          rawStatus: grp.rawStatus,
          statusType: grp.statusType,
          remarks: grp.remarks,
          normalizedStatus: 'Cancelled',
          orderDate: grp.orderDate || matchedSales?.order_date,
          dispatchDate: grp.pickupDate || matchedSales?.dispatch_date,
          deliveredDate: grp.deliveredDate,
          estimatedDeliveryDate: grp.edd,
          classification: 'CANCELLED_PRE_FULFILLMENT',
          isMatched: true,
          matchReason: isCancelledInSystem 
            ? `Order #${cleanOid} was cancelled pre-fulfillment. Status preserved as Cancelled.`
            : `Order #${cleanOid} cancelled in courier manifest.`,
          isDuplicateAwb,
          isConflict,
          conflictReason,
          isNeedsReview,
          existingOrder: {
            id: matchedDexie?.id,
            orderId: cleanOid,
            existingAwb,
            existingCourier,
            existingStatus: 'Cancelled',
            isCancelled: true
          }
        });
      } else {
        unmatchedCount++;
        const reason = cleanOid 
          ? `Cancelled Order #${cleanOid} does not exist in Shopify/Sales orders.` 
          : `Cancelled row without matching order ID.`;

        const unItem: MultiCourierPreviewItem = {
          rowNumber: grp.mainRowIndex,
          orderId: grp.rawOrderId || (cleanOid ? `#${cleanOid}` : 'N/A'),
          cleanOrderId: cleanOid,
          awbNumber: rawAwb,
          courier: resolvedCourier,
          originalCourierCompany: grp.courierCompany,
          customerName: grp.customerName,
          phone: grp.phone,
          city: grp.city,
          state: grp.state,
          paymentMode: grp.paymentMode,
          orderTotal: grp.orderTotal,
          products: productsSummary,
          totalQuantity: totalQty,
          rawStatus: grp.rawStatus,
          statusType: grp.statusType,
          remarks: grp.remarks || grp.rtoReason,
          normalizedStatus: 'Cancelled',
          orderDate: grp.orderDate,
          dispatchDate: grp.pickupDate,
          deliveredDate: grp.deliveredDate,
          estimatedDeliveryDate: grp.edd,
          classification: 'UNMATCHED_ORDER',
          isMatched: false,
          matchReason: reason,
          isDuplicateAwb,
          isConflict,
          conflictReason,
          isNeedsReview
        };

        previewItems.push(unItem);
        unmatchedItems.push(unItem);
      }
      continue;
    }

    if (isMatched) {
      matchedCount++;
      const existingAwb = normalizeAwb(matchedDexie?.awbNumber || matchedSales?.extra_data?.awb_number || matchedTracking?.awb_number || '');
      const existingCourier = normalizeCourier(matchedDexie?.courier || matchedSales?.extra_data?.courier || matchedTracking?.courier) || '';
      const existingStatus = matchedDexie?.status || matchedSales?.dispatch_status || matchedTracking?.status || 'Pending';

      let classification: MatchClassification = 'MATCHED_EXISTING';
      let matchReason = '';

      if (isNeedsReview || isConflict) {
        classification = 'NEEDS_REVIEW';
        matchReason = conflictReason || `Status discrepancy flagged for review: ${finalNormalizedStatus}`;
      } else if (!existingAwb && rawAwb) {
        classification = 'MATCHED_NEW_AWB';
        matchReason = `Assigned verified AWB ${rawAwb} (${resolvedCourier}) to Order #${cleanOid}.`;
        newAwbAssignmentsCount++;
      } else if (existingAwb && rawAwb && existingAwb.toLowerCase() !== rawAwb.toLowerCase()) {
        classification = 'MATCHED_AWB_UPDATE';
        matchReason = `Updated previous AWB ${existingAwb} to verified AWB ${rawAwb} (${resolvedCourier}).`;
        existingAwbUpdatesCount++;
      } else {
        classification = 'MATCHED_EXISTING';
        matchReason = `Matched Order #${cleanOid || matchedDexie?.orderId}. Synchronizing latest tracking updates.`;
        existingAwbUpdatesCount++;
      }

      previewItems.push({
        rowNumber: grp.mainRowIndex,
        orderId: grp.rawOrderId || (cleanOid ? `#${cleanOid}` : `#${matchedDexie?.orderId}`),
        cleanOrderId: cleanOid || matchedDexie?.orderId || '',
        awbNumber: rawAwb || existingAwb,
        courier: resolvedCourier,
        originalCourierCompany: grp.courierCompany,
        customerName: grp.customerName || matchedDexie?.customerName || matchedSales?.customer_name,
        phone: grp.phone || matchedDexie?.phone || matchedSales?.phone,
        city: grp.city || matchedDexie?.city || matchedSales?.city,
        state: grp.state || matchedDexie?.state || matchedSales?.state,
        paymentMode: grp.paymentMode || matchedDexie?.orderType || matchedSales?.payment_mode,
        orderTotal: grp.orderTotal || Number(matchedDexie?.amount) || Number(matchedSales?.order_total),
        products: productsSummary,
        totalQuantity: totalQty,
        rawStatus: grp.rawStatus,
        statusType: grp.statusType,
        remarks: grp.remarks || grp.rtoReason,
        normalizedStatus: finalNormalizedStatus,
        orderDate: grp.orderDate || matchedDexie?.orderDate || matchedSales?.order_date,
        dispatchDate: grp.pickupDate || matchedDexie?.dispatchDate || matchedSales?.dispatch_date,
        deliveredDate: grp.deliveredDate || matchedDexie?.deliveredDate || (finalNormalizedStatus === 'Delivered' ? (matchedSales?.extra_data?.delivered_date || grp.orderDate || matchedSales?.dispatch_date) : undefined),
        estimatedDeliveryDate: grp.edd || matchedDexie?.estimatedDeliveryDate,
        rtoInitiatedDate: grp.rtoInitiatedDate,
        rtoDeliveredDate: grp.rtoDeliveredDate,
        rtoReason: grp.rtoReason,
        classification,
        isMatched: true,
        matchReason,
        isDuplicateAwb,
        isConflict,
        conflictReason,
        isNeedsReview,
        existingOrder: {
          id: matchedDexie?.id,
          orderId: cleanOid || matchedDexie?.orderId || '',
          existingAwb,
          existingCourier,
          existingStatus,
          isCancelled: false
        }
      });
    } else {
      unmatchedCount++;
      const reason = cleanOid 
        ? `Order #${cleanOid} does not exist in Shopify/Sales orders.` 
        : `AWB ${rawAwb} does not match any existing order.`;

      const unItem: MultiCourierPreviewItem = {
        rowNumber: grp.mainRowIndex,
        orderId: grp.rawOrderId || (cleanOid ? `#${cleanOid}` : 'N/A'),
        cleanOrderId: cleanOid,
        awbNumber: rawAwb,
        courier: resolvedCourier,
        originalCourierCompany: grp.courierCompany,
        customerName: grp.customerName,
        phone: grp.phone,
        city: grp.city,
        state: grp.state,
        paymentMode: grp.paymentMode,
        orderTotal: grp.orderTotal,
        products: productsSummary,
        totalQuantity: totalQty,
        rawStatus: grp.rawStatus,
        statusType: grp.statusType,
        remarks: grp.remarks || grp.rtoReason,
        normalizedStatus: finalNormalizedStatus,
        orderDate: grp.orderDate,
        dispatchDate: grp.pickupDate,
        deliveredDate: grp.deliveredDate,
        estimatedDeliveryDate: grp.edd,
        classification: 'UNMATCHED_ORDER',
        isMatched: false,
        matchReason: reason,
        isDuplicateAwb,
        isConflict,
        conflictReason,
        isNeedsReview
      };

      previewItems.push(unItem);
      unmatchedItems.push(unItem);
    }
  }

  return {
    courierType,
    courierDisplayName: getCourierDisplayName(courierType),
    fileName,
    totalRows: dataRows.length,
    uniqueOrdersCount: orderGroups.length,
    matchedCount,
    unmatchedCount,
    duplicateAwbCount,
    invalidRowsCount,
    cancelledCount,
    newAwbAssignmentsCount,
    existingAwbUpdatesCount,
    deliveredCount,
    rtoCount,
    inTransitCount,
    unDeliveredCount,
    needsReviewCount,
    detectedHeaders: rawHeaders,
    carrierBreakdown,
    previewItems,
    unmatchedItems
  };
}

/**
 * Commits verified courier tracking updates safely and idempotently to:
 * 1. Dexie db.logistics_orders
 * 2. Supabase customer_tracking_shipments
 * 3. Supabase sales_orders
 * 4. Dexie db.tracking_logs
 */
export async function commitMultiCourierImport(
  previewItems: MultiCourierPreviewItem[],
  courierType: CourierUploadType,
  onProgress?: (progress: { current: number; total: number; phase: string }) => void
): Promise<MultiCourierImportResult> {
  const matched = previewItems.filter(it => it.isMatched);
  const errors: string[] = [];
  let updatedShipmentsCount = 0;
  let salesOrdersUpdatedCount = 0;
  const nowIso = new Date().toISOString();
  const nowLocale = new Date().toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).replace(/,/g, '').replace(/(\d{4})\s/, '$1 • ');

  const total = matched.length;

  try {
    // 1. Transactional Dexie update
    if (onProgress) {
      onProgress({ current: 0, total, phase: 'Updating local Logistics workspace...' });
    }

    if (typeof indexedDB !== 'undefined') {
      await db.transaction('rw', [db.logistics_orders, db.tracking_logs], async () => {
        for (let i = 0; i < matched.length; i++) {
          const item = matched[i];
          if (!item.cleanOrderId && !item.existingOrder?.id) continue;

          let existing: LogisticsOrder | undefined;
          if (item.existingOrder?.id) {
            existing = await db.logistics_orders.get(item.existingOrder.id);
          } else if (item.cleanOrderId) {
            existing = await db.logistics_orders
              .where('orderId')
              .equalsIgnoreCase(item.cleanOrderId)
              .first();
          }

          let finalStatus = item.normalizedStatus;
          const currentStatus = existing?.status || '';

          // Status Protection: Never downgrade Delivered or RTO Delivered
          if ((currentStatus === 'Delivered' || currentStatus === 'RTO Delivered to Seller') && 
              finalStatus !== currentStatus && !finalStatus.includes('RTO') && finalStatus !== 'Delivered') {
            finalStatus = currentStatus;
          }

          const isDelivered = finalStatus === 'Delivered';
          const isCancelled = finalStatus === 'Cancelled';

          if (existing && existing.id) {
            const payload: Partial<LogisticsOrder> = {
              awbNumber: item.awbNumber || existing.awbNumber,
              courier: item.courier || existing.courier || 'ST Courier',
              status: finalStatus,
              rawStatus: item.rawStatus || item.normalizedStatus,
              stage: isDelivered ? 'fulfilled' : (isCancelled ? 'cancelled' : (existing.stage === 'trash' ? 'tracking' : (existing.stage || 'tracking'))),
              trashReason: undefined,
              syncedAt: nowLocale
            };

            if (item.remarks) {
              payload.remarks = item.remarks;
              payload.lastEvent = item.remarks;
            }
            if (item.deliveredDate && isDelivered) {
              payload.deliveredDate = item.deliveredDate;
            }
            if (item.estimatedDeliveryDate) {
              payload.estimatedDeliveryDate = item.estimatedDeliveryDate;
            }
            if (item.dispatchDate) {
              payload.dispatchDate = item.dispatchDate;
            }

            await db.logistics_orders.update(existing.id, payload);
            updatedShipmentsCount++;
          }

          // Add audit log entry
          if (item.awbNumber) {
            await db.tracking_logs.add({
              awb: item.awbNumber,
              courier: item.courier || 'ST Courier',
              startedAt: nowIso,
              finishedAt: nowIso,
              duration: 0,
              success: true
            });
          }
        }
      });
    }

    // 2. Synchronize to Supabase customer_tracking_shipments in safe batches
    const batchSize = 100;
    for (let i = 0; i < matched.length; i += batchSize) {
      const slice = matched.slice(i, i + batchSize);
      if (onProgress) {
        onProgress({
          current: Math.min(i + batchSize, total),
          total,
          phase: `Synchronizing tracking records to Supabase (${Math.min(i + batchSize, total)}/${total})...`
        });
      }

      const rowsToUpsert = slice
        .filter(item => item.awbNumber)
        .map(item => {
          return {
            order_id: item.cleanOrderId || item.awbNumber,
            display_order_id: item.orderId || `#${item.cleanOrderId}`,
            awb_number: item.awbNumber,
            courier: item.courier || 'ST Courier',
            status: item.normalizedStatus,
            raw_status: item.rawStatus || item.normalizedStatus,
            status_source: `COURIER_REPORT_${(item.courier || 'ST_COURIER').toUpperCase().replace(/\s+/g, '_')}`,
            source_type: 'COURIER_EXPORT',
            dispatch_date: item.dispatchDate || nowIso.slice(0, 10),
            estimated_delivery_date: item.estimatedDeliveryDate || null,
            delivered_date: item.deliveredDate || null,
            remarks: item.remarks || null,
            customer_name: item.customerName || 'Customer',
            amount: item.orderTotal || 0,
            order_type: item.paymentMode || 'Prepaid',
            last_synced_at: nowIso,
            updated_at: nowIso
          };
        });

      if (rowsToUpsert.length > 0) {
        try {
          const { error: upsertErr } = await supabase
            .from('customer_tracking_shipments')
            .upsert(rowsToUpsert, { onConflict: 'courier,awb_number' });

          if (upsertErr) {
            console.error('[Supabase Error] customer_tracking_shipments upsert:', upsertErr);
            errors.push(`Shipment sync warning: ${upsertErr.message}`);
          }
        } catch (e: any) {
          console.error('[Exception] customer_tracking_shipments upsert:', e);
          errors.push(`Shipment sync exception: ${e.message}`);
        }
      }
    }

    // 3. Link back into Supabase sales_orders
    if (onProgress) {
      onProgress({ current: total, total, phase: 'Enriching Website Sales Orders...' });
    }

    for (let i = 0; i < matched.length; i += 50) {
      const slice = matched.slice(i, i + 50);
      await Promise.all(
        slice.map(async item => {
          if (!item.cleanOrderId) return;
          try {
            const { data: salesOrder } = await supabase
              .from('sales_orders')
              .select('id, dispatch_status, dispatch_date, extra_data')
              .eq('channel', 'WEBSITE')
              .eq('order_id', item.cleanOrderId)
              .maybeSingle();

            if (!salesOrder) return;

            let nextDispatchStatus = 'DISPATCHED';
            if (item.normalizedStatus === 'Delivered') {
              nextDispatchStatus = 'DELIVERED';
            } else if (item.normalizedStatus.includes('RTO')) {
              nextDispatchStatus = 'RTO';
            } else if (item.normalizedStatus === 'Cancelled') {
              nextDispatchStatus = 'CANCELLED';
            } else if (item.normalizedStatus === 'Un Delivered') {
              nextDispatchStatus = 'DISPATCHED';
            }

            // Protect existing DELIVERED orders from downgrade unless carrier explicitly confirms RTO
            if (salesOrder.dispatch_status === 'DELIVERED' && nextDispatchStatus !== 'DELIVERED' && !item.normalizedStatus.includes('RTO')) {
              nextDispatchStatus = 'DELIVERED';
            }
            // Protect existing CANCELLED orders from downgrade unless delivered or RTO
            if (salesOrder.dispatch_status === 'CANCELLED' && nextDispatchStatus === 'DISPATCHED') {
              nextDispatchStatus = 'CANCELLED';
            }

            const existingExtra = salesOrder.extra_data || {};
            const nextExtra = {
              ...existingExtra,
              awb_number: item.awbNumber || existingExtra.awb_number,
              courier: item.courier || existingExtra.courier || 'ST Courier',
              raw_status: item.rawStatus || existingExtra.raw_status,
              status_type: item.statusType || existingExtra.status_type,
              remarks: item.remarks || existingExtra.remarks,
              delivered_date: item.deliveredDate || existingExtra.delivered_date,
              estimated_delivery_date: item.estimatedDeliveryDate || existingExtra.estimated_delivery_date,
              last_tracking_sync: nowIso,
              last_reconciled_at: nowIso,
              fulfillment_status: nextDispatchStatus === 'DELIVERED' 
                ? 'fulfilled' 
                : (nextDispatchStatus === 'CANCELLED' ? 'cancelled' : (existingExtra.fulfillment_status || 'unfulfilled'))
            };

            const updatePayload: Record<string, any> = {
              dispatch_status: nextDispatchStatus,
              extra_data: nextExtra,
              updated_at: nowIso
            };

            if (!salesOrder.dispatch_date && (item.dispatchDate || item.deliveredDate)) {
              updatePayload.dispatch_date = item.dispatchDate || item.deliveredDate;
            }

            const { error: soErr } = await supabase
              .from('sales_orders')
              .update(updatePayload)
              .eq('id', salesOrder.id);

            if (!soErr) {
              salesOrdersUpdatedCount++;
            }
          } catch (e) {
            // Ignore individual order linkage errors
          }
        })
      );
    }

    // 4. Dispatch notification events so Sales and Logistics views refresh automatically
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velmora:website_sales_updated'));
      window.dispatchEvent(new CustomEvent('velmora:logistics_updated'));
    }

    return {
      success: errors.length === 0,
      totalProcessed: total,
      updatedShipmentsCount,
      salesOrdersUpdatedCount,
      unmatchedCount: previewItems.length - matched.length,
      skippedCount: previewItems.length - matched.length,
      errors
    };
  } catch (err: any) {
    return {
      success: false,
      totalProcessed: total,
      updatedShipmentsCount,
      salesOrdersUpdatedCount,
      unmatchedCount: previewItems.length - matched.length,
      skippedCount: previewItems.length - matched.length,
      errors: [err.message || 'Import failed']
    };
  }
}

/**
 * Generates and downloads a CSV of unmatched records so user can audit missing orders.
 */
export function exportUnmatchedRecordsCsv(
  items: MultiCourierPreviewItem[],
  fileNamePrefix: string = 'unmatched_records'
) {
  const headers = [
    'Row #',
    'Order ID',
    'AWB Number',
    'Courier',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'Payment Mode',
    'Order Total',
    'Status in Report',
    'Delivery Date',
    'Diagnostic Reason'
  ];

  const rows = items.map(it => [
    it.rowNumber,
    `"${it.orderId || ''}"`,
    `"${it.awbNumber || ''}"`,
    `"${it.courier || ''}"`,
    `"${(it.customerName || '').replace(/"/g, '""')}"`,
    `"${it.phone || ''}"`,
    `"${(it.city || '').replace(/"/g, '""')}"`,
    `"${(it.state || '').replace(/"/g, '""')}"`,
    `"${it.paymentMode || ''}"`,
    it.orderTotal || 0,
    `"${it.rawStatus || it.normalizedStatus || ''}"`,
    `"${it.deliveredDate || ''}"`,
    `"${(it.matchReason || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getCourierDisplayName(type: CourierUploadType): string {
  switch (type) {
    case 'st_courier': return 'ST Courier';
    case 'amazon_shipping': return 'Amazon Shipping';
    case 'india_post': return 'India Post';
    case 'delhivery': return 'Delhivery One';
    default: return 'Courier Report';
  }
}
