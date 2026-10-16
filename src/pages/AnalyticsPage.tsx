import React, { useState, useEffect, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import type { KpiMetrics, GlobalAnalyticsFilters, DashboardViewTab, TrendDataPoint, CategoryBreakdown } from '../types/analytics';
import { AnalyticsKpiCard } from '../components/analytics/AnalyticsKpiCard';
import { AnalyticsTrendChart, AnalyticsBreakdownChart } from '../components/analytics/AnalyticsCharts';
import {
  BarChart3,
  DollarSign,
  Megaphone,
  Package,
  Factory,
  CheckSquare,
  Users,
  RefreshCw,
  Calendar,
  AlertCircle,
  ShoppingBag,
  CheckCircle2,
  LayoutDashboard
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardViewTab>('overview');

  // Global Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // KPI Metrics & Chart States (Loaded incrementally)
  const [kpiMetrics, setKpiMetrics] = useState<KpiMetrics | null>(null);
  const [expenseTrends, setExpenseTrends] = useState<TrendDataPoint[]>([]);
  const [taskBreakdown, setTaskBreakdown] = useState<CategoryBreakdown[]>([]);
  const [qcBreakdown, setQcBreakdown] = useState<CategoryBreakdown[]>([]);

  const [isKpiLoading, setIsKpiLoading] = useState(true);
  const [isChartsLoading, setIsChartsLoading] = useState(true);

  // Load KPI Cards First (Fast)
  const loadKpis = useCallback(async () => {
    setIsKpiLoading(true);
    try {
      const filters: GlobalAnalyticsFilters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const data = await analyticsService.getKpiMetrics(filters);
      setKpiMetrics(data);
    } catch (e) {
      console.error('Failed to load KPIs:', e);
    } finally {
      setIsKpiLoading(false);
    }
  }, [startDate, endDate]);

  // Load Heavy Charts Second (Incremental)
  const loadCharts = useCallback(async () => {
    setIsChartsLoading(true);
    try {
      const [trends, tasks, qc] = await Promise.all([
        analyticsService.getExpenseTrends(),
        analyticsService.getTaskStatusBreakdown(),
        analyticsService.getQCRateBreakdown()
      ]);
      setExpenseTrends(trends);
      setTaskBreakdown(tasks);
      setQcBreakdown(qc);
    } catch (e) {
      console.error('Failed to load charts:', e);
    } finally {
      setIsChartsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKpis();
    loadCharts();
  }, [loadKpis, loadCharts]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const tabs: { id: DashboardViewTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'finance', label: 'Financial Analytics', icon: DollarSign },
    { id: 'marketing', label: 'Marketing Analytics', icon: Megaphone },
    { id: 'inventory', label: 'Inventory Analytics', icon: Package },
    { id: 'production', label: 'Production & QC', icon: Factory },
    { id: 'tasks', label: 'Task Performance', icon: CheckSquare },
    { id: 'vendors', label: 'Vendor Performance', icon: Users },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-700/70 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/10">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              BI & Analytics Center
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Real-time aggregated trend analytics and operational metrics across all modules.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { loadKpis(); loadCharts(); }}
          disabled={isKpiLoading || isChartsLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-purple-600/15 border border-purple-500/30 rounded-xl text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-600/25 transition-all shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isKpiLoading || isChartsLoading ? 'animate-spin' : ''} />
          <span>{isKpiLoading || isChartsLoading ? 'Refreshing...' : 'Refresh Analytics'}</span>
        </button>
      </div>

      {/* Global Filter Bar */}
      <div className="p-3.5 sm:p-4 bg-slate-900/60 border border-slate-700/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Calendar size={14} className="text-purple-400" />
            <span>Filter Date Range:</span>
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-[38px] bg-slate-950/80 border border-slate-700/80 text-slate-100 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/80 outline-none transition-all [color-scheme:dark]"
          />
          <span className="text-slate-500 font-medium">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-[38px] bg-slate-950/80 border border-slate-700/80 text-slate-100 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/80 outline-none transition-all [color-scheme:dark]"
          />
        </div>

        <button
          type="button"
          onClick={handleResetFilters}
          className="h-[38px] px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-700/80 transition-all flex items-center gap-1.5 shadow-sm"
        >
          Clear Filters
        </button>
      </div>

      {/* Dashboard Sub-View Tabs */}
      <div className="p-1.5 bg-slate-900/60 border border-slate-700/80 rounded-2xl flex items-center gap-1.5 overflow-x-auto shadow-sm backdrop-blur-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-bold'
                  : 'bg-slate-900/40 border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards Grid (Loaded Incrementally First) */}
      {isKpiLoading || !kpiMetrics ? (
        <div className="flex flex-col justify-center items-center py-16 gap-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading KPI Cards...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(activeTab === 'overview' || activeTab === 'finance') && (
            <>
              <AnalyticsKpiCard
                title="Total Revenue"
                value={`₹${kpiMetrics.totalRevenue.toLocaleString()}`}
                subtitle="Projected operational revenue"
                trend="+12.4%"
                isPositive={true}
                icon={<DollarSign size={18} />}
                colorBadge="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              />
              <AnalyticsKpiCard
                title="Total Expenses"
                value={`₹${kpiMetrics.totalExpenses.toLocaleString()}`}
                subtitle="Logged operational spend"
                trend="-3.2%"
                isPositive={true}
                icon={<ShoppingBag size={18} />}
                colorBadge="text-rose-400 bg-rose-500/10 border-rose-500/20"
              />
              <AnalyticsKpiCard
                title="Pending Bills"
                value={`${kpiMetrics.pendingBillsCount} Bills`}
                subtitle={`₹${kpiMetrics.pendingBillsAmount.toLocaleString()} unpaid`}
                isPositive={false}
                icon={<AlertCircle size={18} />}
                colorBadge="text-amber-400 bg-amber-500/10 border-amber-500/20"
              />
            </>
          )}

          {(activeTab === 'overview' || activeTab === 'marketing') && (
            <>
              <AnalyticsKpiCard
                title="Active Campaigns"
                value={kpiMetrics.activeCampaignsCount}
                subtitle={`${kpiMetrics.campaignSuccessRate}% Success rate`}
                trend="+8%"
                isPositive={true}
                icon={<Megaphone size={18} />}
                colorBadge="text-purple-400 bg-purple-500/10 border-purple-500/20"
              />
            </>
          )}

          {(activeTab === 'overview' || activeTab === 'inventory') && (
            <>
              <AnalyticsKpiCard
                title="Inventory Valuation"
                value={`₹${kpiMetrics.inventoryTotalValue.toLocaleString()}`}
                subtitle="Total product stock value"
                icon={<Package size={18} />}
                colorBadge="text-blue-400 bg-blue-500/10 border-blue-500/20"
              />
              <AnalyticsKpiCard
                title="Low Stock Items"
                value={`${kpiMetrics.lowStockCount} Items`}
                subtitle="Below minimum threshold"
                isPositive={false}
                icon={<AlertCircle size={18} />}
                colorBadge="text-rose-400 bg-rose-500/10 border-rose-500/20"
              />
            </>
          )}

          {(activeTab === 'overview' || activeTab === 'production') && (
            <>
              <AnalyticsKpiCard
                title="Production Output"
                value={`${kpiMetrics.productionBatchCount} Batches`}
                subtitle={`QC Pass Rate: ${kpiMetrics.qcPassRate}%`}
                trend="+5%"
                isPositive={true}
                icon={<Factory size={18} />}
                colorBadge="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
              />
              <AnalyticsKpiCard
                title="QC Pass Rate"
                value={`${kpiMetrics.qcPassRate}%`}
                subtitle="Inspected barcodes"
                isPositive={kpiMetrics.qcPassRate >= 90}
                icon={<CheckCircle2 size={18} />}
                colorBadge="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              />
            </>
          )}

          {(activeTab === 'overview' || activeTab === 'tasks') && (
            <>
              <AnalyticsKpiCard
                title="Tasks Completed"
                value={kpiMetrics.tasksCompletedCount}
                subtitle={`${kpiMetrics.overdueTasksCount} overdue tasks`}
                icon={<CheckSquare size={18} />}
                colorBadge="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              />
            </>
          )}

          {(activeTab === 'overview' || activeTab === 'vendors') && (
            <>
              <AnalyticsKpiCard
                title="Active Vendors"
                value={kpiMetrics.activeVendorsCount}
                subtitle={`Fulfillment: ${kpiMetrics.poFulfillmentRate}%`}
                icon={<Users size={18} />}
                colorBadge="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
              />
            </>
          )}
        </div>
      )}

      {/* Visual Chart Widgets (Loaded Asynchronously) */}
      {isChartsLoading ? (
        <div className="flex flex-col justify-center items-center py-16 gap-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading analytics visualizations...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsTrendChart
            title="Revenue vs Expense Trends"
            subtitle="Monthly comparison of operational cashflows"
            data={expenseTrends}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnalyticsBreakdownChart
              title="Task Status Distribution"
              subtitle="Completion metrics across departments"
              items={taskBreakdown}
            />

            <AnalyticsBreakdownChart
              title="Quality Control Pass Rate"
              subtitle="Barcode inspection yield"
              items={qcBreakdown}
            />
          </div>
        </div>
      )}
    </div>
  );
};
