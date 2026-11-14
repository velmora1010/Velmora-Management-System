import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Repeat, 
  Search, 
  X, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Download, 
  ArrowLeft,
  Calendar,
  AlertCircle
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import { 
  normalizeCustomerPhone, 
  maskCustomerPhone, 
  normalizeCityName, 
  normalizeStateName, 
  normalizeProductName 
} from '../../../../services/customerRepeatAnalyticsService';
import { formatDateRangeDisplay } from '../websiteSalesUtils';
import toast from 'react-hot-toast';

export interface RepeatCustomerOrderHistoryItem {
  id: string;
  orderId: string;
  orderDate: string;
  products: string;
  price: number;
}

export interface PeriodRepeatCustomer {
  customerKey: string;
  name: string;
  phone: string;
  maskedPhone: string;
  city: string;
  state: string;
  ordersCount: number;
  totalValue: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  orders: RepeatCustomerOrderHistoryItem[];
}

export type RepeatCustomerBucket = 'all' | '2' | '3' | '4' | '5plus';

interface RepeatCustomerSummarySectionProps {
  orders: WebsiteConsolidatedOrder[];
  startDate?: string;
  endDate?: string;
  onNavigateToOrder?: (orderId: string) => void;
  className?: string;
}

export const RepeatCustomerSummarySection: React.FC<RepeatCustomerSummarySectionProps> = ({
  orders,
  startDate,
  endDate,
  onNavigateToOrder,
  className = ''
}) => {
  // Modal states
  const [activeBucketModal, setActiveBucketModal] = useState<RepeatCustomerBucket | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [showMaskedPhone, setShowMaskedPhone] = useState<boolean>(true);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<PeriodRepeatCustomer | null>(null);

  // 1. Process orders in the current period and group by customer
  const {
    allRepeatCustomers,
    twoOrdersList,
    threeOrdersList,
    fourOrdersList,
    fivePlusOrdersList
  } = useMemo(() => {
    const seenOrderIds = new Set<string>();
    const validOrders: WebsiteConsolidatedOrder[] = [];

    // Filter valid orders and deduplicate by order ID
    for (const o of orders) {
      const isCancelled = o.order_status === 'CANCELLED' ||
        o.cancellation?.status === 'CANCELLED' ||
        Boolean(o.cancelled_at);
      const finStatus = (o.financial_status || '').toLowerCase();
      const isRefunded = finStatus === 'refunded' || finStatus === 'voided';
      if (isCancelled || isRefunded) continue;

      const cleanId = String(o.order_id || o.id || '').trim().toLowerCase();
      if (!cleanId || seenOrderIds.has(cleanId)) continue;
      seenOrderIds.add(cleanId);
      validOrders.push(o);
    }

    // Group valid orders by customer key
    const customerMap = new Map<string, {
      customerKey: string;
      name: string;
      phone: string;
      city: string;
      state: string;
      orders: RepeatCustomerOrderHistoryItem[];
    }>();

    for (const o of validOrders) {
      const phone = normalizeCustomerPhone(o.phone);
      const email = (o.email || '').toLowerCase().trim();
      const cleanOrderId = String(o.order_id || '').trim().toLowerCase();

      let custKey = '';
      if (phone) {
        custKey = `phone_${phone}`;
      } else if (email) {
        custKey = `email_${email}`;
      } else if ((o as any).customer_id) {
        custKey = `custid_${(o as any).customer_id}`;
      } else {
        custKey = `order_${cleanOrderId || o.id}`;
      }

      const rawCity = o.city || (o as any).canonicalCity;
      const rawState = o.state || (o as any).canonicalState;
      const normCity = normalizeCityName(rawCity);
      const normState = normalizeStateName(rawState);

      // Format individual order products with quantities
      let productsStr = '';
      if (o.items && o.items.length > 0) {
        const prodMap = new Map<string, number>();
        o.items.forEach(it => {
          const p = normalizeProductName(it.product_name);
          prodMap.set(p, (prodMap.get(p) || 0) + (Number(it.quantity) || 1));
        });
        productsStr = Array.from(prodMap.entries())
          .map(([name, qty]) => `${name} × ${qty}`)
          .join('; ');
      } else if (o.order_formatted && o.order_formatted.trim()) {
        productsStr = normalizeProductName(o.order_formatted);
      } else {
        const fallback = normalizeProductName(o.product_name);
        productsStr = `${fallback} × ${o.total_quantity || 1}`;
      }

      const orderItem: RepeatCustomerOrderHistoryItem = {
        id: o.id,
        orderId: o.order_id,
        orderDate: o.order_date || '',
        products: productsStr,
        price: Number(o.price) || 0
      };

      if (!customerMap.has(custKey)) {
        customerMap.set(custKey, {
          customerKey: custKey,
          name: o.customer_name || 'Customer',
          phone: phone || o.phone || '',
          city: normCity,
          state: normState,
          orders: []
        });
      }

      customerMap.get(custKey)!.orders.push(orderItem);
    }

    // Keep only customers with 2+ valid orders in selected period
    const repeatList: PeriodRepeatCustomer[] = Array.from(customerMap.values())
      .filter(c => c.orders.length >= 2)
      .map(c => {
        // Chronological order (oldest to newest)
        const sortedOrders = [...c.orders].sort((a, b) => {
          const dateCmp = (a.orderDate || '').localeCompare(b.orderDate || '');
          if (dateCmp !== 0) return dateCmp;
          return String(a.orderId || '').localeCompare(String(b.orderId || ''));
        });

        const totalValue = sortedOrders.reduce((sum, ord) => sum + ord.price, 0);
        const ordersCount = sortedOrders.length;
        const avgOrderValue = ordersCount > 0 ? Math.round(totalValue / ordersCount) : 0;

        return {
          customerKey: c.customerKey,
          name: c.name,
          phone: c.phone,
          maskedPhone: maskCustomerPhone(c.phone),
          city: c.city,
          state: c.state,
          ordersCount,
          totalValue,
          avgOrderValue,
          firstOrderDate: sortedOrders[0]?.orderDate || 'N/A',
          lastOrderDate: sortedOrders[sortedOrders.length - 1]?.orderDate || 'N/A',
          orders: sortedOrders
        };
      })
      // Default sort: highest orders count desc, then total value desc
      .sort((a, b) => (b.ordersCount - a.ordersCount) || (b.totalValue - a.totalValue));

    const c2 = repeatList.filter(c => c.ordersCount === 2);
    const c3 = repeatList.filter(c => c.ordersCount === 3);
    const c4 = repeatList.filter(c => c.ordersCount === 4);
    const c5plus = repeatList.filter(c => c.ordersCount >= 5);

    return {
      allRepeatCustomers: repeatList,
      twoOrdersList: c2,
      threeOrdersList: c3,
      fourOrdersList: c4,
      fivePlusOrdersList: c5plus
    };
  }, [orders]);

  // Active list based on selected modal bucket
  const activeBucketCustomers = useMemo(() => {
    switch (activeBucketModal) {
      case '2':
        return twoOrdersList;
      case '3':
        return threeOrdersList;
      case '4':
        return fourOrdersList;
      case '5plus':
        return fivePlusOrdersList;
      case 'all':
      default:
        return allRepeatCustomers;
    }
  }, [activeBucketModal, allRepeatCustomers, twoOrdersList, threeOrdersList, fourOrdersList, fivePlusOrdersList]);

  // Filtered by search within modal
  const filteredModalCustomers = useMemo(() => {
    if (!modalSearch.trim()) return activeBucketCustomers;
    const q = modalSearch.toLowerCase().trim();
    return activeBucketCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q)
    );
  }, [activeBucketCustomers, modalSearch]);

  const dateHeaderSuffix = useMemo(() => {
    if (startDate && endDate) {
      return formatDateRangeDisplay(startDate, endDate);
    }
    return '';
  }, [startDate, endDate]);

  const handleOpenBucket = (bucket: RepeatCustomerBucket) => {
    setActiveBucketModal(bucket);
    setModalSearch('');
    setSelectedCustomerForHistory(null);
  };

  const handleExportCSV = () => {
    if (filteredModalCustomers.length === 0) {
      toast.error('No repeat customers to export');
      return;
    }

    const headers = [
      'Rank',
      'Customer Name',
      'Phone',
      'City',
      'State',
      'Orders in Period',
      'Repeat Count in Period',
      'Total Spend (INR)',
      'AOV (INR)',
      'First Order Date',
      'Last Order Date',
      'Order IDs',
      'Order Dates'
    ];

    const rows = filteredModalCustomers.map((c, idx) => [
      idx + 1,
      `"${c.name.replace(/"/g, '""')}"`,
      c.phone,
      `"${c.city.replace(/"/g, '""')}"`,
      `"${c.state.replace(/"/g, '""')}"`,
      c.ordersCount,
      c.ordersCount - 1,
      c.totalValue.toFixed(2),
      c.avgOrderValue,
      c.firstOrderDate,
      c.lastOrderDate,
      `"${c.orders.map(o => o.orderId).join('; ').replace(/"/g, '""')}"`,
      `"${c.orders.map(o => o.orderDate).join('; ').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const rangeTag = startDate ? `${startDate}_to_${endDate || startDate}` : 'period';
    link.download = `repeat_customers_${activeBucketModal || 'all'}_${rangeTag}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredModalCustomers.length} repeat customers to CSV`);
  };

  const formatDisplayDate = (d: string) => {
    if (!d || d === 'N/A') return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const [y, m, day] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(m, 10) - 1];
    return monthName ? `${day} ${monthName} ${y}` : d;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <Repeat size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <span>Repeat Customer Summary</span>
            {dateHeaderSuffix && (
              <span className="text-xs font-normal normal-case text-slate-400 tracking-normal hidden sm:inline">
                ({dateHeaderSuffix})
              </span>
            )}
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          Click any card to inspect repeat customers in selected period
        </span>
      </div>

      {/* 5 REPEAT CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Repeat Customers */}
        <div 
          onClick={() => handleOpenBucket('all')}
          className="p-4 sm:p-5 border-t-4 border-t-indigo-500 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl backdrop-blur-sm transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          title="Click to view all repeat customers with 2+ valid orders in selected period"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Repeat Customers
              </span>
              <Users size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-indigo-400">
              {allRepeatCustomers.length.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>2+ valid orders</span>
            <ChevronRight size={13} className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Card 2: 2 Orders */}
        <div 
          onClick={() => handleOpenBucket('2')}
          className="p-4 sm:p-5 border-t-4 border-t-blue-500 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-xl backdrop-blur-sm transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          title="Click to view customers with exactly 2 valid orders in selected period"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                2 Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-400">
              {twoOrdersList.length.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Exactly 2 orders</span>
            <ChevronRight size={13} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Card 3: 3 Orders */}
        <div 
          onClick={() => handleOpenBucket('3')}
          className="p-4 sm:p-5 border-t-4 border-t-emerald-500 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl backdrop-blur-sm transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          title="Click to view customers with exactly 3 valid orders in selected period"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                3 Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
              {threeOrdersList.length.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Exactly 3 orders</span>
            <ChevronRight size={13} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Card 4: 4 Orders */}
        <div 
          onClick={() => handleOpenBucket('4')}
          className="p-4 sm:p-5 border-t-4 border-t-amber-500 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-xl backdrop-blur-sm transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          title="Click to view customers with exactly 4 valid orders in selected period"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                4 Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
              {fourOrdersList.length.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Exactly 4 orders</span>
            <ChevronRight size={13} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Card 5: 5+ Orders */}
        <div 
          onClick={() => handleOpenBucket('5plus')}
          className="p-4 sm:p-5 border-t-4 border-t-pink-500 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-pink-500/50 rounded-xl backdrop-blur-sm transition-all duration-200 cursor-pointer group flex flex-col justify-between col-span-2 sm:col-span-1"
          title="Click to view customers with 5 or more valid orders in selected period"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                5+ Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-pink-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-pink-400">
              {fivePlusOrdersList.length.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>5 or more orders</span>
            <ChevronRight size={13} className="text-slate-500 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: REPEAT CUSTOMERS LIST FOR SELECTED BUCKET
         ========================================================================= */}
      {activeBucketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/70">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>
                      {activeBucketModal === 'all' && 'Total Repeat Customers in Selected Period'}
                      {activeBucketModal === '2' && 'Customers with Exactly 2 Orders in Period'}
                      {activeBucketModal === '3' && 'Customers with Exactly 3 Orders in Period'}
                      {activeBucketModal === '4' && 'Customers with Exactly 4 Orders in Period'}
                      {activeBucketModal === '5plus' && 'Customers with 5+ Orders in Period'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                      {filteredModalCustomers.length} {filteredModalCustomers.length === 1 ? 'Customer' : 'Customers'}
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <Calendar size={13} className="text-slate-500" />
                  <span>{dateHeaderSuffix || 'Selected Period'}</span>
                  <span>•</span>
                  <span>Orders within this timeframe only (lifetime history excluded)</span>
                </p>
              </div>

              <button
                onClick={() => setActiveBucketModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sub-header / Filter Tabs & Search Controls */}
            <div className="p-3 sm:px-5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              {/* Category Segment Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs overflow-x-auto">
                <button
                  onClick={() => setActiveBucketModal('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeBucketModal === 'all' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({allRepeatCustomers.length})
                </button>
                <button
                  onClick={() => setActiveBucketModal('2')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeBucketModal === '2' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2 Orders ({twoOrdersList.length})
                </button>
                <button
                  onClick={() => setActiveBucketModal('3')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeBucketModal === '3' 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3 Orders ({threeOrdersList.length})
                </button>
                <button
                  onClick={() => setActiveBucketModal('4')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeBucketModal === '4' 
                      ? 'bg-amber-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  4 Orders ({fourOrdersList.length})
                </button>
                <button
                  onClick={() => setActiveBucketModal('5plus')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeBucketModal === '5plus' 
                      ? 'bg-pink-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  5+ Orders ({fivePlusOrdersList.length})
                </button>
              </div>

              {/* Search, Mask, and CSV Export */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    placeholder="Search name, phone, city..."
                    className="h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowMaskedPhone(prev => !prev)}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  title={showMaskedPhone ? 'Show unmasked phone numbers' : 'Mask phone numbers'}
                >
                  {showMaskedPhone ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span className="hidden sm:inline">{showMaskedPhone ? 'Unmask' : 'Mask'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Export filtered list to CSV"
                >
                  <Download size={12} />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-y-auto flex-1 custom-scrollbar p-3 sm:p-5">
              {filteredModalCustomers.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                  <AlertCircle size={32} className="text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">
                    No repeat customers found in this category for the selected period.
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {modalSearch
                      ? 'No customers match your search query. Try clearing the search box.'
                      : 'None of the customers placed multiple valid orders during this date or date range.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2.5 w-10">#</th>
                        <th className="px-3 py-2.5">Customer Name</th>
                        <th className="px-3 py-2.5">Phone Number</th>
                        <th className="px-3 py-2.5">Location</th>
                        <th className="px-3 py-2.5 text-center">Orders in Period</th>
                        <th className="px-3 py-2.5 text-right">Total Spend</th>
                        <th className="px-3 py-2.5 text-right">AOV</th>
                        <th className="px-3 py-2.5">1st Order Date</th>
                        <th className="px-3 py-2.5">Last Order Date</th>
                        <th className="px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {filteredModalCustomers.map((cust, idx) => (
                        <tr 
                          key={cust.customerKey}
                          className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedCustomerForHistory(cust)}
                        >
                          <td className="px-3 py-2.5">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{cust.name}</span>
                              {cust.ordersCount >= 5 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  VIP
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-300">
                            {showMaskedPhone ? cust.maskedPhone : cust.phone}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            {cust.city}, {cust.state}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-indigo-900/50 text-indigo-300 border border-indigo-700/40">
                              {cust.ordersCount} orders
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400">
                            ₹{cust.totalValue.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-purple-300">
                            ₹{cust.avgOrderValue.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">
                            {formatDisplayDate(cust.firstOrderDate)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">
                            {formatDisplayDate(cust.lastOrderDate)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomerForHistory(cust);
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-600/30 text-indigo-300 hover:text-white hover:bg-indigo-600 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              View History →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Total in this category: <strong className="text-white font-mono">{filteredModalCustomers.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveBucketModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CUSTOMER ORDER HISTORY (Individual Orders in Period)
         ========================================================================= */}
      {selectedCustomerForHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForHistory(null)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer mr-1"
                    title="Back to list"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <h3 className="text-base font-bold text-white">{selectedCustomerForHistory.name}</h3>
                  {selectedCustomerForHistory.ordersCount >= 5 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      VIP Buyer
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span className="font-mono text-slate-300">
                    {showMaskedPhone ? selectedCustomerForHistory.maskedPhone : selectedCustomerForHistory.phone}
                  </span>
                  <span>•</span>
                  <span>{selectedCustomerForHistory.city}, {selectedCustomerForHistory.state}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Metrics Row */}
            <div className="p-4 sm:p-5 grid grid-cols-3 gap-3 bg-slate-950/40 border-b border-slate-800/60">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Orders in Period</span>
                <div className="text-xl font-mono font-bold text-indigo-400 mt-1">
                  {selectedCustomerForHistory.ordersCount}
                </div>
                <span className="text-[10px] text-slate-500">+{selectedCustomerForHistory.ordersCount - 1} repeat in period</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Spend in Period</span>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                  ₹{selectedCustomerForHistory.totalValue.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500">Net purchases</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AOV in Period</span>
                <div className="text-xl font-mono font-bold text-purple-300 mt-1">
                  ₹{selectedCustomerForHistory.avgOrderValue.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500">Per order avg</span>
              </div>
            </div>

            {/* Order History Table */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Order History in Period ({selectedCustomerForHistory.orders.length} Valid Orders)
              </h4>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[540px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 w-11">#</th>
                      <th className="px-3 py-2 w-24">Order ID</th>
                      <th className="px-3 py-2 w-32">Order Date</th>
                      <th className="px-3 py-2">Products Purchased</th>
                      <th className="px-3 py-2 text-right w-24">Amount</th>
                      {onNavigateToOrder && <th className="px-3 py-2 text-right w-24">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {selectedCustomerForHistory.orders.map((ord, idx) => (
                      <tr key={ord.orderId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-white whitespace-nowrap">
                          {ord.orderId}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 font-mono text-[11px] whitespace-nowrap" title={ord.orderDate}>
                          {formatDisplayDate(ord.orderDate)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200 leading-relaxed">
                          {ord.products || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400 whitespace-nowrap">
                          ₹{ord.price.toLocaleString('en-IN')}
                        </td>
                        {onNavigateToOrder && (
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToOrder(ord.orderId);
                                setSelectedCustomerForHistory(null);
                                setActiveBucketModal(null);
                              }}
                              className="px-2 py-1 rounded bg-indigo-600/30 text-indigo-300 hover:text-white hover:bg-indigo-600 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              View →
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
