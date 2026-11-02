import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Repeat,
  ShoppingBag,
  TrendingUp,
  MapPin,
  Building2,
  DollarSign,
  Search,
  Filter,
  RotateCcw,
  Download,
  Calendar,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  BarChart3,
  Percent,
  Clock,
  ArrowRight,
  X,
  Award,
  Crown
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  LabelList
} from 'recharts';
import {
  customerRepeatAnalyticsService,
  ComprehensiveRepeatAnalyticsData,
  AnalyticsFilterParams,
  TopCustomerItem,
  GeographicLocationItem,
  ProductRepeatInsightItem
} from '../../services/customerRepeatAnalyticsService';
import toast from 'react-hot-toast';

export interface CustomerRepeatAnalyticsDashboardProps {
  sourceChannel?: string;
  defaultDateRange?: { startDate?: string; endDate?: string };
  onNavigateToOrder?: (orderId: string) => void;
  className?: string;
  department?: 'sales' | 'logistics';
}

const FREQUENCY_COLORS = [
  '#06b6d4', // 1: Cyan
  '#3b82f6', // 2: Blue
  '#6366f1', // 3: Indigo
  '#8b5cf6', // 4: Violet
  '#a855f7', // 5: Purple
  '#d946ef', // 6: Fuchsia
  '#ec4899', // 7: Pink
  '#f43f5e', // 8: Rose
  '#ef4444', // 9: Red
  '#f97316', // 10: Orange
  '#f59e0b', // 11: Amber
  '#eab308', // 12: Yellow
  '#84cc16', // 13: Lime
  '#22c55e', // 14: Green
  '#10b981', // 15: Emerald
  '#14b8a6'  // 15+: Teal
];

export const CustomerRepeatAnalyticsDashboard: React.FC<CustomerRepeatAnalyticsDashboardProps> = ({
  sourceChannel,
  defaultDateRange,
  onNavigateToOrder,
  className = '',
  department = 'logistics'
}) => {
  // 1. Data State
  const [data, setData] = useState<ComprehensiveRepeatAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Global Filter States
  const [datePreset, setDatePreset] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(defaultDateRange?.startDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(defaultDateRange?.endDate || '');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState<AnalyticsFilterParams['frequencyRange']>('all');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState<boolean>(false);

  // Shared Phone Masking State
  const [showMaskedPhone, setShowMaskedPhone] = useState<boolean>(true);
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<TopCustomerItem | null>(null);

  // Interactive Purchase Frequency Drilldown States (Sales Department)
  const [selectedFrequencyBucket, setSelectedFrequencyBucket] = useState<number | null>(null);
  const [cohortSearch, setCohortSearch] = useState<string>('');
  const [cohortSortField, setCohortSortField] = useState<'totalValue' | 'totalOrders' | 'averageOrderValue' | 'lastOrderDate'>('totalValue');
  const [cohortSortAsc, setCohortSortAsc] = useState<boolean>(false);
  const [cohortPageIndex, setCohortPageIndex] = useState<number>(0);
  const cohortPageSize = 25;
  const drilldownPanelRef = useRef<HTMLDivElement>(null);

  const handleSelectFrequencyBucket = (bucketNum: number) => {
    if (department !== 'sales') return;
    setSelectedFrequencyBucket(prev => (prev === bucketNum ? null : bucketNum));
    setCohortPageIndex(0);
    setCohortSearch('');
  };

  // 3. Top Customers by Customer Value Controls
  const [valueLimit, setValueLimit] = useState<number>(100);
  const [valueSortField, setValueSortField] = useState<'totalValue' | 'totalOrders' | 'lastOrderDate'>('totalValue');
  const [valueSortAsc, setValueSortAsc] = useState<boolean>(false);
  const [valueSearch, setValueSearch] = useState<string>('');
  const [visibleCountValue, setVisibleCountValue] = useState<number>(15);

  // 4. Top 100 Repeat Customers Controls
  const [repeatLimit, setRepeatLimit] = useState<number>(100);
  const [repeatSortField, setRepeatSortField] = useState<'totalOrders' | 'totalValue' | 'lastOrderDate'>('totalOrders');
  const [repeatSortAsc, setRepeatSortAsc] = useState<boolean>(false);
  const [repeatSearch, setRepeatSearch] = useState<string>('');
  const [visibleCountRepeat, setVisibleCountRepeat] = useState<number>(15);

  // 5. Geographic Controls
  const [geoTab, setGeoTab] = useState<'states' | 'cities'>('states');
  const [geoLimit, setGeoLimit] = useState<number>(100);
  const [geoSearch, setGeoSearch] = useState<string>('');
  const [drillDownState, setDrillDownState] = useState<string | null>(null);

  // 6. Product Insights Table Controls
  const [productSortField, setProductSortField] = useState<'repeatSalesValue' | 'repeatQuantity' | 'repeatCustomerCount'>('repeatSalesValue');
  const [productSortAsc, setProductSortAsc] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const loadAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
        customerRepeatAnalyticsService.clearCache();
      } else {
        setLoading(true);
      }
      setError(null);

      let effectiveStart = customStartDate;
      let effectiveEnd = customEndDate;

      if (datePreset !== 'custom' && datePreset !== 'all') {
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().slice(0, 10);
        effectiveEnd = formatDate(today);

        if (datePreset === 'today') {
          effectiveStart = formatDate(today);
        } else if (datePreset === '7d') {
          const d7 = new Date();
          d7.setDate(today.getDate() - 7);
          effectiveStart = formatDate(d7);
        } else if (datePreset === '30d') {
          const d30 = new Date();
          d30.setDate(today.getDate() - 30);
          effectiveStart = formatDate(d30);
        } else if (datePreset === 'this_month') {
          const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          effectiveStart = formatDate(startMonth);
        } else if (datePreset === 'last_month') {
          const startLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const endLast = new Date(today.getFullYear(), today.getMonth(), 0);
          effectiveStart = formatDate(startLast);
          effectiveEnd = formatDate(endLast);
        }
      }

      const params: AnalyticsFilterParams = {
        startDate: effectiveStart || undefined,
        endDate: effectiveEnd || undefined,
        state: selectedState !== 'ALL' ? selectedState : undefined,
        city: selectedCity !== 'ALL' ? selectedCity : undefined,
        product: selectedProduct !== 'ALL' ? selectedProduct : undefined,
        frequencyRange: selectedFrequency,
        channel: sourceChannel || undefined
      };

      const result = await customerRepeatAnalyticsService.getRepeatAnalytics(params);
      setData(result);
      if (isRefresh) toast.success('Analytics data refreshed.');
    } catch (err: any) {
      console.error('Failed to load repeat analytics:', err);
      setError(err.message || 'Failed to load customer repeat analytics');
      toast.error('Error loading analytics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    datePreset,
    customStartDate,
    customEndDate,
    selectedState,
    selectedCity,
    selectedProduct,
    selectedFrequency,
    sourceChannel
  ]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Reset pagination when search or limit changes
  const handleValueLimitChange = (lim: number) => {
    setValueLimit(lim);
    setVisibleCountValue(15);
  };

  const handleRepeatLimitChange = (lim: number) => {
    setRepeatLimit(lim);
    setVisibleCountRepeat(15);
  };

  // State Drilldown Handler
  const handleStateDrillDown = (stateName: string) => {
    setDrillDownState(stateName);
    setSelectedState(stateName);
    setGeoTab('cities');
    setSelectedCity('ALL');
  };

  const clearStateDrilldown = () => {
    setDrillDownState(null);
    setSelectedState('ALL');
    setSelectedCity('ALL');
  };

  // -------------------------------------------------------------
  // Filtered & Sorted: Top Customers by Customer Value
  // -------------------------------------------------------------
  const processedValueCustomers = useMemo(() => {
    if (!data) return [];
    const sourceList = data.topCustomersByValue || data.topCustomers || [];
    let list = [...sourceList];

    if (valueSearch.trim()) {
      const q = valueSearch.toLowerCase().trim();
      list = list.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.mostPurchasedProduct.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (valueSortField === 'totalValue') {
        comparison = a.totalValue - b.totalValue;
        if (comparison === 0) comparison = a.totalOrders - b.totalOrders;
      } else if (valueSortField === 'totalOrders') {
        comparison = a.totalOrders - b.totalOrders;
        if (comparison === 0) comparison = a.totalValue - b.totalValue;
      } else if (valueSortField === 'lastOrderDate') {
        comparison = (a.lastOrderDate || '').localeCompare(b.lastOrderDate || '');
      }
      return valueSortAsc ? comparison : -comparison;
    });

    return list.slice(0, valueLimit).map((c, idx) => ({
      ...c,
      rank: idx + 1
    }));
  }, [data, valueSearch, valueSortField, valueSortAsc, valueLimit]);

  // -------------------------------------------------------------
  // Filtered & Sorted: Top 100 Repeat Customers (2+ orders)
  // -------------------------------------------------------------
  const processedRepeatCustomers = useMemo(() => {
    if (!data) return [];
    // Only customers with 2+ valid orders
    const sourceList = data.topCustomersByRepeat || [];
    let list = [...sourceList];

    if (repeatSearch.trim()) {
      const q = repeatSearch.toLowerCase().trim();
      list = list.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.mostPurchasedProduct.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (repeatSortField === 'totalOrders') {
        comparison = a.totalOrders - b.totalOrders;
        if (comparison === 0) comparison = a.totalValue - b.totalValue;
      } else if (repeatSortField === 'totalValue') {
        comparison = a.totalValue - b.totalValue;
        if (comparison === 0) comparison = a.totalOrders - b.totalOrders;
      } else if (repeatSortField === 'lastOrderDate') {
        comparison = (a.lastOrderDate || '').localeCompare(b.lastOrderDate || '');
      }
      return repeatSortAsc ? comparison : -comparison;
    });

    return list.slice(0, repeatLimit).map((c, idx) => ({
      ...c,
      rank: idx + 1
    }));
  }, [data, repeatSearch, repeatSortField, repeatSortAsc, repeatLimit]);

  // Visible rows for pagination
  const visibleValueCustomers = useMemo(() => {
    return processedValueCustomers.slice(0, visibleCountValue);
  }, [processedValueCustomers, visibleCountValue]);

  const visibleRepeatCustomers = useMemo(() => {
    return processedRepeatCustomers.slice(0, visibleCountRepeat);
  }, [processedRepeatCustomers, visibleCountRepeat]);

  // -------------------------------------------------------------
  // Filtered & Sorted Geographic Data
  // -------------------------------------------------------------
  const processedGeoData = useMemo(() => {
    if (!data) return [];
    let list = geoTab === 'states' ? [...data.topStates] : [...data.topCities];

    if (geoTab === 'cities' && drillDownState) {
      list = list.filter(item => item.state === drillDownState);
    }

    if (geoSearch.trim()) {
      const q = geoSearch.toLowerCase().trim();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.state && item.state.toLowerCase().includes(q))
      );
    }

    return list.slice(0, geoLimit);
  }, [data, geoTab, drillDownState, geoSearch, geoLimit]);

  // -------------------------------------------------------------
  // Filtered & Sorted Product Insights
  // -------------------------------------------------------------
  const processedProducts = useMemo(() => {
    if (!data) return [];
    let list = [...data.productInsights];

    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter(p => p.productName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (productSortField === 'repeatSalesValue') {
        comparison = a.repeatSalesValue - b.repeatSalesValue;
      } else if (productSortField === 'repeatQuantity') {
        comparison = a.repeatQuantity - b.repeatQuantity;
      } else if (productSortField === 'repeatCustomerCount') {
        comparison = a.repeatCustomerCount - b.repeatCustomerCount;
      }
      return productSortAsc ? comparison : -comparison;
    });

    return list;
  }, [data, productSearch, productSortField, productSortAsc]);

  // CSV Export Helpers
  const handleExportValueCustomersCSV = () => {
    if (processedValueCustomers.length === 0) {
      toast.error('No customers to export');
      return;
    }
    const headers = ['Rank', 'Customer Name', 'Phone', 'City', 'State', 'Valid Orders', 'Repeat Count', 'Total Net Spend (INR)', 'AOV (INR)', 'Top Product', 'Last Purchase Date'];
    const rows = processedValueCustomers.map(c => [
      c.rank,
      `"${c.customerName.replace(/"/g, '""')}"`,
      c.phone,
      `"${c.city.replace(/"/g, '""')}"`,
      `"${c.state.replace(/"/g, '""')}"`,
      c.totalOrders,
      c.repeatPurchaseCount,
      c.totalValue.toFixed(2),
      c.averageOrderValue,
      `"${c.mostPurchasedProduct.replace(/"/g, '""')}"`,
      c.lastOrderDate
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `top_customers_by_value_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success('Top Customers by Value exported to CSV');
  };

  const handleExportRepeatCustomersCSV = () => {
    if (processedRepeatCustomers.length === 0) {
      toast.error('No repeat customers to export');
      return;
    }
    const headers = ['Rank', 'Customer Name', 'Phone', 'City', 'State', 'Valid Orders', 'Repeat Purchase Count', 'Total Net Spend (INR)', 'AOV (INR)', 'Top Product', 'Last Purchase Date'];
    const rows = processedRepeatCustomers.map(c => [
      c.rank,
      `"${c.customerName.replace(/"/g, '""')}"`,
      c.phone,
      `"${c.city.replace(/"/g, '""')}"`,
      `"${c.state.replace(/"/g, '""')}"`,
      c.totalOrders,
      c.repeatPurchaseCount,
      c.totalValue.toFixed(2),
      c.averageOrderValue,
      `"${c.mostPurchasedProduct.replace(/"/g, '""')}"`,
      c.lastOrderDate
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `top_repeat_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success('Top Repeat Customers exported to CSV');
  };

  const handleExportGeoCSV = () => {
    if (processedGeoData.length === 0) {
      toast.error('No geographic data to export');
      return;
    }
    const headers = ['Rank', 'Location', 'State', 'Total Orders', 'Unique Customers', 'Repeat Buyers', 'Repeat Rate (%)', 'Net Sales (INR)'];
    const rows = processedGeoData.map(g => [
      g.rank,
      `"${g.name.replace(/"/g, '""')}"`,
      `"${(g.state || g.name).replace(/"/g, '""')}"`,
      g.totalOrders,
      g.uniqueCustomers,
      g.repeatCustomers,
      g.repeatRate.toFixed(2),
      g.salesValue.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `top_${geoTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Top ${geoTab} exported to CSV`);
  };

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Filtered & Sorted Customers for Selected Frequency Bucket
  // -------------------------------------------------------------
  const selectedBucketInfo = useMemo(() => {
    if (selectedFrequencyBucket === null || !data?.frequencyDistribution) return null;
    return data.frequencyDistribution.find(f => f.bucketNum === selectedFrequencyBucket) || null;
  }, [selectedFrequencyBucket, data?.frequencyDistribution]);

  const cohortMatchingCustomers = useMemo(() => {
    if (selectedFrequencyBucket === null || !data?.allCustomers) return [];
    if (selectedFrequencyBucket === 16) {
      return data.allCustomers.filter(c => c.totalOrders >= 15);
    }
    return data.allCustomers.filter(c => c.totalOrders === selectedFrequencyBucket);
  }, [selectedFrequencyBucket, data?.allCustomers]);

  const filteredCohortCustomers = useMemo(() => {
    let list = [...cohortMatchingCustomers];
    if (cohortSearch.trim()) {
      const q = cohortSearch.toLowerCase().trim();
      list = list.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.maskedPhone.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let comparison = 0;
      if (cohortSortField === 'totalValue') {
        comparison = b.totalValue - a.totalValue;
      } else if (cohortSortField === 'totalOrders') {
        comparison = b.totalOrders - a.totalOrders;
      } else if (cohortSortField === 'averageOrderValue') {
        comparison = b.averageOrderValue - a.averageOrderValue;
      } else if (cohortSortField === 'lastOrderDate') {
        comparison = (b.lastOrderDate || '').localeCompare(a.lastOrderDate || '');
      }
      return cohortSortAsc ? -comparison : comparison;
    });
    return list;
  }, [cohortMatchingCustomers, cohortSearch, cohortSortField, cohortSortAsc]);

  const visibleCohortCustomers = useMemo(() => {
    const start = cohortPageIndex * cohortPageSize;
    return filteredCohortCustomers.slice(start, start + cohortPageSize);
  }, [filteredCohortCustomers, cohortPageIndex]);

  const totalCohortPages = Math.ceil(filteredCohortCustomers.length / cohortPageSize) || 1;

  const kpis = data?.kpis;

  // -------------------------------------------------------------
  // Render Loading & Error States
  // -------------------------------------------------------------
  if (loading && !data) {
    return (
      <div className="p-8 rounded-2xl bg-[#0b1220] border border-slate-800 text-center space-y-4 my-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-white tracking-wide">Computing Customer Analytics...</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Aggregating customer purchase profiles, repeat orders, frequencies, and geographic distribution across verified sales.
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-center space-y-3 my-4">
        <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto font-bold">!</div>
        <h3 className="text-sm font-bold text-rose-200">Unable to load customer analytics</h3>
        <p className="text-xs text-rose-400">{error}</p>
        <button
          onClick={() => loadAnalytics(true)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 w-full text-slate-200 ${className}`}>
      
      {/* =========================================================================
          TOOLBAR: DATE PRESETS, FILTERS, SEARCH, REFRESH
         ========================================================================= */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3">
        
        {/* ROW 1: TITLE, PERIOD, PRESETS, REFRESH */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
              <Repeat size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Customer Repeat Purchase Analysis
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Canonical Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Range: <strong className="text-slate-300 font-mono">{data?.dateRangeDisplay || 'All Time'}</strong></span>
                <span>•</span>
                <span>Updated: <span className="font-mono text-slate-400">{data?.lastUpdated}</span></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Presets */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer px-2 py-1"
              >
                <option value="all" className="bg-[#0b1220]">All Canonical Time</option>
                <option value="today" className="bg-[#0b1220]">Today</option>
                <option value="7d" className="bg-[#0b1220]">Last 7 Days</option>
                <option value="30d" className="bg-[#0b1220]">Last 30 Days</option>
                <option value="this_month" className="bg-[#0b1220]">This Month</option>
                <option value="last_month" className="bg-[#0b1220]">Last Month</option>
                <option value="custom" className="bg-[#0b1220]">Custom Date Range</option>
              </select>
            </div>

            {/* Custom Date Inputs if preset is custom */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono"
                />
              </div>
            )}

            {/* Toggle Filters Drawer */}
            <button
              onClick={() => setShowFiltersDrawer(prev => !prev)}
              className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showFiltersDrawer || selectedState !== 'ALL' || selectedCity !== 'ALL' || selectedProduct !== 'ALL' || selectedFrequency !== 'all'
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
            >
              <Filter size={13} />
              <span>Filters</span>
              {(selectedState !== 'ALL' || selectedCity !== 'ALL' || selectedProduct !== 'ALL' || selectedFrequency !== 'all') && (
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => loadAnalytics(true)}
              disabled={isRefreshing || loading}
              className="h-8 w-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RotateCcw size={13} className={isRefreshing ? 'animate-spin text-indigo-400' : ''} />
            </button>

          </div>

        </div>

        {/* ROW 2: FILTERS DRAWER (State, City, Product, Frequency) */}
        {showFiltersDrawer && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* State Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter by State</label>
              <select
                value={selectedState}
                onChange={e => handleStateChange(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All States ({data?.availableStates.length || 0})</option>
                {data?.availableStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter by City</label>
              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Cities ({data?.availableCities.length || 0})</option>
                {data?.availableCities.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter by Product</label>
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Products ({data?.availableProducts.length || 0})</option>
                {data?.availableProducts.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Frequency Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Purchase Frequency</label>
              <select
                value={selectedFrequency}
                onChange={e => setSelectedFrequency(e.target.value as any)}
                className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Customer Frequencies</option>
                <option value="1">1 Time Only</option>
                <option value="2+">Repeat Buyers (2+)</option>
                <option value="3+">3+ Purchases</option>
                <option value="5+">5+ Purchases</option>
                <option value="2">Exactly 2 Purchases</option>
                <option value="3">Exactly 3 Purchases</option>
                <option value="5">Exactly 5 Purchases</option>
                <option value="10">Exactly 10 Purchases</option>
                <option value="15">Exactly 15 Purchases</option>
              </select>
            </div>

          </div>
        )}

      </div>

      {/* =========================================================================
          SECTION 1: CUSTOMER REPEAT KPI SUMMARY CARDS (COMPACT SLEEK LAYOUT)
         ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Customer Repeat KPI Metrics</span>
            </h3>
            <span className="text-[11px] text-slate-500">| Valid distinct order calculations</span>
          </div>
        </div>

        {/* 10 Compact Cards in Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
          
          {/* Card 1: Total Unique Customers */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Unique Customers</span>
              <Users size={14} className="text-indigo-400" />
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono">
                {kpis?.totalUniqueCustomers.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Distinct verified buyers</p>
            </div>
          </div>

          {/* Card 2: 1-Time Customers */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">1-Time Buyers</span>
              <UserPlus size={14} className="text-cyan-400" />
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-extrabold text-cyan-300 font-mono">
                {kpis?.oneTimeBuyers.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {kpis?.totalUniqueCustomers ? ((kpis.oneTimeBuyers / kpis.totalUniqueCustomers) * 100).toFixed(1) : 0}% of customer base
              </p>
            </div>
          </div>

          {/* Card 3: Repeat Customers (2+ orders) */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-700/50 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Repeat Customers (2+)</span>
              <Repeat size={14} className="text-indigo-400" />
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-extrabold text-indigo-300 font-mono">
                {kpis?.repeatBuyers.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-[10px] text-indigo-300/80 mt-0.5 font-semibold">
                Repeat Rate: {kpis?.repeatPercentage.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Card 4: Total Revenue from Repeat Customers */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Repeat Sales Value</span>
              <DollarSign size={14} className="text-emerald-400" />
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-extrabold text-emerald-400 font-mono">
                ₹{kpis?.totalRepeatRevenue ? Math.round(kpis.totalRepeatRevenue).toLocaleString('en-IN') : 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {kpis?.netSalesValue ? ((kpis.totalRepeatRevenue / kpis.netSalesValue) * 100).toFixed(1) : 0}% of Net Sales
              </p>
            </div>
          </div>

          {/* Card 5: Repeat Customer AOV */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Repeat AOV</span>
              <ShoppingBag size={14} className="text-purple-400" />
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-extrabold text-purple-300 font-mono">
                ₹{Math.round(kpis?.repeatAOV || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Average order value</p>
            </div>
          </div>

          {/* Card 6: 3 Purchases */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">3 Purchases</span>
            <div className="text-lg font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith3.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500" title="Customers with 3 or more total orders">
              {kpis?.customersWith3Plus || 0} with 3+ orders
            </span>
          </div>

          {/* Card 7: 5 Purchases */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">5 Purchases</span>
            <div className="text-lg font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith5.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500" title="Customers with 5 or more total orders">
              {kpis?.customersWith5Plus || 0} with 5+ orders
            </span>
          </div>

          {/* Card 8: 10 Purchases */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">10 Purchases</span>
            <div className="text-lg font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith10.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500" title="Customers with 10 or more total orders">
              {kpis?.customersWith10Plus || 0} with 10+ orders
            </span>
          </div>

          {/* Card 9: 15 Purchases */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">15 Purchases</span>
            <div className="text-lg font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith15.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500" title="Customers with 15 or more total orders">
              {kpis?.customersWith15Plus || 0} with 15+ orders
            </span>
          </div>

          {/* Card 10: Net Sales vs Exclusions */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Sales</span>
            <div className="text-lg font-bold text-emerald-300 font-mono mt-1">
              ₹{kpis?.netSalesValue ? Math.round(kpis.netSalesValue).toLocaleString('en-IN') : 0}
            </div>
            <span className="text-[10px] text-slate-500">Excludes {kpis?.cancelledOrders} cancelled</span>
          </div>

        </div>
      </div>

      {/* =========================================================================
          SECTION 2: CHARTS — PURCHASE FREQUENCY (1 to 15+) & TRENDS OVER TIME
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Frequency Distribution Bar Chart */}
        <div className="p-4 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-indigo-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Purchase Frequency Distribution (1 to 15+ Orders)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {department === 'sales' && selectedFrequencyBucket !== null ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                  <span>Selected: {selectedBucketInfo?.bucket || `${selectedFrequencyBucket} orders`}</span>
                  <button
                    onClick={() => setSelectedFrequencyBucket(null)}
                    className="ml-1 hover:text-white"
                    title="Reset Selection"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : department === 'sales' ? (
                <span className="hidden sm:inline-block text-[10px] text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Click bar for details
                </span>
              ) : null}
              <span className="text-[11px] text-slate-400 font-mono">
                Total: {kpis?.totalUniqueCustomers.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="h-[260px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                data={data?.frequencyDistribution || []}
                margin={{ top: 20, right: 10, left: -20, bottom: 25 }}
                onClick={(e: any) => {
                  if (department === 'sales' && e?.activePayload?.[0]?.payload?.bucketNum) {
                    handleSelectFrequencyBucket(e.activePayload[0].payload.bucketNum);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="bucket"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={45}
                />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(99, 102, 241, 0.12)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{item.bucket}</p>
                          <p className="text-indigo-300">
                            Customers: <span className="font-mono font-bold text-white">{item.customerCount.toLocaleString('en-IN')}</span> ({item.percentage.toFixed(2)}%)
                          </p>
                          <p className="text-emerald-400">
                            Revenue: <span className="font-mono font-bold">₹{Math.round(item.totalRevenue).toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="customerCount" radius={[4, 4, 0, 0]} minPointSize={6}>
                  <LabelList
                    dataKey="customerCount"
                    position="top"
                    fill="#94a3b8"
                    fontSize={10}
                    formatter={(val: any) => (Number(val) > 0 ? Number(val).toLocaleString('en-IN') : '')}
                  />
                                    {(data?.frequencyDistribution || []).map((entry, index) => {
                    const isSelected = selectedFrequencyBucket === entry.bucketNum;
                    const isAnySelected = selectedFrequencyBucket !== null;
                    const baseColor = FREQUENCY_COLORS[index % FREQUENCY_COLORS.length];
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={baseColor}
                        fillOpacity={!isAnySelected ? 1 : isSelected ? 1 : 0.3}
                        stroke={isSelected ? '#ffffff' : 'none'}
                        strokeWidth={isSelected ? 2.5 : 0}
                        style={{ cursor: department === 'sales' ? 'pointer' : 'default' }}
                        onClick={(e: any) => {
                          if (department === 'sales') {
                            e.stopPropagation?.();
                            handleSelectFrequencyBucket(entry.bucketNum);
                          }
                        }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repeat Purchase Trends Over Time */}
        <div className="p-4 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Repeat Purchase Trends Over Time
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Monthly Timeline
            </span>
          </div>

          <div className="h-[260px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data?.repeatTrends || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="displayDate"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{label}</p>
                          <p className="text-cyan-400">
                            1-Time Orders: <span className="font-mono font-bold">{item.firstTimeOrders.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-indigo-400">
                            Repeat Orders: <span className="font-mono font-bold">{item.repeatOrders.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-emerald-400">
                            Repeat Revenue: <span className="font-mono font-bold">₹{Math.round(item.repeatRevenue).toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                />
                <Line
                  type="monotone"
                  dataKey="firstTimeOrders"
                  name="1-Time Orders"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#06b6d4' }}
                />
                <Line
                  type="monotone"
                  dataKey="repeatOrders"
                  name="Repeat Orders"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#818cf8' }}
                />
              </LineChart>
                        </ResponsiveContainer>
          </div>
        </div>

        {/* Purchase Frequency Drilldown Customer Details Panel (Sales Department) */}
        {department === 'sales' && selectedFrequencyBucket !== null && (
          <div
            ref={drilldownPanelRef}
            data-testid="purchase-frequency-details-panel"
            className="col-span-1 lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-indigo-500/40 shadow-2xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Header with Title, Count badge, Reset button, Phone toggle, Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                  style={{
                    backgroundColor:
                      selectedFrequencyBucket === 16
                        ? FREQUENCY_COLORS[15]
                        : FREQUENCY_COLORS[(selectedFrequencyBucket - 1) % FREQUENCY_COLORS.length]
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {selectedFrequencyBucket === 16
                        ? 'Customers with 15+ Orders'
                        : `Customers with ${selectedFrequencyBucket} Order${selectedFrequencyBucket > 1 ? 's' : ''}`}
                    </h3>
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold"
                      style={{
                        backgroundColor: `${
                          selectedFrequencyBucket === 16
                            ? FREQUENCY_COLORS[15]
                            : FREQUENCY_COLORS[(selectedFrequencyBucket - 1) % FREQUENCY_COLORS.length]
                        }25`,
                        color:
                          selectedFrequencyBucket === 16
                            ? FREQUENCY_COLORS[15]
                            : FREQUENCY_COLORS[(selectedFrequencyBucket - 1) % FREQUENCY_COLORS.length],
                        border: `1px solid ${
                          selectedFrequencyBucket === 16
                            ? FREQUENCY_COLORS[15]
                            : FREQUENCY_COLORS[(selectedFrequencyBucket - 1) % FREQUENCY_COLORS.length]
                        }50`
                      }}
                    >
                      {cohortMatchingCustomers.length.toLocaleString('en-IN')}{' '}
                      {cohortMatchingCustomers.length === 1 ? 'Customer' : 'Customers'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing all distinct customers who placed exactly{' '}
                    {selectedFrequencyBucket === 16 ? '15 or more' : selectedFrequencyBucket} valid orders.
                  </p>
                </div>
              </div>

              {/* Controls: Search, Phone Mask Toggle, Reset Selection */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={cohortSearch}
                    onChange={e => {
                      setCohortSearch(e.target.value);
                      setCohortPageIndex(0);
                    }}
                    placeholder="Search name, phone, city..."
                    className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-52"
                  />
                  {cohortSearch && (
                    <button
                      onClick={() => setCohortSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Mask/Unmask Phone Toggle */}
                <button
                  onClick={() => setShowMaskedPhone(!showMaskedPhone)}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-lg text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition"
                  title={showMaskedPhone ? 'Reveal full phone numbers' : 'Mask phone numbers'}
                >
                  {showMaskedPhone ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span className="hidden sm:inline">{showMaskedPhone ? 'Masked' : 'Unmasked'}</span>
                </button>

                {/* Reset Selection Button */}
                <button
                  onClick={() => setSelectedFrequencyBucket(null)}
                  className="h-8 px-3 bg-indigo-950/70 border border-indigo-700/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <X size={13} />
                  <span>Reset Selection</span>
                </button>
              </div>
            </div>

            {/* Vertically Scrollable Table with Fixed Height & Sticky Header */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <div className="max-h-[340px] overflow-y-auto">
                <table data-testid="frequency-cohort-table" className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 z-10 shadow-sm">
                    <tr className="bg-slate-900 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Phone Number</th>
                      <th className="py-2.5 px-3">City</th>
                      <th className="py-2.5 px-3">State</th>
                      <th
                        className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                        onClick={() => {
                          if (cohortSortField === 'totalOrders') setCohortSortAsc(!cohortSortAsc);
                          else { setCohortSortField('totalOrders'); setCohortSortAsc(false); }
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Total Orders</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                        onClick={() => {
                          if (cohortSortField === 'totalValue') setCohortSortAsc(!cohortSortAsc);
                          else { setCohortSortField('totalValue'); setCohortSortAsc(false); }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Total Purchase Value</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                        onClick={() => {
                          if (cohortSortField === 'averageOrderValue') setCohortSortAsc(!cohortSortAsc);
                          else { setCohortSortField('averageOrderValue'); setCohortSortAsc(false); }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Average Order Value</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                        onClick={() => {
                          if (cohortSortField === 'lastOrderDate') setCohortSortAsc(!cohortSortAsc);
                          else { setCohortSortField('lastOrderDate'); setCohortSortAsc(false); }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Last Purchase Date</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {visibleCohortCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-500">
                          <p className="text-sm font-semibold text-slate-400">
                            No customers match this frequency cohort.
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {cohortSearch ? 'Try clearing your search query.' : 'There are currently 0 customers with this exact purchase count.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      visibleCohortCustomers.map((cust, idx) => (
                        <tr
                          key={cust.customerKey || idx}
                          onClick={() => setSelectedCustomerForModal(cust)}
                          className="hover:bg-slate-800/50 transition cursor-pointer"
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                            {cohortPageIndex * cohortPageSize + idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {cust.customerName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {showMaskedPhone ? cust.maskedPhone : (cust.phone || 'Not Provided')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{cust.city || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-300">{cust.state || '—'}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-400">
                            {cust.totalOrders}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            ₹{Math.round(cust.totalValue).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            ₹{Math.round(cust.averageOrderValue).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {cust.lastOrderDate || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {filteredCohortCustomers.length > cohortPageSize && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-slate-800/80">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-white">
                    {cohortPageIndex * cohortPageSize + 1}
                  </span>
                  {' '}to{' '}
                  <span className="font-semibold text-white">
                    {Math.min((cohortPageIndex + 1) * cohortPageSize, filteredCohortCustomers.length)}
                  </span>
                  {' '}of{' '}
                  <span className="font-semibold text-white">
                    {filteredCohortCustomers.length.toLocaleString('en-IN')}
                  </span>
                  {' '}customers
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={cohortPageIndex === 0}
                    onClick={() => setCohortPageIndex(prev => Math.max(0, prev - 1))}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white transition"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-mono text-slate-400">
                    Page {cohortPageIndex + 1} of {totalCohortPages}
                  </span>
                  <button
                    disabled={cohortPageIndex >= totalCohortPages - 1}
                    onClick={() => setCohortPageIndex(prev => Math.min(totalCohortPages - 1, prev + 1))}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* =========================================================================
          SECTION 3: TOP 100 CUSTOMERS BY CUSTOMER VALUE
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3.5">
        
        {/* Table Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Top {valueLimit} Customers by Customer Value</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                  Value Ranked
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by total net purchase value, highest to lowest. Displays high-value purchasers across valid orders.
            </p>
          </div>

          {/* Controls: Search, Limit (15/25/50/100), Sort, Mask, CSV Export */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={valueSearch}
                onChange={e => {
                  setValueSearch(e.target.value);
                  setVisibleCountValue(15);
                }}
                placeholder="Search name, phone, city..."
                className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-40 sm:w-52"
              />
            </div>

            {/* Limit Selector: Top 15 / 25 / 50 / 100 */}
            <select
              value={valueLimit}
              onChange={e => handleValueLimitChange(Number(e.target.value))}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value={15}>Top 15</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>

            {/* Sort Field Selector */}
            <select
              value={valueSortField}
              onChange={e => setValueSortField(e.target.value as any)}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value="totalValue">Sort: Spend</option>
              <option value="totalOrders">Sort: Orders</option>
              <option value="lastOrderDate">Sort: Recent</option>
            </select>

            {/* Mask/Unmask Toggle */}
            <button
              onClick={() => setShowMaskedPhone(prev => !prev)}
              className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              title={showMaskedPhone ? 'Click to show unmasked phone numbers' : 'Click to mask phone numbers'}
            >
              {showMaskedPhone ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="hidden sm:inline">{showMaskedPhone ? 'Unmask' : 'Mask'}</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportValueCustomersCSV}
              className="h-8 px-3 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Export Top Customers by Value to CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

          </div>
        </div>

        {/* Top Customers by Value Table (Clean, responsive, NO inner scrollbar) */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table data-testid="top-value-customers-table" className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Location</th>
                <th 
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                  onClick={() => {
                    if (valueSortField === 'totalOrders') setValueSortAsc(!valueSortAsc);
                    else { setValueSortField('totalOrders'); setValueSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Orders</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Repeat Count</th>
                <th 
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                  onClick={() => {
                    if (valueSortField === 'totalValue') setValueSortAsc(!valueSortAsc);
                    else { setValueSortField('totalValue'); setValueSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Value</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">AOV</th>
                <th className="py-2.5 px-3">Top Product</th>
                <th className="py-2.5 px-3 text-right">Last Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {visibleValueCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No customers match the active filters or search criteria.
                  </td>
                </tr>
              ) : (
                visibleValueCustomers.map((c) => {
                  const isPowerBuyer = c.totalOrders >= 5;
                  const isRepeat = c.totalOrders >= 2;

                  return (
                    <tr
                      key={c.customerKey}
                      onClick={() => setSelectedCustomerForModal(c)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 group-hover:text-emerald-400">
                        {c.rank}
                      </td>

                      {/* Customer Name */}
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">{c.customerName}</span>
                          {isPowerBuyer && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              VIP
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {showMaskedPhone ? c.maskedPhone : c.phone}
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 text-slate-300">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{c.city}</span>
                          <span className="text-[10px] text-slate-500">{c.state}</span>
                        </div>
                      </td>

                      {/* Orders */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                          isPowerBuyer
                            ? 'bg-purple-950 text-purple-300 border border-purple-700/60'
                            : isRepeat
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {c.totalOrders}
                        </span>
                      </td>

                      {/* Repeat Purchase Count */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {c.repeatPurchaseCount > 0 ? (
                          <span className="text-emerald-400 font-semibold">+{c.repeatPurchaseCount}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Total Value */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{c.totalValue.toLocaleString('en-IN')}
                      </td>

                      {/* AOV */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        ₹{c.averageOrderValue.toLocaleString('en-IN')}
                      </td>

                      {/* Top Product */}
                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="truncate max-w-[150px] inline-block" title={c.mostPurchasedProduct}>
                          {c.mostPurchasedProduct}
                        </span>
                      </td>

                      {/* Last Order Date */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {c.lastOrderDate}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Expansion Footer: Showing 1–15 of N, View More / Show Less */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400 font-medium">
            Showing <span className="font-mono font-bold text-white">1–{Math.min(visibleCountValue, processedValueCustomers.length)}</span> of{' '}
            <span className="font-mono font-bold text-white">{processedValueCustomers.length}</span> customers
          </div>

          <div className="flex items-center gap-2">
            {visibleCountValue < processedValueCustomers.length && (
              <button
                type="button"
                onClick={() => setVisibleCountValue(prev => Math.min(prev + 15, processedValueCustomers.length))}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>View More (+{Math.min(15, processedValueCustomers.length - visibleCountValue)})</span>
                <ChevronDown size={14} className="text-emerald-400" />
              </button>
            )}

            {visibleCountValue > 15 && (
              <button
                type="button"
                onClick={() => setVisibleCountValue(15)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>Show Less</span>
                <ChevronUp size={14} className="text-slate-400" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION 4: TOP 100 REPEAT CUSTOMERS (RANKED BY VALID ORDER COUNT)
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3.5">
        
        {/* Table Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Repeat size={16} className="text-indigo-400" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Top {repeatLimit} Repeat Customers</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                  Frequency Ranked (2+ Orders)
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by the number of distinct valid orders (2+ orders). Secondary sort by customer net spend when tied.
            </p>
          </div>

          {/* Controls: Search, Limit (15/25/50/100), Sort, Mask, CSV Export */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={repeatSearch}
                onChange={e => {
                  setRepeatSearch(e.target.value);
                  setVisibleCountRepeat(15);
                }}
                placeholder="Search name, phone, city..."
                className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-40 sm:w-52"
              />
            </div>

            {/* Limit Selector: Top 15 / 25 / 50 / 100 */}
            <select
              value={repeatLimit}
              onChange={e => handleRepeatLimitChange(Number(e.target.value))}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value={15}>Top 15</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>

            {/* Sort Field Selector */}
            <select
              value={repeatSortField}
              onChange={e => setRepeatSortField(e.target.value as any)}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value="totalOrders">Sort: Orders (Repeat Count)</option>
              <option value="totalValue">Sort: Spend</option>
              <option value="lastOrderDate">Sort: Recent</option>
            </select>

            {/* Mask/Unmask Toggle */}
            <button
              onClick={() => setShowMaskedPhone(prev => !prev)}
              className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              title={showMaskedPhone ? 'Click to show unmasked phone numbers' : 'Click to mask phone numbers'}
            >
              {showMaskedPhone ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="hidden sm:inline">{showMaskedPhone ? 'Unmask' : 'Mask'}</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportRepeatCustomersCSV}
              className="h-8 px-3 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Export Top Repeat Customers to CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

          </div>
        </div>

        {/* Top Repeat Customers Table (Clean, responsive, NO inner scrollbar) */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table data-testid="top-repeat-customers-table" className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Location</th>
                <th 
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                  onClick={() => {
                    if (repeatSortField === 'totalOrders') setRepeatSortAsc(!repeatSortAsc);
                    else { setRepeatSortField('totalOrders'); setRepeatSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Valid Orders</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Repeat Purchase Count</th>
                <th 
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                  onClick={() => {
                    if (repeatSortField === 'totalValue') setRepeatSortAsc(!repeatSortAsc);
                    else { setRepeatSortField('totalValue'); setRepeatSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Value</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">AOV</th>
                <th className="py-2.5 px-3">Top Product</th>
                <th className="py-2.5 px-3 text-right">Last Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {visibleRepeatCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No repeat customers match the active filters or search criteria.
                  </td>
                </tr>
              ) : (
                visibleRepeatCustomers.map((c) => {
                  const isPowerBuyer = c.totalOrders >= 5;

                  return (
                    <tr
                      key={c.customerKey}
                      onClick={() => setSelectedCustomerForModal(c)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 group-hover:text-indigo-400">
                        {c.rank}
                      </td>

                      {/* Customer Name */}
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">{c.customerName}</span>
                          {isPowerBuyer && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              VIP
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {showMaskedPhone ? c.maskedPhone : c.phone}
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 text-slate-300">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{c.city}</span>
                          <span className="text-[10px] text-slate-500">{c.state}</span>
                        </div>
                      </td>

                      {/* Valid Orders */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                          isPowerBuyer
                            ? 'bg-purple-950 text-purple-300 border border-purple-700/60'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                        }`}>
                          {c.totalOrders}
                        </span>
                      </td>

                      {/* Repeat Purchase Count */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="text-indigo-300 font-bold bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/40 text-[11px]">
                          +{c.repeatPurchaseCount}
                        </span>
                      </td>

                      {/* Total Value */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{c.totalValue.toLocaleString('en-IN')}
                      </td>

                      {/* AOV */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        ₹{c.averageOrderValue.toLocaleString('en-IN')}
                      </td>

                      {/* Top Product */}
                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="truncate max-w-[150px] inline-block" title={c.mostPurchasedProduct}>
                          {c.mostPurchasedProduct}
                        </span>
                      </td>

                      {/* Last Order Date */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {c.lastOrderDate}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Expansion Footer: Showing 1–15 of N, View More / Show Less */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400 font-medium">
            Showing <span className="font-mono font-bold text-white">1–{Math.min(visibleCountRepeat, processedRepeatCustomers.length)}</span> of{' '}
            <span className="font-mono font-bold text-white">{processedRepeatCustomers.length}</span> repeat customers
          </div>

          <div className="flex items-center gap-2">
            {visibleCountRepeat < processedRepeatCustomers.length && (
              <button
                type="button"
                onClick={() => setVisibleCountRepeat(prev => Math.min(prev + 15, processedRepeatCustomers.length))}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>View More (+{Math.min(15, processedRepeatCustomers.length - visibleCountRepeat)})</span>
                <ChevronDown size={14} className="text-indigo-400" />
              </button>
            )}

            {visibleCountRepeat > 15 && (
              <button
                type="button"
                onClick={() => setVisibleCountRepeat(15)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>Show Less</span>
                <ChevronUp size={14} className="text-slate-400" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION 5: GEOGRAPHIC CUSTOMER ANALYTICS (TOP 100 STATES & CITIES)
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-4">
        
        {/* Section Header with Tabs & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-indigo-400" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Geographic Customer Analytics (Top {geoLimit})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked geographic breakdown of unique customers, repeat buyers, repeat rate, and net sales
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Tabs: Top States vs Top Cities */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setGeoTab('states');
                  setDrillDownState(null);
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  geoTab === 'states'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Top States
              </button>
              <button
                type="button"
                onClick={() => setGeoTab('cities')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  geoTab === 'cities'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Top Cities
              </button>
            </div>

            {/* Drilldown Chip if active */}
            {drillDownState && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <span>Drill-down: <strong>{drillDownState}</strong></span>
                <button onClick={clearStateDrilldown} className="text-slate-400 hover:text-white">
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={geoSearch}
                onChange={e => setGeoSearch(e.target.value)}
                placeholder={`Search ${geoTab}...`}
                className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
              />
            </div>

            {/* Limit Selector: Top 15 / 25 / 50 / 100 */}
            <select
              value={geoLimit}
              onChange={e => setGeoLimit(Number(e.target.value))}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value={15}>Top 15</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportGeoCSV}
              className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              title={`Export Top ${geoTab} CSV`}
            >
              <Download size={13} />
              <span>CSV</span>
            </button>

          </div>
        </div>

        {/* Horizontal Bar Chart for Top 10 Locations */}
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">
              Top 10 {geoTab === 'states' ? 'States' : 'Cities'} by Customer Volume
            </span>
            <span className="text-[11px] text-slate-500">
              Click on a state row to drill down into its cities
            </span>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={processedGeoData.slice(0, 10)}
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{item.name}</p>
                          <p className="text-cyan-400">
                            Customers: <span className="font-mono font-bold">{item.uniqueCustomers.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-indigo-400">
                            Repeat Buyers: <span className="font-mono font-bold">{item.repeatCustomers.toLocaleString('en-IN')}</span> ({item.repeatRate.toFixed(1)}%)
                          </p>
                          <p className="text-emerald-400">
                            Total Sales: <span className="font-mono font-bold">₹{Math.round(item.salesValue).toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="uniqueCustomers" fill="#818cf8" radius={[0, 4, 4, 0]}>
                  {processedGeoData.slice(0, 10).map((entry, index) => (
                    <Cell key={`geo-cell-${index}`} fill={index % 2 === 0 ? '#818cf8' : '#a78bfa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Ranked Table for Top States / Cities */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">{geoTab === 'states' ? 'State' : 'City'}</th>
                {geoTab === 'cities' && <th className="py-2.5 px-3">State</th>}
                <th className="py-2.5 px-3 text-center">Total Orders</th>
                <th className="py-2.5 px-3 text-center">Unique Customers</th>
                <th className="py-2.5 px-3 text-center">Repeat Buyers</th>
                <th className="py-2.5 px-3 text-center">Repeat Rate</th>
                <th className="py-2.5 px-3 text-right">Net Sales</th>
                {geoTab === 'states' && <th className="py-2.5 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {processedGeoData.length === 0 ? (
                <tr>
                  <td colSpan={geoTab === 'states' ? 8 : 7} className="py-8 text-center text-slate-500">
                    No location records match the current filters.
                  </td>
                </tr>
              ) : (
                processedGeoData.map((item) => (
                  <tr key={item.name} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                      {item.rank}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {item.name}
                    </td>
                    {geoTab === 'cities' && (
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {item.state}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                      {item.totalOrders.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-200">
                      {item.uniqueCustomers.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-indigo-300">
                      {item.repeatCustomers.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-700/50">
                        {item.repeatRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{Math.round(item.salesValue).toLocaleString('en-IN')}
                    </td>
                    {geoTab === 'states' && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleStateDrillDown(item.name)}
                          className="px-2 py-0.5 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-semibold cursor-pointer transition-all border border-indigo-500/30"
                        >
                          View Cities →
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* =========================================================================
          SECTION 6: PRODUCT-LEVEL REPEAT PURCHASE INSIGHTS
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Package size={16} className="text-purple-400" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Product-Level Repeat Purchase Insights
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated from line items of repeat customer purchases. Displays quantity sold, repeat buyers, and sales value.
            </p>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search products..."
              className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-44 sm:w-60"
            />
          </div>
        </div>

        {/* Bar Chart: Top Products by Repeat Sales Value */}
        <div className="h-[220px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedProducts.slice(0, 8)}
              margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="productName"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={40}
              />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                        <p className="font-bold text-white">{item.productName}</p>
                        <p className="text-indigo-300">
                          Repeat Buyers: <span className="font-mono font-bold text-white">{item.repeatCustomerCount.toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-cyan-300">
                          Repeat Quantity: <span className="font-mono font-bold text-white">{item.repeatQuantity.toLocaleString('en-IN')} units</span>
                        </p>
                        <p className="text-emerald-400">
                          Repeat Sales: <span className="font-mono font-bold">₹{Math.round(item.repeatSalesValue).toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-slate-400 text-[10px]">
                          Avg Price: ₹{item.averageUnitPrice}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="repeatSalesValue" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3">Product Name</th>
                <th 
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                  onClick={() => {
                    if (productSortField === 'repeatCustomerCount') setProductSortAsc(!productSortAsc);
                    else { setProductSortField('repeatCustomerCount'); setProductSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Repeat Buyers</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                  onClick={() => {
                    if (productSortField === 'repeatQuantity') setProductSortAsc(!productSortAsc);
                    else { setProductSortField('repeatQuantity'); setProductSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Repeat Quantity</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                  onClick={() => {
                    if (productSortField === 'repeatSalesValue') setProductSortAsc(!productSortAsc);
                    else { setProductSortField('repeatSalesValue'); setProductSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Repeat Sales Value</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Avg Unit Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No products match the search query.
                  </td>
                </tr>
              ) : (
                processedProducts.map((p) => (
                  <tr key={p.productName} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {p.productName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-300">
                      {p.repeatCustomerCount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-cyan-300">
                      {p.repeatQuantity.toLocaleString('en-IN')} units
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{Math.round(p.repeatSalesValue).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      ₹{p.averageUnitPrice}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* =========================================================================
          CUSTOMER PROFILE / ORDER HISTORY MODAL
         ========================================================================= */}
      {selectedCustomerForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedCustomerForModal.customerName}</h3>
                  {selectedCustomerForModal.totalOrders >= 5 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      VIP Buyer
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span className="font-mono text-slate-300">
                    {showMaskedPhone ? selectedCustomerForModal.maskedPhone : selectedCustomerForModal.phone}
                  </span>
                  <span>•</span>
                  <span>{selectedCustomerForModal.city}, {selectedCustomerForModal.state}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedCustomerForModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Metrics Grid */}
            <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/40 border-b border-slate-800/60">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
                <div className="text-xl font-mono font-bold text-white mt-1">
                  {selectedCustomerForModal.totalOrders}
                </div>
                <span className="text-[10px] text-indigo-400">+{selectedCustomerForModal.repeatPurchaseCount} repeat</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Spend</span>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                  ₹{selectedCustomerForModal.totalValue.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500">Net purchases</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AOV</span>
                <div className="text-xl font-mono font-bold text-purple-300 mt-1">
                  ₹{selectedCustomerForModal.averageOrderValue.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500">Per order avg</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Product</span>
                <div className="text-xs font-semibold text-slate-200 mt-1 truncate" title={selectedCustomerForModal.mostPurchasedProduct}>
                  {selectedCustomerForModal.mostPurchasedProduct}
                </div>
                <span className="text-[10px] text-slate-500">Most purchased</span>
              </div>
            </div>

            {/* Order IDs & Dates List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Order History ({selectedCustomerForModal.orderIds.length} Valid Orders)
              </h4>

              <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                {selectedCustomerForModal.orderIds.map((ordId, idx) => (
                  <div
                    key={ordId}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-850/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-white">{ordId}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {idx === 0 ? `Last: ${selectedCustomerForModal.lastOrderDate}` : idx === selectedCustomerForModal.orderIds.length - 1 ? `First: ${selectedCustomerForModal.firstOrderDate}` : ''}
                      </span>
                      {onNavigateToOrder && (
                        <button
                          type="button"
                          onClick={() => onNavigateToOrder(ordId)}
                          className="px-2 py-1 rounded bg-indigo-600/30 text-indigo-300 hover:text-white hover:bg-indigo-600 text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          View Order →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomerForModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
