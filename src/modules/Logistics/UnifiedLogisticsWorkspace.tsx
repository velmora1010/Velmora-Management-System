import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/db';
import { 
  Truck, 
  Package, 
  RotateCcw,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { LogisticsOrder } from '../../types/logistics';
import type { 
  UnifiedLogisticsOrder, 
  UnifiedWorkflowStage 
} from '../../types/unifiedLogistics';
import { 
  fromDexieOrder, 
  groupOrdersIntoCustomers, 
  calculateWorkflowCounts,
  fetchShopifyOrders,
  bulkMoveToPrepareDispatch
} from '../../services/unifiedLogisticsService';
import { LogisticsWorkflowToolbar } from './components/LogisticsWorkflowToolbar';
import { OrderCard } from './components/OrderCard';
import { OrderTableView } from './components/OrderTableView';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { OrderImportModal } from './components/OrderImportModal';
import { DispatchOrderModal } from './components/DispatchOrderModal';
import { TrackingModal } from './TrackingModal';
import { trackingEngine } from '../../services/tracking/trackingEngine';

export const UnifiedLogisticsWorkspace: React.FC = () => {
  // Layout mode for Orders: Grid cards vs Dense Table
  const [orderLayout, setOrderLayout] = useState<'grid' | 'table'>('grid');

  // Active Workflow Stage: 'active' | 'pending' | 'prepare_dispatch' | 'dispatched' | 'tracking'
  const [currentStage, setCurrentStage] = useState<UnifiedWorkflowStage>('active');

  // Search & Courier Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
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

  // 1. Live Query: All Dexie Logistics Orders (excluding trash)
  const dexieOrdersRaw = useLiveQuery(
    () => db.logistics_orders.where('stage').notEqual('trash').reverse().toArray(),
    []
  ) ?? [];

  // 2. Shopify Website Orders Sync
  const [shopifyOrders, setShopifyOrders] = useState<UnifiedLogisticsOrder[]>([]);

  const loadShopify = useCallback(async () => {
    try {
      const data = await fetchShopifyOrders(150);
      setShopifyOrders(data);
    } catch (e) {
      console.warn('Could not load Shopify sales_orders:', e);
    }
  }, []);

  useEffect(() => {
    loadShopify();
  }, [loadShopify]);

  // 3. Canonical Unified Orders: Transform Dexie orders + merge Shopify orders without duplication
  const unifiedOrders = useMemo(() => {
    const list: UnifiedLogisticsOrder[] = dexieOrdersRaw.map(fromDexieOrder);
    const existingOrderIds = new Set(list.map(o => o.orderId.toLowerCase()));

    for (const sOrder of shopifyOrders) {
      if (!existingOrderIds.has(sOrder.orderId.toLowerCase())) {
        list.push(sOrder);
      }
    }

    return list;
  }, [dexieOrdersRaw, shopifyOrders]);

  // 4. Canonical Customer Groupings for Detail Slide-overs
  const unifiedCustomers = useMemo(() => {
    return groupOrdersIntoCustomers(unifiedOrders);
  }, [unifiedOrders]);

  const activeCustomer = useMemo(() => {
    if (!selectedCustomerKey) return null;
    return unifiedCustomers.find(c => c.customerKey === selectedCustomerKey) || null;
  }, [selectedCustomerKey, unifiedCustomers]);

  // 5. Live Workflow Counts (Toolbar)
  const counts = useMemo(() => {
    return calculateWorkflowCounts(unifiedOrders, unifiedCustomers);
  }, [unifiedOrders, unifiedCustomers]);

  // Unique Couriers detected
  const courierList = useMemo(() => {
    const set = new Set<string>();
    for (const o of unifiedOrders) {
      if (o.courier && o.courier.trim().length > 0) {
        set.add(o.courier.trim());
      }
    }
    return Array.from(set).sort();
  }, [unifiedOrders]);

  // 6. Filtered Orders based on current stage, courier, and search
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return unifiedOrders.filter((order) => {
      // Stage filter
      if (order.workflowStage !== currentStage) {
        return false;
      }

      // Courier filter
      if (selectedCourier !== 'all') {
        if (!order.courier || order.courier.toLowerCase() !== selectedCourier.toLowerCase()) {
          return false;
        }
      }

      // Search term
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
  }, [unifiedOrders, currentStage, selectedCourier, searchTerm]);

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

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadShopify();
      toast.success('Workspace refreshed');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
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
    <div className="flex flex-col gap-3.5 w-full h-full overflow-hidden">
      {/* 1. TOP TOOLBAR: Left workflow stages, Right search, filter, refresh, layout & Import Orders */}
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
        activeFilterCount={selectedCourier !== 'all' ? 1 : 0}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        orderLayout={orderLayout}
        onToggleLayout={setOrderLayout}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      {/* 2. COURIER FILTER CHIPS */}
      {courierList.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar text-xs shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Courier:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCourier('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 border transition-colors cursor-pointer ${
              selectedCourier === 'all'
                ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          {courierList.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCourier(c)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 border transition-colors cursor-pointer ${
                selectedCourier === c
                  ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTENT: Unified Order View */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 mb-3">
              <Truck size={22} />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">No orders in {currentStage}</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {currentStage === 'active' 
                ? 'Import orders via Excel/CSV or sync from Shopify to begin dispatch preparation.' 
                : `No orders currently match the ${currentStage} stage.`}
            </p>
          </div>
        ) : orderLayout === 'table' ? (
          <div className="pb-6">
            <OrderTableView
              orders={filteredOrders}
              onTrackOrder={handleTrackOrder}
              onSyncOrder={handleSyncOrder}
              onViewCustomer={(key) => setSelectedCustomerKey(key)}
              onOpenDispatchModal={setOrderToDispatch}
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

      {/* Customer Detail Drawer Modal (Opened on clicking customer from any order) */}
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
