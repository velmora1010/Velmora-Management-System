import React, { useState, useEffect, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import type { KpiMetrics, GlobalAnalyticsFilters, DashboardViewTab, TrendDataPoint, CategoryBreakdown } from '../types/analytics';
import { AnalyticsKpiCard } from '../components/analytics/AnalyticsKpiCard';
import { AnalyticsTrendChart, AnalyticsBreakdownChart } from '../components/analytics/AnalyticsCharts';
import { 
  BarChart3, DollarSign, Megaphone, Package, Factory, CheckSquare, 
  Users, RefreshCw, Calendar, ShieldCheck, AlertCircle, ShoppingBag, CheckCircle2 
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-primary" size={24} />
            <h1 className="text-2xl font-bold text-main tracking-tight">BI & Analytics Center</h1>
          </div>
          <p className="text-muted text-sm">Real-time aggregated trend analytics and operational metrics across all modules.</p>
        </div>

        <button
          onClick={() => { loadKpis(); loadCharts(); }}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
        >
          <RefreshCw size={14} className={isKpiLoading ? 'animate-spin' : ''} />
          Refresh Analytics
        </button>
      </div>

      {/* Global Filter Bar */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Calendar size={14} /> Filter Date Range:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={handleResetFilters}
          className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {/* Dashboard Sub-View Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'overview' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Executive Overview
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'finance' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign size={14} /> Financial Analytics
        </button>
        <button
          onClick={() => setActiveTab('marketing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'marketing' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Megaphone size={14} /> Marketing Analytics
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'inventory' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package size={14} /> Inventory Analytics
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'production' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Factory size={14} /> Production & QC
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'tasks' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckSquare size={14} /> Task Performance
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'vendors' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} /> Vendor Performance
        </button>
      </div>

      {/* KPI Cards Grid (Loaded Incrementally First) */}
      {isKpiLoading || !kpiMetrics ? (
        <div className="flex justify-center items-center py-12 text-muted gap-2">
          <RefreshCw className="animate-spin" size={18} />
          <span>Loading KPI Cards...</span>
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
        <div className="flex justify-center items-center py-16 text-muted gap-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading analytics visualizations...</span>
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
