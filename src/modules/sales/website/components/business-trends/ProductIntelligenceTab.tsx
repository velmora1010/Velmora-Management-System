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
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ProductIntelligenceItem } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';
import { TopNLimitSelector } from '../TopNLimitSelector';
import { TablePaginationControls } from '../TablePaginationControls';

interface ProductIntelligenceTabProps {
  products: ProductIntelligenceItem[];
  totalAllRevenue: number;
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const ProductIntelligenceTab: React.FC<ProductIntelligenceTabProps> = ({
  products,
  totalAllRevenue,
  onViewOrders
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);
  const [sortField, setSortField] = useState<'revenue' | 'quantity' | 'repeatBuyers' | 'asp' | 'orders'>('revenue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 1. Filter by search & sort
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

  // 2. Limit by Top N
  const rankedProducts = useMemo(() => {
    return topLimit === 'all' ? processedProducts : processedProducts.slice(0, topLimit);
  }, [processedProducts, topLimit]);

  // 3. Paginate
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

  return (
    <div className="space-y-4">
      {/* Header controls: Search, Sort, Limit, Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Package size={15} className="text-purple-400" />
            Product Intelligence & Line-Item Economics
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

      {/* Table */}
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
                <tr key={p.canonicalKey} className="hover:bg-slate-900/60 transition-colors">
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
                        onClick={() => onViewOrders(`Orders containing ${p.productName}`, p.matchingOrders)}
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
