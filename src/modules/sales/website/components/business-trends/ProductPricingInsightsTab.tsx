import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  Crown,
  ShoppingBag,
  Sparkles,
  Search,
  ArrowUpDown,
  Download,
  Info,
  Calendar,
  Package,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';
import type { ProductPricingInsightItem, ProductIntelligenceItem } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';
import { calculateProduct12MonthTrend } from './businessTrendsCalculations';
import { TopNLimitSelector } from '../TopNLimitSelector';
import { TablePaginationControls } from '../TablePaginationControls';

interface ProductPricingInsightsTabProps {
  pricingItems: ProductPricingInsightItem[];
  keyInsights: {
    highestRevenueProduct: ProductIntelligenceItem | null;
    mostUnitsSoldProduct: ProductIntelligenceItem | null;
    highestAspProduct: ProductIntelligenceItem | null;
    lowestAspProduct: ProductIntelligenceItem | null;
    strongestRepeatProduct: ProductIntelligenceItem | null;
    highestRevenueContributionProduct: ProductIntelligenceItem | null;
  };
  orders?: WebsiteConsolidatedOrder[];
  selectedYear?: number;
}

export const ProductPricingInsightsTab: React.FC<ProductPricingInsightsTabProps> = ({
  pricingItems,
  keyInsights,
  orders = [],
  selectedYear = 2026
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);
  const [sortField, setSortField] = useState<'asp' | 'revenue' | 'quantity' | 'orders' | 'name'>('asp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Selected product for 12-Month Pricing Dynamics
  const defaultProduct = pricingItems[0]?.productName || '';
  const [selectedProduct, setSelectedProduct] = useState<string>(defaultProduct);

  // 1. Calculate 12-Month Jan-Dec Price & Volume Lifecycle
  const pricing12MonthTrend = useMemo(() => {
    const pName = selectedProduct || pricingItems[0]?.productName;
    if (!pName || orders.length === 0) return [];
    return calculateProduct12MonthTrend(pName, orders, selectedYear);
  }, [selectedProduct, pricingItems, orders, selectedYear]);

  // 2. Filter & Sort Table
  const processedItems = useMemo(() => {
    let list = [...pricingItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.productName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'asp') cmp = a.averageSellingPrice - b.averageSellingPrice;
      else if (sortField === 'revenue') cmp = a.totalRevenue - b.totalRevenue;
      else if (sortField === 'quantity') cmp = a.totalQuantity - b.totalQuantity;
      else if (sortField === 'orders') cmp = a.orderCount - b.orderCount;
      else if (sortField === 'name') cmp = a.productName.localeCompare(b.productName);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [pricingItems, searchQuery, sortField, sortAsc]);

  // 3. Limit Top N
  const rankedItems = useMemo(() => {
    return topLimit === 'all' ? processedItems : processedItems.slice(0, topLimit);
  }, [processedItems, topLimit]);

  // 4. Paginate
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rankedItems.slice(start, start + pageSize);
  }, [rankedItems, currentPage, pageSize]);

  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (processedItems.length === 0) {
      toast.error('No pricing data to export');
      return;
    }

    const headers = [
      'Rank',
      'Product Name',
      'Average Selling Price (INR)',
      'Lowest Selling Price (INR)',
      'Highest Selling Price (INR)',
      'Total Revenue (INR)',
      'Quantity Sold (Units)',
      'Order Count',
      'Units < INR 500',
      'Units INR 500-999',
      'Units INR 1000-1499',
      'Units INR 1500+'
    ];

    const rows = processedItems.map((p, idx) => [
      idx + 1,
      `"${p.productName.replace(/"/g, '""')}"`,
      p.averageSellingPrice,
      p.minSellingPrice,
      p.maxSellingPrice,
      p.totalRevenue,
      p.totalQuantity,
      p.orderCount,
      p.priceDistribution.under500,
      p.priceDistribution.from500to999,
      p.priceDistribution.from1000to1499,
      p.priceDistribution.above1500
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Product_Pricing_Insights_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${processedItems.length} pricing rows to CSV`);
  };

  const activeProductName = selectedProduct || pricingItems[0]?.productName || 'Product';

  return (
    <div className="space-y-5">
      {/* 1. 12-Month Jan-Dec Price Lifecycle & Trends Chart */}
      <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <h4 className="text-sm font-bold text-white">
                12-Month Product Pricing & Sales Lifecycle ({selectedYear})
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict 12-month Jan–Dec trajectory: Average Selling Price (ASP), Min Price, Max Price, and Units Sold.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400">Select Product:</span>
            <select
              value={selectedProduct || (pricingItems[0]?.productName || '')}
              onChange={e => setSelectedProduct(e.target.value)}
              className="h-8 max-w-[260px] px-2.5 bg-slate-900 border border-emerald-500/50 rounded-lg text-white font-medium text-xs cursor-pointer focus:outline-none focus:border-emerald-400 truncate"
            >
              {pricingItems.map(p => (
                <option key={p.productName} value={p.productName}>
                  {p.productName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Composed Chart: Line (ASP, Min, Max) + Bar (Units Sold) */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {activeProductName} — 12-Month Price & Volume
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                Jan → Dec
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Months with 0 sales display N/A for ASP
            </span>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pricing12MonthTrend} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="monthShort" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis yAxisId="price" stroke="#10b981" fontSize={10} tickLine={false} unit="₹" />
                <YAxis yAxisId="units" orientation="right" stroke="#06b6d4" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                          <p className="font-bold text-white mb-1">{d.monthLong} {d.year}</p>
                          {d.hasSales ? (
                            <>
                              <p className="text-purple-300 font-mono">ASP: <span className="font-bold">₹{d.averageSellingPrice}</span></p>
                              <p className="text-emerald-400 font-mono">Min Price: ₹{d.minSellingPrice}</p>
                              <p className="text-amber-400 font-mono">Max Price: ₹{d.maxSellingPrice}</p>
                              <p className="text-cyan-300 font-mono mt-1">Units Sold: <span className="font-bold">{d.quantity}</span></p>
                              <p className="text-slate-300 font-mono">Revenue: ₹{d.revenue.toLocaleString('en-IN')}</p>
                            </>
                          ) : (
                            <p className="text-slate-400 italic">No sales in {d.monthLong} (ASP: N/A)</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="units" dataKey="quantity" name="Units Sold" fill="#06b6d4" opacity={0.35} radius={[3, 3, 0, 0]} />
                <Line yAxisId="price" type="monotone" dataKey="averageSellingPrice" name="Avg Price (ASP ₹)" stroke="#a855f7" strokeWidth={2.5} connectNulls={false} dot={{ r: 3.5 }} />
                <Line yAxisId="price" type="monotone" dataKey="minSellingPrice" name="Lowest Price (₹)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" connectNulls={false} dot={{ r: 2 }} />
                <Line yAxisId="price" type="monotone" dataKey="maxSellingPrice" name="Highest Price (₹)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" connectNulls={false} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. Key Observed Insights Cards (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Card 1: Highest Revenue */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Highest Revenue Generator</span>
            <DollarSign size={15} className="text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.highestRevenueProduct?.productName || 'N/A'}>
            {keyInsights.highestRevenueProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
            ₹{keyInsights.highestRevenueProduct?.totalRevenue.toLocaleString('en-IN') || 0}
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              ({keyInsights.highestRevenueProduct?.revenueContributionPercent || 0}% total sales)
            </span>
          </div>
        </div>

        {/* Card 2: Most Units Sold */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Volume Leader (Units)</span>
            <Package size={15} className="text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.mostUnitsSoldProduct?.productName || 'N/A'}>
            {keyInsights.mostUnitsSoldProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-cyan-400 mt-1">
            {keyInsights.mostUnitsSoldProduct?.totalQuantity.toLocaleString('en-IN') || 0} units
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              in {keyInsights.mostUnitsSoldProduct?.orderCount || 0} orders
            </span>
          </div>
        </div>

        {/* Card 3: Highest ASP */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Highest Price Point (ASP)</span>
            <Crown size={15} className="text-purple-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.highestAspProduct?.productName || 'N/A'}>
            {keyInsights.highestAspProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-purple-400 mt-1">
            ₹{keyInsights.highestAspProduct?.averageSellingPrice || 0}
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              (₹{keyInsights.highestAspProduct?.minSellingPrice} – ₹{keyInsights.highestAspProduct?.maxSellingPrice})
            </span>
          </div>
        </div>

        {/* Card 4: Lowest ASP */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Entry / Lowest Price Point</span>
            <ShoppingBag size={15} className="text-amber-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.lowestAspProduct?.productName || 'N/A'}>
            {keyInsights.lowestAspProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-amber-400 mt-1">
            ₹{keyInsights.lowestAspProduct?.averageSellingPrice || 0}
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              (Volume: {keyInsights.lowestAspProduct?.totalQuantity || 0} units)
            </span>
          </div>
        </div>

        {/* Card 5: Strongest Repeat Product */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Top Repeat Purchase Product</span>
            <Sparkles size={15} className="text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.strongestRepeatProduct?.productName || 'N/A'}>
            {keyInsights.strongestRepeatProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-indigo-300 mt-1">
            {keyInsights.strongestRepeatProduct?.repeatBuyers || 0} repeat buyers
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              (₹{keyInsights.strongestRepeatProduct?.repeatSalesValue.toLocaleString('en-IN') || 0})
            </span>
          </div>
        </div>

        {/* Card 6: Top Combo Flagship */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">Key Revenue Driver</span>
            <Award size={15} className="text-pink-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.highestRevenueContributionProduct?.productName || 'N/A'}>
            {keyInsights.highestRevenueContributionProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-pink-400 mt-1">
            {keyInsights.highestRevenueContributionProduct?.revenueContributionPercent || 0}% Revenue Contribution
          </div>
        </div>
      </div>

      {/* 3. Product Pricing Distribution Table Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign size={15} className="text-emerald-400" />
            Product Price Distribution & Band Analysis
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Unit sales breakdown across pricing tiers (&lt;₹500, ₹500–999, ₹1,000–1,499, and ₹1,500+).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search pricing items..."
              className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
            />
          </div>

          {/* Top N Selector */}
          <TopNLimitSelector
            limit={topLimit}
            onChange={lim => {
              setTopLimit(lim);
              setCurrentPage(1);
            }}
          />

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* 4. Comprehensive Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3 text-center w-12">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Product Name</th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('asp')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Avg Price (ASP)</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right text-slate-400">Lowest Price</th>
              <th className="py-2.5 px-3 text-right text-slate-400">Highest Price</th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('revenue')}
              >
                <div className="flex items-center justify-end gap-1 text-emerald-400">
                  <span>Revenue</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('quantity')}
              >
                <div className="flex items-center justify-end gap-1 text-cyan-300">
                  <span>Units</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right text-purple-300">Orders</th>
              <th className="py-2.5 px-3 text-center text-slate-400 min-w-[220px]">Price Distribution (&lt;500 | 500-999 | 1k-1.5k | 1.5k+)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {pagedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                  No products found.
                </td>
              </tr>
            ) : (
              pagedItems.map((p, idx) => (
                <tr
                  key={p.productName}
                  onClick={() => setSelectedProduct(p.productName)}
                  className={`transition-colors cursor-pointer ${selectedProduct === p.productName ? 'bg-emerald-950/40 border-l-2 border-emerald-500' : 'hover:bg-slate-900/60'}`}
                >
                  <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                    {((currentPage - 1) * pageSize) + idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white font-sans">
                    <span className="truncate max-w-[240px] block" title={p.productName}>{p.productName}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    ₹{p.averageSellingPrice}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-300">
                    ₹{p.minSellingPrice}
                  </td>
                  <td className="py-2.5 px-3 text-right text-purple-300">
                    ₹{p.maxSellingPrice}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    ₹{p.totalRevenue.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-300">
                    {p.totalQuantity.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-purple-300">
                    {p.orderCount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-center text-[10px] text-slate-300">
                    <div className="flex items-center justify-center gap-1 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400" title="< ₹500">
                        {p.priceDistribution.under500}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300" title="₹500 - ₹999">
                        {p.priceDistribution.from500to999}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300" title="₹1,000 - ₹1,499">
                        {p.priceDistribution.from1000to1499}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300" title="₹1,500+">
                        {p.priceDistribution.above1500}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <TablePaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalRecords={rankedItems.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          recordLabel="pricing rows"
        />
      </div>
    </div>
  );
};

export default ProductPricingInsightsTab;
