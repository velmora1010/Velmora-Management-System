import db from '../lib/db';
import { supabase } from '../lib/supabase';
import type { LogisticsOrder } from '../types/logistics';
import type {
  UnifiedLogisticsOrder,
  UnifiedCustomer,
  UnifiedTrackingStatus,
  UnifiedWorkflowStage,
  WorkflowStageCounts
} from '../types/unifiedLogistics';

import { parseAndFormatLogisticsDate } from '../utils/logisticsDateUtils';

/**
 * Normalizes phone numbers to standard 10-digit Indian mobile format or clean digit string.
 * Strips "+91", leading zeros, spaces, hyphens, and parentheses.
 */
export const normalizePhoneNumber = (raw?: string | null): string => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
};

/**
 * Cleans order IDs by stripping leading '#' and outer quotes.
 */
export const cleanOrderId = (val?: string | null): string => {
  if (!val) return '';
  let str = String(val).trim();
  if (str.startsWith('#')) {
    str = str.slice(1).trim();
  }
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  if (str.startsWith('#')) {
    str = str.slice(1).trim();
  }
  return str;
};

/**
 * Standardizes raw status strings from spreadsheets, Shopify, and courier APIs
 * into unified tracking status and Influencer Logistics workflow stage.
 * Stages:
 * 1. Active — imported orders that have not yet been moved into dispatch preparation.
 * 2. Pending — orders waiting for required info (e.g. missing address, phone, or courier).
 * 3. Prepare Dispatch — orders selected by user and moved here in bulk for dispatch preparation.
 * 4. Dispatched — orders for which dispatch has actually been completed and saved.
 * 5. Tracking — dispatched orders whose shipment tracking is being monitored.
 */
export const mapToUnifiedWorkflowStage = (
  rawStatus?: string | null,
  stage?: string | null,
  awbNumber?: string | null,
  hasRequiredInfo?: boolean,
  fulfillmentStatus?: string | null,
  financialStatus?: string | null
): { status: UnifiedTrackingStatus; workflowStage: UnifiedWorkflowStage } => {
  const s = (rawStatus || '').trim().toLowerCase();
  const currentStage = (stage || '').trim().toLowerCase();
  const fStatus = (fulfillmentStatus || '').trim().toLowerCase();
  const finStatus = (financialStatus || '').trim().toLowerCase();
  const hasAwb = !!(awbNumber && awbNumber.trim().length > 0);

  // 0. Cancelled or Refunded
  if (
    s.includes('cancelled') || 
    s.includes('canceled') || 
    fStatus.includes('cancelled') || 
    fStatus.includes('canceled') || 
    finStatus === 'refunded' || 
    finStatus === 'voided'
  ) {
    return {
      status: 'Cancelled',
      workflowStage: 'pending' // Excluded from active queue
    };
  }

  // 1. Fulfilled orders (source fulfillment status = 'fulfilled' or stage = 'fulfilled')
  if (currentStage === 'fulfilled' || fStatus === 'fulfilled') {
    const trackingStatus = hasAwb ? resolveTrackingStatus(s, hasAwb) : 'Delivered';
    return {
      status: trackingStatus || 'Delivered',
      workflowStage: 'fulfilled'
    };
  }

  // 2. Explicit stage overrides saved on the record
  if (currentStage === 'prepare_dispatch') {
    return {
      status: 'Pending',
      workflowStage: 'prepare_dispatch'
    };
  }

  if (currentStage === 'dispatched') {
    const trackingStatus = resolveTrackingStatus(s, hasAwb);
    return {
      status: trackingStatus || 'Awaiting Tracking Update',
      workflowStage: 'dispatched'
    };
  }

  // 3. Stage 'tracking'
  if (currentStage === 'tracking') {
    const trackingStatus = resolveTrackingStatus(s, hasAwb);
    return {
      status: trackingStatus || 'Awaiting Tracking Update',
      workflowStage: 'tracking'
    };
  }

  // 4. Status string analysis for dispatched / tracking states
  if (
    s.includes('delivered') ||
    s.includes('in transit') ||
    s.includes('transit') ||
    s.includes('out for delivery') ||
    s.includes('rto') ||
    s.includes('returned') ||
    s.includes('exception') ||
    s.includes('failed attempt')
  ) {
    return {
      status: resolveTrackingStatus(s, hasAwb),
      workflowStage: 'tracking'
    };
  }

  if (s.includes('dispatched')) {
    return {
      status: hasAwb ? 'In Transit' : 'Pending',
      workflowStage: hasAwb ? 'tracking' : 'dispatched'
    };
  }

  // If order has an AWB number, keep courier tracking attached
  if (hasAwb && (currentStage === 'dispatched' || currentStage === 'tracking')) {
    return {
      status: resolveTrackingStatus(s, true),
      workflowStage: 'tracking'
    };
  }

  // 4. Missing required info -> Pending stage
  if (hasRequiredInfo === false) {
    return {
      status: 'Pending',
      workflowStage: 'pending'
    };
  }

  // 5. Default stage: Active (Unfulfilled customer order awaiting dispatch)
  return {
    status: 'Unfulfilled',
    workflowStage: 'active'
  };
};

export const resolveTrackingStatus = (s: string, hasAwb: boolean): UnifiedTrackingStatus => {
  if (s.includes('rto') || s.includes('returned') || s.includes('return to origin')) {
    return 'RTO';
  }
  if (s.includes('delivered')) {
    return 'Delivered';
  }
  if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
    return 'Out for Delivery';
  }
  if (
    s.includes('in transit') ||
    s.includes('transit') ||
    s.includes('processed') ||
    s.includes('forwarded') ||
    s.includes('hub reached')
  ) {
    return 'In Transit';
  }
  if (s.includes('failed attempt') || s.includes('undelivered') || s.includes('attempted')) {
    return 'Failed Attempt';
  }
  if (
    s.includes('exception') ||
    s.includes('error') ||
    s.includes('unable to fetch') ||
    s.includes('sync failed') ||
    s.includes('expired')
  ) {
    return 'Delivery Exception';
  }
  if (s.includes('cancelled') || s.includes('canceled')) {
    return 'Cancelled';
  }
  if (s.includes('awaiting') || s.includes('awaiting tracking update')) {
    return 'Awaiting Tracking Update';
  }
  if (s.includes('booked') || s.includes('info received') || s.includes('manifest')) {
    return 'Info Received';
  }
  return hasAwb ? 'Awaiting Tracking Update' : 'Not Tracked';
};

import { 
  normalizeState, 
  resolveStateFromPincode, 
  parseOrderAmount, 
  normalizeOrderPhone,
  validateCourierAwb,
  isDispatchedOrder
} from '../utils/logisticsOrderUtils';
import { normalizeCourier } from '../config/courierConfig';

/**
 * Transforms a Dexie LogisticsOrder into a Canonical UnifiedLogisticsOrder.
 */
export const fromDexieOrder = (order: LogisticsOrder): UnifiedLogisticsOrder => {
  const cleanedId = cleanOrderId(order.orderId);
  const normalizedPhone = normalizeOrderPhone(order.phoneNumber);
  const customerKey = normalizedPhone || `order_${cleanedId || order.id}`;

  const rawAmt = order.amount !== undefined && order.amount !== null ? String(order.amount).trim() : '';
  const parsedAmt = parseOrderAmount(rawAmt);
  const isAmountKnown = parsedAmt !== null;
  const amount = parsedAmt ?? 0;

  let state = normalizeState(order.state);
  if (!state && order.pincode) {
    state = resolveStateFromPincode(order.pincode);
  }
  const city = (order.city || '').trim().replace(/\b\w/g, c => c.toUpperCase());
  
  // An order has required info if customer name, address/city/pincode, and phone exist
  const hasRequiredInfo = !!(
    (order.customerName && order.customerName.trim().length > 0) &&
    (normalizedPhone.length >= 10) &&
    (order.pincode || order.city || order.address)
  );

  const { status, workflowStage } = mapToUnifiedWorkflowStage(
    order.status,
    order.stage,
    order.awbNumber,
    hasRequiredInfo,
    order.fulfillmentStatus,
    order.financialStatus
  );

  const parsedOrderDate = parseAndFormatLogisticsDate(order.orderDate || order.uploadedAt);
  const parsedDispatchDate = parseAndFormatLogisticsDate(order.dispatchDate);
  const parsedEstDeliveryDate = parseAndFormatLogisticsDate(order.estimatedDeliveryDate);
  const parsedDeliveredDate = parseAndFormatLogisticsDate(order.deliveredDate);

  const productsSummary = order.products && order.products.trim() ? order.products.trim() : 'Standard Products';

  return {
    id: `dexie_${order.id || cleanedId}`,
    rawId: order.id,
    orderId: cleanedId,
    displayOrderId: `#${cleanedId}`,
    source: 'upload',
    customerKey,
    customerName: order.customerName || 'Customer',
    phoneNumber: normalizedPhone || (order.phoneNumber ? String(order.phoneNumber).trim() : ''),
    phone: normalizedPhone || (order.phoneNumber ? String(order.phoneNumber).trim() : ''),
    rawPhoneNumber: order.phoneNumber ? String(order.phoneNumber).trim() : undefined,
    address: order.address || '',
    shippingAddress: order.address || '',
    city: city,
    shippingCity: city,
    state: state,
    shippingState: state,
    pincode: order.pincode || '',
    orderDate: parsedOrderDate.isoDate || order.orderDate || '',
    orderDateDisplay: parsedOrderDate.displayDate || order.orderDateDisplay || '',
    orderType: order.orderType || 'Prepaid',
    amount: amount,
    totalAmount: amount,
    isAmountKnown: isAmountKnown,
    products: productsSummary,
    productSummary: productsSummary,
    totalQuantity: 1,
    courier: order.courier || '',
    awbNumber: order.awbNumber || '',
    dispatchDate: parsedDispatchDate.displayDate || order.dispatchDate || '',
    estimatedDeliveryDate: parsedEstDeliveryDate.displayDate || order.estimatedDeliveryDate || '',
    deliveredDate: parsedDeliveredDate.displayDate || order.deliveredDate || '',
    remarks: order.remarks || order.lastEvent || order.sourceStatus || order.sourceSubStatus,
    batchId: order.batchId,
    batchName: order.batchName,
    fulfillmentStatus: order.fulfillmentStatus,
    sourceFulfillmentStatus: order.fulfillmentStatus || order.sourceFulfillmentStatus,
    fulfilledDate: order.fulfilledDate || (order.fulfillmentStatus === 'fulfilled' ? (parsedDispatchDate.displayDate || parsedOrderDate.displayDate) : undefined),
    isSourceFulfilled: (order.fulfillmentStatus || '').toLowerCase() === 'fulfilled' || order.stage === 'fulfilled',
    financialStatus: order.financialStatus,
    stage: order.stage || 'order_data',
    workflowStage,
    status,
    rawStatus: order.status,
    lastEvent: order.lastEvent,
    syncedAt: order.syncedAt,
    trackingError: order.trackingError,
    syncState: order.syncState || 'idle',
    archivedAt: order.archivedAt,
    archiveReason: order.archiveReason,
    isArchived: order.stage === 'archived_legacy',
    cancellationStatus: order.cancellationStatus,
    cancellationReason: order.cancellationReason,
    cancellationNotes: order.cancellationNotes,
    cancellationRequestedAt: order.cancellationRequestedAt,
    cancellationRequestedBy: order.cancellationRequestedBy,
    cancellationConfirmedAt: order.cancellationConfirmedAt,
    cancellationConfirmedBy: order.cancellationConfirmedBy,
    cancellationDate: order.cancellationDate || order.cancellationRequestedAt,
    previousShipmentStatus: order.previousShipmentStatus,
    cancellation: order.cancellation,
    remarks: order.remarks || order.lastEvent || order.sourceStatus || order.sourceSubStatus
  };
};

/**
 * Resets the Logistics Department Data cleanly.
 * Clears:
 * 1. db.logistics_orders (Dexie customer shipment/order records)
 * 2. db.logistics_imports (imported spreadsheet tracking history)
 * 3. db.tracking_logs (courier sync logs)
 * 4. db.historical_delivery_data & db.delivery_history (associated historical delivery data)
 *
 * CRITICAL SAFETY: Does NOT touch any Supabase tables (influencers, campaigns, finance, users, etc.)!
 */
export const resetLogisticsDepartmentData = async (): Promise<{ success: boolean; clearedCount: number; error?: string }> => {
  try {
    let clearedCount = 0;
    await db.transaction(
      'rw',
      [
        db.logistics_orders,
        db.logistics_imports,
        db.tracking_logs,
        db.historical_delivery_data,
        db.delivery_history
      ],
      async () => {
        clearedCount = await db.logistics_orders.count();
        await db.logistics_orders.clear();
        await db.logistics_imports.clear();
        await db.tracking_logs.clear();
        await db.historical_delivery_data.clear();
        await db.delivery_history.clear();
      }
    );

    // Clear any local session storage caches for logistics tracking search/status
    try {
      sessionStorage.removeItem('logistics_search');
      sessionStorage.removeItem('logistics_status');
    } catch {}

    return { success: true, clearedCount };
  } catch (err: any) {
    console.error('Failed to reset logistics department data:', err);
    return { success: false, clearedCount: 0, error: err.message || 'Database transaction error' };
  }
};

/**
 * Aggregates a list of unified orders into unique canonical customers.
 * Critical: Grouping is strictly by normalized phone number (or customerKey fallback).
 * Never merge customers on name alone!
 */
export const groupOrdersIntoCustomers = (orders: UnifiedLogisticsOrder[]): UnifiedCustomer[] => {
  const map = new Map<string, UnifiedCustomer>();

  for (const order of orders) {
    const key = order.customerKey;
    if (!key) continue;

    let customer = map.get(key);
    if (!customer) {
      customer = {
        customerKey: key,
        name: order.customerName,
        phoneNumber: order.phoneNumber,
        city: order.city || '',
        state: order.state || '',
        pincode: order.pincode || '',
        address: order.address || '',
        totalOrders: 0,
        totalSpent: 0,
        deliveredOrders: 0,
        activeOrders: 0,
        exceptionOrders: 0,
        latestOrderId: order.orderId,
        latestOrderDate: order.orderDate,
        latestStatus: order.status,
        orders: []
      };
      map.set(key, customer);
    }

    customer.orders.push(order);
    customer.totalOrders += 1;

    if (order.status !== 'Cancelled') {
      customer.totalSpent += order.amount;
    }

    if (order.status === 'Delivered') {
      customer.deliveredOrders += 1;
    } else if (order.status === 'Delivery Exception' || order.status === 'Failed Attempt' || order.status === 'RTO') {
      customer.exceptionOrders += 1;
    } else {
      customer.activeOrders += 1;
    }

    if (!customer.city && order.city) customer.city = order.city;
    if (!customer.state && order.state) customer.state = order.state;
    if (!customer.pincode && order.pincode) customer.pincode = order.pincode;
    if (!customer.address && order.address) customer.address = order.address;
    if (customer.name === 'Customer' && order.customerName && order.customerName !== 'Customer') {
      customer.name = order.customerName;
    }
  }

  const customers = Array.from(map.values()).map(c => {
    c.orders.sort((a, b) => {
      const dateA = new Date(a.orderDate || 0).getTime();
      const dateB = new Date(b.orderDate || 0).getTime();
      return dateB - dateA;
    });

    if (c.orders.length > 0) {
      c.latestOrderId = c.orders[0].orderId;
      c.latestOrderDate = c.orders[0].orderDate;
      c.latestStatus = c.orders[0].status;
    }

    return c;
  });

  return customers.sort((a, b) => b.totalOrders - a.totalOrders || b.totalSpent - a.totalSpent);
};

/**
 * Calculates toolbar stage counts matching Influencer Logistics:
 * [ Active ] [ Pending ] [ Prepare Dispatch ] [ Dispatched ] [ Tracking ]
 */
export const calculateWorkflowCounts = (
  orders: UnifiedLogisticsOrder[],
  customers: UnifiedCustomer[] = []
): WorkflowStageCounts => {
  let active = 0;
  let fulfilled = 0;
  let pending = 0;
  let prepareDispatch = 0;
  let dispatched = 0;
  let tracking = 0;
  let archived = 0;

  for (const o of orders) {
    if (o.stage === 'trash') continue;
    if (o.stage === 'archived_legacy') {
      archived++;
      continue;
    }

    if (o.workflowStage === 'fulfilled' || o.sourceFulfillmentStatus === 'fulfilled' || o.stage === 'fulfilled') {
      fulfilled++;
    } else if (o.workflowStage === 'active') {
      active++;
    } else if (o.workflowStage === 'pending') {
      pending++;
    } else if (o.workflowStage === 'prepare_dispatch') {
      prepareDispatch++;
    }

    // Both Dispatched and Tracking views represent all canonical dispatched shipments
    if (isDispatchedOrder(o)) {
      dispatched++;
      tracking++;
    }
  }

  const operationalCount = orders.filter(o => o.stage !== 'trash' && o.stage !== 'archived_legacy').length;

  return {
    active,
    fulfilled,
    pending,
    prepareDispatch,
    dispatched,
    tracking,
    archived,
    totalOrders: operationalCount,
    totalCustomers: customers.length,
    analytics: operationalCount
  };
};

/**
 * Bulk moves orders from Active to Prepare Dispatch in Dexie
 */
export const bulkMoveToPrepareDispatch = async (
  rawOrderIds: (number | string)[],
  batchInfo?: { batchId?: string; batchName?: string }
): Promise<{ success: boolean; movedCount: number; errors: string[] }> => {
  const errors: string[] = [];
  let movedCount = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const batchId = batchInfo?.batchId || `batch_${Date.now()}`;
  const batchName = batchInfo?.batchName || `Batch ${dateStr}`;

  try {
    await db.transaction('rw', db.logistics_orders, async () => {
      for (const rawId of rawOrderIds) {
        let ord: LogisticsOrder | undefined;

        if (typeof rawId === 'number') {
          ord = await db.logistics_orders.get(rawId);
        } else {
          const numId = Number(String(rawId).replace('dexie_', ''));
          if (!isNaN(numId) && numId > 0) {
            ord = await db.logistics_orders.get(numId);
          }
          if (!ord) {
            const cleanId = cleanOrderId(String(rawId));
            ord = await db.logistics_orders.where('orderId').equals(cleanId).first();
          }
        }

        if (!ord || !ord.id) {
          errors.push(`Order ID #${rawId} not found`);
          continue;
        }

        // Validate eligibility: exclude cancelled or already dispatched/tracking orders
        if (ord.stage === 'tracking' || ord.stage === 'dispatched') {
          errors.push(`Order #${ord.orderId} is already dispatched or in tracking`);
          continue;
        }

        const fStatus = (ord.fulfillmentStatus || '').toLowerCase();
        const curStatus = (ord.status || '').toLowerCase();
        if (fStatus === 'cancelled' || curStatus === 'cancelled') {
          errors.push(`Order #${ord.orderId} is cancelled`);
          continue;
        }

        // Update stage to prepare_dispatch with batch grouping metadata
        await db.logistics_orders.update(ord.id, {
          stage: 'prepare_dispatch' as any,
          batchId: ord.batchId || batchId,
          batchName: ord.batchName || batchName
        });
        movedCount++;
      }
    });

    return {
      success: movedCount > 0,
      movedCount,
      errors
    };
  } catch (err: any) {
    return {
      success: false,
      movedCount,
      errors: [err.message || 'Transaction error moving orders to Prepare Dispatch']
    };
  }
};

export interface DispatchOrderPayload {
  rawId: number;
  courier: string;
  awbNumber: string;
  dispatchDate?: string;
  dispatchTime?: string;
  estimatedDeliveryDate?: string;
  batchId?: string;
  batchName?: string;
}

/**
 * Executes dispatch for a single order idempotently.
 * 1. Validates courier and AWB format
 * 2. Updates local Dexie database (stage: 'dispatched', status: 'Awaiting Tracking Update')
 * 3. Upserts canonical shipment record to Supabase customer_tracking_shipments
 * 4. Updates Supabase sales_orders dispatch_status
 */
export const executeDispatchOrder = async (
  payload: DispatchOrderPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    const ord = await db.logistics_orders.get(payload.rawId);
    if (!ord) {
      return { success: false, error: 'Order not found in database' };
    }

    // 1. Validate courier & AWB
    const val = validateCourierAwb(payload.courier, payload.awbNumber);
    if (!val.valid) {
      return { success: false, error: val.error };
    }

    const cleanAwb = payload.awbNumber.trim();
    const normalizedCourier = normalizeCourier(payload.courier);
    const nowIso = new Date().toISOString();
    const dDate = payload.dispatchDate || nowIso.slice(0, 10);

    // 2. Update local Dexie record idempotently
    await db.logistics_orders.update(payload.rawId, {
      courier: normalizedCourier,
      awbNumber: cleanAwb,
      stage: 'dispatched' as any,
      status: 'Awaiting Tracking Update',
      dispatchDate: dDate,
      estimatedDeliveryDate: payload.estimatedDeliveryDate || ord.estimatedDeliveryDate,
      batchId: payload.batchId || ord.batchId,
      batchName: payload.batchName || ord.batchName,
      syncedAt: nowIso
    });

    // 3. Upsert canonical shipment record to Supabase customer_tracking_shipments
    const cleanedId = cleanOrderId(ord.orderId);
    try {
      await supabase.from('customer_tracking_shipments').upsert({
        order_id: cleanedId,
        display_order_id: `#${cleanedId}`,
        awb_number: cleanAwb,
        courier: normalizedCourier,
        status: 'Awaiting Tracking Update',
        raw_status: 'DISPATCHED',
        status_source: 'DISPATCH_WORKFLOW',
        source_type: 'CUSTOMER_ORDER',
        dispatch_date: dDate,
        estimated_delivery_date: payload.estimatedDeliveryDate || ord.estimatedDeliveryDate || null,
        customer_name: ord.customerName || 'Customer',
        phone_number: ord.phoneNumber || '',
        address: ord.address || '',
        state: ord.state || '',
        city: ord.city || '',
        pincode: ord.pincode || '',
        products: ord.products || '',
        amount: parseOrderAmount(ord.amount) || 0,
        order_type: ord.orderType || 'Prepaid',
        batch_id: payload.batchId || ord.batchId || null,
        batch_name: payload.batchName || ord.batchName || null,
        updated_at: nowIso
      }, { onConflict: 'courier,awb_number' });
    } catch (sbErr) {
      console.warn('Supabase customer_tracking_shipments upsert warning:', sbErr);
    }

    // 4. Update Supabase sales_orders dispatch_status if matching order exists
    try {
      await supabase.from('sales_orders').update({
        dispatch_status: 'DISPATCHED',
        dispatch_date: dDate,
        updated_at: nowIso
      }).eq('order_id', cleanedId);
    } catch (soErr) {
      console.warn('Supabase sales_orders update warning:', soErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to complete dispatch' };
  }
};

/**
 * Bulk executes dispatch for multiple orders.
 */
export const executeBulkDispatchOrders = async (
  items: Array<{ rawId: number; courier: string; awbNumber: string; batchId?: string; batchName?: string }>
): Promise<{ success: boolean; dispatchedCount: number; errors: string[] }> => {
  const errors: string[] = [];
  let dispatchedCount = 0;

  for (const item of items) {
    const res = await executeDispatchOrder(item);
    if (res.success) {
      dispatchedCount++;
    } else {
      errors.push(`Order ID ${item.rawId}: ${res.error}`);
    }
  }

  return {
    success: dispatchedCount > 0,
    dispatchedCount,
    errors
  };
};

/**
 * Backward compatibility alias for single confirm dispatch.
 */
export const confirmOrderDispatch = async (payload: {
  rawId: number;
  courier: string;
  awbNumber: string;
  dispatchDate?: string;
  estimatedDeliveryDate?: string;
  batchId?: string;
  batchName?: string;
}): Promise<{ success: boolean; error?: string }> => {
  return executeDispatchOrder(payload);
};

/**
 * Return orders back from Prepare Dispatch to Active
 */
export const returnToActiveStage = async (rawIds: number[] | number): Promise<boolean> => {
  const ids = Array.isArray(rawIds) ? rawIds : [rawIds];
  try {
    await db.transaction('rw', db.logistics_orders, async () => {
      for (const id of ids) {
        await db.logistics_orders.update(id, {
          stage: 'order_data' as any,
          batchId: undefined,
          batchName: undefined
        });
      }
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Result of Sales-to-Logistics order synchronization
 */
export interface SalesLogisticsSyncResult {
  insertedCount: number;
  updatedCount: number;
  activeCount: number;
  fulfilledCount: number;
  pendingCount: number;
  preservedWorkflowCount: number;
  skippedDeletedCount?: number;
}

/**
 * Synchronizes orders uploaded via the Sales Department into Dexie Logistics DB.
 * Implements strict, idempotent workflow stage routing:
 * - Genuinely unfulfilled eligible orders -> Active
 * - Source fulfilled orders (e.g. fulfilled outside Logistics or in Shopify) -> Fulfilled
 * - Orders lacking required info -> Pending
 * - Existing orders in prepare_dispatch, dispatched, or tracking are PRESERVED and never reset to Active
 * - Couriers, AWBs, and tracking data are safely preserved
 */
export const syncSalesUploadToLogistics = async (
  consolidatedOrders: any[]
): Promise<SalesLogisticsSyncResult> => {
  if (!consolidatedOrders || consolidatedOrders.length === 0) {
    return {
      insertedCount: 0,
      updatedCount: 0,
      activeCount: 0,
      fulfilledCount: 0,
      pendingCount: 0,
      preservedWorkflowCount: 0
    };
  }

  const existingRecords = await db.logistics_orders.toArray();
  const existingMap = new Map<string, LogisticsOrder>();
  existingRecords.forEach(rec => {
    const cid = cleanOrderId(rec.orderId);
    if (cid) existingMap.set(cid.toLowerCase(), rec);
  });

  let insertedCount = 0;
  let updatedCount = 0;
  let activeCount = 0;
  let fulfilledCount = 0;
  let pendingCount = 0;
  let preservedWorkflowCount = 0;
  let skippedDeletedCount = 0;

  const toAdd: LogisticsOrder[] = [];
  const toPut: LogisticsOrder[] = [];

  for (const order of consolidatedOrders) {
    const cleanId = cleanOrderId(order.order_id);
    if (!cleanId) continue;
    const lowerId = cleanId.toLowerCase();
    const existing = existingMap.get(lowerId);

    const fStatus = (order.fulfillment_status || '').toLowerCase().trim();
    const isFulfilled = fStatus === 'fulfilled' || fStatus === 'shipped' || fStatus === 'delivered';
    const cleanPhone = normalizePhoneNumber(order.phone);

    const hasRequiredInfo = !!(
      order.customer_name &&
      order.customer_name.trim().length > 0 &&
      order.customer_name !== '-' &&
      order.customer_name !== 'Customer' &&
      cleanPhone.length >= 10 &&
      (order.pincode || order.city || order.address)
    );

    const parsedOrderDate = parseAndFormatLogisticsDate(order.order_date || order.original_order_date);
    const orderDate = parsedOrderDate.isoDate || order.order_date || new Date().toISOString().slice(0, 10);
    const orderDateDisplay = parsedOrderDate.displayDate || orderDate;
    const fulfilledDate = order.fulfilled_date || (isFulfilled ? orderDateDisplay : undefined);

    if (!existing) {
      // CASE 1: Brand new order from Sales
      let stage: 'active' | 'fulfilled' | 'pending' | 'tracking' | 'dispatched' | 'order_data' = 'active';
      let status = 'Unfulfilled';

      const isConfirmedCancelled = order.status === 'Cancelled' || 
                                   order.fulfillment_status === 'cancelled' || 
                                   order.cancellationStatus === 'Completed' ||
                                   (order as any).isCancelled;

      if (isConfirmedCancelled) {
        stage = 'order_data';
        status = 'Cancelled';
      } else if (order.stage === 'tracking' || (order.awb_number && order.stage !== 'active')) {
        stage = 'tracking';
        status = order.status || 'Awaiting Tracking Update';
      } else if (isFulfilled) {
        stage = 'fulfilled';
        status = 'Fulfilled';
        fulfilledCount++;
      } else if (!hasRequiredInfo) {
        stage = 'pending';
        status = 'Pending';
        pendingCount++;
      } else {
        stage = 'active';
        status = 'Unfulfilled';
        activeCount++;
      }

      const newRec: Partial<LogisticsOrder> = {
        orderId: cleanId,
        customerName: order.customer_name && order.customer_name !== '-' ? order.customer_name : 'Customer',
        phoneNumber: cleanPhone || order.phone || '',
        address: order.address && order.address !== '-' ? order.address : '',
        city: order.city && order.city !== '-' ? order.city : '',
        state: order.state && order.state !== '-' ? normalizeState(order.state) : '',
        pincode: order.pincode && order.pincode !== '-' ? order.pincode : '',
        products: order.order_formatted || order.product_name || 'Standard Products',
        amount: String(order.price || '0'),
        orderType: order.payment_mode || 'Prepaid',
        awbNumber: order.awb_number || undefined,
        courier: order.courier ? normalizeCourier(order.courier) : undefined,
        dispatchDate: order.dispatch_date,
        stage,
        status,
        uploadedAt: new Date().toISOString(),
        orderDate,
        orderDateDisplay,
        fulfilledDate,
        fulfillmentStatus: isFulfilled ? 'fulfilled' : 'unfulfilled',
        sourceFulfillmentStatus: isFulfilled ? 'fulfilled' : 'unfulfilled',
        financialStatus: order.financial_status,
        batchId: order.batchId,
        batchName: order.batchName,
        cancellationStatus: order.cancellationStatus,
        cancellationReason: order.cancellationReason,
        cancellationNotes: order.cancellationNotes,
        cancellationRequestedAt: order.cancellationRequestedAt,
        cancellationRequestedBy: order.cancellationRequestedBy,
        cancellationConfirmedAt: order.cancellationConfirmedAt,
        cancellationConfirmedBy: order.cancellationConfirmedBy,
        cancellationDate: order.cancellationDate,
        previousShipmentStatus: order.previousShipmentStatus,
        cancellation: order.cancellation
      };

      toAdd.push(newRec as LogisticsOrder);
      insertedCount++;
    } else {
      // CASE 2: Re-import / existing order in Logistics
      if (existing.stage === 'trash' || existing.status === 'Deleted') {
        // STRICT TOMBSTONE POLICY:
        // Order was deleted from Sales/Logistics. Do NOT silently recreate or resurrect it from a stale CSV upload!
        skippedDeletedCount++;
        continue;
      }

      const patch: Partial<LogisticsOrder> = {};
      const isConfirmedCancelled = order.status === 'Cancelled' || 
                                   order.fulfillment_status === 'cancelled' || 
                                   order.cancellationStatus === 'Completed' ||
                                   (order as any).isCancelled;

      if (isConfirmedCancelled) {
        patch.status = 'Cancelled';
        patch.cancellationStatus = 'Completed';
        patch.fulfillmentStatus = 'cancelled';
        patch.sourceFulfillmentStatus = 'cancelled';
        if (order.cancellationReason) patch.cancellationReason = order.cancellationReason;
        if (order.cancellationNotes) patch.cancellationNotes = order.cancellationNotes;
        if (order.cancellationRequestedAt) patch.cancellationRequestedAt = order.cancellationRequestedAt;
        if (order.cancellationRequestedBy) patch.cancellationRequestedBy = order.cancellationRequestedBy;
        if (order.cancellationConfirmedAt) patch.cancellationConfirmedAt = order.cancellationConfirmedAt;
        if (order.cancellationConfirmedBy) patch.cancellationConfirmedBy = order.cancellationConfirmedBy;
        if (order.cancellationDate) patch.cancellationDate = order.cancellationDate;
        if (order.previousShipmentStatus) patch.previousShipmentStatus = order.previousShipmentStatus;
        if (order.cancellation) patch.cancellation = order.cancellation;
      } else if (existing.status === 'Cancelled' || existing.cancellationStatus === 'Completed') {
        // STRICT RULE: Never revert confirmed cancelled orders back to active!
        patch.status = 'Cancelled';
        patch.cancellationStatus = 'Completed';
      }

      const inWorkflow = existing.stage === 'prepare_dispatch' || 
                         existing.stage === 'dispatched' || 
                         existing.stage === 'tracking';

      if (inWorkflow) {
        // STRICT RULE: Preserve dispatch preparation and tracking stages!
        preservedWorkflowCount++;
      } else if (order.stage === 'tracking' || order.awb_number) {
        patch.stage = 'tracking';
        patch.status = order.status || existing.status || 'Awaiting Tracking Update';
        if (order.awb_number && !existing.awbNumber) patch.awbNumber = order.awb_number;
        if (order.courier && !existing.courier) patch.courier = normalizeCourier(order.courier);
        if (order.dispatch_date && !existing.dispatchDate) patch.dispatchDate = order.dispatch_date;
      } else if (existing.stage === 'fulfilled') {
        patch.stage = 'fulfilled';
        patch.status = 'Fulfilled';
      } else if (isFulfilled) {
        patch.stage = 'fulfilled';
        patch.status = 'Fulfilled';
        patch.fulfillmentStatus = 'fulfilled';
        patch.sourceFulfillmentStatus = 'fulfilled';
        if (!existing.fulfilledDate) patch.fulfilledDate = fulfilledDate;
        fulfilledCount++;
      } else if (existing.stage === 'pending' && hasRequiredInfo) {
        patch.stage = 'active';
        patch.status = 'Unfulfilled';
        activeCount++;
      }

      // Safe field updates: never overwrite valid existing values with blanks/empty
      if (order.customer_name && order.customer_name !== '-' && order.customer_name !== 'Customer') {
        patch.customerName = order.customer_name;
      }
      if (cleanPhone && cleanPhone.length >= 10) {
        patch.phoneNumber = cleanPhone;
      }
      if (order.address && order.address !== '-') {
        patch.address = order.address;
      }
      if (order.city && order.city !== '-') {
        patch.city = order.city;
      }
      if (order.state && order.state !== '-') {
        patch.state = normalizeState(order.state);
      }
      if (order.pincode && order.pincode !== '-') {
        patch.pincode = order.pincode;
      }
      if (order.order_formatted || order.product_name) {
        patch.products = order.order_formatted || order.product_name;
      }
      if (order.price && Number(order.price) > 0) {
        patch.amount = String(order.price);
      }
      if (order.payment_mode) {
        patch.orderType = order.payment_mode;
      }
      if (order.financial_status) {
        patch.financialStatus = order.financial_status;
      }

      // Preserve courier/AWB if already set in Logistics; only attach incoming AWB if existing had none
      if (!existing.awbNumber && order.awb_number) {
        patch.awbNumber = order.awb_number;
        if (order.courier) patch.courier = normalizeCourier(order.courier);
      }

      if (Object.keys(patch).length > 0 && existing.id) {
        toPut.push({ ...existing, ...patch });
        updatedCount++;
      }
    }
  }

  // High-performance chunked bulk writes (avoids browser transaction timeout on large order sets)
  const CHUNK_SIZE = 500;
  for (let i = 0; i < toAdd.length; i += CHUNK_SIZE) {
    await db.logistics_orders.bulkAdd(toAdd.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < toPut.length; i += CHUNK_SIZE) {
    await db.logistics_orders.bulkPut(toPut.slice(i, i + CHUNK_SIZE));
  }

  // Dispatch custom window event so any mounted Logistics views re-check or update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('velmora:sales_orders_synced', {
      detail: { insertedCount, updatedCount, activeCount, fulfilledCount, preservedWorkflowCount, skippedDeletedCount, timestamp: Date.now() }
    }));
  }

  return {
    insertedCount,
    updatedCount,
    activeCount,
    fulfilledCount,
    pendingCount,
    preservedWorkflowCount,
    skippedDeletedCount
  };
};

/**
 * Automatically synchronizes all canonical website orders from Supabase sales_orders
 * into the local Dexie db.logistics_orders table.
 * Guarantees that any order imported in Sales is reflected in Logistics, even after
 * browser refresh, sign-in, or multi-device access.
 * Safely excludes deleted orders and synchronizes deletions to Dexie.
 */
export const syncSalesOrdersFromSupabase = async (): Promise<SalesLogisticsSyncResult> => {
  try {
    let allSalesOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, order_id, order_date, customer_name, phone, state, city, pincode, order_total, payment_mode, order_status, dispatch_status, dispatch_date, extra_data')
        .eq('channel', 'WEBSITE')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !data || data.length === 0) break;
      allSalesOrders = allSalesOrders.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    }

    // Fetch all customer tracking shipments from Supabase (paginated) to merge tracking states & AWBs
    let shipmentsData: any[] = [];
    let sPage = 0;
    const sPageSize = 1000;
    let sHasMore = true;

    while (sHasMore) {
      const { data: sData, error: sErr } = await supabase
        .from('customer_tracking_shipments')
        .select('*')
        .range(sPage * sPageSize, (sPage + 1) * sPageSize - 1);

      if (sErr || !sData || sData.length === 0) break;
      shipmentsData = shipmentsData.concat(sData);
      if (sData.length < sPageSize) sHasMore = false;
      else sPage++;
    }

    if (allSalesOrders.length === 0 && shipmentsData.length === 0) {
      return {
        insertedCount: 0,
        updatedCount: 0,
        activeCount: 0,
        fulfilledCount: 0,
        pendingCount: 0,
        preservedWorkflowCount: 0,
        skippedDeletedCount: 0
      };
    }

    // Separate active canonical orders from deleted/tombstoned orders
    const activeSalesOrders = allSalesOrders.filter(so => 
      so.order_status !== 'DELETED' && !so.extra_data?.is_deleted
    );
    const deletedSalesOrders = allSalesOrders.filter(so => 
      so.order_status === 'DELETED' || so.extra_data?.is_deleted
    );

    // If any order in Dexie was deleted in Supabase, mark its stage as 'trash'
    if (deletedSalesOrders.length > 0) {
      const deletedSet = new Set(deletedSalesOrders.map(so => cleanOrderId(so.order_id).toLowerCase()));
      const dexieAll = await db.logistics_orders.toArray();
      for (const rec of dexieAll) {
        if (rec.id && rec.stage !== 'trash' && deletedSet.has(cleanOrderId(rec.orderId).toLowerCase())) {
          await db.logistics_orders.update(rec.id, {
            stage: 'trash',
            status: 'Deleted',
            deletedAt: new Date().toISOString(),
            trashReason: 'Deleted from Sales'
          });
        }
      }
    }
    
    const shipmentMap = new Map<string, any>();
    (shipmentsData || []).forEach(s => {
      const cId = cleanOrderId(s.order_id || s.display_order_id).toLowerCase();
      if (cId) shipmentMap.set(cId, s);
    });

    const transformedSales = activeSalesOrders.map(so => {
      const cleanId = cleanOrderId(so.order_id).toLowerCase();
      const existingShipment = shipmentMap.get(cleanId);
      const extra = so.extra_data || {};

      const cData = extra.cancellation || {};
      const isConfirmedCancelled = so.order_status === 'CANCELLED' || 
                                   cData.status === 'CANCELLED' || 
                                   extra.fulfillment_status === 'cancelled';
      const isPendingCancellation = cData.status === 'PENDING_LOGISTICS_APPROVAL';

      const hasShipment = !!existingShipment;
      const isDispatched = !isConfirmedCancelled && (hasShipment || (so.dispatch_status === 'DISPATCHED' && !!extra.awb_number));
      const isFulfilled = !isConfirmedCancelled && !isDispatched && (
        extra.fulfillment_status === 'fulfilled' ||
        extra.fulfillment_status === 'shipped' ||
        so.order_status === 'FULFILLED' ||
        so.dispatch_status === 'DELIVERED'
      );

      const fStatus = isConfirmedCancelled 
        ? 'cancelled' 
        : (isFulfilled ? 'fulfilled' : (isDispatched ? 'dispatched' : 'unfulfilled'));

      const status = isConfirmedCancelled 
        ? 'Cancelled' 
        : (existingShipment?.status || (isDispatched ? 'Awaiting Tracking Update' : (isFulfilled ? 'Fulfilled' : 'Unfulfilled')));

      const stage = isConfirmedCancelled
        ? 'order_data'
        : (isDispatched ? 'tracking' : (isFulfilled ? 'fulfilled' : undefined));

      const cancellationStatus = isConfirmedCancelled 
        ? 'Completed' 
        : (isPendingCancellation ? 'Requested' : undefined);

      return {
        order_id: so.order_id,
        customer_name: so.customer_name,
        phone: so.phone,
        address: extra.address || (existingShipment?.address) || '',
        city: so.city,
        state: so.state,
        pincode: so.pincode,
        order_formatted: extra.order_formatted,
        product_name: extra.product_name,
        price: Number(so.order_total) || 0,
        payment_mode: so.payment_mode,
        order_date: so.order_date,
        fulfillment_status: fStatus,
        financial_status: extra.financial_status,
        awb_number: existingShipment?.awb_number || extra.awb_number,
        courier: existingShipment?.courier || extra.courier,
        stage,
        status,
        dispatch_date: existingShipment?.dispatch_date || (isDispatched ? so.dispatch_date : undefined),
        fulfilled_date: extra.fulfilled_date || (isFulfilled ? so.order_date : undefined),
        batchId: so.upload_id,
        cancellationStatus,
        cancellationReason: cData.reason || (isConfirmedCancelled ? 'Cancelled in source export' : undefined),
        cancellationNotes: cData.notes || extra.cancellation_notes,
        cancellationRequestedAt: cData.requested_at || cData.cancelled_at || so.updated_at,
        cancellationRequestedBy: cData.requested_by || 'Sales',
        cancellationConfirmedAt: cData.confirmed_at || cData.cancelled_at,
        cancellationConfirmedBy: cData.confirmed_by || 'Source System',
        cancellationDate: cData.cancelled_at || cData.confirmed_at || so.updated_at,
        previousShipmentStatus: cData.previous_shipment_status || (hasShipment ? 'Dispatched' : 'Not manifested'),
        cancellation: cData
      };
    });

    // Also include shipments from customer_tracking_shipments whose order_id is not already present
    const salesOrderIdSet = new Set(activeSalesOrders.map(so => cleanOrderId(so.order_id).toLowerCase()));
    const shipmentOrders = (shipmentsData || [])
      .filter(s => {
        const cId = cleanOrderId(s.order_id || s.display_order_id).toLowerCase();
        return cId && !salesOrderIdSet.has(cId);
      })
      .map(s => {
        const cId = cleanOrderId(s.order_id || s.display_order_id);
        const st = (s.status || '').toLowerCase();
        const rawSt = (s.raw_status || '').toLowerCase();
        const isConfirmedCancelled = st === 'cancelled' || rawSt === 'cancelled';
        const isDelivered = st.includes('delivered');
        const isRto = st.includes('rto');
        const isDispatched = !isConfirmedCancelled && (!!s.awb_number || s.status === 'In Transit' || s.status === 'Out for Delivery' || s.status === 'Awaiting Tracking Update' || isDelivered || isRto);

        const fStatus = isConfirmedCancelled ? 'cancelled' : (isDelivered ? 'fulfilled' : (isDispatched ? 'dispatched' : 'unfulfilled'));
        const stage = isConfirmedCancelled ? 'order_data' : (isDispatched ? 'tracking' : 'order_data');
        const cancellationStatus = isConfirmedCancelled ? 'Completed' : undefined;

        return {
          order_id: cId,
          customer_name: s.customer_name || 'Customer',
          phone: s.phone_number || '',
          address: s.address || '',
          city: s.city || '',
          state: s.state || '',
          pincode: s.pincode || '',
          order_formatted: s.display_order_id || `#${cId}`,
          product_name: s.products || 'Standard Products',
          price: Number(s.amount) || 0,
          payment_mode: s.order_type || 'Prepaid',
          order_date: s.dispatch_date || s.created_at || '',
          fulfillment_status: fStatus,
          financial_status: 'Paid',
          awb_number: s.awb_number || '',
          courier: s.courier || '',
          stage,
          status: s.status || (isConfirmedCancelled ? 'Cancelled' : 'In Transit'),
          dispatch_date: s.dispatch_date,
          fulfilled_date: s.delivered_date || (isDelivered ? s.dispatch_date : undefined),
          batchId: s.batch_id,
          batchName: s.batch_name,
          cancellationStatus,
          cancellationReason: isConfirmedCancelled ? (s.remarks || 'Cancelled order') : undefined,
          cancellationNotes: isConfirmedCancelled ? s.remarks : undefined,
          cancellationRequestedAt: isConfirmedCancelled ? (s.updated_at || s.created_at) : undefined,
          cancellationRequestedBy: 'Logistics',
          cancellationConfirmedAt: isConfirmedCancelled ? (s.updated_at || s.created_at) : undefined,
          cancellationConfirmedBy: 'Logistics',
          cancellationDate: isConfirmedCancelled ? (s.updated_at || s.created_at) : undefined,
          previousShipmentStatus: isConfirmedCancelled ? (s.awb_number ? 'Dispatched' : 'Pending AWB') : undefined,
          cancellation: isConfirmedCancelled ? {
            status: 'CANCELLED',
            reason: s.remarks || 'Cancelled order',
            cancelled_at: s.updated_at || s.created_at,
            confirmed_at: s.updated_at || s.created_at
          } : undefined
        };
      });

    const transformed = [...transformedSales, ...shipmentOrders];

    return await syncSalesUploadToLogistics(transformed);
  } catch (err) {
    console.warn('syncSalesOrdersFromSupabase warning:', err);
    return {
      insertedCount: 0,
      updatedCount: 0,
      activeCount: 0,
      fulfilledCount: 0,
      pendingCount: 0,
      preservedWorkflowCount: 0,
      skippedDeletedCount: 0
    };
  }
};

/**
 * Deletes or marks as tombstone an order in the Logistics Dexie database by canonical order ID.
 * Excludes it from all operational views (Active, Fulfilled, Pending, Prepare Dispatch, Dispatched, Tracking, Analytics).
 * If the order was already dispatched, retains shipment audit history while removing it from operational lists.
 */
export const deleteLogisticsOrderByOrderId = async (
  orderId: string,
  reason = 'Deleted from Sales'
): Promise<{ success: boolean; count: number; wasDispatched: boolean }> => {
  const cleanId = cleanOrderId(orderId);
  const lowerClean = cleanId.toLowerCase();
  let wasDispatched = false;
  let count = 0;

  await db.transaction('rw', db.logistics_orders, async () => {
    const all = await db.logistics_orders.toArray();
    const matches = all.filter(o => {
      const c = cleanOrderId(o.orderId).toLowerCase();
      return c === lowerClean || o.orderId === orderId || o.orderId === `#${cleanId}`;
    });

    for (const m of matches) {
      if (!m.id) continue;
      count++;
      if (m.stage === 'dispatched' || m.stage === 'tracking' || !!m.awbNumber) {
        wasDispatched = true;
      }

      // Transition to stage: 'trash' (tombstone) so it immediately leaves operational views and Analytics
      await db.logistics_orders.update(m.id, {
        stage: 'trash',
        status: 'Deleted',
        deletedAt: new Date().toISOString(),
        trashReason: reason,
        remarks: `Order deleted from Sales (${new Date().toLocaleDateString('en-IN')})`
      });
    }
  });

  // Update Supabase customer_tracking_shipments if present
  try {
    await supabase
      .from('customer_tracking_shipments')
      .update({
        status: 'Order Deleted',
        raw_status: 'DELETED',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', cleanId);
  } catch (e) {
    console.warn('customer_tracking_shipments update note:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('velmora:sales_order_deleted', {
      detail: { orderId: cleanId, wasDispatched, timestamp: Date.now() }
    }));
  }

  return { success: true, count, wasDispatched };
};

/**
 * Deletes or trashes all orders in Logistics associated with an upload batch ID.
 */
export const deleteLogisticsOrdersByBatchId = async (
  batchId: string,
  orderIds: string[] = []
): Promise<{ success: boolean; count: number }> => {
  let count = 0;
  const cleanIds = new Set(orderIds.map(id => cleanOrderId(id).toLowerCase()));

  await db.transaction('rw', db.logistics_orders, async () => {
    const all = await db.logistics_orders.toArray();
    const matches = all.filter(o => 
      o.batchId === batchId || 
      (cleanIds.size > 0 && cleanIds.has(cleanOrderId(o.orderId).toLowerCase()))
    );

    for (const m of matches) {
      if (!m.id) continue;
      count++;
      await db.logistics_orders.update(m.id, {
        stage: 'trash',
        status: 'Deleted',
        deletedAt: new Date().toISOString(),
        trashReason: `Upload batch ${batchId} deleted from Sales`
      });
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('velmora:sales_batch_deleted', {
      detail: { batchId, timestamp: Date.now() }
    }));
  }

  return { success: true, count };
};

/**
 * Fetches Shopify website orders from Supabase (read-only query)
 */
export const fetchShopifyOrders = async (limit = 150): Promise<UnifiedLogisticsOrder[]> => {
  try {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('id, order_id, customer_name, phone, state, city, pincode, order_total, payment_mode, order_status, dispatch_status, order_date, channel')
      .order('order_date', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.warn('Error fetching Shopify sales_orders:', error);
      return [];
    }

    return data.map(so => {
      const cleanedId = cleanOrderId(so.order_id);
      const normalizedPhone = normalizePhoneNumber(so.phone);
      const customerKey = normalizedPhone || `shopify_${cleanedId || so.id}`;
      const { status, workflowStage } = mapToUnifiedWorkflowStage(
        so.dispatch_status || so.order_status,
        'order_data',
        null,
        true
      );

      return {
        id: `shopify_${so.id}`,
        supabaseId: so.id,
        orderId: cleanedId,
        displayOrderId: `#${cleanedId}`,
        source: 'shopify',
        customerKey,
        customerName: so.customer_name || 'Website Customer',
        phoneNumber: normalizedPhone || so.phone || '',
        rawPhoneNumber: so.phone,
        address: '',
        city: so.city || '',
        state: so.state || '',
        pincode: so.pincode || '',
        orderDate: so.order_date || '',
        orderDateDisplay: so.order_date || '',
        orderType: so.payment_mode || 'Prepaid',
        amount: Number(so.order_total) || 0,
        products: 'Website Order Items',
        stage: 'order_data',
        workflowStage,
        status,
        rawStatus: so.dispatch_status || so.order_status
      };
    });
  } catch (err) {
    console.error('fetchShopifyOrders exception:', err);
    return [];
  }
};
