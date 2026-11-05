import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Layers, 
  TrendingUp, 
  Search, 
  ArrowUpDown, 
  Download, 
  ShoppingBag, 
  DollarSign,
  Boxes,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Cell
} from 'recharts';
import toast from 'react-hot-toast';
import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../types';

export interface TopPerformingProductsCombosProps {
  orders: WebsiteConsolidatedOrder[];
  onViewOrders?: (title: string, matchingOrders: WebsiteConsolidatedOrder[]) => void;
}

export interface ProductPerformanceItem {
  name: string;
  isCombo: boolean;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  averageUnitPrice: number;
  contributionPercent: number;
  overallContributionPercent: number;
  matchingOrders: WebsiteConsolidatedOrder[];
}

/**
 * Authoritative Known Combo Names Catalog
 */
export const KNOWN_COMBO_CATALOG = [
  'DIY Home Care Combo',
  'DIY Laundry Care Combo',
  'DIY Kitchen & Pooja Care Combo',
  'DIY Kitchen Care Combo',
  'DIY Surface Care Combo',
  'DIY Daily Essentials Combo',
  'Kitchen Cleaning Combo',
  'Car Care Combo',
  'Bike Care Combo',
  'DIY Complete Care Combo',
  'DIY Detegent Combo',
  'Magic Complete Care Combo',
  'DIY Dishwash Combo',
  'Magic Home Care Combo',
  'DIY Laundry Combo',
  'Magic Sponge Combo - 12 Pieces'
];

/**
 * Authoritative Rule to Classify Products vs Combos:
 * 1. Matches known combo catalog
 * 2. Product name contains 'combo' (case-insensitive)
 * 3. Product name indicates bundle composition with multiple items joined by '+'
 */
export function isComboItem(productName?: string | null): boolean {
  if (!productName) return false;
  const clean = productName.toLowerCase().trim();
  if (clean.includes('combo')) return true;
  if (clean.includes(' + ') || (clean.includes('+') && (clean.includes('detergent') || clean.includes('dishwash') || clean.includes('cleaner') || clean.includes('sponge')))) {
    return true;
  }
  return KNOWN_COMBO_CATALOG.some(c => c.toLowerCase() === clean);
}

export const TopPerformingProductsCombos: React.FC<TopPerformingProductsCombosProps> = ({
  orders,
  onViewOrders
}) => {
  // Navigation: Top Products vs Top Combos
  const [activeTab, setActiveTab] = useState<'products' | 'combos'>('products');

  // Chart Metric: revenue | quantity | orders
  const [chartMetric, setChartMetric] = useState<'revenue' | 'quantity' | 'orders'>('revenue');

  // Top N limit: 5 | 10 | 20 | 'all'
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);

  // Table sorting
  const [sortField, setSortField] = useState<'revenue' | 'quantity' | 'orders' | 'avgPrice' | 'name' | 'contribution'>('revenue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Product Search query
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Process All Orders Line Items
  const { productsList, combosList, totalProductsRevenue, totalCombosRevenue, totalAllRevenue } = useMemo(() => {
    const pMap = new Map<string, { qty: number; rev: number; ordersSet: Set<string>; ordersList: WebsiteConsolidatedOrder[] }>();
    const cMap = new Map<string, { qty: number; rev: number; ordersSet: Set<string>; ordersList: WebsiteConsolidatedOrder[] }>();

    let sumProdRev = 0;
    let sumComboRev = 0;

    orders.forEach(o => {
      // Exclude cancelled and deleted orders
      if (
        o.order_status === 'CANCELLED' || 
        o.cancellation?.status === 'CANCELLED' || 
        o.fulfillment_status === 'cancelled' ||
        o.order_status === 'DELETED'
      ) {
        return;
      }

      const orderKey = o.order_id || o.id || 'unknown';

      if (Array.isArray(o.items) && o.items.length > 0) {
        o.items.forEach((it: WebsiteOrderItem) => {
          const rawName = (it.product_name || 'Unspecified').trim();
          if (!rawName) return;

          const isCombo = isComboItem(rawName);
          const targetMap = isCombo ? cMap : pMap;

          const qty = Number(it.quantity) || 1;
          const rev = it.line_total != null 
            ? Number(it.line_total) 
            : ((Number(o.price) || 0) / (Number(o.total_quantity) || 1)) * qty;

          if (isCombo) sumComboRev += rev;
          else sumProdRev += rev;

          if (!targetMap.has(rawName)) {
            targetMap.set(rawName, { qty: 0, rev: 0, ordersSet: new Set(), ordersList: [] });
          }
          const entry = targetMap.get(rawName)!;
          entry.qty += qty;
          entry.rev += rev;
          if (!entry.ordersSet.has(orderKey)) {
            entry.ordersSet.add(orderKey);
            entry.ordersList.push(o);
          }
        });
      } else {
        // Fallback to order-level product name if items array is not populated
        const rawName = (o.product_name || 'Unspecified').trim();
        if (!rawName || rawName === 'N/A') return;

        const isCombo = isComboItem(rawName);
        const targetMap = isCombo ? cMap : pMap;

        const qty = Number(o.total_quantity) || 1;
        const rev = Number(o.price) || 0;

        if (isCombo) sumComboRev += rev;
        else sumProdRev += rev;

        if (!targetMap.has(rawName)) {
          targetMap.set(rawName, { qty: 0, rev: 0, ordersSet: new Set(), ordersList: [] });
        }
        const entry = targetMap.get(rawName)!;
        entry.qty += qty;
        entry.rev += rev;
        if (!entry.ordersSet.has(orderKey)) {
          entry.ordersSet.add(orderKey);
          entry.ordersList.push(o);
        }
      }
    });

    const sumAllRev = sumProdRev + sumComboRev;

    const buildItemsList = (map: typeof pMap, isComboTab: boolean, tabTotal: number): ProductPerformanceItem[] => {
      return Array.from(map.entries()).map(([name, data]) => {
        const avgPrice = data.qty > 0 ? data.rev / data.qty : 0;
        const contributionPercent = tabTotal > 0 ? (data.rev / tabTotal) * 100 : 0;
        const overallContributionPercent = sumAllRev > 0 ? (data.rev / sumAllRev) * 100 : 0;

        return {
          name,
          isCombo: isComboTab,
          totalQuantity: data.qty,
          totalRevenue: data.rev,
          orderCount: data.ordersSet.size,
          averageUnitPrice: Math.round(avgPrice),
          contributionPercent,
          overallContributionPercent,
          matchingOrders: data.ordersList
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);
    };

    return {
      productsList: buildItemsList(pMap, false, sumProdRev),
      combosList: buildItemsList(cMap, true, sumComboRev),
      totalProductsRevenue: sumProdRev,
      totalCombosRevenue: sumComboRev,
      totalAllRevenue: sumAllRev
    };
  }, [orders]);

  // Active dataset
  const activeDataset = activeTab === 'products' ? productsList : combosList;
  const activeTabTotalRevenue = activeTab === 'products' ? totalProductsRevenue : totalCombosRevenue;

  // Filtered and sorted items
  const processedItems = useMemo(() => {
    let list = [...activeDataset];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => item.name.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'revenue') cmp = a.totalRevenue - b.totalRevenue;
      else if (sortField === 'quantity') cmp = a.totalQuantity - b.totalQuantity;
      else if (sortField === 'orders') cmp = a.orderCount - b.orderCount;
      else if (sortField === 'avgPrice') cmp = a.averageUnitPrice - b.averageUnitPrice;
      else if (sortField === 'contribution') cmp = a.contributionPercent - b.contributionPercent;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [activeDataset, searchQuery, sortField, sortAsc]);

  // Chart Items: respect top limit
  const chartItems = useMemo(() => {
    const count = topLimit === 'all' ? 20 : topLimit;
    const base = processedItems.slice(0, count);

    // Shorten display name for cleaner chart labeling if very long
    return base.map(item => {
      let displayName = item.name;
      if (displayName.length > 28) {
        displayName = displayName.slice(0, 26) + '…';
      }
      return {
        ...item,
        displayName,
        chartValue: chartMetric === 'revenue' 
          ? Math.round(item.totalRevenue) 
          : chartMetric === 'quantity' 
          ? item.totalQuantity 
          : item.orderCount
      };
    });
  }, [processedItems, topLimit, chartMetric]);

  // Table Items: respect top limit
  const tableItems = useMemo(() => {
    return topLimit === 'all' ? processedItems : processedItems.slice(0, topLimit);
  }, [processedItems, topLimit]);

  // Toggle Sorting helper
  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (processedItems.length === 0) {
      toast.error('No items to export');
      return;
    }

    const headers = [
      'Rank',
      activeTab === 'products' ? 'Product Name' : 'Combo Name',
      'Type',
      'Total Revenue (INR)',
      'Total Quantity Sold (Units)',
      'Orders Containing Item',
      'Avg Selling Price Per Unit (INR)',
      `Contribution to ${activeTab === 'products' ? 'Products' : 'Combos'} Sales (%)`,
      'Contribution to Total Sales (%)'
    ];

    const rows = processedItems.map((item, index) => [
      index + 1,
      `"${item.name.replace(/"/g, '""')}"`,
      item.isCombo ? 'Combo' : 'Individual Product',
      Math.round(item.totalRevenue),
      item.totalQuantity,
      item.orderCount,
      item.averageUnitPrice,
      item.contributionPercent.toFixed(2),
      item.overallContributionPercent.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Top_Performing_${activeTab === 'products' ? 'Products' : 'Combos'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${processedItems.length} items to CSV`);
  };

  // Color scheme per tab
  const barColor = activeTab === 'products' ? '#8b5cf6' : '#ec4899';
  const barHoverColor = activeTab === 'products' ? '#a78bfa' : '#f472b6';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1220] border border-slate-800 shadow-xl space-y-5 select-none">
      
      {/* 1. SECTION HEADER WITH TABS & SEARCH */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Top Performing Products & Combos
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Overall revenue, volume, and order frequency across all completed orders in the selected period.
          </p>
        </div>

        {/* Tab Buttons & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => { setActiveTab('products'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package size={13} />
              <span>Top Products</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'products' ? 'bg-purple-700/60 text-purple-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {productsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('combos'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'combos'
                  ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              <span>Top Combos</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'combos' ? 'bg-pink-700/60 text-pink-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {combosList.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab === 'products' ? 'products' : 'combos'}...`}
              className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-44 sm:w-56"
            />
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export CSV"
            className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY KPI STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Total Revenue in Category */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
              {activeTab === 'products' ? 'Products Revenue' : 'Combos Revenue'}
            </span>
            <DollarSign size={14} className="text-purple-400" />
          </div>
          <div className="text-xl font-black font-mono text-white">
            ₹{Math.round(activeTabTotalRevenue).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {totalAllRevenue > 0 ? `${((activeTabTotalRevenue / totalAllRevenue) * 100).toFixed(1)}% of total sales` : '0%'}
          </div>
        </div>

        {/* Card 2: Total Quantity Sold */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              Units Sold
            </span>
            <ShoppingBag size={14} className="text-cyan-400" />
          </div>
          <div className="text-xl font-black font-mono text-cyan-300">
            {activeDataset.reduce((sum, item) => sum + item.totalQuantity, 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Across {activeDataset.length} unique {activeTab === 'products' ? 'products' : 'combos'}
          </div>
        </div>

        {/* Card 3: Top Item by Revenue */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              #1 Top Contributor
            </span>
            <Sparkles size={14} className="text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={activeDataset[0]?.name || 'N/A'}>
            {activeDataset[0]?.name || 'None'}
          </div>
          <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
            {activeDataset[0] ? `₹${Math.round(activeDataset[0].totalRevenue).toLocaleString('en-IN')} (${activeDataset[0].contributionPercent.toFixed(1)}%)` : '₹0'}
          </div>
        </div>

        {/* Card 4: Catalog Types Count */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-300">
              Catalog Variety
            </span>
            <Boxes size={14} className="text-pink-400" />
          </div>
          <div className="text-xl font-black font-mono text-pink-300">
            {activeDataset.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Active in this period
          </div>
        </div>
      </div>

      {/* 3. CHART CONTROLS BAR: METRIC SWITCHER & TOP N SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/70">
        {/* Metric Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
            Chart Metric:
          </span>
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                chartMetric === 'revenue'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('quantity')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                chartMetric === 'quantity'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Quantity Sold
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('orders')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                chartMetric === 'orders'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Order Count
            </button>
          </div>
        </div>

        {/* Top N Options */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Display:
          </span>
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {[5, 10, 20, 'all'].map(option => (
              <button
                key={String(option)}
                type="button"
                onClick={() => setTopLimit(option as any)}
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                  topLimit === option
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {option === 'all' ? 'All' : `Top ${option}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. HORIZONTAL BAR CHART */}
      <div className="w-full bg-slate-950/40 rounded-xl border border-slate-800/80 p-3 pt-4">
        {chartItems.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-slate-500 text-xs">
            <Info size={20} className="mb-2 text-slate-600" />
            <span>No {activeTab === 'products' ? 'products' : 'combos'} match the selected filters.</span>
          </div>
        ) : (
          <div style={{ height: Math.max(220, chartItems.length * 36) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartItems}
                margin={{ top: 5, right: 35, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={val => 
                    chartMetric === 'revenue' 
                      ? (val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)
                      : val.toLocaleString()
                  }
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  stroke="#cbd5e1"
                  fontSize={11}
                  width={150}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as ProductPerformanceItem;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[210px] backdrop-blur-sm">
                          <p className="font-bold text-white border-b border-slate-800 pb-1">{item.name}</p>
                          <div className="flex justify-between text-emerald-400">
                            <span>Sales Revenue:</span>
                            <span className="font-mono font-bold">₹{Math.round(item.totalRevenue).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between text-cyan-300">
                            <span>Quantity Sold:</span>
                            <span className="font-mono font-bold">{item.totalQuantity.toLocaleString('en-IN')} units</span>
                          </div>
                          <div className="flex justify-between text-purple-300">
                            <span>Order Count:</span>
                            <span className="font-mono font-bold">{item.orderCount.toLocaleString('en-IN')} orders</span>
                          </div>
                          <div className="flex justify-between text-amber-300">
                            <span>Avg Selling Price:</span>
                            <span className="font-mono font-bold">₹{item.averageUnitPrice}</span>
                          </div>
                          <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800 text-[10px]">
                            <span>Category Share:</span>
                            <span className="font-mono font-bold text-white">{item.contributionPercent.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="chartValue" 
                  radius={[0, 4, 4, 0]}
                  animationDuration={400}
                >
                  {chartItems.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? (activeTab === 'products' ? '#a855f7' : '#f43f5e') : barColor} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. DATA TABLE */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th 
                className="py-2.5 px-3 cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('name')}
              >
                <div className="flex items-center gap-1">
                  <span>{activeTab === 'products' ? 'Product Name' : 'Combo Name'}</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('revenue')}
              >
                <div className="flex items-center justify-end gap-1 text-emerald-400">
                  <span>Sales Revenue</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('quantity')}
              >
                <div className="flex items-center justify-center gap-1 text-cyan-300">
                  <span>Quantity Sold</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('orders')}
              >
                <div className="flex items-center justify-center gap-1 text-purple-300">
                  <span>Orders</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('avgPrice')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Avg Price</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('contribution')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>% Share</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              {onViewOrders && (
                <th className="py-2.5 px-3 text-right w-24">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {tableItems.length === 0 ? (
              <tr>
                <td colSpan={onViewOrders ? 8 : 7} className="py-8 text-center text-slate-500">
                  No {activeTab === 'products' ? 'products' : 'combos'} match the current filters.
                </td>
              </tr>
            ) : (
              tableItems.map((item, index) => (
                <tr key={item.name} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      {item.isCombo ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0"></span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                      )}
                      <span className="truncate max-w-[280px]" title={item.name}>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                    ₹{Math.round(item.totalRevenue).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-cyan-300">
                    {item.totalQuantity.toLocaleString('en-IN')} units
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-300">
                    {item.orderCount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                    ₹{item.averageUnitPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs">
                    <span className="text-white font-bold">{item.contributionPercent.toFixed(1)}%</span>
                    <span className="text-slate-500 text-[10px] block">({item.overallContributionPercent.toFixed(1)}% total)</span>
                  </td>
                  {onViewOrders && (
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onViewOrders(`Orders with ${item.name}`, item.matchingOrders)}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Orders
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
  );
};

export default TopPerformingProductsCombos;
