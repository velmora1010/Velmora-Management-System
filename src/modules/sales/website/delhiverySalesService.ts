import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';
import db from '../../../lib/db';
import { cleanOrderId } from '../../../services/unifiedLogisticsService';
import type {
  DelhiveryNormalizedRecord,
  DelhiveryValidationResult,
  DelhiveryImportResult
} from './delhiveryTypes';

/**
 * Normalizes header keys by removing spaces, underscores, hyphens, and converting to lowercase.
 */
function normalizeKey(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds the actual column value from a row using fuzzy normalized header matching.
 */
function getColumnValue(row: Record<string, any>, candidateKeys: string[]): any {
  const normCandidates = candidateKeys.map(normalizeKey);
  for (const k of Object.keys(row)) {
    const nk = normalizeKey(k);
    if (normCandidates.includes(nk)) {
      return row[k];
    }
  }
  return '';
}

/**
 * Parses date string in DD-MM-YYYY or YYYY-MM-DD format safely.
 */
export function parseDelhiveryDate(raw?: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // Case: DD-MM-YYYY or DD-MM-YYYY HH:mm:ss
  const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(.*))?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Case: YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Case: Excel serial date number
  if (/^\d{5}$/.test(str)) {
    try {
      const parsedDate = new Date((Number(str) - 25569) * 86400 * 1000);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().slice(0, 10);
      }
    } catch {
      // Ignore
    }
  }

  return str;
}

/**
 * Maps Delhivery current_status and status_type to Velmora shipment lifecycle model.
 */
export function mapDelhiveryStatus(currentStatus?: string, statusType?: string) {
  const cs = (currentStatus || '').toUpperCase().trim();
  const st = (statusType || '').toUpperCase().trim();

  if (cs === 'DELIVERED' || st === 'DELIVERED') {
    return {
      canonicalStatus: 'Delivered',
      logisticsStage: 'fulfilled' as const,
      salesDispatchStatus: 'DELIVERED' as const,
      fulfillmentStatus: 'fulfilled' as const,
      priorityRank: 100
    };
  }

  if (cs === 'RETURNED_TO_ORIGIN') {
    return {
      canonicalStatus: 'Returned to Origin',
      logisticsStage: 'fulfilled' as const,
      salesDispatchStatus: 'RTO' as const,
      fulfillmentStatus: 'fulfilled' as const,
      priorityRank: 90
    };
  }

  if (cs === 'RETURNING_TO_ORIGIN' || st === 'RETURNED') {
    return {
      canonicalStatus: 'RTO - In Transit',
      logisticsStage: 'tracking' as const,
      salesDispatchStatus: 'RTO' as const,
      fulfillmentStatus: 'unfulfilled' as const,
      priorityRank: 80
    };
  }

  if (cs === 'OUT_FOR_DELIVERY') {
    return {
      canonicalStatus: 'Out for Delivery',
      logisticsStage: 'tracking' as const,
      salesDispatchStatus: 'DISPATCHED' as const,
      fulfillmentStatus: 'unfulfilled' as const,
      priorityRank: 70
    };
  }

  if (cs === 'SHIPPED') {
    return {
      canonicalStatus: 'In Transit',
      logisticsStage: 'dispatched' as const,
      salesDispatchStatus: 'DISPATCHED' as const,
      fulfillmentStatus: 'unfulfilled' as const,
      priorityRank: 60
    };
  }

  if (cs === 'CANCELLED' || cs === 'CANCELED') {
    return {
      canonicalStatus: 'Cancelled',
      logisticsStage: 'trash' as const,
      salesDispatchStatus: 'CANCELLED' as const,
      fulfillmentStatus: 'cancelled' as const,
      priorityRank: 50
    };
  }

  // Fallback for unknown statuses
  return {
    canonicalStatus: cs ? cs : 'In Transit',
    logisticsStage: 'tracking' as const,
    salesDispatchStatus: 'DISPATCHED' as const,
    fulfillmentStatus: 'unfulfilled' as const,
    priorityRank: 40
  };
}

class DelhiverySalesService {
  /**
   * Parses and validates Delhivery One CSV or spreadsheet.
   */
  async validateDelhiveryFile(file: File): Promise<DelhiveryValidationResult> {
    const dataBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(dataBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '', raw: false });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('The selected file contains no rows or data.');
    }

    const detectedHeaders = Object.keys(rawRows[0] || {});

    // Verify presence of Waybill column
    const waybillHeaderMatch = detectedHeaders.some(h => normalizeKey(h).includes('waybill'));
    if (!waybillHeaderMatch) {
      throw new Error(`Invalid Delhivery file: Required "Waybill" column not found. Detected headers: ${detectedHeaders.slice(0, 8).join(', ')}...`);
    }

    const seenWaybills = new Set<string>();
    const duplicateWaybills = new Set<string>();
    const missingWaybillRows: number[] = [];
    const errors: { rowNumber: number; waybill?: string; reason: string }[] = [];

    const statusBreakdown: Record<string, number> = {};
    const paymentBreakdown: Record<string, number> = {};

    // 1. First pass: parse and normalize records
    const records: DelhiveryNormalizedRecord[] = rawRows.map((row, idx) => {
      const rowNumber = idx + 2; // 1-based, accounting for header
      const rawWaybill = String(getColumnValue(row, ['Waybill', 'AWB', 'Waybill Number']) || '').trim();
      const rawRef = String(getColumnValue(row, ['Reference No.', 'Reference No', 'ReferenceNumber', 'Order ID']) || '').trim();
      const cleanRef = cleanOrderId(rawRef);

      const client = String(getColumnValue(row, ['Client']) || '').trim();
      const sellerName = String(getColumnValue(row, ['Seller Name', 'Seller']) || '').trim();
      const pickupLocation = String(getColumnValue(row, ['Pickup Location Name', 'Pickup Location']) || '').trim();
      const originCenter = String(getColumnValue(row, ['Origin Center']) || '').trim();
      const consigneeName = String(getColumnValue(row, ['Consignee Name', 'Customer Name']) || '').trim();
      const city = String(getColumnValue(row, ['City']) || '').trim();
      const state = String(getColumnValue(row, ['Destination State', 'State']) || '').trim();
      const pincode = String(getColumnValue(row, ['PIN', 'Pincode', 'Zip']) || '').trim();
      const addressScore = String(getColumnValue(row, ['Consignee Address Score', 'Address Score']) || '').trim();
      const productDescription = String(getColumnValue(row, ['Product Description', 'Products']) || '').trim();

      const rawType = String(getColumnValue(row, ['Type', 'Payment Mode']) || '').toUpperCase().trim();
      const paymentMode: 'PREPAID' | 'COD' | 'UNKNOWN' = rawType.includes('COD')
        ? 'COD'
        : rawType.includes('PREPAID')
        ? 'PREPAID'
        : 'UNKNOWN';

      const rawAmount = getColumnValue(row, ['Amount', 'Total Amount']);
      const amount = Number(String(rawAmount).replace(/[^0-9.-]+/g, '')) || 0;

      const rawCodAmount = getColumnValue(row, ['COD Amount']);
      const codAmount = rawCodAmount !== '' && rawCodAmount !== null && rawCodAmount !== undefined
        ? Number(String(rawCodAmount).replace(/[^0-9.-]+/g, '')) || 0
        : null;

      const rawStatusType = String(getColumnValue(row, ['Status Type', 'StatusType']) || '').trim();
      const rawCurrentStatus = String(getColumnValue(row, ['Current Status', 'Status']) || '').trim();
      const mapped = mapDelhiveryStatus(rawCurrentStatus, rawStatusType);

      const remarks = String(getColumnValue(row, ['Remarks']) || '').trim();
      const pendingReturnedRemarks = String(getColumnValue(row, ['Pending / Returned Remarks', 'Pending Remarks']) || '').trim();

      const pickUpDate = parseDelhiveryDate(getColumnValue(row, ['Pick Up Date', 'Pickup Date']));
      const estimatedDeliveryDate = parseDelhiveryDate(getColumnValue(row, ['Estimated Delivery Date', 'Promised Delivery Date']));
      const deliveredDate = parseDelhiveryDate(getColumnValue(row, ['Delivered Date']));

      const riskOfReturn = String(getColumnValue(row, ['Risk Of Return', 'Risk']) || '').trim();
      const dispatchCount = Number(getColumnValue(row, ['Dispatch Count'])) || 0;
      const attemptCount = Number(getColumnValue(row, ['Attempt count', 'Attempt Count'])) || 0;

      const rawMot = String(getColumnValue(row, ['MOT', 'Transport Mode']) || '').trim();
      const mot = rawMot.toUpperCase().includes('EXP') ? 'Express' : rawMot ? 'Surface' : 'Surface';

      const masterWaybillNumber = String(getColumnValue(row, ['Master Waybill Number']) || '').trim();
      const rawMpsAmount = getColumnValue(row, ['MPS Amount']);
      const mpsAmount = rawMpsAmount ? Number(rawMpsAmount) || 0 : undefined;

      // Validation checks
      let isValid = true;
      let validationError: string | undefined;

      if (!rawWaybill) {
        isValid = false;
        validationError = 'Missing Waybill';
        missingWaybillRows.push(rowNumber);
        errors.push({ rowNumber, reason: 'Waybill is required but blank' });
      } else if (seenWaybills.has(rawWaybill)) {
        duplicateWaybills.add(rawWaybill);
        isValid = false;
        validationError = 'Duplicate Waybill in file';
        errors.push({ rowNumber, waybill: rawWaybill, reason: `Duplicate Waybill "${rawWaybill}" already found in file` });
      } else {
        seenWaybills.add(rawWaybill);
      }

      // Tally breakdowns
      statusBreakdown[mapped.canonicalStatus] = (statusBreakdown[mapped.canonicalStatus] || 0) + 1;
      paymentBreakdown[paymentMode] = (paymentBreakdown[paymentMode] || 0) + 1;

      return {
        rowNumber,
        waybill: rawWaybill,
        referenceNo: rawRef,
        cleanReferenceNo: cleanRef,
        client,
        sellerName,
        pickupLocation,
        originCenter,
        consigneeName,
        city,
        state,
        pincode,
        addressScore,
        productDescription,
        paymentMode,
        amount,
        codAmount,
        statusType: rawStatusType,
        currentStatus: rawCurrentStatus,
        canonicalStatus: mapped.canonicalStatus,
        salesDispatchStatus: mapped.salesDispatchStatus,
        logisticsStage: mapped.logisticsStage,
        fulfillmentStatus: mapped.fulfillmentStatus,
        remarks,
        pendingReturnedRemarks,
        pickUpDate,
        estimatedDeliveryDate,
        deliveredDate,
        riskOfReturn,
        dispatchCount,
        attemptCount,
        mot,
        masterWaybillNumber,
        mpsAmount,
        isValid,
        validationError
      };
    });

    // 2. Query existing database records to detect already-saved Waybills and matched Sales Orders
    const validWaybills = Array.from(seenWaybills).filter(Boolean);
    const validRefs = Array.from(new Set(records.map(r => r.cleanReferenceNo).filter(Boolean)));

    const existingDbWaybillsSet = new Set<string>();
    const matchedSalesOrdersSet = new Set<string>();

    try {
      // Chunk check for existing waybills in customer_tracking_shipments
      for (let i = 0; i < validWaybills.length; i += 200) {
        const slice = validWaybills.slice(i, i + 200);
        const { data: dbShipments } = await supabase
          .from('customer_tracking_shipments')
          .select('awb_number')
          .eq('courier', 'Delhivery')
          .in('awb_number', slice);

        (dbShipments || []).forEach(s => existingDbWaybillsSet.add(s.awb_number));
      }

      // Chunk check for matching sales orders in sales_orders
      for (let i = 0; i < validRefs.length; i += 200) {
        const slice = validRefs.slice(i, i + 200);
        const { data: dbOrders } = await supabase
          .from('sales_orders')
          .select('order_id')
          .eq('channel', 'WEBSITE')
          .in('order_id', slice);

        (dbOrders || []).forEach(o => matchedSalesOrdersSet.add(cleanOrderId(o.order_id)));
      }
    } catch (e) {
      console.warn('Database pre-check notice:', e);
    }

    // Annotate records with database state
    records.forEach(r => {
      r.isExistingInDb = existingDbWaybillsSet.has(r.waybill);
      if (r.cleanReferenceNo && matchedSalesOrdersSet.has(r.cleanReferenceNo)) {
        r.matchedSalesOrderId = r.cleanReferenceNo;
      }
    });

    const validCount = records.filter(r => r.isValid).length;
    const invalidCount = records.length - validCount;

    return {
      fileName: file.name,
      totalRows: records.length,
      validCount,
      invalidCount,
      duplicateWaybillCount: duplicateWaybills.size,
      missingWaybillCount: missingWaybillRows.length,
      existingDbWaybillCount: existingDbWaybillsSet.size,
      matchedSalesOrderCount: matchedSalesOrdersSet.size,
      detectedHeaders,
      statusBreakdown,
      paymentBreakdown,
      records,
      errors
    };
  }

  /**
   * Commits validated Delhivery records idempotently into:
   * 1. Supabase customer_tracking_shipments (upsert by courier, awb_number)
   * 2. Supabase sales_orders (updates matching orders with AWB, courier, status, and dates)
   * 3. Dexie db.logistics_orders (local sync)
   */
  async commitDelhiveryImport(
    records: DelhiveryNormalizedRecord[],
    onProgress?: (progress: { current: number; total: number; phase: string }) => void
  ): Promise<DelhiveryImportResult> {
    const startTime = Date.now();
    const validRecords = records.filter(r => r.isValid && r.waybill);

    let importedCount = 0;
    let updatedCount = 0;
    let salesOrdersUpdatedCount = 0;
    let skippedCount = records.length - validRecords.length;
    let failedCount = 0;
    const errors: string[] = [];

    const total = validRecords.length;
    const chunkSize = 100;
    const nowIso = new Date().toISOString();

    // Fetch existing shipment records to protect against downgrading newer statuses
    const existingShipmentsMap = new Map<string, any>();
    try {
      const allWaybills = validRecords.map(r => r.waybill);
      for (let i = 0; i < allWaybills.length; i += 300) {
        const slice = allWaybills.slice(i, i + 300);
        const { data: existings } = await supabase
          .from('customer_tracking_shipments')
          .select('awb_number, status, raw_status')
          .eq('courier', 'Delhivery')
          .in('awb_number', slice);

        (existings || []).forEach(e => existingShipmentsMap.set(e.awb_number, e));
      }
    } catch (e) {
      console.warn('Pre-fetch existing shipments warning:', e);
    }

    // 1. Process customer_tracking_shipments in safe chunks
    for (let i = 0; i < validRecords.length; i += chunkSize) {
      const chunk = validRecords.slice(i, i + chunkSize);
      const currentProcessed = Math.min(i + chunkSize, total);

      if (onProgress) {
        onProgress({
          current: currentProcessed,
          total,
          phase: `Saving shipments to database (${currentProcessed}/${total})...`
        });
      }

      const rowsToUpsert = chunk.map(r => {
        const existing = existingShipmentsMap.get(r.waybill);
        const isUpdate = !!existing;
        if (isUpdate) {
          updatedCount++;
        } else {
          importedCount++;
        }

        // If existing is already Delivered, protect it from downgrade
        let finalStatus = r.canonicalStatus;
        let finalRawStatus = r.currentStatus || r.statusType;
        if (existing && existing.status === 'Delivered' && r.canonicalStatus !== 'Delivered') {
          finalStatus = existing.status;
          finalRawStatus = existing.raw_status;
        }

        const combinedRemarks = [r.remarks, r.pendingReturnedRemarks].filter(Boolean).join(' | ');

        return {
          order_id: r.cleanReferenceNo || r.waybill,
          display_order_id: r.referenceNo || `#${r.cleanReferenceNo || r.waybill}`,
          awb_number: r.waybill,
          courier: 'Delhivery',
          status: finalStatus,
          raw_status: finalRawStatus,
          status_source: 'DELHIVERY_ONE_CSV',
          source_type: 'DELHIVERY_EXPORT',
          dispatch_date: r.pickUpDate || null,
          estimated_delivery_date: r.estimatedDeliveryDate || null,
          delivered_date: r.deliveredDate || null,
          last_synced_at: nowIso,
          tracking_url: `https://www.delhivery.com/track/package/${r.waybill}`,
          remarks: combinedRemarks,
          last_location: r.originCenter || null,
          customer_name: r.consigneeName || 'Customer',
          address: '',
          state: r.state || '',
          city: r.city || '',
          pincode: r.pincode || '',
          products: r.productDescription || '',
          amount: r.amount || 0,
          order_type: r.paymentMode,
          updated_at: nowIso
        };
      });

      try {
        const { error: upsertErr } = await supabase
          .from('customer_tracking_shipments')
          .upsert(rowsToUpsert, { onConflict: 'courier,awb_number' });

        if (upsertErr) {
          console.error('[Supabase Error] customer_tracking_shipments chunk upsert failed:', upsertErr);
          failedCount += chunk.length;
          errors.push(`Chunk error: ${upsertErr.message}`);
        }
      } catch (err: any) {
        console.error('[Exception] customer_tracking_shipments chunk upsert:', err);
        failedCount += chunk.length;
        errors.push(`Chunk exception: ${err.message}`);
      }
    }

    // 2. Update matching sales_orders in Supabase
    const matchedRecords = validRecords.filter(r => r.cleanReferenceNo);
    if (matchedRecords.length > 0) {
      if (onProgress) {
        onProgress({
          current: total,
          total,
          phase: 'Linking verified shipments to Website Sales Orders...'
        });
      }

      for (let i = 0; i < matchedRecords.length; i += 50) {
        const subSlice = matchedRecords.slice(i, i + 50);
        await Promise.all(
          subSlice.map(async rec => {
            try {
              const { data: existingOrder } = await supabase
                .from('sales_orders')
                .select('id, order_id, dispatch_status, dispatch_date, extra_data')
                .eq('channel', 'WEBSITE')
                .eq('order_id', rec.cleanReferenceNo)
                .maybeSingle();

              if (!existingOrder) return;

              // Do not downgrade a DELIVERED sales order to DISPATCHED, and do not resurrect CANCELLED orders
              let nextDispatchStatus = rec.salesDispatchStatus;
              const isOrderAlreadyCancelled = existingOrder.order_status === 'CANCELLED' || Boolean(existingOrder.extra_data?.cancellation);
              if (isOrderAlreadyCancelled) {
                nextDispatchStatus = 'CANCELLED';
              } else if (existingOrder.dispatch_status === 'DELIVERED' && rec.salesDispatchStatus !== 'DELIVERED') {
                nextDispatchStatus = 'DELIVERED';
              }

              const isCancelledNow = isOrderAlreadyCancelled || rec.salesDispatchStatus === 'CANCELLED';

              const existingExtra = existingOrder.extra_data || {};
              const nextExtra = {
                ...existingExtra,
                awb_number: rec.waybill,
                courier: 'Delhivery',
                delhivery_current_status: rec.currentStatus,
                delhivery_status_type: rec.statusType,
                delhivery_pickup_location: rec.pickupLocation,
                delhivery_mot: rec.mot,
                delhivery_cod_amount: rec.codAmount,
                delhivery_remarks: rec.remarks,
                delhivery_risk_of_return: rec.riskOfReturn,
                delhivery_origin_center: rec.originCenter,
                last_tracking_sync: nowIso,
                fulfillment_status: isCancelledNow ? 'cancelled' : (existingExtra.fulfillment_status || 'unfulfilled')
              };

              const updatePayload: Record<string, any> = {
                dispatch_status: nextDispatchStatus,
                extra_data: nextExtra,
                updated_at: nowIso
              };
              if (isCancelledNow) {
                updatePayload.order_status = 'CANCELLED';
              }

              // Update dispatch date if available
              if (rec.deliveredDate && nextDispatchStatus === 'DELIVERED') {
                updatePayload.dispatch_date = rec.deliveredDate;
              } else if (rec.pickUpDate && !existingOrder.dispatch_date) {
                updatePayload.dispatch_date = rec.pickUpDate;
              }

              const { error: updErr } = await supabase
                .from('sales_orders')
                .update(updatePayload)
                .eq('id', existingOrder.id);

              if (!updErr) {
                salesOrdersUpdatedCount++;
              }
            } catch (soErr) {
              // Ignore single order linkage errors
            }
          })
        );
      }
    }

    // 3. Sync to Dexie local database for fast Logistics UI response
    try {
      if (onProgress) {
        onProgress({
          current: total,
          total,
          phase: 'Synchronizing records to local Logistics workspace...'
        });
      }

      for (const rec of validRecords) {
        if (!rec.cleanReferenceNo) continue;
        const existingLogistics = await db.logistics_orders
          .where('orderId')
          .equalsIgnoreCase(rec.cleanReferenceNo)
          .first();

        if (existingLogistics) {
          await db.logistics_orders.update(existingLogistics.id!, {
            awbNumber: rec.waybill,
            courier: 'Delhivery',
            status: rec.canonicalStatus,
            stage: rec.logisticsStage,
            pickupLocation: rec.pickupLocation || existingLogistics.pickupLocation,
            deliveredDate: rec.deliveredDate || existingLogistics.deliveredDate,
            dispatchDate: rec.pickUpDate || existingLogistics.dispatchDate,
            syncedAt: nowIso
          });
        }
      }
    } catch (dexErr) {
      console.warn('Dexie logistics sync warning:', dexErr);
    }

    // 4. Trigger system-wide events to refresh all dependent UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', {
        detail: { count: validRecords.length, timestamp: Date.now() }
      }));
      window.dispatchEvent(new CustomEvent('velmora:logistics_updated', {
        detail: { count: validRecords.length, timestamp: Date.now() }
      }));
    }

    const durationMs = Date.now() - startTime;

    return {
      success: failedCount === 0 || importedCount + updatedCount > 0,
      totalProcessed: records.length,
      importedCount,
      updatedCount,
      salesOrdersUpdatedCount,
      skippedCount,
      failedCount,
      errors,
      durationMs
    };
  }
}

export const delhiverySalesService = new DelhiverySalesService();
