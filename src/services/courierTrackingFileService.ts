import * as XLSX from 'xlsx';
import db from '../lib/db';
import type { LogisticsOrder } from '../types/logistics';
import { normalizeCourier } from '../config/courierConfig';

export interface TrackingFilePreviewItem {
  awbNumber: string;
  orderId?: string;
  courier?: string;
  currentStatus: string;
  newStatus: string;
  remarks?: string;
  deliveredDate?: string;
  isMatched: boolean;
  matchedRawId?: number;
}

export interface TrackingFileAnalysisResult {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  invalidCount: number;
  courierProfile: string;
  previewItems: TrackingFilePreviewItem[];
}

const normalizeTrackingStatus = (raw?: string | null): string => {
  if (!raw) return 'In Transit';
  const s = raw.toLowerCase().trim();
  if (s.includes('delivered')) return 'Delivered';
  if (s.includes('out for delivery')) return 'Out for Delivery';
  if (s.includes('rto') || s.includes('returned') || s.includes('return to origin')) return 'RTO';
  if (s.includes('failed attempt') || s.includes('undelivered') || s.includes('refused')) return 'Failed Attempt';
  if (s.includes('exception') || s.includes('delay') || s.includes('hold')) return 'Delivery Exception';
  if (s.includes('in transit') || s.includes('transit') || s.includes('shipped') || s.includes('dispatched')) return 'In Transit';
  if (s.includes('manifest') || s.includes('booked') || s.includes('info received') || s.includes('picked')) return 'Info Received';
  return 'In Transit';
};

/**
 * Detects appropriate column headers from courier report
 */
export const detectTrackingColumns = (headers: string[]) => {
  const hLower = headers.map(h => String(h || '').toLowerCase().trim());

  // AWB Column
  const awbIdx = hLower.findIndex(h => 
    h === 'awb' || h === 'awb number' || h === 'awb no' || h === 'waybill' || 
    h === 'tracking number' || h === 'tracking no' || h === 'article number' || 
    h === 'barcode' || h === 'consignment number' || h === 'consignment no' || 
    h === 'tracking id'
  );

  // Status Column
  const statusIdx = hLower.findIndex(h => 
    h === 'status' || h === 'order status' || h === 'shipment status' || 
    h === 'current status' || h === 'delivery status' || h === 'event status'
  );

  // Remarks / Latest Event Column
  const remarksIdx = hLower.findIndex(h => 
    h === 'remarks' || h === 'latest event' || h === 'instructions' || 
    h === 'event description' || h === 'scan details' || h === 'reason' || 
    h === 'activity' || h === 'last scan'
  );

  // Delivery Date Column
  const deliveryDateIdx = hLower.findIndex(h => 
    h === 'delivered date' || h === 'delivery date' || h === 'order delivered date' || 
    h === 'delivered on' || h === 'event date' || h === 'scan date'
  );

  // Courier Column (optional)
  const courierIdx = hLower.findIndex(h => 
    h === 'courier' || h === 'courier company' || h === 'carrier' || h === 'service provider'
  );

  return { awbIdx, statusIdx, remarksIdx, deliveryDateIdx, courierIdx };
};

/**
 * Analyzes courier tracking spreadsheet against existing database shipments
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
      invalidCount: 0,
      courierProfile: selectedCourier || 'Generic',
      previewItems: []
    };
  }

  const headers = rawRows[0].map(h => String(h || ''));
  const dataRows = rawRows.slice(1);
  const cols = detectTrackingColumns(headers);

  // Load existing database shipments
  const existingShipments = await db.logistics_orders.toArray();
  const awbMap = new Map<string, typeof existingShipments[0]>();

  existingShipments.forEach(s => {
    if (s.awbNumber && s.awbNumber.trim().length > 0) {
      awbMap.set(s.awbNumber.trim().toLowerCase(), s);
    }
  });

  const previewItems: TrackingFilePreviewItem[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let invalidCount = 0;

  for (const row of dataRows) {
    const rawAwb = cols.awbIdx !== -1 ? String(row[cols.awbIdx] || '').trim() : '';
    if (!rawAwb) {
      invalidCount++;
      continue;
    }

    const rawStatus = cols.statusIdx !== -1 ? String(row[cols.statusIdx] || '').trim() : '';
    const rawRemarks = cols.remarksIdx !== -1 ? String(row[cols.remarksIdx] || '').trim() : undefined;
    const rawDeliveryDate = cols.deliveryDateIdx !== -1 ? String(row[cols.deliveryDateIdx] || '').trim() : undefined;
    const fileCourier = cols.courierIdx !== -1 ? String(row[cols.courierIdx] || '').trim() : undefined;

    const normalizedStatus = normalizeTrackingStatus(rawStatus);
    const existing = awbMap.get(rawAwb.toLowerCase());

    if (existing) {
      matchedCount++;
      previewItems.push({
        awbNumber: rawAwb,
        orderId: existing.orderId,
        courier: existing.courier || (fileCourier ? normalizeCourier(fileCourier) : selectedCourier),
        currentStatus: existing.status || 'Not Tracked',
        newStatus: normalizedStatus,
        remarks: rawRemarks || existing.remarks,
        deliveredDate: rawDeliveryDate || existing.deliveredDate,
        isMatched: true,
        matchedRawId: existing.id
      });
    } else {
      unmatchedCount++;
      previewItems.push({
        awbNumber: rawAwb,
        courier: fileCourier ? normalizeCourier(fileCourier) : selectedCourier,
        currentStatus: 'Not in System',
        newStatus: normalizedStatus,
        remarks: rawRemarks,
        deliveredDate: rawDeliveryDate,
        isMatched: false
      });
    }
  }

  return {
    totalRows: dataRows.length,
    matchedCount,
    unmatchedCount,
    invalidCount,
    courierProfile: selectedCourier || 'Generic',
    previewItems
  };
};

/**
 * Commits tracking updates strictly to existing shipments without creating bogus customer orders.
 */
export const commitCourierTrackingUpdates = async (
  items: TrackingFilePreviewItem[]
): Promise<{ updatedCount: number; errors: string[] }> => {
  const matched = items.filter(it => it.isMatched && it.matchedRawId);
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    await db.transaction('rw', [db.logistics_orders, db.tracking_logs], async () => {
      const nowStr = new Date().toLocaleString();
      const nowIso = new Date().toISOString();

      for (const item of matched) {
        if (!item.matchedRawId) continue;
        const ord = await db.logistics_orders.get(item.matchedRawId);
        if (!ord) continue;

        const updatePayload: Partial<LogisticsOrder> = {
          status: item.newStatus,
          syncedAt: nowStr
        };

        if (item.remarks) {
          updatePayload.remarks = item.remarks;
        }
        if (item.deliveredDate && item.newStatus === 'Delivered') {
          updatePayload.deliveredDate = item.deliveredDate;
        }

        await db.logistics_orders.update(item.matchedRawId, updatePayload);
        updatedCount++;

        // Add log
        await db.tracking_logs.add({
          awb: item.awbNumber,
          courier: ord.courier || item.courier || 'Report Upload',
          startedAt: nowIso,
          finishedAt: nowIso,
          duration: 0,
          success: true
        });
      }
    });

    return { updatedCount, errors };
  } catch (err: any) {
    return { updatedCount, errors: [err.message || 'Failed to apply tracking updates'] };
  }
};
