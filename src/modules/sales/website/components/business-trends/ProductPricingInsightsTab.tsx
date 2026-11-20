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
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ProductPricingInsightItem, ProductIntelligenceItem } from './businessTrendsTypes';
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
}

export const ProductPricingInsightsTab: React.FC<ProductPricingInsightsTabProps> = ({
  pricingItems,
  keyInsights
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);
  const [sortField, setSortField] = useState<'asp' | 'revenue' | 'quantity' | 'orders' | 'name'>('asp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 1. Filter and sort
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

  // 2. Limit Top N
  const rankedItems = useMemo(() => {
    return topLimit === 'all' ? processedItems : processedItems.slice(0, topLimit);
  }, [processedItems, topLimit]);

  // 3. Paginate
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

  return (
    <div className="space-y-5">
      {/* 1. Key Observed Insights Cards (6 Cards) */}
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Most Units Sold</span>
            <ShoppingBag size={15} className="text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.mostUnitsSoldProduct?.productName || 'N/A'}>
            {keyInsights.mostUnitsSoldProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-cyan-400 mt-1">
            {keyInsights.mostUnitsSoldProduct?.totalQuantity.toLocaleString('en-IN') || 0} units
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              ({keyInsights.mostUnitsSoldProduct?.orderCount || 0} orders)
            </span>
          </div>
        </div>

        {/* Card 3: Highest ASP */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Highest Average Selling Price</span>
            <Crown size={15} className="text-purple-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.highestAspProduct?.productName || 'N/A'}>
            {keyInsights.highestAspProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-purple-300 mt-1">
            ₹{keyInsights.highestAspProduct?.averageSellingPrice || 0} ASP
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              (Range ₹{keyInsights.highestAspProduct?.minSellingPrice} – ₹{keyInsights.highestAspProduct?.maxSellingPrice})
            </span>
          </div>
        </div>

        {/* Card 4: Lowest ASP */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Lowest Average Selling Price</span>
            <Award size={15} className="text-amber-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.lowestAspProduct?.productName || 'N/A'}>
            {keyInsights.lowestAspProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-amber-300 mt-1">
            ₹{keyInsights.lowestAspProduct?.averageSellingPrice || 0} ASP
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              (Entry-level pricing)
            </span>
          </div>
        </div>

        {/* Card 5: Strongest Repeat Performance */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Strongest Repeat Purchase</span>
            <Sparkles size={15} className="text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.strongestRepeatProduct?.productName || 'N/A'}>
            {keyInsights.strongestRepeatProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-indigo-300 mt-1">
            ₹{keyInsights.strongestRepeatProduct?.repeatSalesValue.toLocaleString('en-IN') || 0}
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              ({keyInsights.strongestRepeatProduct?.repeatBuyers || 0} repeat buyers)
            </span>
          </div>
        </div>

        {/* Card 6: Highest % Revenue Contribution */}
        <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">Top Revenue Contribution %</span>
            <TrendingUp size={15} className="text-pink-400" />
          </div>
          <div className="text-sm font-bold text-white truncate" title={keyInsights.highestRevenueContributionProduct?.productName || 'N/A'}>
            {keyInsights.highestRevenueContributionProduct?.productName || 'N/A'}
          </div>
          <div className="text-xs font-mono font-bold text-pink-400 mt-1">
            {keyInsights.highestRevenueContributionProduct?.revenueContributionPercent || 0}%
            <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">
              of entire store sales
            </span>
          </div>
        </div>
      </div>

      {/* 2. Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign size={15} className="text-emerald-400" />
            Product Pricing Insights & Bracket Performance
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Average, lowest, and highest realized selling prices with unit price range distributions.
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
              placeholder="Search products..."
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

      {/* 3. Pricing Table */}
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
                <tr key={p.productName} className="hover:bg-slate-900/60 transition-colors">
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
