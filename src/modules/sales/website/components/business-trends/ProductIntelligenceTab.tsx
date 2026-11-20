import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  ArrowUpDown,
  Calendar,
  DollarSign,
  ShoppingBag,
  Users,
  Repeat,
  Download,
  TrendingUp,
  GitCompare,
  BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';
import type { ProductIntelligenceItem, ProductMonthlyTrendPoint } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';
import { calculateProduct12MonthTrend } from './businessTrendsCalculations';
import { TopNLimitSelector } from '../TopNLimitSelector';
import { TablePaginationControls } from '../TablePaginationControls';

interface ProductIntelligenceTabProps {
  products: ProductIntelligenceItem[];
  totalAllRevenue: number;
  orders?: WebsiteConsolidatedOrder[];
  selectedYear?: number;
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const ProductIntelligenceTab: React.FC<ProductIntelligenceTabProps> = ({
  products,
  totalAllRevenue,
  orders = [],
  selectedYear = 2026,
  onViewOrders
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);
  const [sortField, setSortField] = useState<'revenue' | 'quantity' | 'repeatBuyers' | 'asp' | 'orders'>('revenue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Product Selection for 12-month Trend & Comparison
  const defaultProduct = products[0]?.productName || '';
  const [selectedProduct, setSelectedProduct] = useState<string>(defaultProduct);
  const [compareProduct, setCompareProduct] = useState<string>('');

  // 1. Calculate 12-Month Jan-Dec Trend for selected product(s)
  const productA12MonthTrend = useMemo(() => {
    const prodName = selectedProduct || products[0]?.productName;
    if (!prodName || orders.length === 0) return [];
    return calculateProduct12MonthTrend(prodName, orders, selectedYear);
  }, [selectedProduct, products, orders, selectedYear]);

  const productB12MonthTrend = useMemo(() => {
    if (!compareProduct || orders.length === 0) return null;
    return calculateProduct12MonthTrend(compareProduct, orders, selectedYear);
  }, [compareProduct, orders, selectedYear]);

  // Combined chart data for side-by-side or single product
  const chartTrendData = useMemo(() => {
    return productA12MonthTrend.map((ptA, idx) => {
      const ptB = productB12MonthTrend ? productB12MonthTrend[idx] : null;
      return {
        monthShort: ptA.monthShort,
        monthLong: ptA.monthLong,
        year: ptA.year,
        // Product A metrics
        qtyA: ptA.quantity,
        revA: ptA.revenue,
        ordersA: ptA.orderCount,
        repeatBuyersA: ptA.repeatBuyers,
        aspA: ptA.averageSellingPrice,
        hasSalesA: ptA.hasSales,
        // Product B metrics (if comparing)
        qtyB: ptB ? ptB.quantity : 0,
        revB: ptB ? ptB.revenue : 0,
        ordersB: ptB ? ptB.orderCount : 0,
        repeatBuyersB: ptB ? ptB.repeatBuyers : 0,
        aspB: ptB ? ptB.averageSellingPrice : null,
        hasSalesB: ptB ? ptB.hasSales : false
      };
    });
  }, [productA12MonthTrend, productB12MonthTrend]);

  // 2. Filter & Sort Table
  const processedProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.productName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'revenue') cmp = a.totalRevenue - b.totalRevenue;
      else if (sortField === 'quantity') cmp = a.totalQuantity - b.totalQuantity;
      else if (sortField === 'repeatBuyers') cmp = a.repeatBuyers - b.repeatBuyers;
      else if (sortField === 'asp') cmp = a.averageSellingPrice - b.averageSellingPrice;
      else if (sortField === 'orders') cmp = a.orderCount - b.orderCount;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [products, searchQuery, sortField, sortAsc]);

  // 3. Limit by Top N
  const rankedProducts = useMemo(() => {
    return topLimit === 'all' ? processedProducts : processedProducts.slice(0, topLimit);
  }, [processedProducts, topLimit]);

  // 4. Paginate
  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rankedProducts.slice(start, start + pageSize);
  }, [rankedProducts, currentPage, pageSize]);

  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (processedProducts.length === 0) {
      toast.error('No products to export');
      return;
    }

    const headers = [
      'Rank',
      'Product Name',
      'Type',
      'Orders Containing Product',
      'Total Quantity Sold',
      'Total Sales Revenue (INR)',
      'ASP (INR)',
      'Min Price (INR)',
      'Max Price (INR)',
      'Repeat Buyers',
      'Repeat Quantity',
      'Repeat Sales Value (INR)',
      'Revenue Share (%)',
      'First Purchase Date',
      'Last Purchase Date'
    ];

    const rows = processedProducts.map((p, idx) => [
      idx + 1,
      `"${p.productName.replace(/"/g, '""')}"`,
      p.isCombo ? 'Combo' : 'Individual Product',
      p.orderCount,
      p.totalQuantity,
      p.totalRevenue,
      p.averageSellingPrice,
      p.minSellingPrice,
      p.maxSellingPrice,
      p.repeatBuyers,
      p.repeatQuantity,
      p.repeatSalesValue,
      p.revenueContributionPercent,
      `"${p.firstPurchaseDate}"`,
      `"${p.lastPurchaseDate}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Product_Intelligence_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${processedProducts.length} products to CSV`);
  };

  const activeProductAName = selectedProduct || products[0]?.productName || 'Selected Product';

  return (
    <div className="space-y-5">
      {/* 1. Product Selector for 12-Month Jan-Dec Trends */}
      <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-400" />
              <h4 className="text-sm font-bold text-white">
                12-Month Product Performance Intelligence ({selectedYear})
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect full 12-month Jan–Dec trajectory (volume, revenue, orders, repeat buyers, ASP) or compare two products.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Product Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Product:</span>
              <select
                value={selectedProduct || (products[0]?.productName || '')}
                onChange={e => setSelectedProduct(e.target.value)}
                className="h-8 max-w-[220px] px-2.5 bg-slate-900 border border-purple-500/50 rounded-lg text-white font-medium text-xs cursor-pointer focus:outline-none focus:border-purple-400 truncate"
              >
                {products.map(p => (
                  <option key={p.canonicalKey} value={p.productName}>
                    {p.productName}
                  </option>
                ))}
              </select>
            </div>

            {/* Compare Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Compare with:</span>
              <select
                value={compareProduct}
                onChange={e => setCompareProduct(e.target.value)}
                className="h-8 max-w-[220px] px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-medium text-xs cursor-pointer focus:outline-none focus:border-cyan-400 truncate"
              >
                <option value="">(None - Single Product)</option>
                {products
                  .filter(p => p.productName !== selectedProduct)
                  .map(p => (
                    <option key={p.canonicalKey} value={p.productName}>
                      {p.productName}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* 12-Month Trend Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          {/* Chart 1: Monthly Quantity Sold */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <Package size={12} className="text-cyan-400" />
                Monthly Quantity Sold
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Units</span>
            </div>
            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="monthShort" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow text-xs">
                            <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                            <p className="text-purple-300 font-mono">{activeProductAName}: <span className="font-bold">{d.qtyA} units</span></p>
                            {compareProduct && (
                              <p className="text-cyan-300 font-mono">{compareProduct}: <span className="font-bold">{d.qtyB} units</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareProduct && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Bar dataKey="qtyA" name={activeProductAName} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  {compareProduct && <Bar dataKey="qtyB" name={compareProduct} fill="#06b6d4" radius={[3, 3, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Monthly Revenue */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-400" />
                Monthly Sales Revenue
              </span>
              <span className="text-[10px] text-slate-500 font-mono">₹</span>
            </div>
            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartTrendData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="monthShort" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow text-xs">
                            <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                            <p className="text-emerald-400 font-mono">{activeProductAName}: <span className="font-bold">₹{d.revA.toLocaleString('en-IN')}</span></p>
                            {compareProduct && (
                              <p className="text-cyan-400 font-mono">{compareProduct}: <span className="font-bold">₹{d.revB.toLocaleString('en-IN')}</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareProduct && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Line type="monotone" dataKey="revA" name={activeProductAName} stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} />
                  {compareProduct && <Line type="monotone" dataKey="revB" name={compareProduct} stroke="#06b6d4" strokeWidth={2} dot={{ r: 2.5 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Monthly Orders Containing Product */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag size={12} className="text-indigo-400" />
                Orders Containing Product
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Count</span>
            </div>
            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="monthShort" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow text-xs">
                            <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                            <p className="text-indigo-300 font-mono">{activeProductAName}: <span className="font-bold">{d.ordersA} orders</span></p>
                            {compareProduct && (
                              <p className="text-amber-300 font-mono">{compareProduct}: <span className="font-bold">{d.ordersB} orders</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareProduct && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Bar dataKey="ordersA" name={activeProductAName} fill="#6366f1" radius={[3, 3, 0, 0]} />
                  {compareProduct && <Bar dataKey="ordersB" name={compareProduct} fill="#f59e0b" radius={[3, 3, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Monthly Repeat Buyers */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <Users size={12} className="text-indigo-300" />
                Monthly Repeat Buyers
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Loyalty</span>
            </div>
            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="monthShort" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow text-xs">
                            <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                            <p className="text-indigo-300 font-mono">{activeProductAName}: <span className="font-bold">{d.repeatBuyersA} repeat buyers</span></p>
                            {compareProduct && (
                              <p className="text-pink-300 font-mono">{compareProduct}: <span className="font-bold">{d.repeatBuyersB} repeat buyers</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareProduct && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Line type="monotone" dataKey="repeatBuyersA" name={activeProductAName} stroke="#818cf8" strokeWidth={2} dot={{ r: 2.5 }} />
                  {compareProduct && <Line type="monotone" dataKey="repeatBuyersB" name={compareProduct} stroke="#ec4899" strokeWidth={2} dot={{ r: 2.5 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: Monthly ASP (Average Selling Price) */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 md:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <BarChart2 size={12} className="text-purple-400" />
                Monthly Average Selling Price (ASP)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">₹ (N/A for zero-sales months)</span>
            </div>
            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="monthShort" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow text-xs">
                            <p className="font-bold text-white">{d.monthLong} {d.year}</p>
                            <p className="text-purple-300 font-mono mt-0.5">
                              {activeProductAName} ASP:{' '}
                              <span className="font-bold">{d.hasSalesA && d.aspA != null ? `₹${d.aspA}` : 'N/A (No sales)'}</span>
                            </p>
                            {compareProduct && (
                              <p className="text-amber-300 font-mono mt-0.5">
                                {compareProduct} ASP:{' '}
                                <span className="font-bold">{d.hasSalesB && d.aspB != null ? `₹${d.aspB}` : 'N/A (No sales)'}</span>
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareProduct && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Line
                    type="monotone"
                    dataKey="aspA"
                    name={`${activeProductAName} ASP`}
                    stroke="#a855f7"
                    strokeWidth={2}
                    connectNulls={false}
                    dot={{ r: 3 }}
                  />
                  {compareProduct && (
                    <Line
                      type="monotone"
                      dataKey="aspB"
                      name={`${compareProduct} ASP`}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      connectNulls={false}
                      dot={{ r: 3 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ranked Product Intelligence Table Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Package size={15} className="text-purple-400" />
            Product Economics & Line-Item Aggregation Table
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Accurate line-item aggregation: orders, volume, revenue, ASP, repeat buyers and lifecycle dates.
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
              className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-44 sm:w-56"
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

      {/* 3. Comprehensive Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3 text-center w-12">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Product Name</th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('revenue')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Revenue</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('quantity')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Units</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('orders')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Orders</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('asp')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>ASP</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right text-slate-400">Min / Max</th>
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('repeatBuyers')}
              >
                <div className="flex items-center justify-end gap-1 text-indigo-300">
                  <span>Repeat Buyers</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right text-cyan-300">Repeat Qty</th>
              <th className="py-2.5 px-3 text-right text-emerald-400">Repeat Sales</th>
              <th className="py-2.5 px-3 text-right text-purple-300">% Share</th>
              <th className="py-2.5 px-3 text-center text-slate-400 min-w-[150px]">Lifecycle Dates</th>
              {onViewOrders && <th className="py-2.5 px-3 text-center w-20">Orders</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {pagedProducts.length === 0 ? (
              <tr>
                <td colSpan={onViewOrders ? 13 : 12} className="py-8 text-center text-slate-500 font-sans">
                  No products found.
                </td>
              </tr>
            ) : (
              pagedProducts.map((p, idx) => (
                <tr
                  key={p.canonicalKey}
                  onClick={() => setSelectedProduct(p.productName)}
                  className={`transition-colors cursor-pointer ${selectedProduct === p.productName ? 'bg-purple-950/40 border-l-2 border-purple-500' : 'hover:bg-slate-900/60'}`}
                >
                  <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                    {((currentPage - 1) * pageSize) + idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white font-sans">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isCombo ? 'bg-pink-400' : 'bg-purple-400'} shrink-0`} />
                      <span className="truncate max-w-[240px]" title={p.productName}>{p.productName}</span>
                    </div>
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
                  <td className="py-2.5 px-3 text-right text-white">
                    ₹{p.averageSellingPrice}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                    ₹{p.minSellingPrice} – ₹{p.maxSellingPrice}
                  </td>
                  <td className="py-2.5 px-3 text-right text-indigo-300 font-bold">
                    {p.repeatBuyers.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-300">
                    {p.repeatQuantity.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">
                    ₹{p.repeatSalesValue.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-purple-300 font-bold">
                    {p.revenueContributionPercent}%
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400 text-[10px] font-sans">
                    <span>{p.firstPurchaseDate}</span>
                    <span className="text-slate-600 mx-1">→</span>
                    <span>{p.lastPurchaseDate}</span>
                  </td>
                  {onViewOrders && (
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOrders(`Orders containing ${p.productName}`, p.matchingOrders);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-slate-700 text-[10px] font-sans font-medium transition-colors"
                      >
                        View
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <TablePaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalRecords={rankedProducts.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          recordLabel="products"
        />
      </div>
    </div>
  );
};

export default ProductIntelligenceTab;
