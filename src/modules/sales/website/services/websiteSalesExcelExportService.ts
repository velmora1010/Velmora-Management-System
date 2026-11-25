import * as XLSX from 'xlsx';
import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../types';
import {
  calculateWebsitePaymentSummary,
  normalizeProductGroupingKey,
  resolveCanonicalProductName,
  resolveCanonicalLocation
} from '../websiteSalesUtils';
import {
  calculateCanonicalRtoMetrics,
  getCanonicalStatus,
  normalizeCourierName,
  isCodOrder,
  isPrepaidOrder,
  isDeletedOrder
} from '../../../Logistics/utils/logisticsAnalyticsUtils';
import {
  normalizeCustomerPhone,
  normalizeCityName,
  normalizeStateName,
  normalizeProductName
} from '../../../../services/customerRepeatAnalyticsService';
import { isComboItem } from '../components/TopPerformingProductsCombos';
import {
  calculateMonthlyPerformance,
  calculateYearlyPerformance,
  calculateProductIntelligence,
  calculateComboIntelligence,
  calculateProductPricingInsights,
  comparePeriods
} from '../components/business-trends/businessTrendsCalculations';

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
          str.startsWith('PAYMENT MODE SUMMARY') ||
          str.startsWith('WEBSITE SALES')
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
 * Main export service to build and download the complete Website Sales Analytics workbook
 */
export async function exportWebsiteSalesAnalyticsExcel(options: ExportWebsiteSalesAnalyticsOptions): Promise<void> {
  const { startDate, endDate, orders } = options;

  // Identify deleted orders and cancelled orders separately for accurate reconciliation
  const deletedOrders = orders.filter(o => isDeletedOrder(o) || getCanonicalStatus(o) === 'Deleted');
  const validOrders = orders.filter(o => {
    if (isDeletedOrder(o) || getCanonicalStatus(o) === 'Deleted') return false;
    const isCancelled =
      o.order_status === 'CANCELLED' ||
      o.cancellation?.status === 'CANCELLED' ||
      Boolean(o.cancelled_at) ||
      o.fulfillment_status === 'cancelled' ||
      getCanonicalStatus(o) === 'Cancelled';
    const finStatus = (o.financial_status || '').toLowerCase();
    const isRefunded = finStatus === 'refunded' || finStatus === 'voided';
    return !isCancelled && !isRefunded;
  });

  // Calculate canonical lifecycle metrics and courier performance
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
  const deliveryRate = `${rtoMetrics.deliveryRate}%`;
  const deliveredCodValue = rtoMetrics.deliveredCodValue;
  const deliveredPrepaidValue = rtoMetrics.deliveredPrepaidValue;
  const rawDeliveredOrders = rtoMetrics.deliveredOrders || [];

  const courierPerfList = rtoMetrics.courierPerformance || [];
  const cancelledOrdersList = rtoMetrics.cancelledOrders || orders.filter(o => getCanonicalStatus(o) === 'Cancelled');
  const totalCancelledOrders = rtoMetrics.cancelledCount ?? cancelledOrdersList.length;
  const totalCancelledValue = rtoMetrics.cancelledValue ?? cancelledOrdersList.reduce((sum, o) => sum + (Number(o.price) || Number(o.order_total) || 0), 0);
  const deletedOrdersList = rtoMetrics.deletedOrders || orders.filter(o => isDeletedOrder(o) || getCanonicalStatus(o) === 'Deleted');
  const deletedOrdersCount = deletedOrdersList.length;
  const deletedOrdersValue = deletedOrdersList.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const totalUnits = orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

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

  let totalOtherStatuses = 0;
  courierPerfList.forEach(c => {
    totalOtherStatuses += c.otherStatuses || 0;
  });

  // Calculate In Transit and Other Statuses monetary value
  let inTransitRevenue = 0;
  let otherStatusesRevenue = 0;
  orders.forEach(o => {
    const canonical = getCanonicalStatus(o);
    const p = Number(o.price) || 0;
    if (canonical === 'In Transit') inTransitRevenue += p;
    else if (canonical === 'Other Statuses' || canonical === 'Pending Dispatch') otherStatusesRevenue += p;
  });

  // =========================================================================
  // SHEET 1: Website Sales Analytics (Overall Executive Summary)
  // =========================================================================
  const s1Rows: (string | number)[][] = [
    ['WEBSITE SALES ANALYTICS SUMMARY'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - EXECUTIVE SALES KPI SUMMARY'],
    ['METRIC NAME', 'VALUE', 'UNIT / DETAIL'],
    ['Selected Start Date', formatExcelDate(startDate), 'DD-MMM-YYYY'],
    ['Selected End Date', formatExcelDate(endDate), 'DD-MMM-YYYY'],
    ['Total Placed Orders (Gross)', totalOrdersCount, 'Orders Placed in Period (Matches Order Details)'],
    ['Total Placed Revenue (Gross)', Math.round(totalRevenue), '₹ (INR) Gross Placed Value (Matches Order Details)'],
    ['Total Placed Units (Gross)', totalUnits, 'Cumulative Items Ordered'],
    ['Average Order Value (AOV)', avgOrderValue, '₹ per Order Average Ticket'],
    ['Net Valid Orders', netValidOrdersCount, 'Valid Purchases (Matches Customer Details)'],
    ['Net Valid Revenue', Math.round(netValidRevenue), '₹ (INR) Net Spend (Matches Customer Details)'],
    ['Net Valid Units', netValidUnits, 'Valid Units Sold (Matches Product Details)'],
    ['Net Average Order Value', netAov, '₹ per Net Valid Order'],
    [],
    ['SECTION B - PREPAID VS COD REVENUE BREAKDOWN'],
    ['Payment Classification', 'Number of Orders', 'Share of Orders (%)', 'Gross Revenue (₹)', 'Share of Revenue (%)', 'Payment Status'],
    [
      'Prepaid (Full Advance)',
      prepaidCount,
      totalOrdersCount > 0 ? `${((prepaidCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(prepaidRevenue),
      totalRevenue > 0 ? `${((prepaidRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      '100% Advance Received'
    ],
    [
      'Partial COD (Advance Collected)',
      partialCodCount,
      totalOrdersCount > 0 ? `${((partialCodCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(partialCodRevenue - totalCodReceivable),
      totalRevenue > 0 ? `${(((partialCodRevenue - totalCodReceivable) / totalRevenue) * 100).toFixed(1)}%` : '0%',
      'Advance Portion Collected'
    ],
    [
      'Partial COD (Pending Receivable)',
      partialCodCount,
      '-',
      Math.round(totalCodReceivable),
      totalRevenue > 0 ? `${((totalCodReceivable / totalRevenue) * 100).toFixed(1)}%` : '0%',
      'Pending Cash on Delivery'
    ],
    [
      'Full COD (Zero Advance)',
      fullCodCount,
      totalOrdersCount > 0 ? `${((fullCodCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(fullCodRevenue),
      totalRevenue > 0 ? `${((fullCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      '100% Pending at Delivery'
    ],
    [
      'Total Commercial Orders',
      totalOrdersCount,
      '100.0%',
      Math.round(totalRevenue),
      '100.0%',
      'Total Order Value'
    ],
    [],
    ['SECTION C - SHIPMENT LIFECYCLE OUTCOME SUMMARY'],
    ['Shipment Lifecycle Outcome', 'Order Count', 'Share of Orders (%)', 'Outcome Value (₹)', 'Outcome Rate (%)', 'Audit Classification'],
    [
      'Delivered Outcomes',
      totalDeliveredOrders,
      totalOrdersCount > 0 ? `${((totalDeliveredOrders / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(totalDeliveredValue),
      deliveryRate,
      'Confirmed Delivered by Carrier'
    ],
    [
      'Total RTO Returns',
      totalRtoOrders,
      totalOrdersCount > 0 ? `${((totalRtoOrders / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(totalRtoValue),
      rtoRate,
      'Returned to Origin / Undelivered'
    ],
    [
      'In Transit Shipments',
      rtoMetrics.inTransitCount,
      totalOrdersCount > 0 ? `${((rtoMetrics.inTransitCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(inTransitRevenue),
      totalOrdersCount > 0 ? `${((rtoMetrics.inTransitCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      'Active in Carrier Network'
    ],
    [
      'Other Statuses / In Progress',
      totalOtherStatuses,
      totalOrdersCount > 0 ? `${((totalOtherStatuses / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(otherStatusesRevenue),
      totalOrdersCount > 0 ? `${((totalOtherStatuses / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      'Out for Delivery / Pickup Scheduled'
    ],
    [
      'Cancelled Pre-Dispatch',
      totalCancelledOrders,
      totalOrdersCount > 0 ? `${((totalCancelledOrders / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(totalCancelledValue),
      totalOrdersCount > 0 ? `${((totalCancelledOrders / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      'Cancelled / Refunded Prior to Dispatch'
    ],
    [
      'Deleted Orders',
      deletedOrdersCount,
      totalOrdersCount > 0 ? `${((deletedOrdersCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(deletedOrdersValue),
      '-',
      'Soft-Deleted / Excluded from Logistics'
    ]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);
  enhanceWorksheet(ws1, 4, false);

  // =========================================================================
  // SHEET 2: RTO Summary & Customer Details
  // =========================================================================
  // Courier-wise RTO calculation
  const rtoByCourierMap = new Map<string, { count: number; value: number }>();
  rtoOrders.forEach(o => {
    const rawCour = o.courier || (o as any).extra_data?.courier;
    const cour = normalizeCourierName(rawCour);
    if (!rtoByCourierMap.has(cour)) rtoByCourierMap.set(cour, { count: 0, value: 0 });
    const e = rtoByCourierMap.get(cour)!;
    e.count += 1;
    e.value += Math.round(Number(o.price) || Number(o.order_total) || 0);
  });
  const rtoCourierRows: (string | number)[][] = courierPerfList.map(c => {
    const rtoData = rtoByCourierMap.get(c.courier) || { count: c.rto, value: 0 };
    return [
      c.courier,
      c.rto,
      rtoData.value,
      totalRtoOrders > 0 ? `${((c.rto / totalRtoOrders) * 100).toFixed(1)}%` : '0%',
      `${c.rtoRate}%`
    ];
  });

  const s2RtoSummaryRows: (string | number)[][] = [
    ['RTO SUMMARY & CUSTOMER DETAILS'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A.1 - EXECUTIVE RTO SUMMARY'],
    ['RTO METRIC', 'VALUE', 'UNIT / DETAIL'],
    ['Total RTO Orders', totalRtoOrders, 'Returned to Origin Shipments'],
    ['Total RTO Value', Math.round(totalRtoValue), '₹ (INR) Gross Returned Order Value'],
    ['RTO Rate', rtoRate, '% of Concluded Shipments'],
    ['RTO Average Value', rtoAvgValue, '₹ per RTO Order Average Ticket'],
    ['RTO COD Value', Math.round(rtoCodValue), '₹ Pure COD Returned Value'],
    ['RTO Prepaid Value', Math.round(rtoPrepaidValue), '₹ Prepaid & Partial COD Returned Value'],
    [],
    ['SECTION A.2 - RTO BREAKDOWN BY COURIER PARTNER'],
    ['Courier Partner', 'RTO Orders', 'RTO Value (₹)', 'RTO Share (% of All RTO)', 'Courier RTO Rate (%)'],
    ...rtoCourierRows,
    ['Total RTO Concluded', totalRtoOrders, Math.round(totalRtoValue), '100.0%', rtoRate]
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
  const rtoHeaderRowIndex = s2RtoSummaryRows.length + 2;
  enhanceWorksheet(wsRto, rtoHeaderRowIndex, true, {
    s: { r: rtoHeaderRowIndex, c: 0 },
    e: { r: s2RtoRows.length - 1, c: rtoDetailHeaders.length - 1 }
  });

  // =========================================================================
  // SHEET 3: Cancelled Orders (Pre-Dispatch Summary & Customer Audit)
  // =========================================================================
  // Payment mode breakdown for cancelled orders
  let cancelPrepaidCount = 0;
  let cancelPrepaidVal = 0;
  let cancelPartialCodCount = 0;
  let cancelPartialCodVal = 0;
  let cancelFullCodCount = 0;
  let cancelFullCodVal = 0;

  cancelledOrdersList.forEach(o => {
    const val = Math.round(Number(o.price) || Number(o.order_total) || 0);
    const mode = (o.payment_mode || '').toUpperCase();
    if (mode === 'PREPAID') {
      cancelPrepaidCount++;
      cancelPrepaidVal += val;
    } else if (mode === 'PARTIAL COD') {
      cancelPartialCodCount++;
      cancelPartialCodVal += val;
    } else {
      cancelFullCodCount++;
      cancelFullCodVal += val;
    }
  });

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
    [],
    ['SECTION A.1 - EXECUTIVE CANCELLATION SUMMARY'],
    ['Total Cancelled Orders', totalCancelledOrders, 'Total pre-dispatch cancelled orders for period'],
    ['Total Cancelled Value (₹)', totalCancelledValue, 'Cumulative monetary value of cancelled orders (₹)'],
    ['Lifecycle Stage', 'Pre-Dispatch (Excluded from carrier fulfillment & delivery SLA)', 'Classification'],
    [],
    ['SECTION A.2 - CANCELLATION BREAKDOWN BY PAYMENT MODE'],
    ['Payment Mode', 'Cancelled Orders', 'Cancelled Value (₹)', 'Share of Cancelled Orders (%)', 'Share of Cancelled Value (%)'],
    [
      'Prepaid',
      cancelPrepaidCount,
      cancelPrepaidVal,
      totalCancelledOrders > 0 ? `${((cancelPrepaidCount / totalCancelledOrders) * 100).toFixed(1)}%` : '0%',
      totalCancelledValue > 0 ? `${((cancelPrepaidVal / totalCancelledValue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Partial COD',
      cancelPartialCodCount,
      cancelPartialCodVal,
      totalCancelledOrders > 0 ? `${((cancelPartialCodCount / totalCancelledOrders) * 100).toFixed(1)}%` : '0%',
      totalCancelledValue > 0 ? `${((cancelPartialCodVal / totalCancelledValue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Full COD',
      cancelFullCodCount,
      cancelFullCodVal,
      totalCancelledOrders > 0 ? `${((cancelFullCodCount / totalCancelledOrders) * 100).toFixed(1)}%` : '0%',
      totalCancelledValue > 0 ? `${((cancelFullCodVal / totalCancelledValue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Total Cancelled',
      totalCancelledOrders,
      totalCancelledValue,
      '100.0%',
      '100.0%'
    ]
  ];

  const sCancelledRows: (string | number)[][] = [
    ...sCancelledSummaryRows,
    [],
    ['SECTION B - CANCELLED ORDER DETAILS'],
    cancelledDetailHeaders,
    ...cancelledDetailDataRows
  ];

  const wsCancelled = XLSX.utils.aoa_to_sheet(sCancelledRows);
  const cancelledHeaderRowIndex = sCancelledSummaryRows.length + 2;
  enhanceWorksheet(wsCancelled, cancelledHeaderRowIndex, true, {
    s: { r: cancelledHeaderRowIndex, c: 0 },
    e: { r: sCancelledRows.length - 1, c: cancelledDetailHeaders.length - 1 }
  });

  // =========================================================================
  // SHEET 4: Repeat Customer Summary
  // =========================================================================
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

  const repeatCustomerProfiles = Array.from(customerGroupMap.values())
    .filter(c => c.orders.length >= 2)
    .map(c => {
      const sortedOrders = [...c.orders].sort((a, b) =>
        (a.order_date || '').localeCompare(b.order_date || '')
      );
      const ordersCount = sortedOrders.length;
      const totalNetSpend = sortedOrders.reduce((sum, ord) => sum + (Number(ord.price) || 0), 0);
      const aov = ordersCount > 0 ? Math.round(totalNetSpend / ordersCount) : 0;

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

  const totalUniqueCustomers = customerGroupMap.size;
  const totalRepeatCount = repeatCustomerProfiles.length;
  const totalNewCustomers = Math.max(0, totalUniqueCustomers - totalRepeatCount);

  const repeatOrdersTotal = repeatCustomerProfiles.reduce((s, c) => s + c.ordersCount, 0);
  const newOrdersTotal = Math.max(0, deduplicatedValidOrders.length - repeatOrdersTotal);
  const repeatRevenueTotal = repeatCustomerProfiles.reduce((s, c) => s + c.totalNetSpend, 0);
  const newRevenueTotal = Math.max(0, netValidRevenue - repeatRevenueTotal);

  const count2Orders = repeatCustomerProfiles.filter(c => c.ordersCount === 2);
  const count3Orders = repeatCustomerProfiles.filter(c => c.ordersCount === 3);
  const count4Orders = repeatCustomerProfiles.filter(c => c.ordersCount === 4);
  const count5PlusOrders = repeatCustomerProfiles.filter(c => c.ordersCount >= 5);

  const count2OrdersRev = count2Orders.reduce((s, c) => s + c.totalNetSpend, 0);
  const count3OrdersRev = count3Orders.reduce((s, c) => s + c.totalNetSpend, 0);
  const count4OrdersRev = count4Orders.reduce((s, c) => s + c.totalNetSpend, 0);
  const count5PlusOrdersRev = count5PlusOrders.reduce((s, c) => s + c.totalNetSpend, 0);

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

  const s2RepeatRows: (string | number)[][] = [
    ['REPEAT CUSTOMER SUMMARY (SELECTED PERIOD)'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A.1 - NEW VS REPEAT CUSTOMER COMPARISON'],
    ['Customer Cohort', 'Customer Count', 'Customer Share (%)', 'Total Orders', 'Order Share (%)', 'Total Net Spend (₹)', 'Revenue Share (%)', 'Cohort AOV (₹)'],
    [
      'New / First-Time Buyers',
      totalNewCustomers,
      totalUniqueCustomers > 0 ? `${((totalNewCustomers / totalUniqueCustomers) * 100).toFixed(1)}%` : '0%',
      newOrdersTotal,
      deduplicatedValidOrders.length > 0 ? `${((newOrdersTotal / deduplicatedValidOrders.length) * 100).toFixed(1)}%` : '0%',
      Math.round(newRevenueTotal),
      netValidRevenue > 0 ? `${((newRevenueTotal / netValidRevenue) * 100).toFixed(1)}%` : '0%',
      newOrdersTotal > 0 ? Math.round(newRevenueTotal / newOrdersTotal) : 0
    ],
    [
      'Repeat Customers (2+ Purchases)',
      totalRepeatCount,
      totalUniqueCustomers > 0 ? `${((totalRepeatCount / totalUniqueCustomers) * 100).toFixed(1)}%` : '0%',
      repeatOrdersTotal,
      deduplicatedValidOrders.length > 0 ? `${((repeatOrdersTotal / deduplicatedValidOrders.length) * 100).toFixed(1)}%` : '0%',
      Math.round(repeatRevenueTotal),
      netValidRevenue > 0 ? `${((repeatRevenueTotal / netValidRevenue) * 100).toFixed(1)}%` : '0%',
      repeatOrdersTotal > 0 ? Math.round(repeatRevenueTotal / repeatOrdersTotal) : 0
    ],
    [
      'Total Customer Base',
      totalUniqueCustomers,
      '100.0%',
      deduplicatedValidOrders.length,
      '100.0%',
      Math.round(netValidRevenue),
      '100.0%',
      netAov
    ],
    [],
    ['SECTION A.2 - REPEAT CUSTOMER FREQUENCY DISTRIBUTION'],
    ['Purchase Frequency', 'Customer Count', 'Share of Repeat Cohort (%)', 'Total Orders', 'Total Net Spend (₹)', 'Average Spend / Customer (₹)'],
    [
      'Exactly 2 Orders',
      count2Orders.length,
      totalRepeatCount > 0 ? `${((count2Orders.length / totalRepeatCount) * 100).toFixed(1)}%` : '0%',
      count2Orders.length * 2,
      count2OrdersRev,
      count2Orders.length > 0 ? Math.round(count2OrdersRev / count2Orders.length) : 0
    ],
    [
      'Exactly 3 Orders',
      count3Orders.length,
      totalRepeatCount > 0 ? `${((count3Orders.length / totalRepeatCount) * 100).toFixed(1)}%` : '0%',
      count3Orders.length * 3,
      count3OrdersRev,
      count3Orders.length > 0 ? Math.round(count3OrdersRev / count3Orders.length) : 0
    ],
    [
      'Exactly 4 Orders',
      count4Orders.length,
      totalRepeatCount > 0 ? `${((count4Orders.length / totalRepeatCount) * 100).toFixed(1)}%` : '0%',
      count4Orders.length * 4,
      count4OrdersRev,
      count4Orders.length > 0 ? Math.round(count4OrdersRev / count4Orders.length) : 0
    ],
    [
      '5+ Orders',
      count5PlusOrders.length,
      totalRepeatCount > 0 ? `${((count5PlusOrders.length / totalRepeatCount) * 100).toFixed(1)}%` : '0%',
      count5PlusOrders.reduce((s, c) => s + c.ordersCount, 0),
      count5PlusOrdersRev,
      count5PlusOrders.length > 0 ? Math.round(count5PlusOrdersRev / count5PlusOrders.length) : 0
    ],
    [
      'Total Repeat Segment',
      totalRepeatCount,
      '100.0%',
      repeatOrdersTotal,
      Math.round(repeatRevenueTotal),
      totalRepeatCount > 0 ? Math.round(repeatRevenueTotal / totalRepeatCount) : 0
    ],
    [],
    ['SECTION B - REPEAT CUSTOMER ROSTER & LIFECYCLE HISTORY'],
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

  const ws2 = XLSX.utils.aoa_to_sheet(s2RepeatRows);
  const s2HeaderRowIndex = 17;
  enhanceWorksheet(ws2, s2HeaderRowIndex, true, {
    s: { r: s2HeaderRowIndex, c: 0 },
    e: { r: s2RepeatRows.length - 1, c: s2Headers.length - 1 }
  });

  // =========================================================================
  // SHEET 5: Payment Mode Breakdown
  // =========================================================================
  const s3Rows: (string | number)[][] = [
    ['PAYMENT MODE BREAKDOWN & COLLECTION AUDIT'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A.1 - PAYMENT MODE SUMMARY & REVENUE CONTRIBUTION'],
    [
      'Payment Mode',
      'Number of Orders',
      'Share of Orders (%)',
      'Total Order Value (₹)',
      'Share of Revenue (%)',
      'Amount Received (₹)',
      'Pending COD (₹)',
      'Collection Efficiency (%)'
    ],
    [
      'Prepaid',
      prepaidCount,
      totalOrdersCount > 0 ? `${((prepaidCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(prepaidRevenue),
      totalRevenue > 0 ? `${((prepaidRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      Math.round(prepaidRevenue),
      0,
      '100.0%'
    ],
    [
      'Partial COD',
      partialCodCount,
      totalOrdersCount > 0 ? `${((partialCodCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(partialCodRevenue),
      totalRevenue > 0 ? `${((partialCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      Math.round(partialCodRevenue - totalCodReceivable),
      Math.round(totalCodReceivable),
      partialCodRevenue > 0 ? `${(((partialCodRevenue - totalCodReceivable) / partialCodRevenue) * 100).toFixed(1)}%` : '0%'
    ],
    [
      'Full COD',
      fullCodCount,
      totalOrdersCount > 0 ? `${((fullCodCount / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(fullCodRevenue),
      totalRevenue > 0 ? `${((fullCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      0,
      Math.round(fullCodRevenue),
      '0.0% (Pending Delivery)'
    ],
    [
      'Total',
      totalOrdersCount,
      '100.0%',
      Math.round(totalRevenue),
      '100.0%',
      Math.round(prepaidRevenue + (partialCodRevenue - totalCodReceivable)),
      Math.round(totalCodReceivable + fullCodRevenue),
      totalRevenue > 0 ? `${(((prepaidRevenue + (partialCodRevenue - totalCodReceivable)) / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ],
    [],
    ['SECTION A.2 - CASH FLOW & RECEIVABLES PROFILE'],
    ['Receivable Stream', 'Monetary Value (₹)', 'Share of Revenue (%)', 'Settlement Status'],
    [
      'Realized Advance Cash Collected',
      Math.round(prepaidRevenue + (partialCodRevenue - totalCodReceivable)),
      totalRevenue > 0 ? `${(((prepaidRevenue + (partialCodRevenue - totalCodReceivable)) / totalRevenue) * 100).toFixed(1)}%` : '0%',
      'Credited to Bank / Gateway'
    ],
    [
      'Pending Courier COD Receivables',
      Math.round(totalCodReceivable + fullCodRevenue),
      totalRevenue > 0 ? `${(((totalCodReceivable + fullCodRevenue) / totalRevenue) * 100).toFixed(1)}%` : '0%',
      'Awaiting Carrier Delivery Remittance'
    ],
    [
      'Gross Commercial Pipeline',
      Math.round(totalRevenue),
      '100.0%',
      'Total Revenue Base'
    ],
    [],
    ['SECTION B - ORDER-LEVEL PAYMENT RECORDS'],
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
  const s3HeaderRowIndex = 18;
  enhanceWorksheet(ws3, s3HeaderRowIndex, true, {
    s: { r: s3HeaderRowIndex, c: 0 },
    e: { r: s3Rows.length - 1, c: 10 }
  });

  // =========================================================================
  // SHEET 6: Revenue Mix (Gross vs Net + Multi-Dimensional Breakdowns)
  // =========================================================================
  // 1. Gross vs Net Revenue Waterfall
  const s4WaterfallRows: (string | number)[][] = [
    ['VELMORA - REVENUE MIX & COMMERCIAL RECONCILIATION'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION 1 - GROSS VS NET REVENUE COMPARISON & DEDUCTIONS'],
    ['Revenue Flow Stage', 'Amount (₹)', 'Share of Gross Placed (%)', 'Order Count', 'Operational Classification'],
    [
      'Gross Placed Orders Revenue',
      Math.round(totalRevenue),
      '100.0%',
      totalOrdersCount,
      'Total gross order value placed by customers'
    ],
    [
      'Less: Pre-Dispatch Cancellations',
      -Math.round(totalCancelledValue),
      totalRevenue > 0 ? `-${((totalCancelledValue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      totalCancelledOrders,
      'Orders cancelled / refunded prior to dispatch'
    ],
    [
      'Net Realizable Sales (Active Pipeline)',
      Math.round(netValidRevenue),
      totalRevenue > 0 ? `${((netValidRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      netValidOrdersCount,
      'Valid orders in active fulfillment stream'
    ],
    [
      'Confirmed Delivered Revenue',
      Math.round(totalDeliveredValue),
      totalRevenue > 0 ? `${((totalDeliveredValue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      totalDeliveredOrders,
      'Delivered shipments verified by carrier tracking'
    ],
    [
      'In Transit / Pending Delivery Revenue',
      Math.round(inTransitRevenue + otherStatusesRevenue),
      totalRevenue > 0 ? `${(((inTransitRevenue + otherStatusesRevenue) / totalRevenue) * 100).toFixed(1)}%` : '0%',
      rtoMetrics.inTransitCount + totalOtherStatuses,
      'Shipments currently in courier delivery network'
    ],
    [
      'RTO Return Lost Revenue',
      Math.round(totalRtoValue),
      totalRevenue > 0 ? `${((totalRtoValue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      totalRtoOrders,
      'Returned shipments causing reverse logistics and lost revenue'
    ]
  ];

  // 2. By Payment Mode
  const s4PaymentRows: (string | number)[][] = [
    [],
    ['SECTION 2 - REVENUE MIX BY PAYMENT MODE'],
    ['Payment Mode', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ['Prepaid', prepaidCount, Math.round(prepaidRevenue), totalRevenue > 0 ? `${((prepaidRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'],
    ['Partial COD', partialCodCount, Math.round(partialCodRevenue), totalRevenue > 0 ? `${((partialCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'],
    ['Full COD', fullCodCount, Math.round(fullCodRevenue), totalRevenue > 0 ? `${((fullCodRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%']
  ];

  // 3. By Order State
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
    ['SECTION 3 - REVENUE MIX BY ORDER STATE'],
    ['State', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...stateAggList.map(([st, d]) => [
      st,
      d.orders,
      Math.round(d.rev),
      totalRevenue > 0 ? `${((d.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  // 4. By Product
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
    ['SECTION 4 - REVENUE MIX BY PRODUCT'],
    ['Product Name', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...prodMixList.map(([p, d]) => [
      p,
      d.orderIds.size,
      Math.round(d.rev),
      totalRevenue > 0 ? `${((d.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  // 5. By Offer
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
    ['SECTION 5 - REVENUE MIX BY OFFER'],
    ['Offer Name', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...offerAggList.map(([off, d]) => [
      off,
      d.orders,
      Math.round(d.rev),
      totalRevenue > 0 ? `${((d.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  // 6. By Order Value Range
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
    ['SECTION 6 - REVENUE MIX BY ORDER VALUE RANGE'],
    ['Order Value Range', 'Number of Orders', 'Total Revenue (₹)', 'Percentage Share (%)'],
    ...valueBuckets.map(b => [
      b.label,
      b.orders,
      Math.round(b.rev),
      totalRevenue > 0 ? `${((b.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ])
  ];

  const ws4 = XLSX.utils.aoa_to_sheet([
    ...s4WaterfallRows,
    ...s4PaymentRows,
    ...s4StateRows,
    ...s4ProdRows,
    ...s4OfferRows,
    ...s4RangeRows
  ]);
  enhanceWorksheet(ws4, 4, false);

  // =========================================================================
  // SHEET 7: Top Performing Products & SHEET 8: Top Performing Combos
  // =========================================================================
  const productAggMap = new Map<string, { qty: number; rev: number; ordersSet: Set<string> }>();
  const comboAggMap = new Map<string, { qty: number; rev: number; ordersSet: Set<string> }>();

  orders.forEach(o => {
    if (
      isDeletedOrder(o) ||
      getCanonicalStatus(o) === 'Deleted' ||
      getCanonicalStatus(o) === 'Cancelled' ||
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
  const totalProductsQty = allProductsList.reduce((s, p) => s + p.qty, 0);

  // Top 5 by Revenue
  const top5ProductsByRev = allProductsList.slice(0, 5);
  // Top 5 by Quantity
  const top5ProductsByQty = [...allProductsList].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const s5TopRows: (string | number)[][] = [
    ['VELMORA - TOP PERFORMING PRODUCTS INTELLIGENCE'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - TOP 5 PRODUCTS BY SALES REVENUE'],
    ['Rank', 'Product Name', 'Sales Revenue (₹)', 'Revenue Share (%)', 'Quantity Sold', 'Average Selling Price (₹)'],
    ...top5ProductsByRev.map((p, idx) => [
      idx + 1,
      p.name,
      Math.round(p.rev),
      totalProductsRev > 0 ? `${((p.rev / totalProductsRev) * 100).toFixed(1)}%` : '0%',
      p.qty,
      p.avgPrice
    ]),
    [],
    ['SECTION B - TOP 5 PRODUCTS BY QUANTITY SOLD'],
    ['Rank', 'Product Name', 'Quantity Sold (Units)', 'Share of Units (%)', 'Sales Revenue (₹)', 'Average Selling Price (₹)'],
    ...top5ProductsByQty.map((p, idx) => [
      idx + 1,
      p.name,
      p.qty,
      totalProductsQty > 0 ? `${((p.qty / totalProductsQty) * 100).toFixed(1)}%` : '0%',
      Math.round(p.rev),
      p.avgPrice
    ]),
    [],
    ['SECTION C - COMPLETE PRODUCT CATALOG PERFORMANCE'],
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

  const ws5 = XLSX.utils.aoa_to_sheet(s5TopRows);
  const s5HeaderRowIndex = 19;
  enhanceWorksheet(ws5, s5HeaderRowIndex, true, {
    s: { r: s5HeaderRowIndex, c: 0 },
    e: { r: s5TopRows.length - 1, c: 6 }
  });

  // SHEET 8: Top Performing Combos
  const allCombosList = Array.from(comboAggMap.entries()).map(([name, d]) => ({
    name,
    rev: d.rev,
    qty: d.qty,
    orders: d.ordersSet.size,
    avgPrice: d.qty > 0 ? Math.round(d.rev / d.qty) : 0
  })).sort((a, b) => b.rev - a.rev);
  const totalCombosRev = allCombosList.reduce((s, c) => s + c.rev, 0);

  const topCombosByRev = allCombosList.slice(0, 5);
  const topCombosByQty = [...allCombosList].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const s6TopRows: (string | number)[][] = [
    ['VELMORA - TOP PERFORMING COMBOS INTELLIGENCE'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - TOP COMBOS BY REVENUE'],
    ['Rank', 'Combo Name', 'Sales Revenue (₹)', 'Share of Combo Revenue (%)', 'Units Sold', 'Orders'],
    ...(topCombosByRev.length > 0
      ? topCombosByRev.map((c, idx) => [
          idx + 1,
          c.name,
          Math.round(c.rev),
          totalCombosRev > 0 ? `${((c.rev / totalCombosRev) * 100).toFixed(1)}%` : '0%',
          c.qty,
          c.orders
        ])
      : [['-', 'No combo sales recorded in the selected period', 0, '0.0%', 0, 0]]),
    [],
    ['SECTION B - TOP COMBOS BY UNITS / ORDERS SOLD'],
    ['Rank', 'Combo Name', 'Units Sold', 'Orders Sold', 'Sales Revenue (₹)', 'Average Selling Price (₹)'],
    ...(topCombosByQty.length > 0
      ? topCombosByQty.map((c, idx) => [
          idx + 1,
          c.name,
          c.qty,
          c.orders,
          Math.round(c.rev),
          c.avgPrice
        ])
      : [['-', 'No combo sales recorded in the selected period', 0, 0, 0, 0]]),
    [],
    ['SECTION C - COMPLETE COMBO PACKAGES CATALOG'],
    ['Rank', 'Combo Name', 'Sales Revenue (₹)', 'Quantity Sold', 'Number of Orders', 'Average Selling Price (₹)', 'Revenue Share (%)'],
    ...(allCombosList.length > 0
      ? allCombosList.map((c, idx) => [
          idx + 1,
          c.name,
          Math.round(c.rev),
          c.qty,
          c.orders,
          c.avgPrice,
          totalCombosRev > 0 ? `${((c.rev / totalCombosRev) * 100).toFixed(1)}%` : '0%'
        ])
      : [['-', 'No combo sales recorded in the selected period', 0, 0, 0, 0, '0.0%']])
  ];

  const ws6 = XLSX.utils.aoa_to_sheet(s6TopRows);
  const s6HeaderRowIndex = 14 + (topCombosByRev.length > 0 ? topCombosByRev.length : 1) + (topCombosByQty.length > 0 ? topCombosByQty.length : 1);
  enhanceWorksheet(ws6, 17, true, {
    s: { r: 17, c: 0 },
    e: { r: s6TopRows.length - 1, c: 6 }
  });

  // =========================================================================
  // SHEET 9: Customer Details (All Customers in Selected Period)
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

  // Top 10 by Revenue
  const top10CustomersByRev = allEligibleCustomers.slice(0, 10);
  // Top 10 by Order Count
  const top10CustomersByOrders = [...allEligibleCustomers].sort((a, b) => b.totalOrders - a.totalOrders || b.totalRevenue - a.totalRevenue).slice(0, 10);

  const s7Rows: (string | number)[][] = [
    ['VELMORA - CUSTOMER INTELLIGENCE & MASTER AUDIT'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - TOP 10 HIGH-VALUE CUSTOMERS (BY TOTAL REVENUE)'],
    ['Rank', 'Customer Name', 'Phone', 'City', 'State', 'Total Revenue (₹)', 'Total Orders', 'AOV (₹)', 'Products Purchased'],
    ...top10CustomersByRev.map((c, idx) => [
      idx + 1,
      c.name,
      c.phone || '-',
      c.city,
      c.state,
      c.totalRevenue,
      c.totalOrders,
      c.aov,
      c.productsPurchased
    ]),
    [],
    ['SECTION B - TOP 10 FREQUENT BUYERS (BY ORDER VOLUME)'],
    ['Rank', 'Customer Name', 'Phone', 'City', 'State', 'Total Orders', 'Total Revenue (₹)', 'AOV (₹)', 'Products Purchased'],
    ...top10CustomersByOrders.map((c, idx) => [
      idx + 1,
      c.name,
      c.phone || '-',
      c.city,
      c.state,
      c.totalOrders,
      c.totalRevenue,
      c.aov,
      c.productsPurchased
    ]),
    [],
    ['SECTION C - COMPLETE CUSTOMER MASTER ROSTER'],
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
  const s7HeaderRowIndex = 29;
  enhanceWorksheet(ws7, s7HeaderRowIndex, true, {
    s: { r: s7HeaderRowIndex, c: 0 },
    e: { r: s7Rows.length - 1, c: 11 }
  });

  // =========================================================================
  // SHEET 10: Order Details (Granular Orders for Selected Period)
  // =========================================================================
  // Section A: Daily Order Velocity
  const dailyOrderMap = new Map<string, { count: number; rev: number }>();
  orders.forEach(o => {
    const dStr = (o.order_date || '').split(/[T ]/)[0] || 'Unknown';
    if (!dailyOrderMap.has(dStr)) dailyOrderMap.set(dStr, { count: 0, rev: 0 });
    const e = dailyOrderMap.get(dStr)!;
    e.count++;
    e.rev += (Number(o.price) || 0);
  });
  const dailySorted = Array.from(dailyOrderMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumOrders = 0;
  let cumRev = 0;
  const dailyRunRateRows: (string | number)[][] = dailySorted.map(([d, data]) => {
    cumOrders += data.count;
    cumRev += data.rev;
    const aov = data.count > 0 ? Math.round(data.rev / data.count) : 0;
    return [
      formatExcelDate(d),
      data.count,
      Math.round(data.rev),
      cumOrders,
      Math.round(cumRev),
      aov
    ];
  });

  // Section B: Order Value Ticket Size Distribution
  const ticketBuckets = [
    { label: 'Below ₹500', min: 0, max: 499.99, orders: 0, rev: 0 },
    { label: '₹500–₹749', min: 500, max: 749.99, orders: 0, rev: 0 },
    { label: '₹750–₹999', min: 750, max: 999.99, orders: 0, rev: 0 },
    { label: '₹1,000–₹1,299', min: 1000, max: 1299.99, orders: 0, rev: 0 },
    { label: '₹1,300–₹1,499', min: 1300, max: 1499.99, orders: 0, rev: 0 },
    { label: '₹1,500 and above', min: 1500, max: Infinity, orders: 0, rev: 0 }
  ];
  orders.forEach(o => {
    const val = Number(o.price) || 0;
    const b = ticketBuckets.find(bucket => val >= bucket.min && val <= bucket.max);
    if (b) {
      b.orders++;
      b.rev += val;
    }
  });

  const s8Rows: (string | number)[][] = [
    ['VELMORA - ORDER DETAILS & TRANSACTION LEDGER'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - DAILY ORDER VELOCITY & REVENUE RUN-RATE'],
    ['Order Date', 'Daily Orders Placed', 'Daily Revenue (₹)', 'Cumulative Orders', 'Cumulative Revenue (₹)', 'Daily Average Order Value (₹)'],
    ...dailyRunRateRows,
    [],
    ['SECTION B - ORDER VALUE TICKET SIZE DISTRIBUTION'],
    ['Ticket Size Range', 'Order Count', 'Share of Orders (%)', 'Total Revenue (₹)', 'Share of Revenue (%)'],
    ...ticketBuckets.map(b => [
      b.label,
      b.orders,
      totalOrdersCount > 0 ? `${((b.orders / totalOrdersCount) * 100).toFixed(1)}%` : '0%',
      Math.round(b.rev),
      totalRevenue > 0 ? `${((b.rev / totalRevenue) * 100).toFixed(1)}%` : '0%'
    ]),
    [],
    ['SECTION C - GRANULAR ORDER TRANSACTION RECORDS'],
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
  const s8HeaderRowIndex = 15 + dailyRunRateRows.length;
  enhanceWorksheet(ws8, s8HeaderRowIndex, true, {
    s: { r: s8HeaderRowIndex, c: 0 },
    e: { r: s8Rows.length - 1, c: 13 }
  });

  // =========================================================================
  // SHEET 11: Courier Reconciliation & Performance Breakdown
  // =========================================================================
  const activeOrdersCount = Math.max(0, orders.length - cancelledOrdersList.length - deletedOrdersList.length);

  let missingAwbCount = 0;
  let unknownCourierCount = 0;
  orders.forEach(o => {
    if (isDeletedOrder(o)) return;
    const canonical = getCanonicalStatus(o);
    if (canonical === 'Cancelled' || canonical === 'Deleted') return;
    const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
    const cour = (o.courier || (o as any).extra_data?.courier || '').trim();
    if (!awb) missingAwbCount++;
    if (!cour || cour.toLowerCase().includes('unknown') || cour.toLowerCase().includes('not available')) unknownCourierCount++;
  });
  const reconciledRecordsCount = Math.max(0, orders.length - unknownCourierCount - cancelledOrdersList.length - deletedOrdersList.length);

  const s10ReconRows: (string | number)[][] = [
    ['VELMORA - COURIER RECONCILIATION & PERFORMANCE'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A - EXECUTIVE RECONCILIATION SUMMARY'],
    ['Metric Name', 'Value', 'Unit / Detail'],
    ['Total Website Orders', orders.length, 'Total orders recorded in sales dataset for period'],
    ['Active Fulfillable Shipments', activeOrdersCount, 'Orders requiring carrier fulfillment (excluding cancelled and deleted)'],
    ['Cancelled Orders (Pre-Dispatch)', cancelledOrdersList.length, 'Orders cancelled prior to dispatch; excluded from carrier SLAs'],
    ['Deleted Orders', deletedOrdersList.length, 'Orders marked deleted; excluded from carrier SLAs and fulfillment'],
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
    ['SECTION B.1 - CARRIER PERFORMANCE BREAKDOWN'],
    [
      'Courier Partner',
      'Total Orders',
      'Delivered',
      'RTO',
      'In Transit',
      'Other Statuses',
      'Cancelled',
      'Deleted',
      'Delivery Rate (%)',
      'RTO Rate (%)'
    ],
    ...courierPerfList.map(c => [
      c.courier,
      c.total,
      c.delivered,
      c.rto,
      c.inTransit,
      c.otherStatuses,
      c.cancelled ?? 0,
      c.deleted ?? 0,
      `${c.deliveryRate}%`,
      `${c.rtoRate}%`
    ]),
    [
      'Total Reconciled',
      orders.length,
      totalDeliveredOrders,
      totalRtoOrders,
      rtoMetrics.inTransitCount,
      totalOtherStatuses,
      cancelledOrdersList.length,
      deletedOrdersList.length,
      `${deliveryRate}%`,
      `${rtoRate}%`
    ],
    [],
    ['SECTION B.2 - CARRIER DELIVERY SUCCESS RATE RANKING & SLA COMPARISON'],
    ['Courier Partner', 'Concluded Shipments (Delivered + RTO)', 'Delivered Outcomes', 'Delivery Success Rate (%)', 'RTO Return Rate (%)', 'Carrier SLA Status'],
    ...courierPerfList.map(c => {
      const concluded = (c.delivered || 0) + (c.rto || 0);
      const delRateNum = parseFloat(c.deliveryRate) || 0;
      let slaStatus = 'Good';
      if (delRateNum >= 95) slaStatus = 'Optimal (>=95%)';
      else if (delRateNum >= 85) slaStatus = 'Acceptable (>=85%)';
      else if (concluded > 0) slaStatus = 'Needs Attention (<85%)';
      else slaStatus = 'Pending Outcomes';

      return [
        c.courier,
        concluded,
        c.delivered,
        `${c.deliveryRate}%`,
        `${c.rtoRate}%`,
        slaStatus
      ];
    })
  ];

  // Section C: Cancelled / Non-Fulfillable Orders
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
  // SHEET 12: Delivered Orders (Verified Authoritative Carrier Deliveries)
  // Replaces the old Unknown Records sheet completely
  // =========================================================================
  // Deduplicate delivered orders by clean Order ID
  const seenDeliveredIds = new Set<string>();
  const deduplicatedDeliveredOrders: any[] = [];
  for (const o of rawDeliveredOrders) {
    const cleanId = String(o.order_id || o.id || '').replace(/^#/, '').trim().toLowerCase();
    if (!cleanId || seenDeliveredIds.has(cleanId)) continue;
    seenDeliveredIds.add(cleanId);
    deduplicatedDeliveredOrders.push(o);
  }

  // Fallback check: if rawDeliveredOrders is empty, check canonical status in orders
  if (deduplicatedDeliveredOrders.length === 0) {
    for (const o of orders) {
      if (getCanonicalStatus(o) === 'Delivered') {
        const cleanId = String(o.order_id || o.id || '').replace(/^#/, '').trim().toLowerCase();
        if (!cleanId || seenDeliveredIds.has(cleanId)) continue;
        seenDeliveredIds.add(cleanId);
        deduplicatedDeliveredOrders.push(o);
      }
    }
  }

  // Delivered Orders by Courier Partner
  const deliveredCourierMap = new Map<string, { count: number; rev: number }>();
  deduplicatedDeliveredOrders.forEach(o => {
    const rawCour = o.courier || (o as any).extra_data?.courier;
    const cour = normalizeCourierName(rawCour);
    if (!deliveredCourierMap.has(cour)) deliveredCourierMap.set(cour, { count: 0, rev: 0 });
    const e = deliveredCourierMap.get(cour)!;
    e.count++;
    e.rev += Math.round(Number(o.price) || Number(o.order_total) || 0);
  });
  const deliveredByCourierList = Array.from(deliveredCourierMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const deliveredCourierSummaryRows: (string | number)[][] = deliveredByCourierList.map(([cour, d]) => [
    cour,
    d.count,
    deduplicatedDeliveredOrders.length > 0 ? `${((d.count / deduplicatedDeliveredOrders.length) * 100).toFixed(1)}%` : '0%',
    d.rev,
    totalDeliveredValue > 0 ? `${((d.rev / totalDeliveredValue) * 100).toFixed(1)}%` : '0%',
    d.count > 0 ? Math.round(d.rev / d.count) : 0
  ]);

  // Delivered Orders Daily Trend
  const deliveredDailyMap = new Map<string, { count: number; rev: number }>();
  deduplicatedDeliveredOrders.forEach(o => {
    const rawDate =
      (o as any).delivered_date ||
      (o as any).extra_data?.delivered_date ||
      (o as any).fulfilled_date ||
      o.order_date;
    const dStr = (rawDate || '').split(/[T ]/)[0] || 'Unknown';
    if (!deliveredDailyMap.has(dStr)) deliveredDailyMap.set(dStr, { count: 0, rev: 0 });
    const e = deliveredDailyMap.get(dStr)!;
    e.count++;
    e.rev += Math.round(Number(o.price) || Number(o.order_total) || 0);
  });
  const deliveredDailySorted = Array.from(deliveredDailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumDeliveredOrders = 0;
  let cumDeliveredRev = 0;
  const deliveredDailyTrendRows: (string | number)[][] = deliveredDailySorted.map(([d, data]) => {
    cumDeliveredOrders += data.count;
    cumDeliveredRev += data.rev;
    return [
      formatExcelDate(d),
      data.count,
      data.rev,
      cumDeliveredOrders,
      cumDeliveredRev
    ];
  });

  const deliveredDetailHeaders = [
    'S.No',
    'Order ID',
    'Order Date',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'Payment Mode',
    'Order Value (₹)',
    'Courier Partner',
    'AWB / Tracking Number',
    'Dispatch Status',
    'Shipment Status',
    'Delivered Date',
    'Product Description',
    'Quantity'
  ];

  const deliveredDetailDataRows: (string | number)[][] = deduplicatedDeliveredOrders.length > 0
    ? deduplicatedDeliveredOrders.map((o: any, idx: number) => {
        const orderPrice = Math.round(Number(o.price) || Number(o.order_total) || 0);
        const resolvedLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
        const cState = o.canonicalState || resolvedLoc.stateName || normalizeStateName(o.state) || 'Unspecified';
        const cCity = o.canonicalCity || resolvedLoc.cityName || normalizeCityName(o.city) || 'Unspecified';

        const rawCourier = o.courier || (o as any).extra_data?.courier || 'ST Courier';
        const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim() || '-';
        const dStatus = o.dispatch_status || (o as any).extra_data?.dispatch_status || 'DELIVERED';
        const rawStatus = (o as any).shipment_status || (o as any).raw_status || (o as any).extra_data?.delhivery_current_status || (o as any).extra_data?.raw_status || 'Delivered';

        const delDateRaw =
          (o as any).delivered_date ||
          (o as any).extra_data?.delivered_date ||
          (o as any).fulfilled_date ||
          o.order_date;

        let prodDesc = '';
        let qty = Number(o.total_quantity) || 1;
        if (Array.isArray(o.items) && o.items.length > 0) {
          prodDesc = o.items.map((it: any) => `${resolveCanonicalProductName(it.product_name, it.product_code)} × ${it.quantity || 1}`).join(' | ');
          qty = o.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
        } else {
          prodDesc = o.order_formatted || resolveCanonicalProductName(o.product_name) || 'Standard Products';
        }

        return [
          idx + 1,
          o.order_id || o.id,
          formatExcelDate(o.order_date),
          o.customer_name || 'Customer',
          o.phone ? String(o.phone) : '-',
          cCity,
          cState,
          o.payment_mode || 'UNKNOWN',
          orderPrice,
          rawCourier,
          awb,
          dStatus,
          rawStatus,
          formatExcelDate(delDateRaw),
          prodDesc,
          qty
        ];
      })
    : [['-', '-', '-', 'No delivered orders recorded in the selected period', '-', '-', '-', '-', 0, '-', '-', '-', '-', '-', '-', 0]];

  const sDeliveredRows: (string | number)[][] = [
    ['VELMORA - VERIFIED DELIVERED ORDERS (AUTHORITATIVE CARRIER AUDIT)'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Verified Deliveries', deduplicatedDeliveredOrders.length, 'Orders with verified carrier delivery confirmation'],
    ['Total Delivered Order Value', Math.round(totalDeliveredValue), '₹ (INR) Gross Delivered Sales Value'],
    ['Carrier Delivery Success Rate', deliveryRate, '% of Concluded Shipments'],
    [],
    ['SECTION A.1 - DELIVERED ORDERS BY COURIER PARTNER'],
    ['Courier Partner', 'Delivered Orders', 'Share of Delivered Orders (%)', 'Delivered Revenue (₹)', 'Share of Delivered Revenue (%)', 'Average Ticket Value (₹)'],
    ...deliveredCourierSummaryRows,
    [
      'Total Delivered',
      deduplicatedDeliveredOrders.length,
      '100.0%',
      Math.round(totalDeliveredValue),
      '100.0%',
      deduplicatedDeliveredOrders.length > 0 ? Math.round(totalDeliveredValue / deduplicatedDeliveredOrders.length) : 0
    ],
    [],
    ['SECTION A.2 - DAILY DELIVERED ORDERS TREND'],
    ['Delivered Date', 'Delivered Orders', 'Delivered Revenue (₹)', 'Cumulative Delivered Orders', 'Cumulative Delivered Value (₹)'],
    ...(deliveredDailyTrendRows.length > 0 ? deliveredDailyTrendRows : [['-', 0, 0, 0, 0]]),
    [],
    ['SECTION B - VERIFIED DELIVERED ORDERS (AUDIT REGISTER)'],
    deliveredDetailHeaders,
    ...deliveredDetailDataRows
  ];

  const wsDelivered = XLSX.utils.aoa_to_sheet(sDeliveredRows);
  const deliveredHeaderRowIndex = 14 + deliveredCourierSummaryRows.length + (deliveredDailyTrendRows.length > 0 ? deliveredDailyTrendRows.length : 1);
  enhanceWorksheet(wsDelivered, deliveredHeaderRowIndex, true, {
    s: { r: deliveredHeaderRowIndex, c: 0 },
    e: { r: sDeliveredRows.length - 1, c: deliveredDetailHeaders.length - 1 }
  });

  // =========================================================================
  // BI WORKSHEETS (PARTS 13 TO 19)
  // =========================================================================
  const biMonthlyRecords = calculateMonthlyPerformance(orders);
  const biYearlyRecords = calculateYearlyPerformance(biMonthlyRecords);
  const { products: biProducts } = calculateProductIntelligence(orders);
  const { combos: biCombos } = calculateComboIntelligence(biProducts, orders);
  const { items: biPricingItems, keyInsights: biKeyInsights } = calculateProductPricingInsights(biProducts, orders);

  // 13. Monthly Performance Sheet
  const monthlyHeaders = [
    'Month',
    'Total Orders',
    'Gross Order Value (INR)',
    'Net Sales (INR)',
    'Units Sold',
    'Average Order Value (AOV)',
    'Delivered Orders',
    'Delivered Revenue (INR)',
    'RTO Orders',
    'RTO Value (INR)',
    'Cancelled Orders',
    'Cancellation Value (INR)',
    'Repeat Customers',
    'New Customers'
  ];
  const monthlyDataRows = biMonthlyRecords.map(m => [
    m.monthLabel,
    m.totalOrders,
    m.grossOrderValue,
    m.netSales,
    m.unitsSold,
    m.aov,
    m.deliveredOrders,
    m.deliveredRevenue,
    m.rtoOrders,
    m.rtoValue,
    m.cancelledOrders,
    m.cancellationValue,
    m.repeatCustomers,
    m.newCustomers
  ]);

  // Section A.1: Monthly Order Volume & Velocity Trend
  const monthlyOrderVolumeTrendRows = biMonthlyRecords.map((m, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1] : null;
    const momOrderGrowth = prev && prev.totalOrders > 0
      ? `${(((m.totalOrders - prev.totalOrders) / prev.totalOrders) * 100).toFixed(1)}%`
      : '-';
    return [
      m.monthLabel,
      m.totalOrders,
      m.deliveredOrders,
      m.cancelledOrders,
      m.rtoOrders,
      momOrderGrowth
    ];
  });

  // Section A.2: Monthly Revenue & AOV Trend
  const monthlyRevenueTrendRows = biMonthlyRecords.map((m, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1] : null;
    const momRevGrowth = prev && prev.grossOrderValue > 0
      ? `${(((m.grossOrderValue - prev.grossOrderValue) / prev.grossOrderValue) * 100).toFixed(1)}%`
      : '-';
    return [
      m.monthLabel,
      m.grossOrderValue,
      m.netSales,
      m.deliveredRevenue,
      m.aov,
      momRevGrowth
    ];
  });

  const monthlyRows: (string | number)[][] = [
    ['VELMORA - MONTHLY BUSINESS PERFORMANCE TRENDS'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Months Tracked', biMonthlyRecords.length, 'Monthly Cohorts'],
    [],
    ['SECTION A.1 - MONTHLY ORDER VOLUME & VELOCITY TREND'],
    ['Month', 'Total Orders', 'Delivered Orders', 'Cancelled Orders', 'RTO Orders', 'MoM Order Growth (%)'],
    ...monthlyOrderVolumeTrendRows,
    [],
    ['SECTION A.2 - MONTHLY REVENUE & AOV TREND'],
    ['Month', 'Gross Revenue (INR)', 'Net Sales (INR)', 'Delivered Revenue (INR)', 'AOV (INR)', 'MoM Revenue Growth (%)'],
    ...monthlyRevenueTrendRows,
    [],
    ['SECTION B - COMPREHENSIVE MONTHLY PERFORMANCE COHORTS'],
    monthlyHeaders,
    ...(monthlyDataRows.length > 0 ? monthlyDataRows : [['-', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
  ];
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
  const monthlyHeaderRowIndex = 12 + monthlyOrderVolumeTrendRows.length + monthlyRevenueTrendRows.length;
  enhanceWorksheet(wsMonthly, monthlyHeaderRowIndex, true, {
    s: { r: monthlyHeaderRowIndex, c: 0 },
    e: { r: monthlyRows.length - 1, c: monthlyHeaders.length - 1 }
  });

  // 14. Yearly Performance Sheet
  const yearlyHeaders = [
    'Year',
    'Total Orders',
    'YoY Orders Growth (%)',
    'Gross Revenue (INR)',
    'YoY Revenue Growth (%)',
    'Net Sales (INR)',
    'Units Sold',
    'Average Order Value (AOV)',
    'Delivered Orders',
    'Delivered Revenue (INR)',
    'RTO Orders',
    'RTO Value (INR)',
    'Cancelled Orders',
    'Cancellation Value (INR)',
    'Repeat Customers',
    'New Customers'
  ];
  const yearlyDataRows = biYearlyRecords.map(y => [
    y.yearLabel,
    y.totalOrders,
    y.yoyOrdersGrowthPercent != null ? `${y.yoyOrdersGrowthPercent}%` : '-',
    y.grossOrderValue,
    y.yoyRevenueGrowthPercent != null ? `${y.yoyRevenueGrowthPercent}%` : '-',
    y.netSales,
    y.unitsSold,
    y.aov,
    y.deliveredOrders,
    y.deliveredRevenue,
    y.rtoOrders,
    y.rtoValue,
    y.cancelledOrders,
    y.cancellationValue,
    y.repeatCustomers,
    y.newCustomers
  ]);

  // Section A.1: Annual Order & Revenue Trajectory
  const yearlyOrderRevTrendRows = biYearlyRecords.map(y => [
    y.yearLabel,
    y.totalOrders,
    y.yoyOrdersGrowthPercent != null ? `${y.yoyOrdersGrowthPercent}%` : '-',
    y.grossOrderValue,
    y.yoyRevenueGrowthPercent != null ? `${y.yoyRevenueGrowthPercent}%` : '-',
    y.netSales,
    y.deliveredRevenue
  ]);

  // Section A.2: Annual Unit Volume & Customer Cohorts
  const yearlyUnitCustTrendRows = biYearlyRecords.map(y => {
    const totalCusts = (y.repeatCustomers || 0) + (y.newCustomers || 0);
    const repeatRate = totalCusts > 0 ? `${(((y.repeatCustomers || 0) / totalCusts) * 100).toFixed(1)}%` : '-';
    return [
      y.yearLabel,
      y.unitsSold,
      y.aov,
      y.repeatCustomers,
      y.newCustomers,
      repeatRate
    ];
  });

  const yearlyRows: (string | number)[][] = [
    ['VELMORA - YEARLY BUSINESS PERFORMANCE & YOY GROWTH'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Years Tracked', biYearlyRecords.length, 'Annual Cohorts'],
    [],
    ['SECTION A.1 - ANNUAL ORDER & REVENUE TRAJECTORY'],
    ['Year', 'Total Orders', 'YoY Order Growth (%)', 'Gross Revenue (INR)', 'YoY Revenue Growth (%)', 'Net Sales (INR)', 'Delivered Revenue (INR)'],
    ...yearlyOrderRevTrendRows,
    [],
    ['SECTION A.2 - ANNUAL UNIT VOLUME & CUSTOMER COHORTS'],
    ['Year', 'Units Sold', 'AOV (INR)', 'Repeat Customers', 'New Customers', 'Repeat Customer Share (%)'],
    ...yearlyUnitCustTrendRows,
    [],
    ['SECTION B - COMPREHENSIVE YEARLY PERFORMANCE COHORTS'],
    yearlyHeaders,
    ...(yearlyDataRows.length > 0 ? yearlyDataRows : [['-', 0, '-', 0, '-', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
  ];
  const wsYearly = XLSX.utils.aoa_to_sheet(yearlyRows);
  const yearlyHeaderRowIndex = 12 + yearlyOrderRevTrendRows.length + yearlyUnitCustTrendRows.length;
  enhanceWorksheet(wsYearly, yearlyHeaderRowIndex, true, {
    s: { r: yearlyHeaderRowIndex, c: 0 },
    e: { r: yearlyRows.length - 1, c: yearlyHeaders.length - 1 }
  });

  // 15. Product Performance Sheet
  const prodHeaders = [
    'Rank',
    'Product Name',
    'Category',
    'Orders Containing Product',
    'Total Quantity Sold (Units)',
    'Total Sales Revenue (INR)',
    'Average Selling Price (ASP)',
    'Min Selling Price (INR)',
    'Max Selling Price (INR)',
    'Repeat Buyers',
    'Repeat Quantity Sold',
    'Repeat Sales Value (INR)',
    'Revenue Contribution (%)',
    'First Purchase Date',
    'Last Purchase Date'
  ];
  const prodDataRows = biProducts.map((p, idx) => [
    idx + 1,
    p.productName,
    p.isCombo ? 'Combo Package' : 'Individual Product',
    p.orderCount,
    p.totalQuantity,
    p.totalRevenue,
    p.averageSellingPrice,
    p.minSellingPrice,
    p.maxSellingPrice,
    p.repeatBuyers,
    p.repeatQuantity,
    p.repeatSalesValue,
    `${p.revenueContributionPercent}%`,
    p.firstPurchaseDate,
    p.lastPurchaseDate
  ]);

  // Section A: Top 5 by Revenue
  const biTop5ByRev = biProducts.slice(0, 5);
  // Section B: Top 5 by Units Sold
  const biTop5ByUnits = [...biProducts].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);

  const prodRows: (string | number)[][] = [
    ['VELMORA - COMPREHENSIVE PRODUCT INTELLIGENCE & LINE-ITEM METRICS'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Products Tracked', biProducts.length, 'Unique Products'],
    [],
    ['SECTION A - TOP 5 PRODUCTS BY REVENUE'],
    ['Rank', 'Product Name', 'Category', 'Total Sales Revenue (INR)', 'Revenue Contribution (%)', 'Average Selling Price (INR)'],
    ...biTop5ByRev.map((p, idx) => [
      idx + 1,
      p.productName,
      p.isCombo ? 'Combo Package' : 'Individual Product',
      p.totalRevenue,
      `${p.revenueContributionPercent}%`,
      p.averageSellingPrice
    ]),
    [],
    ['SECTION B - TOP 5 PRODUCTS BY UNITS SOLD'],
    ['Rank', 'Product Name', 'Category', 'Total Quantity Sold (Units)', 'Orders Containing Product', 'Average Selling Price (INR)'],
    ...biTop5ByUnits.map((p, idx) => [
      idx + 1,
      p.productName,
      p.isCombo ? 'Combo Package' : 'Individual Product',
      p.totalQuantity,
      p.orderCount,
      p.averageSellingPrice
    ]),
    [],
    ['SECTION C - COMPLETE PRODUCT PERFORMANCE METRICS'],
    prodHeaders,
    ...(prodDataRows.length > 0 ? prodDataRows : [['-', '-', '-', 0, 0, 0, 0, 0, 0, 0, 0, 0, '-', '-', '-']])
  ];
  const wsProductPerf = XLSX.utils.aoa_to_sheet(prodRows);
  const prodHeaderRowIndex = 12 + biTop5ByRev.length + biTop5ByUnits.length;
  enhanceWorksheet(wsProductPerf, prodHeaderRowIndex, true, {
    s: { r: prodHeaderRowIndex, c: 0 },
    e: { r: prodRows.length - 1, c: prodHeaders.length - 1 }
  });

  // 16. Combo Performance Sheet
  const comboHeaders = [
    'Rank',
    'Combo Name',
    'Orders Sold',
    'Units Sold',
    'Total Revenue (INR)',
    'Average Selling Price (ASP)',
    'Repeat Buyers',
    'Repeat Sales Value (INR)',
    'Contribution to Combos Sales (%)'
  ];
  const comboDataRows = biCombos.map((c, idx) => [
    idx + 1,
    c.comboName,
    c.ordersSold,
    c.unitsSold,
    c.totalRevenue,
    c.averageSellingPrice,
    c.repeatBuyers,
    c.repeatSalesValue,
    `${c.revenueContributionPercent}%`
  ]);

  const biTopCombosByRev = biCombos.slice(0, 5);
  const biTopCombosByUnits = [...biCombos].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);

  const comboRows: (string | number)[][] = [
    ['VELMORA - BEST PERFORMING COMBOS INTELLIGENCE'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Total Combos Tracked', biCombos.length, 'Catalog Combos'],
    [],
    ['SECTION A - BEST PERFORMING COMBOS BY REVENUE'],
    ['Rank', 'Combo Name', 'Total Revenue (INR)', 'Contribution to Combo Sales (%)', 'Orders Sold', 'Average Selling Price (INR)'],
    ...(biTopCombosByRev.length > 0
      ? biTopCombosByRev.map((c, idx) => [
          idx + 1,
          c.comboName,
          c.totalRevenue,
          `${c.revenueContributionPercent}%`,
          c.ordersSold,
          c.averageSellingPrice
        ])
      : [['-', 'No combo sales recorded in the selected period', 0, '0.0%', 0, 0]]),
    [],
    ['SECTION B - COMBO VOLUME & QUANTITY COMPARISON'],
    ['Rank', 'Combo Name', 'Units Sold', 'Orders Sold', 'Average Selling Price (INR)', 'Repeat Buyers'],
    ...(biTopCombosByUnits.length > 0
      ? biTopCombosByUnits.map((c, idx) => [
          idx + 1,
          c.comboName,
          c.unitsSold,
          c.ordersSold,
          c.averageSellingPrice,
          c.repeatBuyers
        ])
      : [['-', 'No combo sales recorded in the selected period', 0, 0, 0, 0]]),
    [],
    ['SECTION C - COMPLETE COMBO PERFORMANCE METRICS'],
    comboHeaders,
    ...(comboDataRows.length > 0 ? comboDataRows : [['-', '-', 0, 0, 0, 0, 0, 0, '-']])
  ];
  const wsComboPerf = XLSX.utils.aoa_to_sheet(comboRows);
  const comboHeaderRowIndex = 12 + (biTopCombosByRev.length > 0 ? biTopCombosByRev.length : 1) + (biTopCombosByUnits.length > 0 ? biTopCombosByUnits.length : 1);
  enhanceWorksheet(wsComboPerf, comboHeaderRowIndex, true, {
    s: { r: comboHeaderRowIndex, c: 0 },
    e: { r: comboRows.length - 1, c: comboHeaders.length - 1 }
  });

  // 17. Product Pricing Insights Sheet
  const pricingHeaders = [
    'Rank',
    'Product Name',
    'Average Selling Price (ASP)',
    'Lowest Selling Price (INR)',
    'Highest Selling Price (INR)',
    'Total Revenue (INR)',
    'Quantity Sold (Units)',
    'Order Count',
    'Units < INR 500',
    'Units INR 500-999',
    'Units INR 1000-1499',
    'Units INR 1500+'
  ];
  const pricingDataRows = biPricingItems.map((p, idx) => [
    idx + 1,
    p.productName,
    p.averageSellingPrice,
    p.minSellingPrice,
    p.maxSellingPrice,
    p.totalRevenue,
    p.totalQuantity,
    p.orderCount,
    p.priceDistribution.under500,
    p.priceDistribution.from500to999,
    p.priceDistribution.from1000to1499,
    p.priceDistribution.above1500
  ]);

  // Section A.1: Top Products by ASP
  const topProductsByAsp = [...biPricingItems].sort((a, b) => b.averageSellingPrice - a.averageSellingPrice).slice(0, 5);
  // Section A.2: Price Sensitivity
  let totalUnitsUnder500 = 0;
  let totalUnits500to999 = 0;
  let totalUnits1000to1499 = 0;
  let totalUnitsAbove1500 = 0;
  biPricingItems.forEach(p => {
    totalUnitsUnder500 += p.priceDistribution.under500 || 0;
    totalUnits500to999 += p.priceDistribution.from500to999 || 0;
    totalUnits1000to1499 += p.priceDistribution.from1000to1499 || 0;
    totalUnitsAbove1500 += p.priceDistribution.above1500 || 0;
  });
  const totalPricingUnits = totalUnitsUnder500 + totalUnits500to999 + totalUnits1000to1499 + totalUnitsAbove1500;

  const pricingRows: (string | number)[][] = [
    ['VELMORA - PRODUCT PRICING INSIGHTS & PRICE DISTRIBUTION'],
    ['Report Period', `${formatExcelDate(startDate)} to ${formatExcelDate(endDate)}`, 'Date Range (DD-MMM-YYYY)'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    ['Top Revenue Product', biKeyInsights.highestRevenueProduct?.productName || 'N/A', `INR ${biKeyInsights.highestRevenueProduct?.totalRevenue.toLocaleString('en-IN') || 0}`],
    ['Most Units Sold Product', biKeyInsights.mostUnitsSoldProduct?.productName || 'N/A', `${biKeyInsights.mostUnitsSoldProduct?.totalQuantity.toLocaleString('en-IN') || 0} units`],
    ['Highest ASP Product', biKeyInsights.highestAspProduct?.productName || 'N/A', `INR ${biKeyInsights.highestAspProduct?.averageSellingPrice || 0}`],
    ['Lowest ASP Product', biKeyInsights.lowestAspProduct?.productName || 'N/A', `INR ${biKeyInsights.lowestAspProduct?.averageSellingPrice || 0}`],
    [],
    ['SECTION A.1 - TOP PRODUCTS BY HIGHEST AVERAGE SELLING PRICE (ASP)'],
    ['Rank', 'Product Name', 'Average Selling Price (INR)', 'Lowest Price (INR)', 'Highest Price (INR)', 'Total Revenue (INR)', 'Units Sold'],
    ...topProductsByAsp.map((p, idx) => [
      idx + 1,
      p.productName,
      p.averageSellingPrice,
      p.minSellingPrice,
      p.maxSellingPrice,
      p.totalRevenue,
      p.totalQuantity
    ]),
    [],
    ['SECTION A.2 - PRICE SENSITIVITY: PRICE BRACKET VS QUANTITY SOLD'],
    ['Price Bracket', 'Quantity Sold (Units)', 'Share of Units (%)', 'Price Category'],
    [
      'Under INR 500',
      totalUnitsUnder500,
      totalPricingUnits > 0 ? `${((totalUnitsUnder500 / totalPricingUnits) * 100).toFixed(1)}%` : '0%',
      'Mass Market Entry'
    ],
    [
      'INR 500 - INR 999',
      totalUnits500to999,
      totalPricingUnits > 0 ? `${((totalUnits500to999 / totalPricingUnits) * 100).toFixed(1)}%` : '0%',
      'Core Sweet Spot'
    ],
    [
      'INR 1,000 - INR 1,499',
      totalUnits1000to1499,
      totalPricingUnits > 0 ? `${((totalUnits1000to1499 / totalPricingUnits) * 100).toFixed(1)}%` : '0%',
      'Mid-Tier Combos'
    ],
    [
      'INR 1,500 and Above',
      totalUnitsAbove1500,
      totalPricingUnits > 0 ? `${((totalUnitsAbove1500 / totalPricingUnits) * 100).toFixed(1)}%` : '0%',
      'Premium Packages'
    ],
    [],
    ['SECTION B - DETAILED PRODUCT PRICING & PRICE DISTRIBUTION'],
    pricingHeaders,
    ...(pricingDataRows.length > 0 ? pricingDataRows : [['-', '-', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
  ];
  const wsPricing = XLSX.utils.aoa_to_sheet(pricingRows);
  const pricingHeaderRowIndex = 21 + topProductsByAsp.length;
  enhanceWorksheet(wsPricing, pricingHeaderRowIndex, true, {
    s: { r: pricingHeaderRowIndex, c: 0 },
    e: { r: pricingRows.length - 1, c: pricingHeaders.length - 1 }
  });

  // 18. Monthly Comparison Sheet
  const latestMonth = biMonthlyRecords[biMonthlyRecords.length - 1];
  const priorMonth = biMonthlyRecords[biMonthlyRecords.length - 2] || latestMonth;
  const monthCompResult = latestMonth && priorMonth ? comparePeriods(latestMonth, priorMonth, 'monthly') : null;

  // Split into Revenue metrics and Volume metrics
  const revMetricKeywords = ['revenue', 'sales', 'value', 'aov', 'price'];
  const monthRevMetrics = monthCompResult
    ? monthCompResult.metrics.filter(m => revMetricKeywords.some(k => m.metricLabel.toLowerCase().includes(k)))
    : [];
  const monthVolMetrics = monthCompResult
    ? monthCompResult.metrics.filter(m => !revMetricKeywords.some(k => m.metricLabel.toLowerCase().includes(k)))
    : [];

  const monthCompHeaders = [
    'Performance Metric',
    `${monthCompResult?.currentLabel || 'Current Month'} (Current)`,
    `${monthCompResult?.previousLabel || 'Baseline Month'} (Baseline)`,
    'Absolute Difference',
    'Percentage Change (%)'
  ];

  const monthCompRows: (string | number)[][] = [
    ['VELMORA - MONTHLY PERIOD COMPARISON AUDIT'],
    ['Comparison', monthCompResult ? `${monthCompResult.currentLabel} vs ${monthCompResult.previousLabel}` : 'N/A', 'Month-over-Month'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A.1 - REVENUE & MONETARY COMPARISON'],
    monthCompHeaders,
    ...(monthRevMetrics.length > 0
      ? monthRevMetrics.map(m => [
          m.metricLabel,
          m.currentValue,
          m.previousValue,
          m.difference,
          m.percentChange != null ? `${m.percentChange}%` : 'N/A'
        ])
      : [['-', 0, 0, 0, '-']]),
    [],
    ['SECTION A.2 - ORDER VOLUME & OPERATIONAL COMPARISON'],
    monthCompHeaders,
    ...(monthVolMetrics.length > 0
      ? monthVolMetrics.map(m => [
          m.metricLabel,
          m.currentValue,
          m.previousValue,
          m.difference,
          m.percentChange != null ? `${m.percentChange}%` : 'N/A'
        ])
      : [['-', 0, 0, 0, '-']]),
    [],
    ['SECTION B - FULL METRIC-BY-METRIC MONTHLY AUDIT TABLE'],
    monthCompHeaders,
    ...(monthCompResult && monthCompResult.metrics.length > 0
      ? monthCompResult.metrics.map(m => [
          m.metricLabel,
          m.currentValue,
          m.previousValue,
          m.difference,
          m.percentChange != null ? `${m.percentChange}%` : 'N/A'
        ])
      : [['-', 0, 0, 0, '-']])
  ];
  const wsMonthlyComp = XLSX.utils.aoa_to_sheet(monthCompRows);
  const monthlyCompHeaderRowIndex = 12 + monthRevMetrics.length + monthVolMetrics.length;
  enhanceWorksheet(wsMonthlyComp, monthlyCompHeaderRowIndex, true, {
    s: { r: monthlyCompHeaderRowIndex, c: 0 },
    e: { r: monthCompRows.length - 1, c: monthCompHeaders.length - 1 }
  });

  // 19. Yearly Comparison Sheet
  const latestYear = biYearlyRecords[biYearlyRecords.length - 1];
  const priorYear = biYearlyRecords[biYearlyRecords.length - 2] || latestYear;
  const yearCompResult = latestYear && priorYear ? comparePeriods(latestYear, priorYear, 'yearly') : null;

  const yearRevMetrics = yearCompResult
    ? yearCompResult.metrics.filter(m => revMetricKeywords.some(k => m.metricLabel.toLowerCase().includes(k)))
    : [];
  const yearVolMetrics = yearCompResult
    ? yearCompResult.metrics.filter(m => !revMetricKeywords.some(k => m.metricLabel.toLowerCase().includes(k)))
    : [];

  const yearCompHeaders = [
    'Performance Metric',
    `${yearCompResult?.currentLabel || 'Current Year'} (Current)`,
    `${yearCompResult?.previousLabel || 'Baseline Year'} (Baseline)`,
    'Absolute Difference',
    'Percentage Change (%)'
  ];

  const yearCompRows: (string | number)[][] = [
    ['VELMORA - YEARLY PERIOD COMPARISON AUDIT'],
    ['Comparison', yearCompResult ? `${yearCompResult.currentLabel} vs ${yearCompResult.previousLabel}` : 'N/A', 'Year-over-Year'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Timestamp'],
    [],
    ['SECTION A.1 - ANNUAL REVENUE & COMMERCIAL COMPARISON'],
    yearCompHeaders,
    ...(yearRevMetrics.length > 0
      ? yearRevMetrics.map(m => [
          m.metricLabel,
          m.currentValue,
          m.previousValue,
          m.difference,
          m.percentChange != null ? `${m.percentChange}%` : 'N/A'
        ])
      : [['-', 0, 0, 0, '-']]),
    [],
    ['SECTION A.2 - ANNUAL ORDER VOLUME & FULFILLMENT COMPARISON'],
    yearCompHeaders,
    ...(yearVolMetrics.length > 0
      ? yearVolMetrics.map(m => [
          m.metricLabel,
          m.currentValue,
          m.previousValue,
          m.difference,
          m.percentChange != null ? `${m.percentChange}%` : 'N/A'
        ])
      : [['-', 0, 0, 0, '-']]),
    [],
    ['SECTION B - FULL METRIC-BY-METRIC YEARLY AUDIT TABLE'],
    yearCompHeaders,
    ...(yearCompResult && yearCompResult.metrics.length > 0
      ? yearCompResult.metrics.map(m => [
          m.metricLabel,
          m.currentValue,
          m.previousValue,
          m.difference,
          m.percentChange != null ? `${m.percentChange}%` : 'N/A'
        ])
      : [['-', 0, 0, 0, '-']])
  ];
  const wsYearlyComp = XLSX.utils.aoa_to_sheet(yearCompRows);
  const yearlyCompHeaderRowIndex = 12 + yearRevMetrics.length + yearVolMetrics.length;
  enhanceWorksheet(wsYearlyComp, yearlyCompHeaderRowIndex, true, {
    s: { r: yearlyCompHeaderRowIndex, c: 0 },
    e: { r: yearCompRows.length - 1, c: yearCompHeaders.length - 1 }
  });

  // =========================================================================
  // Assemble Workbook & Download (Exact 19 Worksheets Order)
  // Replaced 'Unknown Records' with 'Delivered Orders'
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
  XLSX.utils.book_append_sheet(wb, wsDelivered, 'Delivered Orders');

  // Append BI Worksheets
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Performance');
  XLSX.utils.book_append_sheet(wb, wsYearly, 'Yearly Performance');
  XLSX.utils.book_append_sheet(wb, wsProductPerf, 'Product Performance');
  XLSX.utils.book_append_sheet(wb, wsComboPerf, 'Combo Performance');
  XLSX.utils.book_append_sheet(wb, wsPricing, 'Product Pricing Insights');
  XLSX.utils.book_append_sheet(wb, wsMonthlyComp, 'Monthly Comparison');
  XLSX.utils.book_append_sheet(wb, wsYearlyComp, 'Yearly Comparison');

  const filename = startDate === endDate
    ? `Website_Sales_Analytics_${startDate}.xlsx`
    : `Website_Sales_Analytics_${startDate}_to_${endDate}.xlsx`;

  XLSX.writeFile(wb, filename);
}
