import db from '../lib/db';
import { supabase } from '../lib/supabase';
import type { LogisticsOrder } from '../types/logistics';
import type {
  UnifiedLogisticsOrder,
  UnifiedCustomer,
  UnifiedTrackingStatus,
  UnifiedWorkflowStage,
  LogisticsSummaryCounts
} from '../types/unifiedLogistics';

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
 * into unified tracking status and workflow stage.
 */
export const mapToUnifiedStatus = (
  rawStatus?: string | null,
  stage?: 'order_data' | 'tracking' | 'trash',
  awbNumber?: string | null
): { status: UnifiedTrackingStatus; workflowStage: UnifiedWorkflowStage } => {
  const s = (rawStatus || '').trim().toLowerCase();

  if (s.includes('rto') || s.includes('returned') || s.includes('return to origin')) {
    return { status: 'RTO', workflowStage: 'rto' };
  }
  if (s.includes('delivered')) {
    return { status: 'Delivered', workflowStage: 'delivered' };
  }
  if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
    return { status: 'Out for Delivery', workflowStage: 'out_for_delivery' };
  }
  if (
    s.includes('in transit') ||
    s.includes('in_transit') ||
    s.includes('transit') ||
    s.includes('processed') ||
    s.includes('forwarded') ||
    s.includes('hub reached')
  ) {
    return { status: 'In Transit', workflowStage: 'in_transit' };
  }
  if (s.includes('failed attempt') || s.includes('undelivered') || s.includes('attempted')) {
    return { status: 'Failed Attempt', workflowStage: 'exceptions' };
  }
  if (
    s.includes('exception') ||
    s.includes('error') ||
    s.includes('unable to fetch') ||
    s.includes('sync failed') ||
    s.includes('delivery delay') ||
    s.includes('expired')
  ) {
    return { status: 'Delivery Exception', workflowStage: 'exceptions' };
  }
  if (s.includes('cancelled') || s.includes('canceled')) {
    return { status: 'Cancelled', workflowStage: 'exceptions' };
  }
  if (s.includes('dispatched')) {
    return { status: 'In Transit', workflowStage: 'dispatched' };
  }
  if (s.includes('booked') || s.includes('info received') || s.includes('manifest')) {
    return { status: 'Info Received', workflowStage: 'ready_to_dispatch' };
  }

  // Fallbacks based on Dexie stage and AWB presence
  if (stage === 'tracking' || (awbNumber && awbNumber.trim().length > 0)) {
    return { status: 'Pending', workflowStage: 'prepare_dispatch' };
  }

  return { status: 'Not Tracked', workflowStage: 'imported' };
};

/**
 * Transforms a Dexie LogisticsOrder into a Canonical UnifiedLogisticsOrder.
 */
export const fromDexieOrder = (order: LogisticsOrder): UnifiedLogisticsOrder => {
  const cleanedId = cleanOrderId(order.orderId);
  const normalizedPhone = normalizePhoneNumber(order.phoneNumber);
  const customerKey = normalizedPhone || `order_${cleanedId || order.id}`;
  const parsedAmount = parseFloat(String(order.amount || '0').replace(/[^0-9.]/g, '')) || 0;
  const { status, workflowStage } = mapToUnifiedStatus(order.status, order.stage, order.awbNumber);

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
    orderDate: order.orderDate || order.uploadedAt || '',
    orderDateDisplay: order.orderDateDisplay || order.orderDate || '',
    orderType: order.orderType || 'Prepaid',
    amount: parsedAmount,
    products: order.products || 'Standard Products',
    courier: order.courier || '',
    awbNumber: order.awbNumber || '',
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

    // Append order
    customer.orders.push(order);
    customer.totalOrders += 1;

    // Only add non-cancelled / non-RTO to positive lifetime value, or sum full spend
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

    // Keep the most complete customer profile details
    if (!customer.city && order.city) customer.city = order.city;
    if (!customer.state && order.state) customer.state = order.state;
    if (!customer.pincode && order.pincode) customer.pincode = order.pincode;
    if (!customer.address && order.address) customer.address = order.address;
    if (customer.name === 'Customer' && order.customerName && order.customerName !== 'Customer') {
      customer.name = order.customerName;
    }
  }

  // Sort each customer's orders newest to oldest and assign latestStatus
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

  // Sort customers with highest order count and spend first
  return customers.sort((a, b) => b.totalOrders - a.totalOrders || b.totalSpent - a.totalSpent);
};

/**
 * Calculates high-level summary KPIs across the canonical orders.
 */
export const calculateLogisticsSummary = (
  orders: UnifiedLogisticsOrder[],
  customers: UnifiedCustomer[]
): LogisticsSummaryCounts => {
  let imported = 0;
  let readyToDispatch = 0;
  let dispatched = 0;
  let inTransit = 0;
  let outForDelivery = 0;
  let delivered = 0;
  let exceptions = 0;
  let rto = 0;
  let totalValue = 0;

  for (const order of orders) {
    totalValue += order.amount;
    switch (order.workflowStage) {
      case 'imported':
      case 'order_verification':
        imported++;
        break;
      case 'ready_to_dispatch':
      case 'prepare_dispatch':
        readyToDispatch++;
        break;
      case 'dispatched':
        dispatched++;
        break;
      case 'in_transit':
        inTransit++;
        break;
      case 'out_for_delivery':
        outForDelivery++;
        break;
      case 'delivered':
        delivered++;
        break;
      case 'exceptions':
        exceptions++;
        break;
      case 'rto':
        rto++;
        break;
      default:
        imported++;
    }
  }

  return {
    totalOrders: orders.length,
    totalCustomers: customers.length,
    imported,
    readyToDispatch,
    dispatched,
    inTransit,
    outForDelivery,
    delivered,
    exceptions,
    rto,
    totalValue
  };
};

/**
 * Fetches Shopify website orders from Supabase on demand (e.g. for sync/merging).
 */
export const fetchShopifyOrders = async (limit = 100): Promise<UnifiedLogisticsOrder[]> => {
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
      const { status, workflowStage } = mapToUnifiedStatus(so.dispatch_status || so.order_status, 'order_data', null);

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
