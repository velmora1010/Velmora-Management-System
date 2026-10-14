import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/db';
import { 
  Truck, 
  Package, 
  RotateCcw,
  UploadCloud,
  Check,
  X,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { LogisticsOrder } from '../../types/logistics';
import type { 
  UnifiedLogisticsOrder, 
  UnifiedWorkflowStage,
  UnifiedTrackingStatus
} from '../../types/unifiedLogistics';
import { 
  fromDexieOrder, 
  groupOrdersIntoCustomers, 
  calculateWorkflowCounts,
  bulkMoveToPrepareDispatch,
  resetLogisticsDepartmentData
} from '../../services/unifiedLogisticsService';
import { LogisticsWorkflowToolbar } from './components/LogisticsWorkflowToolbar';
import { OrderCard } from './components/OrderCard';
import { OrderTableView } from './components/OrderTableView';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { OrderImportModal } from './components/OrderImportModal';
import { DispatchOrderModal } from './components/DispatchOrderModal';
import { TrackingModal } from './TrackingModal';
import { trackingEngine } from '../../services/tracking/trackingEngine';

// Status pills matching Image 2 exactly
const STATUS_PILLS: Array<{ id: string; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Exception', label: 'Exception' },
  { id: 'Failed Attempt', label: 'Failed Attempt' },
  { id: 'Pending', label: 'Pending' },
  { id: 'In Transit', label: 'In Transit' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Out for Delivery', label: 'Out for Delivery' },
  { id: 'Info Received', label: 'Info Received' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Re-Dispatch', label: 'Re-Dispatch' }
];

export const UnifiedLogisticsWorkspace: React.FC = () => {
  // Default Layout to Table (as in Image 2)
  const [orderLayout, setOrderLayout] = useState<'grid' | 'table'>('table');

  // Top Toolbar Workflow Stage: 'active' | 'pending' | 'prepare_dispatch' | 'dispatched' | 'tracking'
  const [currentStage, setCurrentStage] = useState<UnifiedWorkflowStage>('tracking');

  // Secondary Status Filter Pill (Image 2 style)
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('All');

  // Search & Courier Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string>('All');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Bulk Selection Mode
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isMovingToPrepare, setIsMovingToPrepare] = useState(false);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [orderToDispatch, setOrderToDispatch] = useState<UnifiedLogisticsOrder | null>(null);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<LogisticsOrder | null>(null);

  // Live Syncing State for Tracking
  const [syncingOrderIds, setSyncingOrderIds] = useState<Set<number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // 1. Live Query: All Dexie Logistics Orders (excluding trash)
  const dexieOrdersRaw = useLiveQuery(
    () => db.logistics_orders.where('stage').notEqual('trash').reverse().toArray(),
    []
  ) ?? [];

  // 2. Canonical Unified Orders: Transform Dexie orders
  const unifiedOrders = useMemo(() => {
    return dexieOrdersRaw.map(fromDexieOrder);
  }, [dexieOrdersRaw]);

  // 3. Canonical Customer Groupings for Detail Slide-overs
  const unifiedCustomers = useMemo(() => {
    return groupOrdersIntoCustomers(unifiedOrders);
  }, [unifiedOrders]);

  const activeCustomer = useMemo(() => {
    if (!selectedCustomerKey) return null;
    return unifiedCustomers.find(c => c.customerKey === selectedCustomerKey) || null;
  }, [selectedCustomerKey, unifiedCustomers]);

  // 4. Live Workflow Counts (Toolbar)
  const counts = useMemo(() => {
    return calculateWorkflowCounts(unifiedOrders, unifiedCustomers);
  }, [unifiedOrders, unifiedCustomers]);

  // Base shipments available in the current stage
  const stageShipments = useMemo(() => {
    return unifiedOrders.filter(o => o.workflowStage === currentStage);
  }, [unifiedOrders, currentStage]);

  // Secondary Status Pill Counts (Calculated dynamically from current stage shipments)
  const statusTabCounts = useMemo(() => {
    const acc: Record<string, number> = {
      All: stageShipments.length,
      Exception: 0,
      'Failed Attempt': 0,
      Pending: 0,
      'In Transit': 0,
      Delivered: 0,
      'Out for Delivery': 0,
      'Info Received': 0,
      Expired: 0,
      'Re-Dispatch': 0
    };

    stageShipments.forEach(s => {
      const st = (s.status || '').toLowerCase();
      if (st.includes('delivered')) acc.Delivered = (acc.Delivered || 0) + 1;
      else if (st.includes('out for delivery')) acc['Out for Delivery'] = (acc['Out for Delivery'] || 0) + 1;
      else if (st.includes('in transit') || st.includes('transit')) acc['In Transit'] = (acc['In Transit'] || 0) + 1;
      else if (st.includes('failed attempt')) acc['Failed Attempt'] = (acc['Failed Attempt'] || 0) + 1;
      else if (st.includes('rto') || st.includes('returned') || st.includes('re-dispatch')) acc['Re-Dispatch'] = (acc['Re-Dispatch'] || 0) + 1;
      else if (st.includes('exception') || st.includes('error')) acc.Exception = (acc.Exception || 0) + 1;
      else if (st.includes('info received') || st.includes('manifest') || st.includes('booked')) acc['Info Received'] = (acc['Info Received'] || 0) + 1;
      else if (st.includes('expired')) acc.Expired = (acc.Expired || 0) + 1;
      else acc.Pending = (acc.Pending || 0) + 1;
    });

    return acc;
  }, [stageShipments]);

  // Unique Couriers present with counts
  const courierCounts = useMemo(() => {
    let delhivery = 0;
    let stCourier = 0;
    let amazon = 0;
    let indiaPost = 0;
    let other = 0;

    stageShipments.forEach(s => {
      const c = (s.courier || '').toLowerCase();
      if (c.includes('delhivery')) delhivery++;
      else if (c.includes('st courier') || c.includes('stcourier')) stCourier++;
      else if (c.includes('amazon') || c.includes('ithink')) amazon++;
      else if (c.includes('india post')) indiaPost++;
      else if (c.trim().length > 0) other++;
    });

    return { delhivery, stCourier, amazon, indiaPost, other };
  }, [stageShipments]);

  // 5. Filtered Orders based on current stage, status tab, courier, and search
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return stageShipments.filter((order) => {
      // 1. Status Tab filter
      if (selectedStatusTab !== 'All') {
        const st = (order.status || '').toLowerCase();
        if (selectedStatusTab === 'Delivered' && !st.includes('delivered')) return false;
        if (selectedStatusTab === 'Out for Delivery' && !st.includes('out for delivery')) return false;
        if (selectedStatusTab === 'In Transit' && (!st.includes('in transit') && !st.includes('transit'))) return false;
        if (selectedStatusTab === 'Failed Attempt' && !st.includes('failed attempt')) return false;
        if (selectedStatusTab === 'Exception' && (!st.includes('exception') && !st.includes('error'))) return false;
        if (selectedStatusTab === 'Re-Dispatch' && (!st.includes('rto') && !st.includes('returned') && !st.includes('re-dispatch'))) return false;
        if (selectedStatusTab === 'Info Received' && (!st.includes('info received') && !st.includes('manifest') && !st.includes('booked'))) return false;
        if (selectedStatusTab === 'Pending' && (!st.includes('pending') && st !== 'not tracked' && st !== '')) return false;
      }

      // 2. Courier filter
      if (selectedCourier !== 'All') {
        const c = (order.courier || '').toLowerCase();
        const sel = selectedCourier.toLowerCase();
        if (sel === 'delhivery' && !c.includes('delhivery')) return false;
        if (sel === 'st courier' && !c.includes('st courier') && !c.includes('stcourier')) return false;
        if (sel === 'amazon' && !c.includes('amazon') && !c.includes('ithink')) return false;
        if (sel === 'india post' && !c.includes('india post')) return false;
      }

      // 3. Search term
      if (term) {
        const matchesOrder = order.orderId.toLowerCase().includes(term);
        const matchesName = order.customerName.toLowerCase().includes(term);
        const matchesPhone = order.phoneNumber.toLowerCase().includes(term);
        const matchesAwb = (order.awbNumber || '').toLowerCase().includes(term);
        const matchesCity = (order.city || '').toLowerCase().includes(term);
        const matchesProducts = (order.products || '').toLowerCase().includes(term);

        if (!matchesOrder && !matchesName && !matchesPhone && !matchesAwb && !matchesCity && !matchesProducts) {
          return false;
        }
      }

      return true;
    });
  }, [stageShipments, selectedStatusTab, selectedCourier, searchTerm]);

  // Bulk Selection Handlers
  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // Bulk Move to Prepare Dispatch
  const handlePrepareDispatchBulk = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error('Please select at least one order to prepare dispatch');
      return;
    }

    const selectedOrders = unifiedOrders.filter(o => selectedOrderIds.has(o.id));
    const validRawIds = selectedOrders.map(o => o.rawId).filter((id): id is number => typeof id === 'number');

    if (validRawIds.length === 0) {
      toast.error('Selected orders cannot be moved (external/non-database records)');
      return;
    }

    setIsMovingToPrepare(true);
    try {
      const res = await bulkMoveToPrepareDispatch(validRawIds);
      if (res.success) {
        toast.success(`Moved ${res.movedCount} orders to Prepare Dispatch!`);
        setSelectedOrderIds(new Set());
        setIsBulkSelectMode(false);
        setCurrentStage('prepare_dispatch');
      } else {
        toast.error('Failed to move orders: ' + res.errors.join(', '));
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Bulk transition failed'));
    } finally {
      setIsMovingToPrepare(false);
    }
  };

  // Sync Single Order Live Tracking
  const handleSyncOrder = async (order: UnifiedLogisticsOrder) => {
    if (!order.rawId || !order.awbNumber) {
      toast.error('No AWB number available to sync tracking');
      return;
    }

    setSyncingOrderIds(prev => new Set(prev).add(order.rawId!));
    try {
      const res = await trackingEngine.syncOrder(order.rawId, order.rawStatus);
      if (res.success) {
        toast.success(`Tracking updated: ${res.status}`);
      } else {
        toast.error(res.error || 'Courier sync failed');
      }
    } catch (e: any) {
      toast.error('Sync failed: ' + (e.message || 'Network error'));
    } finally {
      setSyncingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.rawId!);
        return next;
      });
    }
  };

  // Bulk Sync All Trackable Orders in current view
  const handleBulkSyncAll = async () => {
    const trackable = filteredOrders.filter(o => o.rawId && o.awbNumber);
    if (trackable.length === 0) {
      toast.error('No orders with AWB numbers in current view to sync');
      return;
    }

    setIsBulkSyncing(true);
    const toastId = toast.loading(`Syncing ${trackable.length} shipments...`);
    let successCount = 0;

    try {
      for (const ord of trackable) {
        if (!ord.rawId) continue;
        try {
          const res = await trackingEngine.syncOrder(ord.rawId, ord.rawStatus, { maxAttempts: 1, timeoutMs: 8000 });
          if (res.success) successCount++;
        } catch {}
      }
      toast.success(`Synced ${successCount} / ${trackable.length} shipments!`, { id: toastId });
    } catch (e: any) {
      toast.error('Bulk sync interrupted', { id: toastId });
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Delete Single Order
  const handleDeleteOrder = async (order: UnifiedLogisticsOrder) => {
    if (!order.rawId) return;
    if (confirm(`Are you sure you want to delete order ${order.displayOrderId}?`)) {
      try {
        await db.logistics_orders.delete(order.rawId);
        toast.success(`Order ${order.displayOrderId} deleted.`);
      } catch (err: any) {
        toast.error('Failed to delete order: ' + err.message);
      }
    }
  };

  // Reset Logistics Department Data Handler
  const handleResetLogisticsData = async () => {
    const promptConfirm = window.confirm(
      'Are you sure you want to RESET the Logistics Department?\n\nThis will permanently delete all 846 local logistics shipments, imported spreadsheet records, and courier logs, allowing you to start completely fresh.\n\nNote: All Influencer, Marketing, Finance, and other department data remain completely safe and untouched.'
    );
    if (!promptConfirm) return;

    setIsResetting(true);
    const toastId = toast.loading('Resetting Logistics Department data...');
    try {
      const res = await resetLogisticsDepartmentData();
      if (res.success) {
        toast.success(`Logistics reset successfully! Cleared ${res.clearedCount} orders. You can now import fresh orders.`, { id: toastId });
        setCurrentStage('active');
        setSelectedStatusTab('All');
        setSelectedCourier('All');
        setSelectedOrderIds(new Set());
      } else {
        toast.error('Reset failed: ' + res.error, { id: toastId });
      }
    } catch (err: any) {
      toast.error('Error during reset: ' + err.message, { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Workspace refreshed');
    }, 400);
  };

  // Tracking Modal Open
  const handleTrackOrder = (order: UnifiedLogisticsOrder) => {
    const dexieItem = dexieOrdersRaw.find(o => o.id === order.rawId) || {
      orderId: order.orderId,
      customerName: order.customerName,
      phoneNumber: order.phoneNumber,
      orderType: order.orderType,
      amount: String(order.amount),
      products: order.products,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      awbNumber: order.awbNumber,
      courier: order.courier,
      status: order.status,
      stage: order.stage,
      uploadedAt: order.orderDate || new Date().toISOString()
    };
    setActiveTrackingOrder(dexieItem as LogisticsOrder);
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full overflow-hidden">
      {/* 1. TOP TOOLBAR: Left stages, Right Search, Filters, Refresh, Layout, Reset & Import */}
      <LogisticsWorkflowToolbar
        currentStage={currentStage}
        onSelectStage={setCurrentStage}
        counts={counts}
        isBulkSelectMode={isBulkSelectMode}
        onToggleBulkSelect={() => {
          setIsBulkSelectMode(prev => !prev);
          if (isBulkSelectMode) {
            setSelectedOrderIds(new Set());
          }
        }}
        selectedOrderCount={selectedOrderIds.size}
        onPrepareDispatch={handlePrepareDispatchBulk}
        isMovingToPrepare={isMovingToPrepare}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onToggleFilters={() => setIsFilterDrawerOpen(prev => !prev)}
        activeFilterCount={selectedCourier !== 'All' || selectedStatusTab !== 'All' ? 1 : 0}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        orderLayout={orderLayout}
        onToggleLayout={setOrderLayout}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onResetLogisticsData={handleResetLogisticsData}
        isResetting={isResetting}
      />

      {/* 2. SECONDARY CONTROLS BAR: Search input, Upload, Sync, Status Pills & Courier Filter Badges (Image 2 style) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-1 shrink-0">
        {/* Left Action Buttons in Secondary Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 px-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer"
          >
            <UploadCloud size={14} />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={handleBulkSyncAll}
            disabled={isBulkSyncing}
            className="h-9 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Sync all shipments in view"
          >
            <RefreshCw size={13} className={isBulkSyncing ? 'animate-spin text-purple-400' : ''} />
            <span>Sync</span>
          </button>
        </div>

        {/* Courier Filter Badges (Image 2 exact style) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {courierCounts.delhivery > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCourier(prev => prev === 'Delhivery' ? 'All' : 'Delhivery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border bg-[#0b1220] transition-all ${
                selectedCourier === 'Delhivery'
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                  : 'border-cyan-800/50 text-cyan-300 hover:border-cyan-500'
              }`}
            >
              <Truck size={12} className={selectedCourier === 'Delhivery' ? 'text-white' : 'text-cyan-400'} />
              <span>Delhivery</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                selectedCourier === 'Delhivery' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-cyan-200'
              }`}>
                {courierCounts.delhivery}
              </span>
            </button>
          )}

          {courierCounts.stCourier > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCourier(prev => prev === 'ST Courier' ? 'All' : 'ST Courier')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border bg-[#0b1220] transition-all ${
                selectedCourier === 'ST Courier'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                  : 'border-purple-800/50 text-purple-300 hover:border-purple-500'
              }`}
            >
              <Truck size={12} className={selectedCourier === 'ST Courier' ? 'text-white' : 'text-purple-400'} />
              <span>ST Courier</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                selectedCourier === 'ST Courier' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-purple-200'
              }`}>
                {courierCounts.stCourier}
              </span>
            </button>
          )}

          {courierCounts.amazon > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCourier(prev => prev === 'Amazon' ? 'All' : 'Amazon')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border bg-[#0b1220] transition-all ${
                selectedCourier === 'Amazon'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                  : 'border-amber-800/50 text-amber-300 hover:border-amber-500'
              }`}
            >
              <Truck size={12} className={selectedCourier === 'Amazon' ? 'text-white' : 'text-amber-400'} />
              <span>Amazon</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                selectedCourier === 'Amazon' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-amber-200'
              }`}>
                {courierCounts.amazon}
              </span>
            </button>
          )}

          {courierCounts.indiaPost > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCourier(prev => prev === 'India Post' ? 'All' : 'India Post')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border bg-[#0b1220] transition-all ${
                selectedCourier === 'India Post'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                  : 'border-rose-800/50 text-rose-300 hover:border-rose-500'
              }`}
            >
              <Truck size={12} className={selectedCourier === 'India Post' ? 'text-white' : 'text-rose-400'} />
              <span>India Post</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                selectedCourier === 'India Post' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-rose-200'
              }`}>
                {courierCounts.indiaPost}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3. STATUS FILTER PILLS (Image 2 style with counters) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar shrink-0 select-none">
        {STATUS_PILLS.map((pill) => {
          const count = statusTabCounts[pill.id] || 0;
          const isActive = selectedStatusTab === pill.id;

          let badgeBorderClass = 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200';
          if (pill.id === 'All') {
            badgeBorderClass = isActive
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'border-purple-800/40 text-purple-300 hover:border-purple-600';
          } else if (pill.id === 'Exception') {
            badgeBorderClass = isActive
              ? 'bg-rose-600 text-white border-rose-500'
              : 'border-rose-800/40 text-rose-400 hover:border-rose-600';
          } else if (pill.id === 'Failed Attempt') {
            badgeBorderClass = isActive
              ? 'bg-amber-600 text-white border-amber-500'
              : 'border-amber-800/40 text-amber-400 hover:border-amber-600';
          } else if (pill.id === 'Pending') {
            badgeBorderClass = isActive
              ? 'bg-amber-500 text-white border-amber-400'
              : 'border-amber-700/40 text-amber-300 hover:border-amber-500';
          } else if (pill.id === 'In Transit') {
            badgeBorderClass = isActive
              ? 'bg-blue-600 text-white border-blue-500'
              : 'border-blue-800/40 text-blue-400 hover:border-blue-600';
          } else if (pill.id === 'Delivered') {
            badgeBorderClass = isActive
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'border-emerald-800/40 text-emerald-400 hover:border-emerald-600';
          } else if (pill.id === 'Out for Delivery') {
            badgeBorderClass = isActive
              ? 'bg-cyan-600 text-white border-cyan-500'
              : 'border-cyan-800/40 text-cyan-400 hover:border-cyan-600';
          } else if (pill.id === 'Re-Dispatch') {
            badgeBorderClass = isActive
              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
              : 'border-amber-800/40 text-amber-300 hover:border-amber-600';
          }

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSelectedStatusTab(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border bg-[#0b1220] ${badgeBorderClass}`}
            >
              <span>{pill.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN WORKSPACE CONTENT: Compact Table View (Image 2) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0b1220] border border-slate-800/90 rounded-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-sm">
              <Truck size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">
              {unifiedOrders.length === 0 ? 'No Orders or Shipments in Logistics' : `No shipments match ${selectedStatusTab} in ${currentStage}`}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
              {unifiedOrders.length === 0 
                ? 'Your logistics department has been reset and is ready for fresh data. Click Import below to upload customer orders.' 
                : 'Try adjusting your search query, status filters, or courier tabs above.'}
            </p>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <UploadCloud size={15} />
              <span>Import Fresh Customer Orders</span>
            </button>
          </div>
        ) : orderLayout === 'table' ? (
          <div className="pb-6">
            <OrderTableView
              orders={filteredOrders}
              onTrackOrder={handleTrackOrder}
              onSyncOrder={handleSyncOrder}
              onViewCustomer={(key) => setSelectedCustomerKey(key)}
              onOpenDispatchModal={setOrderToDispatch}
              onDeleteOrder={handleDeleteOrder}
              syncingOrderIds={syncingOrderIds}
              isSelectable={isBulkSelectMode}
              selectedOrderIds={selectedOrderIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              allSelected={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-6">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onTrackOrder={handleTrackOrder}
                onSyncOrder={handleSyncOrder}
                onViewCustomer={(key) => setSelectedCustomerKey(key)}
                onOpenDispatchModal={setOrderToDispatch}
                isSyncing={order.rawId ? syncingOrderIds.has(order.rawId) : false}
                isSelectable={isBulkSelectMode}
                isSelected={selectedOrderIds.has(order.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Customer Detail Drawer Modal */}
      <CustomerDetailModal
        customer={activeCustomer}
        onClose={() => setSelectedCustomerKey(null)}
        onTrackOrder={handleTrackOrder}
      />

      {/* Dispatch Single Order Confirmation Modal */}
      <DispatchOrderModal
        order={orderToDispatch}
        onClose={() => setOrderToDispatch(null)}
        onSuccess={() => {
          setOrderToDispatch(null);
          setCurrentStage('dispatched');
        }}
      />

      {/* Excel / CSV Import Modal */}
      <OrderImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => setCurrentStage('active')}
      />

      {/* Live Courier Tracking Modal */}
      {activeTrackingOrder && (
        <TrackingModal
          order={activeTrackingOrder}
          onClose={() => setActiveTrackingOrder(null)}
        />
      )}
    </div>
  );
};
