import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Repeat, 
  DollarSign, 
  TrendingUp, 
  Search, 
  Filter, 
  Calendar, 
  ShieldCheck, 
  Sparkles,
  ArrowUpDown,
  CreditCard
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
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
import type { WebsiteConsolidatedOrder } from '../types';
import { formatSalesDateShort } from '../websiteSalesUtils';

interface CustomerIntelligenceSectionProps {
  orders: WebsiteConsolidatedOrder[];
  allHistoricalOrders?: WebsiteConsolidatedOrder[];
  startDate: string;
  endDate: string;
  onSelectOrder?: (order: WebsiteConsolidatedOrder) => void;
}

interface CustomerRecord {
  customerKey: string;
  customerName: string;
  phone: string;
  maskedPhone: string;
  totalOrders: number;
  totalSpend: number;
  aov: number;
  firstOrderDate: string;
  lastOrderDate: string;
  segment: 'New' | 'Repeat' | 'VIP / High-Value' | 'Inactive';
  orders: WebsiteConsolidatedOrder[];
}

export const CustomerIntelligenceSection: React.FC<CustomerIntelligenceSectionProps> = ({
  orders,
  allHistoricalOrders = [],
  startDate,
  endDate,
  onSelectOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof CustomerRecord>('totalSpend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // --- AGGREGATE CUSTOMER METRICS ---
  const {
    customerRecords,
    uniqueCustomersCount,
    newCustomersCount,
    returningCustomersCount,
    repeatPurchaseRate,
    avgCustomerSpend,
    newVsReturningData,
    customerTrendData,
    segmentsData
  } = useMemo(() => {
    // 1. Group orders in current period by stable customer identifier (phone or clean name)
    const custMap = new Map<string, {
      name: string;
      rawPhone: string;
      cleanPhone: string;
      orders: WebsiteConsolidatedOrder[];
      totalSpend: number;
      firstDate: string;
      lastDate: string;
    }>();

    orders.forEach(o => {
      const rawDigits = String(o.phone || '').replace(/\D/g, '');
      const cleanPhone = rawDigits.length === 12 && rawDigits.startsWith('91')
        ? rawDigits.slice(2)
        : (rawDigits.length === 11 && rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits);

      // Stable key: normalized phone number or sanitized customer name
      const key = cleanPhone || (o.customer_name || 'unknown').toLowerCase().trim();
      const val = Number(o.price) || 0;
      const oDate = o.order_date || 'Unknown';

      if (!custMap.has(key)) {
        custMap.set(key, {
          name: o.customer_name || 'Customer',
          rawPhone: o.phone || '',
          cleanPhone,
          orders: [],
          totalSpend: 0,
          firstDate: oDate,
          lastDate: oDate
        });
      }

      const rec = custMap.get(key)!;
      rec.orders.push(o);
      rec.totalSpend += val;
      if (oDate < rec.firstDate) rec.firstDate = oDate;
      if (oDate > rec.lastDate) rec.lastDate = oDate;
      if (rec.name === 'Customer' && o.customer_name && o.customer_name !== 'Customer') {
        rec.name = o.customer_name;
      }
    });

    // 2. Identify New vs Returning based on order counts in period
    let newCount = 0;
    let returningCount = 0;
    let newRev = 0;
    let returningRev = 0;

    let oneTimeCount = 0;
    let repeatCount = 0;
    let vipCount = 0;
    let oneTimeSpend = 0;
    let repeatSpend = 0;
    let vipSpend = 0;

    const records: CustomerRecord[] = Array.from(custMap.entries()).map(([key, data]) => {
      const orderCount = data.orders.length;
      const spend = data.totalSpend;
      const aov = orderCount > 0 ? Math.round(spend / orderCount) : 0;

      // Segment determination
      let segment: 'New' | 'Repeat' | 'VIP / High-Value' | 'Inactive';
      if (orderCount >= 5 || spend >= 3000) {
        segment = 'VIP / High-Value';
        vipCount++;
        vipSpend += spend;
        returningCount++;
        returningRev += spend;
      } else if (orderCount > 1) {
        segment = 'Repeat';
        repeatCount++;
        repeatSpend += spend;
        returningCount++;
        returningRev += spend;
      } else {
        segment = 'New';
        oneTimeCount++;
        oneTimeSpend += spend;
        newCount++;
        newRev += spend;
      }

      // Mask phone for privacy: e.g. "******9686"
      const p = data.cleanPhone;
      const masked = p.length >= 4 
        ? `${'*'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`
        : (p ? `***${p}` : 'Not provided');

      return {
        customerKey: key,
        customerName: data.name,
        phone: data.cleanPhone,
        maskedPhone: masked,
        totalOrders: orderCount,
        totalSpend: spend,
        aov,
        firstOrderDate: data.firstDate,
        lastOrderDate: data.lastDate,
        segment,
        orders: data.orders
      };
    });

    const totalUnique = records.length;
    const repeatRate = totalUnique > 0 ? (returningCount / totalUnique) * 100 : 0;
    const totalRevAll = newRev + returningRev;
    const avgSpend = totalUnique > 0 ? Math.round(totalRevAll / totalUnique) : 0;

    // Donut chart: New vs Returning Customers
    const newVsReturning = [
      { 
        name: 'New Customers', 
        value: newCount, 
        revenue: newRev, 
        share: totalUnique > 0 ? (newCount / totalUnique) * 100 : 0,
        color: '#06b6d4' 
      },
      { 
        name: 'Returning Customers', 
        value: returningCount, 
        revenue: returningRev, 
        share: totalUnique > 0 ? (returningCount / totalUnique) * 100 : 0,
        color: '#8b5cf6' 
      }
    ];

    // Segments distribution
    const segs = [
      { name: 'One-Time Purchasers', count: oneTimeCount, spend: oneTimeSpend, color: '#06b6d4' },
      { name: 'Repeat Purchasers', count: repeatCount, spend: repeatSpend, color: '#8b5cf6' },
      { name: 'VIP / High-Value', count: vipCount, spend: vipSpend, color: '#10b981' }
    ];

    // Trend of new vs returning orders over time
    const dayMap: Record<string, { date: string; displayDate: string; newOrders: number; returningOrders: number }> = {};
    orders.forEach(o => {
      const d = o.order_date || 'Unknown';
      if (!dayMap[d]) {
        dayMap[d] = {
          date: d,
          displayDate: formatSalesDateShort(d),
          newOrders: 0,
          returningOrders: 0
        };
      }
      const rawDigits = String(o.phone || '').replace(/\D/g, '');
      const cleanPhone = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
      const key = cleanPhone || (o.customer_name || 'unknown').toLowerCase().trim();
      const cRec = custMap.get(key);
      if (cRec && cRec.orders.length > 1) {
        dayMap[d].returningOrders += 1;
      } else {
        dayMap[d].newOrders += 1;
      }
    });

    const trend = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      customerRecords: records,
      uniqueCustomersCount: totalUnique,
      newCustomersCount: newCount,
      returningCustomersCount: returningCount,
      repeatPurchaseRate: repeatRate,
      avgCustomerSpend: avgSpend,
      newVsReturningData: newVsReturning,
      customerTrendData: trend,
      segmentsData: segs
    };
  }, [orders]);

  // --- FILTERED AND SORTED TABLE DATA ---
  const filteredTableData = useMemo(() => {
    return customerRecords.filter(c => {
      if (selectedSegmentFilter !== 'ALL' && c.segment !== selectedSegmentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.customerName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.maskedPhone.includes(q)
        );
      }
      return true;
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
  }, [customerRecords, selectedSegmentFilter, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredTableData.length / pageSize) || 1;
  const paginatedTableData = useMemo(() => {
    return filteredTableData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredTableData, currentPage, pageSize]);

  const handleSort = (field: keyof CustomerRecord) => {
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Unique Customers */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unique Customers</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {uniqueCustomersCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">
            Distinct buyers identified by phone/ID
          </div>
        </div>

        {/* New Customers */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">New Customers</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <UserPlus size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono">
            {newCustomersCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">
            First-time purchasers in period
          </div>
        </div>

        {/* Returning Customers */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Returning Customers</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <UserCheck size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-400 font-mono">
            {returningCustomersCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">
            Repeat or multi-order buyers
          </div>
        </div>

        {/* Repeat Purchase Rate */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Repeat Rate</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Repeat size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
            {repeatPurchaseRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">
            Repeat buyers as % of unique base
          </div>
        </div>

        {/* Average Customer Value */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-2 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Customer Spend</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            ₹{avgCustomerSpend.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">
            Cumulative spend per unique buyer
          </div>
        </div>
      </div>

      {/* 2. CHARTS: NEW VS RETURNING & PURCHASE TRENDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: New vs Returning Customers */}
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              New vs Returning Customer Revenue
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Acquisition vs retention revenue contribution
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Donut Chart */}
            <div className="h-52 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={newVsReturningData}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {newVsReturningData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} customers (₹${Math.round(item.payload.revenue).toLocaleString('en-IN')})`,
                      item.payload.name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total Buyers</span>
                <span className="text-sm font-bold text-white font-mono">{uniqueCustomersCount}</span>
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="space-y-3">
              {newVsReturningData.map(item => (
                <div 
                  key={item.name}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-white">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-white">{item.value} buyers</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Revenue: <strong className="text-slate-200">₹{Math.round(item.revenue).toLocaleString('en-IN')}</strong></span>
                    <span className="font-mono text-cyan-400">{item.share.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Customer Segments */}
        <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Customer Segments & Value
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              One-Time (1 order) • Repeat (2-4 orders) • VIP / High-Value (5+ orders or ₹3k+ spend)
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {segmentsData.map(seg => {
              const share = uniqueCustomersCount > 0 ? (seg.count / uniqueCustomersCount) * 100 : 0;
              return (
                <div 
                  key={seg.name}
                  onClick={() => {
                    const mappedSeg = seg.name.startsWith('One') ? 'New' : (seg.name.startsWith('Repeat') ? 'Repeat' : 'VIP / High-Value');
                    setSelectedSegmentFilter(prev => prev === mappedSeg ? 'ALL' : mappedSeg);
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedSegmentFilter === (seg.name.startsWith('One') ? 'New' : (seg.name.startsWith('Repeat') ? 'Repeat' : 'VIP / High-Value'))
                      ? 'border-purple-500 bg-purple-950/30'
                      : 'border-slate-800 bg-slate-950/60 hover:bg-slate-950/90'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="font-bold text-white">{seg.name}</span>
                    </div>
                    <span className="font-mono font-bold text-cyan-400">{seg.count} customers ({share.toFixed(1)}%)</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-1.5">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${share}%`, backgroundColor: seg.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Combined Revenue: <strong className="text-slate-200">₹{Math.round(seg.spend).toLocaleString('en-IN')}</strong></span>
                    <span>AOV: <strong className="text-slate-300">₹{seg.count > 0 ? Math.round(seg.spend / seg.count).toLocaleString('en-IN') : 0}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. CUSTOMER PERFORMANCE TABLE */}
      <div className="p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-purple-400" />
              Customer Base Records ({filteredTableData.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified customer records with masked contact data for privacy
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search customers or phone..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-56 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
              />
            </div>

            {/* Segment Filter */}
            <select
              value={selectedSegmentFilter}
              onChange={e => { setSelectedSegmentFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
            >
              <option value="ALL">All Segments</option>
              <option value="New">New Customers</option>
              <option value="Repeat">Repeat Purchasers</option>
              <option value="VIP / High-Value">VIP / High-Value</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('customerName')}>
                    <span className="flex items-center gap-1">Customer <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3">Phone / Identifier</th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('totalOrders')}>
                    <span className="flex items-center justify-end gap-1">Total Orders <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('totalSpend')}>
                    <span className="flex items-center justify-end gap-1">Total Spend <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('aov')}>
                    <span className="flex items-center justify-end gap-1">Avg Order Value <ArrowUpDown size={11} /></span>
                  </th>
                  <th className="py-2.5 px-3">First Order</th>
                  <th className="py-2.5 px-3">Last Order</th>
                  <th className="py-2.5 px-3 text-right">Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedTableData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                      No matching customer records found.
                    </td>
                  </tr>
                ) : (
                  paginatedTableData.map(c => (
                    <tr 
                      key={c.customerKey}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center text-[10px] font-bold">
                            {c.customerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[150px]">{c.customerName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                        {c.maskedPhone}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                        {c.totalOrders}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        ₹{Math.round(c.totalSpend).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        ₹{c.aov.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {formatSalesDateShort(c.firstOrderDate)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {formatSalesDateShort(c.lastOrderDate)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.segment === 'VIP / High-Value'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : (c.segment === 'Repeat'
                                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20')
                        }`}>
                          {c.segment}
                        </span>
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
    </div>
  );
};
