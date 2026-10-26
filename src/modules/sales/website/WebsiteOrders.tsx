import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Calendar, 
  SlidersHorizontal, 
  RefreshCw, 
  Download, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  X, 
  RotateCcw,
  User,
  Phone,
  MapPin,
  Tag,
  CreditCard,
  Truck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  PackageCheck
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from './types';
import { websiteSalesService } from './websiteSalesService';
import { 
  formatPhoneNumber, 
  formatSalesDateDisplay,
  exportOrdersToCSV,
  exportOrdersToXLSX,
  cleanOrderId
} from './websiteSalesUtils';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { useWebsiteSalesDateRange } from './context/WebsiteSalesDateRangeContext';
import toast from 'react-hot-toast';

export const WebsiteOrders: React.FC = () => {
  // Data State
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('ALL');
  const [fulfillmentStatus, setFulfillmentStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'order_date' | 'order_id' | 'order_total'>('order_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Selected Order for Details View
  const [selectedOrder, setSelectedOrder] = useState<WebsiteConsolidatedOrder | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Calculate actual date boundaries from preset
  const getDateRangeBounds = useCallback(() => {
    const now = new Date();
    const toYMD = (d: Date) => d.toISOString().slice(0, 10);

    if (dateRangePreset === 'all') {
      return { dateFrom: undefined, dateTo: undefined };
    }
    if (dateRangePreset === 'today') {
      const today = toYMD(now);
      return { dateFrom: today, dateTo: today };
    }
    if (dateRangePreset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYMD(yest);
      return { dateFrom: yestStr, dateTo: yestStr };
    }
    if (dateRangePreset === '7days') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      return { dateFrom: toYMD(past7), dateTo: toYMD(now) };
    }
    if (dateRangePreset === '30days') {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 29);
      return { dateFrom: toYMD(past30), dateTo: toYMD(now) };
    }
    if (dateRangePreset === 'custom') {
      return { 
        dateFrom: customDateFrom || undefined, 
        dateTo: customDateTo || undefined 
      };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [dateRangePreset, customDateFrom, customDateTo]);

  // Fetch paginated orders from server
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDateRangeBounds();
      const res = await websiteSalesService.getOrdersPaginated({
        page,
        pageSize,
        search: debouncedSearch,
        dateFrom,
        dateTo,
        paymentMode,
        fulfillmentStatus,
        sortBy,
        sortOrder
      });

      setOrders(res.orders);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      toast.error(`Error loading orders: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, getDateRangeBounds, paymentMode, fulfillmentStatus, sortBy, sortOrder]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Listen for upload updates from modal
  useEffect(() => {
    const handleUpdate = () => {
      loadOrders();
    };
    window.addEventListener('velmora:website_sales_updated', handleUpdate);
    return () => window.removeEventListener('velmora:website_sales_updated', handleUpdate);
  }, [loadOrders]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setDateRangePreset('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setPaymentMode('ALL');
    setFulfillmentStatus('ALL');
    setSortBy('order_date');
    setSortOrder('desc');
    setPage(1);
    toast.success('Filters reset to All Orders');
  };

  // Export current results
  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (orders.length === 0) {
      toast.error('No orders available to export');
      return;
    }
    setIsExporting(true);
    try {
      const { dateFrom, dateTo } = getDateRangeBounds();
      // Fetch up to 2000 orders matching current filters for export
      const exportData = await websiteSalesService.getOrdersPaginated({
        page: 1,
        pageSize: 100, // Export current view or larger batch
        search: debouncedSearch,
        dateFrom,
        dateTo,
        paymentMode,
        fulfillmentStatus,
        sortBy,
        sortOrder
      });

      const filename = `website_orders_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        exportOrdersToCSV(exportData.orders, filename);
        toast.success(`Exported ${exportData.orders.length} orders to CSV`);
      } else {
        exportOrdersToXLSX(exportData.orders, filename);
        toast.success(`Exported ${exportData.orders.length} orders to Excel`);
      }
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters = 
    search.trim() !== '' || 
    dateRangePreset !== 'all' || 
    paymentMode !== 'ALL' || 
    fulfillmentStatus !== 'ALL';

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-200">
      
      {/* 1. TOP HEADER & METRIC BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
            <ShoppingBag size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Website Sales Orders
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                {totalCount.toLocaleString('en-IN')} Total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live orders repository synced from spreadsheet uploads and Logistics fulfillment.
            </p>
          </div>
        </div>

        {/* Action buttons: Export & Refresh */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={isExporting || totalCount === 0}
            className="h-[38px] px-3.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Export filtered orders to CSV"
          >
            <Download size={13} className="text-indigo-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting || totalCount === 0}
            className="h-[38px] px-3.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Export filtered orders to Excel"
          >
            <FileSpreadsheet size={13} className="text-emerald-400" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="h-[38px] w-[38px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
            title="Refresh Orders"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* SEARCH INPUT */}
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, AWB..."
              className="w-full h-[40px] pl-9 pr-8 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-purple-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors shadow-inner font-mono"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* DATE RANGE PRESET SELECTOR */}
          <div>
            <select
              value={dateRangePreset}
              onChange={e => {
                setDateRangePreset(e.target.value as any);
                setPage(1);
              }}
              className="w-full h-[40px] px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-white font-medium outline-none transition-colors shadow-inner cursor-pointer"
            >
              <option value="all">📅 Date: All Time (All Orders)</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* PAYMENT MODE SELECTOR */}
          <div>
            <select
              value={paymentMode}
              onChange={e => {
                setPaymentMode(e.target.value);
                setPage(1);
              }}
              className="w-full h-[40px] px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-white font-medium outline-none transition-colors shadow-inner cursor-pointer"
            >
              <option value="ALL">💳 Payment: All Modes</option>
              <option value="PREPAID">Prepaid</option>
              <option value="PARTIAL COD">Partial COD</option>
              <option value="COD">Full COD</option>
            </select>
          </div>

          {/* FULFILLMENT STATUS SELECTOR */}
          <div>
            <select
              value={fulfillmentStatus}
              onChange={e => {
                setFulfillmentStatus(e.target.value);
                setPage(1);
              }}
              className="w-full h-[40px] px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-white font-medium outline-none transition-colors shadow-inner cursor-pointer"
            >
              <option value="ALL">📦 Fulfillment: All Statuses</option>
              <option value="FULFILLED">Fulfilled / Delivered</option>
              <option value="UNFULFILLED">Unfulfilled / Confirmed</option>
            </select>
          </div>

        </div>

        {/* CUSTOM DATE RANGE ROW (IF ACTIVE) */}
        {dateRangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
            <span className="text-xs text-slate-400 font-semibold">Custom Period:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateFrom}
                onChange={e => { setCustomDateFrom(e.target.value); setPage(1); }}
                className="h-[34px] px-2.5 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg outline-none font-mono"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customDateTo}
                onChange={e => { setCustomDateTo(e.target.value); setPage(1); }}
                className="h-[34px] px-2.5 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* ACTIVE FILTERS CHIP BAR */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Filtered By:</span>
              {search && (
                <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono">
                  Search: "{search}"
                </span>
              )}
              {dateRangePreset !== 'all' && (
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px]">
                  Date: {dateRangePreset}
                </span>
              )}
              {paymentMode !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                  Payment: {paymentMode}
                </span>
              )}
              {fulfillmentStatus !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                  Status: {fulfillmentStatus}
                </span>
              )}
            </div>

            <button
              onClick={handleResetFilters}
              className="text-xs text-purple-400 hover:text-purple-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={12} /> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* 3. ORDERS DATA TABLE */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-purple-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading orders from Supabase...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <AlertCircle size={36} className="text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No orders found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No orders matched the current search criteria or active filters.
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Reset Filters & View All
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Order ID & Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Products & Items</th>
                  <th className="py-3 px-4">Financials & Payment</th>
                  <th className="py-3 px-4">Fulfillment / Shipment</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {orders.map((o) => {
                  const displayPhone = formatPhoneNumber(o.phone);
                  const isMulti = o.items && o.items.length > 1;
                  const fStatus = (o.fulfillment_status || '').toLowerCase();
                  const isFulfilled = fStatus.includes('deliv') || fStatus.includes('fulfill') || fStatus.includes('ship');

                  return (
                    <tr 
                      key={o.id} 
                      className="hover:bg-slate-850/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOrder(o)}
                    >
                      {/* 1. ORDER ID & DATE */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                            #{cleanOrderId(o.order_id)}
                          </span>
                          {isMulti ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Multi
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-slate-800 text-slate-400">
                              Single
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <Calendar size={11} className="text-slate-500" />
                          <span>{formatSalesDateDisplay(o.order_date)}</span>
                        </div>
                        {o.batch_file_name && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={o.batch_file_name}>
                            {o.batch_file_name}
                          </div>
                        )}
                      </td>

                      {/* 2. CUSTOMER */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-semibold text-slate-200">
                          {o.customer_name || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <Phone size={11} className="text-slate-500" />
                          <span>{displayPhone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate max-w-[160px]">
                          <MapPin size={10} className="text-amber-400/80 shrink-0" />
                          <span>{[o.city, o.state].filter(s => s && s !== 'Unspecified').join(', ') || o.state || 'India'}</span>
                        </div>
                      </td>

                      {/* 3. PRODUCTS & ITEMS */}
                      <td className="py-3.5 px-4 space-y-1 max-w-[320px]">
                        <div className="font-medium text-slate-200 text-xs line-clamp-2 leading-relaxed">
                          {o.order_formatted || o.product_name}
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold font-mono">
                            {o.total_quantity || 1} {o.total_quantity === 1 ? 'unit' : 'units'}
                          </span>
                          {o.offer && o.offer !== 'No Offer' && (
                            <span className="text-[10px] text-purple-400 font-mono font-medium truncate max-w-[140px]">
                              🏷️ {o.offer}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. FINANCIALS & PAYMENT */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-mono font-bold text-sm text-emerald-400">
                          ₹{Math.round(o.price).toLocaleString('en-IN')}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.payment_mode === 'PREPAID'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : o.payment_mode === 'PARTIAL COD'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {o.payment_mode}
                          </span>
                          {o.payment_mode === 'PARTIAL COD' && (
                            <span className="text-[10px] text-pink-400 font-mono font-semibold">
                              (₹{Math.round(o.remaining_payable ?? 0).toLocaleString()} COD)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. FULFILLMENT / SHIPMENT */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isFulfilled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {o.fulfillment_status || 'Unfulfilled'}
                          </span>
                        </div>
                        {o.awb_number ? (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-300">
                            <Truck size={11} className="text-purple-400 shrink-0" />
                            <span className="truncate max-w-[130px]">{o.courier ? `${o.courier}: ` : ''}{o.awb_number}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic block">
                            Not manifested
                          </span>
                        )}
                      </td>

                      {/* 6. ACTIONS */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(o);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 mx-auto shadow-sm"
                        >
                          <Eye size={13} className="text-purple-400" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. SERVER-SIDE PAGINATION FOOTER */}
        {!loading && totalCount > 0 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            {/* Left: Showing range */}
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-white font-mono">{((page - 1) * pageSize) + 1}</strong> – <strong className="text-white font-mono">{Math.min(page * pageSize, totalCount)}</strong> of <strong className="text-white font-mono">{totalCount.toLocaleString('en-IN')}</strong> orders
              </span>

              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-[30px] px-2 bg-slate-900 border border-slate-800 text-white rounded-lg outline-none cursor-pointer text-xs font-mono"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Right: Page Navigation Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-3 py-1 font-mono text-white text-xs font-bold">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. ORDER DETAILS DEDICATED MODAL */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderDeleted={() => {
          setSelectedOrder(null);
          loadOrders();
        }}
      />

    </div>
  );
};
