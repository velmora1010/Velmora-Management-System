import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../../types';

export type BusinessTrendsPeriod = 'monthly' | 'yearly';
export type BusinessTrendsDatePreset = '2026' | '2025' | '2024' | '2023' | 'all_years' | 'dashboard_range' | 'custom';

export interface MonthlyPerformanceRecord {
  monthKey: string; // YYYY-MM
  monthNumber: number; // 1 .. 12
  monthShort: string; // "Jan"
  monthLong: string; // "January"
  monthLabel: string; // "Jan 2026"
  year: number;
  month: number;
  totalOrders: number;
  grossOrderValue: number;
  netSales: number;
  unitsSold: number;
  aov: number;
  deliveredOrders: number;
  deliveredRevenue: number;
  rtoOrders: number;
  rtoValue: number;
  cancelledOrders: number;
  cancellationValue: number;
  repeatCustomers: number;
  newCustomers: number;
  matchingOrders: WebsiteConsolidatedOrder[];
}

export interface YearlyPerformanceRecord {
  year: number;
  yearLabel: string; // e.g. "2026"
  totalOrders: number;
  grossOrderValue: number;
  totalRevenue: number; // synonym for grossOrderValue
  netSales: number;
  unitsSold: number;
  aov: number;
  deliveredOrders: number;
  deliveredRevenue: number;
  rtoOrders: number;
  rtoValue: number;
  cancelledOrders: number;
  cancellationValue: number;
  repeatCustomers: number;
  newCustomers: number;
  yoyOrdersGrowthPercent: number | null;
  yoyRevenueGrowthPercent: number | null;
  yoyNetSalesGrowthPercent: number | null;
  matchingOrders: WebsiteConsolidatedOrder[];
  monthlyBreakdown?: MonthlyPerformanceRecord[]; // full 12 months Jan-Dec
}

export interface ProductMonthlyTrendPoint {
  monthNumber: number;
  monthShort: string; // "Jan"
  monthLong: string; // "January"
  monthKey: string; // "2026-01"
  year: number;
  quantity: number;
  revenue: number;
  orderCount: number;
  repeatBuyers: number;
  averageSellingPrice: number | null; // null if no sales in month
  minSellingPrice: number | null;
  maxSellingPrice: number | null;
  hasSales: boolean;
}

export interface ComboMonthlyTrendPoint {
  monthNumber: number;
  monthShort: string; // "Jan"
  monthLong: string; // "January"
  monthKey: string; // "2026-01"
  year: number;
  orders: number;
  quantity: number;
  revenue: number;
  repeatBuyers: number;
  averageSellingPrice: number | null;
  hasSales: boolean;
}

export interface ProductIntelligenceItem {
  productName: string;
  canonicalKey: string;
  isCombo: boolean;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  averageSellingPrice: number;
  minSellingPrice: number;
  maxSellingPrice: number;
  repeatBuyers: number;
  repeatQuantity: number;
  repeatSalesValue: number;
  revenueContributionPercent: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  matchingOrders: WebsiteConsolidatedOrder[];
  monthlyTrend12Months?: ProductMonthlyTrendPoint[];
}

export interface ComboIntelligenceItem {
  comboName: string;
  canonicalKey: string;
  ordersSold: number;
  unitsSold: number;
  totalRevenue: number;
  averageSellingPrice: number;
  repeatBuyers: number;
  repeatSalesValue: number;
  revenueContributionPercent: number;
  monthlyPerformance: Array<{
    monthKey: string;
    monthLabel: string;
    units: number;
    revenue: number;
  }>;
  yearlyPerformance: Array<{
    year: number;
    units: number;
    revenue: number;
  }>;
  matchingOrders: WebsiteConsolidatedOrder[];
  monthlyTrend12Months?: ComboMonthlyTrendPoint[];
}

export interface ProductPricingInsightItem {
  productName: string;
  averageSellingPrice: number;
  minSellingPrice: number;
  maxSellingPrice: number;
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
  priceDistribution: {
    under500: number; // units
    from500to999: number;
    from1000to1499: number;
    above1500: number;
  };
  monthlyTrend12Months?: ProductMonthlyTrendPoint[];
}

export interface PeriodComparisonMetric {
  metricKey: string;
  metricLabel: string;
  currentValue: number;
  previousValue: number;
  difference: number;
  percentChange: number | null; // null if prior is 0
  isCurrency?: boolean;
  isLowerBetter?: boolean; // e.g. RTO, Cancellations
}

export interface PeriodComparisonResult {
  periodType: 'monthly' | 'yearly' | 'same_month_multi_year' | 'full_year_12_months';
  currentLabel: string;
  previousLabel: string;
  metrics: PeriodComparisonMetric[];
  monthByMonthComparison?: Array<{
    monthShort: string;
    monthLong: string;
    monthNumber: number;
    currentOrders: number;
    previousOrders: number;
    currentRevenue: number;
    previousRevenue: number;
    currentNetSales: number;
    previousNetSales: number;
    currentUnits: number;
    previousUnits: number;
    revenueDiff: number;
    revenuePercentChange: number | null;
  }>;
}
