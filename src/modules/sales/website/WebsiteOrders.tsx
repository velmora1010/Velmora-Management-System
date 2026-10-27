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
  X
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
import { LogisticsFilterToolbar } from '../../Logistics/components/filters/LogisticsFilterToolbar';
import { AllFiltersModal } from '../../Logistics/components/filters/AllFiltersModal';
import { 
  LogisticsFilterState, 
  LogisticsSection, 
  INITIAL_LOGISTICS_FILTER_STATE,
  resolveDateRangeForPreset,
  formatRangeDisplay
} from '../../Logistics/types/logisticsFilters';
import { BulkAwbSearchInput } from '../../Logistics/components/filters/BulkAwbSearchInput';
import { LogisticsDateDropdown } from '../../Logistics/components/filters/LogisticsDateDropdown';
import { WebsiteFulfillmentDropdown } from './components/WebsiteFulfillmentDropdown';
import { WebsitePaymentDropdown } from './components/WebsitePaymentDropdown';

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

  // Selected Status for Horizontal Tab Bar
  const [selectedStatus, setSelectedStatus] = useState<string>('Pending AWB');
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

  // Active Filter Controls State
  const [fulfillmentStatuses, setFulfillmentStatuses] = useState<string[]>([]);
  const [paymentModes, setPaymentModes] = useState<string[]>([]);

  // Status-Specific Filter State
  const [logisticsFilters, setLogisticsFilters] = useState<LogisticsFilterState>({
    ...INITIAL_LOGISTICS_FILTER_STATE,
    activeSection: 'pending_awb'
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAllFiltersModalOpen, setIsAllFiltersModalOpen] = useState<boolean>(false);

  // Count active deep filters from AllFiltersModal
  const activeDeepFilterCount = React.useMemo(() => {
    let cnt = 0;
    if (logisticsFilters.transportModes.length > 0) cnt++;
    if (logisticsFilters.shipmentStatuses.length > 0) cnt++;
    if (logisticsFilters.pickupLocations.length > 0) cnt++;
    if (logisticsFilters.zones.length > 0) cnt++;
    if (logisticsFilters.channels.length > 0) cnt++;
    if (logisticsFilters.verifiedStatuses.length > 0) cnt++;
    if (logisticsFilters.orderTags.length > 0) cnt++;
    if (logisticsFilters.addressScores.length > 0) cnt++;
    if (logisticsFilters.riskOfReturn.length > 0) cnt++;
    return cnt;
  }, [logisticsFilters]);

  const hasAnyActiveFilter = 
    fulfillmentStatuses.length > 0 ||
    paymentModes.length > 0 ||
    Boolean(searchTerm.trim()) ||
    logisticsFilters.datePreset !== 'all' ||
    Boolean(logisticsFilters.startDate) ||
    activeDeepFilterCount > 0;

  const handleClearAllFilters = () => {
    setFulfillmentStatuses([]);
    setPaymentModes([]);
    setSearchTerm('');
    setLogisticsFilters(prev => ({
      ...INITIAL_LOGISTICS_FILTER_STATE,
      activeSection: prev.activeSection
    }));
    setPage(1);
    toast.success('All filters cleared');
  };

  // Status to Section Mapping
  const statusToSectionMap: Record<string, LogisticsSection> = {
    'Pending AWB': 'pending_awb',
    'Ready to Ship': 'ready_to_ship',
    'Ready for Pickup': 'ready_for_pickup',
    'In Transit': 'in_transit',
    'RTO - In Transit': 'rto_in_transit',
    'Delivered': 'delivered',
    'All Shipments': 'all_shipments'
  };

  // Mapped orders for filter calculations
  const mappedForFilters = React.useMemo(() => {
    return orders.map(o => ({
      id: o.order_id,
      orderId: o.order_id,
      displayOrderId: o.order_id,
      customerName: o.customer_name,
      phoneNumber: o.phone,
      shippingAddress: o.address,
      city: o.city,
      state: o.state,
      pincode: o.pincode,
      amount: o.price || 0,
      orderType: o.payment_mode,
      paymentMode: o.payment_mode,
      courier: o.courier || '',
      awbNumber: o.awb_number || '',
      status: o.shipment_status || 'Pending',
      workflowStage: (o.fulfillment_status || 'unfulfilled').toLowerCase(),
      orderDate: o.order_date
    } as any));
  }, [orders]);

  // Status Navigation Configuration (7 options as compact horizontal cards)
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
      id: 'Ready to Ship',
      label: 'Ready to Ship',
      count: statusCounts.readyToShip,
      icon: Package,
      color: 'text-indigo-400',
      badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
    },
    {
      id: 'Ready for Pickup',
      label: 'Ready for Pickup',
      count: statusCounts.readyForPickup,
      icon: Send,
      color: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'In Transit',
      label: 'In Transit',
      count: statusCounts.inTransit,
      icon: Truck,
      color: 'text-purple-400',
      badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    },
    {
      id: 'RTO - In Transit',
      label: 'RTO - In Transit',
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
      id: 'All Shipments',
      label: 'All Shipments',
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

  // Fetch paginated orders from server filtered by selected status and filters
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      let dateFrom = logisticsFilters.startDate;
      let dateTo = logisticsFilters.endDate;
      if (logisticsFilters.datePreset !== 'all' && logisticsFilters.datePreset !== 'custom') {
        const r = resolveDateRangeForPreset(logisticsFilters.datePreset);
        dateFrom = r.start;
        dateTo = r.end;
      }

      let manifestFrom = logisticsFilters.manifestStartDate;
      let manifestTo = logisticsFilters.manifestEndDate;
      if (logisticsFilters.manifestDatePreset !== 'all' && logisticsFilters.manifestDatePreset !== 'custom') {
        const rm = resolveDateRangeForPreset(logisticsFilters.manifestDatePreset);
        manifestFrom = rm.start;
        manifestTo = rm.end;
      }

      let deliveredFrom = logisticsFilters.deliveredStartDate;
      let deliveredTo = logisticsFilters.deliveredEndDate;
      if (logisticsFilters.deliveredDatePreset !== 'all' && logisticsFilters.deliveredDatePreset !== 'custom') {
        const rd = resolveDateRangeForPreset(logisticsFilters.deliveredDatePreset);
        deliveredFrom = rd.start;
        deliveredTo = rd.end;
      }

      const res = await websiteSalesService.getOrdersPaginated({
        page,
        pageSize,
        search: searchTerm,
        dateFrom,
        dateTo,
        manifestDateFrom: manifestFrom,
        manifestDateTo: manifestTo,
        deliveredDateFrom: deliveredFrom,
        deliveredDateTo: deliveredTo,
        paymentModes: paymentModes.length > 0 ? paymentModes : logisticsFilters.paymentModes,
        fulfillmentStatuses: fulfillmentStatuses,
        transportModes: logisticsFilters.transportModes,
        shipmentModes: logisticsFilters.shipmentStatuses,
        pickupLocations: logisticsFilters.pickupLocations,
        riskOfReturn: logisticsFilters.riskOfReturn,
        channels: logisticsFilters.channels,
        verifiedStatuses: logisticsFilters.verifiedStatuses,
        orderTags: logisticsFilters.orderTags,
        addressScores: logisticsFilters.addressScores,
        zones: logisticsFilters.zones,
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
  }, [page, pageSize, selectedStatus, logisticsFilters, searchTerm, fulfillmentStatuses, paymentModes]);

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

  // Sync Orders action
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
      
      {/* 1. COMPACT HEADER AREA: Simplified layout with only the Refresh icon button aligned to the right */}
      <div className="flex items-center justify-end -mb-1">
        <button
          type="button"
          onClick={() => {
            loadStatusCounts();
            loadOrders();
            toast.success('Orders refreshed');
          }}
          disabled={loading}
          className="h-9 w-9 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
          title="Refresh Orders"
          aria-label="Refresh Orders"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-purple-400' : ''} />
        </button>
      </div>

      {/* 2. FULL-WIDTH HORIZONTAL SHIPMENT STATUS ROW */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-3">
        
        {/* Row Header with "Orders" / "Shipment Status" & "Sync orders" Button */}
        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-indigo-400" />
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight">Shipment Status</span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">• Click to filter orders by fulfillment stage</span>
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

        {/* 7 Horizontally Arranged Selectable Status Items */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
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
                  const sec = statusToSectionMap[item.id] || 'all_shipments';
                  setLogisticsFilters(prev => ({
                    ...prev,
                    activeSection: sec,
                    shipmentStatuses: [],
                    manifestStartDate: '',
                    manifestEndDate: '',
                    manifestDatePreset: 'all',
                    deliveredStartDate: '',
                    deliveredEndDate: '',
                    deliveredDatePreset: 'all',
                    returnedStartDate: '',
                    returnedEndDate: '',
                    returnedDatePreset: 'all'
                  }));
                }}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-indigo-600/25 text-white font-bold border-indigo-500 shadow-sm shadow-indigo-500/10'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border-slate-800/90 font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Icon size={14} className={isActive ? 'text-indigo-400 shrink-0' : `${item.color} shrink-0`} />
                  <span className="truncate text-left text-[11px] sm:text-xs">{item.label}</span>
                </div>

                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] sm:text-[11px] font-bold border shrink-0 ${
                  isActive
                    ? 'bg-indigo-500 text-white border-indigo-400 shadow-inner'
                    : item.badgeBg
                }`}>
                  {item.count.toLocaleString('en-IN')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. FUNCTIONAL FILTER TOOLBAR BELOW SHIPMENT STATUS */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-3">
        {/* Main Toolbar Row: Search, Date Range, Fulfillment Status, Payment Mode, All Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full">
          {/* Search Input with Mode Selector */}
          <div className="w-full sm:w-64 md:w-72 shrink-0">
            <BulkAwbSearchInput
              searchMode={logisticsFilters.searchMode}
              onSearchModeChange={mode => setLogisticsFilters(prev => ({ ...prev, searchMode: mode }))}
              searchTerm={searchTerm}
              onSearchTermChange={val => {
                setSearchTerm(val);
                setPage(1);
              }}
              bulkAwbs={logisticsFilters.bulkAwbs}
              onBulkAwbsChange={awbs => setLogisticsFilters(prev => ({ ...prev, bulkAwbs: awbs }))}
            />
          </div>

          {/* Date Range Dropdown */}
          <LogisticsDateDropdown
            label="Date Range"
            preset={logisticsFilters.datePreset}
            startDate={logisticsFilters.startDate}
            endDate={logisticsFilters.endDate}
            onApply={data => {
              setLogisticsFilters(prev => ({
                ...prev,
                datePreset: data.preset,
                startDate: data.startDate,
                endDate: data.endDate
              }));
              setPage(1);
            }}
            onClear={() => {
              setLogisticsFilters(prev => ({
                ...prev,
                datePreset: 'all',
                startDate: '',
                endDate: ''
              }));
              setPage(1);
            }}
          />

          {/* 1. Fulfillment Status Filter (Fulfilled, Unfulfilled) */}
          <WebsiteFulfillmentDropdown
            selectedStatuses={fulfillmentStatuses}
            onChange={statuses => {
              setFulfillmentStatuses(statuses);
              setPage(1);
            }}
          />

          {/* 2. Payment Mode Filter (Prepaid, COD, Partial COD) */}
          <WebsitePaymentDropdown
            selectedModes={paymentModes}
            onChange={modes => {
              setPaymentModes(modes);
              setLogisticsFilters(prev => ({ ...prev, paymentModes: modes }));
              setPage(1);
            }}
          />

          {/* All Filters Button */}
          <button
            type="button"
            onClick={() => setIsAllFiltersModalOpen(true)}
            className={`h-9 px-3 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ml-auto ${
              activeDeepFilterCount > 0
                ? 'bg-purple-950/70 border-purple-500 text-white'
                : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
            title="Open comprehensive filters"
          >
            <SlidersHorizontal size={13} className={activeDeepFilterCount > 0 ? 'text-purple-400' : 'text-slate-400'} />
            <span>All filters</span>
            {activeDeepFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white font-mono text-[10px] font-bold">
                {activeDeepFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips & Clear All Row */}
        {hasAnyActiveFilter && (
          <div className="flex items-center gap-2 pt-2.5 border-t border-slate-800/80 flex-wrap text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <SlidersHorizontal size={12} /> Active Filters:
            </span>

            {/* Date Range Chip */}
            {(logisticsFilters.datePreset !== 'all' || logisticsFilters.startDate) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-200 text-xs shrink-0">
                <span>Date: {formatRangeDisplay(logisticsFilters.startDate, logisticsFilters.endDate)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLogisticsFilters(prev => ({ ...prev, datePreset: 'all', startDate: '', endDate: '' }));
                    setPage(1);
                  }}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Remove date filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Fulfillment Status Chips */}
            {fulfillmentStatuses.map(status => (
              <span key={status} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-200 text-xs shrink-0">
                <span>Fulfillment: {status}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFulfillmentStatuses(prev => prev.filter(s => s !== status));
                    setPage(1);
                  }}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title={`Remove ${status} fulfillment filter`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Payment Mode Chips */}
            {paymentModes.map(mode => (
              <span key={mode} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-700/50 text-purple-200 text-xs shrink-0">
                <span>Payment: {mode}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModes(prev => prev.filter(m => m !== mode));
                    setLogisticsFilters(prev => ({ ...prev, paymentModes: prev.paymentModes.filter(m => m !== mode) }));
                    setPage(1);
                  }}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title={`Remove ${mode} payment filter`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Search Query Chip */}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs shrink-0">
                <span>Search: "{searchTerm}"</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setPage(1);
                  }}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Clear search query"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Clear All button */}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium ml-auto cursor-pointer pl-2 shrink-0"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* 4. FULL-WIDTH ORDERS DATA TABLE */}
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
            {selectedStatus !== 'All Shipments' && (
              <button
                onClick={() => {
                  setSelectedStatus('All Shipments');
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

      {/* 5. ORDER DETAILS DEDICATED MODAL */}
            {/* 5. ALL FILTERS CATEGORY PANEL MODAL */}
      <AllFiltersModal
        isOpen={isAllFiltersModalOpen}
        onClose={() => setIsAllFiltersModalOpen(false)}
        filters={logisticsFilters}
        onApply={(nextFilters) => {
          setLogisticsFilters(nextFilters);
          setIsAllFiltersModalOpen(false);
          setPage(1);
        }}
        orders={mappedForFilters}
      />

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
