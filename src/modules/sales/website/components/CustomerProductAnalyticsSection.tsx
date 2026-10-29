import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Repeat,
  ShoppingBag,
  TrendingUp,
  Search,
  X,
  ExternalLink,
  ChevronDown,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import type { WebsiteConsolidatedOrder } from '../types';
import type { CustomerPurchaseProfile } from './AnalyticsFullPageDataView';
import { normalizeIndianPhoneNumber, normalizePhoneDigits } from '../websiteSalesUtils';

interface CustomerProductAnalyticsSectionProps {
  orders: WebsiteConsolidatedOrder[];
  allHistoricalOrders?: WebsiteConsolidatedOrder[];
  onViewAllCustomers?: (title: string, customers: CustomerPurchaseProfile[]) => void;
  highlighted?: boolean;
}

const FREQUENCY_BAR_COLORS = [
  '#06b6d4', // 1 Time (Cyan)
  '#3b82f6', // 2 Times (Blue)
  '#8b5cf6', // 3 Times (Violet)
  '#a855f7', // 4 Times (Purple)
  '#ec4899', // 5 Times (Pink)
  '#f59e0b', // 6-10 Times (Amber)
  '#10b981'  // >10 Times (Emerald)
];

export const CustomerProductAnalyticsSection: React.FC<CustomerProductAnalyticsSectionProps> = ({
  orders,
  allHistoricalOrders,
  onViewAllCustomers,
  highlighted = false
}) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<'totalOrders' | 'totalSpend' | 'averageOrderValue' | 'mostRecentPurchaseDate'>('totalOrders');
  const [sortAsc, setSortAsc] = useState(false);

  // 1. Group Distinct Orders into Customer Profiles
  // Rules:
  // - Distinct orders only (orders array already contains unique orders by order_id)
  // - Identify by normalized 10-digit phone number.
  // - If phone missing, fallback to clean name + canonical location to prevent merging distinct customers
  const customerProfiles: CustomerPurchaseProfile[] = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      ordersList: WebsiteConsolidatedOrder[];
    }>();

    orders.forEach(o => {
      const cleanPhone = normalizePhoneDigits(o.phone);
      let customerKey = cleanPhone;

      if (!customerKey) {
        // Fallback key: sanitized name + pincode/state to prevent merging customers with same name in different regions
        const cleanName = (o.customer_name || 'unknown').trim().toLowerCase().replace(/\s+/g, '_');
        const locPart = o.canonicalPincode || o.pincode || o.state || 'no_loc';
        customerKey = `cust_${cleanName}_${locPart}`;
      }

      if (!map.has(customerKey)) {
        map.set(customerKey, {
          name: o.customer_name || 'N/A',
          phone: cleanPhone ? (cleanPhone.length === 10 ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}` : cleanPhone) : 'Not Provided',
          ordersList: []
        });
      }

      map.get(customerKey)!.ordersList.push(o);
    });

    const profiles: CustomerPurchaseProfile[] = [];

    map.forEach((entry, key) => {
      // Sort orders by order_date
      const sortedOrders = [...entry.ordersList].sort((a, b) => {
        return (a.order_date || '').localeCompare(b.order_date || '');
      });

      const totalOrders = sortedOrders.length;
      const totalSpend = sortedOrders.reduce((sum, ord) => sum + (ord.price || 0), 0);
      const totalQuantity = sortedOrders.reduce((sum, ord) => sum + (ord.total_quantity || 1), 0);
      const averageOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;
      const firstPurchaseDate = sortedOrders[0]?.order_date || '—';
      const mostRecentPurchaseDate = sortedOrders[sortedOrders.length - 1]?.order_date || '—';

      let frequencyGroup: CustomerPurchaseProfile['frequencyGroup'];
      if (totalOrders === 1) frequencyGroup = '1 Time';
      else if (totalOrders === 2) frequencyGroup = '2 Times';
      else if (totalOrders === 3) frequencyGroup = '3 Times';
      else if (totalOrders === 4) frequencyGroup = '4 Times';
      else if (totalOrders === 5) frequencyGroup = '5 Times';
      else if (totalOrders <= 10) frequencyGroup = '6–10 Times';
      else frequencyGroup = '> 10 Times';

      profiles.push({
        customerKey: key,
        customerName: entry.name,
        phone: entry.phone,
        totalOrders,
        totalQuantity,
        totalSpend,
        averageOrderValue,
        firstPurchaseDate,
        mostRecentPurchaseDate,
        frequencyGroup
      });
    });

    return profiles;
  }, [orders]);

  // 2. High-Level KPI Summary
  const kpis = useMemo(() => {
    const totalUniqueCustomers = customerProfiles.length;
    const oneTimeBuyers = customerProfiles.filter(c => c.totalOrders === 1).length;
    const repeatBuyers = customerProfiles.filter(c => c.totalOrders >= 2).length;
    const repeatPurchaseRate = totalUniqueCustomers > 0
      ? ((repeatBuyers / totalUniqueCustomers) * 100).toFixed(1)
      : '0.0';

    // Total repeat orders: orders beyond the initial order for all repeat customers
    const totalRepeatOrders = customerProfiles.reduce((sum, c) => {
      return sum + (c.totalOrders > 1 ? c.totalOrders - 1 : 0);
    }, 0);

    const totalOrdersCount = orders.length;
    const avgOrdersPerCustomer = totalUniqueCustomers > 0
      ? (totalOrdersCount / totalUniqueCustomers).toFixed(2)
      : '0.00';

    return {
      totalUniqueCustomers,
      oneTimeBuyers,
      repeatBuyers,
      repeatPurchaseRate,
      totalRepeatOrders,
      avgOrdersPerCustomer
    };
  }, [customerProfiles, orders]);

  // 3. Purchase Frequency Distribution Data for Chart
  const frequencyChartData = useMemo(() => {
    const total = customerProfiles.length;
    const groups = [
      { name: '1 Time', count: 0, color: FREQUENCY_BAR_COLORS[0] },
      { name: '2 Times', count: 0, color: FREQUENCY_BAR_COLORS[1] },
      { name: '3 Times', count: 0, color: FREQUENCY_BAR_COLORS[2] },
      { name: '4 Times', count: 0, color: FREQUENCY_BAR_COLORS[3] },
      { name: '5 Times', count: 0, color: FREQUENCY_BAR_COLORS[4] },
      { name: '6–10 Times', count: 0, color: FREQUENCY_BAR_COLORS[5] },
      { name: '> 10 Times', count: 0, color: FREQUENCY_BAR_COLORS[6] }
    ];

    customerProfiles.forEach(c => {
      const g = groups.find(item => item.name === c.frequencyGroup);
      if (g) g.count++;
    });

    return groups.map(g => ({
      ...g,
      percentage: total > 0 ? ((g.count / total) * 100).toFixed(1) : '0'
    }));
  }, [customerProfiles]);

  // 4. Filtered & Sorted Customer Table
  const filteredCustomers = useMemo(() => {
    let list = [...customerProfiles];

    if (selectedGroupFilter) {
      list = list.filter(c => c.frequencyGroup === selectedGroupFilter);
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(c => {
        return (
          c.customerName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.customerKey.toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [customerProfiles, selectedGroupFilter, tableSearch, sortField, sortAsc]);

  const previewList = filteredCustomers.slice(0, 6);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div
      id="analytics-customer-product"
      className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-5 transition-all duration-300 ${
        highlighted ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
      }`}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Users size={18} className="text-purple-400" />
          <span>Customer Product Analytics</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Repeat Behaviour
          </span>
        </div>
        <div className="text-xs text-slate-400">
          Tracking purchase frequency & customer lifetime metrics
        </div>
      </div>

      {/* 1. KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Unique Customers</span>
            <Users size={13} className="text-cyan-400" />
          </div>
          <span className="text-lg font-mono font-black text-white">{kpis.totalUniqueCustomers.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Distinct buyers</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">One-Time Buyers</span>
            <UserPlus size={13} className="text-blue-400" />
          </div>
          <span className="text-lg font-mono font-black text-blue-300">{kpis.oneTimeBuyers.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Single purchase</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Repeat Buyers</span>
            <UserCheck size={13} className="text-purple-400" />
          </div>
          <span className="text-lg font-mono font-black text-purple-300">{kpis.repeatBuyers.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">≥ 2 purchases</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Repeat Rate</span>
            <TrendingUp size={13} className="text-emerald-400" />
          </div>
          <span className="text-lg font-mono font-black text-emerald-400">{kpis.repeatPurchaseRate}%</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Customer retention</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Repeat Orders</span>
            <Repeat size={13} className="text-amber-400" />
          </div>
          <span className="text-lg font-mono font-black text-amber-300">{kpis.totalRepeatOrders.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Beyond initial order</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Orders / Cust</span>
            <ShoppingBag size={13} className="text-pink-400" />
          </div>
          <span className="text-lg font-mono font-black text-pink-300">{kpis.avgOrdersPerCustomer}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">Orders per buyer</span>
        </div>
      </div>

      {/* 2. Purchase Frequency Distribution Chart */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Purchase Frequency Distribution</h4>
            <p className="text-[11px] text-slate-400">
              Click a bar to filter the customer table to that exact purchase-frequency cohort
            </p>
          </div>
          {selectedGroupFilter && (
            <button
              onClick={() => setSelectedGroupFilter(null)}
              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold cursor-pointer bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/30"
            >
              <span>Filtering by: <b>{selectedGroupFilter}</b></span>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={frequencyChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            >
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                interval={0}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                          <span>{data.name} Group</span>
                        </div>
                        <div className="text-slate-300 font-mono">
                          Unique Customers: <b className="text-white">{data.count.toLocaleString()}</b>
                        </div>
                        <div className="text-slate-400 font-mono">
                          Share of Customers: <b className="text-cyan-300">{data.percentage}%</b>
                        </div>
                        <div className="text-[10px] text-indigo-400 font-semibold pt-1">
                          Click to filter customer table
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                onClick={(entry: any) => {
                  if (entry && entry.name) {
                    setSelectedGroupFilter(prev => prev === entry.name ? null : entry.name);
                  }
                }}
                cursor="pointer"
              >
                {frequencyChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={selectedGroupFilter === null || selectedGroupFilter === entry.name ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2 border-t border-slate-800/80">
          {frequencyChartData.map(group => (
            <button
              key={group.name}
              onClick={() => setSelectedGroupFilter(prev => prev === group.name ? null : group.name)}
              className={`p-2 rounded-lg text-center transition-all cursor-pointer border ${
                selectedGroupFilter === group.name
                  ? 'bg-purple-900/30 border-purple-500 ring-1 ring-purple-500'
                  : 'bg-slate-900/60 border-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                <span className="truncate">{group.name}</span>
              </div>
              <div className="text-xs font-mono font-bold text-white mt-0.5">{group.count}</div>
              <div className="text-[10px] font-mono text-slate-400">{group.percentage}%</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Customer Purchase Table Preview */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Customer Purchase Records</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'Customer' : 'Customers'}
              {selectedGroupFilter && ` (${selectedGroupFilter})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px] max-w-[260px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search Name or Phone..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-6 py-1 text-[11px] text-white placeholder-slate-500 outline-none focus:border-purple-500"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {onViewAllCustomers && (
              <button
                onClick={() => onViewAllCustomers('Customer Purchase Analytics', filteredCustomers)}
                className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>View All ({filteredCustomers.length})</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="py-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No customers match the active filters or search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Identifier (Phone)</th>
                  <th
                    onClick={() => toggleSort('totalOrders')}
                    className="py-2.5 px-3 text-center cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-center gap-1">Orders <ArrowUpDown size={11} /></div>
                  </th>
                  <th className="py-2.5 px-3 text-center">Total Qty</th>
                  <th
                    onClick={() => toggleSort('totalSpend')}
                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">Total Spend <ArrowUpDown size={11} /></div>
                  </th>
                  <th
                    onClick={() => toggleSort('averageOrderValue')}
                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">AOV <ArrowUpDown size={11} /></div>
                  </th>
                  <th className="py-2.5 px-3">First Purchase</th>
                  <th
                    onClick={() => toggleSort('mostRecentPurchaseDate')}
                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">Most Recent <ArrowUpDown size={11} /></div>
                  </th>
                  <th className="py-2.5 px-3 text-center">Cohort Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {previewList.map((c, idx) => (
                  <tr key={c.customerKey || idx} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                    <td className="py-2.5 px-3 font-bold text-white max-w-[150px] truncate" title={c.customerName}>
                      {c.customerName || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300">{c.phone}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white">{c.totalOrders}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">{c.totalQuantity}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">₹{Math.round(c.totalSpend).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 font-mono text-purple-300">₹{Math.round(c.averageOrderValue).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{c.firstPurchaseDate}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{c.mostRecentPurchaseDate}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        c.frequencyGroup === '1 Time' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                        c.frequencyGroup === '2 Times' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                        c.frequencyGroup === '3 Times' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {c.frequencyGroup}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredCustomers.length > 6 && onViewAllCustomers && (
          <div className="pt-1 text-center">
            <button
              onClick={() => onViewAllCustomers('Customer Purchase Analytics', filteredCustomers)}
              className="px-4 py-1.5 bg-slate-950 hover:bg-slate-800 text-purple-300 font-bold text-[11px] rounded-lg border border-slate-800 transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>View All {filteredCustomers.length} Customers in Full Page Table</span>
              <ExternalLink size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
