import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  Package, 
  RefreshCw, 
  Download, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  User,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Send,
  Layers,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, ShipmentStatusCounts } from './types';
import { websiteSalesService } from './websiteSalesService';
import { 
  formatPhoneNumber, 
  formatSalesDateDisplay,
  exportOrdersToCSV,
  exportOrdersToXLSX,
  cleanOrderId
} from './websiteSalesUtils';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import toast from 'react-hot-toast';

export const WebsiteOrders: React.FC = () => {
  // Data State
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Shipment Status Sidebar Selection
  const [selectedStatus, setSelectedStatus] = useState<string>('All shipments');
  const [statusCounts, setStatusCounts] = useState<ShipmentStatusCounts>({
    all: 0,
    pendingAwb: 0,
    readyToShip: 0,
    readyForPickup: 0,
    inTransit: 0,
    rtoInTransit: 0,
    delivered: 0
  });

  // Selected Order for Details View Modal
  const [selectedOrder, setSelectedOrder] = useState<WebsiteConsolidatedOrder | null>(null);

  // Status Navigation Configuration (Image 2 exact items)
  const statusItems = [
    {
      id: 'Pending AWB',
      label: 'Pending AWB',
      count: statusCounts.pendingAwb,
      icon: Clock,
      color: 'text-amber-400',
      badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    },
    {
      id: 'Ready to ship',
      label: 'Ready to ship',
      count: statusCounts.readyToShip,
      icon: Package,
      color: 'text-indigo-400',
      badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
    },
    {
      id: 'Ready for pickup',
      label: 'Ready for pickup',
      count: statusCounts.readyForPickup,
      icon: Send,
      color: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'In transit',
      label: 'In transit',
      count: statusCounts.inTransit,
      icon: Truck,
      color: 'text-purple-400',
      badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    },
    {
      id: 'RTO - In transit',
      label: 'RTO - In transit',
      count: statusCounts.rtoInTransit,
      icon: RotateCcw,
      color: 'text-rose-400',
      badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    },
    {
      id: 'Delivered',
      label: 'Delivered',
      count: statusCounts.delivered,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'All shipments',
      label: 'All shipments',
      count: statusCounts.all,
      icon: Layers,
      color: 'text-slate-300',
      badgeBg: 'bg-slate-800 text-slate-300 border-slate-700'
    }
  ];

  // Fetch dynamic shipment counts directly from database
  const loadStatusCounts = useCallback(async () => {
    try {
      const counts = await websiteSalesService.getShipmentStatusCounts();
      setStatusCounts(counts);
    } catch (err: any) {
      console.error('Failed to load status counts:', err);
    }
  }, []);

  // Fetch paginated orders from server filtered by selected status
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await websiteSalesService.getOrdersPaginated({
        page,
        pageSize,
        shipmentStatus: selectedStatus,
        sortBy: 'order_date',
        sortOrder: 'desc'
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
  }, [page, pageSize, selectedStatus]);

  // Initial load
  useEffect(() => {
    loadStatusCounts();
  }, [loadStatusCounts]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Listen for upload updates from modal
  useEffect(() => {
    const handleUpdate = () => {
      loadStatusCounts();
      loadOrders();
    };
    window.addEventListener('velmora:website_sales_updated', handleUpdate);
    return () => window.removeEventListener('velmora:website_sales_updated', handleUpdate);
  }, [loadStatusCounts, loadOrders]);

  // Sync Orders action (Image 2 header button)
  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([loadStatusCounts(), loadOrders()]);
      toast.success('Orders synced with database');
    } catch (err: any) {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export current results
  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (orders.length === 0) {
      toast.error('No orders available to export');
      return;
    }
    setIsExporting(true);
    try {
      const exportData = await websiteSalesService.getOrdersPaginated({
        page: 1,
        pageSize: 100,
        shipmentStatus: selectedStatus,
        sortBy: 'order_date',
        sortOrder: 'desc'
      });

      const filename = `website_orders_${selectedStatus.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
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
            onClick={() => {
              loadStatusCounts();
              loadOrders();
            }}
            disabled={loading}
            className="h-[38px] w-[38px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
            title="Refresh Orders"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. MAIN LAYOUT: SIDEBAR (IMAGE 2) + MAIN CONTENT AREA */}
      <div className="flex flex-col lg:flex-row items-start gap-4">
        
        {/* SHIPMENT STATUS SIDEBAR (IMAGE 2 REFERENCE) */}
        <div className="w-full lg:w-64 shrink-0 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
          
          {/* Sidebar Header: "Orders" + "Sync orders" Button */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Package size={17} className="text-indigo-400" />
              <span className="text-sm font-bold text-white tracking-tight">Orders</span>
            </div>
            <button
              type="button"
              onClick={handleSyncOrders}
              disabled={isSyncing}
              className="h-7 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-700/60 cursor-pointer shadow-sm disabled:opacity-50"
              title="Sync orders with database"
            >
              <RefreshCw size={11} className={`text-indigo-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync orders</span>
            </button>
          </div>

          {/* Status List Navigation */}
          <nav className="space-y-1">
            {statusItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedStatus === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(item.id);
                    setPage(1);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-indigo-600/20 text-white font-bold border border-indigo-500/40 shadow-inner'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon size={14} className={isActive ? 'text-indigo-400' : item.color} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border shrink-0 ${
                    isActive
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : item.badgeBg
                  }`}>
                    {item.count.toLocaleString('en-IN')}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* RIGHT COLUMN: EMPTY FILTER AREA + ORDERS DATA TABLE */}
        <div className="flex-1 w-full min-w-0 space-y-4">
          
          {/* 3. CLEAN EMPTY PLACEHOLDER FILTER AREA */}
          <div className="min-h-[48px] px-4 py-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-500">
              <SlidersHorizontal size={14} className="text-slate-500" />
              <span className="italic">Filter controls placeholder — filters will be configured later</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400">Viewing:</span>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 text-xs">
                {selectedStatus} ({totalCount.toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          {/* 4. ORDERS DATA TABLE */}
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
                  No orders matched the "{selectedStatus}" status category.
                </p>
                {selectedStatus !== 'All shipments' && (
                  <button
                    onClick={() => {
                      setSelectedStatus('All shipments');
                      setPage(1);
                    }}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    View All Shipments
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

            {/* SERVER-SIDE PAGINATION FOOTER */}
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
        </div>
      </div>

      {/* 5. ORDER DETAILS DEDICATED MODAL */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderDeleted={() => {
          setSelectedOrder(null);
          loadStatusCounts();
          loadOrders();
        }}
      />

    </div>
  );
};
