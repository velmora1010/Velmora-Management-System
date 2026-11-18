import * as XLSX from 'xlsx';
import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../types';
import { calculateWebsitePaymentSummary, normalizeProductGroupingKey, resolveCanonicalProductName, resolveCanonicalLocation } from '../websiteSalesUtils';
import {
  calculateCanonicalRtoMetrics,
  getCanonicalStatus,
  normalizeCourierName,
  isCodOrder,
  isPrepaidOrder
} from '../../../Logistics/utils/logisticsAnalyticsUtils';
import {
  normalizeCustomerPhone,
  normalizeCityName,
  normalizeStateName,
  normalizeProductName
} from '../../../../services/customerRepeatAnalyticsService';
import { isComboItem } from '../components/TopPerformingProductsCombos';

export interface ExportWebsiteSalesAnalyticsOptions {
  startDate: string;
  endDate: string;
  orders: WebsiteConsolidatedOrder[];
}

/**
 * Format date string into DD-MMM-YYYY format (e.g. 01-Sep-2026)
 */
export function formatExcelDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const clean = String(dateStr).trim();
  const datePart = clean.split(/[T ]/)[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m <= 11) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(d).padStart(2, '0');
      return `${day}-${months[m]}-${y}`;
    }
  }
  return clean;
}

/**
 * Helper to get ordinal suffix for order number (1st, 2nd, 3rd, 4th...)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Applies optimal column widths, freeze pane and auto-filter to an XLSX worksheet
 */
function enhanceWorksheet(
  ws: XLSX.WorkSheet,
  headerRowIndex: number = 0,
  enableFilter: boolean = true,
  customFilterRange?: { s: { r: number; c: number }; e: { r: number; c: number } }
) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  // Set column widths based on cell content
  const colWidths: { wch: number }[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxLen = 10;
    for (let R = range.s.r; R <= Math.min(range.e.r, 500); ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) {
        const str = String(cell.v);
        // Do not let section titles distort column widths
        if (
          str.startsWith('SECTION ') ||
          str.startsWith('VELMORA -') ||
          str.startsWith('REPEAT CUSTOMER') ||
          str.startsWith('PAYMENT MODE SUMMARY')
        ) {
          continue;
        }
        if (str.length > maxLen) {
          maxLen = Math.min(str.length, 60);
        }
      }
    }
    colWidths.push({ wch: maxLen + 3 });
  }
  ws['!cols'] = colWidths;

  // Freeze pane on header row
  if (headerRowIndex >= 0) {
    ws['!views'] = [{ state: 'frozen', ySplit: headerRowIndex + 1 }];
  }

  // Enable auto-filter on data table
  if (customFilterRange) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range(customFilterRange)
    };
  } else if (enableFilter && range.e.r > headerRowIndex) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: range.s.c },
        e: { r: range.e.r, c: range.e.c }
      })
    };
  }
}

/**
 * Main export service to build and download the complete 8-sheet Website Sales Analytics workbook
 */
export async function exportWebsiteSalesAnalyticsExcel(options: ExportWebsiteSalesAnalyticsOptions): Promise<void> {
  const { startDate, endDate, orders } = options;

  // Filter out cancelled / deleted orders for product and customer analytics
  const validOrders = orders.filter(o => {
    const isCancelled =
      o.order_status === 'CANCELLED' ||
      o.cancellation?.status === 'CANCELLED' ||
      Boolean(o.cancelled_at) ||
      o.fulfillment_status === 'cancelled' ||
      o.order_status === 'DELETED';
    const finStatus = (o.financial_status || '').toLowerCase();
    const isRefunded = finStatus === 'refunded' || finStatus === 'voided';
    return !isCancelled && !isRefunded;
  });

  // =========================================================================
  // SHEET 1: Website Sales Analytics (Overall Executive Summary ONLY)
  // =========================================================================
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const totalUnits = orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Cancelled orders calculation for reconciliation
  const cancelledOrders = orders.filter(o => !validOrders.includes(o));
  const cancelledOrdersCount = cancelledOrders.length;
  const cancelledRevenue = cancelledOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const cancelledUnits = cancelledOrders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);

  // Net valid totals (reconciles with Customer Details and Top Products)
  const netValidOrdersCount = validOrders.length;
  const netValidRevenue = validOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const netValidUnits = validOrders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);
  const netAov = netValidOrdersCount > 0 ? Math.round(netValidRevenue / netValidOrdersCount) : 0;

  const paymentSummary = calculateWebsitePaymentSummary(orders);
  const {
    prepaidCount,
    prepaidRevenue,
    partialCodCount,
    partialCodRevenue,
    fullCodCount,
    fullCodRevenue,
    totalCodReceivable
  } = paymentSummary;

  const rtoMetrics = calculateCanonicalRtoMetrics(orders);
  const totalRtoOrders = rtoMetrics.totalRtoOrders;
  const totalRtoValue = rtoMetrics.totalRtoValue;
  const rtoRate = `${rtoMetrics.rtoRate}%`;
  const rtoAvgValue = rtoMetrics.rtoAvgValue;
  const rtoCodValue = rtoMetrics.rtoCodValue;
  const rtoPrepaidValue = rtoMetrics.rtoPrepaidValue;
  const rtoOrders = rtoMetrics.rtoOrders || [];

  const totalDeliveredOrders = rtoMetrics.totalDeliveredOrders;
  const totalDeliveredValue = rtoMetrics.totalDeliveredValue;
  const deliveryRate = `${rtoMetrics.deliveryRate}`;
  const deliveredCodValue = rtoMetrics.deliveredCodValue;
  const deliveredPrepaidValue = rtoMetrics.deliveredPrepaidValue;

  const s1Rows: (string | number)[][] = [
    ['WEBSITE SALES ANALYTICS SUMMARY'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['METRIC NAME', 'VALUE', 'UNIT / DETAIL'],
    ['Selected Start Date', formatExcelDate(startDate), 'DD-MMM-YYYY'],
    ['Selected End Date', formatExcelDate(endDate), 'DD-MMM-YYYY'],
    ['Total Placed Orders (Gross)', totalOrdersCount, 'Orders Placed in Period (Matches Order Details)'],
    ['Total Placed Revenue (Gross)', Math.round(totalRevenue), '₹ (INR) Gross Placed Value (Matches Order Details)'],
    ['Total Placed Units (Gross)', totalUnits, 'Cumulative Items Ordered'],
    ['Average Order Value (AOV)', avgOrderValue, '₹ per Order Average Ticket'],
    ['Cancelled / Voided Orders', cancelledOrdersCount, 'Excluded from Customer & Product Analytics'],
    ['Cancelled Order Value', Math.round(cancelledRevenue), '₹ (INR) Cancelled / Refunded Value'],
    ['Cancelled Units', cancelledUnits, 'Items in Cancelled Orders'],
    ['Net Valid Orders', netValidOrdersCount, 'Valid Purchases (Matches Customer Details)'],
    ['Net Valid Revenue', Math.round(netValidRevenue), '₹ (INR) Net Spend (Matches Customer Details)'],
    ['Net Valid Units', netValidUnits, 'Valid Units Sold (Matches Product Details)'],
    ['Delivered Orders', totalDeliveredOrders, 'Confirmed Delivered Shipments'],
    ['Delivered Order Value', Math.round(totalDeliveredValue), '₹ (INR) Confirmed Delivered Value'],
    ['Delivery Rate', deliveryRate, '% of Concluded Shipments'],
    ['Delivered COD Value', Math.round(deliveredCodValue), '₹ Pure COD Delivered Value'],
    ['Delivered Prepaid Value', Math.round(deliveredPrepaidValue), '₹ Prepaid & Partial COD Delivered Value'],
    ['Total RTO Orders', totalRtoOrders, 'Returned to Origin Shipments'],
    ['Total RTO Value', Math.round(totalRtoValue), '₹ (INR) Gross Returned Order Value'],
    ['RTO Rate', rtoRate, '% of Concluded Shipments'],
    ['RTO Average Value', rtoAvgValue, '₹ per RTO Order Average Ticket'],
    ['RTO COD Value', Math.round(rtoCodValue), '₹ Pure COD Returned Value'],
    ['RTO Prepaid Value', Math.round(rtoPrepaidValue), '₹ Prepaid & Partial COD Returned Value'],
    ['Prepaid Orders', prepaidCount, 'Orders with Full Advance Payment'],
    ['Prepaid Order Value', Math.round(prepaidRevenue), '₹ (INR) Received'],
    ['Partial COD Orders', partialCodCount, 'Orders with Advance + Pending Balance'],
    ['Partial COD Order Value', Math.round(partialCodRevenue), '₹ (INR) Placed Value'],
    ['Full COD Orders', fullCodCount, 'Orders with Zero Advance Payment'],
    ['Full COD Order Value', Math.round(fullCodRevenue), '₹ (INR) Placed Value'],
    ['Total COD Receivable', Math.round(totalCodReceivable), '₹ (INR) Pending from Courier/Customer']
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);
  enhanceWorksheet(ws1, 4, false);

  // =========================================================================
  // SHEET 2: RTO Summary & Customer Details
  // =========================================================================
  const s2RtoSummaryRows: (string | number)[][] = [
    ['RTO SUMMARY & CUSTOMER DETAILS'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - RTO SUMMARY'],
    ['RTO METRIC', 'VALUE', 'UNIT / DETAIL'],
    ['Total RTO Orders', totalRtoOrders, 'Returned to Origin Shipments'],
    ['Total RTO Value', Math.round(totalRtoValue), '₹ (INR) Gross Returned Order Value'],
    ['RTO Rate', rtoRate, '% of Concluded Shipments'],
    ['RTO Average Value', rtoAvgValue, '₹ per RTO Order Average Ticket'],
    ['RTO COD Value', Math.round(rtoCodValue), '₹ Pure COD Returned Value'],
    ['RTO Prepaid Value', Math.round(rtoPrepaidValue), '₹ Prepaid & Partial COD Returned Value']
  ];

  const rtoDetailHeaders = [
    'S.No',
    'Order ID',
    'Order Date',
    'RTO Date',
    'Customer Name',
    'Phone Number',
    'City',
    'State',
    'Payment Mode',
    'RTO Order Value (₹)',
    'COD Value (₹)',
    'Prepaid Value (₹)',
    'RTO Status / Reason'
  ];

  const rtoDetailDataRows: (string | number)[][] = rtoOrders.length > 0
    ? rtoOrders.map((o: any, idx: number) => {
        const orderPrice = Math.round(Number(o.price) || Number(o.order_total) || 0);
        const isCod = isCodOrder(o);
        const isPrepaid = isPrepaidOrder(o);

        // Reconciled with dashboard rules: Pure COD goes to COD Value, Prepaid & Partial COD go to Prepaid Value
        const codVal = isCod ? orderPrice : 0;
        const prepaidVal = isPrepaid ? orderPrice : 0;

        const canonical = getCanonicalStatus(o);
        const rawStatus = (o as any).shipment_status || (o as any).raw_status || (o as any).extra_data?.raw_status || canonical;
        const reason = (o as any).reason || (o as any).extra_data?.rto_reason || (o as any).extra_data?.ndr_reason || (o as any).extra_data?.remarks || '';
        const statusReason = reason ? `${rawStatus} - ${reason}` : rawStatus || 'RTO';

        const rtoDateRaw =
          (o as any).rto_date ||
          (o as any).rtoDate ||
          (o as any).extra_data?.rto_date ||
          (o as any).extra_data?.rto_delivered_date ||
          (o as any).extra_data?.rtoDeliveredDate ||
          (o as any).delivered_date ||
          (o as any).fulfilled_date;

        return [
          idx + 1,
          o.order_id || o.id,
          formatExcelDate(o.order_date),
          formatExcelDate(rtoDateRaw),
          o.customer_name || 'Customer',
          o.phone ? String(o.phone) : '-',
          normalizeCityName(o.city) || 'Unspecified',
          normalizeStateName(o.state) || 'Unspecified',
          o.payment_mode || 'UNKNOWN',
          orderPrice,
          codVal,
          prepaidVal,
          statusReason
        ];
      })
    : [['-', '-', '-', '-', 'No RTO orders recorded in the selected period', '-', '-', '-', '-', 0, 0, 0, '-']];

  const s2RtoRows: (string | number)[][] = [
    ...s2RtoSummaryRows,
    [],
    ['SECTION B - RTO CUSTOMER DETAILS'],
    rtoDetailHeaders,
    ...rtoDetailDataRows
  ];

  const wsRto = XLSX.utils.aoa_to_sheet(s2RtoRows);
  const rtoHeaderRowIndex = s2RtoSummaryRows.length + 2; // Row index of Section B table header
  enhanceWorksheet(wsRto, rtoHeaderRowIndex, true, {
    s: { r: rtoHeaderRowIndex, c: 0 },
    e: { r: s2RtoRows.length - 1, c: rtoDetailHeaders.length - 1 }
  });

  // =========================================================================
  // WORKSHEET: Cancelled Orders (Pre-Dispatch Summary & Customer Audit)
  // =========================================================================
  const cancelledOrdersList = rtoMetrics.cancelledOrders || orders.filter(o => getCanonicalStatus(o) === 'Cancelled');
  const totalCancelledOrders = rtoMetrics.cancelledCount ?? cancelledOrdersList.length;
  const totalCancelledValue = rtoMetrics.cancelledValue ?? cancelledOrdersList.reduce((sum, o) => sum + (Number(o.price) || Number(o.order_total) || 0), 0);

  const cancelledDetailHeaders = [
    'S.No',
    'Order ID',
    'Order Date',
    'Customer Name',
    'Phone Number',
    'State',
    'City',
    'Order Value (₹)',
    'Payment Mode',
    'Product / Items',
    'Quantity',
    'Cancellation Date',
    'Cancellation Reason',
    'Dispatch Status'
  ];

  const cancelledDetailDataRows: (string | number)[][] = cancelledOrdersList.length > 0
    ? cancelledOrdersList.map((o: any, idx: number) => {
        const orderPrice = Math.round(Number(o.price) || Number(o.order_total) || 0);
        const resolvedLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
        const cState = o.canonicalState || resolvedLoc.stateName || normalizeStateName(o.state) || 'Unspecified';
        const cCity = o.canonicalCity || resolvedLoc.cityName || normalizeCityName(o.city) || 'Unspecified';

        const cancelDateRaw =
          o.cancellation?.cancelled_at ||
          o.cancellation?.requested_at ||
          o.extra_data?.cancellation?.cancelled_at ||
          o.extra_data?.cancellation_date ||
          o.order_date;

        const cancelReason =
          o.cancellation?.reason ||
          o.extra_data?.cancellation?.reason ||
          o.extra_data?.cancellation_reason ||
          'Cancelled in source export (Shopify)';

        const dStatus = o.dispatch_status || o.extra_data?.dispatch_status || 'Pre-Dispatch Cancelled';

        const prodDesc = o.order_formatted || o.product_name || (o.items && o.items.length > 0 ? o.items.map((it: any) => `${it.product_name} × ${it.quantity}`).join(' | ') : 'Standard Products');

        return [
          idx + 1,
          o.order_id || o.id,
          formatExcelDate(o.order_date),
          o.customer_name || 'N/A',
          o.phone ? String(o.phone) : '-',
          cState,
          cCity,
          orderPrice,
          o.payment_mode || 'UNKNOWN',
          prodDesc,
          o.total_quantity || 1,
          formatExcelDate(cancelDateRaw),
          cancelReason,
          dStatus
        ];
      })
    : [['-', '-', '-', 'No cancelled orders recorded in the selected period', '-', '-', '-', 0, '-', '-', 0, '-', '-', '-']];

  const sCancelledSummaryRows: (string | number)[][] = [
    ['VELMORA - CANCELLED ORDERS (PRE-DISPATCH SUMMARY & AUDIT)'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Cancelled Orders', totalCancelledOrders, 'Total pre-dispatch cancelled orders for period'],
    ['Total Cancelled Value (₹)', totalCancelledValue, 'Cumulative monetary value of cancelled orders (₹)'],
    ['Lifecycle Stage', 'Pre-Dispatch (Excluded from carrier fulfillment & delivery SLA)', 'Classification'],
    [],
    ['SECTION B - CANCELLED ORDER DETAILS']
  ];

  const sCancelledRows: (string | number)[][] = [
    ...sCancelledSummaryRows,
    cancelledDetailHeaders,
    ...cancelledDetailDataRows
  ];

  const wsCancelled = XLSX.utils.aoa_to_sheet(sCancelledRows);
  const cancelledHeaderRowIndex = sCancelledSummaryRows.length; // Row index of cancelledDetailHeaders
  enhanceWorksheet(wsCancelled, cancelledHeaderRowIndex, true, {
    s: { r: cancelledHeaderRowIndex, c: 0 },
    e: { r: sCancelledRows.length - 1, c: cancelledDetailHeaders.length - 1 }
  });

  // =========================================================================
  // SHEET 2: Repeat Customer Summary
  // =========================================================================
  // Group valid orders by unique customer
  const seenOrderIds = new Set<string>();
  const deduplicatedValidOrders: WebsiteConsolidatedOrder[] = [];
  for (const o of validOrders) {
    const cleanId = String(o.order_id || o.id || '').trim().toLowerCase();
    if (!cleanId || seenOrderIds.has(cleanId)) continue;
    seenOrderIds.add(cleanId);
    deduplicatedValidOrders.push(o);
  }

  const customerGroupMap = new Map<string, {
    name: string;
    phone: string;
    city: string;
    state: string;
    orders: WebsiteConsolidatedOrder[];
  }>();

  for (const o of deduplicatedValidOrders) {
    const rawPhone = o.phone || (o as any).phoneNumber;
    const phoneNorm = normalizeCustomerPhone(rawPhone);
    const emailNorm = (o.email || '').toLowerCase().trim();
    const cleanOrderId = String(o.order_id || '').trim().toLowerCase();

    let custKey = '';
    if (phoneNorm) {
      custKey = `phone_${phoneNorm}`;
    } else if (emailNorm) {
      custKey = `email_${emailNorm}`;
    } else if ((o as any).customer_id) {
      custKey = `custid_${(o as any).customer_id}`;
    } else {
      custKey = `order_${cleanOrderId || o.id}`;
    }

    const rawCity = o.city || (o as any).canonicalCity;
    const rawState = o.state || (o as any).canonicalState;
    const normCity = normalizeCityName(rawCity);
    const normState = normalizeStateName(rawState);

    if (!customerGroupMap.has(custKey)) {
      customerGroupMap.set(custKey, {
        name: o.customer_name || 'Customer',
        phone: phoneNorm || (rawPhone ? String(rawPhone) : ''),
        city: normCity || 'Unspecified',
        state: normState || 'Unspecified',
        orders: []
      });
    }
    customerGroupMap.get(custKey)!.orders.push(o);
  }

  // Filter qualifying repeat customers (2+ valid orders in selected period)
  const repeatCustomerProfiles = Array.from(customerGroupMap.values())
    .filter(c => c.orders.length >= 2)
    .map(c => {
      const sortedOrders = [...c.orders].sort((a, b) =>
        (a.order_date || '').localeCompare(b.order_date || '')
      );
      const ordersCount = sortedOrders.length;
      const totalNetSpend = sortedOrders.reduce((sum, ord) => sum + (Number(ord.price) || 0), 0);
      const aov = ordersCount > 0 ? Math.round(totalNetSpend / ordersCount) : 0;

      // Find top product purchased by quantity
      const prodFreqMap = new Map<string, number>();
      sortedOrders.forEach(ord => {
        if (Array.isArray(ord.items) && ord.items.length > 0) {
          ord.items.forEach(it => {
            const p = resolveCanonicalProductName(it.product_name, it.product_code);
            prodFreqMap.set(p, (prodFreqMap.get(p) || 0) + (Number(it.quantity) || 1));
          });
        } else {
          const p = resolveCanonicalProductName(ord.product_name);
          prodFreqMap.set(p, (prodFreqMap.get(p) || 0) + (Number(ord.total_quantity) || 1));
        }
      });
      let topProduct = '-';
      let maxQty = 0;
      prodFreqMap.forEach((qty, pName) => {
        if (qty > maxQty) {
          maxQty = qty;
          topProduct = pName;
        }
      });

      return {
        name: c.name,
        phone: c.phone,
        city: c.city,
        state: c.state,
        ordersCount,
        repeatCount: ordersCount - 1,
        totalNetSpend: Math.round(totalNetSpend),
        aov,
        topProduct,
        firstPurchaseDate: sortedOrders[0]?.order_date,
        lastPurchaseDate: sortedOrders[sortedOrders.length - 1]?.order_date,
        orders: sortedOrders
      };
    })
    .sort((a, b) => b.ordersCount - a.ordersCount || b.totalNetSpend - a.totalNetSpend);

  const totalRepeatCount = repeatCustomerProfiles.length;
  const count2Orders = repeatCustomerProfiles.filter(c => c.ordersCount === 2).length;
  const count3Orders = repeatCustomerProfiles.filter(c => c.ordersCount === 3).length;
  const count4Orders = repeatCustomerProfiles.filter(c => c.ordersCount === 4).length;
  const count5PlusOrders = repeatCustomerProfiles.filter(c => c.ordersCount >= 5).length;

  const maxOrdersInPeriod = repeatCustomerProfiles.reduce(
    (max, c) => Math.max(max, c.orders.length),
    0
  );

  const dynamicOrderHeaders: string[] = [];
  for (let i = 1; i <= maxOrdersInPeriod; i++) {
    const ordStr = getOrdinal(i);
    dynamicOrderHeaders.push(`${ordStr} Order Date`, `${ordStr} Order Product`);
  }

  const s2Headers = [
    'Rank',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'Valid Order Count',
    'Repeat Count',
    'Total Net Spend (₹)',
    'Average Order Value (₹)',
    'Top Product',
    'First Purchase Date',
    'Last Purchase Date',
    ...dynamicOrderHeaders
  ];

  const s2Rows: (string | number)[][] = [
    ['REPEAT CUSTOMER SUMMARY (SELECTED PERIOD)'],
    ['Total Repeat Customers', totalRepeatCount],
    ['Exactly 2 Orders', count2Orders],
    ['Exactly 3 Orders', count3Orders],
    ['Exactly 4 Orders', count4Orders],
    ['5+ Orders', count5PlusOrders],
    [],
    s2Headers,
    ...repeatCustomerProfiles.map((c, idx) => {
      const orderPairs: (string | number)[] = [];
      for (let i = 0; i < maxOrdersInPeriod; i++) {
        const ord = c.orders[i];
        if (ord) {
          let pStr = '';
          if (Array.isArray(ord.items) && ord.items.length > 0) {
            const map = new Map<string, number>();
            ord.items.forEach(it => {
              const p = resolveCanonicalProductName(it.product_name, it.product_code);
              map.set(p, (map.get(p) || 0) + (Number(it.quantity) || 1));
            });
            pStr = Array.from(map.entries())
              .map(([pn, pq]) => `${pn} × ${pq}`)
              .join('; ');
          } else {
            const p = resolveCanonicalProductName(ord.product_name);
            pStr = `${p} × ${ord.total_quantity || 1}`;
          }
          orderPairs.push(formatExcelDate(ord.order_date), pStr);
        } else {
          orderPairs.push('-', '-');
        }
      }
      return [
        idx + 1,
        c.name,
        c.phone ? String(c.phone) : '-',
        c.city,
        c.state,
        c.ordersCount,
        c.repeatCount,
        c.totalNetSpend,
        c.aov,
        c.topProduct,
        formatExcelDate(c.firstPurchaseDate),
        formatExcelDate(c.lastPurchaseDate),
        ...orderPairs
      ];
    })
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);
  enhanceWorksheet(ws2, 7, true);

  // =========================================================================
  // SHEET 3: Payment Mode Breakdown
  // =========================================================================
  const s3Rows: (string | number)[][] = [
    ['PAYMENT MODE SUMMARY (SELECTED PERIOD)'],
    [
      'Payment Mode',
      'Number of Orders',
      'Total Order Value (₹)',
      'Amount Received (₹)',
      'Pending COD (₹)',
      'Percentage of Orders (%)',
      'Percentage of Revenue (%)'
    ],
    [
      'Prepaid',
      prepaidCount,
      Math.round(prepaidRevenue),
      Math.round(prepaidRevenue),
      0,
      totalOrdersCount > 0 ? `${((prepaidCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      totalRevenue > 0 ? `${((prepaidRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Partial COD',
      partialCodCount,
      Math.round(partialCodRevenue),
      Math.round(partialCodRevenue - totalCodReceivable),
      Math.round(totalCodReceivable),
      totalOrdersCount > 0 ? `${((partialCodCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      totalRevenue > 0 ? `${((partialCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Full COD',
      fullCodCount,
      Math.round(fullCodRevenue),
      0,
      Math.round(fullCodRevenue),
      totalOrdersCount > 0 ? `${((fullCodCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      totalRevenue > 0 ? `${((fullCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Total',
      totalOrdersCount,
      Math.round(totalRevenue),
      Math.round(prepaidRevenue + (partialCodRevenue - totalCodReceivable)),
      Math.round(totalCodReceivable + fullCodRevenue),
      '100.0%',
      '100.0%'
    ],
    [],
    ['ORDER-LEVEL PAYMENT RECORDS'],
    [
      'Order ID',
      'Order Date',
      'Customer Name',
      'Phone',
      'City',
      'State',
      'Payment Mode',
      'Order Value (₹)',
      'Amount Received (₹)',
      'Pending COD (₹)',
      'Order Status'
    ],
    ...orders.map(o => {
      const isPre = o.payment_mode === 'PREPAID';
      const isPart = o.payment_mode === 'PARTIAL COD';
      const val = Number(o.price) || 0;
      const rem = Number(o.remaining_payable) || 0;
      const rec = isPre ? val : (isPart ? Math.max(0, val - rem) : 0);
      const pend = isPre ? 0 : (isPart ? rem : val);
      return [
        o.order_id || o.id,
        formatExcelDate(o.order_date),
        o.customer_name || 'Customer',
        o.phone ? String(o.phone) : '-',
        o.city || 'Unspecified',
        o.state || 'Unspecified',
        o.payment_mode || 'UNKNOWN',
        Math.round(val),
        Math.round(rec),
        Math.round(pend),
        o.order_status || 'CONFIRMED'
      ];
    })
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(s3Rows);
  enhanceWorksheet(ws3, 8, true);

  // =========================================================================
  // SHEET 4: Revenue Mix (5 Structured Sections)
  // =========================================================================
  // 4A. By Payment Mode
  const s4PaymentRows: (string | number)[][] = [
    ['1. REVENUE MIX BY PAYMENT MODE'],
    ['Payment Mode', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ['Prepaid', prepaidCount, Math.round(prepaidRevenue), totalRevenue > 0 ? `${((prepaidRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'],
    ['Partial COD', partialCodCount, Math.round(partialCodRevenue), totalRevenue > 0 ? `${((partialCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'],
    ['Full COD', fullCodCount, Math.round(fullCodRevenue), totalRevenue > 0 ? `${((fullCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%']
  ];

  // 4B. By Order State
  const stateAggMap = new Map<string, { orders: number; rev: number }>();
  orders.forEach(o => {
    const st = normalizeStateName(o.state) || 'Unspecified';
    if (!stateAggMap.has(st)) stateAggMap.set(st, { orders: 0, rev: 0 });
    const e = stateAggMap.get(st)!;
    e.orders += 1;
    e.rev += (Number(o.price) || 0);
  });
  const stateAggList = Array.from(stateAggMap.entries()).sort((a, b) => b[1].rev - a[1].rev);
  const s4StateRows: (string | number)[][] = [
    [],
    ['2. REVENUE MIX BY ORDER STATE'],
    ['State', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...stateAggList.map(([st, d]) => [
      st,
      d.orders,
      Math.round(d.rev),
      totalRevenue > 0 ? `${((d.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  // 4C. By Product
  const prodMixMap = new Map<string, { orderIds: Set<string>; rev: number }>();
  orders.forEach(o => {
    const oId = String(o.order_id || o.id);
    if (Array.isArray(o.items) && o.items.length > 0) {
      o.items.forEach(it => {
        const p = resolveCanonicalProductName(it.product_name, it.product_code);
        if (!prodMixMap.has(p)) prodMixMap.set(p, { orderIds: new Set(), rev: 0 });
        const e = prodMixMap.get(p)!;
        e.orderIds.add(oId);
        const lTot = it.line_total != null
          ? Number(it.line_total)
          : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * (Number(it.quantity) || 1);
        e.rev += lTot;
      });
    } else {
      const p = resolveCanonicalProductName(o.product_name);
      if (!prodMixMap.has(p)) prodMixMap.set(p, { orderIds: new Set(), rev: 0 });
      const e = prodMixMap.get(p)!;
      e.orderIds.add(oId);
      e.rev += (Number(o.price) || 0);
    }
  });
  const prodMixList = Array.from(prodMixMap.entries()).sort((a, b) => b[1].rev - a[1].rev);
  const s4ProdRows: (string | number)[][] = [
    [],
    ['3. REVENUE MIX BY PRODUCT'],
    ['Product Name', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...prodMixList.map(([p, d]) => [
      p,
      d.orderIds.size,
      Math.round(d.rev),
      totalRevenue > 0 ? `${((d.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  // 4D. By Offer
  const offerAggMap = new Map<string, { orders: number; rev: number }>();
  orders.forEach(o => {
    const off = o.offer && o.offer !== '-' ? o.offer.trim() : 'No Offer';
    if (!offerAggMap.has(off)) offerAggMap.set(off, { orders: 0, rev: 0 });
    const e = offerAggMap.get(off)!;
    e.orders += 1;
    e.rev += (Number(o.price) || 0);
  });
  const offerAggList = Array.from(offerAggMap.entries()).sort((a, b) => b[1].rev - a[1].rev);
  const s4OfferRows: (string | number)[][] = [
    [],
    ['4. REVENUE MIX BY OFFER'],
    ['Offer Name', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...offerAggList.map(([off, d]) => [
      off,
      d.orders,
      Math.round(d.rev),
      totalRevenue > 0 ? `${((d.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  // 4E. By Order Value Range
  const valueBuckets = [
    { label: 'Below ₹500', min: 0, max: 499.99, orders: 0, rev: 0 },
    { label: '₹500–₹749', min: 500, max: 749.99, orders: 0, rev: 0 },
    { label: '₹750–₹999', min: 750, max: 999.99, orders: 0, rev: 0 },
    { label: '₹1,000–₹1,299', min: 1000, max: 1299.99, orders: 0, rev: 0 },
    { label: '₹1,300–₹1,499', min: 1300, max: 1499.99, orders: 0, rev: 0 },
    { label: '₹1,500 and above', min: 1500, max: Infinity, orders: 0, rev: 0 }
  ];
  orders.forEach(o => {
    const price = Number(o.price) || 0;
    const b = valueBuckets.find(bucket => price >= bucket.min && price <= bucket.max);
    if (b) {
      b.orders += 1;
      b.rev += price;
    }
  });
  const s4RangeRows: (string | number)[][] = [
    [],
    ['5. REVENUE MIX BY ORDER VALUE RANGE'],
    ['Order Value Range', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...valueBuckets.map(b => [
      b.label,
      b.orders,
      Math.round(b.rev),
      totalRevenue > 0 ? `${((b.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  const ws4 = XLSX.utils.aoa_to_sheet([
    ...s4PaymentRows,
    ...s4StateRows,
    ...s4ProdRows,
    ...s4OfferRows,
    ...s4RangeRows
  ]);
  enhanceWorksheet(ws4, 1, false);

  // =========================================================================
  // SHEET 5: Top Performing Products & SHEET 6: Top Performing Combos
  // =========================================================================
  const productAggMap = new Map<string, { qty: number; rev: number; ordersSet: Set<string> }>();
  const comboAggMap = new Map<string, { qty: number; rev: number; ordersSet: Set<string> }>();

  orders.forEach(o => {
    // Exclude cancelled / deleted orders
    if (
      o.order_status === 'CANCELLED' ||
      o.cancellation?.status === 'CANCELLED' ||
      Boolean(o.cancelled_at) ||
      o.fulfillment_status === 'cancelled' ||
      o.order_status === 'DELETED'
    ) {
      return;
    }

    const orderKey = String(o.order_id || o.id || 'unknown');

    if (Array.isArray(o.items) && o.items.length > 0) {
      o.items.forEach((it: WebsiteOrderItem) => {
        const rawName = (it.product_name || 'Unspecified').trim();
        if (!rawName) return;

        const canonicalName = resolveCanonicalProductName(rawName, it.product_code);
        const isCombo = isComboItem(rawName) || isComboItem(canonicalName);
        const targetMap = isCombo ? comboAggMap : productAggMap;

        const qty = Number(it.quantity) || 1;
        const rev = it.line_total != null
          ? Number(it.line_total)
          : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;

        if (!targetMap.has(canonicalName)) {
          targetMap.set(canonicalName, { qty: 0, rev: 0, ordersSet: new Set() });
        }
        const entry = targetMap.get(canonicalName)!;
        entry.qty += qty;
        entry.rev += rev;
        entry.ordersSet.add(orderKey);
      });
    } else {
      const rawName = (o.product_name || 'Unspecified').trim();
      if (!rawName || rawName === 'N/A') return;

      const canonicalName = resolveCanonicalProductName(rawName);
      const isCombo = isComboItem(rawName) || isComboItem(canonicalName);
      const targetMap = isCombo ? comboAggMap : productAggMap;

      const qty = Number(o.total_quantity) || 1;
      const rev = Number(o.price) || 0;

      if (!targetMap.has(canonicalName)) {
        targetMap.set(canonicalName, { qty: 0, rev: 0, ordersSet: new Set() });
      }
      const entry = targetMap.get(canonicalName)!;
      entry.qty += qty;
      entry.rev += rev;
      entry.ordersSet.add(orderKey);
    }
  });

  const allProductsList = Array.from(productAggMap.entries()).map(([name, d]) => ({
    name,
    rev: d.rev,
    qty: d.qty,
    orders: d.ordersSet.size,
    avgPrice: d.qty > 0 ? Math.round(d.rev / d.qty) : 0
  })).sort((a, b) => b.rev - a.rev);
  const totalProductsRev = allProductsList.reduce((s, p) => s + p.rev, 0);

  const s5Rows: (string | number)[][] = [
    ['Rank', 'Product Name', 'Sales Revenue (₹)', 'Quantity Sold', 'Number of Orders', 'Average Selling Price (₹)', 'Revenue Share (%)'],
    ...allProductsList.map((p, idx) => [
      idx + 1,
      p.name,
      Math.round(p.rev),
      p.qty,
      p.orders,
      p.avgPrice,
      totalProductsRev > 0 ? `${((p.rev / totalProductsRev) * 100).toFixed(1)}%` : '0%'
    ])
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(s5Rows);
  enhanceWorksheet(ws5, 0, true);

  const allCombosList = Array.from(comboAggMap.entries()).map(([name, d]) => ({
    name,
    rev: d.rev,
    qty: d.qty,
    orders: d.ordersSet.size,
    avgPrice: d.qty > 0 ? Math.round(d.rev / d.qty) : 0
  })).sort((a, b) => b.rev - a.rev);
  const totalCombosRev = allCombosList.reduce((s, c) => s + c.rev, 0);

  const s6Rows: (string | number)[][] = [
    ['Rank', 'Combo Name', 'Sales Revenue (₹)', 'Quantity Sold', 'Number of Orders', 'Average Selling Price (₹)', 'Revenue Share (%)'],
    ...(allCombosList.length > 0 ? allCombosList.map((c, idx) => [
      idx + 1,
      c.name,
      Math.round(c.rev),
      c.qty,
      c.orders,
      c.avgPrice,
      totalCombosRev > 0 ? `${((c.rev / totalCombosRev) * 100).toFixed(1)}%` : '0%'
    ]) : [['-', 'No combo sales recorded in the selected period', 0, 0, 0, 0, '0.0%']])
  ];
  const ws6 = XLSX.utils.aoa_to_sheet(s6Rows);
  enhanceWorksheet(ws6, 0, true);

  // =========================================================================
  // SHEET 7: Customer Details (All Customers in Selected Period)
  // =========================================================================
  const allEligibleCustomers = Array.from(customerGroupMap.values()).map(c => {
    const sortedOrders = [...c.orders].sort((a, b) =>
      (a.order_date || '').localeCompare(b.order_date || '')
    );
    const totalCustOrders = sortedOrders.length;
    const totalCustUnits = sortedOrders.reduce((sum, ord) => sum + (Number(ord.total_quantity) || 0), 0);
    const totalCustRevenue = sortedOrders.reduce((sum, ord) => sum + (Number(ord.price) || 0), 0);
    const custAov = totalCustOrders > 0 ? Math.round(totalCustRevenue / totalCustOrders) : 0;
    const paymentModesStr = Array.from(new Set(sortedOrders.map(o => o.payment_mode || 'UNKNOWN'))).join(', ');
    const firstOrderDate = sortedOrders[0]?.order_date;
    const lastOrderDate = sortedOrders[sortedOrders.length - 1]?.order_date;

    const prodSummaryMap = new Map<string, number>();
    sortedOrders.forEach(ord => {
      if (Array.isArray(ord.items) && ord.items.length > 0) {
        ord.items.forEach(it => {
          const p = resolveCanonicalProductName(it.product_name, it.product_code);
          prodSummaryMap.set(p, (prodSummaryMap.get(p) || 0) + (Number(it.quantity) || 1));
        });
      } else {
        const p = resolveCanonicalProductName(ord.product_name);
        prodSummaryMap.set(p, (prodSummaryMap.get(p) || 0) + (Number(ord.total_quantity) || 1));
      }
    });
    const productsPurchasedStr = Array.from(prodSummaryMap.entries())
      .map(([name, qty]) => `${name} × ${qty}`)
      .join('; ');

    return {
      name: c.name,
      phone: c.phone,
      city: c.city,
      state: c.state,
      totalOrders: totalCustOrders,
      totalUnits: totalCustUnits,
      totalRevenue: Math.round(totalCustRevenue),
      aov: custAov,
      paymentMode: paymentModesStr,
      firstOrderDate,
      lastOrderDate,
      productsPurchased: productsPurchasedStr
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  const s7Rows: (string | number)[][] = [
    [
      'Customer Name',
      'Phone',
      'City',
      'State',
      'Total Orders',
      'Total Units',
      'Total Revenue (₹)',
      'Average Order Value (₹)',
      'Payment Mode',
      'First Order Date',
      'Last Order Date',
      'Products Purchased'
    ],
    ...allEligibleCustomers.map(c => [
      c.name,
      c.phone ? String(c.phone) : '-',
      c.city,
      c.state,
      c.totalOrders,
      c.totalUnits,
      c.totalRevenue,
      c.aov,
      c.paymentMode,
      formatExcelDate(c.firstOrderDate),
      formatExcelDate(c.lastOrderDate),
      c.productsPurchased
    ])
  ];
  const ws7 = XLSX.utils.aoa_to_sheet(s7Rows);
  enhanceWorksheet(ws7, 0, true);

  // =========================================================================
  // SHEET 8: Order Details (Granular Orders for Selected Period)
  // =========================================================================
  const s8Rows: (string | number)[][] = [
    [
      'Order ID',
      'Order Date',
      'Customer Name',
      'Phone',
      'City',
      'State',
      'Products',
      'Quantities',
      'Product Revenue (₹)',
      'Order Revenue (₹)',
      'Payment Mode',
      'Financial Status',
      'Fulfillment Status',
      'Order Status'
    ],
    ...orders.map(o => {
      let prods = '';
      let qtys = '';
      if (Array.isArray(o.items) && o.items.length > 0) {
        prods = o.items.map(it => resolveCanonicalProductName(it.product_name, it.product_code)).join(', ');
        qtys = o.items.map(it => it.quantity || 1).join(', ');
      } else {
        prods = resolveCanonicalProductName(o.product_name);
        qtys = String(o.total_quantity || 1);
      }

      const extra = (o as any).extra_data || {};
      const financialStatus = o.financial_status || extra.financial_status || (o.payment_mode === 'PREPAID' ? 'paid' : 'pending');
      const fulfillmentStatus = o.fulfillment_status || extra.fulfillment_status || o.dispatch_status || 'unfulfilled';
      const orderPrice = Number(Number(o.price || 0).toFixed(2));

      return [
        o.order_id || o.id,
        formatExcelDate(o.order_date),
        o.customer_name || 'Customer',
        o.phone ? String(o.phone) : '-',
        normalizeCityName(o.city) || 'Unspecified',
        normalizeStateName(o.state) || 'Unspecified',
        prods,
        qtys,
        orderPrice,
        orderPrice,
        o.payment_mode || 'UNKNOWN',
        financialStatus,
        fulfillmentStatus,
        o.order_status || 'CONFIRMED'
      ];
    })
  ];
  const ws8 = XLSX.utils.aoa_to_sheet(s8Rows);
  enhanceWorksheet(ws8, 0, true);

  // =========================================================================
  // =========================================================================
  // SHEET 10: Courier Reconciliation & Performance Breakdown
  // =========================================================================
  const courierPerfList = rtoMetrics.courierPerformance || [];
  const activeOrdersCount = orders.length - cancelledOrdersList.length;

  let totalOtherStatuses = 0;
  courierPerfList.forEach(c => {
    totalOtherStatuses += c.otherStatuses || 0;
  });

  // Count missing AWB and unknown courier orders
  let missingAwbCount = 0;
  let unknownCourierCount = 0;
  orders.forEach(o => {
    const canonical = getCanonicalStatus(o);
    if (canonical === 'Cancelled') return;
    const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
    const cour = (o.courier || (o as any).extra_data?.courier || '').trim();
    if (!awb) missingAwbCount++;
    if (!cour || cour.toLowerCase().includes('unknown') || cour.toLowerCase().includes('not available')) unknownCourierCount++;
  });
  const reconciledRecordsCount = orders.length - unknownCourierCount - cancelledOrdersList.length;

  const s10ReconRows: (string | number)[][] = [
    ['VELMORA - COURIER RECONCILIATION & PERFORMANCE'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - EXECUTIVE RECONCILIATION SUMMARY'],
    ['Metric Name', 'Value', 'Unit / Detail'],
    ['Total Website Orders', orders.length, 'Total orders recorded in sales dataset for period'],
    ['Active Fulfillable Shipments', activeOrdersCount, 'Orders requiring carrier fulfillment (excluding cancelled)'],
    ['Cancelled Orders (Pre-Dispatch)', cancelledOrdersList.length, 'Orders cancelled prior to dispatch; excluded from carrier SLAs'],
    ['Reconciled with Carrier Manifest', reconciledRecordsCount, 'Shipments linked to verified courier partner reports'],
    ['Unmatched / Awaiting Tracking Report', unknownCourierCount, 'Orders lacking uploaded carrier tracking reports'],
    ['Missing AWB Tracking Numbers', missingAwbCount, 'Orders without waybill numbers assigned'],
    ['Delivered Shipments', totalDeliveredOrders, 'Orders verified as Delivered by carrier'],
    ['RTO Returns', totalRtoOrders, 'Orders returned to origin / delivered to seller'],
    ['In Transit Shipments', rtoMetrics.inTransitCount, 'Shipments actively in carrier transit'],
    ['Other Statuses', totalOtherStatuses, 'Shipments in pickup pending, out for delivery, or attempt stages'],
    ['Carrier Delivery Rate', `${deliveryRate}%`, '% of concluded carrier shipments'],
    ['Carrier RTO Return Rate', `${rtoRate}%`, '% of concluded carrier shipments'],
    [],
    ['SECTION B - CARRIER PERFORMANCE BREAKDOWN'],
    [
      'Courier Partner',
      'Total Orders',
      'Delivered',
      'RTO',
      'In Transit',
      'Other Statuses',
      'Cancelled',
      'Delivery Rate (%)',
      'RTO Rate (%)'
    ],
    ...courierPerfList.map(c => [
      c.courier,
      c.total,
      c.delivered,
      c.rto,
      c.inTransit,
      c.otherStatuses || 0,
      c.cancelled || 0,
      c.deliveryRate,
      c.rtoRate
    ]),
    [
      'Total Reconciled',
      orders.length,
      totalDeliveredOrders,
      totalRtoOrders,
      rtoMetrics.inTransitCount,
      totalOtherStatuses,
      cancelledOrdersList.length,
      `${deliveryRate}%`,
      `${rtoRate}%`
    ]
  ];

  // Section C: Cancelled / Non-Fulfillable Orders (Exact 5 missing records)
  const s10CancelledHeaders = [
    'S.No',
    'Order ID',
    'Order Date',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'Order Value (₹)',
    'Carrier',
    'AWB Number',
    'Reconciliation Outcome / Exclusion Reason'
  ];

  const s10CancelledRows: (string | number)[][] = cancelledOrdersList.map((o, idx) => {
    const rawCourier = o.courier || (o as any).extra_data?.courier;
    const awb = o.awb_number || (o as any).extra_data?.awb_number || '-';
    const val = Number(Number(o.price || 0).toFixed(2));
    const reason = (o as any).extra_data?.cancellation_reason || (o as any).cancellation?.reason || 'Order cancelled pre-fulfillment; excluded from delivery SLA';

    return [
      idx + 1,
      o.order_id || o.id,
      formatExcelDate(o.order_date),
      o.customer_name || 'Customer',
      o.phone ? String(o.phone) : '-',
      normalizeCityName(o.city) || 'Unspecified',
      normalizeStateName(o.state) || 'Unspecified',
      val,
      rawCourier || 'None Assigned',
      awb,
      reason
    ];
  });

  const s10ShipmentHeaders = [
    'S.No',
    'Order ID',
    'Order Date',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'Courier Partner',
    'AWB Number',
    'Carrier Status',
    'Canonical Status',
    'Payment Mode',
    'Order Value (₹)'
  ];

  const s10ShipmentRows: (string | number)[][] = orders.map((o, idx) => {
    const rawCourier = o.courier || (o as any).extra_data?.courier;
    const normCourier = normalizeCourierName(rawCourier);
    const awb = o.awb_number || (o as any).extra_data?.awb_number || '-';
    const canonical = getCanonicalStatus(o);
    const rawSt = (o as any).shipment_status || (o as any).raw_status || (o as any).extra_data?.delhivery_current_status || canonical;
    const val = Number(Number(o.price || 0).toFixed(2));

    return [
      idx + 1,
      o.order_id || o.id,
      formatExcelDate(o.order_date),
      o.customer_name || 'Customer',
      o.phone ? String(o.phone) : '-',
      normalizeCityName(o.city) || 'Unspecified',
      normalizeStateName(o.state) || 'Unspecified',
      normCourier,
      awb || '-',
      rawSt || '-',
      canonical,
      o.payment_mode || 'UNKNOWN',
      val
    ];
  });

  const s10Rows: (string | number)[][] = [
    ...s10ReconRows,
    [],
    ['SECTION C - CANCELLED ORDERS & EXCLUSION RECONCILIATION'],
    s10CancelledHeaders,
    ...(s10CancelledRows.length > 0 ? s10CancelledRows : [['-', '-', '-', '-', '-', '-', '-', 0, '-', '-', 'No cancelled orders in selected period']]),
    [],
    ['SECTION D - SHIPMENT-LEVEL COURIER RECORDS'],
    s10ShipmentHeaders,
    ...s10ShipmentRows
  ];

  const ws10 = XLSX.utils.aoa_to_sheet(s10Rows);
  const s10HeaderRowIndex = 5;
  enhanceWorksheet(ws10, s10HeaderRowIndex, true, {
    s: { r: s10HeaderRowIndex, c: 0 },
    e: { r: s10Rows.length - 1, c: Math.max(s10ShipmentHeaders.length - 1, 10) }
  });

  // =========================================================================
  // SHEET 11: Unknown Records Detail (Actionable Missing Courier Audit)
  // =========================================================================
  const unknownOrdersList = orders.filter(o => {
    const canonical = getCanonicalStatus(o);
    if (canonical === 'Cancelled') return false;
    const cour = (o.courier || (o as any).extra_data?.courier || '').trim();
    const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
    return !cour || !awb || cour.toLowerCase().includes('unknown') || cour.toLowerCase().includes('not available');
  });

  const s11Headers = [
    'S.No',
    'Order ID',
    'Order Date',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'Payment Mode',
    'Order Value (₹)',
    'Fulfillment Status',
    'Dispatch Status',
    'AWB Number',
    'Courier Partner',
    'Diagnostic Classification Reason'
  ];

  const s11DataRows: (string | number)[][] = unknownOrdersList.map((o, idx) => {
    const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
    const cour = (o.courier || (o as any).extra_data?.courier || '').trim();
    const fStatus = (o as any).fulfillment_status || (o as any).extra_data?.fulfillment_status || 'fulfilled';
    const dStatus = o.dispatch_status || 'DELIVERED';
    const val = Number(Number(o.price || 0).toFixed(2));

    let reason = 'No carrier tracking report uploaded for this order; awaiting tracking import';
    if (!awb && cour) {
      reason = `Carrier assigned (${cour}) but no waybill tracking number generated`;
    } else if (awb && !cour) {
      reason = `Waybill (${awb}) present but carrier name is unassigned or unrecognized`;
    }

    return [
      idx + 1,
      o.order_id || o.id,
      formatExcelDate(o.order_date),
      o.customer_name || 'Customer',
      o.phone ? String(o.phone) : '-',
      normalizeCityName(o.city) || 'Unspecified',
      normalizeStateName(o.state) || 'Unspecified',
      o.payment_mode || 'UNKNOWN',
      val,
      fStatus,
      dStatus,
      awb || 'None',
      cour || 'Unknown / Not Available',
      reason
    ];
  });

  const s11Rows: (string | number)[][] = [
    ['VELMORA - UNKNOWN & MISSING COURIER RECORDS (ACTIONABLE AUDIT)'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Unknown / Unlinked Records', unknownOrdersList.length, 'Orders requiring carrier file upload or waybill assignment'],
    [],
    s11Headers,
    ...(s11DataRows.length > 0 ? s11DataRows : [['-', '-', '-', '-', '-', '-', '-', '-', 0, '-', '-', '-', '-', 'All orders in period have verified courier and waybill records']])
  ];

  const ws11 = XLSX.utils.aoa_to_sheet(s11Rows);
  const s11HeaderRowIndex = 5;
  enhanceWorksheet(ws11, s11HeaderRowIndex, true, {
    s: { r: s11HeaderRowIndex, c: 0 },
    e: { r: s11Rows.length - 1, c: s11Headers.length - 1 }
  });

  // =========================================================================
  // Assemble Workbook & Download (Exact 11 Sheets Order)
  // =========================================================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Website Sales Analytics');
  XLSX.utils.book_append_sheet(wb, wsRto, 'RTO Summary & Customer Details');
  XLSX.utils.book_append_sheet(wb, wsCancelled, 'Cancelled Orders');
  XLSX.utils.book_append_sheet(wb, ws2, 'Repeat Customer Summary');
  XLSX.utils.book_append_sheet(wb, ws3, 'Payment Mode Breakdown');
  XLSX.utils.book_append_sheet(wb, ws4, 'Revenue Mix');
  XLSX.utils.book_append_sheet(wb, ws5, 'Top Performing Products');
  XLSX.utils.book_append_sheet(wb, ws6, 'Top Performing Combos');
  XLSX.utils.book_append_sheet(wb, ws7, 'Customer Details');
  XLSX.utils.book_append_sheet(wb, ws8, 'Order Details');
  XLSX.utils.book_append_sheet(wb, ws10, 'Courier Reconciliation');
  XLSX.utils.book_append_sheet(wb, ws11, 'Unknown Records');

  const filename = startDate === endDate
    ? `Website_Sales_Analytics_${startDate}.xlsx`
    : `Website_Sales_Analytics_${startDate}_to_${endDate}.xlsx`;

  XLSX.writeFile(wb, filename);
}
