import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../../types';
import { normalizeProductGroupingKey, resolveCanonicalProductName } from '../../websiteSalesUtils';
import { isComboItem } from '../TopPerformingProductsCombos';
import type {
  MonthlyPerformanceRecord,
  YearlyPerformanceRecord,
  ProductIntelligenceItem,
  ComboIntelligenceItem,
  ProductPricingInsightItem,
  PeriodComparisonMetric,
  PeriodComparisonResult
} from './businessTrendsTypes';

const MONTH_NAMES = [
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
  return `${MONTH_NAMES[m - 1]} ${y}`;
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
 * 1. Calculate Monthly Performance Records
 */
export function calculateMonthlyPerformance(orders: WebsiteConsolidatedOrder[]): MonthlyPerformanceRecord[] {
  const monthMap = new Map<string, {
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

  // First build global customer order count map to identify repeat customers
  const globalCustomerValidOrders = new Map<string, number>();
  orders.forEach(o => {
    if (o.order_status === 'DELETED' || isOrderCancelled(o)) return;
    const phone = sanitizeCustomerPhone(o.phone);
    const key = phone || (o.customer_name || 'unknown').toLowerCase().trim();
    if (!key) return;
    globalCustomerValidOrders.set(key, (globalCustomerValidOrders.get(key) || 0) + 1);
  });

  orders.forEach(o => {
    if (o.order_status === 'DELETED') return;
    const dateStr = o.order_date || '';
    if (!dateStr || dateStr.length < 7) return;
    const monthKey = dateStr.slice(0, 7); // YYYY-MM

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
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

    const data = monthMap.get(monthKey)!;
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

  const records: MonthlyPerformanceRecord[] = [];

  monthMap.forEach((data, monthKey) => {
    const parts = monthKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
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
      monthLabel: formatMonthYearLabel(monthKey),
      year,
      month,
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
  });

  // Sort chronologically ascending
  return records.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/**
 * 2. Calculate Yearly Performance Records with YoY Growth
 */
export function calculateYearlyPerformance(monthlyRecords: MonthlyPerformanceRecord[]): YearlyPerformanceRecord[] {
  const yearMap = new Map<number, {
    totalOrders: number;
    grossOrderValue: number;
    netSales: number;
    unitsSold: number;
    deliveredOrders: number;
    deliveredRevenue: number;
    rtoOrders: number;
    rtoValue: number;
    cancelledOrders: number;
    cancellationValue: number;
    repeatCustomers: number;
    newCustomers: number;
    matchingOrders: WebsiteConsolidatedOrder[];
  }>();

  monthlyRecords.forEach(m => {
    if (!yearMap.has(m.year)) {
      yearMap.set(m.year, {
        totalOrders: 0,
        grossOrderValue: 0,
        netSales: 0,
        unitsSold: 0,
        deliveredOrders: 0,
        deliveredRevenue: 0,
        rtoOrders: 0,
        rtoValue: 0,
        cancelledOrders: 0,
        cancellationValue: 0,
        repeatCustomers: 0,
        newCustomers: 0,
        matchingOrders: []
      });
    }

    const yData = yearMap.get(m.year)!;
    yData.totalOrders += m.totalOrders;
    yData.grossOrderValue += m.grossOrderValue;
    yData.netSales += m.netSales;
    yData.unitsSold += m.unitsSold;
    yData.deliveredOrders += m.deliveredOrders;
    yData.deliveredRevenue += m.deliveredRevenue;
    yData.rtoOrders += m.rtoOrders;
    yData.rtoValue += m.rtoValue;
    yData.cancelledOrders += m.cancelledOrders;
    yData.cancellationValue += m.cancellationValue;
    yData.repeatCustomers += m.repeatCustomers;
    yData.newCustomers += m.newCustomers;
    yData.matchingOrders.push(...m.matchingOrders);
  });

  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
  const yearlyRecords: YearlyPerformanceRecord[] = [];

  for (let i = 0; i < sortedYears.length; i++) {
    const year = sortedYears[i];
    const data = yearMap.get(year)!;
    const validOrdersCount = data.totalOrders - data.cancelledOrders;
    const aov = validOrdersCount > 0 ? Math.round(data.netSales / validOrdersCount) : 0;

    let yoyOrdersGrowthPercent: number | null = null;
    let yoyRevenueGrowthPercent: number | null = null;
    let yoyNetSalesGrowthPercent: number | null = null;

    if (i > 0) {
      const prevYear = sortedYears[i - 1];
      const prevData = yearMap.get(prevYear)!;

      if (prevData.totalOrders > 0) {
        yoyOrdersGrowthPercent = Number((((data.totalOrders - prevData.totalOrders) / prevData.totalOrders) * 100).toFixed(1));
      }
      if (prevData.grossOrderValue > 0) {
        yoyRevenueGrowthPercent = Number((((data.grossOrderValue - prevData.grossOrderValue) / prevData.grossOrderValue) * 100).toFixed(1));
      }
      if (prevData.netSales > 0) {
        yoyNetSalesGrowthPercent = Number((((data.netSales - prevData.netSales) / prevData.netSales) * 100).toFixed(1));
      }
    }

    yearlyRecords.push({
      year,
      yearLabel: String(year),
      totalOrders: data.totalOrders,
      grossOrderValue: data.grossOrderValue,
      totalRevenue: data.grossOrderValue,
      netSales: data.netSales,
      unitsSold: data.unitsSold,
      aov,
      deliveredOrders: data.deliveredOrders,
      deliveredRevenue: data.deliveredRevenue,
      rtoOrders: data.rtoOrders,
      rtoValue: data.rtoValue,
      cancelledOrders: data.cancelledOrders,
      cancellationValue: data.cancellationValue,
      repeatCustomers: data.repeatCustomers,
      newCustomers: data.newCustomers,
      yoyOrdersGrowthPercent,
      yoyRevenueGrowthPercent,
      yoyNetSalesGrowthPercent,
      matchingOrders: data.matchingOrders
    });
  }

  return yearlyRecords;
}

/**
 * 3. Calculate Comprehensive Product Intelligence (Part 4)
 */
export function calculateProductIntelligence(orders: WebsiteConsolidatedOrder[]): {
  products: ProductIntelligenceItem[];
  totalAllRevenue: number;
} {
  // Map of canonical key -> aggregation
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

  // Find repeat customer keys across dataset
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
      // Fallback to order-level product name
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
      matchingOrders: data.matchingOrders
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return { products, totalAllRevenue };
}

/**
 * 4. Calculate Best Performing Combos (Part 5)
 */
export function calculateComboIntelligence(
  products: ProductIntelligenceItem[],
  orders: WebsiteConsolidatedOrder[]
): {
  combos: ComboIntelligenceItem[];
  totalCombosRevenue: number;
} {
  const comboProducts = products.filter(p => p.isCombo);
  const totalCombosRevenue = comboProducts.reduce((sum, c) => sum + c.totalRevenue, 0);

  // Group monthly and yearly breakdowns for each combo
  const combos: ComboIntelligenceItem[] = comboProducts.map(cp => {
    const monthlyMap = new Map<string, { units: number; rev: number }>();
    const yearlyMap = new Map<number, { units: number; rev: number }>();

    cp.matchingOrders.forEach(o => {
      if (isOrderCancelled(o) || o.order_status === 'DELETED') return;
      const dateStr = o.order_date || '';
      if (!dateStr || dateStr.length < 7) return;
      const monthKey = dateStr.slice(0, 7);
      const year = parseInt(dateStr.slice(0, 4), 10);

      // Find items in order that belong to this combo
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
      matchingOrders: cp.matchingOrders
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return { combos, totalCombosRevenue };
}

/**
 * 5. Calculate Product Pricing Insights (Part 6)
 */
export function calculateProductPricingInsights(
  products: ProductIntelligenceItem[],
  orders: WebsiteConsolidatedOrder[]
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
  // Compute price distribution brackets for each product
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

    return {
      productName: p.productName,
      averageSellingPrice: p.averageSellingPrice,
      minSellingPrice: p.minSellingPrice,
      maxSellingPrice: p.maxSellingPrice,
      totalRevenue: p.totalRevenue,
      totalQuantity: p.totalQuantity,
      orderCount: p.orderCount,
      priceDistribution: dist
    };
  });

  // Calculate Key Insights (safely handling empty datasets)
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
 * 6. Calculate Period Comparison (Part 7)
 */
export function comparePeriods(
  periodA: MonthlyPerformanceRecord | YearlyPerformanceRecord,
  periodB: MonthlyPerformanceRecord | YearlyPerformanceRecord,
  periodType: 'monthly' | 'yearly'
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

  return {
    periodType,
    currentLabel,
    previousLabel,
    metrics
  };
}
