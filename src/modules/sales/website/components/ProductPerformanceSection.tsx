import React, { useState, useMemo } from 'react';
import { 
  Package, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Eye, 
  Sparkles, 
  ArrowRight,
  Layers
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../types';
import { ProductDetailModal } from './ProductDetailModal';

interface ProductPerformanceSectionProps {
  orders: WebsiteConsolidatedOrder[];
  onSelectOrder?: (order: WebsiteConsolidatedOrder) => void;
}

interface ProductStat {
  name: string;
  units: number;
  ordersCount: number;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  revenueShare: number;
}

const PRODUCT_COLORS = [
  '#8b5cf6', // Violet/Purple
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#64748b'  // Others
];

export const ProductPerformanceSection: React.FC<ProductPerformanceSectionProps> = ({
  orders,
  onSelectOrder
}) => {
  const [metricView, setMetricView] = useState<'revenue' | 'quantity'>('revenue');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof ProductStat>('netRevenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected product for modal inspection
  const [selectedProductForModal, setSelectedProductForModal] = useState<string | null>(null);

  // --- AGGREGATE PRODUCT STATS ---
  const { productStats, totalUnitsSold, totalProductRevenue, topProduct, combosList } = useMemo(() => {
    const map = new Map<string, {
      name: string;
      units: number;
      ordersSet: Set<string>;
      grossRevenue: number;
      discounts: number;
      refunds: number;
    }>();

    let totalUnits = 0;
    let totalGross = 0;

    // Combinations map: Pair -> { count, revenue }
    const pairMap = new Map<string, { pair: string; count: number; revenue: number }>();

    orders.forEach(o => {
      const isCancelled = o.order_status === 'CANCELLED' || (o.fulfillment_status || '').toLowerCase() === 'cancelled';
      const orderPrice = Number(o.price) || 0;

      // Extract unique distinct products in this order for combo analysis
      const distinctOrderProds = new Set<string>();

      if (o.items && o.items.length > 0) {
        o.items.forEach(it => {
          const pName = (it.product_name || 'Unspecified').trim();
          distinctOrderProds.add(pName);
          const qty = it.quantity || 1;
          const lineTotal = it.line_total != null ? it.line_total : ((orderPrice / (o.total_quantity || 1)) * qty);

          totalUnits += qty;
          totalGross += lineTotal;

          if (!map.has(pName)) {
            map.set(pName, {
              name: pName,
              units: 0,
              ordersSet: new Set(),
              grossRevenue: 0,
              discounts: 0,
              refunds: 0
            });
          }

          const curr = map.get(pName)!;
          curr.units += qty;
          curr.ordersSet.add(o.order_id);
          curr.grossRevenue += lineTotal;
          if (isCancelled) {
            curr.refunds += lineTotal;
          }
        });
      } else {
        const pName = (o.product_name || 'Unspecified').trim();
        distinctOrderProds.add(pName);
        const qty = o.total_quantity || 1;
        totalUnits += qty;
        totalGross += orderPrice;

        if (!map.has(pName)) {
          map.set(pName, {
            name: pName,
            units: 0,
            ordersSet: new Set(),
            grossRevenue: 0,
            discounts: 0,
            refunds: 0
          });
        }

        const curr = map.get(pName)!;
        curr.units += qty;
        curr.ordersSet.add(o.order_id);
        curr.grossRevenue += orderPrice;
        if (isCancelled) {
          curr.refunds += orderPrice;
        }
      }

      // Analyze product pairs if multi-product order
      const prodArr = Array.from(distinctOrderProds);
      if (prodArr.length > 1) {
        for (let i = 0; i < prodArr.length; i++) {
          for (let j = i + 1; j < prodArr.length; j++) {
            const pairKey = [prodArr[i], prodArr[j]].sort().join(' + ');
            if (!pairMap.has(pairKey)) {
              pairMap.set(pairKey, { pair: pairKey, count: 0, revenue: 0 });
            }
            const p = pairMap.get(pairKey)!;
            p.count += 1;
            p.revenue += orderPrice;
          }
        }
      }
    });

    const stats: ProductStat[] = Array.from(map.values()).map(item => {
      const net = Math.max(0, item.grossRevenue - item.refunds);
      const share = totalGross > 0 ? (item.grossRevenue / totalGross) * 100 : 0;
      return {
        name: item.name,
        units: item.units,
        ordersCount: item.ordersSet.size,
        grossRevenue: item.grossRevenue,
        discounts: item.discounts,
        refunds: item.refunds,
        netRevenue: net,
        revenueShare: share
      };
    });

    // Sort by units descending to pick best seller
    const sortedByUnits = [...stats].sort((a, b) => b.units - a.units);
    const top = sortedByUnits.length > 0 ? sortedByUnits[0] : null;

    // Sorted combinations
    const combos = Array.from(pairMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      productStats: stats,
      totalUnitsSold: totalUnits,
      totalProductRevenue: totalGross,
      topProduct: top,
      combosList: combos
    };
  }, [orders]);

  const avgQtyPerOrder = orders.length > 0 ? (totalUnitsSold / orders.length).toFixed(1) : '0';

  // --- TOP PRODUCTS CHART DATA ---
  const topProductsChartData = useMemo(() => {
    const list = [...productStats];
    if (metricView === 'revenue') {
      list.sort((a, b) => b.grossRevenue - a.grossRevenue);
    } else {
      list.sort((a, b) => b.units - a.units);
    }
    return list.slice(0, 6).map(p => ({
      name: p.name.length > 20 ? p.name.slice(0, 18) + '...' : p.name,
      fullName: p.name,
      revenue: Math.round(p.grossRevenue),
      units: p.units,
      share: p.revenueShare.toFixed(1)
    }));
  }, [productStats, metricView]);

  // --- DONUT REVENUE DISTRIBUTION ---
  const revenueDonutData = useMemo(() => {
    const sorted = [...productStats].sort((a, b) => b.grossRevenue - a.grossRevenue);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersRev = others.reduce((s, p) => s + p.grossRevenue, 0);

    const slices = top5.map((p, idx) => ({
      name: p.name,
      value: Math.round(p.grossRevenue),
      color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length]
    }));

    if (othersRev > 0) {
      slices.push({
        name: 'Other Products',
        value: Math.round(othersRev),
        color: PRODUCT_COLORS[PRODUCT_COLORS.length - 1]
      });
    }

    return slices;
  }, [productStats]);

  // --- FILTERED AND SORTED TABLE DATA ---
  const filteredTableData = useMemo(() => {
    return productStats.filter(p => {
      if (!searchQuery.trim()) return true;
      return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        aVal = (aVal as string).toLowerCase();
        bVal = (bVal as string).toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (Number(aVal) - Number(bVal)) : (Number(bVal) - Number(aVal));
    });
  }, [productStats, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredTableData.length / pageSize) || 1;
  const paginatedTableData = useMemo(() => {
    return filteredTableData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredTableData, currentPage, pageSize]);

  const handleSort = (field: keyof ProductStat) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 1. COMPACT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Products Sold */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Products Sold</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShoppingBag size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {totalUnitsSold.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">
            Aggregate units sold across orders
          </div>
        </div>

        {/* Product Revenue */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Product Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono">
            ₹{Math.round(totalProductRevenue).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">
            Across {productStats.length} catalog items
          </div>
        </div>

        {/* Best-Selling Product */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Best-Selling Product</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Package size={14} />
            </div>
          </div>
          <div className="text-sm sm:text-base font-bold text-emerald-400 truncate" title={topProduct?.name || 'N/A'}>
            {topProduct?.name || 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {topProduct?.units.toLocaleString('en-IN') || 0} units sold ({topProduct?.revenueShare.toFixed(1)}% share)
          </div>
        </div>

        {/* Avg Quantity per Order */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Units / Order</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {avgQtyPerOrder} units
          </div>
          <div className="text-[10px] text-slate-500">
            Average basket volume per checkout
          </div>
        </div>
      </div>

      {/* 2. TWO-COLUMN LAYOUT: TOP PRODUCTS & REVENUE DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Top Products Ranked Horizontal Bar Chart */}
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Top Performing Products
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranked by {metricView === 'revenue' ? 'gross sales revenue' : 'total units sold'}
              </p>
            </div>

            {/* Metric Toggle */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setMetricView('revenue')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  metricView === 'revenue' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Revenue
              </button>
              <button
                onClick={() => setMetricView('quantity')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  metricView === 'quantity' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Units
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            {topProductsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No product sales recorded in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProductsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const clickedProd = state.activePayload[0].payload.fullName;
                      setSelectedProductForModal(clickedProd);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis 
                    type="number" 
                    stroke="#64748b" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => metricView === 'revenue' ? `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}` : val}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#64748b" 
                    tick={{ fontSize: 10 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any, name: any) => [
                      name === 'revenue' ? `₹${Number(val).toLocaleString('en-IN')}` : val,
                      name === 'revenue' ? 'Revenue' : 'Units'
                    ]}
                    labelFormatter={(label, items) => items[0]?.payload?.fullName || label}
                  />
                  <Bar 
                    dataKey={metricView === 'revenue' ? 'revenue' : 'units'} 
                    fill="#8b5cf6" 
                    radius={[0, 6, 6, 0]}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[10px] text-slate-500 text-right">Click any product bar to inspect details</p>
        </div>

        {/* Right: Product Revenue Distribution Donut Chart */}
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Revenue Contribution Share
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Proportion of total gross sales by catalog item
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Donut Chart */}
            <div className="h-56 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueDonutData}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry) => {
                      if (entry && entry.name && entry.name !== 'Other Products') {
                        setSelectedProductForModal(entry.name);
                      }
                    }}
                  >
                    {revenueDonutData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-slate-500">Products</span>
                <span className="text-sm font-bold text-cyan-400 font-mono">{productStats.length}</span>
              </div>
            </div>

            {/* Compact Legend */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {revenueDonutData.map((item) => {
                const share = totalProductRevenue > 0 ? (item.value / totalProductRevenue) * 100 : 0;
                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      if (item.name !== 'Other Products') setSelectedProductForModal(item.name);
                    }}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-purple-500/40 transition-all cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-200 font-medium truncate" title={item.name}>{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-white block">₹{item.value.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400">{share.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. FREQUENTLY PURCHASED TOGETHER (COMBINATIONS & BUNDLES) */}
      {combosList.length > 0 && (
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                Frequently Purchased Together (Product Combinations)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated strictly from multi-item checkouts to uncover high-intent cross-selling pairs
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {combosList.length} Top Combinations
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {combosList.map((combo, idx) => (
              <div 
                key={combo.pair}
                className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-0.5">
                    Combo #{idx + 1}
                  </span>
                  <div className="text-xs font-semibold text-white break-words">
                    {combo.pair}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-cyan-400 font-mono">
                    {combo.count} orders
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ₹{Math.round(combo.revenue).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. PRODUCT PERFORMANCE TABLE */}
      <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package size={16} className="text-purple-400" />
              Product Performance Catalog ({filteredTableData.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive units, orders, revenue, and contribution breakdown
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-60 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                    <span className="flex items-center gap-1">Product <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('units')}>
                    <span className="flex items-center justify-end gap-1">Units Sold <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ordersCount')}>
                    <span className="flex items-center justify-end gap-1">Orders <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('grossRevenue')}>
                    <span className="flex items-center justify-end gap-1">Gross Revenue <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('refunds')}>
                    <span className="flex items-center justify-end gap-1">Cancellations <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('netRevenue')}>
                    <span className="flex items-center justify-end gap-1">Net Revenue <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('revenueShare')}>
                    <span className="flex items-center justify-end gap-1">Share % <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedTableData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                      No matching products found.
                    </td>
                  </tr>
                ) : (
                  paginatedTableData.map(p => (
                    <tr 
                      key={p.name}
                      onClick={() => setSelectedProductForModal(p.name)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-purple-400 shrink-0" />
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                        {p.units.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {p.ordersCount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        ₹{Math.round(p.grossRevenue).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                        {p.refunds > 0 ? `₹${Math.round(p.refunds).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{Math.round(p.netRevenue).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-300">
                        {p.revenueShare.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductForModal(p.name);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-600 rounded-lg transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredTableData.length)} of {filteredTableData.length}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded text-slate-300 cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 text-white font-mono">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded text-slate-300 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={!!selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
        productName={selectedProductForModal}
        orders={orders}
        onSelectOrder={onSelectOrder}
      />
    </div>
  );
};
