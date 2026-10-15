import * as XLSX from 'xlsx';
import db from '../lib/db';
import type { LogisticsOrder } from '../types/logistics';
import { cleanOrderId } from './unifiedLogisticsService';
import { normalizeCourier } from '../config/courierConfig';
import { parseAndFormatLogisticsDate } from '../utils/logisticsDateUtils';
import { 
  normalizeState, 
  resolveStateFromPincode, 
  parseOrderAmount, 
  normalizeOrderPhone 
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
}

export interface ImportValidationResult {
  totalRows: number;
  totalUniqueOrders: number;
  eligibleActiveCount: number;
  pendingCount: number;
  alreadyFulfilledCount: number;
  cancelledCount: number;
  duplicateCount: number;
  orders: ParsedCustomerOrder[];
  isShopifyFormat: boolean;
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
 * Parses raw JSON rows from XLSX / CSV into structured customer orders,
 * consolidating multiple line items per order and classifying fulfillment eligibility.
 */
export const parseAndValidateCustomerOrders = async (
  rawRows: any[]
): Promise<ImportValidationResult> => {
  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      totalUniqueOrders: 0,
      eligibleActiveCount: 0,
      pendingCount: 0,
      alreadyFulfilledCount: 0,
      cancelledCount: 0,
      duplicateCount: 0,
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

  for (const row of rawRows) {
    const rawId = findHeaderValue(row, [
      'Name', 'Order', 'Order ID', 'Order Number', 'order_id', 'Invoice No', 'order_number', 'order'
    ]);
    const cleanId = cleanOrderId(rawId);
    if (!cleanId) continue;

    const lowerId = cleanId.toLowerCase();
    if (!groupedRows.has(lowerId)) {
      groupedRows.set(lowerId, []);
    }
    groupedRows.get(lowerId)!.push(row);
  }

  // Check existing orders in Dexie to detect duplicates
  const existingOrders = await db.logistics_orders.toArray();
  const existingIdSet = new Set(existingOrders.map(o => cleanOrderId(o.orderId).toLowerCase()));

  const parsedOrders: ParsedCustomerOrder[] = [];
  let eligibleActiveCount = 0;
  let pendingCount = 0;
  let alreadyFulfilledCount = 0;
  let cancelledCount = 0;
  let duplicateCount = 0;

  for (const [lowerId, rows] of groupedRows.entries()) {
    const primaryRow = rows[0];
    const orderId = cleanOrderId(findHeaderValueFromRows(rows, [
      'Name', 'Order', 'Order ID', 'Order Number', 'order_id', 'Invoice No', 'order_number'
    ]));

    if (existingIdSet.has(lowerId)) {
      duplicateCount++;
    }

    // Customer Name (search all rows for full customer name)
    const customerName = String(findHeaderValueFromRows(rows, [
      'Shipping Name', 'Customer Name', 'Billing Name', 'Customer', 'Full Name', 'Name', 'Buyer Name'
    ]) || 'Customer').trim();

    // Phone (search all rows, checking shipping, billing, and direct phone columns)
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

    // If state is not found from header, resolve from 6-digit Indian pincode
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
      amount = ''; // Unknown amount -> displays as '—'
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

    // ==========================================
    // CRITICAL: Fulfillment Eligibility Analysis
    // ==========================================
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

    parsedOrders.push({
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
      reviewReason: reviewReason || undefined
    });
  }

  return {
    totalRows: rawRows.length,
    totalUniqueOrders: groupedRows.size,
    eligibleActiveCount,
    pendingCount,
    alreadyFulfilledCount,
    cancelledCount,
    duplicateCount,
    orders: parsedOrders,
    isShopifyFormat
  };
};

/**
 * Commits parsed customer orders into Dexie database safely without overwriting or duplicating.
 */
export const commitCustomerOrdersImport = async (
  orders: ParsedCustomerOrder[]
): Promise<{
  insertedActive: number;
  insertedPending: number;
  insertedTracking: number;
  skippedDuplicates: number;
  skippedCancelled: number;
}> => {
  const existingOrders = await db.logistics_orders.toArray();
  const existingIdMap = new Map<string, typeof existingOrders[0]>();
  existingOrders.forEach(o => {
    existingIdMap.set(cleanOrderId(o.orderId).toLowerCase(), o);
  });

  let insertedActive = 0;
  let insertedPending = 0;
  let insertedTracking = 0;
  let skippedDuplicates = 0;
  let skippedCancelled = 0;

  await db.transaction('rw', db.logistics_orders, async () => {
    for (const order of orders) {
      const lowerId = order.orderId.toLowerCase();
      const existing = existingIdMap.get(lowerId);

      // Skip cancelled or refunded orders completely
      if (order.isCancelled) {
        skippedCancelled++;
        continue;
      }

      if (existing) {
        // If order already exists and newly has an AWB, update AWB without overwriting customer info
        if (order.awbNumber && !existing.awbNumber) {
          await db.logistics_orders.update(existing.id!, {
            awbNumber: order.awbNumber,
            courier: order.courier || existing.courier,
            stage: 'tracking',
            status: 'In Transit'
          });
          insertedTracking++;
        } else {
          skippedDuplicates++;
        }
        continue;
      }

      // New order routing:
      if (order.isAlreadyFulfilled) {
        // Put already fulfilled / tracked orders into Tracking stage
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
          stage: 'tracking',
          status: order.awbNumber ? 'In Transit' : 'Delivered',
          uploadedAt: new Date().toLocaleString(),
          orderDate: order.orderDate,
          orderDateDisplay: order.orderDateDisplay,
          fulfillmentStatus: order.fulfillmentStatus,
          financialStatus: order.financialStatus
        });
        insertedTracking++;
      } else if (!order.hasRequiredInfo) {
        // Put orders missing phone or address into Pending stage for user review
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
        // Eligible unfulfilled orders go directly into Active
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
          stage: 'order_data', // mapped to 'active'
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
  });

  return {
    insertedActive,
    insertedPending,
    insertedTracking,
    skippedDuplicates,
    skippedCancelled
  };
};
