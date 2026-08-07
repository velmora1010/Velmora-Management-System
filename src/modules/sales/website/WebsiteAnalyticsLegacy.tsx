import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  MapPin, 
  CreditCard, 
  Tag, 
  Filter, 
  RotateCcw,
  Building2,
  Package,
  ShoppingBag
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import type { WebsiteConsolidatedOrder, WebsiteSalesFilterState, WebsiteUploadBatch } from './types';
import { websiteSalesService } from './websiteSalesService';

export const WebsiteAnalyticsLegacy: React.FC = () => {
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [filters, setFilters] = useState<WebsiteSalesFilterState>({
    searchQuery: '',
    batchId: '',
    state: '',
    city: '',
    product: '',
    offer: '',
    paymentMode: '',
    dateRange: 'all'
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    const bList = await websiteSalesService.getUploadBatches();
    setBatches(bList);

    const fetchedOrders = await websiteSalesService.getConsolidatedOrders(filters);
    setOrders(fetchedOrders);
    setLoading(false);
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      batchId: '',
      state: '',
      city: '',
      product: '',
      offer: '',
      paymentMode: '',
      dateRange: 'all'
    });
  };

  // Derive unique lists for dropdown filters
  const uniqueStates = Array.from(new Set(orders.map(o => o.state).filter(Boolean))).sort();

  // ============================================================================
  // SUMMARY CALCULATIONS
  // ============================================================================
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const totalUnits = orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  const codOrders = orders.filter(o => o.payment_mode === 'COD');
  const prepaidOrders = orders.filter(o => o.payment_mode === 'PREPAID');
  const unknownPaymentOrders = orders.filter(o => o.payment_mode === 'UNKNOWN');

  const codRevenue = codOrders.reduce((sum, o) => sum + o.price, 0);
  const prepaidRevenue = prepaidOrders.reduce((sum, o) => sum + o.price, 0);

  const uniqueStateCount = new Set(orders.map(o => o.state).filter(s => s && s !== '-')).size;
  const uniqueCityCount = new Set(orders.map(o => o.city).filter(c => c && c !== '-')).size;

  // ============================================================================
  // 1. STATE WISE BREAKDOWN
  // ============================================================================
  const stateMap = new Map<string, { state: string; orders: number; revenue: number; units: number }>();
  orders.forEach(o => {
    const st = o.state || 'Unspecified';
    if (!stateMap.has(st)) {
      stateMap.set(st, { state: st, orders: 0, revenue: 0, units: 0 });
    }
    const curr = stateMap.get(st)!;
    curr.orders += 1;
    curr.revenue += o.price;
    curr.units += o.total_quantity;
  });

  const stateBreakdown = Array.from(stateMap.values())
    .map(st => ({
      ...st,
      aov: st.orders > 0 ? Math.round(st.revenue / st.orders) : 0,
      pctOrders: totalOrdersCount > 0 ? ((st.orders / totalOrdersCount) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.orders - a.orders);

  // ============================================================================
  // 2. CITY WISE BREAKDOWN
  // ============================================================================
  const cityMap = new Map<string, { city: string; state: string; orders: number; revenue: number; units: number }>();
  orders.forEach(o => {
    const c = o.city || 'Unspecified';
    const st = o.state || 'Unspecified';
    const key = `${c}||${st}`;
    if (!cityMap.has(key)) {
      cityMap.set(key, { city: c, state: st, orders: 0, revenue: 0, units: 0 });
    }
    const curr = cityMap.get(key)!;
    curr.orders += 1;
    curr.revenue += o.price;
    curr.units += o.total_quantity;
  });

  const cityBreakdown = Array.from(cityMap.values())
    .map(c => ({
      ...c,
      aov: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
      pctOrders: totalOrdersCount > 0 ? ((c.orders / totalOrdersCount) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 15);

  // ============================================================================
  // 3. ORDER WISE BREAKDOWN
  // ============================================================================
  const singleProductOrders = orders.filter(o => !o.product_name.includes(',')).length;
  const multiProductOrders = orders.filter(o => o.product_name.includes(',')).length;
  const singleUnitOrders = orders.filter(o => o.total_quantity === 1).length;
  const multiUnitOrders = orders.filter(o => o.total_quantity > 1).length;

  const valueRanges = [
    { range: 'Below ₹500', count: 0, min: 0, max: 499.99 },
    { range: '₹500–₹999', count: 0, min: 500, max: 999.99 },
    { range: '₹1,000–₹1,499', count: 0, min: 1000, max: 1499.99 },
    { range: '₹1,500–₹1,999', count: 0, min: 1500, max: 1999.99 },
    { range: '₹2,000 and above', count: 0, min: 2000, max: Infinity }
  ];

  orders.forEach(o => {
    const vr = valueRanges.find(r => o.price >= r.min && o.price <= r.max);
    if (vr) vr.count += 1;
  });

  // ============================================================================
  // 4. OFFER WISE BREAKDOWN
  // ============================================================================
  const offerMap = new Map<string, { offer: string; orders: number; revenue: number; units: number }>();
  orders.forEach(o => {
    const off = o.offer || 'No Offer';
    if (!offerMap.has(off)) {
      offerMap.set(off, { offer: off, orders: 0, revenue: 0, units: 0 });
    }
    const curr = offerMap.get(off)!;
    curr.orders += 1;
    curr.revenue += o.price;
    curr.units += o.total_quantity;
  });

  const offerBreakdown = Array.from(offerMap.values())
    .map(off => ({
      ...off,
      aov: off.orders > 0 ? Math.round(off.revenue / off.orders) : 0,
      pctOrders: totalOrdersCount > 0 ? ((off.orders / totalOrdersCount) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.orders - a.orders);

  // ============================================================================
  // 5. PRODUCT WISE BREAKDOWN
  // ============================================================================
  const prodMap = new Map<string, { product: string; unitsSold: number; orderCount: number }>();
  orders.forEach(o => {
    if (o.items && o.items.length > 0) {
      o.items.forEach(it => {
        if (!prodMap.has(it.product_name)) {
          prodMap.set(it.product_name, { product: it.product_name, unitsSold: 0, orderCount: 0 });
        }
        const curr = prodMap.get(it.product_name)!;
        curr.unitsSold += it.quantity;
        curr.orderCount += 1;
      });
    } else {
      const prods = o.product_name.split(',').map(p => p.trim());
      prods.forEach(p => {
        if (!prodMap.has(p)) {
          prodMap.set(p, { product: p, unitsSold: 0, orderCount: 0 });
        }
        const curr = prodMap.get(p)!;
        curr.unitsSold += Math.max(1, Math.round(o.total_quantity / prods.length));
        curr.orderCount += 1;
      });
    }
  });

  const productBreakdown = Array.from(prodMap.values())
    .map(p => ({
      ...p,
      pctUnits: totalUnits > 0 ? ((p.unitsSold / totalUnits) * 100).toFixed(1) : '0',
      avgQtyPerOrder: p.orderCount > 0 ? (p.unitsSold / p.orderCount).toFixed(1) : '0'
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const paymentPieData = [
    { name: 'COD', value: codOrders.length, color: '#f59e0b' },
    { name: 'PREPAID', value: prepaidOrders.length, color: '#10b981' },
    { name: 'UNKNOWN', value: unknownPaymentOrders.length, color: '#64748b' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Website Sales Analytics (Legacy)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive breakdowns across States, Cities, Orders, Offers, Products, and Payment Modes.
            </p>
          </div>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Filter size={16} className="text-cyan-400" />
            <span>Analytics Filters</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filters.batchId}
              onChange={e => setFilters({ ...filters, batchId: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-400"
            >
              <option value="">All Batches ({batches.length})</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.file_name}</option>
              ))}
            </select>

            <select
              value={filters.state}
              onChange={e => setFilters({ ...filters, state: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-400"
            >
              <option value="">All States</option>
              {uniqueStates.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={filters.paymentMode}
              onChange={e => setFilters({ ...filters, paymentMode: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-400"
            >
              <option value="">All Payment Modes</option>
              <option value="COD">COD</option>
              <option value="PREPAID">PREPAID</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Orders</span>
          <span className="text-xl font-extrabold text-white">{totalOrdersCount}</span>
        </div>
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Total Revenue</span>
          <span className="text-xl font-extrabold text-emerald-300">₹{totalRevenue.toLocaleString()}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">Total Units</span>
          <span className="text-xl font-extrabold text-cyan-300">{totalUnits}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Avg Order Value</span>
          <span className="text-xl font-extrabold text-purple-300">₹{Math.round(avgOrderValue)}</span>
        </div>
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30">
          <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">COD Orders</span>
          <span className="text-xl font-extrabold text-amber-300">{codOrders.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
          <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">Prepaid Orders</span>
          <span className="text-xl font-extrabold text-cyan-300">{prepaidOrders.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Unique States</span>
          <span className="text-xl font-extrabold text-white">{uniqueStateCount}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Unique Cities</span>
          <span className="text-xl font-extrabold text-white">{uniqueCityCount}</span>
        </div>
      </div>
    </div>
  );
};
