import * as XLSX from 'xlsx';
import db from '../lib/db';
import { supabase } from '../lib/supabase';
import type { LogisticsOrder } from '../types/logistics';
import { cleanOrderId } from './unifiedLogisticsService';
import { normalizeCourier } from '../config/courierConfig';
import { parseAndFormatLogisticsDate } from '../utils/logisticsDateUtils';
import { 
  normalizeState, 
  resolveStateFromPincode, 
  parseOrderAmount, 
  normalizeOrderPhone,
  isDispatchedOrder,
  detectOrderChanges
} from '../utils/logisticsOrderUtils';

export interface ParsedCustomerOrder {
  orderId: string;
  customerName: string;
  phoneNumber: string;
  rawPhoneNumber?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  products: string;
  amount: string;
  orderType: string;
  awbNumber?: string;
  courier?: string;
  orderDate?: string;
  orderDateDisplay?: string;
  fulfilledDate?: string;
  fulfillmentStatus?: string;
  sourceFulfillmentStatus?: string;
  financialStatus?: string;
  isEligibleActive: boolean;
  isAlreadyFulfilled: boolean;
  isCancelled: boolean;
  hasRequiredInfo: boolean;
  reviewReason?: string;
  isNew?: boolean;
  hasConflict?: boolean;
  conflictReason?: string;
  lineItems?: Array<{ name: string; quantity: number; price?: number }>;
}

export interface ExistingOrderUpdatePlan {
  orderId: string;
  existingId: number;
  currentStage: string;
  incoming: ParsedCustomerOrder;
  existingOrder: LogisticsOrder;
  patch: Record<string, any>;
  changedFields: string[];
  hasShipmentConflict?: boolean;
  conflictDescription?: string;
}

export interface ImportValidationResult {
  totalRows: number;
  totalUniqueOrders: number;
  
  // Counts
  newOrdersCount: number;
  eligibleActiveCount: number;
  fulfilledCount: number;
  pendingCount: number;
  alreadyFulfilledCount: number; // Compatibility alias
  updateOrdersCount: number;
  unchangedCount: number;
  cancelledCount: number;
  duplicateCount: number;
  invalidCount: number;
  conflictCount: number;

  // Breakdown collections
  newOrders: ParsedCustomerOrder[];
  fulfilledOrders: ParsedCustomerOrder[];
  activeOrders: ParsedCustomerOrder[];
  updatePlans: ExistingOrderUpdatePlan[];
  unchangedOrders: ParsedCustomerOrder[];
  conflictingOrders: Array<{ orderId: string; reason: string }>;
  orders: ParsedCustomerOrder[];
  isShopifyFormat: boolean;
}

export interface ImportCommitResult {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  // Category breakdowns
  insertedActive: number;
  insertedFulfilled: number;
  insertedPending: number;
  insertedTracking: number;
  skippedDuplicates: number;
  skippedCancelled: number;
  syncedSalesOrders?: number;
}

export interface LogisticsSalesReconciliationReport {
  logisticsTotalOrders: number;
  salesTotalOrders: number;
  logisticsFulfilledCount: number;
  salesFulfilledCount: number;
  logisticsActiveCount: number;
  salesUnfulfilledCount: number;
  missingInSalesCount: number;
  missingInLogisticsCount: number;
  missingInSalesOrderIds: string[];
  missingInLogisticsOrderIds: string[];
  logisticsTotalRevenue: number;
  salesTotalRevenue: number;
  lastReconciledAt: string;
}

/**
 * Normalizes header strings for case-insensitive lookup
 */
const findHeaderValue = (row: any, candidates: string[]): any => {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase().trim();
    const foundKey = keys.find(k => k.toLowerCase().trim() === cLower);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim();
      if (val !== '' && val !== 'null' && val !== 'undefined') {
        return row[foundKey];
      }
    }
  }
  return undefined;
};

/**
 * Searches across multiple rows of an order for candidate header values.
 */
const findHeaderValueFromRows = (rows: any[], candidates: string[]): any => {
  for (const r of rows) {
    const val = findHeaderValue(r, candidates);
    if (val !== undefined && val !== null) {
      const s = String(val).trim();
      if (s !== '' && s !== '-' && s !== 'null' && s !== 'undefined') {
        return val;
      }
    }
  }
  return undefined;
};

/**
 * Parses raw JSON rows from XLSX / CSV into structured customer orders.
 * Implements an upsert/update-aware workflow:
 * - Detects new orders vs existing orders in the system
 * - Detects intra-file conflicts (different customers on same Order ID)
 * - Detects non-destructive updates for existing orders without overwriting valid data with blanks
 * - Preserves existing dispatch/tracking stages and AWBs
 */
export const parseAndValidateCustomerOrders = async (
  rawRows: any[]
): Promise<ImportValidationResult> => {
  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      totalUniqueOrders: 0,
      newOrdersCount: 0,
      eligibleActiveCount: 0,
      pendingCount: 0,
      alreadyFulfilledCount: 0,
      updateOrdersCount: 0,
      unchangedCount: 0,
      cancelledCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      conflictCount: 0,
      newOrders: [],
      updatePlans: [],
      unchangedOrders: [],
      conflictingOrders: [],
      orders: [],
      isShopifyFormat: false
    };
  }

  const sampleRow = rawRows[0];
  const keysLower = Object.keys(sampleRow).map(k => k.toLowerCase().trim());

  // Determine if this is a Shopify export
  const isShopifyFormat = keysLower.some(k => 
    k === 'fulfillment status' || 
    k === 'financial status' || 
    k === 'lineitem name' ||
    k === 'shipping name'
  );

  // Group multiple rows by Order ID (crucial for multi-line Shopify orders)
  const groupedRows = new Map<string, any[]>();
  let invalidRowsCount = 0;

  for (const row of rawRows) {
    const rawId = findHeaderValue(row, [
      'Name', 'Order', 'Order ID', 'Order Number', 'order_id', 'Invoice No', 'order_number', 'order'
    ]);
    const cleanId = cleanOrderId(rawId);
    if (!cleanId) {
      invalidRowsCount++;
      continue;
    }

    const lowerId = cleanId.toLowerCase();
    if (!groupedRows.has(lowerId)) {
      groupedRows.set(lowerId, []);
    }
    groupedRows.get(lowerId)!.push(row);
  }

  // Fetch existing orders in Dexie to classify new vs existing
  const existingOrders = await db.logistics_orders.toArray();
  const existingIdMap = new Map<string, LogisticsOrder>();
  existingOrders.forEach(o => {
    existingIdMap.set(cleanOrderId(o.orderId).toLowerCase(), o);
  });

  const parsedOrders: ParsedCustomerOrder[] = [];
  const newOrders: ParsedCustomerOrder[] = [];
  const updatePlans: ExistingOrderUpdatePlan[] = [];
  const unchangedOrders: ParsedCustomerOrder[] = [];
  const conflictingOrders: Array<{ orderId: string; reason: string }> = [];

  let eligibleActiveCount = 0;
  let pendingCount = 0;
  let alreadyFulfilledCount = 0;
  let cancelledCount = 0;

  for (const [lowerId, rows] of groupedRows.entries()) {
    const orderId = cleanOrderId(findHeaderValueFromRows(rows, [
      'Name', 'Order', 'Order ID', 'Order Number', 'order_id', 'Invoice No', 'order_number'
    ]));

    // Check for intra-file conflicts (different names or phones for same Order ID in the file)
    let hasFileConflict = false;
    let fileConflictReason = '';
    if (rows.length > 1) {
      const distinctNames = new Set(
        rows.map(r => String(findHeaderValue(r, ['Shipping Name', 'Customer Name', 'Billing Name', 'Customer']) || '').trim())
            .filter(n => n && n !== 'Customer')
      );
      const distinctPhones = new Set(
        rows.map(r => normalizeOrderPhone(findHeaderValue(r, ['Shipping Phone', 'Billing Phone', 'Phone', 'Mobile'])))
            .filter(p => p && p.length >= 10)
      );
      if (distinctNames.size > 1) {
        hasFileConflict = true;
        fileConflictReason = `Conflicting customer names in file (${Array.from(distinctNames).join(' vs ')})`;
      } else if (distinctPhones.size > 1) {
        hasFileConflict = true;
        fileConflictReason = `Conflicting phone numbers in file (${Array.from(distinctPhones).join(' vs ')})`;
      }
    }

    // Customer Name
    const customerName = String(findHeaderValueFromRows(rows, [
      'Shipping Name', 'Customer Name', 'Billing Name', 'Customer', 'Full Name', 'Name', 'Buyer Name'
    ]) || 'Customer').trim();

    // Phone
    const rawPhoneVal = findHeaderValueFromRows(rows, [
      'Shipping Phone', 'Billing Phone', 'Phone', 'Phone Number', 'Customer Phone', 
      'Mobile', 'Contact', 'Telephone', 'Customer Mobile', 'Buyer Phone', 'Recipient Phone'
    ]);
    const rawPhone = rawPhoneVal !== undefined && rawPhoneVal !== null ? String(rawPhoneVal).trim() : '';
    const cleanPhone = normalizeOrderPhone(rawPhone);

    // Address Details
    const address = String(findHeaderValueFromRows(rows, [
      'Shipping Address1', 'Shipping Address', 'Address', 'Delivery Address', 'Street', 'Billing Address1', 'Billing Address'
    ]) || '').trim();

    const city = String(findHeaderValueFromRows(rows, [
      'Shipping City', 'City', 'Town', 'Billing City'
    ]) || '').trim();

    const rawState = findHeaderValueFromRows(rows, [
      'Shipping Province Name', 'Billing Province Name', 'Shipping Province', 'Billing Province', 
      'Shipping State', 'Billing State', 'State', 'Province', 'Region', 'State/Province'
    ]);
    let state = normalizeState(rawState ? String(rawState) : '');

    const pincode = String(findHeaderValueFromRows(rows, [
      'Shipping Zip', 'Pincode', 'Pin Code', 'Postal Code', 'Zip', 'Billing Zip'
    ]) || '').trim();

    if (!state && pincode) {
      state = resolveStateFromPincode(pincode);
    }

    // Consolidate Products / Line Items from all grouped rows
    const productItems: string[] = [];
    const lineItemDetails: Array<{ name: string; quantity: number; price?: number }> = [];
    let calculatedAmount = 0;

    rows.forEach(r => {
      const pName = findHeaderValue(r, ['Lineitem name', 'Lineitem title', 'Products', 'Item Name', 'Product Name', 'SKU']);
      const pQty = parseInt(String(findHeaderValue(r, ['Lineitem quantity', 'Quantity', 'Qty']) || '1'), 10) || 1;
      const rawPrice = findHeaderValue(r, ['Lineitem price', 'Price', 'Item Price', 'Unit Price']);
      const pPrice = parseOrderAmount(rawPrice) ?? 0;

      if (pName) {
        const cleanName = String(pName).trim();
        productItems.push(`${cleanName} × ${pQty}`);
        calculatedAmount += pPrice * pQty;
        lineItemDetails.push({
          name: cleanName,
          quantity: pQty,
          price: pPrice > 0 ? pPrice : undefined
        });
      }
    });

    const productsSummary = productItems.length > 0 ? productItems.join(' | ') : 'Standard Products';

    // Amount: search all rows for order total
    const rawTotal = findHeaderValueFromRows(rows, [
      'Total', 'Order Total', 'order_total', 'Total Price', 'total_price', 
      'Grand Total', 'grand_total', 'Current Total Price', 'current_total_price', 
      'Total Paid', 'total_paid', 'Amount', 'Order Amount', 'Net Amount', 'net_amount', 
      'Invoice Value', 'Invoice Amount', 'Value', 'Subtotal'
    ]);
    const parsedTotal = parseOrderAmount(rawTotal);
    let amount: string;
    if (parsedTotal !== null) {
      amount = String(parsedTotal);
    } else if (calculatedAmount > 0) {
      amount = String(calculatedAmount);
    } else {
      amount = '';
    }

    // Payment Mode
    const paymentMode = String(findHeaderValueFromRows(rows, [
      'Payment Method', 'Payment Mode', 'Financial Status', 'Type', 'Order Type'
    ]) || 'Prepaid').trim();

    // Fulfillment Status & Cancellation
    const fulfillmentStatusRaw = String(findHeaderValueFromRows(rows, [
      'Fulfillment Status', 'Fulfillment_Status', 'Fulfilment Status', 'Status', 'Order Status'
    ]) || '').toLowerCase().trim();

    const financialStatusRaw = String(findHeaderValueFromRows(rows, [
      'Financial Status', 'Financial_Status'
    ]) || '').toLowerCase().trim();

    const cancelledAt = findHeaderValueFromRows(rows, ['Cancelled at', 'Cancelled At', 'Cancel Reason']);

    // AWB & Courier
    const rawAwb = findHeaderValueFromRows(rows, [
      'Tracking number', 'Tracking Number', 'AWB', 'Waybill', 'Consignment No'
    ]);
    const rawCourier = findHeaderValueFromRows(rows, [
      'Carrier', 'Courier', 'Shipping Company', 'Courier Partner'
    ]);
    const courier = rawCourier ? normalizeCourier(String(rawCourier)) : undefined;

    // Order Date
    const rawDate = findHeaderValueFromRows(rows, [
      'Created at', 'Order Date', 'Date', 'Created At', 'Processed at'
    ]);
    const parsedDate = parseAndFormatLogisticsDate(rawDate);
    const orderDate = parsedDate.isoDate || (rawDate ? String(rawDate).trim() : new Date().toISOString().slice(0, 10));
    const orderDateDisplay = parsedDate.displayDate || orderDate;

    // Fulfilled Date
    const rawFulfilledDate = findHeaderValueFromRows(rows, [
      'Fulfilled at', 'Fulfilled At', 'fulfilled_at', 'Shipped at', 'Processed at'
    ]);
    const parsedFulfilledDate = rawFulfilledDate ? (parseAndFormatLogisticsDate(rawFulfilledDate).displayDate || String(rawFulfilledDate).trim()) : undefined;

    // Fulfillment Eligibility Analysis:
    // Strictly classify by actual source status — NEVER infer fulfillment merely from tracking/AWB existence!
    let isCancelled = false;
    let isFulfilled = false;
    let isRefunded = false;
    let reviewReason = '';

    const isSourceFulfilledStatus = (
      fulfillmentStatusRaw === 'fulfilled' ||
      fulfillmentStatusRaw === 'shipped' ||
      fulfillmentStatusRaw === 'delivered'
    );

    if (cancelledAt || fulfillmentStatusRaw.includes('cancelled') || fulfillmentStatusRaw.includes('canceled')) {
      isCancelled = true;
      reviewReason = 'Order was cancelled';
    } else if (financialStatusRaw === 'refunded' || financialStatusRaw === 'voided') {
      isRefunded = true;
      reviewReason = 'Payment refunded/voided';
    } else if (isSourceFulfilledStatus) {
      isFulfilled = true;
      reviewReason = 'Fulfilled by source';
    }

    // Has required info: name, 10-digit phone, and address or city/pincode
    const hasRequiredInfo = !!(
      customerName.length > 0 &&
      cleanPhone.length >= 10 &&
      (pincode.length > 0 || city.length > 0 || address.length > 0)
    );

    const isEligibleActive = !isCancelled && !isRefunded && !isFulfilled && hasRequiredInfo;

    if (isCancelled || isRefunded) {
      cancelledCount++;
    } else if (isFulfilled) {
      alreadyFulfilledCount++;
    } else if (!hasRequiredInfo) {
      pendingCount++;
    } else {
      eligibleActiveCount++;
    }

    const parsedOrder: ParsedCustomerOrder = {
      orderId,
      customerName,
      phoneNumber: cleanPhone || rawPhone,
      rawPhoneNumber: rawPhone,
      address,
      city,
      state,
      pincode,
      products: productsSummary,
      amount,
      orderType: paymentMode,
      awbNumber: rawAwb ? String(rawAwb).trim() : undefined,
      courier,
      orderDate,
      orderDateDisplay,
      fulfilledDate: parsedFulfilledDate || (isFulfilled ? orderDateDisplay : undefined),
      fulfillmentStatus: fulfillmentStatusRaw || (isFulfilled ? 'fulfilled' : 'unfulfilled'),
      sourceFulfillmentStatus: fulfillmentStatusRaw || (isFulfilled ? 'fulfilled' : 'unfulfilled'),
      financialStatus: financialStatusRaw || undefined,
      isEligibleActive,
      isAlreadyFulfilled: isFulfilled,
      isCancelled: isCancelled || isRefunded,
      hasRequiredInfo,
      reviewReason: reviewReason || undefined,
      hasConflict: hasFileConflict,
      conflictReason: fileConflictReason || undefined,
      lineItems: lineItemDetails
    };

    parsedOrders.push(parsedOrder);

    if (hasFileConflict) {
      conflictingOrders.push({ orderId, reason: fileConflictReason });
    }

    // -------------------------------------------------------------
    // UPSERT ANALYSIS: Compare with Existing Database Order
    // -------------------------------------------------------------
    const existing = existingIdMap.get(lowerId);
    if (existing) {
      parsedOrder.isNew = false;
      const inDispatchOrTracking = isDispatchedOrder(existing) || existing.stage === 'prepare_dispatch';
      let hasShipmentConflict = false;
      let conflictDescription = '';

      // Check shipment conflict: new file has different AWB/courier than existing dispatched order
      if (inDispatchOrTracking && parsedOrder.awbNumber && existing.awbNumber && parsedOrder.awbNumber !== existing.awbNumber) {
        hasShipmentConflict = true;
        conflictDescription = `Incoming AWB (${parsedOrder.awbNumber}) conflicts with existing shipment AWB (${existing.awbNumber}). Existing shipment stage & tracking preserved.`;
        conflictingOrders.push({ orderId, reason: conflictDescription });
      }

      // Detect safe changes without overwriting valid data with empty/blank
      const { hasChanges, patch, changedFields } = detectOrderChanges(existing, parsedOrder);

      // If existing is still unfulfilled in active/pending and newly has an AWB, update it
      if (!inDispatchOrTracking && parsedOrder.awbNumber && !existing.awbNumber) {
        patch.awbNumber = parsedOrder.awbNumber;
        patch.courier = parsedOrder.courier || existing.courier;
        patch.stage = 'dispatched';
        patch.status = 'Awaiting Tracking Update';
        changedFields.push('AWB Number');
      }

      if (hasChanges || changedFields.length > 0) {
        updatePlans.push({
          orderId,
          existingId: existing.id!,
          currentStage: existing.stage || 'order_data',
          incoming: parsedOrder,
          existingOrder: existing,
          patch,
          changedFields,
          hasShipmentConflict,
          conflictDescription: conflictDescription || undefined
        });
      } else {
        unchangedOrders.push(parsedOrder);
      }
    } else {
      parsedOrder.isNew = true;
      newOrders.push(parsedOrder);
    }
  }

  const fulfilledOrders = parsedOrders.filter(o => o.isAlreadyFulfilled);
  const activeOrders = parsedOrders.filter(o => o.isEligibleActive);

  return {
    totalRows: rawRows.length,
    totalUniqueOrders: groupedRows.size,
    newOrdersCount: newOrders.length,
    eligibleActiveCount,
    fulfilledCount: alreadyFulfilledCount,
    pendingCount,
    alreadyFulfilledCount,
    updateOrdersCount: updatePlans.length,
    unchangedCount: unchangedOrders.length,
    cancelledCount,
    duplicateCount: updatePlans.length + unchangedOrders.length,
    invalidCount: invalidRowsCount,
    conflictCount: conflictingOrders.length,
    newOrders,
    fulfilledOrders,
    activeOrders,
    updatePlans,
    unchangedOrders,
    conflictingOrders,
    orders: parsedOrders,
    isShopifyFormat
  };
};

/**
 * Commits parsed customer orders into Dexie database safely using an upsert-aware workflow.
 * - Inserts new eligible orders into Active (or Fulfilled / Pending based on actual source status)
 * - Updates existing orders safely with valid incoming fields without wiping existing data
 * - Preserves existing workflow stages (Prepare Dispatch, Dispatched, Tracking)
 * - Synchronizes orders to Supabase sales_orders & sales_order_items for Sales department integration
 */
export const commitCustomerOrdersImport = async (
  orders: ParsedCustomerOrder[],
  precomputedResult?: ImportValidationResult
): Promise<ImportCommitResult> => {
  // If precomputedResult is provided, use it directly; otherwise compute validation on the fly
  const result = precomputedResult || await (async () => {
    const existingOrders = await db.logistics_orders.toArray();
    const existingIdMap = new Map<string, LogisticsOrder>();
    existingOrders.forEach(o => existingIdMap.set(cleanOrderId(o.orderId).toLowerCase(), o));

    const newOrdersList: ParsedCustomerOrder[] = [];
    const updatePlansList: ExistingOrderUpdatePlan[] = [];
    let unchanged = 0;

    for (const ord of orders) {
      const lower = cleanOrderId(ord.orderId).toLowerCase();
      const existing = existingIdMap.get(lower);
      if (existing) {
        const { hasChanges, patch, changedFields } = detectOrderChanges(existing, ord);
        if (hasChanges) {
          updatePlansList.push({
            orderId: ord.orderId,
            existingId: existing.id!,
            currentStage: existing.stage || 'order_data',
            incoming: ord,
            existingOrder: existing,
            patch,
            changedFields
          });
        } else {
          unchanged++;
        }
      } else {
        newOrdersList.push(ord);
      }
    }
    const fulfilledList = orders.filter(o => o.isAlreadyFulfilled);
    const activeList = orders.filter(o => o.isEligibleActive);

    return {
      totalRows: orders.length,
      totalUniqueOrders: orders.length,
      newOrdersCount: newOrdersList.length,
      eligibleActiveCount: activeList.length,
      fulfilledCount: fulfilledList.length,
      pendingCount: orders.filter(o => !o.isEligibleActive && !o.isAlreadyFulfilled && !o.isCancelled).length,
      alreadyFulfilledCount: fulfilledList.length,
      updateOrdersCount: updatePlansList.length,
      unchangedCount: unchanged,
      cancelledCount: orders.filter(o => o.isCancelled).length,
      duplicateCount: updatePlansList.length + unchanged,
      invalidCount: 0,
      conflictCount: 0,
      newOrders: newOrdersList,
      fulfilledOrders: fulfilledList,
      activeOrders: activeList,
      updatePlans: updatePlansList,
      unchangedOrders: [],
      conflictingOrders: [],
      orders,
      isShopifyFormat: false
    } as ImportValidationResult;
  })();

  let insertedActive = 0;
  let insertedFulfilled = 0;
  let insertedPending = 0;
  let insertedTracking = 0;
  let updatedExisting = 0;
  let skippedCancelled = 0;

  // 1. Execute database transaction on Dexie
  await db.transaction('rw', db.logistics_orders, async () => {
    // A. Process New Orders
    for (const order of result.newOrders) {
      if (order.isCancelled) {
        skippedCancelled++;
        continue;
      }

      if (order.isAlreadyFulfilled) {
        // Place fulfilled orders into the dedicated Fulfilled section
        await db.logistics_orders.add({
          orderId: order.orderId,
          customerName: order.customerName,
          phoneNumber: order.phoneNumber,
          address: order.address,
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          products: order.products,
          amount: order.amount,
          orderType: order.orderType,
          awbNumber: order.awbNumber,
          courier: order.courier,
          stage: 'fulfilled',
          status: 'Fulfilled',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfilledDate: order.fulfilledDate || order.orderDate,
          fulfillmentStatus: 'fulfilled',
          sourceFulfillmentStatus: 'fulfilled',
          financialStatus: order.financialStatus
        });
        insertedFulfilled++;
      } else if (!order.hasRequiredInfo) {
        // Missing phone, customer name, or address -> Pending review
        await db.logistics_orders.add({
          orderId: order.orderId,
          customerName: order.customerName,
          phoneNumber: order.phoneNumber,
          address: order.address,
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          products: order.products,
          amount: order.amount,
          orderType: order.orderType,
          awbNumber: order.awbNumber,
          courier: order.courier,
          stage: 'pending',
          status: 'Pending',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
          sourceFulfillmentStatus: 'unfulfilled',
          financialStatus: order.financialStatus
        });
        insertedPending++;
      } else {
        // Eligible genuinely unfulfilled order -> Active queue
        await db.logistics_orders.add({
          orderId: order.orderId,
          customerName: order.customerName,
          phoneNumber: order.phoneNumber,
          address: order.address,
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          products: order.products,
          amount: order.amount,
          orderType: order.orderType,
          awbNumber: order.awbNumber,
          courier: order.courier,
          stage: 'active',
          status: 'Unfulfilled',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
          sourceFulfillmentStatus: 'unfulfilled',
          financialStatus: order.financialStatus
        });
        insertedActive++;
      }
    }

    // B. Process Existing Orders that have safe updates
    for (const plan of result.updatePlans) {
      if (Object.keys(plan.patch).length > 0) {
        await db.logistics_orders.update(plan.existingId, {
          ...plan.patch,
          uploadedAt: new Date().toLocaleString()
        });
        updatedExisting++;
      }
    }
  });

  // 2. Synchronize imported orders to Supabase Sales (sales_orders & sales_order_items)
  let syncedSalesOrders = 0;
  try {
    const ordersToSync: ParsedCustomerOrder[] = [
      ...result.newOrders.filter(o => !o.isCancelled),
      ...result.updatePlans.map(p => p.incoming)
    ];
    if (ordersToSync.length > 0) {
      syncedSalesOrders = await syncLogisticsOrdersToSupabaseSales(ordersToSync);
    }
  } catch (syncErr) {
    console.warn('[Logistics Import] Non-blocking sales sync warning:', syncErr);
  }

  const inserted = insertedActive + insertedFulfilled + insertedPending + insertedTracking;
  const updated = updatedExisting;
  const unchanged = result.unchangedCount;
  const skipped = skippedCancelled + result.invalidCount;

  return {
    inserted,
    updated,
    unchanged,
    skipped,
    failed: 0,
    insertedActive,
    insertedFulfilled,
    insertedPending,
    insertedTracking,
    skippedDuplicates: unchanged,
    skippedCancelled,
    syncedSalesOrders
  };
};

/**
 * Synchronizes Logistics orders into Supabase Sales tables (sales_orders and sales_order_items)
 * - Channel is always 'WEBSITE'
 * - Prevents duplicate primary key UUID collisions by querying existing (channel, order_id)
 * - Accurately categorizes payment modes (PREPAID, COD, PARTIAL COD)
 * - Accurately classifies order and dispatch status (FULFILLED, CONFIRMED, DISPATCHED)
 * - Inserts item details into sales_order_items
 */
export const syncLogisticsOrdersToSupabaseSales = async (
  ordersToSync: ParsedCustomerOrder[]
): Promise<number> => {
  if (ordersToSync.length === 0) return 0;

  // 1. Ensure an upload batch exists in sales_uploads for Logistics imports
  let batchId = 'logistics-import-batch';
  try {
    const { data: existingUploads } = await supabase
      .from('sales_uploads')
      .select('id')
      .eq('channel', 'WEBSITE')
      .eq('file_name', 'Logistics Order Import')
      .limit(1);

    if (existingUploads && existingUploads.length > 0) {
      batchId = existingUploads[0].id;
    } else {
      const newId = crypto.randomUUID();
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('sales_uploads').insert([{
        id: newId,
        channel: 'WEBSITE',
        file_name: 'Logistics Order Import',
        file_type: 'xlsx',
        uploaded_at: new Date().toISOString(),
        uploaded_by: 'Logistics Department',
        order_date_from: today,
        order_date_to: today,
        source_rows: ordersToSync.length,
        unique_orders: ordersToSync.length,
        duplicates_merged: 0,
        status: 'COMPLETED'
      }]);
      batchId = newId;
    }
  } catch (err) {
    console.warn('[Sales Sync] Warning getting/creating sales_upload batch:', err);
  }

  // 2. Fetch existing sales_orders to maintain stable UUIDs
  const cleanIds = Array.from(new Set(ordersToSync.map(o => cleanOrderId(o.orderId)).filter(Boolean)));
  const existingUuidMap = new Map<string, string>();

  for (let i = 0; i < cleanIds.length; i += 500) {
    const chunkIds = cleanIds.slice(i, i + 500);
    const { data: existingRows } = await supabase
      .from('sales_orders')
      .select('id, order_id')
      .eq('channel', 'WEBSITE')
      .in('order_id', chunkIds);

    if (existingRows) {
      existingRows.forEach(r => existingUuidMap.set(String(r.order_id).toLowerCase(), r.id));
    }
  }

  // 3. Build upsert payloads for sales_orders
  const orderPayloads = ordersToSync.map(order => {
    const cleanId = cleanOrderId(order.orderId);
    const existingId = existingUuidMap.get(cleanId.toLowerCase());
    const orderUuid = existingId || crypto.randomUUID();
    existingUuidMap.set(cleanId.toLowerCase(), orderUuid);

    const numericAmount = parseOrderAmount(order.amount) || 0;
    const pType = (order.orderType || '').toLowerCase();
    const fStatus = (order.financialStatus || '').toLowerCase();

    // Categorize Payment Mode
    let paymentMode: 'PREPAID' | 'COD' | 'PARTIAL COD' | 'UNKNOWN' = 'PREPAID';
    if (pType.includes('partial') || (pType.includes('cod') && pType.includes('prepaid'))) {
      paymentMode = 'PARTIAL COD';
    } else if (pType.includes('cod') || fStatus === 'pending') {
      paymentMode = 'COD';
    } else if (pType.includes('prepaid') || fStatus === 'paid') {
      paymentMode = 'PREPAID';
    }

    const advancePaid = paymentMode === 'PREPAID' 
      ? numericAmount 
      : (paymentMode === 'PARTIAL COD' ? Math.round(numericAmount * 0.2) : 0);
    const remainingCod = paymentMode === 'PREPAID' ? 0 : Math.max(0, numericAmount - advancePaid);

    const isFulfilled = order.isAlreadyFulfilled || (order.fulfillmentStatus || '').toLowerCase() === 'fulfilled';
    const orderStatus = isFulfilled ? 'FULFILLED' : (order.isCancelled ? 'CANCELLED' : 'CONFIRMED');
    const dispatchStatus = isFulfilled ? 'FULFILLED' : (order.awbNumber ? 'DISPATCHED' : 'UNFULFILLED');

    const totalQty = order.lineItems && order.lineItems.length > 0
      ? order.lineItems.reduce((acc, it) => acc + (it.quantity || 1), 0)
      : 1;

    return {
      id: orderUuid,
      upload_id: batchId,
      channel: 'WEBSITE',
      order_id: cleanId,
      order_date: order.orderDate || new Date().toISOString().slice(0, 10),
      customer_name: order.customerName || 'N/A',
      phone: order.phoneNumber || '',
      state: order.state || 'Unspecified',
      city: order.city || 'Unspecified',
      pincode: order.pincode || '',
      offer: 'No Offer',
      order_type: order.lineItems && order.lineItems.length > 1 ? 'Multi Product Order' : 'Single Product Order',
      total_quantity: totalQty,
      order_total: numericAmount,
      payment_mode: paymentMode,
      source_payment_method: order.orderType || 'Prepaid',
      advance_paid: advancePaid,
      remaining_cod: remainingCod,
      order_status: orderStatus,
      dispatch_status: dispatchStatus,
      dispatch_date: order.fulfilledDate || order.orderDate || new Date().toISOString().slice(0, 10),
      extra_data: {
        address: order.address || '',
        order_formatted: order.products || '',
        product_name: order.products || '',
        fulfillment_status: order.fulfillmentStatus || (isFulfilled ? 'fulfilled' : 'unfulfilled'),
        awb_number: order.awbNumber || '',
        courier: order.courier || '',
        source: 'logistics_import'
      }
    };
  });

  // 4. Batch upsert into sales_orders
  let successCount = 0;
  for (let i = 0; i < orderPayloads.length; i += 300) {
    const chunk = orderPayloads.slice(i, i + 300);
    const { error: upsertErr } = await supabase
      .from('sales_orders')
      .upsert(chunk, { onConflict: 'channel,order_id' });

    if (upsertErr) {
      console.error('[Sales Sync] Upsert failed for chunk:', upsertErr);
    } else {
      successCount += chunk.length;
    }
  }

  // 5. Synchronize line items into sales_order_items
  const itemPayloads: any[] = [];
  ordersToSync.forEach(order => {
    const cleanId = cleanOrderId(order.orderId);
    const salesOrderId = existingUuidMap.get(cleanId.toLowerCase());
    if (!salesOrderId) return;

    if (order.lineItems && order.lineItems.length > 0) {
      order.lineItems.forEach(it => {
        itemPayloads.push({
          id: crypto.randomUUID(),
          sales_order_id: salesOrderId,
          product_code: it.name,
          product_name: it.name,
          quantity: it.quantity || 1,
          unit_price: it.price || 0,
          line_total: (it.price || 0) * (it.quantity || 1),
          item_data: {}
        });
      });
    } else if (order.products) {
      const numericAmount = parseOrderAmount(order.amount) || 0;
      itemPayloads.push({
        id: crypto.randomUUID(),
        sales_order_id: salesOrderId,
        product_code: order.products,
        product_name: order.products,
        quantity: 1,
        unit_price: numericAmount,
        line_total: numericAmount,
        item_data: {}
      });
    }
  });

  if (itemPayloads.length > 0) {
    const salesOrderIds = Array.from(existingUuidMap.values());
    for (let i = 0; i < salesOrderIds.length; i += 300) {
      const chunkIds = salesOrderIds.slice(i, i + 300);
      await supabase.from('sales_order_items').delete().in('sales_order_id', chunkIds);
    }

    for (let i = 0; i < itemPayloads.length; i += 300) {
      const chunkItems = itemPayloads.slice(i, i + 300);
      await supabase.from('sales_order_items').insert(chunkItems);
    }
  }

  return successCount;
};

/**
 * Diagnostics and Data Reconciliation Report comparing Logistics and Sales
 */
export const reconcileLogisticsWithSales = async (): Promise<LogisticsSalesReconciliationReport> => {
  const dexieOrders = await db.logistics_orders.toArray();
  const validDexie = dexieOrders.filter(o => o.stage !== 'trash');

  const logisticsTotalOrders = validDexie.length;
  let logisticsFulfilledCount = 0;
  let logisticsActiveCount = 0;
  let logisticsTotalRevenue = 0;
  const dexieIdSet = new Set<string>();

  validDexie.forEach(o => {
    const cId = cleanOrderId(o.orderId);
    if (cId) dexieIdSet.add(cId.toLowerCase());
    const amt = parseOrderAmount(o.amount) ?? 0;
    logisticsTotalRevenue += amt;

    const isFulfilled = (o.fulfillmentStatus || '').toLowerCase() === 'fulfilled' || o.stage === 'fulfilled';
    if (isFulfilled) {
      logisticsFulfilledCount++;
    } else {
      logisticsActiveCount++;
    }
  });

  // Fetch from Supabase sales_orders
  let salesOrders: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('order_id, order_total, payment_mode, order_status, dispatch_status')
      .eq('channel', 'WEBSITE')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data) break;
    salesOrders = salesOrders.concat(data);
    if (data.length < pageSize) hasMore = false;
    else page++;
  }

  const salesTotalOrders = salesOrders.length;
  let salesFulfilledCount = 0;
  let salesUnfulfilledCount = 0;
  let salesTotalRevenue = 0;
  const salesIdSet = new Set<string>();

  salesOrders.forEach(o => {
    const cId = cleanOrderId(o.order_id);
    if (cId) salesIdSet.add(cId.toLowerCase());
    salesTotalRevenue += Number(o.order_total) || 0;

    const isFulfilled = (o.order_status || '').toLowerCase() === 'fulfilled' || (o.dispatch_status || '').toLowerCase() === 'fulfilled';
    if (isFulfilled) {
      salesFulfilledCount++;
    } else {
      salesUnfulfilledCount++;
    }
  });

  const missingInSalesOrderIds: string[] = [];
  dexieIdSet.forEach(id => {
    if (!salesIdSet.has(id)) missingInSalesOrderIds.push(id);
  });

  const missingInLogisticsOrderIds: string[] = [];
  salesIdSet.forEach(id => {
    if (!dexieIdSet.has(id)) missingInLogisticsOrderIds.push(id);
  });

  return {
    logisticsTotalOrders,
    salesTotalOrders,
    logisticsFulfilledCount,
    salesFulfilledCount,
    logisticsActiveCount,
    salesUnfulfilledCount,
    missingInSalesCount: missingInSalesOrderIds.length,
    missingInLogisticsCount: missingInLogisticsOrderIds.length,
    missingInSalesOrderIds: missingInSalesOrderIds.slice(0, 50),
    missingInLogisticsOrderIds: missingInLogisticsOrderIds.slice(0, 50),
    logisticsTotalRevenue: Math.round(logisticsTotalRevenue),
    salesTotalRevenue: Math.round(salesTotalRevenue),
    lastReconciledAt: new Date().toISOString()
  };
};

/**
 * Syncs all Dexie Logistics orders into Supabase sales_orders
 */
export const syncAllDexieOrdersToSales = async (): Promise<{ syncedCount: number; errors: string[] }> => {
  const dexieOrders = await db.logistics_orders.toArray();
  const validDexie = dexieOrders.filter(o => o.stage !== 'trash');

  const parsedOrders: ParsedCustomerOrder[] = validDexie.map(o => {
    const isFulfilled = (o.fulfillmentStatus || '').toLowerCase() === 'fulfilled' || o.stage === 'fulfilled';
    return {
      orderId: o.orderId,
      customerName: o.customerName,
      phoneNumber: o.phoneNumber,
      address: o.address || '',
      city: o.city || '',
      state: o.state || '',
      pincode: o.pincode || '',
      products: o.products || 'Standard Products',
      amount: String(o.amount || '0'),
      orderType: o.orderType || 'Prepaid',
      awbNumber: o.awbNumber,
      courier: o.courier,
      orderDate: o.orderDate,
      orderDateDisplay: o.orderDateDisplay,
      fulfilledDate: o.fulfilledDate || (isFulfilled ? o.orderDateDisplay : undefined),
      fulfillmentStatus: o.fulfillmentStatus || (isFulfilled ? 'fulfilled' : 'unfulfilled'),
      sourceFulfillmentStatus: o.sourceFulfillmentStatus || (isFulfilled ? 'fulfilled' : 'unfulfilled'),
      financialStatus: o.financialStatus,
      isEligibleActive: !isFulfilled,
      isAlreadyFulfilled: isFulfilled,
      isCancelled: false,
      hasRequiredInfo: true
    };
  });

  const syncedCount = await syncLogisticsOrdersToSupabaseSales(parsedOrders);
  return { syncedCount, errors: [] };
};

