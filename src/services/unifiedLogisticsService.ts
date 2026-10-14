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

  // 1. Explicit stage overrides saved on the record
  if (currentStage === 'prepare_dispatch') {
    return {
      status: 'Pending',
      workflowStage: 'prepare_dispatch'
    };
  }

  if (currentStage === 'dispatched') {
    const trackingStatus = resolveTrackingStatus(s, hasAwb);
    return {
      status: trackingStatus,
      workflowStage: hasAwb ? 'tracking' : 'dispatched'
    };
  }

  // 2. Stage 'tracking' or already fulfilled from Shopify
  if (currentStage === 'tracking' || fStatus === 'fulfilled' || fStatus === 'shipped') {
    const trackingStatus = resolveTrackingStatus(s, hasAwb);
    return {
      status: trackingStatus,
      workflowStage: 'tracking'
    };
  }

  // 3. Status string analysis for dispatched / tracking states
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

  // If order has an AWB number, it is already assigned to a shipment/tracking
  if (hasAwb) {
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
  if (s.includes('booked') || s.includes('info received') || s.includes('manifest')) {
    return 'Info Received';
  }
  return hasAwb ? 'Pending' : 'Not Tracked';
};

/**
 * Transforms a Dexie LogisticsOrder into a Canonical UnifiedLogisticsOrder.
 */
export const fromDexieOrder = (order: LogisticsOrder): UnifiedLogisticsOrder => {
  const cleanedId = cleanOrderId(order.orderId);
  const normalizedPhone = normalizePhoneNumber(order.phoneNumber);
  const customerKey = normalizedPhone || `order_${cleanedId || order.id}`;
  const parsedAmount = parseFloat(String(order.amount || '0').replace(/[^0-9.]/g, '')) || 0;
  
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

  return {
    id: `dexie_${order.id || cleanedId}`,
    rawId: order.id,
    orderId: cleanedId,
    displayOrderId: `#${cleanedId}`,
    source: 'upload',
    customerKey,
    customerName: order.customerName || 'Customer',
    phoneNumber: normalizedPhone || order.phoneNumber || '',
    rawPhoneNumber: order.phoneNumber,
    address: order.address || '',
    city: order.city || '',
    state: order.state || '',
    pincode: order.pincode || '',
    orderDate: parsedOrderDate.isoDate || order.orderDate || '',
    orderDateDisplay: parsedOrderDate.displayDate || order.orderDateDisplay || '',
    orderType: order.orderType || 'Prepaid',
    amount: parsedAmount,
    products: order.products || 'Standard Products',
    courier: order.courier || '',
    awbNumber: order.awbNumber || '',
    dispatchDate: parsedDispatchDate.displayDate || order.dispatchDate || '',
    estimatedDeliveryDate: parsedEstDeliveryDate.displayDate || order.estimatedDeliveryDate || '',
    deliveredDate: parsedDeliveredDate.displayDate || order.deliveredDate || '',
    remarks: order.remarks || order.lastEvent || order.sourceStatus || order.sourceSubStatus,
    batchId: order.batchId,
    batchName: order.batchName,
    fulfillmentStatus: order.fulfillmentStatus,
    financialStatus: order.financialStatus,
    stage: order.stage || 'order_data',
    workflowStage,
    status,
    rawStatus: order.status,
    lastEvent: order.lastEvent,
    syncedAt: order.syncedAt,
    trackingError: order.trackingError,
    syncState: order.syncState || 'idle'
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
  customers: UnifiedCustomer[]
): WorkflowStageCounts => {
  let active = 0;
  let pending = 0;
  let prepareDispatch = 0;
  let dispatched = 0;
  let tracking = 0;

  for (const o of orders) {
    switch (o.workflowStage) {
      case 'active':
        active++;
        break;
      case 'pending':
        pending++;
        break;
      case 'prepare_dispatch':
        prepareDispatch++;
        break;
      case 'dispatched':
        dispatched++;
        break;
      case 'tracking':
        tracking++;
        break;
      default:
        active++;
    }
  }

  return {
    active,
    pending,
    prepareDispatch,
    dispatched,
    tracking,
    totalOrders: orders.length,
    totalCustomers: customers.length
  };
};

/**
 * Bulk moves orders from Active to Prepare Dispatch in Dexie
 */
export const bulkMoveToPrepareDispatch = async (
  rawOrderIds: number[],
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
        const ord = await db.logistics_orders.get(rawId);
        if (!ord) {
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
        await db.logistics_orders.update(rawId, {
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

/**
 * Bulk or single confirm dispatch for an order
 */
export const confirmOrderDispatch = async (payload: {
  rawId: number;
  courier: string;
  awbNumber: string;
  dispatchDate?: string;
  estimatedDeliveryDate?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const ord = await db.logistics_orders.get(payload.rawId);
    if (!ord) {
      return { success: false, error: 'Order not found in database' };
    }

    const dDate = payload.dispatchDate || new Date().toISOString().slice(0, 10);
    await db.logistics_orders.update(payload.rawId, {
      courier: payload.courier,
      awbNumber: payload.awbNumber.trim(),
      dispatchDate: dDate,
      estimatedDeliveryDate: payload.estimatedDeliveryDate,
      stage: 'dispatched' as any,
      status: 'In Transit',
      syncedAt: new Date().toLocaleString()
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to confirm dispatch' };
  }
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
 * Fetches Shopify website orders from Supabase
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
