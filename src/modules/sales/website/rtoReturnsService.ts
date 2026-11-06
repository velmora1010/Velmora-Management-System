import { supabase } from '../../../lib/supabase';
import { resolveCanonicalProductName, normalizeOrderId } from './websiteSalesUtils';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

export interface RtoProductItem {
  name: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
}

export interface RtoReturnOrderRecord {
  id: string;
  sales_order_id?: string;
  order_id: string;
  display_order_id: string;
  order_date: string; // original order date or '—'
  rto_event_date: string; // YYYY-MM-DD
  rto_event_date_display: string; // '16 Sep 2026'
  date_label_type: 'DELIVERED_TO_SELLER' | 'STATUS_TRANSITION' | 'DISPATCH_FALLBACK';
  customer_name: string;
  phone: string;
  state: string;
  city: string;
  pincode: string;
  products: string;
  items: RtoProductItem[];
  quantity_returned: number;
  order_amount: number;
  payment_mode: 'COD' | 'PREPAID' | 'PARTIAL COD' | 'UNKNOWN';
  source_payment_method: string;
  cod_amount: number;
  prepaid_amount: number;
  cod_recoverable_status: 'UNCOLLECTED_COD' | 'PREPAID_COLLECTED' | 'PARTIAL_SPLIT';
  rto_status: 'Delivered to Seller' | 'RTO - In Transit' | 'Initiated' | string;
  courier: string;
  awb_number: string;
  tracking_url?: string;
  rto_reason: string;
  raw_status?: string;
  remarks?: string;
  raw_sales_order?: any;
}

export interface RtoSummaryMetrics {
  totalRtoOrders: number;
  rtoDeliveredToSeller: number;
  totalProductsReturned: number;
  rtoOrderValue: number;
  codAmount: number;
  prepaidAmount: number;
  codUncollected: number;
  prepaidCollected: number;
  rtoAvgValue: number;
  rtoRate: number;
  rtoInTransit: number;
}

/**
 * Universal date normalizer that handles ISO (YYYY-MM-DD), D/M/YY, DD/MM/YYYY, Excel serials and timestamps
 */
export function normalizeDateToIso(val: any): { iso: string; display: string } {
  if (!val) return { iso: '', display: '' };
  const s = String(val).trim();
  if (!s) return { iso: '', display: '' };

  // Check D/M/YY or DD/MM/YY (e.g. 2/10/26 -> 2026-10-02)
  const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2) {
    const day = parseInt(dmy2[1], 10);
    const month = parseInt(dmy2[2], 10);
    const year = 2000 + parseInt(dmy2[3], 10);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const display = `${day} ${MONTH_NAMES[month - 1] || ''} ${year}`;
    return { iso, display };
  }

  // Check DD/MM/YYYY
  const dmy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy4) {
    const day = parseInt(dmy4[1], 10);
    const month = parseInt(dmy4[2], 10);
    const year = parseInt(dmy4[3], 10);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const display = `${day} ${MONTH_NAMES[month - 1] || ''} ${year}`;
    return { iso, display };
  }

  // Use general logistics date parser
  const parsed = parseAndFormatLogisticsDate(val);
  if (parsed.isoDate) {
    return { iso: parsed.isoDate, display: parsed.displayDate };
  }

  return { iso: '', display: '' };
}

/**
 * Parses product strings like "DIY Dishwash Liquid(1)~DIY Fabric Conditioner(2)"
 */
export function parseShipmentProductsString(prodStr: string): { items: RtoProductItem[]; totalQty: number; formatted: string } {
  if (!prodStr || typeof prodStr !== 'string') {
    return { items: [], totalQty: 1, formatted: 'N/A' };
  }

  const parts = prodStr.split(/[~|]/).map(p => p.trim()).filter(Boolean);
  const items: RtoProductItem[] = [];
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

export class RtoReturnsService {
  /**
   * Fetches all RTO shipment records from customer_tracking_shipments and cross-links with sales_orders & sales_order_items
   */
  async getRtoReturnHistory(): Promise<RtoReturnOrderRecord[]> {
    // 1. Fetch all RTO shipments from customer_tracking_shipments
    let allShipments: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error } = await supabase
        .from('customer_tracking_shipments')
        .select('*')
        .or('status.ilike.%rto%,raw_status.ilike.%rto%,status.ilike.%return%,raw_status.ilike.%return%')
        .range(start, end);

      if (error) {
        console.error('Error fetching RTO shipments:', error);
        break;
      }

      if (data && data.length > 0) {
        allShipments = allShipments.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    if (allShipments.length === 0) {
      return [];
    }

    // 2. Extract unique order IDs to cross-link with sales_orders
    const cleanOids = Array.from(new Set(
      allShipments
        .map(s => s.order_id ? String(s.order_id).replace('#', '').trim() : '')
        .filter(Boolean)
    ));

    const salesOrdersMap = new Map<string, any>();
    const salesOrderIds: string[] = [];

    // Fetch sales_orders in chunks of 150
    for (let i = 0; i < cleanOids.length; i += 150) {
      const chunk = cleanOids.slice(i, i + 150);
      const orClauses = chunk.map(id => `order_id.eq.${id},order_id.eq.#${id}`).join(',');
      try {
        const { data: soData, error: soErr } = await supabase
          .from('sales_orders')
          .select('*')
          .or(orClauses);

        if (!soErr && soData) {
          soData.forEach(so => {
            const cleanId = String(so.order_id).replace('#', '').trim().toLowerCase();
            salesOrdersMap.set(cleanId, so);
            salesOrderIds.push(so.id);
          });
        }
      } catch (e) {
        console.warn('Failed to fetch sales_orders chunk:', e);
      }
    }

    // 3. Fetch sales_order_items for matched orders in chunks
    const orderItemsMap = new Map<string, RtoProductItem[]>();
    for (let i = 0; i < salesOrderIds.length; i += 200) {
      const chunk = salesOrderIds.slice(i, i + 200);
      try {
        const { data: itemData, error: itemErr } = await supabase
          .from('sales_order_items')
          .select('*')
          .in('sales_order_id', chunk);

        if (!itemErr && itemData) {
          itemData.forEach(item => {
            const canonicalName = resolveCanonicalProductName(item.product_name);
            const qty = Number(item.quantity) || 1;
            const unitPrice = item.unit_price != null ? Number(item.unit_price) : undefined;
            const lineTotal = item.line_total != null ? Number(item.line_total) : undefined;
            if (!orderItemsMap.has(item.sales_order_id)) {
              orderItemsMap.set(item.sales_order_id, []);
            }
            orderItemsMap.get(item.sales_order_id)!.push({
              name: canonicalName,
              quantity: qty,
              unit_price: unitPrice,
              line_total: lineTotal
            });
          });
        }
      } catch (e) {
        console.warn('Failed to fetch order items chunk:', e);
      }
    }

    // 4. Construct unified RtoReturnOrderRecord list
    const records: RtoReturnOrderRecord[] = allShipments.map(shipment => {
      const rawOrderId = shipment.order_id || shipment.display_order_id || '';
      const cleanOid = String(rawOrderId).replace('#', '').trim();
      const cleanOidLower = cleanOid.toLowerCase();
      const matchedSo = salesOrdersMap.get(cleanOidLower);

      // Determine RTO Event Date & Label Type
      let eventIso = '';
      let eventDisplay = '';
      let dateLabelType: 'DELIVERED_TO_SELLER' | 'STATUS_TRANSITION' | 'DISPATCH_FALLBACK' = 'STATUS_TRANSITION';

      const isDeliveredToSeller = 
        String(shipment.status).toLowerCase().includes('returned to origin') ||
        String(shipment.status).toLowerCase().includes('delivered');

      if (shipment.delivered_date) {
        const parsedDeliv = normalizeDateToIso(shipment.delivered_date);
        if (parsedDeliv.iso) {
          eventIso = parsedDeliv.iso;
          eventDisplay = parsedDeliv.display;
          dateLabelType = 'DELIVERED_TO_SELLER';
        }
      }

      if (!eventIso && shipment.tracking_date_time) {
        const parsedTrack = normalizeDateToIso(shipment.tracking_date_time);
        if (parsedTrack.iso) {
          eventIso = parsedTrack.iso;
          eventDisplay = parsedTrack.display;
          dateLabelType = 'STATUS_TRANSITION';
        }
      }

      if (!eventIso && shipment.updated_at) {
        const parsedUpd = normalizeDateToIso(shipment.updated_at);
        if (parsedUpd.iso) {
          eventIso = parsedUpd.iso;
          eventDisplay = parsedUpd.display;
          dateLabelType = 'STATUS_TRANSITION';
        }
      }

      if (!eventIso && shipment.dispatch_date) {
        const parsedDisp = normalizeDateToIso(shipment.dispatch_date);
        if (parsedDisp.iso) {
          eventIso = parsedDisp.iso;
          eventDisplay = parsedDisp.display;
          dateLabelType = 'DISPATCH_FALLBACK';
        }
      }

      // Order placement date (from sales_orders, or dispatch date as fallback)
      const orderDateIso = matchedSo?.order_date || '';
      const orderDateDisplay = orderDateIso ? normalizeDateToIso(orderDateIso).display : (
        shipment.dispatch_date ? normalizeDateToIso(shipment.dispatch_date).display : '—'
      );

      // Customer info
      const customerName = matchedSo?.customer_name || shipment.customer_name || 'N/A';
      const phone = matchedSo?.phone || shipment.phone_number || '';
      const state = shipment.state || matchedSo?.state || 'Unspecified';
      const city = shipment.city || matchedSo?.city || 'Unspecified';
      const pincode = shipment.pincode || matchedSo?.pincode || '';

      // Products & Items
      let items: RtoProductItem[] = [];
      let quantityReturned = 0;
      let productsFormatted = '';

      if (matchedSo && orderItemsMap.has(matchedSo.id) && orderItemsMap.get(matchedSo.id)!.length > 0) {
        items = orderItemsMap.get(matchedSo.id)!;
        quantityReturned = items.reduce((acc, it) => acc + it.quantity, 0);
        productsFormatted = items.map(it => `${it.name} × ${it.quantity}`).join(', ');
      } else if (shipment.products) {
        const parsedProd = parseShipmentProductsString(shipment.products);
        items = parsedProd.items;
        quantityReturned = parsedProd.totalQty;
        productsFormatted = parsedProd.formatted;
      } else {
        productsFormatted = 'Standard Item × 1';
        quantityReturned = 1;
        items = [{ name: 'Standard Item', quantity: 1 }];
      }

      // Order Amount & Payment Classification
      const orderAmount = Number(matchedSo?.order_total ?? shipment.amount ?? 0);
      let paymentMode: 'COD' | 'PREPAID' | 'PARTIAL COD' | 'UNKNOWN' = 'COD';
      const sourcePaymentMethod = matchedSo?.source_payment_method || matchedSo?.payment_mode || shipment.order_type || '';

      const normalizedPmode = String(matchedSo?.payment_mode || shipment.order_type || '').toUpperCase();
      if (normalizedPmode.includes('PARTIAL')) {
        paymentMode = 'PARTIAL COD';
      } else if (normalizedPmode.includes('PREPAID') || normalizedPmode.includes('ONLINE') || normalizedPmode.includes('UPI')) {
        paymentMode = 'PREPAID';
      } else if (normalizedPmode.includes('COD') || normalizedPmode.includes('CASH')) {
        paymentMode = 'COD';
      } else {
        paymentMode = 'COD';
      }

      // COD & Prepaid Amount calculation
      let codAmount = 0;
      let prepaidAmount = 0;
      let codRecoverableStatus: 'UNCOLLECTED_COD' | 'PREPAID_COLLECTED' | 'PARTIAL_SPLIT' = 'UNCOLLECTED_COD';

      if (paymentMode === 'PREPAID') {
        prepaidAmount = orderAmount;
        codAmount = 0;
        codRecoverableStatus = 'PREPAID_COLLECTED';
      } else if (paymentMode === 'PARTIAL COD') {
        const advance = Number(matchedSo?.advance_paid) || 0;
        const remaining = Number(matchedSo?.remaining_cod) || Math.max(0, orderAmount - advance);
        prepaidAmount = advance;
        codAmount = remaining;
        codRecoverableStatus = 'PARTIAL_SPLIT';
      } else {
        // Pure COD
        codAmount = orderAmount;
        prepaidAmount = 0;
        codRecoverableStatus = 'UNCOLLECTED_COD';
      }

      // Status Normalization
      let rtoStatus = 'Delivered to Seller';
      const rawStatusStr = String(shipment.status || shipment.raw_status || '').toLowerCase();
      if (rawStatusStr.includes('origin') || rawStatusStr.includes('delivered to seller') || rawStatusStr.includes('delivered')) {
        rtoStatus = 'Delivered to Seller';
      } else if (rawStatusStr.includes('transit')) {
        rtoStatus = 'RTO - In Transit';
      } else if (rawStatusStr.includes('initiat') || rawStatusStr.includes('created') || rawStatusStr.includes('pickup')) {
        rtoStatus = 'Initiated';
      } else {
        rtoStatus = shipment.status || 'RTO';
      }

      const courier = shipment.courier || 'Delhivery';
      const awbNumber = shipment.awb_number || '';
      const trackingUrl = shipment.tracking_url || (awbNumber ? `https://www.delhivery.com/track/package/${awbNumber}` : undefined);
      const rtoReason = shipment.remarks || shipment.raw_status || 'RTO Event Logged';

      return {
        id: shipment.id || `rto_${cleanOid}`,
        sales_order_id: matchedSo?.id,
        order_id: cleanOid,
        display_order_id: shipment.display_order_id || `#${cleanOid}`,
        order_date: orderDateDisplay,
        rto_event_date: eventIso,
        rto_event_date_display: eventDisplay,
        date_label_type: dateLabelType,
        customer_name: customerName,
        phone: phone,
        state: state,
        city: city,
        pincode: pincode,
        products: productsFormatted,
        items: items,
        quantity_returned: quantityReturned,
        order_amount: orderAmount,
        payment_mode: paymentMode,
        source_payment_method: sourcePaymentMethod,
        cod_amount: codAmount,
        prepaid_amount: prepaidAmount,
        cod_recoverable_status: codRecoverableStatus,
        rto_status: rtoStatus,
        courier: courier,
        awb_number: awbNumber,
        tracking_url: trackingUrl,
        rto_reason: rtoReason,
        raw_status: shipment.raw_status,
        remarks: shipment.remarks,
        raw_sales_order: matchedSo
      };
    });

    // Sort default: newest event date descending
    records.sort((a, b) => (b.rto_event_date || '').localeCompare(a.rto_event_date || ''));

    return records;
  }

  /**
   * Calculates the 10 canonical summary metrics for the provided filtered RTO records
   */
  calculateMetrics(records: RtoReturnOrderRecord[], totalSalesOrdersInPeriod: number = 0): RtoSummaryMetrics {
    const totalRtoOrders = records.length;
    let rtoDeliveredToSeller = 0;
    let totalProductsReturned = 0;
    let rtoOrderValue = 0;
    let codAmount = 0;
    let prepaidAmount = 0;
    let rtoInTransit = 0;

    records.forEach(r => {
      rtoOrderValue += r.order_amount;
      totalProductsReturned += r.quantity_returned;
      codAmount += r.cod_amount;
      prepaidAmount += r.prepaid_amount;

      if (r.rto_status === 'Delivered to Seller') {
        rtoDeliveredToSeller++;
      } else if (r.rto_status === 'RTO - In Transit' || r.rto_status === 'Initiated') {
        rtoInTransit++;
      }
    });

    const rtoAvgValue = totalRtoOrders > 0 ? Math.round(rtoOrderValue / totalRtoOrders) : 0;
    const rtoRate = totalSalesOrdersInPeriod > 0
      ? Number(((totalRtoOrders / totalSalesOrdersInPeriod) * 100).toFixed(1))
      : 0;

    return {
      totalRtoOrders,
      rtoDeliveredToSeller,
      totalProductsReturned,
      rtoOrderValue,
      codAmount,
      prepaidAmount,
      codUncollected: codAmount,
      prepaidCollected: prepaidAmount,
      rtoAvgValue,
      rtoRate,
      rtoInTransit
    };
  }
}

export const rtoReturnsService = new RtoReturnsService();

export function formatINR(val: number | null | undefined): string {
  if (!val || isNaN(val) || val === 0) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}
