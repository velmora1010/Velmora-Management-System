import { supabase } from '../../../lib/supabase';
import { resolveCanonicalProductName } from './websiteSalesUtils';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

export type SalesHistoryEventType = 
  | 'ORDER_CREATED' 
  | 'DISPATCHED' 
  | 'DELIVERED' 
  | 'RTO_INITIATED' 
  | 'RTO_IN_TRANSIT' 
  | 'RTO_DELIVERED' 
  | 'CANCELLED' 
  | 'RETURN';

export type RtoPaymentScope = 'delivered' | 'transit' | 'initiated' | 'all';

export interface RtoPaymentBreakdownMetrics {
  scope: RtoPaymentScope;
  scopeLabel: string;
  totalRtoEvents: number;
  distinctOrdersCount: number;
  totalOrderValue: number;

  // 1. COD RTO Orders & Value
  codRtoOrdersCount: number;       // Distinct orders with COD component (Pure COD + Partial COD)
  codRtoValue: number;             // Total COD pending/receivable value: Pure COD + Partial COD remaining_cod
  pureCodOrdersCount: number;      // Pure COD order count
  pureCodValue: number;            // Pure COD order total value

  // 2. Prepaid RTO Orders & Value
  prepaidRtoOrdersCount: number;   // Distinct Pure Prepaid orders
  prepaidRtoValue: number;         // Total Prepaid collected value: Pure Prepaid + Partial COD advance_paid
  purePrepaidOrdersCount: number;  // Pure Prepaid order count
  purePrepaidValue: number;        // Pure Prepaid order value

  // 3. Partial COD Detailed breakdown
  partialCodOrdersCount: number;   // Distinct Partial COD order count
  partialCodTotalValue: number;    // Gross order total for Partial COD orders
  partialCodAdvancePaid: number;   // Advance paid (prepaid component)
  partialCodRemainingCod: number;  // Remaining COD (COD component)

  // 4. Unknown payment orders
  unknownOrdersCount: number;
  unknownValue: number;

  // 5. Percentages
  codOrdersPct: number;
  prepaidOrdersPct: number;
  partialCodOrdersPct: number;
  codValuePct: number;
  prepaidValuePct: number;
}

export interface HistoryProductItem {
  name: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
}

export interface SalesHistoryEvent {
  id: string;
  event_type: SalesHistoryEventType;
  event_type_label: string;
  event_date: string; // YYYY-MM-DD
  event_date_display: string; // e.g. "18 Oct 2026"
  event_time?: string;
  event_source_label: string; // e.g. "Customer Delivery Proof", "Courier Manifest Handover"
  
  order_id: string;
  display_order_id: string;
  order_date: string;
  current_status: string;
  
  customer_name: string;
  phone: string;
  state: string;
  city: string;
  pincode: string;
  
  products: string;
  items: HistoryProductItem[];
  quantity: number;
  
  order_amount: number;
  payment_mode: 'COD' | 'PREPAID' | 'PARTIAL COD' | 'UNKNOWN';
  source_payment_method: string;
  cod_amount: number;
  prepaid_amount: number;
  cod_collected?: number;
  refund_amount?: number;
  
  courier: string;
  awb_number: string;
  tracking_url?: string;
  delivery_days?: number;
  
  remarks?: string;
  reason?: string;
  
  raw_sales_order?: any;
}

export interface HistoryCategoryCounts {
  all: number;
  ordersCreated: number;
  dispatched: number;
  delivered: number;
  rtoInitiated: number;
  rtoInTransit: number;
  rtoDelivered: number;
  cancelled: number;
  returns: number;
}

export interface HistorySummaryMetrics {
  // Orders Created
  totalOrdersCreated: number;
  totalOrdersCreatedValue: number;
  totalOrdersCreatedUnits: number;
  codCreatedCount: number;
  codCreatedValue: number;
  prepaidCreatedCount: number;
  prepaidCreatedValue: number;
  partialCodCreatedCount: number;
  partialCodCreatedValue: number;

  // Dispatched
  totalDispatched: number;
  totalDispatchedValue: number;
  totalDispatchedUnits: number;
  codDispatchedCount: number;
  codDispatchedValue: number;
  prepaidDispatchedCount: number;
  prepaidDispatchedValue: number;
  courierDispatchCounts: Record<string, number>;

  // Delivered
  totalDelivered: number;
  totalDeliveredValue: number;
  totalDeliveredUnits: number;
  codDeliveredCount: number;
  codDeliveredCollected: number;
  prepaidDeliveredCount: number;
  prepaidDeliveredValue: number;
  avgDeliveryDays: number;

  // RTO
  totalRtoInitiated: number;
  totalRtoInTransit: number;
  totalRtoDeliveredToSeller: number;
  totalRtoValue: number;
  codRtoValue: number;
  prepaidRtoValue: number;
  totalRtoUnits: number;
  rtoRate: number;

  // Cancelled
  totalCancelled: number;
  totalCancelledValue: number;
  codCancelledCount: number;
  codCancelledValue: number;
  prepaidCancelledCount: number;
  prepaidCancelledValue: number;
  cancellationReasons: Record<string, number>;

  // Returns
  totalReturns: number;
  totalReturnedUnits: number;
  totalReturnedValue: number;
  totalRefundAmount: number;
  productReturnCounts: Record<string, number>;

  // High-level All Events summary
  totalEventsCount: number;
  grossEventValue: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

export function normalizeDateToIso(val: any): { iso: string; display: string } {
  if (!val) return { iso: '', display: '' };
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return { iso: '', display: '' };
  }

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const display = `${d} ${MONTH_NAMES[m - 1] || ''} ${y}`;
    return { iso, display };
  }

  // DD/MM/YY
  const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2) {
    const day = parseInt(dmy2[1], 10);
    const month = parseInt(dmy2[2], 10);
    const year = 2000 + parseInt(dmy2[3], 10);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const display = `${day} ${MONTH_NAMES[month - 1] || ''} ${year}`;
    return { iso, display };
  }

  // DD/MM/YYYY
  const dmy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy4) {
    const day = parseInt(dmy4[1], 10);
    const month = parseInt(dmy4[2], 10);
    const year = parseInt(dmy4[3], 10);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const display = `${day} ${MONTH_NAMES[month - 1] || ''} ${year}`;
    return { iso, display };
  }

  // Format: "Tue Jul 21 2026 15:09:24 GMT+0530..."
  const textDateMatch = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i);
  if (textDateMatch) {
    const mStr = textDateMatch[1].toLowerCase();
    const month = MONTH_MAP[mStr] || 1;
    const day = parseInt(textDateMatch[2], 10);
    const year = parseInt(textDateMatch[3], 10);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const display = `${day} ${MONTH_NAMES[month - 1] || ''} ${year}`;
    return { iso, display };
  }

  const parsed = parseAndFormatLogisticsDate(val);
  if (parsed.isoDate) {
    return { iso: parsed.isoDate, display: parsed.displayDate };
  }

  return { iso: '', display: '' };
}

export function parseShipmentProductsString(prodStr: string): { items: HistoryProductItem[]; totalQty: number; formatted: string } {
  if (!prodStr || typeof prodStr !== 'string') {
    return { items: [], totalQty: 1, formatted: 'Standard Item × 1' };
  }

  const parts = prodStr.split(/[~|]/).map(p => p.trim()).filter(Boolean);
  const items: HistoryProductItem[] = [];
  let totalQty = 0;

  for (const part of parts) {
    const match = part.match(/^(.+?)\s*\(\s*(\d+)\s*\)$/);
    if (match) {
      const rawName = match[1].trim();
      const canonicalName = resolveCanonicalProductName(rawName);
      const qty = parseInt(match[2], 10) || 1;
      items.push({ name: canonicalName, quantity: qty });
      totalQty += qty;
    } else {
      const canonicalName = resolveCanonicalProductName(part);
      items.push({ name: canonicalName, quantity: 1 });
      totalQty += 1;
    }
  }

  if (items.length === 0) {
    return { items: [], totalQty: 1, formatted: prodStr };
  }

  const formatted = items.map(it => `${it.name} × ${it.quantity}`).join(', ');
  return { items, totalQty: totalQty || 1, formatted };
}

export function formatINR(val: number | null | undefined): string {
  if (!val || isNaN(val) || val === 0) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export class SalesHistoryService {
  private cachedEvents: SalesHistoryEvent[] | null = null;

  /**
   * Fetches all events in parallel in less than 1.5 seconds
   */
  async getAllLifecycleEvents(): Promise<SalesHistoryEvent[]> {
    if (this.cachedEvents && this.cachedEvents.length > 0) {
      return this.cachedEvents;
    }

    try {
      // Parallel fetch across shipments, cancelled orders, and created orders
      const [ship0, ship1, cancRes, createdRes] = await Promise.all([
        supabase.from('customer_tracking_shipments').select('*').range(0, 999),
        supabase.from('customer_tracking_shipments').select('*').range(1000, 1999),
        supabase.from('sales_orders').select('*').eq('order_status', 'CANCELLED').limit(200),
        supabase.from('sales_orders')
          .select('id,order_id,order_date,customer_name,phone,state,city,pincode,order_total,total_quantity,payment_mode,source_payment_method,advance_paid,remaining_cod,order_status,extra_data')
          .neq('order_status', 'DELETED')
          .order('order_date', { ascending: false })
          .limit(1000)
      ]);

      const shipments = [...(ship0.data || []), ...(ship1.data || [])];
      const cancelledOrders = cancRes.data || [];
      const createdOrders = createdRes.data || [];

      // Build authoritative Sales Orders lookup map to enrich RTO & shipments with exact payment modes
      const soMap = new Map<string, any>();
      createdOrders.forEach(o => {
        const cleanOid = String(o.order_id || '').replace('#', '').trim().toLowerCase();
        if (cleanOid) soMap.set(cleanOid, o);
      });

      // Collect any RTO & return order IDs not yet present in createdOrders
      const rtoCleanOids = new Set<string>();
      for (const ship of shipments) {
        const rawStatus = String(ship.status || ship.raw_status || '').toLowerCase();
        if (rawStatus.includes('rto') || rawStatus.includes('origin') || rawStatus.includes('return')) {
          const rawOid = ship.order_id || ship.display_order_id || '';
          const cleanOid = String(rawOid).replace('#', '').trim().toLowerCase();
          if (cleanOid && !soMap.has(cleanOid)) {
            rtoCleanOids.add(cleanOid);
          }
        }
      }

      // Fetch missing RTO orders from sales_orders in parallel chunks
      const missingOidList = Array.from(rtoCleanOids);
      if (missingOidList.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < missingOidList.length; i += 40) {
          chunks.push(missingOidList.slice(i, i + 40));
        }

        const missingOrdersResults = await Promise.all(
          chunks.map(chunk => {
            const variants: string[] = [];
            chunk.forEach(id => {
              variants.push(id);
              variants.push(`#${id}`);
            });
            return supabase
              .from('sales_orders')
              .select('id,order_id,order_date,customer_name,phone,state,city,pincode,order_total,total_quantity,payment_mode,source_payment_method,advance_paid,remaining_cod,order_status,extra_data')
              .in('order_id', variants);
          })
        );

        missingOrdersResults.forEach(res => {
          if (res.data) {
            res.data.forEach((so: any) => {
              const clean = String(so.order_id || '').replace('#', '').trim().toLowerCase();
              if (clean) soMap.set(clean, so);
            });
          }
        });
      }

      const events: SalesHistoryEvent[] = [];

      // 1. SHIPMENTS PROCESSING (Dispatched, Delivered, RTO Delivered, RTO In Transit, Return)
      for (const ship of shipments) {
        const rawOid = ship.order_id || ship.display_order_id || '';
        const cleanOid = String(rawOid).replace('#', '').trim();
        const matchedSo = soMap.get(cleanOid.toLowerCase());

        const customerName = (matchedSo?.customer_name) || ship.customer_name || 'N/A';
        const phone = (matchedSo?.phone) || ship.phone_number || '';
        const state = (matchedSo?.state) || ship.state || 'Unspecified';
        const city = (matchedSo?.city) || ship.city || 'Unspecified';
        const pincode = (matchedSo?.pincode) || ship.pincode || '';
        const courier = ship.courier || 'Delhivery';
        const awbNumber = ship.awb_number || '';
        const trackingUrl = ship.tracking_url || (awbNumber ? `https://www.delhivery.com/track/package/${awbNumber}` : undefined);
        const orderAmount = Number(matchedSo?.order_total ?? ship.amount ?? 0);
        const originalOrderDate = ship.dispatch_date ? normalizeDateToIso(ship.dispatch_date).display : (matchedSo?.order_date ? normalizeDateToIso(matchedSo.order_date).display : '—');

        // Authoritative Payment classification
        let paymentMode: 'COD' | 'PREPAID' | 'PARTIAL COD' | 'UNKNOWN' = 'COD';
        let codAmount = 0;
        let prepaidAmount = 0;
        let sourcePaymentMethod = ship.order_type || '';

        if (matchedSo) {
          const pModeStr = String(matchedSo.payment_mode || '').toUpperCase();
          sourcePaymentMethod = matchedSo.source_payment_method || matchedSo.payment_mode || ship.order_type || '';
          if (pModeStr.includes('PARTIAL')) {
            paymentMode = 'PARTIAL COD';
            const adv = Number(matchedSo.advance_paid) || 0;
            prepaidAmount = adv;
            codAmount = Number(matchedSo.remaining_cod) || Math.max(0, orderAmount - adv);
          } else if (pModeStr.includes('PREPAID') || pModeStr.includes('ONLINE') || pModeStr.includes('UPI')) {
            paymentMode = 'PREPAID';
            prepaidAmount = orderAmount;
            codAmount = 0;
          } else if (pModeStr.includes('COD') || pModeStr.includes('CASH')) {
            paymentMode = 'COD';
            codAmount = orderAmount;
            prepaidAmount = 0;
          } else {
            paymentMode = 'UNKNOWN';
            codAmount = 0;
            prepaidAmount = 0;
          }
        } else {
          const pModeStr = String(ship.order_type || '').toUpperCase();
          if (pModeStr.includes('PREPAID') || pModeStr.includes('ONLINE') || pModeStr.includes('UPI')) {
            paymentMode = 'PREPAID';
            prepaidAmount = orderAmount;
            codAmount = 0;
          } else if (pModeStr.includes('COD')) {
            paymentMode = 'COD';
            codAmount = orderAmount;
            prepaidAmount = 0;
          } else {
            paymentMode = 'UNKNOWN';
            codAmount = 0;
            prepaidAmount = 0;
          }
        }

        const parsedProd = parseShipmentProductsString(ship.products || matchedSo?.extra_data?.order_formatted || matchedSo?.extra_data?.product_name || '');
        const rawStatusStr = String(ship.status || ship.raw_status || '').toLowerCase();

        // EVENT A: DISPATCHED
        if (ship.dispatch_date) {
          const parsedDisp = normalizeDateToIso(ship.dispatch_date);
          if (parsedDisp.iso) {
            events.push({
              id: `disp_${ship.id || cleanOid}`,
              event_type: 'DISPATCHED',
              event_type_label: 'Dispatched',
              event_date: parsedDisp.iso,
              event_date_display: parsedDisp.display,
              event_source_label: 'Courier Manifest Handover',
              order_id: cleanOid,
              display_order_id: ship.display_order_id || `#${cleanOid}`,
              order_date: originalOrderDate,
              current_status: ship.status || 'Dispatched',
              customer_name: customerName,
              phone: phone,
              state: state,
              city: city,
              pincode: pincode,
              products: parsedProd.formatted,
              items: parsedProd.items,
              quantity: parsedProd.totalQty,
              order_amount: orderAmount,
              payment_mode: paymentMode,
              source_payment_method: sourcePaymentMethod,
              cod_amount: codAmount,
              prepaid_amount: prepaidAmount,
              courier: courier,
              awb_number: awbNumber,
              tracking_url: trackingUrl,
              remarks: ship.remarks || 'Manifest created and handed to courier',
              raw_sales_order: matchedSo
            });
          }
        }

        // EVENT B: DELIVERED
        if (rawStatusStr.includes('delivered') && !rawStatusStr.includes('origin') && !rawStatusStr.includes('seller') && ship.delivered_date) {
          const parsedDeliv = normalizeDateToIso(ship.delivered_date);
          if (parsedDeliv.iso) {
            let delivDays: number | undefined = undefined;
            if (ship.dispatch_date) {
              const pDisp = normalizeDateToIso(ship.dispatch_date);
              if (pDisp.iso) {
                const diffMs = new Date(parsedDeliv.iso).getTime() - new Date(pDisp.iso).getTime();
                const d = Math.round(diffMs / (1000 * 60 * 60 * 24));
                if (d >= 0 && d <= 60) delivDays = d;
              }
            }

            events.push({
              id: `deliv_${ship.id || cleanOid}`,
              event_type: 'DELIVERED',
              event_type_label: 'Delivered',
              event_date: parsedDeliv.iso,
              event_date_display: parsedDeliv.display,
              event_source_label: 'Customer Delivery Proof',
              order_id: cleanOid,
              display_order_id: ship.display_order_id || `#${cleanOid}`,
              order_date: originalOrderDate,
              current_status: 'Delivered',
              customer_name: customerName,
              phone: phone,
              state: state,
              city: city,
              pincode: pincode,
              products: parsedProd.formatted,
              items: parsedProd.items,
              quantity: parsedProd.totalQty,
              order_amount: orderAmount,
              payment_mode: paymentMode,
              source_payment_method: sourcePaymentMethod,
              cod_amount: codAmount,
              prepaid_amount: prepaidAmount,
              cod_collected: codAmount,
              courier: courier,
              awb_number: awbNumber,
              tracking_url: trackingUrl,
              delivery_days: delivDays,
              remarks: ship.remarks || 'Shipment delivered to customer',
              raw_sales_order: matchedSo
            });
          }
        }

        // EVENT C: RTO DELIVERED TO SELLER
        if ((rawStatusStr.includes('origin') || rawStatusStr.includes('returned to origin') || rawStatusStr.includes('delivered to seller')) && ship.delivered_date) {
          const parsedRtoDeliv = normalizeDateToIso(ship.delivered_date);
          if (parsedRtoDeliv.iso) {
            events.push({
              id: `rto_deliv_${ship.id || cleanOid}`,
              event_type: 'RTO_DELIVERED',
              event_type_label: 'RTO Delivered to Seller',
              event_date: parsedRtoDeliv.iso,
              event_date_display: parsedRtoDeliv.display,
              event_source_label: 'Seller RTO Receipt Date',
              order_id: cleanOid,
              display_order_id: ship.display_order_id || `#${cleanOid}`,
              order_date: originalOrderDate,
              current_status: 'Returned to Origin',
              customer_name: customerName,
              phone: phone,
              state: state,
              city: city,
              pincode: pincode,
              products: parsedProd.formatted,
              items: parsedProd.items,
              quantity: parsedProd.totalQty,
              order_amount: orderAmount,
              payment_mode: paymentMode,
              source_payment_method: sourcePaymentMethod,
              cod_amount: codAmount,
              prepaid_amount: prepaidAmount,
              courier: courier,
              awb_number: awbNumber,
              tracking_url: trackingUrl,
              remarks: ship.remarks || 'Returned to Origin and received by seller',
              reason: ship.remarks,
              raw_sales_order: matchedSo
            });
          }
        }

        // EVENT D: RTO IN TRANSIT
        if (rawStatusStr.includes('transit') && rawStatusStr.includes('rto')) {
          const rtoDate = ship.tracking_date_time || ship.updated_at;
          const parsedTransit = normalizeDateToIso(rtoDate);
          if (parsedTransit.iso) {
            events.push({
              id: `rto_transit_${ship.id || cleanOid}`,
              event_type: 'RTO_IN_TRANSIT',
              event_type_label: 'RTO In Transit',
              event_date: parsedTransit.iso,
              event_date_display: parsedTransit.display,
              event_source_label: 'RTO Transit Scan Event',
              order_id: cleanOid,
              display_order_id: ship.display_order_id || `#${cleanOid}`,
              order_date: originalOrderDate,
              current_status: 'RTO - In Transit',
              customer_name: customerName,
              phone: phone,
              state: state,
              city: city,
              pincode: pincode,
              products: parsedProd.formatted,
              items: parsedProd.items,
              quantity: parsedProd.totalQty,
              order_amount: orderAmount,
              payment_mode: paymentMode,
              source_payment_method: sourcePaymentMethod,
              cod_amount: codAmount,
              prepaid_amount: prepaidAmount,
              courier: courier,
              awb_number: awbNumber,
              tracking_url: trackingUrl,
              remarks: ship.remarks || 'Parcel in transit returning back to origin',
              reason: ship.remarks,
              raw_sales_order: matchedSo
            });
          }
        }

        // EVENT E: RETURNS
        if (rawStatusStr.includes('return') || String(ship.remarks || '').toLowerCase().includes('return')) {
          const retDate = ship.delivered_date || ship.tracking_date_time || ship.updated_at;
          const parsedRet = normalizeDateToIso(retDate);
          if (parsedRet.iso) {
            events.push({
              id: `return_${ship.id || cleanOid}`,
              event_type: 'RETURN',
              event_type_label: 'Returns',
              event_date: parsedRet.iso,
              event_date_display: parsedRet.display,
              event_source_label: 'Return Event Record',
              order_id: cleanOid,
              display_order_id: ship.display_order_id || `#${cleanOid}`,
              order_date: originalOrderDate,
              current_status: ship.status || 'Returned',
              customer_name: customerName,
              phone: phone,
              state: state,
              city: city,
              pincode: pincode,
              products: parsedProd.formatted,
              items: parsedProd.items,
              quantity: parsedProd.totalQty,
              order_amount: orderAmount,
              payment_mode: paymentMode,
              source_payment_method: sourcePaymentMethod,
              cod_amount: codAmount,
              prepaid_amount: prepaidAmount,
              courier: courier,
              awb_number: awbNumber,
              tracking_url: trackingUrl,
              remarks: ship.remarks || 'Customer return event processed',
              reason: ship.remarks,
              raw_sales_order: matchedSo
            });
          }
        }
      }

      // 2. CANCELLED ORDERS PROCESSING
      for (const canc of cancelledOrders) {
        const cleanOid = String(canc.order_id).replace('#', '').trim();
        const extra = canc.extra_data || {};
        const cancData = extra.cancellation || {};
        const cancTimestamp = cancData.cancelled_at || cancData.confirmed_at || cancData.requested_at || canc.updated_at;
        const parsedCanc = normalizeDateToIso(cancTimestamp);

        if (parsedCanc.iso) {
          const orderAmount = Number(canc.order_total || 0);
          let paymentMode: 'COD' | 'PREPAID' | 'PARTIAL COD' | 'UNKNOWN' = 'COD';
          const pModeStr = String(canc.payment_mode || '').toUpperCase();
          if (pModeStr.includes('PARTIAL')) {
            paymentMode = 'PARTIAL COD';
          } else if (pModeStr.includes('PREPAID') || pModeStr.includes('ONLINE') || pModeStr.includes('UPI')) {
            paymentMode = 'PREPAID';
          } else {
            paymentMode = 'COD';
          }

          let codAmount = 0;
          let prepaidAmount = 0;
          if (paymentMode === 'PREPAID') {
            prepaidAmount = orderAmount;
          } else if (paymentMode === 'PARTIAL COD') {
            const adv = Number(canc.advance_paid) || 0;
            prepaidAmount = adv;
            codAmount = Number(canc.remaining_cod) || Math.max(0, orderAmount - adv);
          } else {
            codAmount = orderAmount;
          }

          const reason = cancData.reason || 'Order cancelled in source export';
          const parsedProd = parseShipmentProductsString(extra.order_formatted || extra.product_name || 'Cancelled Item');

          events.push({
            id: `canc_${canc.id || cleanOid}`,
            event_type: 'CANCELLED',
            event_type_label: 'Cancelled',
            event_date: parsedCanc.iso,
            event_date_display: parsedCanc.display,
            event_source_label: 'Cancellation Audit Trail',
            order_id: cleanOid,
            display_order_id: `#${cleanOid}`,
            order_date: canc.order_date ? normalizeDateToIso(canc.order_date).display : '—',
            current_status: 'Cancelled',
            customer_name: canc.customer_name || 'N/A',
            phone: canc.phone || '',
            state: canc.state || 'Unspecified',
            city: canc.city || 'Unspecified',
            pincode: canc.pincode || '',
            products: parsedProd.formatted,
            items: parsedProd.items,
            quantity: parsedProd.totalQty,
            order_amount: orderAmount,
            payment_mode: paymentMode,
            source_payment_method: canc.source_payment_method || canc.payment_mode || '',
            cod_amount: codAmount,
            prepaid_amount: prepaidAmount,
            courier: extra.courier || 'None',
            awb_number: extra.awb_number || '',
            remarks: reason,
            reason: reason,
            raw_sales_order: canc
          });
        }
      }

      // 3. ORDERS CREATED PROCESSING
      for (const ord of createdOrders) {
        const cleanOid = String(ord.order_id).replace('#', '').trim();
        const parsedCreated = normalizeDateToIso(ord.order_date);

        if (parsedCreated.iso) {
          const orderAmount = Number(ord.order_total || 0);
          let paymentMode: 'COD' | 'PREPAID' | 'PARTIAL COD' | 'UNKNOWN' = 'COD';
          const pModeStr = String(ord.payment_mode || '').toUpperCase();
          if (pModeStr.includes('PARTIAL')) {
            paymentMode = 'PARTIAL COD';
          } else if (pModeStr.includes('PREPAID') || pModeStr.includes('ONLINE') || pModeStr.includes('UPI')) {
            paymentMode = 'PREPAID';
          } else {
            paymentMode = 'COD';
          }

          let codAmount = 0;
          let prepaidAmount = 0;
          if (paymentMode === 'PREPAID') {
            prepaidAmount = orderAmount;
          } else if (paymentMode === 'PARTIAL COD') {
            const adv = Number(ord.advance_paid) || 0;
            prepaidAmount = adv;
            codAmount = Number(ord.remaining_cod) || Math.max(0, orderAmount - adv);
          } else {
            codAmount = orderAmount;
          }

          const extra = ord.extra_data || {};
          const parsedProd = parseShipmentProductsString(extra.order_formatted || extra.product_name || 'Standard Item');

          events.push({
            id: `create_${ord.id || cleanOid}`,
            event_type: 'ORDER_CREATED',
            event_type_label: 'Order Created',
            event_date: parsedCreated.iso,
            event_date_display: parsedCreated.display,
            event_source_label: 'Shopify Order Placement',
            order_id: cleanOid,
            display_order_id: `#${cleanOid}`,
            order_date: parsedCreated.display,
            current_status: ord.order_status || 'Placed',
            customer_name: ord.customer_name || 'N/A',
            phone: ord.phone || '',
            state: ord.state || 'Unspecified',
            city: ord.city || 'Unspecified',
            pincode: ord.pincode || '',
            products: parsedProd.formatted,
            items: parsedProd.items,
            quantity: Number(ord.total_quantity) || parsedProd.totalQty,
            order_amount: orderAmount,
            payment_mode: paymentMode,
            source_payment_method: ord.source_payment_method || ord.payment_mode || '',
            cod_amount: codAmount,
            prepaid_amount: prepaidAmount,
            courier: extra.courier || 'Pending',
            awb_number: extra.awb_number || '',
            remarks: 'Order placed by customer via Website Sales',
            raw_sales_order: ord
          });
        }
      }

      // Sort newest event first
      events.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));

      this.cachedEvents = events;
      return events;
    } catch (err) {
      console.error('Failed to assemble lifecycle events:', err);
      return [];
    }
  }

  getCategoryCounts(events: SalesHistoryEvent[]): HistoryCategoryCounts {
    let all = events.length;
    let ordersCreated = 0;
    let dispatched = 0;
    let delivered = 0;
    let rtoInitiated = 0;
    let rtoInTransit = 0;
    let rtoDelivered = 0;
    let cancelled = 0;
    let returns = 0;

    events.forEach(e => {
      if (e.event_type === 'ORDER_CREATED') ordersCreated++;
      else if (e.event_type === 'DISPATCHED') dispatched++;
      else if (e.event_type === 'DELIVERED') delivered++;
      else if (e.event_type === 'RTO_INITIATED') rtoInitiated++;
      else if (e.event_type === 'RTO_IN_TRANSIT') rtoInTransit++;
      else if (e.event_type === 'RTO_DELIVERED') rtoDelivered++;
      else if (e.event_type === 'CANCELLED') cancelled++;
      else if (e.event_type === 'RETURN') returns++;
    });

    return {
      all,
      ordersCreated,
      dispatched,
      delivered,
      rtoInitiated,
      rtoInTransit,
      rtoDelivered,
      cancelled,
      returns
    };
  }

  calculateMetrics(events: SalesHistoryEvent[], activeCategory: string = 'all'): HistorySummaryMetrics {
    let totalOrdersCreated = 0;
    let totalOrdersCreatedValue = 0;
    let totalOrdersCreatedUnits = 0;
    let codCreatedCount = 0;
    let codCreatedValue = 0;
    let prepaidCreatedCount = 0;
    let prepaidCreatedValue = 0;
    let partialCodCreatedCount = 0;
    let partialCodCreatedValue = 0;

    let totalDispatched = 0;
    let totalDispatchedValue = 0;
    let totalDispatchedUnits = 0;
    let codDispatchedCount = 0;
    let codDispatchedValue = 0;
    let prepaidDispatchedCount = 0;
    let prepaidDispatchedValue = 0;
    const courierDispatchCounts: Record<string, number> = {};

    let totalDelivered = 0;
    let totalDeliveredValue = 0;
    let totalDeliveredUnits = 0;
    let codDeliveredCount = 0;
    let codDeliveredCollected = 0;
    let prepaidDeliveredCount = 0;
    let prepaidDeliveredValue = 0;
    let totalDelivDays = 0;
    let delivDaysCount = 0;

    let totalRtoInitiated = 0;
    let totalRtoInTransit = 0;
    let totalRtoDeliveredToSeller = 0;
    let totalRtoValue = 0;
    let codRtoValue = 0;
    let prepaidRtoValue = 0;
    let totalRtoUnits = 0;

    let totalCancelled = 0;
    let totalCancelledValue = 0;
    let codCancelledCount = 0;
    let codCancelledValue = 0;
    let prepaidCancelledCount = 0;
    let prepaidCancelledValue = 0;
    const cancellationReasons: Record<string, number> = {};

    let totalReturns = 0;
    let totalReturnedUnits = 0;
    let totalReturnedValue = 0;
    let totalRefundAmount = 0;
    const productReturnCounts: Record<string, number> = {};

    let grossEventValue = 0;

    events.forEach(e => {
      grossEventValue += e.order_amount;

      if (e.event_type === 'ORDER_CREATED') {
        totalOrdersCreated++;
        totalOrdersCreatedValue += e.order_amount;
        totalOrdersCreatedUnits += e.quantity;
        if (e.payment_mode === 'COD') {
          codCreatedCount++;
          codCreatedValue += e.order_amount;
        } else if (e.payment_mode === 'PREPAID') {
          prepaidCreatedCount++;
          prepaidCreatedValue += e.order_amount;
        } else if (e.payment_mode === 'PARTIAL COD') {
          partialCodCreatedCount++;
          partialCodCreatedValue += e.order_amount;
        }
      }

      if (e.event_type === 'DISPATCHED') {
        totalDispatched++;
        totalDispatchedValue += e.order_amount;
        totalDispatchedUnits += e.quantity;
        if (e.payment_mode === 'COD' || e.payment_mode === 'PARTIAL COD') {
          codDispatchedCount++;
          codDispatchedValue += e.cod_amount;
        }
        if (e.payment_mode === 'PREPAID' || e.payment_mode === 'PARTIAL COD') {
          prepaidDispatchedCount++;
          prepaidDispatchedValue += e.prepaid_amount;
        }
        const c = e.courier || 'Delhivery';
        courierDispatchCounts[c] = (courierDispatchCounts[c] || 0) + 1;
      }

      if (e.event_type === 'DELIVERED') {
        totalDelivered++;
        totalDeliveredValue += e.order_amount;
        totalDeliveredUnits += e.quantity;
        if (e.payment_mode === 'COD' || e.payment_mode === 'PARTIAL COD') {
          codDeliveredCount++;
          codDeliveredCollected += e.cod_amount;
        }
        if (e.payment_mode === 'PREPAID' || e.payment_mode === 'PARTIAL COD') {
          prepaidDeliveredCount++;
          prepaidDeliveredValue += e.prepaid_amount;
        }
        if (e.delivery_days != null && !isNaN(e.delivery_days)) {
          totalDelivDays += e.delivery_days;
          delivDaysCount++;
        }
      }

      if (e.event_type === 'RTO_DELIVERED' || e.event_type === 'RTO_IN_TRANSIT' || e.event_type === 'RTO_INITIATED') {
        if (e.event_type === 'RTO_DELIVERED') totalRtoDeliveredToSeller++;
        if (e.event_type === 'RTO_IN_TRANSIT') totalRtoInTransit++;
        if (e.event_type === 'RTO_INITIATED') totalRtoInitiated++;

        totalRtoValue += e.order_amount;
        codRtoValue += e.cod_amount;
        prepaidRtoValue += e.prepaid_amount;
        totalRtoUnits += e.quantity;
      }

      if (e.event_type === 'CANCELLED') {
        totalCancelled++;
        totalCancelledValue += e.order_amount;
        if (e.payment_mode === 'COD') {
          codCancelledCount++;
          codCancelledValue += e.order_amount;
        } else {
          prepaidCancelledCount++;
          prepaidCancelledValue += e.order_amount;
        }
        const r = e.reason || 'Cancelled in Shopify';
        cancellationReasons[r] = (cancellationReasons[r] || 0) + 1;
      }

      if (e.event_type === 'RETURN') {
        totalReturns++;
        totalReturnedUnits += e.quantity;
        totalReturnedValue += e.order_amount;
        totalRefundAmount += e.prepaid_amount;
        e.items.forEach(it => {
          productReturnCounts[it.name] = (productReturnCounts[it.name] || 0) + it.quantity;
        });
      }
    });

    const avgDeliveryDays = delivDaysCount > 0 ? Number((totalDelivDays / delivDaysCount).toFixed(1)) : 0;
    const rtoRate = (totalDispatched > 0)
      ? Number((((totalRtoDeliveredToSeller + totalRtoInTransit) / totalDispatched) * 100).toFixed(1))
      : (totalDelivered > 0 ? Number((((totalRtoDeliveredToSeller + totalRtoInTransit) / (totalDelivered + totalRtoDeliveredToSeller + totalRtoInTransit)) * 100).toFixed(1)) : 0);

    return {
      totalOrdersCreated,
      totalOrdersCreatedValue,
      totalOrdersCreatedUnits,
      codCreatedCount,
      codCreatedValue,
      prepaidCreatedCount,
      prepaidCreatedValue,
      partialCodCreatedCount,
      partialCodCreatedValue,

      totalDispatched,
      totalDispatchedValue,
      totalDispatchedUnits,
      codDispatchedCount,
      codDispatchedValue,
      prepaidDispatchedCount,
      prepaidDispatchedValue,
      courierDispatchCounts,

      totalDelivered,
      totalDeliveredValue,
      totalDeliveredUnits,
      codDeliveredCount,
      codDeliveredCollected,
      prepaidDeliveredCount,
      prepaidDeliveredValue,
      avgDeliveryDays,

      totalRtoInitiated,
      totalRtoInTransit,
      totalRtoDeliveredToSeller,
      totalRtoValue,
      codRtoValue,
      prepaidRtoValue,
      totalRtoUnits,
      rtoRate,

      totalCancelled,
      totalCancelledValue,
      codCancelledCount,
      codCancelledValue,
      prepaidCancelledCount,
      prepaidCancelledValue,
      cancellationReasons,

      totalReturns,
      totalReturnedUnits,
      totalReturnedValue,
      totalRefundAmount,
      productReturnCounts,

      totalEventsCount: events.length,
      grossEventValue
    };
  }

  /**
   * Calculates precise COD vs Prepaid RTO metrics with deduplication and Partial COD split
   */
  calculateRtoPaymentBreakdown(events: SalesHistoryEvent[], scope: RtoPaymentScope = 'delivered'): RtoPaymentBreakdownMetrics {
    // 1. Filter events matching RTO types and current scope
    const rtoEvents = events.filter(e => {
      if (scope === 'delivered') return e.event_type === 'RTO_DELIVERED';
      if (scope === 'transit') return e.event_type === 'RTO_IN_TRANSIT';
      if (scope === 'initiated') return e.event_type === 'RTO_INITIATED';
      return e.event_type === 'RTO_DELIVERED' || e.event_type === 'RTO_IN_TRANSIT' || e.event_type === 'RTO_INITIATED';
    });

    // 2. Deduplicate by distinct order_id (preferring RTO_DELIVERED over RTO_IN_TRANSIT over RTO_INITIATED)
    const orderMap = new Map<string, SalesHistoryEvent>();
    const priority: Record<string, number> = {
      'RTO_DELIVERED': 3,
      'RTO_IN_TRANSIT': 2,
      'RTO_INITIATED': 1
    };

    rtoEvents.forEach(e => {
      const key = e.order_id.toLowerCase().trim();
      if (!orderMap.has(key)) {
        orderMap.set(key, e);
      } else {
        const existing = orderMap.get(key)!;
        const existingPri = priority[existing.event_type] || 0;
        const currentPri = priority[e.event_type] || 0;
        if (currentPri > existingPri) {
          orderMap.set(key, e);
        }
      }
    });

    const distinctOrders = Array.from(orderMap.values());
    const distinctOrdersCount = distinctOrders.length;

    let totalOrderValue = 0;
    let pureCodOrdersCount = 0;
    let pureCodValue = 0;
    let purePrepaidOrdersCount = 0;
    let purePrepaidValue = 0;
    let partialCodOrdersCount = 0;
    let partialCodTotalValue = 0;
    let partialCodAdvancePaid = 0;
    let partialCodRemainingCod = 0;
    let unknownOrdersCount = 0;
    let unknownValue = 0;

    distinctOrders.forEach(ord => {
      totalOrderValue += ord.order_amount;
      if (ord.payment_mode === 'COD') {
        pureCodOrdersCount++;
        pureCodValue += ord.order_amount;
      } else if (ord.payment_mode === 'PREPAID') {
        purePrepaidOrdersCount++;
        purePrepaidValue += ord.order_amount;
      } else if (ord.payment_mode === 'PARTIAL COD') {
        partialCodOrdersCount++;
        partialCodTotalValue += ord.order_amount;
        partialCodAdvancePaid += ord.prepaid_amount;
        partialCodRemainingCod += ord.cod_amount;
      } else {
        unknownOrdersCount++;
        unknownValue += ord.order_amount;
      }
    });

    // COD component: Pure COD orders + Partial COD orders
    const codRtoOrdersCount = pureCodOrdersCount + partialCodOrdersCount;
    const codRtoValue = pureCodValue + partialCodRemainingCod;

    // Prepaid component: Pure Prepaid orders + Partial COD advance payments
    const prepaidRtoOrdersCount = purePrepaidOrdersCount;
    const prepaidRtoValue = purePrepaidValue + partialCodAdvancePaid;

    const codOrdersPct = distinctOrdersCount > 0 ? Number(((codRtoOrdersCount / distinctOrdersCount) * 100).toFixed(1)) : 0;
    const prepaidOrdersPct = distinctOrdersCount > 0 ? Number(((prepaidRtoOrdersCount / distinctOrdersCount) * 100).toFixed(1)) : 0;
    const partialCodOrdersPct = distinctOrdersCount > 0 ? Number(((partialCodOrdersCount / distinctOrdersCount) * 100).toFixed(1)) : 0;

    const codValuePct = totalOrderValue > 0 ? Number(((codRtoValue / totalOrderValue) * 100).toFixed(1)) : 0;
    const prepaidValuePct = totalOrderValue > 0 ? Number(((prepaidRtoValue / totalOrderValue) * 100).toFixed(1)) : 0;

    const scopeLabels: Record<RtoPaymentScope, string> = {
      delivered: 'RTO Delivered to Seller',
      transit: 'RTO In Transit',
      initiated: 'RTO Initiated',
      all: 'All RTO Events'
    };

    return {
      scope,
      scopeLabel: scopeLabels[scope],
      totalRtoEvents: rtoEvents.length,
      distinctOrdersCount,
      totalOrderValue,
      codRtoOrdersCount,
      codRtoValue,
      pureCodOrdersCount,
      pureCodValue,
      prepaidRtoOrdersCount,
      prepaidRtoValue,
      purePrepaidOrdersCount,
      purePrepaidValue,
      partialCodOrdersCount,
      partialCodTotalValue,
      partialCodAdvancePaid,
      partialCodRemainingCod,
      unknownOrdersCount,
      unknownValue,
      codOrdersPct,
      prepaidOrdersPct,
      partialCodOrdersPct,
      codValuePct,
      prepaidValuePct
    };
  }
}

export const salesHistoryService = new SalesHistoryService();
