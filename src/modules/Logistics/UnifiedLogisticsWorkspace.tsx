import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/db';
import { 
  Search, 
  Grid, 
  List, 
  RotateCcw, 
  Truck, 
  Package, 
  AlertTriangle,
  Download,
  Check,
  X,
  UploadCloud,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { LogisticsOrder } from '../../types/logistics';
import type { 
  UnifiedLogisticsOrder, 
  UnifiedCustomer, 
  UnifiedWorkflowStage,
  LogisticsMainView 
} from '../../types/unifiedLogistics';
import { 
  fromDexieOrder, 
  groupOrdersIntoCustomers, 
  calculateWorkflowCounts,
  fetchShopifyOrders,
  bulkMoveToPrepareDispatch,
  returnToActiveStage
} from '../../services/unifiedLogisticsService';
import { LogisticsViewSwitch } from './components/LogisticsViewSwitch';
import { LogisticsWorkflowToolbar } from './components/LogisticsWorkflowToolbar';
import { CustomerCard } from './components/CustomerCard';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { OrderCard } from './components/OrderCard';
import { OrderTableView } from './components/OrderTableView';
import { OrderImportModal } from './components/OrderImportModal';
import { DispatchOrderModal } from './components/DispatchOrderModal';
import { TrackingModal } from './TrackingModal';
import { trackingEngine } from '../../services/tracking/trackingEngine';

export const UnifiedLogisticsWorkspace: React.FC = () => {
  // Main View: Customers vs Orders
  const [currentView, setCurrentView] = useState<LogisticsMainView>('orders');
  
  // Layout mode for Orders: Grid cards vs Table
  const [orderLayout, setOrderLayout] = useState<'grid' | 'table'>('grid');

  // Active Workflow Stage: 'active' | 'pending' | 'prepare_dispatch' | 'dispatched' | 'tracking'
  const [currentStage, setCurrentStage] = useState<UnifiedWorkflowStage>('active');

  // Search & Filter
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
  const [selectedCustomer, setSelectedCustomer] = useState<UnifiedCustomer | null>(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<LogisticsOrder | null>(null);

  // Live Syncing State for Tracking
  const [syncingOrderIds, setSyncingOrderIds] = useState<Set<number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Live Query: All Dexie Logistics Orders (excluding trash)
  const dexieOrdersRaw = useLiveQuery(
    () => db.logistics_orders.where('stage').notEqual('trash').reverse().toArray(),
    []
  ) ?? [];

  // Optional: load Shopify website orders from Supabase
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

  // 2. Canonical Unified Orders: Transform Dexie orders + merge Shopify orders safely
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

  // 3. Canonical Unified Customers: Grouped strictly by phone number / unique customerKey
  const unifiedCustomers = useMemo(() => {
    return groupOrdersIntoCustomers(unifiedOrders);
  }, [unifiedOrders]);

  // 4. Live Workflow Counts (Toolbar)
  const counts = useMemo(() => {
    return calculateWorkflowCounts(unifiedOrders, unifiedCustomers);
  }, [unifiedOrders, unifiedCustomers]);

  // Courier list detected across orders
  const courierList = useMemo(() => {
    const set = new Set<string>();
    for (const o of unifiedOrders) {
      if (o.courier && o.courier.trim().length > 0) {
        set.add(o.courier.trim());
      }
    }
    return Array.from(set).sort();
  }, [unifiedOrders]);

  // 5. Filtered Orders based on current stage and search
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return unifiedOrders.filter((order) => {
      // 1. Stage filter
      if (order.workflowStage !== currentStage) {
        return false;
      }

      // 2. Courier filter
      if (selectedCourier !== 'all') {
        if (!order.courier || order.courier.toLowerCase() !== selectedCourier.toLowerCase()) {
          return false;
        }
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
  }, [unifiedOrders, currentStage, selectedCourier, searchTerm]);

  // 6. Filtered Customers based on current stage
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return unifiedCustomers.filter((cust) => {
      // Must have orders in the current stage
      const hasStageOrders = cust.orders.some(o => o.workflowStage === currentStage);
      if (!hasStageOrders) return false;

      // Courier filter
      if (selectedCourier !== 'all') {
        const hasCourier = cust.orders.some(o => o.courier && o.courier.toLowerCase() === selectedCourier.toLowerCase());
        if (!hasCourier) return false;
      }

      // Search term
      if (term) {
        const matchesName = cust.name.toLowerCase().includes(term);
        const matchesPhone = cust.phoneNumber.toLowerCase().includes(term);
        const matchesCity = cust.city.toLowerCase().includes(term);
        const matchesOrder = cust.orders.some(o => o.orderId.toLowerCase().includes(term) || (o.awbNumber || '').toLowerCase().includes(term));

        if (!matchesName && !matchesPhone && !matchesCity && !matchesOrder) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedCustomers, currentStage, selectedCourier, searchTerm]);

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
      {/* 1. TOP CONTROLS: Customer/Order View Switch & Action Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <LogisticsViewSwitch
            currentView={currentView}
            onViewChange={setCurrentView}
            customerCount={unifiedCustomers.length}
            orderCount={unifiedOrders.length}
          />

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UploadCloud size={14} />
            <span>Import Orders</span>
          </button>
        </div>

        {/* View Toggle (Grid / List) */}
        {currentView === 'orders' && (
          <div className="flex items-center self-end sm:self-auto p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setOrderLayout('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                orderLayout === 'grid'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compact Cards View"
            >
              <Grid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setOrderLayout('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                orderLayout === 'table'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dense Table View"
            >
              <List size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 2. COMPACT INFLUENCER-STYLE WORKFLOW TOOLBAR */}
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
      />

      {/* Optional Courier Filter Chips */}
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

      {/* 3. MAIN WORKSPACE CONTENT */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* CUSTOMER VIEW */}
        {currentView === 'customers' && (
          <div>
            {filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 mb-3">
                  <Package size={22} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No customers in {currentStage}</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Customer records appear here when their associated orders are in this stage.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-6">
                {filteredCustomers.map((cust) => (
                  <CustomerCard
                    key={cust.customerKey}
                    customer={cust}
                    onViewCustomer={setSelectedCustomer}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ORDER VIEW */}
        {currentView === 'orders' && (
          <div>
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
                  onViewCustomer={(key) => {
                    const c = unifiedCustomers.find(cu => cu.customerKey === key);
                    if (c) setSelectedCustomer(c);
                  }}
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
                    onViewCustomer={(key) => {
                      const c = unifiedCustomers.find(cu => cu.customerKey === key);
                      if (c) setSelectedCustomer(c);
                    }}
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
        )}
      </div>

      {/* Customer Detail Drawer Modal */}
      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
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
