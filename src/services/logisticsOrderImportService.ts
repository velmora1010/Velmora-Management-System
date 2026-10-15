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
  fulfillmentStatus?: string;
  financialStatus?: string;
  isEligibleActive: boolean;
  isAlreadyFulfilled: boolean;
  isCancelled: boolean;
  hasRequiredInfo: boolean;
  reviewReason?: string;
  isNew?: boolean;
  hasConflict?: boolean;
  conflictReason?: string;
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
  pendingCount: number;
  alreadyFulfilledCount: number;
  updateOrdersCount: number;
  unchangedCount: number;
  cancelledCount: number;
  duplicateCount: number;
  invalidCount: number;
  conflictCount: number;

  // Breakdown collections
  newOrders: ParsedCustomerOrder[];
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
  // Compatibility fields
  insertedActive: number;
  insertedPending: number;
  insertedTracking: number;
  skippedDuplicates: number;
  skippedCancelled: number;
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
    let calculatedAmount = 0;

    rows.forEach(r => {
      const pName = findHeaderValue(r, ['Lineitem name', 'Lineitem title', 'Products', 'Item Name', 'Product Name', 'SKU']);
      const pQty = findHeaderValue(r, ['Lineitem quantity', 'Quantity', 'Qty']) || 1;
      const rawPrice = findHeaderValue(r, ['Lineitem price', 'Price', 'Item Price', 'Unit Price']);
      const pPrice = parseOrderAmount(rawPrice) ?? 0;

      if (pName) {
        productItems.push(`${String(pName).trim()} × ${pQty}`);
        calculatedAmount += pPrice * Number(pQty);
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

    // Fulfillment Eligibility Analysis
    let isCancelled = false;
    let isFulfilled = false;
    let isRefunded = false;
    let reviewReason = '';

    if (cancelledAt || fulfillmentStatusRaw.includes('cancelled') || fulfillmentStatusRaw.includes('canceled')) {
      isCancelled = true;
      reviewReason = 'Order was cancelled';
    } else if (financialStatusRaw === 'refunded' || financialStatusRaw === 'voided') {
      isRefunded = true;
      reviewReason = 'Payment refunded/voided';
    } else if (
      fulfillmentStatusRaw === 'fulfilled' ||
      fulfillmentStatusRaw === 'shipped' ||
      fulfillmentStatusRaw === 'delivered' ||
      fulfillmentStatusRaw.includes('dispatched') ||
      (rawAwb && String(rawAwb).trim().length > 0)
    ) {
      isFulfilled = true;
      reviewReason = 'Already fulfilled or has AWB tracking';
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
      fulfillmentStatus: fulfillmentStatusRaw || undefined,
      financialStatus: financialStatusRaw || undefined,
      isEligibleActive,
      isAlreadyFulfilled: isFulfilled,
      isCancelled: isCancelled || isRefunded,
      hasRequiredInfo,
      reviewReason: reviewReason || undefined,
      hasConflict: hasFileConflict,
      conflictReason: fileConflictReason || undefined
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

  return {
    totalRows: rawRows.length,
    totalUniqueOrders: groupedRows.size,
    newOrdersCount: newOrders.length,
    eligibleActiveCount,
    pendingCount,
    alreadyFulfilledCount,
    updateOrdersCount: updatePlans.length,
    unchangedCount: unchangedOrders.length,
    cancelledCount,
    duplicateCount: updatePlans.length + unchangedOrders.length,
    invalidCount: invalidRowsCount,
    conflictCount: conflictingOrders.length,
    newOrders,
    updatePlans,
    unchangedOrders,
    conflictingOrders,
    orders: parsedOrders,
    isShopifyFormat
  };
};

/**
 * Commits parsed customer orders into Dexie database safely using an upsert-aware workflow.
 * - Inserts new eligible orders into Active (or Pending / Dispatched based on status)
 * - Updates existing orders safely with valid incoming fields without wiping existing data
 * - Preserves existing workflow stages (Prepare Dispatch, Dispatched, Tracking)
 * - Synchronizes updated fields to Supabase sales_orders
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
    return {
      totalRows: orders.length,
      totalUniqueOrders: orders.length,
      newOrdersCount: newOrdersList.length,
      eligibleActiveCount: newOrdersList.filter(o => o.isEligibleActive).length,
      pendingCount: newOrdersList.filter(o => !o.isEligibleActive && !o.isAlreadyFulfilled && !o.isCancelled).length,
      alreadyFulfilledCount: newOrdersList.filter(o => o.isAlreadyFulfilled).length,
      updateOrdersCount: updatePlansList.length,
      unchangedCount: unchanged,
      cancelledCount: orders.filter(o => o.isCancelled).length,
      duplicateCount: updatePlansList.length + unchanged,
      invalidCount: 0,
      conflictCount: 0,
      newOrders: newOrdersList,
      updatePlans: updatePlansList,
      unchangedOrders: [],
      conflictingOrders: [],
      orders,
      isShopifyFormat: false
    } as ImportValidationResult;
  })();

  let insertedActive = 0;
  let insertedPending = 0;
  let insertedTracking = 0;
  let updatedExisting = 0;
  let skippedCancelled = 0;

  // Execute database transaction on Dexie
  await db.transaction('rw', db.logistics_orders, async () => {
    // 1. Process New Orders
    for (const order of result.newOrders) {
      if (order.isCancelled) {
        skippedCancelled++;
        continue;
      }

      if (order.isAlreadyFulfilled) {
        // Place already fulfilled / tracked orders into Dispatched & Tracking
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
          stage: 'dispatched',
          status: 'Awaiting Tracking Update',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfillmentStatus: order.fulfillmentStatus,
          financialStatus: order.financialStatus
        });
        insertedTracking++;
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
          stage: 'pending',
          status: 'Pending',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfillmentStatus: order.fulfillmentStatus,
          financialStatus: order.financialStatus
        });
        insertedPending++;
      } else {
        // Eligible unfulfilled order -> Active queue
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
          stage: 'order_data',
          status: 'Unfulfilled',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
          financialStatus: order.financialStatus
        });
        insertedActive++;
      }
    }

    // 2. Process Existing Orders that have safe updates
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

  // 3. Asynchronously sync updated fields to Supabase sales_orders
  for (const plan of result.updatePlans) {
    try {
      const cleanId = cleanOrderId(plan.orderId);
      const sbPatch: Record<string, any> = {};
      if (plan.patch.customerName) sbPatch.customer_name = plan.patch.customerName;
      if (plan.patch.phoneNumber) sbPatch.phone = plan.patch.phoneNumber;
      if (plan.patch.state) sbPatch.state = plan.patch.state;
      if (plan.patch.city) sbPatch.city = plan.patch.city;
      if (plan.patch.pincode) sbPatch.pincode = plan.patch.pincode;
      if (plan.patch.amount) sbPatch.order_total = Number(plan.patch.amount) || undefined;
      if (Object.keys(sbPatch).length > 0) {
        sbPatch.updated_at = new Date().toISOString();
        await supabase.from('sales_orders').update(sbPatch).eq('order_id', cleanId);
      }
    } catch (e) {
      // Non-blocking sync warning
    }
  }

  const inserted = insertedActive + insertedPending + insertedTracking;
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
    insertedPending,
    insertedTracking,
    skippedDuplicates: unchanged,
    skippedCancelled
  };
};

