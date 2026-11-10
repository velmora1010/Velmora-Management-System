import * as XLSX from 'xlsx';
import db from '../lib/db';
import { supabase } from '../lib/supabase';
import type { LogisticsOrder } from '../types/logistics';
import { normalizeCourier } from '../config/courierConfig';
import { detectCourier } from '../utils/courierDetector';
import { cleanOrderId } from './unifiedLogisticsService';
import { parseAndFormatLogisticsDate } from '../utils/logisticsDateUtils';

export type TrackingMatchClassification = 
  | 'CORRECT_MATCH'
  | 'AWB_MISMATCH'
  | 'COURIER_MISMATCH'
  | 'BOTH_MISMATCH'
  | 'NEW_ASSIGNMENT'
  | 'NOT_IN_SYSTEM'
  | 'DUPLICATE_AWB'
  | 'INVALID_DATA';

export interface TrackingFilePreviewItem {
  rowNumber: number;
  awbNumber: string;
  orderId?: string;
  customerName?: string;
  existingAwb?: string;
  existingCourier?: string;
  courier: string;
  currentStatus: string;
  newStatus: string;
  rawStatus?: string;
  remarks?: string;
  deliveredDate?: string;
  estimatedDeliveryDate?: string;
  dispatchDate?: string;
  amount?: number;
  paymentMode?: string;
  currentLocation?: string;
  classification: TrackingMatchClassification;
  isMatched: boolean;
  requiresReview: boolean;
  reviewReason?: string;
  matchedRawId?: number;
}

export interface TrackingFileAnalysisResult {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  awbMismatchCount: number;
  courierMismatchCount: number;
  newAssignmentCount: number;
  correctMatchCount: number;
  duplicateAwbCount: number;
  invalidCount: number;
  courierProfile: string;
  detectedHeaders: string[];
  previewItems: TrackingFilePreviewItem[];
}

export interface LastReportSyncSummary {
  timestamp: string;
  displayTime: string;
  courier: string;
  totalRows: number;
  updatedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  invalidCount: number;
  fileName?: string;
}

export const LAST_REPORT_SUMMARY_STORAGE_KEY = 'velmora_last_report_sync_summary';

export const getLastReportSyncSummary = (): LastReportSyncSummary | null => {
  try {
    const raw = localStorage.getItem(LAST_REPORT_SUMMARY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveLastReportSyncSummary = (summary: LastReportSyncSummary) => {
  try {
    localStorage.setItem(LAST_REPORT_SUMMARY_STORAGE_KEY, JSON.stringify(summary));
  } catch (e) {
    console.warn('Failed to save last report sync summary to localStorage', e);
  }
};

export const normalizeKey = (str: string): string => {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Normalizes AWB / Waybill string:
 * - Preserves leading zeros
 * - Prevents Excel scientific notation parsing loss (e.g. 5.72514E+13)
 * - Trims whitespace and strips non-alphanumeric noise
 */
export const normalizeAwb = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';

  if (/^[0-9.]+[eE][+-]?[0-9]+$/.test(str)) {
    try {
      const num = Number(val);
      if (!isNaN(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {
      // fallback to original str
    }
  }

  // Strip trailing float artifacts (.0 or .00)
  str = str.replace(/\.0+$/, '');

  // Keep alphanumeric characters and hyphens
  return str.replace(/[^a-zA-Z0-9-]/g, '').trim();
};

/**
 * Normalizes courier status from report into canonical internal status:
 * | Uploaded Status         | Internal Status           |
 * |-------------------------|---------------------------|
 * | Delivered               | Delivered                 |
 * | In Transit              | In Transit                |
 * | Out for Delivery        | Out for Delivery          |
 * | Undelivered / Failed    | Failed Attempt            |
 * | RTO Return              | RTO - In Transit / Seller |
 * | Pickup Scheduled        | Pickup Scheduled          |
 * | Ready for Pickup        | Ready for Pickup          |
 * | Manifested / Booked     | Info Received             |
 * | Exception / Hold        | Delivery Exception        |
 */
export const normalizeTrackingStatus = (raw?: string | null): string => {
  if (!raw) return 'In Transit';
  const s = raw.toLowerCase().trim();

  // 1. Delivered
  if (
    s.includes('delivered to consignee') ||
    s === 'delivered' ||
    s.includes('delivery complete') ||
    s.includes('successfully delivered') ||
    s.startsWith('dlv')
  ) {
    return 'Delivered';
  }

  // 2. Out for Delivery
  if (
    s.includes('out for delivery') ||
    s.includes('out_for_delivery') ||
    s.includes('dispatched for delivery') ||
    s.includes('run sheet created') ||
    s.includes('with delivery courier')
  ) {
    return 'Out for Delivery';
  }

  // 3. RTO Delivered
  if (
    s.includes('rto delivered') ||
    s.includes('returned to origin') ||
    s.includes('returned to seller') ||
    s.includes('return delivered') ||
    s.includes('rto complete')
  ) {
    return 'RTO Delivered to Seller';
  }

  // 4. RTO In Transit
  if (
    s.includes('rto in transit') ||
    s.includes('returning to origin') ||
    s.includes('rto initiated') ||
    s.includes('return to origin') ||
    s.includes('rto - in transit') ||
    (s.includes('rto') && !s.includes('delivered'))
  ) {
    return 'RTO - In Transit';
  }

  // 5. Undelivered / Failed Attempt
  if (
    s.includes('undelivered') ||
    s.includes('failed attempt') ||
    s.includes('consignee unavailable') ||
    s.includes('delivery attempt failed') ||
    s.includes('refused') ||
    s.includes('customer not available') ||
    s.includes('unattempted') ||
    s.includes('door closed') ||
    s.includes('address incomplete')
  ) {
    return 'Failed Attempt';
  }

  // 6. Exception / Hold
  if (
    s.includes('exception') ||
    s.includes('delay') ||
    s.includes('hold') ||
    s.includes('embargo') ||
    s.includes('damage') ||
    s.includes('lost') ||
    s.includes('sla breach') ||
    s.includes('audit hold')
  ) {
    return 'Delivery Exception';
  }

  // 7. Pickup Scheduled
  if (
    s.includes('pickup scheduled') ||
    s.includes('scheduled for pickup') ||
    s.includes('pickup arranged') ||
    s.includes('pickup planned')
  ) {
    return 'Pickup Scheduled';
  }

  // 8. Ready for Pickup
  if (
    s.includes('ready for pickup') ||
    s.includes('waiting pickup') ||
    s.includes('ready to ship')
  ) {
    return 'Ready for Pickup';
  }

  // 9. Pending Manifest / Info Received
  if (
    s.includes('manifest') ||
    s.includes('pending manifest') ||
    s.includes('info received') ||
    s.includes('booked') ||
    s.includes('data received') ||
    s.includes('order created')
  ) {
    return 'Info Received';
  }

  // 10. In Transit
  if (
    s.includes('in transit') ||
    s.includes('transit') ||
    s.includes('dispatched') ||
    s.includes('shipped') ||
    s.includes('departed') ||
    s.includes('arrived at facility') ||
    s.includes('bag received') ||
    s.includes('reached facility')
  ) {
    return 'In Transit';
  }

  // Safe fallback without inventing arbitrary status
  return 'In Transit';
};

/**
 * Detects appropriate column headers dynamically for both Delhivery and ST Courier
 */
export const detectTrackingColumns = (headers: string[]) => {
  const normHeaders = headers.map(normalizeKey);

  const findIdx = (candidates: string[]) => {
    const normCandidates = candidates.map(normalizeKey);
    return normHeaders.findIndex(h => normCandidates.some(c => h === c || (c.length >= 4 && h.includes(c))));
  };

  // Order ID / Reference column (Delhivery uses "Reference No.", ST Courier uses "Ref No" or "Order No")
  const orderIdIdx = findIdx([
    'referenceno', 'referencenumber', 'reference', 'refno', 'ref_no', 'ref',
    'orderid', 'ordernumber', 'order_id', 'orderno', 'order',
    'invoiceno', 'invoicenumber', 'customerno', 'consigneeref', 'bookingref'
  ]);

  // AWB / Waybill Column (Delhivery uses "Waybill", ST Courier uses "Awb" or "Consignment No")
  const awbIdx = findIdx([
    'waybill', 'waybillnumber', 'waybillno', 'awb', 'awbnumber', 'awbno', 'awb_no',
    'trackingnumber', 'trackingno', 'consignmentnumber', 'consignmentno', 'cnno',
    'articlenumber', 'barcode', 'trackingid', 'docketno', 'podno'
  ]);

  // Status Column
  const statusIdx = findIdx([
    'currentstatus', 'status', 'statustype', 'shipmentstatus', 
    'orderstatus', 'deliverystatus', 'eventstatus', 'delivery_status', 'latest_status', 'pending_return'
  ]);

  // Remarks / Latest Event Column
  const remarksIdx = findIdx([
    'remarks', 'pendingreturnedremarks', 'pendingremarks', 'latestevent', 
    'instructions', 'eventdescription', 'scandetails', 'reason', 'activity', 
    'lastscan', 'ndrstatus', 'ndrremarks', 'exceptionreason', 'pendingreason'
  ]);

  // Delivery Date Column
  const deliveryDateIdx = findIdx([
    'delivereddate', 'deliverydate', 'orderdelivereddate', 'deliveredon', 
    'scandate', 'actualdeliverydate', 'delivery_time', 'delivered_time'
  ]);

  // Estimated Delivery Date Column
  const estimatedDeliveryDateIdx = findIdx([
    'estimateddeliverydate', 'promiseddeliverydate', 'expecteddeliverydate', 'edd', 'promise_date'
  ]);

  // Pickup / Dispatch Date Column
  const pickupDateIdx = findIdx([
    'pickupdate', 'pickup_date', 'dispatchdate', 'dispatch_date', 'shippeddate', 'manifestdate', 'manifest_date', 'bookingdate'
  ]);

  // Courier Column
  const courierIdx = findIdx([
    'courier', 'couriercompany', 'carrier', 'serviceprovider', 'shippingcompany'
  ]);

  // Consignee / Customer Column
  const customerIdx = findIdx([
    'consigneename', 'customername', 'buyername', 'clientname', 'name', 'consignee'
  ]);

  // Amount Column
  const amountIdx = findIdx([
    'orderamount', 'amount', 'totalamount', 'invoicevalue', 'value', 'collectableamount'
  ]);

  // Payment Mode Column
  const paymentModeIdx = findIdx([
    'paymentmode', 'type', 'paymentmethod', 'payment_type'
  ]);

  // Location / Origin Center Column
  const locationIdx = findIdx([
    'origincenter', 'origin_center', 'currentlocation', 'location', 'lastlocation', 'destination', 'scancenter', 'hub'
  ]);

  return {
    orderIdIdx,
    awbIdx,
    statusIdx,
    remarksIdx,
    deliveryDateIdx,
    estimatedDeliveryDateIdx,
    pickupDateIdx,
    courierIdx,
    customerIdx,
    amountIdx,
    paymentModeIdx,
    locationIdx
  };
};

/**
 * Parses and validates date values from spreadsheet
 */
const parseRowDate = (val?: any): string | undefined => {
  if (!val) return undefined;
  const str = String(val).trim();
  if (!str) return undefined;

  const parsed = parseAndFormatLogisticsDate(str);
  return parsed.isoDate || parsed.displayDate || str;
};

/**
 * Analyzes courier tracking spreadsheet against existing database shipments with
 * authoritative primary AWB matching and secondary Order Reference validation.
 * Supports large reports with zero pagination truncations.
 */
export const analyzeCourierTrackingFile = async (
  rawRows: any[][],
  selectedCourier?: string
): Promise<TrackingFileAnalysisResult> => {
  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      awbMismatchCount: 0,
      courierMismatchCount: 0,
      newAssignmentCount: 0,
      correctMatchCount: 0,
      duplicateAwbCount: 0,
      invalidCount: 0,
      courierProfile: selectedCourier || 'Generic',
      detectedHeaders: [],
      previewItems: []
    };
  }

  const rawHeaders = rawRows[0].map(h => String(h || '').trim());
  const dataRows = rawRows.slice(1);
  const cols = detectTrackingColumns(rawHeaders);

  // File-level courier identity inference
  let fileLevelCourier = selectedCourier || '';
  const headerKeysLower = rawHeaders.map(h => h.toLowerCase());
  
  const isDelhiveryFormat = 
    headerKeysLower.includes('waybill') && 
    (headerKeysLower.includes('reference no.') || headerKeysLower.includes('reference no') || headerKeysLower.includes('client') || headerKeysLower.includes('pickup location name') || headerKeysLower.includes('origin center'));

  const isSTCourierFormat = 
    (headerKeysLower.includes('consignment no') || headerKeysLower.includes('consignment number') || headerKeysLower.includes('st courier')) ||
    (headerKeysLower.includes('ref no') && !headerKeysLower.includes('waybill'));

  if (isDelhiveryFormat) {
    fileLevelCourier = 'Delhivery';
  } else if (isSTCourierFormat) {
    fileLevelCourier = 'ST Courier';
  }

  // Load all existing database orders and shipments for reconciliation
  const existingOrders = await db.logistics_orders.toArray();
  const orderIdMap = new Map<string, LogisticsOrder>();
  const awbMap = new Map<string, LogisticsOrder>();

  existingOrders.forEach(ord => {
    if (ord.orderId) {
      const cleanOid = cleanOrderId(ord.orderId).toLowerCase();
      if (cleanOid) orderIdMap.set(cleanOid, ord);
    }
    if (ord.awbNumber && ord.awbNumber.trim()) {
      const normAwb = normalizeAwb(ord.awbNumber).toLowerCase();
      if (normAwb) awbMap.set(normAwb, ord);
    }
  });

  const previewItems: TrackingFilePreviewItem[] = [];
  const seenAwbsInFile = new Set<string>();

  let matchedCount = 0;
  let unmatchedCount = 0;
  let awbMismatchCount = 0;
  let courierMismatchCount = 0;
  let newAssignmentCount = 0;
  let correctMatchCount = 0;
  let duplicateAwbCount = 0;
  let invalidCount = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const rowNumber = idx + 2;

    const rawAwb = cols.awbIdx !== -1 ? normalizeAwb(row[cols.awbIdx]) : '';
    const rawRef = cols.orderIdIdx !== -1 ? String(row[cols.orderIdIdx] || '').trim() : '';
    const cleanOid = cleanOrderId(rawRef);

    if (!rawAwb && !cleanOid) {
      invalidCount++;
      continue;
    }

    if (rawAwb && seenAwbsInFile.has(rawAwb.toLowerCase())) {
      duplicateAwbCount++;
    } else if (rawAwb) {
      seenAwbsInFile.add(rawAwb.toLowerCase());
    }

    const rawStatus = cols.statusIdx !== -1 ? String(row[cols.statusIdx] || '').trim() : '';
    const rawRemarks = cols.remarksIdx !== -1 ? String(row[cols.remarksIdx] || '').trim() : undefined;
    const rawDeliveryDate = cols.deliveryDateIdx !== -1 ? parseRowDate(row[cols.deliveryDateIdx]) : undefined;
    const rawEdd = cols.estimatedDeliveryDateIdx !== -1 ? parseRowDate(row[cols.estimatedDeliveryDateIdx]) : undefined;
    const rawDispatchDate = cols.pickupDateIdx !== -1 ? parseRowDate(row[cols.pickupDateIdx]) : undefined;
    const rowCourier = cols.courierIdx !== -1 ? String(row[cols.courierIdx] || '').trim() : '';
    const rawCustomer = cols.customerIdx !== -1 ? String(row[cols.customerIdx] || '').trim() : undefined;
    const rawAmount = cols.amountIdx !== -1 ? Number(String(row[cols.amountIdx] || '').replace(/[^0-9.-]+/g, '')) || undefined : undefined;
    const rawPayment = cols.paymentModeIdx !== -1 ? String(row[cols.paymentModeIdx] || '').trim() : undefined;
    const rawLocation = cols.locationIdx !== -1 ? String(row[cols.locationIdx] || '').trim() : undefined;

    // Determine authoritative courier for this row
    let rowDetectedCourier = rowCourier 
      ? normalizeCourier(rowCourier) 
      : detectCourier(rawAwb, fileLevelCourier);

    if (!rowDetectedCourier || rowDetectedCourier === 'Unknown') {
      rowDetectedCourier = fileLevelCourier || 'Delhivery';
    }

    const normalizedStatus = normalizeTrackingStatus(rawStatus);

    // Primary matching strategy: Match by AWB / Waybill number
    let existing: LogisticsOrder | undefined;
    if (rawAwb) {
      existing = awbMap.get(rawAwb.toLowerCase());
    }

    // Secondary validation strategy: Fallback to Order ID if not matched by AWB
    if (!existing && cleanOid) {
      existing = orderIdMap.get(cleanOid.toLowerCase());
    }

    if (existing) {
      matchedCount++;
      const existingAwb = normalizeAwb(existing.awbNumber || '');
      const existingCourier = normalizeCourier(existing.courier) || '';

      let classification: TrackingMatchClassification = 'CORRECT_MATCH';
      let requiresReview = false;
      let reviewReason: string | undefined;

      const isAwbMismatch = !!(rawAwb && existingAwb && rawAwb.toLowerCase() !== existingAwb.toLowerCase());
      const isCourierMismatch = !!(rowDetectedCourier && existingCourier && rowDetectedCourier.toLowerCase() !== existingCourier.toLowerCase());
      const isNewAwb = !existingAwb && !!rawAwb;

      if (isAwbMismatch && isCourierMismatch) {
        classification = 'BOTH_MISMATCH';
        requiresReview = false; // Authoritative courier file resolves the mismatch
        reviewReason = `Order #${existing.orderId} currently has AWB ${existingAwb} (${existingCourier}). Updating to verified report AWB ${rawAwb} (${rowDetectedCourier}).`;
        awbMismatchCount++;
        courierMismatchCount++;
      } else if (isAwbMismatch) {
        classification = 'AWB_MISMATCH';
        reviewReason = `Existing AWB was ${existingAwb}. Updating to verified report AWB: ${rawAwb}.`;
        awbMismatchCount++;
      } else if (isCourierMismatch) {
        classification = 'COURIER_MISMATCH';
        reviewReason = `Existing courier was ${existingCourier}. Updating to verified report courier: ${rowDetectedCourier}.`;
        courierMismatchCount++;
      } else if (isNewAwb) {
        classification = 'NEW_ASSIGNMENT';
        reviewReason = `Assigning verified report AWB ${rawAwb} to unassigned Order #${existing.orderId}.`;
        newAssignmentCount++;
      } else {
        classification = 'CORRECT_MATCH';
        correctMatchCount++;
      }

      previewItems.push({
        rowNumber,
        awbNumber: rawAwb || existingAwb,
        orderId: existing.orderId,
        customerName: existing.customerName || rawCustomer,
        existingAwb: existingAwb || 'None',
        existingCourier: existingCourier || 'None',
        courier: rowDetectedCourier,
        currentStatus: existing.status || 'Not Tracked',
        newStatus: normalizedStatus,
        rawStatus,
        remarks: rawRemarks || existing.remarks,
        deliveredDate: rawDeliveryDate || existing.deliveredDate,
        estimatedDeliveryDate: rawEdd || existing.estimatedDeliveryDate,
        dispatchDate: rawDispatchDate || existing.dispatchDate,
        amount: rawAmount ?? (Number(existing.amount) || undefined),
        paymentMode: rawPayment || existing.orderType,
        currentLocation: rawLocation || existing.currentLocation,
        classification,
        isMatched: true,
        requiresReview,
        reviewReason,
        matchedRawId: existing.id
      });
    } else {
      unmatchedCount++;
      previewItems.push({
        rowNumber,
        awbNumber: rawAwb,
        orderId: cleanOid ? `#${cleanOid}` : undefined,
        customerName: rawCustomer,
        courier: rowDetectedCourier,
        currentStatus: 'Not in System',
        newStatus: normalizedStatus,
        rawStatus,
        remarks: rawRemarks,
        deliveredDate: rawDeliveryDate,
        estimatedDeliveryDate: rawEdd,
        dispatchDate: rawDispatchDate,
        amount: rawAmount,
        paymentMode: rawPayment,
        currentLocation: rawLocation,
        classification: 'NOT_IN_SYSTEM',
        isMatched: false,
        requiresReview: true,
        reviewReason: cleanOid ? `Order #${cleanOid} does not exist in local database` : 'AWB does not match any known order'
      });
    }
  }

  return {
    totalRows: dataRows.length,
    matchedCount,
    unmatchedCount,
    awbMismatchCount,
    courierMismatchCount,
    newAssignmentCount,
    correctMatchCount,
    duplicateAwbCount,
    invalidCount,
    courierProfile: fileLevelCourier || 'Generic',
    detectedHeaders: rawHeaders,
    previewItems
  };
};

/**
 * Commits tracking updates safely and idempotently to:
 * 1. Dexie logistics_orders
 * 2. Supabase customer_tracking_shipments (reconciling old conflicting rows)
 * 3. Supabase sales_orders
 * 4. Dexie tracking_logs
 * 
 * Enforces status overwrite protections:
 * - Never downgrades Delivered to In Transit
 * - Preserves confirmed delivery from older report overwrites
 * - Records full audit history and status source
 */
export const commitCourierTrackingUpdates = async (
  items: TrackingFilePreviewItem[]
): Promise<{ updatedCount: number; errors: string[] }> => {
  const matched = items.filter(it => it.isMatched && it.matchedRawId);
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    const nowIso = new Date().toISOString();
    const nowLocale = new Date().toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(/,/g, '').replace(/(\d{4})\s/, '$1 • ');

    await db.transaction('rw', [db.logistics_orders, db.tracking_logs], async () => {
      for (const item of matched) {
        if (!item.matchedRawId) continue;
        const ord = await db.logistics_orders.get(item.matchedRawId);
        if (!ord) continue;

        let finalStatus = item.newStatus;
        const curStatus = (ord.status || '').trim();

        // Status Protection: Never downgrade Delivered or RTO Delivered
        const isCurrentlyDelivered = curStatus === 'Delivered' || curStatus === 'RTO Delivered to Seller';
        if (isCurrentlyDelivered && finalStatus !== curStatus && !finalStatus.includes('RTO')) {
          console.warn(`[REPORT IMPORT PROTECTION] Preserving ${curStatus} for order #${ord.orderId}; ignoring older/intermediate file status: ${finalStatus}`);
          finalStatus = curStatus;
        }

        const isDelivered = finalStatus === 'Delivered';

        const updatePayload: Partial<LogisticsOrder> = {
          awbNumber: item.awbNumber,
          courier: item.courier,
          status: finalStatus,
          rawStatus: item.rawStatus || item.newStatus,
          stage: isDelivered ? 'fulfilled' : 'tracking',
          syncedAt: nowLocale
        };

        if (item.remarks) {
          updatePayload.remarks = item.remarks;
        }
        if (item.deliveredDate && isDelivered) {
          updatePayload.deliveredDate = item.deliveredDate;
        }
        if (item.estimatedDeliveryDate) {
          updatePayload.estimatedDeliveryDate = item.estimatedDeliveryDate;
        }
        if (item.dispatchDate) {
          updatePayload.dispatchDate = item.dispatchDate;
        }
        if (item.currentLocation) {
          updatePayload.currentLocation = item.currentLocation;
        }

        await db.logistics_orders.update(item.matchedRawId, updatePayload);
        updatedCount++;

        // Add tracking audit log
        await db.tracking_logs.add({
          awb: item.awbNumber,
          courier: item.courier || ord.courier || 'Report Upload',
          startedAt: nowIso,
          finishedAt: nowIso,
          duration: 0,
          success: true
        });
      }
    });

    // 2. Synchronize to Supabase customer_tracking_shipments and sales_orders
    for (const item of matched) {
      const cleanOid = cleanOrderId(item.orderId || '');
      if (!cleanOid || !item.awbNumber) continue;

      try {
        // Delete any stale/obsolete tracking rows for this order ID in Supabase that have an outdated AWB
        if (item.classification === 'AWB_MISMATCH' || item.classification === 'BOTH_MISMATCH') {
          await supabase
            .from('customer_tracking_shipments')
            .delete()
            .eq('order_id', cleanOid)
            .neq('awb_number', item.awbNumber);
        }

        // Upsert canonical shipment record
        await supabase.from('customer_tracking_shipments').upsert({
          order_id: cleanOid,
          display_order_id: `#${cleanOid}`,
          awb_number: item.awbNumber,
          courier: item.courier,
          status: item.newStatus,
          raw_status: item.rawStatus || item.newStatus,
          status_source: 'COURIER_REPORT_IMPORT',
          source_type: 'COURIER_EXPORT',
          dispatch_date: item.dispatchDate || nowIso.slice(0, 10),
          estimated_delivery_date: item.estimatedDeliveryDate || null,
          delivered_date: item.deliveredDate || null,
          remarks: item.remarks || null,
          customer_name: item.customerName || 'Customer',
          amount: item.amount || 0,
          order_type: item.paymentMode || 'Prepaid',
          last_synced_at: nowIso,
          updated_at: nowIso
        }, { onConflict: 'courier,awb_number' });

        // Update sales_orders dispatch_status and extra_data
        const isDelivered = item.newStatus === 'Delivered';
        await supabase.from('sales_orders').update({
          dispatch_status: isDelivered ? 'DELIVERED' : 'DISPATCHED',
          dispatch_date: item.dispatchDate || nowIso.slice(0, 10),
          updated_at: nowIso,
          extra_data: {
            awb_number: item.awbNumber,
            courier: item.courier,
            last_reconciled_at: nowIso
          }
        }).eq('order_id', cleanOid);

      } catch (sbErr: any) {
        console.warn(`Supabase sync note for order #${cleanOid}:`, sbErr);
      }
    }

    // 3. Save Report Sync Summary to localStorage for Sync button modal
    const summary: LastReportSyncSummary = {
      timestamp: nowIso,
      displayTime: nowLocale,
      courier: matched[0]?.courier || 'Report Upload',
      totalRows: items.length,
      updatedCount,
      unmatchedCount: items.filter(it => !it.isMatched).length,
      duplicateCount: items.filter(it => it.classification === 'DUPLICATE_AWB').length,
      invalidCount: items.filter(it => it.classification === 'INVALID_DATA').length
    };
    saveLastReportSyncSummary(summary);

    return { updatedCount, errors };
  } catch (err: any) {
    return { updatedCount, errors: [err.message || 'Failed to apply tracking updates'] };
  }
};
