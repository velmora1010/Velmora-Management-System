import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  ArrowUpDown,
  Download,
  Calendar,
  DollarSign,
  ShoppingBag,
  Users,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ComboIntelligenceItem } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';
import { TopNLimitSelector } from '../TopNLimitSelector';
import { TablePaginationControls } from '../TablePaginationControls';

interface ComboIntelligenceTabProps {
  combos: ComboIntelligenceItem[];
  totalCombosRevenue: number;
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const ComboIntelligenceTab: React.FC<ComboIntelligenceTabProps> = ({
  combos,
  totalCombosRevenue,
  onViewOrders
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);
  const [sortField, setSortField] = useState<'revenue' | 'units' | 'repeatBuyers' | 'asp' | 'orders'>('revenue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedComboBreakdown, setSelectedComboBreakdown] = useState<ComboIntelligenceItem | null>(null);

  // 1. Filter and sort
  const processedCombos = useMemo(() => {
    let list = [...combos];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.comboName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'revenue') cmp = a.totalRevenue - b.totalRevenue;
      else if (sortField === 'units') cmp = a.unitsSold - b.unitsSold;
      else if (sortField === 'repeatBuyers') cmp = a.repeatBuyers - b.repeatBuyers;
      else if (sortField === 'asp') cmp = a.averageSellingPrice - b.averageSellingPrice;
      else if (sortField === 'orders') cmp = a.ordersSold - b.ordersSold;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [combos, searchQuery, sortField, sortAsc]);

  // 2. Limit Top N
  const rankedCombos = useMemo(() => {
    return topLimit === 'all' ? processedCombos : processedCombos.slice(0, topLimit);
  }, [processedCombos, topLimit]);

  // 3. Paginate
  const pagedCombos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rankedCombos.slice(start, start + pageSize);
  }, [rankedCombos, currentPage, pageSize]);

  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (processedCombos.length === 0) {
      toast.error('No combos to export');
      return;
    }

    const headers = [
      'Rank',
      'Combo Name',
      'Orders Sold',
      'Units Sold',
      'Total Revenue (INR)',
      'ASP (INR)',
      'Repeat Buyers',
      'Repeat Sales Value (INR)',
      'Contribution to Combos Sales (%)'
    ];

    const rows = processedCombos.map((c, idx) => [
      idx + 1,
      `"${c.comboName.replace(/"/g, '""')}"`,
      c.ordersSold,
      c.unitsSold,
      c.totalRevenue,
      c.averageSellingPrice,
      c.repeatBuyers,
      c.repeatSalesValue,
      c.revenueContributionPercent
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Combo_Performance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${processedCombos.length} combos to CSV`);
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers size={15} className="text-pink-400" />
            Best Performing Combos Intelligence
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified combo packages isolated from single items and multi-item orders.
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
              placeholder="Search combos..."
              className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 w-44 sm:w-56"
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
              <th className="py-2.5 px-3 min-w-[220px]">Combo Name</th>
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
                onClick={() => handleToggleSort('units')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Units Sold</span>
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
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('repeatBuyers')}
              >
                <div className="flex items-center justify-end gap-1 text-indigo-300">
                  <span>Repeat Buyers</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right text-emerald-400">Repeat Sales</th>
              <th className="py-2.5 px-3 text-right text-pink-300">% Share</th>
              <th className="py-2.5 px-3 text-center">Breakdown</th>
              {onViewOrders && <th className="py-2.5 px-3 text-center w-20">Orders</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {pagedCombos.length === 0 ? (
              <tr>
                <td colSpan={onViewOrders ? 11 : 10} className="py-8 text-center text-slate-500 font-sans">
                  No combo packages found.
                </td>
              </tr>
            ) : (
              pagedCombos.map((c, idx) => (
                <tr key={c.canonicalKey} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                    {((currentPage - 1) * pageSize) + idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white font-sans">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
                      <span className="truncate max-w-[260px]" title={c.comboName}>{c.comboName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    ₹{c.totalRevenue.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-300">
                    {c.unitsSold.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-purple-300">
                    {c.ordersSold.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white">
                    ₹{c.averageSellingPrice}
                  </td>
                  <td className="py-2.5 px-3 text-right text-indigo-300 font-bold">
                    {c.repeatBuyers.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">
                    ₹{c.repeatSalesValue.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-pink-300 font-bold">
                    {c.revenueContributionPercent}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedComboBreakdown(prev => prev?.canonicalKey === c.canonicalKey ? null : c)}
                      className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-pink-300 hover:text-white border border-slate-700 text-[10px] font-sans font-medium transition-colors"
                    >
                      {selectedComboBreakdown?.canonicalKey === c.canonicalKey ? 'Hide' : 'Trends'}
                    </button>
                  </td>
                  {onViewOrders && (
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onViewOrders(`Orders with ${c.comboName}`, c.matchingOrders)}
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
          totalRecords={rankedCombos.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          recordLabel="combos"
        />
      </div>

      {/* Monthly & Yearly Breakdown Modal/Card for Selected Combo */}
      {selectedComboBreakdown && (
        <div className="p-4 rounded-xl bg-slate-900 border border-pink-500/50 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-pink-400" />
              <h4 className="text-sm font-bold text-white">
                Monthly & Yearly Performance: <span className="text-pink-300">{selectedComboBreakdown.comboName}</span>
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedComboBreakdown(null)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Monthly Table */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-2">Monthly Sales</span>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="text-slate-500 text-[10px] border-b border-slate-800">
                      <th className="pb-1">Month</th>
                      <th className="pb-1 text-right">Units</th>
                      <th className="pb-1 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {selectedComboBreakdown.monthlyPerformance.map(m => (
                      <tr key={m.monthKey}>
                        <td className="py-1 font-sans text-white">{m.monthLabel}</td>
                        <td className="py-1 text-right text-cyan-300">{m.units}</td>
                        <td className="py-1 text-right text-emerald-400">₹{m.revenue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yearly Table */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-2">Yearly Sales</span>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="text-slate-500 text-[10px] border-b border-slate-800">
                      <th className="pb-1">Year</th>
                      <th className="pb-1 text-right">Units</th>
                      <th className="pb-1 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {selectedComboBreakdown.yearlyPerformance.map(y => (
                      <tr key={y.year}>
                        <td className="py-1 font-sans text-white">{y.year}</td>
                        <td className="py-1 text-right text-cyan-300">{y.units}</td>
                        <td className="py-1 text-right text-emerald-400">₹{y.revenue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboIntelligenceTab;
