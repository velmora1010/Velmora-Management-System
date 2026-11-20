import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../../types';

export type BusinessTrendsPeriod = 'monthly' | 'yearly';
export type BusinessTrendsDatePreset = 'all' | 'this_year' | 'last_year' | 'this_month' | 'last_month' | 'custom';

export interface MonthlyPerformanceRecord {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "Sep 2026"
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
  periodType: 'monthly' | 'yearly';
  currentLabel: string;
  previousLabel: string;
  metrics: PeriodComparisonMetric[];
}
