import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Layers,
  Package,
  DollarSign,
  GitCompare,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  Download
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../../types';
import type { BusinessTrendsDatePreset } from './businessTrendsTypes';
import {
  calculateMonthlyPerformance,
  calculateYearlyPerformance,
  calculateProductIntelligence,
  calculateComboIntelligence,
  calculateProductPricingInsights
} from './businessTrendsCalculations';
import { MonthlyPerformanceTab } from './MonthlyPerformanceTab';
import { YearlyPerformanceTab } from './YearlyPerformanceTab';
import { ProductIntelligenceTab } from './ProductIntelligenceTab';
import { ComboIntelligenceTab } from './ComboIntelligenceTab';
import { ProductPricingInsightsTab } from './ProductPricingInsightsTab';
import { PeriodComparisonTab } from './PeriodComparisonTab';

export interface BusinessPerformanceTrendsSectionProps {
  orders: WebsiteConsolidatedOrder[];
  onRefreshData?: () => void;
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
  onExportExcel?: () => void;
}

export const BusinessPerformanceTrendsSection: React.FC<BusinessPerformanceTrendsSectionProps> = ({
  orders,
  onRefreshData,
  onViewOrders,
  onExportExcel
}) => {
  // Collapsed state
  const [isSectionOpen, setIsSectionOpen] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'monthly' | 'yearly' | 'products' | 'combos' | 'pricing' | 'comparison'
  >('monthly');

  // Date Filter Preset: 'all' | 'this_year' | 'last_year' | 'this_month' | 'last_month' | 'custom'
  const [datePreset, setDatePreset] = useState<BusinessTrendsDatePreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // 1. Filter Orders by selected preset within this section
  const filteredOrders = useMemo(() => {
    if (datePreset === 'all') return orders;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    return orders.filter(o => {
      const dStr = o.order_date || '';
      if (!dStr) return false;

      if (datePreset === 'this_year') {
        return dStr.startsWith(`${currentYear}`);
      }
      if (datePreset === 'last_year') {
        return dStr.startsWith(`${currentYear - 1}`);
      }
      if (datePreset === 'this_month') {
        const mKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        return dStr.startsWith(mKey);
      }
      if (datePreset === 'last_month') {
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const mKey = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`;
        return dStr.startsWith(mKey);
      }
      if (datePreset === 'custom') {
        if (customStart && dStr < customStart) return false;
        if (customEnd && dStr > customEnd) return false;
        return true;
      }
      return true;
    });
  }, [orders, datePreset, customStart, customEnd]);

  // 2. Compute Aggregations
  const monthlyRecords = useMemo(() => {
    return calculateMonthlyPerformance(filteredOrders);
  }, [filteredOrders]);

  const yearlyRecords = useMemo(() => {
    return calculateYearlyPerformance(monthlyRecords);
  }, [monthlyRecords]);

  const { products, totalAllRevenue } = useMemo(() => {
    return calculateProductIntelligence(filteredOrders);
  }, [filteredOrders]);

  const { combos, totalCombosRevenue } = useMemo(() => {
    return calculateComboIntelligence(products, filteredOrders);
  }, [products, filteredOrders]);

  const { items: pricingItems, keyInsights } = useMemo(() => {
    return calculateProductPricingInsights(products, filteredOrders);
  }, [products, filteredOrders]);

  return (
    <div id="analytics-business-performance-trends" className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-4 select-none scroll-mt-6">
      {/* 1. Header with Title & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Business Performance Trends</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800/50">
                BI Intelligence
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Monthly & yearly business performance, line-item product economics, combo analytics, and period comparisons.
          </p>
        </div>

        {/* Action Buttons: Presets, Refresh, Export, Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value as any)}
              className="h-7 px-2 bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-medium"
            >
              <option value="all" className="bg-slate-900">All Available Data</option>
              <option value="this_year" className="bg-slate-900">This Year</option>
              <option value="last_year" className="bg-slate-900">Last Year</option>
              <option value="this_month" className="bg-slate-900">This Month</option>
              <option value="last_month" className="bg-slate-900">Last Month</option>
              <option value="custom" className="bg-slate-900">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Pickers if custom selected */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-8 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-8 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200"
              />
            </div>
          )}

          {/* Refresh Data */}
          {onRefreshData && (
            <button
              type="button"
              onClick={onRefreshData}
              title="Refresh Analytics Data"
              className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Export Excel Button */}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              title="Export Full BI Excel Workbook"
              className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          )}

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="h-8 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg text-xs flex items-center transition-colors cursor-pointer"
            title={isSectionOpen ? 'Collapse Section' : 'Expand Section'}
          >
            {isSectionOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* 2. Main Content when Expanded */}
      {isSectionOpen && (
        <div className="space-y-4">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80 scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Calendar size={13} />
              <span>Monthly Performance</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-950 text-purple-200">
                {monthlyRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('yearly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'yearly'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <TrendingUp size={13} />
              <span>Yearly Performance</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-950 text-purple-200">
                {yearlyRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Package size={13} />
              <span>Product Intelligence</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-950 text-purple-200">
                {products.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('combos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'combos'
                  ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Layers size={13} />
              <span>Combo Performance</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-pink-950 text-pink-200">
                {combos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <DollarSign size={13} />
              <span>Pricing Insights</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'comparison'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <GitCompare size={13} />
              <span>Period Comparison</span>
            </button>
          </div>

          {/* Tab Panes */}
          <div className="pt-2">
            {activeTab === 'monthly' && (
              <MonthlyPerformanceTab
                monthlyRecords={monthlyRecords}
                onViewOrders={onViewOrders}
              />
            )}

            {activeTab === 'yearly' && (
              <YearlyPerformanceTab
                yearlyRecords={yearlyRecords}
                monthlyRecords={monthlyRecords}
                onViewOrders={onViewOrders}
              />
            )}

            {activeTab === 'products' && (
              <ProductIntelligenceTab
                products={products}
                totalAllRevenue={totalAllRevenue}
                onViewOrders={onViewOrders}
              />
            )}

            {activeTab === 'combos' && (
              <ComboIntelligenceTab
                combos={combos}
                totalCombosRevenue={totalCombosRevenue}
                onViewOrders={onViewOrders}
              />
            )}

            {activeTab === 'pricing' && (
              <ProductPricingInsightsTab
                pricingItems={pricingItems}
                keyInsights={keyInsights}
              />
            )}

            {activeTab === 'comparison' && (
              <PeriodComparisonTab
                monthlyRecords={monthlyRecords}
                yearlyRecords={yearlyRecords}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessPerformanceTrendsSection;
