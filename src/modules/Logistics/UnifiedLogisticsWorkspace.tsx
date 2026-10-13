import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/db';
import { 
  Search, 
  RefreshCw, 
  SlidersHorizontal, 
  Grid, 
  List, 
  RotateCcw, 
  Truck, 
  Package, 
  AlertTriangle,
  Download,
  Check,
  X
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
  calculateLogisticsSummary,
  fetchShopifyOrders
} from '../../services/unifiedLogisticsService';
import { LogisticsViewSwitch } from './components/LogisticsViewSwitch';
import { LogisticsWorkflowFilters } from './components/LogisticsWorkflowFilters';
import { CustomerCard } from './components/CustomerCard';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { OrderCard } from './components/OrderCard';
import { OrderTableView } from './components/OrderTableView';
import { TrackingModal } from './TrackingModal';
import { trackingEngine } from '../../services/tracking/trackingEngine';

interface UnifiedLogisticsWorkspaceProps {
  onNavigateTab?: (tab: 'import' | 'data' | 'tracking' | 'analytics' | 'trash') => void;
}

export const UnifiedLogisticsWorkspace: React.FC<UnifiedLogisticsWorkspaceProps> = ({
  onNavigateTab
}) => {
  // Main view: Customers or Orders
  const [currentView, setCurrentView] = useState<LogisticsMainView>('orders');
  
  // Layout mode for Orders: Grid cards vs Table rows
  const [orderLayout, setOrderLayout] = useState<'grid' | 'table'>('grid');

  // Search and workflow filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState<UnifiedWorkflowStage>('all');
  const [selectedCourier, setSelectedCourier] = useState('all');

  // Shopify sync state
  const [shopifyOrders, setShopifyOrders] = useState<UnifiedLogisticsOrder[]>([]);
  const [isLoadingShopify, setIsLoadingShopify] = useState(false);

  // Modal inspection states
  const [selectedCustomer, setSelectedCustomer] = useState<UnifiedCustomer | null>(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<LogisticsOrder | null>(null);

  // Syncing state for single order courier sync
  const [syncingOrderIds, setSyncingOrderIds] = useState<Set<number>>(new Set());

  // 1. Live Query of all Dexie Logistics Orders (excluding trash)
  const dexieOrdersRaw = useLiveQuery(
    () => db.logistics_orders.where('stage').notEqual('trash').reverse().toArray(),
    []
  ) ?? [];

  // Optional: load Shopify website orders from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    const loadShopify = async () => {
      setIsLoadingShopify(true);
      try {
        const data = await fetchShopifyOrders(150);
        if (isMounted) {
          setShopifyOrders(data);
        }
      } catch (e) {
        console.warn('Could not load shopify orders:', e);
      } finally {
        if (isMounted) setIsLoadingShopify(false);
      }
    };
    loadShopify();
    return () => { isMounted = false; };
  }, []);

  // 2. Canonical Unified Orders: Transform Dexie orders + merge Shopify orders without duplication
  const unifiedOrders = useMemo(() => {
    const list: UnifiedLogisticsOrder[] = dexieOrdersRaw.map(fromDexieOrder);
    const existingOrderIds = new Set(list.map(o => o.orderId.toLowerCase()));

    // Append Shopify orders that do not collide with an existing uploaded Dexie order
    for (const sOrder of shopifyOrders) {
      if (!existingOrderIds.has(sOrder.orderId.toLowerCase())) {
        list.push(sOrder);
      }
    }

    return list;
  }, [dexieOrdersRaw, shopifyOrders]);

  // 3. Canonical Unified Customers: Grouped strictly by phone number / customerKey
  const unifiedCustomers = useMemo(() => {
    return groupOrdersIntoCustomers(unifiedOrders);
  }, [unifiedOrders]);

  // 4. Global Summary KPIs across Canonical data
  const summaryCounts = useMemo(() => {
    return calculateLogisticsSummary(unifiedOrders, unifiedCustomers);
  }, [unifiedOrders, unifiedCustomers]);

  // List of unique couriers present in orders
  const courierList = useMemo(() => {
    const set = new Set<string>();
    for (const o of unifiedOrders) {
      if (o.courier && o.courier.trim().length > 0) {
        set.add(o.courier.trim());
      }
    }
    return Array.from(set).sort();
  }, [unifiedOrders]);

  // 5. Filtered Orders based on Search, Stage and Courier
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return unifiedOrders.filter((order) => {
      // Courier filter
      if (selectedCourier !== 'all') {
        if (!order.courier || order.courier.toLowerCase() !== selectedCourier.toLowerCase()) {
          return false;
        }
      }

      // Stage filter
      if (selectedStage !== 'all') {
        if (order.workflowStage !== selectedStage) {
          return false;
        }
      }

      // Search query
      if (term) {
        const matchesOrder = order.orderId.toLowerCase().includes(term);
        const matchesName = order.customerName.toLowerCase().includes(term);
        const matchesPhone = order.phoneNumber.toLowerCase().includes(term);
        const matchesAwb = (order.awbNumber || '').toLowerCase().includes(term);
        const matchesCity = (order.city || '').toLowerCase().includes(term);
        const matchesState = (order.state || '').toLowerCase().includes(term);
        const matchesProducts = (order.products || '').toLowerCase().includes(term);

        if (!matchesOrder && !matchesName && !matchesPhone && !matchesAwb && !matchesCity && !matchesState && !matchesProducts) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedOrders, searchTerm, selectedStage, selectedCourier]);

  // 6. Filtered Customers based on Search and Stage
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return unifiedCustomers.filter((cust) => {
      // Courier filter against customer orders
      if (selectedCourier !== 'all') {
        const hasCourier = cust.orders.some(o => o.courier && o.courier.toLowerCase() === selectedCourier.toLowerCase());
        if (!hasCourier) return false;
      }

      // Stage filter against customer orders
      if (selectedStage !== 'all') {
        const hasStage = cust.orders.some(o => o.workflowStage === selectedStage);
        if (!hasStage) return false;
      }

      // Search query
      if (term) {
        const matchesName = cust.name.toLowerCase().includes(term);
        const matchesPhone = cust.phoneNumber.toLowerCase().includes(term);
        const matchesCity = cust.city.toLowerCase().includes(term);
        const matchesState = cust.state.toLowerCase().includes(term);
        const matchesOrder = cust.orders.some(o => o.orderId.toLowerCase().includes(term) || (o.awbNumber || '').toLowerCase().includes(term));

        if (!matchesName && !matchesPhone && !matchesCity && !matchesState && !matchesOrder) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedCustomers, searchTerm, selectedStage, selectedCourier]);

  // Handle single order live sync
  const handleSyncOrder = async (order: UnifiedLogisticsOrder) => {
    if (!order.rawId || !order.awbNumber) {
      toast.error('No AWB number available to sync tracking');
      return;
    }

    setSyncingOrderIds(prev => new Set(prev).add(order.rawId!));
    try {
      const res = await trackingEngine.syncOrder(order.rawId, order.rawStatus);
      if (res.success) {
        toast.success(`Updated tracking status: ${res.status}`);
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

  // Handle opening live tracking modal
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

  // Handle opening customer modal directly from an order
  const handleViewCustomerByKey = (customerKey: string) => {
    const cust = unifiedCustomers.find(c => c.customerKey === customerKey);
    if (cust) {
      setSelectedCustomer(cust);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-hidden">
      {/* Top Header Row: View Switch, Search & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        {/* Left: View Switcher */}
        <div className="flex items-center gap-3">
          <LogisticsViewSwitch
            currentView={currentView}
            onViewChange={setCurrentView}
            customerCount={unifiedCustomers.length}
            orderCount={unifiedOrders.length}
          />

          {/* Quick tab jump helper buttons if onNavigateTab provided */}
          {onNavigateTab && (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
              <button
                type="button"
                onClick={() => onNavigateTab('import')}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download size={13} className="text-purple-400" />
                <span>Upload CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Search, Table/Grid Toggle & Refresh */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={currentView === 'customers' ? 'Search customers, phones...' : 'Search orders, AWB, phones...'}
              className="w-full h-9 bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Table / Grid Toggle (Orders view only) */}
          {currentView === 'orders' && (
            <div className="flex items-center p-1 bg-slate-900/90 border border-slate-700/80 rounded-xl">
              <button
                type="button"
                onClick={() => setOrderLayout('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  orderLayout === 'grid'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid Card View"
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
                title="Compact Table View"
              >
                <List size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stage Filters Row */}
      <div className="shrink-0">
        <LogisticsWorkflowFilters
          currentStage={selectedStage}
          onSelectStage={setSelectedStage}
          counts={summaryCounts}
          selectedCourier={selectedCourier}
          onSelectCourier={setSelectedCourier}
          courierList={courierList}
        />
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* CUSTOMER VIEW */}
        {currentView === 'customers' && (
          <div>
            {filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 mb-3">
                  <Package size={22} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No customers match criteria</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Try adjusting your search terms or active status filters to discover customer profiles.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-6">
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
              <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 mb-3">
                  <Truck size={22} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No orders found</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  No orders match the selected filters. Upload orders or clear filters to view shipments.
                </p>
              </div>
            ) : orderLayout === 'table' ? (
              <div className="pb-6">
                <OrderTableView
                  orders={filteredOrders}
                  onTrackOrder={handleTrackOrder}
                  onSyncOrder={handleSyncOrder}
                  onViewCustomer={handleViewCustomerByKey}
                  syncingOrderIds={syncingOrderIds}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-6">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onTrackOrder={handleTrackOrder}
                    onSyncOrder={handleSyncOrder}
                    onViewCustomer={handleViewCustomerByKey}
                    isSyncing={order.rawId ? syncingOrderIds.has(order.rawId) : false}
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
