export interface GlobalAnalyticsFilters {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  sectionId?: string;
}

export interface KpiMetrics {
  totalRevenue: number;
  totalExpenses: number;
  pendingBillsCount: number;
  pendingBillsAmount: number;
  activeCampaignsCount: number;
  campaignSuccessRate: number;
  tasksCompletedCount: number;
  overdueTasksCount: number;
  activeVendorsCount: number;
  poFulfillmentRate: number;
  inventoryTotalValue: number;
  lowStockCount: number;
  productionBatchCount: number;
  qcPassRate: number;
}

export interface TrendDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
  color?: string;
}

export type DashboardViewTab = 
  | 'overview'
  | 'finance'
  | 'marketing'
  | 'inventory'
  | 'production'
  | 'tasks'
  | 'vendors';
