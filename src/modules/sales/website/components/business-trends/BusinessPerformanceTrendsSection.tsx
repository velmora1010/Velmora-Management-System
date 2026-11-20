import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Download,
  Loader2,
  Database
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { WebsiteConsolidatedOrder } from '../../types';
import type { BusinessTrendsDatePreset } from './businessTrendsTypes';
import { websiteSalesService } from '../../websiteSalesService';
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

  // Dedicated Date Filter Preset: '2026' | '2025' | '2024' | '2023' | 'all_years' | 'dashboard_range' | 'custom'
  // Defaults to '2026' for complete 12-month calendar analytics
  const [datePreset, setDatePreset] = useState<BusinessTrendsDatePreset>('2026');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Autonomous Year Cache for complete Supabase records
  const [yearOrdersCache, setYearOrdersCache] = useState<Record<number, WebsiteConsolidatedOrder[]>>({});
  const [isLoadingYearData, setIsLoadingYearData] = useState<boolean>(false);
  const [loadingYearLabel, setLoadingYearLabel] = useState<string>('');

  // Fetch full year data from Supabase if not yet cached or if parent orders are constrained
  const fetchFullYearOrders = useCallback(async (year: number) => {
    // If already in cache with records, skip
    if (yearOrdersCache[year] && yearOrdersCache[year].length > 0) {
      return;
    }

    // Check if incoming `orders` already contains full data for this year (> 500 orders across months)
    const matchingInProp = orders.filter(o => o.order_date && o.order_date.startsWith(String(year)));
    if (matchingInProp.length > 500) {
      setYearOrdersCache(prev => ({ ...prev, [year]: matchingInProp }));
      return;
    }

    setIsLoadingYearData(true);
    setLoadingYearLabel(`Fetching full year ${year} orders from Supabase...`);

    try {
      const yearOrders = await websiteSalesService.getConsolidatedOrders({
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`
      });

      setYearOrdersCache(prev => ({ ...prev, [year]: yearOrders }));
    } catch (err: any) {
      console.warn(`[BusinessTrends] Failed to fetch full year ${year} from Supabase:`, err);
    } finally {
      setIsLoadingYearData(false);
      setLoadingYearLabel('');
    }
  }, [yearOrdersCache, orders]);

  // Effect: automatically trigger fetch when year preset is selected
  useEffect(() => {
    if (['2026', '2025', '2024', '2023'].includes(datePreset)) {
      const y = parseInt(datePreset, 10);
      if (!isNaN(y)) {
        fetchFullYearOrders(y);
      }
    }
  }, [datePreset, fetchFullYearOrders]);

  // Determine active target year
  const targetYear = useMemo(() => {
    if (['2026', '2025', '2024', '2023'].includes(datePreset)) {
      return parseInt(datePreset, 10);
    }
    const dates = orders.map(o => o.order_date).filter(Boolean) as string[];
    if (dates.length > 0) {
      const sorted = [...dates].sort();
      const latest = sorted[sorted.length - 1];
      return parseInt(latest.slice(0, 4), 10) || 2026;
    }
    return 2026;
  }, [datePreset, orders]);

  // Resolve filtered orders for current view
  const activeOrders = useMemo(() => {
    // 1. Specific Year
    if (['2026', '2025', '2024', '2023'].includes(datePreset)) {
      const y = parseInt(datePreset, 10);
      if (yearOrdersCache[y] && yearOrdersCache[y].length > 0) {
        return yearOrdersCache[y];
      }
      return orders.filter(o => o.order_date && o.order_date.startsWith(String(y)));
    }

    // 2. Dashboard Range (use parent prop directly)
    if (datePreset === 'dashboard_range') {
      return orders;
    }

    // 3. Custom Range
    if (datePreset === 'custom') {
      return orders.filter(o => {
        const dStr = o.order_date || '';
        if (!dStr) return false;
        if (customStart && dStr < customStart) return false;
        if (customEnd && dStr > customEnd) return false;
        return true;
      });
    }

    // 4. All Years: combine all cached year orders + prop orders
    const allSet = new Map<string, WebsiteConsolidatedOrder>();
    orders.forEach(o => allSet.set(o.id || o.order_id, o));
    Object.values(yearOrdersCache).forEach(arr => {
      arr.forEach(o => allSet.set(o.id || o.order_id, o));
    });

    return Array.from(allSet.values());
  }, [datePreset, orders, yearOrdersCache, customStart, customEnd]);

  // Combined pool of all known orders for yearly comparison
  const allKnownOrders = useMemo(() => {
    const allSet = new Map<string, WebsiteConsolidatedOrder>();
    orders.forEach(o => allSet.set(o.id || o.order_id, o));
    Object.values(yearOrdersCache).forEach(arr => {
      arr.forEach(o => allSet.set(o.id || o.order_id, o));
    });
    return Array.from(allSet.values());
  }, [orders, yearOrdersCache]);

  // 2. Compute Aggregations
  // monthlyRecords: Guaranteed 12 calendar months Jan-Dec for targetYear
  const monthlyRecords = useMemo(() => {
    return calculateMonthlyPerformance(activeOrders, targetYear);
  }, [activeOrders, targetYear]);

  // yearlyRecords: Catalog comparison of 2023, 2024, 2025, 2026
  const yearlyRecords = useMemo(() => {
    return calculateYearlyPerformance(allKnownOrders, [2023, 2024, 2025, 2026]);
  }, [allKnownOrders]);

  const { products, totalAllRevenue } = useMemo(() => {
    return calculateProductIntelligence(activeOrders);
  }, [activeOrders]);

  const { combos, totalCombosRevenue } = useMemo(() => {
    return calculateComboIntelligence(products, activeOrders);
  }, [products, activeOrders]);

  const { items: pricingItems, keyInsights } = useMemo(() => {
    return calculateProductPricingInsights(products, activeOrders);
  }, [products, activeOrders]);

  const handleRefresh = () => {
    if (['2026', '2025', '2024', '2023'].includes(datePreset)) {
      const y = parseInt(datePreset, 10);
      setYearOrdersCache(prev => {
        const next = { ...prev };
        delete next[y];
        return next;
      });
      fetchFullYearOrders(y);
    }
    if (onRefreshData) {
      onRefreshData();
    }
  };

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
                12-Month BI Intelligence
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Full-year monthly analytics (January to December), line-item product economics, combo analytics, and period comparisons.
          </p>
        </div>

        {/* Action Controls: Year Selector, Custom Pickers, Refresh, Export, Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year & Period Selector */}
          <div className="flex items-center bg-slate-900 border border-purple-500/50 rounded-lg p-0.5 text-xs shadow-inner">
            <Calendar size={13} className="text-purple-400 ml-2" />
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value as any)}
              className="h-7 px-2 bg-transparent text-white outline-none cursor-pointer text-xs font-semibold"
            >
              <option value="2026" className="bg-slate-900">Year 2026 (Jan–Dec Full Year)</option>
              <option value="2025" className="bg-slate-900">Year 2025 (Jan–Dec Full Year)</option>
              <option value="2024" className="bg-slate-900">Year 2024 (Jan–Dec Full Year)</option>
              <option value="2023" className="bg-slate-900">Year 2023 (Jan–Dec Full Year)</option>
              <option value="all_years" className="bg-slate-900">All Available Years</option>
              <option value="dashboard_range" className="bg-slate-900">Dashboard Date Range</option>
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
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh Analytics Data"
            className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} className={isLoadingYearData ? 'animate-spin text-purple-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

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

      {/* Loading Indicator when fetching Year Data */}
      {isLoadingYearData && (
        <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-purple-950/60 border border-purple-800/60 text-purple-300 text-xs">
          <Loader2 size={14} className="animate-spin text-purple-400" />
          <span>{loadingYearLabel || 'Fetching records from Supabase...'}</span>
        </div>
      )}

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
                12 Months
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
                {yearlyRecords.length} Years
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
                orders={activeOrders}
                selectedYear={targetYear}
                onViewOrders={onViewOrders}
              />
            )}

            {activeTab === 'combos' && (
              <ComboIntelligenceTab
                combos={combos}
                totalCombosRevenue={totalCombosRevenue}
                orders={activeOrders}
                selectedYear={targetYear}
                onViewOrders={onViewOrders}
              />
            )}

            {activeTab === 'pricing' && (
              <ProductPricingInsightsTab
                pricingItems={pricingItems}
                keyInsights={keyInsights}
                orders={activeOrders}
                selectedYear={targetYear}
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
