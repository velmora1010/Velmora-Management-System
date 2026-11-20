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
  Package,
  TrendingUp
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
import type { ComboIntelligenceItem, ComboMonthlyTrendPoint } from './businessTrendsTypes';
import type { WebsiteConsolidatedOrder } from '../../types';
import { calculateCombo12MonthTrend } from './businessTrendsCalculations';
import { TopNLimitSelector } from '../TopNLimitSelector';
import { TablePaginationControls } from '../TablePaginationControls';

interface ComboIntelligenceTabProps {
  combos: ComboIntelligenceItem[];
  totalCombosRevenue: number;
  orders?: WebsiteConsolidatedOrder[];
  selectedYear?: number;
  onViewOrders?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const ComboIntelligenceTab: React.FC<ComboIntelligenceTabProps> = ({
  combos,
  totalCombosRevenue,
  orders = [],
  selectedYear = 2026,
  onViewOrders
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number | 'all'>(10);
  const [sortField, setSortField] = useState<'revenue' | 'units' | 'repeatBuyers' | 'asp' | 'orders'>('revenue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Combo Selection for 12-Month Trend & Comparison
  const defaultCombo = combos[0]?.comboName || '';
  const [selectedCombo, setSelectedCombo] = useState<string>(defaultCombo);
  const [compareCombo, setCompareCombo] = useState<string>('');

  // 1. Calculate 12-Month Jan-Dec Trend for selected combo(s)
  const comboA12MonthTrend = useMemo(() => {
    const cName = selectedCombo || combos[0]?.comboName;
    if (!cName || orders.length === 0) return [];
    return calculateCombo12MonthTrend(cName, orders, selectedYear);
  }, [selectedCombo, combos, orders, selectedYear]);

  const comboB12MonthTrend = useMemo(() => {
    if (!compareCombo || orders.length === 0) return null;
    return calculateCombo12MonthTrend(compareCombo, orders, selectedYear);
  }, [compareCombo, orders, selectedYear]);

  // Combined chart data
  const chartTrendData = useMemo(() => {
    return comboA12MonthTrend.map((ptA, idx) => {
      const ptB = comboB12MonthTrend ? comboB12MonthTrend[idx] : null;
      return {
        monthShort: ptA.monthShort,
        monthLong: ptA.monthLong,
        year: ptA.year,
        // Combo A
        ordersA: ptA.orders,
        qtyA: ptA.quantity,
        revA: ptA.revenue,
        repeatBuyersA: ptA.repeatBuyers,
        hasSalesA: ptA.hasSales,
        // Combo B
        ordersB: ptB ? ptB.orders : 0,
        qtyB: ptB ? ptB.quantity : 0,
        revB: ptB ? ptB.revenue : 0,
        repeatBuyersB: ptB ? ptB.repeatBuyers : 0,
        hasSalesB: ptB ? ptB.hasSales : false
      };
    });
  }, [comboA12MonthTrend, comboB12MonthTrend]);

  // 2. Filter & Sort Table
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

  // 3. Limit Top N
  const rankedCombos = useMemo(() => {
    return topLimit === 'all' ? processedCombos : processedCombos.slice(0, topLimit);
  }, [processedCombos, topLimit]);

  // 4. Paginate
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

  const activeComboAName = selectedCombo || combos[0]?.comboName || 'Selected Combo';

  return (
    <div className="space-y-5">
      {/* 1. Combo Selector for 12-Month Jan-Dec Trends */}
      <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-pink-400" />
              <h4 className="text-sm font-bold text-white">
                12-Month Combo Performance Intelligence ({selectedYear})
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect verified combo 12-month Jan–Dec trajectory (orders, units, revenue, repeat buyers) or compare two combos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Combo Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Combo:</span>
              <select
                value={selectedCombo || (combos[0]?.comboName || '')}
                onChange={e => setSelectedCombo(e.target.value)}
                className="h-8 max-w-[220px] px-2.5 bg-slate-900 border border-pink-500/50 rounded-lg text-white font-medium text-xs cursor-pointer focus:outline-none focus:border-pink-400 truncate"
              >
                {combos.map(c => (
                  <option key={c.canonicalKey} value={c.comboName}>
                    {c.comboName}
                  </option>
                ))}
              </select>
            </div>

            {/* Compare Combo Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Compare with:</span>
              <select
                value={compareCombo}
                onChange={e => setCompareCombo(e.target.value)}
                className="h-8 max-w-[220px] px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-medium text-xs cursor-pointer focus:outline-none focus:border-cyan-400 truncate"
              >
                <option value="">(None - Single Combo)</option>
                {combos
                  .filter(c => c.comboName !== selectedCombo)
                  .map(c => (
                    <option key={c.canonicalKey} value={c.comboName}>
                      {c.comboName}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* 12-Month Trend Charts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {/* Chart 1: Monthly Orders Sold */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag size={12} className="text-pink-400" />
                Monthly Orders Sold
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
                            <p className="text-pink-400 font-mono">{activeComboAName}: <span className="font-bold">{d.ordersA} orders</span></p>
                            {compareCombo && (
                              <p className="text-cyan-400 font-mono">{compareCombo}: <span className="font-bold">{d.ordersB} orders</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareCombo && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Bar dataKey="ordersA" name={activeComboAName} fill="#ec4899" radius={[3, 3, 0, 0]} />
                  {compareCombo && <Bar dataKey="ordersB" name={compareCombo} fill="#06b6d4" radius={[3, 3, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Monthly Units Sold */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <Package size={12} className="text-purple-400" />
                Monthly Units Sold
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
                            <p className="text-purple-300 font-mono">{activeComboAName}: <span className="font-bold">{d.qtyA} units</span></p>
                            {compareCombo && (
                              <p className="text-cyan-300 font-mono">{compareCombo}: <span className="font-bold">{d.qtyB} units</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareCombo && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Bar dataKey="qtyA" name={activeComboAName} fill="#a855f7" radius={[3, 3, 0, 0]} />
                  {compareCombo && <Bar dataKey="qtyB" name={compareCombo} fill="#06b6d4" radius={[3, 3, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Monthly Sales Revenue */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-400" />
                Monthly Revenue
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
                            <p className="text-emerald-400 font-mono">{activeComboAName}: <span className="font-bold">₹{d.revA.toLocaleString('en-IN')}</span></p>
                            {compareCombo && (
                              <p className="text-cyan-400 font-mono">{compareCombo}: <span className="font-bold">₹{d.revB.toLocaleString('en-IN')}</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareCombo && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Line type="monotone" dataKey="revA" name={activeComboAName} stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} />
                  {compareCombo && <Line type="monotone" dataKey="revB" name={compareCombo} stroke="#06b6d4" strokeWidth={2} dot={{ r: 2.5 }} />}
                </LineChart>
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
                            <p className="text-indigo-300 font-mono">{activeComboAName}: <span className="font-bold">{d.repeatBuyersA} repeat buyers</span></p>
                            {compareCombo && (
                              <p className="text-amber-300 font-mono">{compareCombo}: <span className="font-bold">{d.repeatBuyersB} repeat buyers</span></p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {compareCombo && <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                  <Line type="monotone" dataKey="repeatBuyersA" name={activeComboAName} stroke="#818cf8" strokeWidth={2} dot={{ r: 2.5 }} />
                  {compareCombo && <Line type="monotone" dataKey="repeatBuyersB" name={compareCombo} stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ranked Combo Intelligence Table Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers size={15} className="text-pink-400" />
            Verified Combo Packages Performance
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

      {/* 3. Comprehensive Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3 text-center w-12">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Combo Name</th>
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
              <th 
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                onClick={() => handleToggleSort('repeatBuyers')}
              >
                <div className="flex items-center justify-end gap-1 text-pink-300">
                  <span>Repeat Buyers</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right text-emerald-400">Repeat Sales</th>
              <th className="py-2.5 px-3 text-right text-pink-300 font-bold">% Share</th>
              {onViewOrders && <th className="py-2.5 px-3 text-center w-20">Orders</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {pagedCombos.length === 0 ? (
              <tr>
                <td colSpan={onViewOrders ? 10 : 9} className="py-8 text-center text-slate-500 font-sans">
                  No combo packages found.
                </td>
              </tr>
            ) : (
              pagedCombos.map((c, idx) => (
                <tr
                  key={c.canonicalKey}
                  onClick={() => setSelectedCombo(c.comboName)}
                  className={`transition-colors cursor-pointer ${selectedCombo === c.comboName ? 'bg-pink-950/40 border-l-2 border-pink-500' : 'hover:bg-slate-900/60'}`}
                >
                  <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                    {((currentPage - 1) * pageSize) + idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white font-sans">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
                      <span className="truncate max-w-[240px]" title={c.comboName}>{c.comboName}</span>
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
                  <td className="py-2.5 px-3 text-right text-pink-300 font-bold">
                    {c.repeatBuyers.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">
                    ₹{c.repeatSalesValue.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-pink-300 font-bold">
                    {c.revenueContributionPercent}%
                  </td>
                  {onViewOrders && (
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOrders(`Orders containing combo: ${c.comboName}`, c.matchingOrders);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-pink-300 hover:text-white border border-slate-700 text-[10px] font-sans font-medium transition-colors"
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
    </div>
  );
};

export default ComboIntelligenceTab;
