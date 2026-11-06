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

const normalizeKey = (str: string): string => {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
};

const normalizeTrackingStatus = (raw?: string | null): string => {
  if (!raw) return 'In Transit';
  const s = raw.toLowerCase().trim();
  if (s.includes('delivered to consignee') || s === 'delivered' || s.includes('delivered')) return 'Delivered';
  if (s.includes('out for delivery') || s.includes('out_for_delivery')) return 'Out for Delivery';
  if (s.includes('rto delivered') || s.includes('returned to origin') || s.includes('returned_to_origin')) return 'RTO Delivered to Seller';
  if (s.includes('rto in transit') || s.includes('returning to origin') || s.includes('returning_to_origin') || s.includes('rto')) return 'RTO - In Transit';
  if (s.includes('failed attempt') || s.includes('undelivered') || s.includes('refused')) return 'Failed Attempt';
  if (s.includes('exception') || s.includes('delay') || s.includes('hold') || s.includes('sla')) return 'Delivery Exception';
  if (s.includes('in transit') || s.includes('transit') || s.includes('shipped') || s.includes('dispatched') || s.includes('pickup scheduled') || s.includes('waiting_pickup')) return 'In Transit';
  if (s.includes('manifest') || s.includes('booked') || s.includes('info received') || s.includes('picked')) return 'Info Received';
  return 'In Transit';
};

/**
 * Detects appropriate column headers from courier report using normalized header matching
 */
export const detectTrackingColumns = (headers: string[]) => {
  const normHeaders = headers.map(normalizeKey);

  const findIdx = (candidates: string[]) => {
    const normCandidates = candidates.map(normalizeKey);
    return normHeaders.findIndex(h => normCandidates.some(c => h === c || (c.length >= 4 && h.includes(c))));
  };

  // Order ID / Reference column (Delhivery uses "Reference No.")
  const orderIdIdx = findIdx([
    'referenceno', 'referencenumber', 'reference', 'refno', 
    'orderid', 'ordernumber', 'order', 'order_id', 'invoiceno', 'invoicenumber'
  ]);

  // AWB / Waybill Column
  const awbIdx = findIdx([
    'waybill', 'waybillnumber', 'awb', 'awbnumber', 'awbno', 
    'trackingnumber', 'trackingno', 'consignmentnumber', 'consignmentno', 
    'articlenumber', 'barcode', 'trackingid'
  ]);

  // Status Column
  const statusIdx = findIdx([
    'currentstatus', 'status', 'statustype', 'shipmentstatus', 
    'orderstatus', 'deliverystatus', 'eventstatus'
  ]);

  // Remarks / Latest Event Column
  const remarksIdx = findIdx([
    'remarks', 'pendingreturnedremarks', 'pendingremarks', 'latestevent', 
    'instructions', 'eventdescription', 'scandetails', 'reason', 'activity', 'lastscan'
  ]);

  // Delivery Date Column
  const deliveryDateIdx = findIdx([
    'delivereddate', 'deliverydate', 'orderdelivereddate', 'deliveredon', 'scandate'
  ]);

  // Estimated Delivery Date Column
  const estimatedDeliveryDateIdx = findIdx([
    'estimateddeliverydate', 'promiseddeliverydate', 'expecteddeliverydate', 'edd'
  ]);

  // Pickup / Dispatch Date Column
  const pickupDateIdx = findIdx([
    'pickupdate', 'pickup_date', 'dispatchdate', 'shippeddate'
  ]);

  // Courier Column
  const courierIdx = findIdx([
    'courier', 'couriercompany', 'carrier', 'serviceprovider', 'shippingcompany'
  ]);

  // Consignee / Customer Column
  const customerIdx = findIdx([
    'consigneename', 'customername', 'buyername', 'clientname', 'name'
  ]);

  // Amount Column
  const amountIdx = findIdx([
    'orderamount', 'amount', 'totalamount', 'invoicevalue', 'value'
  ]);

  // Payment Mode Column
  const paymentModeIdx = findIdx([
    'paymentmode', 'type', 'paymentmethod'
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
    paymentModeIdx
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
 * authoritative Order ID matching and AWB reconciliation.
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
    (headerKeysLower.includes('reference no.') || headerKeysLower.includes('reference no') || headerKeysLower.includes('client') || headerKeysLower.includes('pickup location name'));

  if (isDelhiveryFormat) {
    fileLevelCourier = 'Delhivery';
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
      awbMap.set(ord.awbNumber.trim().toLowerCase(), ord);
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

    const rawAwb = cols.awbIdx !== -1 ? String(row[cols.awbIdx] || '').trim() : '';
    const rawRef = cols.orderIdIdx !== -1 ? String(row[cols.orderIdIdx] || '').trim() : '';
    const cleanOid = cleanOrderId(rawRef);

    if (!rawAwb && !cleanOid) {
      invalidCount++;
      continue;
    }

    if (rawAwb && seenAwbsInFile.has(rawAwb)) {
      duplicateAwbCount++;
    } else if (rawAwb) {
      seenAwbsInFile.add(rawAwb);
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

    // Determine authoritative courier for this row
    let rowDetectedCourier = rowCourier 
      ? normalizeCourier(rowCourier) 
      : detectCourier(rawAwb, fileLevelCourier);

    if (!rowDetectedCourier || rowDetectedCourier === 'Unknown') {
      rowDetectedCourier = fileLevelCourier || 'Delhivery';
    }

    const normalizedStatus = normalizeTrackingStatus(rawStatus);

    // Primary matching strategy: Match by exact Order ID
    let existing: LogisticsOrder | undefined;
    if (cleanOid) {
      existing = orderIdMap.get(cleanOid.toLowerCase());
    }

    // Secondary fallback: Match by AWB if Order ID was not present or not found
    if (!existing && rawAwb) {
      existing = awbMap.get(rawAwb.toLowerCase());
    }

    if (existing) {
      matchedCount++;
      const existingAwb = (existing.awbNumber || '').trim();
      const existingCourier = normalizeCourier(existing.courier) || '';

      let classification: TrackingMatchClassification = 'CORRECT_MATCH';
      let requiresReview = false;
      let reviewReason: string | undefined;

      const isAwbMismatch = !!(rawAwb && existingAwb && rawAwb.toLowerCase() !== existingAwb.toLowerCase());
      const isCourierMismatch = !!(rowDetectedCourier && existingCourier && rowDetectedCourier.toLowerCase() !== existingCourier.toLowerCase());
      const isNewAwb = !existingAwb && !!rawAwb;

      if (isAwbMismatch && isCourierMismatch) {
        classification = 'BOTH_MISMATCH';
        bothMismatchHandling: {
          requiresReview = false; // Authoritative courier file resolves the mismatch
          reviewReason = `Order #${existing.orderId} currently has AWB ${existingAwb} (${existingCourier}). Updating to verified source AWB ${rawAwb} (${rowDetectedCourier}).`;
        }
        awbMismatchCount++;
        courierMismatchCount++;
      } else if (isAwbMismatch) {
        classification = 'AWB_MISMATCH';
        reviewReason = `Existing AWB was ${existingAwb}. Correcting to verified file AWB: ${rawAwb}.`;
        awbMismatchCount++;
      } else if (isCourierMismatch) {
        classification = 'COURIER_MISMATCH';
        reviewReason = `Existing courier was ${existingCourier}. Correcting to verified file courier: ${rowDetectedCourier}.`;
        courierMismatchCount++;
      } else if (isNewAwb) {
        classification = 'NEW_ASSIGNMENT';
        reviewReason = `Assigning new AWB ${rawAwb} to unassigned Order #${existing.orderId}.`;
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
 */
export const commitCourierTrackingUpdates = async (
  items: TrackingFilePreviewItem[]
): Promise<{ updatedCount: number; errors: string[] }> => {
  const matched = items.filter(it => it.isMatched && it.matchedRawId);
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    const nowIso = new Date().toISOString();
    const nowLocale = new Date().toLocaleString();

    await db.transaction('rw', [db.logistics_orders, db.tracking_logs], async () => {
      for (const item of matched) {
        if (!item.matchedRawId) continue;
        const ord = await db.logistics_orders.get(item.matchedRawId);
        if (!ord) continue;

        let finalStatus = item.newStatus;
        const curStatus = ord.status || '';
        if ((curStatus === 'Delivered' || curStatus === 'RTO Delivered to Seller') && finalStatus !== curStatus && !finalStatus.includes('RTO')) {
          console.warn(`[FILE IMPORT PROTECTION] Preserving ${curStatus} for order #${ord.orderId}, ignoring file status: ${finalStatus}`);
          finalStatus = curStatus;
        }

        const isDelivered = finalStatus === 'Delivered';
        const isRto = finalStatus.includes('RTO') || finalStatus.includes('Return');

        const updatePayload: Partial<LogisticsOrder> = {
          awbNumber: item.awbNumber,
          courier: item.courier,
          status: finalStatus,
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

    return { updatedCount, errors };
  } catch (err: any) {
    return { updatedCount, errors: [err.message || 'Failed to apply tracking updates'] };
  }
};
