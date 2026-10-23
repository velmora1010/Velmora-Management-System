import React, { useState } from 'react';
import { 
  X, 
  Package, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Calendar,
  Search,
  ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import type { WebsiteConsolidatedOrder } from '../types';
import { formatSalesDateShort } from '../websiteSalesUtils';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string | null;
  orders: WebsiteConsolidatedOrder[];
  onSelectOrder?: (order: WebsiteConsolidatedOrder) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  productName,
  orders,
  onSelectOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  if (!isOpen || !productName) return null;

  // Filter orders that contain this product
  const productOrders = orders.filter(o => {
    if (o.items && o.items.length > 0) {
      return o.items.some(it => it.product_name.toLowerCase() === productName.toLowerCase());
    }
    return (o.product_name || '').toLowerCase().includes(productName.toLowerCase());
  });

  // Calculate metrics for this product
  let totalUnits = 0;
  let totalRevenue = 0;

  productOrders.forEach(o => {
    if (o.items && o.items.length > 0) {
      const matchItems = o.items.filter(it => it.product_name.toLowerCase() === productName.toLowerCase());
      matchItems.forEach(it => {
        totalUnits += it.quantity || 1;
        totalRevenue += it.line_total != null ? it.line_total : ((Number(o.price) || 0) / (o.total_quantity || 1)) * (it.quantity || 1);
      });
    } else {
      totalUnits += o.total_quantity || 1;
      totalRevenue += Number(o.price) || 0;
    }
  });

  const aov = productOrders.length > 0 ? Math.round(totalRevenue / productOrders.length) : 0;

  // Prepare trend data by date
  const trendMap: Record<string, { date: string; displayDate: string; units: number; revenue: number }> = {};
  productOrders.forEach(o => {
    const d = o.order_date || 'Unknown';
    if (!trendMap[d]) {
      trendMap[d] = {
        date: d,
        displayDate: formatSalesDateShort(d),
        units: 0,
        revenue: 0
      };
    }
    let units = 0;
    let rev = 0;
    if (o.items && o.items.length > 0) {
      const matchItems = o.items.filter(it => it.product_name.toLowerCase() === productName.toLowerCase());
      matchItems.forEach(it => {
        units += it.quantity || 1;
        rev += it.line_total != null ? it.line_total : ((Number(o.price) || 0) / (o.total_quantity || 1)) * (it.quantity || 1);
      });
    } else {
      units = o.total_quantity || 1;
      rev = Number(o.price) || 0;
    }
    trendMap[d].units += units;
    trendMap[d].revenue += rev;
  });

  const trendData = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

  // Filtered orders list for table
  const filteredOrders = productOrders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_id.toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.city || '').toLowerCase().includes(q) ||
      (o.state || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {productName}
              </h2>
              <p className="text-xs text-slate-400">
                Product Performance Detail • {productOrders.length} matching {productOrders.length === 1 ? 'order' : 'orders'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag size={13} className="text-purple-400" /> Units Sold
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {totalUnits.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-cyan-400" /> Revenue
              </div>
              <div className="text-xl font-bold text-cyan-400 mt-1 font-mono">
                ₹{Math.round(totalRevenue).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-emerald-400" /> Total Orders
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                {productOrders.length}
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={13} className="text-amber-400" /> Avg Order Value
              </div>
              <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
                ₹{aov.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Daily Trend Chart */}
          {trendData.length > 1 && (
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Daily Sales Trend</span>
                <span className="text-[11px] text-slate-400">Revenue & Units</span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="prodRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(val: any, name: any) => [name === 'revenue' ? `₹${Number(val).toLocaleString('en-IN')}` : val, name === 'revenue' ? 'Revenue' : 'Units']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#prodRevGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Product Orders Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Orders Containing This Product ({filteredOrders.length})
              </h3>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full sm:w-56 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3 text-right">Order Total</th>
                      {onSelectOrder && <th className="py-2.5 px-3 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-500 text-xs">
                          No matching orders found.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-white">#{o.order_id}</td>
                          <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{formatSalesDateShort(o.order_date)}</td>
                          <td className="py-2 px-3 font-medium text-slate-200 truncate max-w-[140px]">{o.customer_name}</td>
                          <td className="py-2 px-3 text-slate-400 truncate max-w-[120px]">{o.city}, {o.state}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.payment_mode === 'PREPAID'
                                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}>
                              {o.payment_mode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            ₹{Number(o.price || 0).toLocaleString('en-IN')}
                          </td>
                          {onSelectOrder && (
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => onSelectOrder(o)}
                                className="text-xs text-purple-400 hover:text-purple-300 font-semibold cursor-pointer inline-flex items-center gap-1"
                              >
                                View <ArrowRight size={11} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-2.5 px-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded text-slate-300 cursor-pointer"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded text-slate-300 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
