import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../../types';
import { normalizeProductGroupingKey, resolveCanonicalProductName } from '../../websiteSalesUtils';
import { isComboItem } from '../TopPerformingProductsCombos';
import type {
  MonthlyPerformanceRecord,
  YearlyPerformanceRecord,
  ProductIntelligenceItem,
  ComboIntelligenceItem,
  ProductPricingInsightItem,
  ProductMonthlyTrendPoint,
  ComboMonthlyTrendPoint,
  PeriodComparisonMetric,
  PeriodComparisonResult
} from './businessTrendsTypes';

export const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function formatMonthYearLabel(monthKey: string): string {
  if (!monthKey) return 'Unknown';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return monthKey;
  return `${SHORT_MONTH_NAMES[m - 1]} ${y}`;
}

export function sanitizeCustomerPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function isOrderCancelled(order: WebsiteConsolidatedOrder): boolean {
  if (order.isCancelled) return true;
  if (order.order_status === 'CANCELLED') return true;
  if (order.cancellation?.status === 'CANCELLED') return true;
  if (order.fulfillment_status === 'cancelled') return true;
  return false;
}

export function isOrderDelivered(order: WebsiteConsolidatedOrder): boolean {
  if (isOrderCancelled(order)) return false;
  if (order.isDelivered) return true;
  if (order.dispatch_status === 'DELIVERED') return true;
  if (order.order_status === 'DELIVERED') return true;
  if (order.fulfillment_status === 'delivered') return true;
  return false;
}

export function isOrderRTO(order: WebsiteConsolidatedOrder): boolean {
  if (isOrderCancelled(order)) return false;
  if (order.isRTO) return true;
  if (order.dispatch_status === 'RTO' || order.dispatch_status === 'RTO DELIVERED' || order.dispatch_status === 'RTO IN TRANSIT') return true;
  if (order.order_status === 'RTO') return true;
  return false;
}

/**
 * 1. Calculate Full-Year Monthly Performance Records (Strict 12 Months Jan-Dec)
 * Guaranteed to return all 12 calendar months:
 * January -> February -> March -> April -> May -> June -> July -> August -> September -> October -> November -> December.
 * Months with 0 orders have all metrics set to 0.
 */
export function calculateMonthlyPerformance(
  orders: WebsiteConsolidatedOrder[],
  targetYear?: number | null
): MonthlyPerformanceRecord[] {
  // Determine target year
  let year = targetYear;
  if (!year) {
    // If no year specified, look at the most recent order date or default to current year 2026
    const dates = orders.map(o => o.order_date).filter(Boolean) as string[];
    if (dates.length > 0) {
      const sorted = [...dates].sort();
      const latest = sorted[sorted.length - 1];
      year = parseInt(latest.slice(0, 4), 10) || 2026;
    } else {
      year = new Date().getFullYear();
    }
  }

  // Pre-initialize all 12 calendar months with zero values
  const monthMap = new Map<number, {
    orders: WebsiteConsolidatedOrder[];
    grossRev: number;
    cancelledOrders: number;
    cancelVal: number;
    deliveredOrders: number;
    deliveredRev: number;
    rtoOrders: number;
    rtoVal: number;
    units: number;
    customerOrdersMap: Map<string, number>;
  }>();

  for (let m = 1; m <= 12; m++) {
    monthMap.set(m, {
      orders: [],
      grossRev: 0,
      cancelledOrders: 0,
      cancelVal: 0,
      deliveredOrders: 0,
      deliveredRev: 0,
      rtoOrders: 0,
      rtoVal: 0,
      units: 0,
      customerOrdersMap: new Map()
    });
  }

  // Build global customer valid order count to distinguish repeat vs new buyers
  const globalCustomerValidOrders = new Map<string, number>();
  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const phone = sanitizeCustomerPhone(o.phone);
    const key = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    if (!key) return;
    globalCustomerValidOrders.set(key, (globalCustomerValidOrders.get(key) || 0) + 1);
  });

  // Populate data into months
  orders.forEach(o => {
    if (o.order_status === 'DELETED') return;
    const dateStr = o.order_date || '';
    if (!dateStr || dateStr.length < 7) return;

    const orderYear = parseInt(dateStr.slice(0, 4), 10);
    if (orderYear !== year) return; // Only process orders for this specific year

    const orderMonth = parseInt(dateStr.slice(5, 7), 10);
    if (orderMonth < 1 || orderMonth > 12) return;

    const data = monthMap.get(orderMonth)!;
    data.orders.push(o);
    const price = Number(o.price) || 0;
    const units = Number(o.total_quantity) || 1;

    data.grossRev += price;

    if (isOrderCancelled(o)) {
      data.cancelledOrders += 1;
      data.cancelVal += price;
    } else {
      data.units += units;

      if (isOrderDelivered(o)) {
        data.deliveredOrders += 1;
        data.deliveredRev += price;
      } else if (isOrderRTO(o)) {
        data.rtoOrders += 1;
        data.rtoVal += price;
      }

      const phone = sanitizeCustomerPhone(o.phone);
      const custKey = phone || (o.customer_name || 'unknown').toLowerCase().trim();
      if (custKey) {
        data.customerOrdersMap.set(custKey, (data.customerOrdersMap.get(custKey) || 0) + 1);
      }
    }
  });

  // Build final array of exactly 12 records in calendar order (Jan..Dec)
  const records: MonthlyPerformanceRecord[] = [];

  for (let m = 1; m <= 12; m++) {
    const data = monthMap.get(m)!;
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const monthShort = SHORT_MONTH_NAMES[m - 1];
    const monthLong = FULL_MONTH_NAMES[m - 1];
    const monthLabel = `${monthShort} ${year}`;
    const totalOrders = data.orders.length;
    const netSales = Math.max(0, data.grossRev - data.cancelVal);
    const validOrdersCount = totalOrders - data.cancelledOrders;
    const aov = validOrdersCount > 0 ? Math.round(netSales / validOrdersCount) : 0;

    let repeatCustomers = 0;
    let newCustomers = 0;

    data.customerOrdersMap.forEach((countInMonth, custKey) => {
      const lifetimeOrders = globalCustomerValidOrders.get(custKey) || countInMonth;
      if (lifetimeOrders > 1) {
        repeatCustomers += 1;
      } else {
        newCustomers += 1;
      }
    });

    records.push({
      monthKey,
      monthNumber: m,
      monthShort,
      monthLong,
      monthLabel,
      year,
      month: m,
      totalOrders,
      grossOrderValue: Math.round(data.grossRev),
      netSales: Math.round(netSales),
      unitsSold: data.units,
      aov,
      deliveredOrders: data.deliveredOrders,
      deliveredRevenue: Math.round(data.deliveredRev),
      rtoOrders: data.rtoOrders,
      rtoValue: Math.round(data.rtoVal),
      cancelledOrders: data.cancelledOrders,
      cancellationValue: Math.round(data.cancelVal),
      repeatCustomers,
      newCustomers,
      matchingOrders: data.orders
    });
  }

  return records;
}

/**
 * 2. Calculate Yearly Performance Records with YoY Growth & All Calendar Years
 */
export function calculateYearlyPerformance(
  input: WebsiteConsolidatedOrder[] | MonthlyPerformanceRecord[],
  yearsCatalog: number[] = [2023, 2024, 2025, 2026]
): YearlyPerformanceRecord[] {
  let allOrders: WebsiteConsolidatedOrder[] = [];
  if (Array.isArray(input) && input.length > 0 && 'monthKey' in input[0]) {
    (input as MonthlyPerformanceRecord[]).forEach(m => {
      if (m.matchingOrders && m.matchingOrders.length > 0) {
        allOrders.push(...m.matchingOrders);
      }
    });
  } else {
    allOrders = (input as WebsiteConsolidatedOrder[]) || [];
  }

  // Discover any additional years present in data
  const yearsSet = new Set<number>(yearsCatalog);
  allOrders.forEach(o => {
    if (o.order_date && o.order_date.length >= 4) {
      const y = parseInt(o.order_date.slice(0, 4), 10);
      if (!isNaN(y) && y >= 2020 && y <= 2030) {
        yearsSet.add(y);
      }
    }
  });

  const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
  const yearlyRecords: YearlyPerformanceRecord[] = [];

  for (let i = 0; i < sortedYears.length; i++) {
    const year = sortedYears[i];
    const yearOrders = allOrders.filter(o => o.order_date && o.order_date.startsWith(String(year)));
    const monthlyBreakdown = calculateMonthlyPerformance(yearOrders, year);

    const totalOrders = monthlyBreakdown.reduce((s, m) => s + m.totalOrders, 0);
    const grossOrderValue = monthlyBreakdown.reduce((s, m) => s + m.grossOrderValue, 0);
    const netSales = monthlyBreakdown.reduce((s, m) => s + m.netSales, 0);
    const unitsSold = monthlyBreakdown.reduce((s, m) => s + m.unitsSold, 0);
    const deliveredOrders = monthlyBreakdown.reduce((s, m) => s + m.deliveredOrders, 0);
    const deliveredRevenue = monthlyBreakdown.reduce((s, m) => s + m.deliveredRevenue, 0);
    const rtoOrders = monthlyBreakdown.reduce((s, m) => s + m.rtoOrders, 0);
    const rtoValue = monthlyBreakdown.reduce((s, m) => s + m.rtoValue, 0);
    const cancelledOrders = monthlyBreakdown.reduce((s, m) => s + m.cancelledOrders, 0);
    const cancellationValue = monthlyBreakdown.reduce((s, m) => s + m.cancellationValue, 0);
    const repeatCustomers = monthlyBreakdown.reduce((s, m) => s + m.repeatCustomers, 0);
    const newCustomers = monthlyBreakdown.reduce((s, m) => s + m.newCustomers, 0);

    const validOrdersCount = totalOrders - cancelledOrders;
    const aov = validOrdersCount > 0 ? Math.round(netSales / validOrdersCount) : 0;

    let yoyOrdersGrowthPercent: number | null = null;
    let yoyRevenueGrowthPercent: number | null = null;
    let yoyNetSalesGrowthPercent: number | null = null;

    if (i > 0) {
      const prevYearRec = yearlyRecords[i - 1];
      if (prevYearRec && prevYearRec.totalOrders > 0) {
        yoyOrdersGrowthPercent = Number((((totalOrders - prevYearRec.totalOrders) / prevYearRec.totalOrders) * 100).toFixed(1));
      } else if (prevYearRec && prevYearRec.totalOrders === 0 && totalOrders > 0) {
        yoyOrdersGrowthPercent = 100;
      }

      if (prevYearRec && prevYearRec.grossOrderValue > 0) {
        yoyRevenueGrowthPercent = Number((((grossOrderValue - prevYearRec.grossOrderValue) / prevYearRec.grossOrderValue) * 100).toFixed(1));
      } else if (prevYearRec && prevYearRec.grossOrderValue === 0 && grossOrderValue > 0) {
        yoyRevenueGrowthPercent = 100;
      }

      if (prevYearRec && prevYearRec.netSales > 0) {
        yoyNetSalesGrowthPercent = Number((((netSales - prevYearRec.netSales) / prevYearRec.netSales) * 100).toFixed(1));
      }
    }

    yearlyRecords.push({
      year,
      yearLabel: String(year),
      totalOrders,
      grossOrderValue,
      totalRevenue: grossOrderValue,
      netSales,
      unitsSold,
      aov,
      deliveredOrders,
      deliveredRevenue,
      rtoOrders,
      rtoValue,
      cancelledOrders,
      cancellationValue,
      repeatCustomers,
      newCustomers,
      yoyOrdersGrowthPercent,
      yoyRevenueGrowthPercent,
      yoyNetSalesGrowthPercent,
      matchingOrders: yearOrders,
      monthlyBreakdown
    });
  }

  return yearlyRecords;
}

/**
 * 3. Calculate 12-Month Monthly Trend for a Specific Product
 * Generates all 12 months for that product with zero values for months with no sales.
 */
export function calculateProduct12MonthTrend(
  productKeyOrName: string,
  orders: WebsiteConsolidatedOrder[],
  year: number = 2026
): ProductMonthlyTrendPoint[] {
  const normTarget = normalizeProductGroupingKey(productKeyOrName);

  // Initialize 12 months
  const monthMap = new Map<number, {
    qty: number;
    rev: number;
    orderSet: Set<string>;
    repeatBuyersSet: Set<string>;
    minPrice: number;
    maxPrice: number;
    hasSales: boolean;
  }>();

  for (let m = 1; m <= 12; m++) {
    monthMap.set(m, {
      qty: 0,
      rev: 0,
      orderSet: new Set(),
      repeatBuyersSet: new Set(),
      minPrice: Infinity,
      maxPrice: -Infinity,
      hasSales: false
    });
  }

  // Global repeat customer detection
  const customerValidOrders = new Map<string, number>();
  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const phone = sanitizeCustomerPhone(o.phone);
    const key = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    if (!key) return;
    customerValidOrders.set(key, (customerValidOrders.get(key) || 0) + 1);
  });

  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const dateStr = o.order_date || '';
    if (!dateStr || dateStr.length < 7) return;

    const orderYear = parseInt(dateStr.slice(0, 4), 10);
    if (orderYear !== year) return;

    const m = parseInt(dateStr.slice(5, 7), 10);
    if (m < 1 || m > 12) return;

    const orderKey = o.order_id || o.id || 'unknown';
    const phone = sanitizeCustomerPhone(o.phone);
    const custKey = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    const isRepeatBuyer = (customerValidOrders.get(custKey) || 0) > 1;

    const monthData = monthMap.get(m)!;

    if (Array.isArray(o.items) && o.items.length > 0) {
      o.items.forEach((it: WebsiteOrderItem) => {
        const rawName = (it.product_name || '').trim();
        const k = normalizeProductGroupingKey(rawName, it.product_code);
        if (k === normTarget || rawName.toLowerCase() === productKeyOrName.toLowerCase()) {
          const qty = Number(it.quantity) || 1;
          const rev = it.line_total != null
            ? Number(it.line_total)
            : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;
          const unitPrice = qty > 0 ? rev / qty : rev;

          monthData.qty += qty;
          monthData.rev += rev;
          monthData.hasSales = true;
          monthData.orderSet.add(orderKey);
          monthData.minPrice = Math.min(monthData.minPrice, unitPrice);
          monthData.maxPrice = Math.max(monthData.maxPrice, unitPrice);

          if (isRepeatBuyer && custKey) {
            monthData.repeatBuyersSet.add(custKey);
          }
        }
      });
    } else {
      const rawName = (o.product_name || '').trim();
      const k = normalizeProductGroupingKey(rawName);
      if (k === normTarget || rawName.toLowerCase() === productKeyOrName.toLowerCase()) {
        const qty = Number(o.total_quantity) || 1;
        const rev = Number(o.price) || 0;
        const unitPrice = qty > 0 ? rev / qty : rev;

        monthData.qty += qty;
        monthData.rev += rev;
        monthData.hasSales = true;
        monthData.orderSet.add(orderKey);
        monthData.minPrice = Math.min(monthData.minPrice, unitPrice);
        monthData.maxPrice = Math.max(monthData.maxPrice, unitPrice);

        if (isRepeatBuyer && custKey) {
          monthData.repeatBuyersSet.add(custKey);
        }
      }
    }
  });

  const points: ProductMonthlyTrendPoint[] = [];

  for (let m = 1; m <= 12; m++) {
    const d = monthMap.get(m)!;
    const asp = d.hasSales && d.qty > 0 ? Math.round(d.rev / d.qty) : null;
    const minP = d.hasSales && d.minPrice !== Infinity ? Math.round(d.minPrice) : null;
    const maxP = d.hasSales && d.maxPrice !== -Infinity ? Math.round(d.maxPrice) : null;

    points.push({
      monthNumber: m,
      monthShort: SHORT_MONTH_NAMES[m - 1],
      monthLong: FULL_MONTH_NAMES[m - 1],
      monthKey: `${year}-${String(m).padStart(2, '0')}`,
      year,
      quantity: d.qty,
      revenue: Math.round(d.rev),
      orderCount: d.orderSet.size,
      repeatBuyers: d.repeatBuyersSet.size,
      averageSellingPrice: asp,
      minSellingPrice: minP,
      maxSellingPrice: maxP,
      hasSales: d.hasSales
    });
  }

  return points;
}

/**
 * 4. Calculate 12-Month Monthly Trend for a Specific Combo
 */
export function calculateCombo12MonthTrend(
  comboKeyOrName: string,
  orders: WebsiteConsolidatedOrder[],
  year: number = 2026
): ComboMonthlyTrendPoint[] {
  const normTarget = normalizeProductGroupingKey(comboKeyOrName);

  const monthMap = new Map<number, {
    ordersSet: Set<string>;
    qty: number;
    rev: number;
    repeatBuyersSet: Set<string>;
    hasSales: boolean;
  }>();

  for (let m = 1; m <= 12; m++) {
    monthMap.set(m, {
      ordersSet: new Set(),
      qty: 0,
      rev: 0,
      repeatBuyersSet: new Set(),
      hasSales: false
    });
  }

  const customerValidOrders = new Map<string, number>();
  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const phone = sanitizeCustomerPhone(o.phone);
    const key = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    if (!key) return;
    customerValidOrders.set(key, (customerValidOrders.get(key) || 0) + 1);
  });

  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const dateStr = o.order_date || '';
    if (!dateStr || dateStr.length < 7) return;

    const orderYear = parseInt(dateStr.slice(0, 4), 10);
    if (orderYear !== year) return;

    const m = parseInt(dateStr.slice(5, 7), 10);
    if (m < 1 || m > 12) return;

    const orderKey = o.order_id || o.id || 'unknown';
    const phone = sanitizeCustomerPhone(o.phone);
    const custKey = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    const isRepeatBuyer = (customerValidOrders.get(custKey) || 0) > 1;

    const monthData = monthMap.get(m)!;

    if (Array.isArray(o.items) && o.items.length > 0) {
      o.items.forEach((it: WebsiteOrderItem) => {
        const rawName = (it.product_name || '').trim();
        const k = normalizeProductGroupingKey(rawName, it.product_code);
        if (k === normTarget || rawName.toLowerCase() === comboKeyOrName.toLowerCase()) {
          const qty = Number(it.quantity) || 1;
          const rev = it.line_total != null
            ? Number(it.line_total)
            : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;

          monthData.qty += qty;
          monthData.rev += rev;
          monthData.hasSales = true;
          monthData.ordersSet.add(orderKey);

          if (isRepeatBuyer && custKey) {
            monthData.repeatBuyersSet.add(custKey);
          }
        }
      });
    } else {
      const rawName = (o.product_name || '').trim();
      const k = normalizeProductGroupingKey(rawName);
      if (k === normTarget || rawName.toLowerCase() === comboKeyOrName.toLowerCase()) {
        const qty = Number(o.total_quantity) || 1;
        const rev = Number(o.price) || 0;

        monthData.qty += qty;
        monthData.rev += rev;
        monthData.hasSales = true;
        monthData.ordersSet.add(orderKey);

        if (isRepeatBuyer && custKey) {
          monthData.repeatBuyersSet.add(custKey);
        }
      }
    }
  });

  const points: ComboMonthlyTrendPoint[] = [];

  for (let m = 1; m <= 12; m++) {
    const d = monthMap.get(m)!;
    const asp = d.hasSales && d.qty > 0 ? Math.round(d.rev / d.qty) : null;

    points.push({
      monthNumber: m,
      monthShort: SHORT_MONTH_NAMES[m - 1],
      monthLong: FULL_MONTH_NAMES[m - 1],
      monthKey: `${year}-${String(m).padStart(2, '0')}`,
      year,
      orders: d.ordersSet.size,
      quantity: d.qty,
      revenue: Math.round(d.rev),
      repeatBuyers: d.repeatBuyersSet.size,
      averageSellingPrice: asp,
      hasSales: d.hasSales
    });
  }

  return points;
}

/**
 * 5. Calculate Comprehensive Product Intelligence (Part 4)
 */
export function calculateProductIntelligence(
  orders: WebsiteConsolidatedOrder[],
  selectedYear?: number
): {
  products: ProductIntelligenceItem[];
  totalAllRevenue: number;
} {
  const pMap = new Map<string, {
    productName: string;
    isCombo: boolean;
    ordersSet: Set<string>;
    totalQty: number;
    totalRev: number;
    minPrice: number;
    maxPrice: number;
    repeatBuyersSet: Set<string>;
    repeatQty: number;
    repeatRev: number;
    firstDate: string;
    lastDate: string;
    matchingOrders: WebsiteConsolidatedOrder[];
  }>();

  const customerValidOrders = new Map<string, number>();
  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const phone = sanitizeCustomerPhone(o.phone);
    const key = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    if (!key) return;
    customerValidOrders.set(key, (customerValidOrders.get(key) || 0) + 1);
  });

  let totalAllRevenue = 0;

  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const orderKey = o.order_id || o.id || 'unknown';
    const orderDate = o.order_date || '';
    const phone = sanitizeCustomerPhone(o.phone);
    const custKey = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    const isRepeatBuyer = (customerValidOrders.get(custKey) || 0) > 1;

    if (Array.isArray(o.items) && o.items.length > 0) {
      o.items.forEach((it: WebsiteOrderItem) => {
        const rawName = (it.product_name || 'Unspecified').trim();
        if (!rawName) return;

        const groupKey = normalizeProductGroupingKey(rawName, it.product_code);
        const canonicalName = resolveCanonicalProductName(rawName, it.product_code);
        const isCombo = isComboItem(rawName) || isComboItem(canonicalName);

        const qty = Number(it.quantity) || 1;
        const rev = it.line_total != null
          ? Number(it.line_total)
          : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;
        const unitPrice = qty > 0 ? rev / qty : rev;

        totalAllRevenue += rev;

        if (!pMap.has(groupKey)) {
          pMap.set(groupKey, {
            productName: canonicalName,
            isCombo,
            ordersSet: new Set(),
            totalQty: 0,
            totalRev: 0,
            minPrice: unitPrice,
            maxPrice: unitPrice,
            repeatBuyersSet: new Set(),
            repeatQty: 0,
            repeatRev: 0,
            firstDate: orderDate,
            lastDate: orderDate,
            matchingOrders: []
          });
        }

        const entry = pMap.get(groupKey)!;
        entry.totalQty += qty;
        entry.totalRev += rev;
        entry.minPrice = Math.min(entry.minPrice, unitPrice);
        entry.maxPrice = Math.max(entry.maxPrice, unitPrice);

        if (orderDate) {
          if (!entry.firstDate || orderDate < entry.firstDate) entry.firstDate = orderDate;
          if (!entry.lastDate || orderDate > entry.lastDate) entry.lastDate = orderDate;
        }

        if (!entry.ordersSet.has(orderKey)) {
          entry.ordersSet.add(orderKey);
          entry.matchingOrders.push(o);
        }

        if (isRepeatBuyer && custKey) {
          entry.repeatBuyersSet.add(custKey);
          entry.repeatQty += qty;
          entry.repeatRev += rev;
        }
      });
    } else {
      const rawName = (o.product_name || 'Unspecified').trim();
      if (!rawName || rawName === 'N/A') return;

      const groupKey = normalizeProductGroupingKey(rawName);
      const canonicalName = resolveCanonicalProductName(rawName);
      const isCombo = isComboItem(rawName) || isComboItem(canonicalName);

      const qty = Number(o.total_quantity) || 1;
      const rev = Number(o.price) || 0;
      const unitPrice = qty > 0 ? rev / qty : rev;

      totalAllRevenue += rev;

      if (!pMap.has(groupKey)) {
        pMap.set(groupKey, {
          productName: canonicalName,
          isCombo,
          ordersSet: new Set(),
          totalQty: 0,
          totalRev: 0,
          minPrice: unitPrice,
          maxPrice: unitPrice,
          repeatBuyersSet: new Set(),
          repeatQty: 0,
          repeatRev: 0,
          firstDate: orderDate,
          lastDate: orderDate,
          matchingOrders: []
        });
      }

      const entry = pMap.get(groupKey)!;
      entry.totalQty += qty;
      entry.totalRev += rev;
      entry.minPrice = Math.min(entry.minPrice, unitPrice);
      entry.maxPrice = Math.max(entry.maxPrice, unitPrice);

      if (orderDate) {
        if (!entry.firstDate || orderDate < entry.firstDate) entry.firstDate = orderDate;
        if (!entry.lastDate || orderDate > entry.lastDate) entry.lastDate = orderDate;
      }

      if (!entry.ordersSet.has(orderKey)) {
        entry.ordersSet.add(orderKey);
        entry.matchingOrders.push(o);
      }

      if (isRepeatBuyer && custKey) {
        entry.repeatBuyersSet.add(custKey);
        entry.repeatQty += qty;
        entry.repeatRev += rev;
      }
    }
  });

  const products: ProductIntelligenceItem[] = Array.from(pMap.entries()).map(([key, data]) => {
    const asp = data.totalQty > 0 ? data.totalRev / data.totalQty : 0;
    const contributionPercent = totalAllRevenue > 0 ? (data.totalRev / totalAllRevenue) * 100 : 0;
    const trend = calculateProduct12MonthTrend(key, orders, selectedYear || 2026);

    return {
      productName: data.productName,
      canonicalKey: key,
      isCombo: data.isCombo,
      orderCount: data.ordersSet.size,
      totalQuantity: data.totalQty,
      totalRevenue: Math.round(data.totalRev),
      averageSellingPrice: Math.round(asp),
      minSellingPrice: Math.round(data.minPrice),
      maxSellingPrice: Math.round(data.maxPrice),
      repeatBuyers: data.repeatBuyersSet.size,
      repeatQuantity: data.repeatQty,
      repeatSalesValue: Math.round(data.repeatRev),
      revenueContributionPercent: Number(contributionPercent.toFixed(2)),
      firstPurchaseDate: data.firstDate || '—',
      lastPurchaseDate: data.lastDate || '—',
      matchingOrders: data.matchingOrders,
      monthlyTrend12Months: trend
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return { products, totalAllRevenue };
}

/**
 * 6. Calculate Best Performing Combos (Part 5)
 */
export function calculateComboIntelligence(
  products: ProductIntelligenceItem[],
  orders: WebsiteConsolidatedOrder[],
  selectedYear?: number
): {
  combos: ComboIntelligenceItem[];
  totalCombosRevenue: number;
} {
  const comboProducts = products.filter(p => p.isCombo);
  const totalCombosRevenue = comboProducts.reduce((sum, c) => sum + c.totalRevenue, 0);

  const combos: ComboIntelligenceItem[] = comboProducts.map(cp => {
    const monthlyMap = new Map<string, { units: number; rev: number }>();
    const yearlyMap = new Map<number, { units: number; rev: number }>();

    cp.matchingOrders.forEach(o => {
      if (isOrderCancelled(o) || o.order_status === 'DELETED') return;
      const dateStr = o.order_date || '';
      if (!dateStr || dateStr.length < 7) return;
      const monthKey = dateStr.slice(0, 7);
      const year = parseInt(dateStr.slice(0, 4), 10);

      let itemQty = 0;
      let itemRev = 0;

      if (Array.isArray(o.items) && o.items.length > 0) {
        o.items.forEach(it => {
          const rawName = (it.product_name || '').trim();
          const key = normalizeProductGroupingKey(rawName, it.product_code);
          if (key === cp.canonicalKey) {
            const qty = Number(it.quantity) || 1;
            const rev = it.line_total != null
              ? Number(it.line_total)
              : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;
            itemQty += qty;
            itemRev += rev;
          }
        });
      } else {
        itemQty = Number(o.total_quantity) || 1;
        itemRev = Number(o.price) || 0;
      }

      if (itemQty > 0) {
        if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { units: 0, rev: 0 });
        const m = monthlyMap.get(monthKey)!;
        m.units += itemQty;
        m.rev += itemRev;

        if (!yearlyMap.has(year)) yearlyMap.set(year, { units: 0, rev: 0 });
        const y = yearlyMap.get(year)!;
        y.units += itemQty;
        y.rev += itemRev;
      }
    });

    const monthlyPerformance = Array.from(monthlyMap.entries())
      .map(([mKey, val]) => ({
        monthKey: mKey,
        monthLabel: formatMonthYearLabel(mKey),
        units: val.units,
        revenue: Math.round(val.rev)
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    const yearlyPerformance = Array.from(yearlyMap.entries())
      .map(([y, val]) => ({
        year: y,
        units: val.units,
        revenue: Math.round(val.rev)
      }))
      .sort((a, b) => a.year - b.year);

    const contrib = totalCombosRevenue > 0 ? (cp.totalRevenue / totalCombosRevenue) * 100 : 0;
    const trend = calculateCombo12MonthTrend(cp.canonicalKey, orders, selectedYear || 2026);

    return {
      comboName: cp.productName,
      canonicalKey: cp.canonicalKey,
      ordersSold: cp.orderCount,
      unitsSold: cp.totalQuantity,
      totalRevenue: cp.totalRevenue,
      averageSellingPrice: cp.averageSellingPrice,
      repeatBuyers: cp.repeatBuyers,
      repeatSalesValue: cp.repeatSalesValue,
      revenueContributionPercent: Number(contrib.toFixed(2)),
      monthlyPerformance,
      yearlyPerformance,
      matchingOrders: cp.matchingOrders,
      monthlyTrend12Months: trend
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return { combos, totalCombosRevenue };
}

/**
 * 7. Calculate Product Pricing Insights (Part 6)
 */
export function calculateProductPricingInsights(
  products: ProductIntelligenceItem[],
  orders: WebsiteConsolidatedOrder[],
  selectedYear?: number
): {
  items: ProductPricingInsightItem[];
  keyInsights: {
    highestRevenueProduct: ProductIntelligenceItem | null;
    mostUnitsSoldProduct: ProductIntelligenceItem | null;
    highestAspProduct: ProductIntelligenceItem | null;
    lowestAspProduct: ProductIntelligenceItem | null;
    strongestRepeatProduct: ProductIntelligenceItem | null;
    highestRevenueContributionProduct: ProductIntelligenceItem | null;
  };
} {
  const distMap = new Map<string, { under500: number; from500to999: number; from1000to1499: number; above1500: number }>();

  orders.forEach(o => {
    if (isOrderCancelled(o) || o.order_status === 'DELETED') return;
    if (Array.isArray(o.items) && o.items.length > 0) {
      o.items.forEach(it => {
        const rawName = (it.product_name || '').trim();
        const key = normalizeProductGroupingKey(rawName, it.product_code);
        const qty = Number(it.quantity) || 1;
        const rev = it.line_total != null
          ? Number(it.line_total)
          : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;
        const unitPrice = qty > 0 ? rev / qty : rev;

        if (!distMap.has(key)) {
          distMap.set(key, { under500: 0, from500to999: 0, from1000to1499: 0, above1500: 0 });
        }
        const b = distMap.get(key)!;
        if (unitPrice < 500) b.under500 += qty;
        else if (unitPrice < 1000) b.from500to999 += qty;
        else if (unitPrice < 1500) b.from1000to1499 += qty;
        else b.above1500 += qty;
      });
    }
  });

  const items: ProductPricingInsightItem[] = products.map(p => {
    const dist = distMap.get(p.canonicalKey) || {
      under500: p.averageSellingPrice < 500 ? p.totalQuantity : 0,
      from500to999: p.averageSellingPrice >= 500 && p.averageSellingPrice < 1000 ? p.totalQuantity : 0,
      from1000to1499: p.averageSellingPrice >= 1000 && p.averageSellingPrice < 1500 ? p.totalQuantity : 0,
      above1500: p.averageSellingPrice >= 1500 ? p.totalQuantity : 0
    };

    const trend = calculateProduct12MonthTrend(p.canonicalKey, orders, selectedYear || 2026);

    return {
      productName: p.productName,
      averageSellingPrice: p.averageSellingPrice,
      minSellingPrice: p.minSellingPrice,
      maxSellingPrice: p.maxSellingPrice,
      totalRevenue: p.totalRevenue,
      totalQuantity: p.totalQuantity,
      orderCount: p.orderCount,
      priceDistribution: dist,
      monthlyTrend12Months: trend
    };
  });

  let highestRevenueProduct: ProductIntelligenceItem | null = null;
  let mostUnitsSoldProduct: ProductIntelligenceItem | null = null;
  let highestAspProduct: ProductIntelligenceItem | null = null;
  let lowestAspProduct: ProductIntelligenceItem | null = null;
  let strongestRepeatProduct: ProductIntelligenceItem | null = null;
  let highestRevenueContributionProduct: ProductIntelligenceItem | null = null;

  if (products.length > 0) {
    highestRevenueProduct = [...products].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
    mostUnitsSoldProduct = [...products].sort((a, b) => b.totalQuantity - a.totalQuantity)[0];
    highestAspProduct = [...products].sort((a, b) => b.averageSellingPrice - a.averageSellingPrice)[0];
    lowestAspProduct = [...products].filter(p => p.averageSellingPrice > 0).sort((a, b) => a.averageSellingPrice - b.averageSellingPrice)[0] || products[0];
    strongestRepeatProduct = [...products].sort((a, b) => b.repeatSalesValue - a.repeatSalesValue)[0];
    highestRevenueContributionProduct = [...products].sort((a, b) => b.revenueContributionPercent - a.revenueContributionPercent)[0];
  }

  return {
    items,
    keyInsights: {
      highestRevenueProduct,
      mostUnitsSoldProduct,
      highestAspProduct,
      lowestAspProduct,
      strongestRepeatProduct,
      highestRevenueContributionProduct
    }
  };
}

/**
 * 8. Calculate Period Comparison (Part 7)
 * Supports:
 * - month vs month
 * - year vs year
 * - same month across multiple years (e.g. Sep 2025 vs Sep 2026)
 * - full year 12 months comparison (Jan to Dec of Year A vs Year B)
 */
export function comparePeriods(
  periodA: MonthlyPerformanceRecord | YearlyPerformanceRecord,
  periodB: MonthlyPerformanceRecord | YearlyPerformanceRecord,
  periodType: 'monthly' | 'yearly' | 'same_month_multi_year' | 'full_year_12_months',
  yearA12Months?: MonthlyPerformanceRecord[],
  yearB12Months?: MonthlyPerformanceRecord[]
): PeriodComparisonResult {
  const currentLabel = 'monthLabel' in periodA ? periodA.monthLabel : periodA.yearLabel;
  const previousLabel = 'monthLabel' in periodB ? periodB.monthLabel : periodB.yearLabel;

  const buildMetric = (
    key: string,
    label: string,
    curr: number,
    prev: number,
    isCurrency = false,
    isLowerBetter = false
  ): PeriodComparisonMetric => {
    const diff = curr - prev;
    let pct: number | null = null;
    if (prev > 0) {
      pct = Number(((diff / prev) * 100).toFixed(1));
    } else if (prev === 0 && curr > 0) {
      pct = 100;
    } else if (prev === 0 && curr === 0) {
      pct = 0;
    }

    return {
      metricKey: key,
      metricLabel: label,
      currentValue: curr,
      previousValue: prev,
      difference: diff,
      percentChange: pct,
      isCurrency,
      isLowerBetter
    };
  };

  const metrics: PeriodComparisonMetric[] = [
    buildMetric('totalOrders', 'Total Orders', periodA.totalOrders, periodB.totalOrders),
    buildMetric('grossOrderValue', 'Gross Order Value', periodA.grossOrderValue, periodB.grossOrderValue, true),
    buildMetric('netSales', 'Net Sales', periodA.netSales, periodB.netSales, true),
    buildMetric('unitsSold', 'Units Sold', periodA.unitsSold, periodB.unitsSold),
    buildMetric('aov', 'Average Order Value (AOV)', periodA.aov, periodB.aov, true),
    buildMetric('deliveredOrders', 'Delivered Orders', periodA.deliveredOrders, periodB.deliveredOrders),
    buildMetric('deliveredRevenue', 'Delivered Revenue', periodA.deliveredRevenue, periodB.deliveredRevenue, true),
    buildMetric('rtoOrders', 'RTO Orders', periodA.rtoOrders, periodB.rtoOrders, false, true),
    buildMetric('rtoValue', 'RTO Value', periodA.rtoValue, periodB.rtoValue, true, true),
    buildMetric('cancelledOrders', 'Cancelled Orders', periodA.cancelledOrders, periodB.cancelledOrders, false, true),
    buildMetric('cancellationValue', 'Cancellation Value', periodA.cancellationValue, periodB.cancellationValue, true, true),
    buildMetric('repeatCustomers', 'Repeat Customers', periodA.repeatCustomers, periodB.repeatCustomers),
    buildMetric('newCustomers', 'New Customers', periodA.newCustomers, periodB.newCustomers)
  ];

  // If comparing two full years, provide 12-month row breakdown
  let monthByMonthComparison: PeriodComparisonResult['monthByMonthComparison'] | undefined;
  if (yearA12Months && yearB12Months && yearA12Months.length === 12 && yearB12Months.length === 12) {
    monthByMonthComparison = yearA12Months.map((mA, idx) => {
      const mB = yearB12Months[idx];
      const revDiff = mA.grossOrderValue - mB.grossOrderValue;
      let revPct: number | null = null;
      if (mB.grossOrderValue > 0) {
        revPct = Number(((revDiff / mB.grossOrderValue) * 100).toFixed(1));
      } else if (mB.grossOrderValue === 0 && mA.grossOrderValue > 0) {
        revPct = 100;
      } else if (mB.grossOrderValue === 0 && mA.grossOrderValue === 0) {
        revPct = 0;
      }

      return {
        monthShort: mA.monthShort,
        monthLong: mA.monthLong,
        monthNumber: mA.monthNumber,
        currentOrders: mA.totalOrders,
        previousOrders: mB.totalOrders,
        currentRevenue: mA.grossOrderValue,
        previousRevenue: mB.grossOrderValue,
        currentNetSales: mA.netSales,
        previousNetSales: mB.netSales,
        currentUnits: mA.unitsSold,
        previousUnits: mB.unitsSold,
        revenueDiff: revDiff,
        revenuePercentChange: revPct
      };
    });
  }

  return {
    periodType,
    currentLabel,
    previousLabel,
    metrics,
    monthByMonthComparison
  };
}
