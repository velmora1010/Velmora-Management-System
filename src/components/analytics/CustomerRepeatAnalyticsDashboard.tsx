import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowUpDown,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  BarChart3,
  Percent,
  Clock,
  ArrowRight,
  X
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
  Cell
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
  className = ''
}) => {
  // 1. Data State
  const [data, setData] = useState<ComprehensiveRepeatAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Filter States
  const [datePreset, setDatePreset] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(defaultDateRange?.startDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(defaultDateRange?.endDate || '');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState<AnalyticsFilterParams['frequencyRange']>('all');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState<boolean>(false);

  // 3. Top Customers Table Controls
  const [customerLimit, setCustomerLimit] = useState<number>(100);
  const [customerSortField, setCustomerSortField] = useState<'totalValue' | 'totalOrders' | 'lastOrderDate'>('totalValue');
  const [customerSortAsc, setCustomerSortAsc] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [showMaskedPhone, setShowMaskedPhone] = useState<boolean>(true);
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<TopCustomerItem | null>(null);

  // 4. Geographic Controls
  const [geoTab, setGeoTab] = useState<'states' | 'cities'>('states');
  const [geoLimit, setGeoLimit] = useState<number>(100);
  const [geoSearch, setGeoSearch] = useState<string>('');
  const [drillDownState, setDrillDownState] = useState<string | null>(null);

  // 5. Product Insights Table Controls
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

      // Compute effective dates
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
      } else if (datePreset === 'all') {
        effectiveStart = '';
        effectiveEnd = '';
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

  // Handle State selection change -> reset city filter if state changes
  const handleStateChange = (st: string) => {
    setSelectedState(st);
    setSelectedCity('ALL');
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
  // Filtered & Sorted Customer Table Data
  // -------------------------------------------------------------
  const processedCustomers = useMemo(() => {
    if (!data) return [];
    let list = [...data.topCustomers];

    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase().trim();
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
      if (customerSortField === 'totalValue') {
        comparison = a.totalValue - b.totalValue;
      } else if (customerSortField === 'totalOrders') {
        comparison = a.totalOrders - b.totalOrders;
      } else if (customerSortField === 'lastOrderDate') {
        comparison = a.lastOrderDate.localeCompare(b.lastOrderDate);
      }
      return customerSortAsc ? comparison : -comparison;
    });

    return list.slice(0, customerLimit);
  }, [data, customerSearch, customerSortField, customerSortAsc, customerLimit]);

  // -------------------------------------------------------------
  // Filtered & Sorted Geographic Data
  // -------------------------------------------------------------
  const processedGeoData = useMemo(() => {
    if (!data) return [];
    let list = geoTab === 'states' ? [...data.topStates] : [...data.topCities];

    // If drilled down to a specific state in cities view
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

  // -------------------------------------------------------------
  // Export CSV Handler
  // -------------------------------------------------------------
  const handleExportCustomersCSV = () => {
    if (!processedCustomers.length) {
      toast.error('No customer records to export');
      return;
    }

    const headers = [
      'Rank',
      'Customer Name',
      'Phone Number',
      'City',
      'State',
      'Total Orders',
      'Repeat Purchase Count',
      'Total Value (INR)',
      'AOV (INR)',
      'Most Purchased Product',
      'Last Order Date',
      'First Order Date'
    ];

    const rows = processedCustomers.map(c => [
      c.rank,
      `"${c.customerName.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.city}"`,
      `"${c.state}"`,
      c.totalOrders,
      c.repeatPurchaseCount,
      c.totalValue,
      c.averageOrderValue,
      `"${c.mostPurchasedProduct.replace(/"/g, '""')}"`,
      `"${c.lastOrderDate}"`,
      `"${c.firstOrderDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `velmora_top_${customerLimit}_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Customer data exported successfully!');
  };

  const handleExportGeoCSV = () => {
    if (!processedGeoData.length) return;
    const headers = ['Rank', 'Location', 'State', 'Total Orders', 'Unique Customers', 'Repeat Customers', 'Repeat Rate (%)', 'Sales Value (INR)'];
    const rows = processedGeoData.map(item => [
      item.rank,
      `"${item.name.replace(/"/g, '""')}"`,
      item.state ? `"${item.state.replace(/"/g, '""')}"` : '""',
      item.totalOrders,
      item.uniqueCustomers,
      item.repeatCustomers,
      item.repeatRate.toFixed(2),
      item.salesValue
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `velmora_top_${geoTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Geographic ${geoTab} exported!`);
  };

  // -------------------------------------------------------------
  // Render Loading State
  // -------------------------------------------------------------
  if (loading && !data) {
    return (
      <div className="w-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-[#0b1220] rounded-2xl border border-slate-800 text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-300">Computing Customer Repeat & Geographic Analytics...</p>
        <p className="text-xs text-slate-500">Aggregating canonical purchase histories and distinct order frequency</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render Error State
  // -------------------------------------------------------------
  if (error && !data) {
    return (
      <div className="w-full p-8 bg-rose-950/30 rounded-2xl border border-rose-800 text-slate-300 flex flex-col items-center justify-center gap-3">
        <X size={32} className="text-rose-400" />
        <h3 className="text-lg font-bold text-rose-200">Failed to Load Customer Analytics</h3>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={() => loadAnalytics(true)}
          className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-2"
        >
          <RotateCcw size={14} /> Try Again
        </button>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className={`space-y-6 text-slate-200 ${className}`}>
      
      {/* =========================================================================
          TOOLBAR: GLOBAL FILTER CONTROLS & LAST UPDATED STATUS
         ========================================================================= */}
      <div className="p-4 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
              <Repeat size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Customer Repeat Purchase Analysis
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Canonical Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>Range: <strong className="text-slate-300">{data?.dateRangeDisplay}</strong></span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock size={11} /> Updated: {data?.lastUpdated}
                </span>
              </p>
            </div>
          </div>

          {/* Right Action Controls: Quick Date Preset, Filters Toggle & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Date Preset Selector */}
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value)}
              className="h-9 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 hover:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">All Canonical Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {/* Custom Date Inputs if selected */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2 h-9">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none"
                  title="Start Date"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none"
                  title="End Date"
                />
              </div>
            )}

            {/* Filters Toggle Button */}
            <button
              onClick={() => setShowFiltersDrawer(prev => !prev)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                showFiltersDrawer || selectedState !== 'ALL' || selectedCity !== 'ALL' || selectedProduct !== 'ALL' || selectedFrequency !== 'all'
                  ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-sm'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white'
              }`}
            >
              <Filter size={13} />
              <span>Filters</span>
              {(selectedState !== 'ALL' || selectedCity !== 'ALL' || selectedProduct !== 'ALL' || selectedFrequency !== 'all') && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => loadAnalytics(true)}
              disabled={isRefreshing}
              className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-indigo-400' : ''} />
            </button>

          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showFiltersDrawer && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in duration-150">
            
            {/* 1. State Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">State</label>
              <select
                value={selectedState}
                onChange={e => handleStateChange(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All States ({data?.availableStates.length || 0})</option>
                {data?.availableStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* 2. City Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">City</label>
              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Cities ({data?.availableCities.length || 0})</option>
                {data?.availableCities.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>

            {/* 3. Product Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product</label>
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Products ({data?.availableProducts.length || 0})</option>
                {data?.availableProducts.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 4. Purchase Frequency Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Frequency Group</label>
              <select
                value={selectedFrequency}
                onChange={e => setSelectedFrequency(e.target.value as any)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Frequency Groups</option>
                <option value="1">1-Time Only</option>
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
          SECTION 1: CUSTOMER REPEAT PURCHASE ANALYSIS (KPI CARDS GRID)
         ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Customer Repeat KPI Metrics</span>
            </h3>
            <span className="text-xs text-slate-500">| Valid distinct order calculations</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          
          {/* Card 1: Total Unique Customers */}
          <div className="p-4 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Unique Customers</span>
              <Users size={16} className="text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-white font-mono">
                {kpis?.totalUniqueCustomers.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Distinct verified buyers</p>
            </div>
          </div>

          {/* Card 2: 1-Time Customers */}
          <div className="p-4 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">1-Time Buyers</span>
              <UserPlus size={16} className="text-cyan-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-cyan-300 font-mono">
                {kpis?.oneTimeBuyers.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {kpis?.totalUniqueCustomers ? ((kpis.oneTimeBuyers / kpis.totalUniqueCustomers) * 100).toFixed(1) : 0}% of customer base
              </p>
            </div>
          </div>

          {/* Card 3: Repeat Customers (2+ orders) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-700/50 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[11px] font-bold uppercase tracking-wider">Repeat Customers (2+)</span>
              <Repeat size={16} className="text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-indigo-300 font-mono">
                {kpis?.repeatBuyers.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-[11px] text-indigo-300/80 mt-0.5 font-semibold">
                Repeat Rate: {kpis?.repeatPercentage.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Card 4: Total Revenue from Repeat Customers */}
          <div className="p-4 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Repeat Sales Value</span>
              <DollarSign size={16} className="text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                ₹{kpis?.totalRepeatRevenue ? Math.round(kpis.totalRepeatRevenue).toLocaleString('en-IN') : 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {kpis?.netSalesValue ? ((kpis.totalRepeatRevenue / kpis.netSalesValue) * 100).toFixed(1) : 0}% of Net Sales
              </p>
            </div>
          </div>

          {/* Card 5: Repeat Customer AOV */}
          <div className="p-4 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Repeat AOV</span>
              <ShoppingBag size={16} className="text-purple-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-purple-300 font-mono">
                ₹{Math.round(kpis?.repeatAOV || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Average order value</p>
            </div>
          </div>

          {/* Card 6: Exactly 3 Purchases */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">3 Purchases</span>
            <div className="text-xl font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith3.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500">Tri-purchasers</span>
          </div>

          {/* Card 7: Exactly 5 Purchases */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">5 Purchases</span>
            <div className="text-xl font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith5.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500">Power buyers</span>
          </div>

          {/* Card 8: Exactly 10 Purchases */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">10 Purchases</span>
            <div className="text-xl font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith10.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500">VIP buyers</span>
          </div>

          {/* Card 9: Exactly 15 Purchases */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">15 Purchases</span>
            <div className="text-xl font-bold text-slate-200 font-mono mt-1">
              {kpis?.customersWith15.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-500">Super champions</span>
          </div>

          {/* Card 10: Net Sales vs Exclusions */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Sales</span>
            <div className="text-xl font-bold text-emerald-300 font-mono mt-1">
              ₹{kpis?.netSalesValue ? Math.round(kpis.netSalesValue).toLocaleString('en-IN') : 0}
            </div>
            <span className="text-[10px] text-slate-500">Excludes {kpis?.cancelledOrders} cancelled</span>
          </div>

        </div>
      </div>

      {/* =========================================================================
          SECTION 1.1: CHARTS — PURCHASE FREQUENCY (1 to 15+) & TRENDS OVER TIME
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Frequency Distribution Bar Chart */}
        <div className="p-4 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Purchase Frequency Distribution (1 to 15+ Orders)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Total: {kpis?.totalUniqueCustomers.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.frequencyDistribution || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
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
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as any;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{item.bucket}</p>
                          <p className="text-indigo-300 font-mono">
                            Customers: <span className="font-bold">{item.customerCount.toLocaleString('en-IN')}</span> ({item.percentage.toFixed(2)}%)
                          </p>
                          <p className="text-emerald-300 font-mono">
                            Revenue: ₹{Math.round(item.totalRevenue).toLocaleString('en-IN')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="customerCount" radius={[4, 4, 0, 0]}>
                  {(data?.frequencyDistribution || []).map((entry, index) => (
                    <Cell
                      key={`freq-${index}`}
                      fill={FREQUENCY_COLORS[index % FREQUENCY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repeat Trends Line Chart */}
        <div className="p-4 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Repeat Purchase Trends Over Time
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Monthly Timeline
            </span>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data?.repeatTrends || []}
                margin={{ top: 10, right: 15, left: -15, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="displayDate"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as any;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-xs space-y-1.5">
                          <p className="font-bold text-white">{item.displayDate}</p>
                          <div className="flex items-center justify-between gap-4 text-indigo-300">
                            <span>Repeat Orders:</span>
                            <span className="font-bold font-mono">{item.repeatOrders}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-emerald-300">
                            <span>Repeat Sales:</span>
                            <span className="font-bold font-mono">₹{Math.round(item.repeatRevenue).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-cyan-300">
                            <span>1-Time Orders:</span>
                            <span className="font-bold font-mono">{item.firstTimeOrders}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={25} wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="repeatOrders"
                  name="Repeat Orders"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#818cf8' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="firstTimeOrders"
                  name="1-Time Orders"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION 2: TOP 100 CUSTOMERS BY CUSTOMER VALUE
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-4">
        
        {/* Table Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Top {customerLimit} Customers by Customer Value</span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                  {processedCustomers.length} Listed
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by net verified sales value across valid orders within the selected filter range
            </p>
          </div>

          {/* Controls: Limit, Sort, Mask Phone, CSV Export */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search name, phone, city..."
                className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>

            {/* Limit Selector (Top 10 / 25 / 50 / 100) */}
            <select
              value={customerLimit}
              onChange={e => setCustomerLimit(Number(e.target.value))}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>

            {/* Sort Field Selector */}
            <select
              value={customerSortField}
              onChange={e => setCustomerSortField(e.target.value as any)}
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
              onClick={handleExportCustomersCSV}
              className="h-8 px-3 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Export Top Customers to CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

          </div>
        </div>

        {/* Top 100 Customers Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Location</th>
                <th 
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                  onClick={() => {
                    if (customerSortField === 'totalOrders') setCustomerSortAsc(!customerSortAsc);
                    else { setCustomerSortField('totalOrders'); setCustomerSortAsc(false); }
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
                    if (customerSortField === 'totalValue') setCustomerSortAsc(!customerSortAsc);
                    else { setCustomerSortField('totalValue'); setCustomerSortAsc(false); }
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
              {processedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No customers match the active filters or search criteria.
                  </td>
                </tr>
              ) : (
                processedCustomers.map((c) => {
                  const isPowerBuyer = c.totalOrders >= 5;
                  const isRepeat = c.totalOrders >= 2;

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
                          <span className="text-indigo-300 font-semibold">+{c.repeatPurchaseCount}</span>
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

      </div>

      {/* =========================================================================
          SECTION 3: GEOGRAPHIC CUSTOMER ANALYTICS (TOP 100 STATES & CITIES)
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-4">
        
        {/* Geo Section Header & Tab Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-indigo-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Geographic Customer Analytics (Top {geoLimit})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked geographic breakdown of unique customers, repeat buyers, repeat rate, and net sales
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* States vs Cities Tab Toggle */}
            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
              <button
                onClick={() => { setGeoTab('states'); setDrillDownState(null); }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  geoTab === 'states'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Top States
              </button>
              <button
                onClick={() => setGeoTab('cities')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  geoTab === 'cities'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Top Cities
              </button>
            </div>

            {/* Drilldown Active Filter Badge */}
            {drillDownState && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-700/60 text-purple-200 text-xs">
                <span>State: {drillDownState}</span>
                <button
                  onClick={clearStateDrilldown}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Clear State Filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Search Input */}
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

            {/* Limit Selector */}
            <select
              value={geoLimit}
              onChange={e => setGeoLimit(Number(e.target.value))}
              className="h-8 px-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportGeoCSV}
              className="h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
              title={`Export Top ${geoTab} CSV`}
            >
              <Download size={12} />
              <span className="hidden sm:inline">CSV</span>
            </button>

          </div>
        </div>

        {/* Horizontal Bar Chart for Top 10 Locations */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">
              Top 10 {geoTab === 'states' ? 'States' : 'Cities'} by Customer Volume
            </span>
            <span className="text-[11px] text-slate-500">
              Click on a state row to drill down into its cities
            </span>
          </div>

          <div className="h-[240px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={processedGeoData.slice(0, 10)}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#cbd5e1"
                  fontSize={11}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as any;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{item.name} {item.state ? `(${item.state})` : ''}</p>
                          <p className="text-indigo-300 font-mono">Customers: <strong>{item.uniqueCustomers.toLocaleString('en-IN')}</strong></p>
                          <p className="text-purple-300 font-mono">Repeat Buyers: <strong>{item.repeatCustomers}</strong> ({item.repeatRate.toFixed(1)}%)</p>
                          <p className="text-emerald-300 font-mono">Total Sales: ₹{Math.round(item.salesValue).toLocaleString('en-IN')}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="uniqueCustomers" fill="#6366f1" radius={[0, 4, 4, 0]} name="Unique Customers" />
                <Bar dataKey="repeatCustomers" fill="#a855f7" radius={[0, 4, 4, 0]} name="Repeat Buyers" />
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
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No geographic records match the active criteria.
                  </td>
                </tr>
              ) : (
                processedGeoData.map((item) => (
                  <tr
                    key={`${item.name}__${item.state || ''}`}
                    className="hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                      {item.rank}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {item.name}
                    </td>
                    {geoTab === 'cities' && (
                      <td className="py-2.5 px-3 text-slate-400 font-medium">
                        {item.state}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                      {item.totalOrders.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-300">
                      {item.uniqueCustomers.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-purple-300">
                      {item.repeatCustomers.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.repeatRate >= 15
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : item.repeatRate >= 10
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {item.repeatRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{Math.round(item.salesValue).toLocaleString('en-IN')}
                    </td>
                    {geoTab === 'states' && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleStateDrillDown(item.name)}
                          className="px-2 py-1 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/40 text-[10px] font-semibold cursor-pointer transition-all"
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
          SECTION 4: PRODUCT-LEVEL REPEAT PURCHASE INSIGHTS
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Package size={18} className="text-purple-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Product-Level Repeat Purchase Insights
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated from line items of repeat customer purchases. Displays quantity sold, repeat buyers, and sales value.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Product Bar Chart */}
        <div className="h-[250px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedProducts.slice(0, 8)}
              margin={{ top: 10, right: 10, left: -10, bottom: 35 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="productName"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as ProductRepeatInsightItem;
                    return (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-xs space-y-1">
                        <p className="font-bold text-white">{item.productName}</p>
                        <p className="text-purple-300 font-mono">Repeat Buyers: <strong>{item.repeatCustomerCount}</strong></p>
                        <p className="text-cyan-300 font-mono">Repeat Quantity: <strong>{item.repeatQuantity} units</strong></p>
                        <p className="text-emerald-300 font-mono">Repeat Sales: ₹{item.repeatSalesValue.toLocaleString('en-IN')}</p>
                        <p className="text-slate-400 font-mono text-[10px]">Avg Price: ₹{item.averageUnitPrice}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="repeatSalesValue" fill="#a855f7" radius={[4, 4, 0, 0]} name="Repeat Sales Value (₹)" />
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
                    No repeat product insights available for current filters.
                  </td>
                </tr>
              ) : (
                processedProducts.map((p) => (
                  <tr key={p.productName} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {p.productName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-300">
                      {p.repeatCustomerCount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-cyan-300">
                      {p.repeatQuantity.toLocaleString('en-IN')} units
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{p.repeatSalesValue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      ₹{p.averageUnitPrice.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* =========================================================================
          MODAL: CUSTOMER ORDER HISTORY INSPECTION
         ========================================================================= */}
      {selectedCustomerForModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0b1220] border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-white">{selectedCustomerForModal.customerName}</h4>
                <p className="text-xs text-slate-400">
                  {showMaskedPhone ? selectedCustomerForModal.maskedPhone : selectedCustomerForModal.phone} • {selectedCustomerForModal.city}, {selectedCustomerForModal.state}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
                <p className="text-xl font-bold font-mono text-white mt-0.5">{selectedCustomerForModal.totalOrders}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Spend</span>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">₹{selectedCustomerForModal.totalValue.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Order Value</span>
                <p className="text-xl font-bold font-mono text-purple-300 mt-0.5">₹{selectedCustomerForModal.averageOrderValue.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300">Order IDs associated with this customer:</span>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                {selectedCustomerForModal.orderIds.map(oid => (
                  <span
                    key={oid}
                    onClick={() => {
                      if (onNavigateToOrder) onNavigateToOrder(oid);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-indigo-300 hover:border-indigo-500 cursor-pointer transition-all"
                  >
                    #{oid}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedCustomerForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
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
