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
  CheckSquare, 
  Square,
  Download,
  SlidersHorizontal,
  Clock,
  BarChart3,
  PackageCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import type { LogisticsOrder } from '../../types/logistics';
import type { 
  UnifiedLogisticsOrder, 
  UnifiedWorkflowStage,
  UnifiedTrackingStatus
} from '../../types/unifiedLogistics';
import { supabase } from '../../lib/supabase';
import { 
  fromDexieOrder, 
  groupOrdersIntoCustomers, 
  calculateWorkflowCounts,
  bulkMoveToPrepareDispatch,
  returnToActiveStage,
  cleanOrderId,
  syncSalesOrdersFromSupabase,
  deleteLogisticsOrderByOrderId
} from '../../services/unifiedLogisticsService';
import { websiteSalesService } from '../sales/website/websiteSalesService';
import { LogisticsWorkflowToolbar } from './components/LogisticsWorkflowToolbar';
import { OrderTableView } from './components/OrderTableView';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { OrderImportModal } from './components/OrderImportModal';
import { CourierTrackingImportModal } from './components/CourierTrackingImportModal';
import { PrepareDispatchGroupedView } from './components/PrepareDispatchGroupedView';
import { DispatchOrderModal } from './components/DispatchOrderModal';
import { MoveToPrepareSidePanel } from './components/MoveToPrepareSidePanel';
import { LogisticsReconciliationModal } from './components/LogisticsReconciliationModal';
import { TrackingModal } from './TrackingModal';
import { trackingEngine } from '../../services/tracking/trackingEngine';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../config/courierConfig';
import { parseAndFormatLogisticsDate } from '../../utils/logisticsDateUtils';
import { normalizeState, resolveStateFromPincode, isDispatchedOrder } from '../../utils/logisticsOrderUtils';
import { LogisticsFilterDrawer } from './components/LogisticsFilterDrawer';
import { LogisticsAnalyticsDashboard } from './components/LogisticsAnalyticsDashboard';
import { DateRangeCalendarModal } from './components/DateRangeCalendarModal';
import { 
  LogisticsFilterState, 
  INITIAL_LOGISTICS_FILTER_STATE, 
  applyLogisticsFilters, 
  countActiveLogisticsFilters,
  formatRangeDisplay 
} from './types/logisticsFilters';

// Status pills for Tracking stage
const STATUS_PILLS: Array<{ id: string; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Exception', label: 'Exception' },
  { id: 'Failed Attempt', label: 'Failed Attempt' },
  { id: 'Pending', label: 'Pending' },
  { id: 'In Transit', label: 'In Transit' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Out for Delivery', label: 'Out for Delivery' },
  { id: 'Info Received', label: 'Info Received' },
  { id: 'Expired', label: 'Expired' }
];

// Active section filter pills (for unfulfilled customer orders awaiting dispatch + pending info)
const ACTIVE_FILTER_PILLS: Array<{ id: string; label: string }> = [
  { id: 'All', label: 'All Unfulfilled' },
  { id: 'Prepaid', label: 'Prepaid' },
  { id: 'COD', label: 'COD' },
  { id: 'Pending', label: 'Pending' }
];

export const UnifiedLogisticsWorkspace: React.FC = () => {
  // Navigation: Primary workflow stages
  const [currentStage, setCurrentStage] = useState<UnifiedWorkflowStage>('active');

  // Secondary sub-status tab
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('All');

  // Search & Filter Drawer State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string>('All');
  const [logisticsFilters, setLogisticsFilters] = useState<LogisticsFilterState>(INITIAL_LOGISTICS_FILTER_STATE);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isDateCalendarOpen, setIsDateCalendarOpen] = useState(false);

  // Bulk Selection Mode
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isMovingToPrepare, setIsMovingToPrepare] = useState(false);
  const [isMoveReviewPanelOpen, setIsMoveReviewPanelOpen] = useState(false);

  // Modals & Panels
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isCourierTrackingModalOpen, setIsCourierTrackingModalOpen] = useState(false);
  const [orderToDispatch, setOrderToDispatch] = useState<UnifiedLogisticsOrder | null>(null);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<LogisticsOrder | null>(null);

  // Live Syncing State for Tracking
  const [syncingOrderIds, setSyncingOrderIds] = useState<Set<number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
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
    if (currentStage === 'analytics') {
      return unifiedOrders;
    }
    if (currentStage === 'fulfilled') {
      return unifiedOrders.filter(o => 
        o.workflowStage === 'fulfilled' || 
        o.sourceFulfillmentStatus === 'fulfilled' || 
        o.stage === 'fulfilled'
      );
    }
    if (currentStage === 'dispatched' || currentStage === 'tracking') {
      return unifiedOrders.filter(o => isDispatchedOrder(o));
    }
    if (currentStage === 'prepare_dispatch') {
      return unifiedOrders.filter(o => o.workflowStage === 'prepare_dispatch');
    }
    if (currentStage === 'pending') {
      return unifiedOrders.filter(o => o.workflowStage === 'pending');
    }
    if (currentStage === 'active') {
      if (selectedStatusTab === 'Pending') {
        return unifiedOrders.filter(o => o.workflowStage === 'pending');
      }
      return unifiedOrders.filter(o => 
        o.workflowStage === 'active' && 
        o.stage !== 'fulfilled' && 
        o.sourceFulfillmentStatus !== 'fulfilled'
      );
    }
    return unifiedOrders.filter(o => 
      o.workflowStage === 'active' && 
      o.stage !== 'fulfilled' && 
      o.sourceFulfillmentStatus !== 'fulfilled'
    );
  }, [unifiedOrders, currentStage, selectedStatusTab]);

  // Sanitize legacy serial dates, normalize states, and enrich missing details on mount
  useEffect(() => {
    const sanitizeDexieRecords = async () => {
      try {
        // Automatically sync canonical Sales orders from Supabase into Dexie
        await syncSalesOrdersFromSupabase();

        const records = await db.logistics_orders.toArray();
        if (records.length === 0) return;

        // Pass 1: Local normalizations (dates, stage/status, state codes, pincode lookup)
        for (const rec of records) {
          if (!rec.id) continue;
          let needsUpdate = false;
          const patch: Partial<LogisticsOrder> = {};

          if (
            rec.orderDate && 
            typeof rec.orderDate === 'string' && 
            !isNaN(Number(rec.orderDate)) && 
            Number(rec.orderDate) >= 35000 && 
            Number(rec.orderDate) <= 60000
          ) {
            const p = parseAndFormatLogisticsDate(rec.orderDate);
            if (p.isoDate) {
              patch.orderDate = p.isoDate;
              patch.orderDateDisplay = p.displayDate;
              needsUpdate = true;
            }
          }

          if (rec.stage === 'order_data' && rec.status === 'Not Tracked') {
            patch.status = 'Unfulfilled';
            needsUpdate = true;
          }

          // Normalize 2-letter state codes (e.g. TN -> Tamil Nadu) or resolve from pincode
          const normState = normalizeState(rec.state);
          if (normState && normState !== rec.state) {
            patch.state = normState;
            needsUpdate = true;
          } else if ((!rec.state || rec.state.toLowerCase() === 'india' || rec.state.trim() === '') && rec.pincode) {
            const pinState = resolveStateFromPincode(rec.pincode);
            if (pinState) {
              patch.state = pinState;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            await db.logistics_orders.update(rec.id, patch);
          }
        }

        // Pass 2: Safely check Supabase sales_orders to enrich orders missing phone, amount, or state
        const needsEnrichment = records.filter(
          r => (!r.phoneNumber || r.phoneNumber.trim() === '' || r.phoneNumber === '-') ||
               (!r.amount || r.amount === '0' || r.amount === '') ||
               (!r.state || r.state.toLowerCase() === 'india' || r.state.trim() === '')
        );

        if (needsEnrichment.length > 0) {
          const rawIds = needsEnrichment.map(r => cleanOrderId(r.orderId)).filter(Boolean);
          if (rawIds.length > 0) {
            // Batch fetch matching orders from Supabase
            const { data: sbOrders } = await supabase
              .from('sales_orders')
              .select('order_id, customer_name, phone, state, city, pincode, order_total, payment_mode')
              .in('order_id', rawIds);

            if (sbOrders && sbOrders.length > 0) {
              const sbMap = new Map<string, typeof sbOrders[0]>();
              sbOrders.forEach(so => sbMap.set(cleanOrderId(so.order_id).toLowerCase(), so));

              for (const rec of needsEnrichment) {
                if (!rec.id) continue;
                const so = sbMap.get(cleanOrderId(rec.orderId).toLowerCase());
                if (so) {
                  const patch: Partial<LogisticsOrder> = {};
                  if ((!rec.phoneNumber || rec.phoneNumber.trim() === '' || rec.phoneNumber === '-') && so.phone) {
                    patch.phoneNumber = String(so.phone);
                  }
                  if ((!rec.amount || rec.amount === '0' || rec.amount === '') && so.order_total) {
                    patch.amount = String(so.order_total);
                  }
                  if ((!rec.state || rec.state.toLowerCase() === 'india' || rec.state.trim() === '') && so.state) {
                    patch.state = normalizeState(so.state);
                  }
                  if ((!rec.city || rec.city.trim() === '') && so.city) {
                    patch.city = so.city;
                  }
                  if (Object.keys(patch).length > 0) {
                    await db.logistics_orders.update(rec.id, patch);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Background sanitize error:', e);
      }
    };
    sanitizeDexieRecords();

    // Listen for real-time sales order sync and deletion events from Sales department
    const handleSalesSynced = () => {
      syncSalesOrdersFromSupabase().catch(err => console.warn('Background sync on sales upload error:', err));
    };

    const handleSalesOrderDeleted = (e: any) => {
      const orderId = e.detail?.orderId;
      if (orderId) {
        setSelectedOrderIds(prev => prev.filter(id => id !== orderId && !id.endsWith(`-${orderId}`)));
      }
    };

    const handleSalesBatchDeleted = (e: any) => {
      const orderIds: string[] = e.detail?.orderIds || [];
      if (orderIds.length > 0) {
        const idSet = new Set(orderIds.map(cleanOrderId));
        setSelectedOrderIds(prev => prev.filter(id => !idSet.has(cleanOrderId(id))));
      }
    };

    window.addEventListener('velmora:sales_orders_synced', handleSalesSynced);
    window.addEventListener('velmora:sales_order_deleted', handleSalesOrderDeleted);
    window.addEventListener('velmora:sales_batch_deleted', handleSalesBatchDeleted);

    return () => {
      window.removeEventListener('velmora:sales_orders_synced', handleSalesSynced);
      window.removeEventListener('velmora:sales_order_deleted', handleSalesOrderDeleted);
      window.removeEventListener('velmora:sales_batch_deleted', handleSalesBatchDeleted);
    };
  }, []);

  // Filter counts for Active unfulfilled orders (and pending info queue)
  const activeFilterCounts = useMemo(() => {
    let prepaid = 0;
    let cod = 0;
    const activeList = unifiedOrders.filter(o => 
      o.workflowStage === 'active' && 
      o.stage !== 'fulfilled' && 
      o.sourceFulfillmentStatus !== 'fulfilled'
    );
    activeList.forEach(s => {
      const type = (s.orderType || '').toLowerCase();
      if (type.includes('cod')) {
        cod++;
      } else {
        prepaid++;
      }
    });
    return {
      All: activeList.length,
      Prepaid: prepaid,
      COD: cod,
      Pending: counts.pending
    };
  }, [unifiedOrders, counts.pending]);

  // Filter counts for Fulfilled orders
  const fulfilledFilterCounts = useMemo(() => {
    let prepaid = 0;
    let cod = 0;
    const fulfilledList = unifiedOrders.filter(o => 
      o.workflowStage === 'fulfilled' || 
      o.sourceFulfillmentStatus === 'fulfilled' || 
      o.stage === 'fulfilled'
    );
    fulfilledList.forEach(s => {
      const type = (s.orderType || '').toLowerCase();
      if (type.includes('cod')) {
        cod++;
      } else {
        prepaid++;
      }
    });
    return {
      All: fulfilledList.length,
      Prepaid: prepaid,
      COD: cod
    };
  }, [unifiedOrders]);

  // Secondary Status Pill Counts for Tracking
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
      Expired: 0
    };

    stageShipments.forEach(s => {
      const st = s.status || '';
      if (acc[st] !== undefined) {
        acc[st]++;
      } else if (st === 'Awaiting Tracking Update') {
        acc['Info Received'] = (acc['Info Received'] || 0) + 1;
      } else if (st.toLowerCase().includes('rto') || st.toLowerCase().includes('return')) {
        acc.Exception = (acc.Exception || 0) + 1;
      } else if (st === 'Unfulfilled') {
        // Do not add Unfulfilled to tracking status counts
      } else {
        acc.Pending = (acc.Pending || 0) + 1;
      }
    });

    return acc;
  }, [stageShipments]);

  // Dynamic Courier counts
  const courierCounts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    CONFIGURED_COURIERS.forEach(c => { countsMap[c.name] = 0; });

    stageShipments.forEach(s => {
      const normalized = normalizeCourier(s.courier);
      if (normalized && countsMap[normalized] !== undefined) {
        countsMap[normalized]++;
      }
    });

    return countsMap;
  }, [stageShipments]);

  // Active filter badge count for the Filters button
  const activeFilterCount = useMemo(() => {
    return countActiveLogisticsFilters(logisticsFilters) + (selectedCourier !== 'All' ? 1 : 0);
  }, [logisticsFilters, selectedCourier]);

  // Filtered orders displayed in the view
  const filteredOrders = useMemo(() => {
    // 1. Advanced Drawer Filters
    let result = applyLogisticsFilters(stageShipments, logisticsFilters);

    // 2. Search Query (Top toolbar search bar)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(order => {
        const matchesId = (order.displayOrderId || '').toLowerCase().includes(q) || (order.orderId || '').toLowerCase().includes(q);
        const matchesCust = (order.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (order.phoneNumber || order.phone || '').includes(q);
        const matchesAwb = (order.awbNumber || '').toLowerCase().includes(q);
        const matchesCity = (order.city || order.shippingCity || '').toLowerCase().includes(q);
        const matchesState = (order.state || order.shippingState || '').toLowerCase().includes(q);
        return matchesId || matchesCust || matchesPhone || matchesAwb || matchesCity || matchesState;
      });
    }

    // 3. Quick Courier Filter (Tracking toolbar pill)
    if (selectedCourier !== 'All') {
      result = result.filter(order => {
        const normalized = normalizeCourier(order.courier);
        return normalized === selectedCourier;
      });
    }

    // 4. Stage-Specific Contextual Filter Tabs (Row 3)
    if (currentStage === 'active' || currentStage === 'fulfilled') {
      if (selectedStatusTab === 'Prepaid') {
        result = result.filter(order => !(order.orderType || '').toLowerCase().includes('cod'));
      } else if (selectedStatusTab === 'COD') {
        result = result.filter(order => (order.orderType || '').toLowerCase().includes('cod'));
      }
    } else if (currentStage === 'tracking') {
      if (selectedStatusTab !== 'All') {
        result = result.filter(order => {
          const st = order.status;
          if (selectedStatusTab === 'Exception') {
            return st === 'Exception' || (st && (st.toLowerCase().includes('rto') || st.toLowerCase().includes('return')));
          } else if (selectedStatusTab === 'Info Received') {
            return st === 'Info Received' || st === 'Awaiting Tracking Update';
          } else {
            return st === selectedStatusTab;
          }
        });
      }
    }

    return result;
  }, [stageShipments, logisticsFilters, searchTerm, selectedCourier, selectedStatusTab, currentStage]);

  // Selected orders array for side panel review
  const selectedOrdersList = useMemo(() => {
    return unifiedOrders.filter(o => selectedOrderIds.has(o.id));
  }, [unifiedOrders, selectedOrderIds]);

  // Selected total amount
  const selectedTotalAmount = useMemo(() => {
    return selectedOrdersList.reduce((sum, o) => sum + (o.amount ?? o.totalAmount ?? 0), 0);
  }, [selectedOrdersList]);

  // Selection handlers
  const handleToggleSelect = useCallback((orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  }, [selectedOrderIds.size, filteredOrders]);

  // Bulk action: Open review panel
  const handlePrepareDispatchBulk = () => {
    if (selectedOrderIds.size === 0) {
      toast.error('Please select at least one order to prepare dispatch');
      return;
    }
    setIsMoveReviewPanelOpen(true);
  };

  // Move confirmed in review panel
  const handleConfirmMoveToPrepare = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsMovingToPrepare(true);
    const toastId = toast.loading(`Moving ${selectedOrderIds.size} orders to Prepare Dispatch...`);

    try {
      const orderIdList = Array.from(selectedOrderIds);
      const res = await bulkMoveToPrepareDispatch(orderIdList);
      if (res.success) {
        toast.success(`Successfully moved ${res.movedCount} orders to Prepare Dispatch!`, { id: toastId });
        setSelectedOrderIds(new Set());
        setIsMoveReviewPanelOpen(false);
        setIsBulkSelectMode(false);
        setCurrentStage('prepare_dispatch');
      } else {
        toast.error(`Failed to move orders: ${res.errors.join(', ')}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsMovingToPrepare(false);
    }
  };

  // Export current filtered orders to Excel
  const handleExportOrders = () => {
    if (filteredOrders.length === 0) {
      toast.error('No orders to export');
      return;
    }
    const data = filteredOrders.map(o => ({
      'Order ID': o.displayOrderId,
      'Order Date': o.orderDateDisplay || o.orderDate,
      'Customer Name': o.customerName,
      'Phone': o.phoneNumber || o.phone || '',
      'City': o.city || o.shippingCity || '',
      'State': o.state || o.shippingState || '',
      'Products': o.products || o.productSummary || '',
      'Quantity': o.totalQuantity || 1,
      'Total Amount': o.amount ?? o.totalAmount ?? 0,
      'Payment Method': o.orderType || (o.paymentMode || 'Prepaid'),
      'Status': o.workflowStage === 'active' ? 'Unfulfilled' : (o.workflowStage === 'fulfilled' ? 'Fulfilled' : o.status),
      'Fulfilled Date': o.fulfilledDate || '',
      'Courier': o.courier || 'Unassigned',
      'AWB Number': o.awbNumber || 'Unassigned',
      'Dispatched Date': o.dispatchDate || '',
      'Estimated Delivery': o.estimatedDeliveryDate || '',
      'Delivered Date': o.deliveredDate || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `Logistics_Orders_${currentStage}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${filteredOrders.length} orders successfully!`);
  };

  // Sync tracking status for a single order
  const handleSyncOrder = async (order: UnifiedLogisticsOrder) => {
    if (!order.rawId || !order.awbNumber) {
      toast.error('Cannot sync order without raw ID or AWB number');
      return;
    }

    setSyncingOrderIds(prev => new Set(prev).add(order.rawId!));
    try {
      const courier = order.courier || 'ST Courier';
      const result = await trackingEngine.trackSingle(courier, order.awbNumber);

      if (result.status && result.status !== 'Unknown') {
        await db.logistics_orders.update(order.rawId, {
          status: result.status,
          currentLocation: result.location || order.shippingCity || '',
          remarks: result.remarks || order.remarks || '',
          syncedAt: new Date().toISOString()
        });
        toast.success(`Synced #${order.displayOrderId}: ${result.status}`);
      } else {
        toast(`No new updates for #${order.displayOrderId}`, { icon: 'ℹ️' });
      }
    } catch (err: any) {
      toast.error(`Sync failed for #${order.displayOrderId}: ${err.message}`);
    } finally {
      setSyncingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.rawId!);
        return next;
      });
    }
  };

  // Bulk sync all live tracking orders
  const handleBulkSyncAll = async () => {
    const trackable = filteredOrders.filter(o => o.awbNumber && o.rawId);
    if (trackable.length === 0) {
      toast.error('No orders with AWB numbers to sync');
      return;
    }

    setIsBulkSyncing(true);
    const toastId = toast.loading(`Syncing live tracking for ${trackable.length} shipments...`);

    let updatedCount = 0;
    try {
      for (const order of trackable.slice(0, 20)) {
        try {
          const courier = order.courier || 'ST Courier';
          const result = await trackingEngine.trackSingle(courier, order.awbNumber!);
          if (result.status && result.status !== 'Unknown') {
            await db.logistics_orders.update(order.rawId!, {
              status: result.status,
              currentLocation: result.location || order.shippingCity || '',
              remarks: result.remarks || order.remarks || '',
              syncedAt: new Date().toISOString()
            });
            updatedCount++;
          }
        } catch (e) {
          // ignore single sync failure in bulk
        }
      }
      toast.success(`Sync complete! Updated ${updatedCount} shipments.`, { id: toastId });
    } catch (err: any) {
      toast.error(`Sync finished with issues: ${err.message}`, { id: toastId });
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncSalesOrdersFromSupabase();
      toast.success('Logistics records refreshed');
    } catch (e: any) {
      console.warn('Refresh error:', e);
      toast.error('Failed to sync orders from cloud');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteOrder = async (order: UnifiedLogisticsOrder) => {
    const rawId = order.rawId;
    const orderId = order.displayOrderId;
    if (!rawId && !orderId) return;

    const hasAwb = !!order.awbNumber;
    const isDispatchedOrDelivered = 
      hasAwb || 
      order.workflowStage === 'dispatched' || 
      order.workflowStage === 'fulfilled' || 
      (order.stage && ['dispatched', 'delivered', 'fulfilled'].includes(order.stage.toLowerCase())) ||
      (order.status && ['dispatched', 'delivered', 'fulfilled'].includes(order.status.toLowerCase()));

    let confirmMsg = `Are you sure you want to permanently delete order #${orderId}? This will automatically remove it from Sales and Logistics.`;

    if (isDispatchedOrDelivered) {
      confirmMsg = `⚠️ WARNING: Order #${orderId} has already been dispatched/fulfilled${hasAwb ? ` with AWB ${order.awbNumber}` : ''}.\n\nDeleting this order will permanently remove it from all operational Logistics views, counts, and Analytics while retaining shipment audit records.\n\nAre you sure you want to permanently delete this order?`;
    }

    if (!window.confirm(confirmMsg)) return;

    const toastId = toast.loading(`Deleting order #${orderId}...`);
    try {
      // 1. Delete from Sales (which updates Supabase sales_orders status to DELETED and cleans sales_raw_data)
      await websiteSalesService.deleteSalesOrder(orderId);

      // 2. Remove from selected IDs
      setSelectedOrderIds(prev => prev.filter(id => id !== order.id && id !== orderId));

      toast.success(`Order #${orderId} deleted successfully`, { id: toastId });
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      // Fallback: Ensure it is marked as trash in Dexie logistics orders
      try {
        await deleteLogisticsOrderByOrderId(orderId, 'Deleted from Logistics');
        setSelectedOrderIds(prev => prev.filter(id => id !== order.id && id !== orderId));
        toast.success(`Order #${orderId} removed from Logistics`, { id: toastId });
      } catch (innerErr: any) {
        toast.error(`Failed to delete order: ${err.message}`, { id: toastId });
      }
    }
  };

  const handleTrackOrder = (order: UnifiedLogisticsOrder) => {
    const dexieItem: Partial<LogisticsOrder> = {
      id: order.rawId,
      orderNumber: order.displayOrderId,
      customerName: order.customerName,
      customerPhone: order.phone,
      address: order.shippingAddress,
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
      
      {/* 1 & 2. ROW 1 (Main Workflow Navigation) + ROW 2 (Search and Global Actions) */}
      <LogisticsWorkflowToolbar
        currentStage={currentStage}
        onSelectStage={(st) => {
          setCurrentStage(st);
          setSelectedStatusTab('All');
          setIsBulkSelectMode(false);
          setSelectedOrderIds(new Set());
          setIsMoveReviewPanelOpen(false);
        }}
        counts={counts}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onToggleFilters={() => setIsFilterDrawerOpen(prev => !prev)}
        isFilterOpen={isFilterDrawerOpen}
        activeFilterCount={activeFilterCount}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenDateCalendar={() => setIsDateCalendarOpen(true)}
        onOpenReconcileModal={() => setIsReconcileModalOpen(true)}
        activeDateRangeText={
          logisticsFilters.datePreset !== 'all' && logisticsFilters.datePreset !== 'custom'
            ? (logisticsFilters.datePreset === '7d' ? 'Last 7 Days' : logisticsFilters.datePreset === '30d' ? 'Last 30 Days' : logisticsFilters.datePreset === 'this_month' ? 'This Month' : logisticsFilters.datePreset === 'prev_month' ? 'Prev Month' : logisticsFilters.datePreset === 'today' ? 'Today' : logisticsFilters.datePreset === 'yesterday' ? 'Yesterday' : logisticsFilters.datePreset === 'this_week' ? 'This Week' : 'This Year')
            : logisticsFilters.startDate
            ? formatRangeDisplay(logisticsFilters.startDate, logisticsFilters.endDate)
            : 'Date Range'
        }
        isDateFilterActive={logisticsFilters.datePreset !== 'all' || !!logisticsFilters.startDate}
      />

      {/* 3. ROW 3: CONTEXTUAL FILTERS AND SELECTION ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 shrink-0 w-full min-h-[40px]">
        
        {/* LEFT SIDE: Stage-Specific Filter Pills / Status Badges */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0.5 min-w-0">
          {currentStage === 'active' ? (
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              {ACTIVE_FILTER_PILLS.map((pill) => {
                const count = activeFilterCounts[pill.id as keyof typeof activeFilterCounts] || 0;
                const isActive = selectedStatusTab === pill.id;

                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedStatusTab(pill.id)}
                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-[#0b1220] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {pill.id === 'Pending' && <Clock size={13} className={isActive ? 'text-white' : 'text-amber-400'} />}
                    <span>{pill.label}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : currentStage === 'fulfilled' ? (
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b1220] border border-emerald-800/40 text-xs text-slate-300 shrink-0 mr-1">
                <PackageCheck size={14} className="text-emerald-400" />
                <span className="font-semibold text-slate-200">Fulfilled Orders</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-emerald-300 font-bold">{filteredOrders.length}</span>
              </div>
              {[
                { id: 'All', label: 'All Fulfilled' },
                { id: 'Prepaid', label: 'Prepaid' },
                { id: 'COD', label: 'COD' }
              ].map(pill => {
                const count = fulfilledFilterCounts[pill.id as keyof typeof fulfilledFilterCounts] || 0;
                const isActive = selectedStatusTab === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedStatusTab(pill.id)}
                    className={`h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                        : 'bg-[#0b1220] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : currentStage === 'prepare_dispatch' ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0b1220] border border-slate-800 text-xs text-slate-300 shrink-0">
              <Package size={14} className="text-purple-400" />
              <span className="font-semibold text-slate-200">Prepare Dispatch Queue</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-purple-300 font-bold">{stageShipments.length}</span>
              <span className="text-slate-400 hidden sm:inline">orders awaiting courier & AWB assignment</span>
            </div>
          ) : currentStage === 'dispatched' ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0b1220] border border-slate-800 text-xs text-slate-300 shrink-0">
              <Check size={14} className="text-emerald-400" />
              <span className="font-semibold text-slate-200">Dispatched Shipments</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-emerald-300 font-bold">{stageShipments.length}</span>
              <span className="text-slate-400 hidden sm:inline">orders confirmed dispatched</span>
            </div>
          ) : currentStage === 'tracking' ? (
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              {STATUS_PILLS.map((pill) => {
                const count = statusTabCounts[pill.id] || 0;
                const isActive = selectedStatusTab === pill.id;

                let badgeBorderClass = 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200';
                if (pill.id === 'All') {
                  badgeBorderClass = isActive
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                    : 'border-slate-800 text-slate-300 hover:border-purple-600';
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
                } else if (pill.id === 'Info Received') {
                  badgeBorderClass = isActive
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'border-indigo-800/40 text-indigo-400 hover:border-indigo-600';
                } else if (pill.id === 'Expired') {
                  badgeBorderClass = isActive
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600';
                }

                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedStatusTab(pill.id)}
                    className={`h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border bg-[#0b1220] ${badgeBorderClass}`}
                  >
                    <span>{pill.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : currentStage === 'analytics' ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0b1220] border border-purple-800/40 text-xs text-slate-300 shrink-0">
              <BarChart3 size={14} className="text-purple-400" />
              <span className="font-semibold text-slate-200">Logistics Analytics Dashboard</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-purple-300 font-bold">{filteredOrders.length}</span>
              <span className="text-slate-400 hidden sm:inline">records analyzed</span>
            </div>
          ) : null}
        </div>

        {/* RIGHT SIDE: Columns, Export, Courier Badges, and Bulk Select Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap">
          {currentStage === 'active' ? (
            <>
              {/* If Bulk Select is INACTIVE: show Columns, Export, and compact Bulk Select button */}
              {!isBulkSelectMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => toast('All columns visible', { icon: '📊' })}
                    className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Manage Visible Columns"
                  >
                    <SlidersHorizontal size={13} className="text-slate-400" />
                    <span>Columns</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportOrders}
                    className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Export filtered orders to Excel"
                  >
                    <Download size={13} className="text-slate-400" />
                    <span>Export</span>
                  </button>

                  {/* Visual separator before Bulk Select */}
                  <div className="h-5 w-px bg-slate-800 mx-1 shrink-0" />

                  {/* Compact Bulk Select Button */}
                  <button
                    type="button"
                    onClick={() => setIsBulkSelectMode(true)}
                    className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-[#0e1626] hover:bg-purple-950/40 text-purple-300 hover:text-white border border-purple-800/60 hover:border-purple-600 flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                    title="Enable Bulk Selection to move orders to Prepare Dispatch"
                  >
                    <CheckSquare size={14} className="text-purple-400" />
                    <span>Bulk Select</span>
                  </button>
                </>
              ) : (
                /* When Bulk Select is ACTIVE */
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Select All / Deselect All */}
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="h-9 px-3 rounded-xl text-xs font-semibold bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                      <>
                        <CheckSquare size={13} className="text-purple-400" />
                        <span>Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square size={13} className="text-slate-400" />
                        <span>Select All ({filteredOrders.length})</span>
                      </>
                    )}
                  </button>

                  {/* Selected Count & Total Amount Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-800/70 text-xs">
                    <span className="text-purple-200 font-semibold">
                      <strong className="text-white font-mono font-bold">{selectedOrderIds.size}</strong> selected
                    </span>
                    {selectedTotalAmount > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          ₹{Math.round(selectedTotalAmount).toLocaleString('en-IN')}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Primary Action: Move to Prepare Dispatch */}
                  <button
                    type="button"
                    onClick={handlePrepareDispatchBulk}
                    disabled={selectedOrderIds.size === 0 || isMovingToPrepare}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={selectedOrderIds.size === 0 ? "Select at least 1 order to move" : `Review & move ${selectedOrderIds.size} orders to Prepare Dispatch`}
                  >
                    <Truck size={14} />
                    <span>Move to Prepare Dispatch ({selectedOrderIds.size})</span>
                  </button>

                  {/* Exit Selection Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkSelectMode(false);
                      setSelectedOrderIds(new Set());
                      setIsMoveReviewPanelOpen(false);
                    }}
                    className="h-9 px-3 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Exit selection mode"
                  >
                    <X size={14} />
                    <span>Exit Selection</span>
                  </button>
                </div>
              )}
            </>
          ) : currentStage === 'fulfilled' ? (
            <>
              <button
                type="button"
                onClick={() => toast('All columns visible', { icon: '📊' })}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Manage Columns"
              >
                <SlidersHorizontal size={13} className="text-slate-400" />
                <span>Columns</span>
              </button>
              <button
                type="button"
                onClick={handleExportOrders}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export Fulfilled to Excel"
              >
                <Download size={13} className="text-slate-400" />
                <span>Export</span>
              </button>
            </>
          ) : currentStage === 'prepare_dispatch' ? (
            <button
              type="button"
              onClick={handleExportOrders}
              className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export to Excel"
            >
              <Download size={13} className="text-slate-400" />
              <span>Export</span>
            </button>
          ) : currentStage === 'dispatched' ? (
            <>
              <button
                type="button"
                onClick={() => toast('All columns visible', { icon: '📊' })}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Manage Columns"
              >
                <SlidersHorizontal size={13} className="text-slate-400" />
                <span>Columns</span>
              </button>
              <button
                type="button"
                onClick={handleExportOrders}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export to Excel"
              >
                <Download size={13} className="text-slate-400" />
                <span>Export</span>
              </button>
            </>
          ) : currentStage === 'tracking' ? (
            <>
              {/* Courier Badges */}
              <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                {CONFIGURED_COURIERS.map((c) => {
                  const count = courierCounts[c.name] || 0;
                  const isSelected = selectedCourier === c.name;

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCourier(prev => prev === c.name ? 'All' : c.name)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer border bg-[#0b1220] transition-all whitespace-nowrap ${
                        isSelected
                          ? `${c.badgeColor.bg} text-white border-purple-400 shadow-sm`
                          : `${c.badgeColor.border} ${c.badgeColor.text} hover:border-slate-600`
                      }`}
                      title={`Filter by ${c.name}`}
                    >
                      <span>{c.shortName}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Upload Tracking Button (Only in Tracking!) */}
              <button
                type="button"
                onClick={() => setIsCourierTrackingModalOpen(true)}
                className="h-9 px-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Upload tracking reports for India Post, iThink Logistics, etc."
              >
                <Truck size={14} />
                <span>Upload Tracking</span>
              </button>

              {/* Sync Button */}
              <button
                type="button"
                onClick={handleBulkSyncAll}
                disabled={isBulkSyncing}
                className="h-9 px-3 bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Sync live tracking status"
              >
                <RefreshCw size={13} className={isBulkSyncing ? 'animate-spin text-purple-400' : ''} />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={handleExportOrders}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export to Excel"
              >
                <Download size={13} className="text-slate-400" />
                <span>Export</span>
              </button>
            </>
          ) : currentStage === 'analytics' ? (
            <>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLogisticsFilters(INITIAL_LOGISTICS_FILTER_STATE);
                    setSelectedCourier('All');
                    toast.success('Filters cleared');
                  }}
                  className="h-9 px-3 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reset all active filters"
                >
                  <RotateCcw size={13} className="text-rose-400" />
                  <span>Reset Filters ({activeFilterCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleExportOrders}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#0e1626] hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export analyzed data to Excel"
              >
                <Download size={13} className="text-slate-400" />
                <span>Export Data</span>
              </button>
            </>
          ) : null}
        </div>

      </div>

      {/* ACTIVE FILTER CHIPS ROW (shown whenever filters are active in any stage) */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b1220] border border-purple-900/40 rounded-xl overflow-x-auto custom-scrollbar shrink-0 text-xs text-slate-300">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 shrink-0 flex items-center gap-1">
            <SlidersHorizontal size={12} /> Filters:
          </span>

          {(logisticsFilters.datePreset !== 'all' || logisticsFilters.startDate) && (
            <span 
              onClick={() => setIsDateCalendarOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-200 text-xs shrink-0 cursor-pointer hover:border-cyan-400 transition-colors shadow-sm"
              title="Click to adjust date range"
            >
              <Calendar size={11} className="text-cyan-400" />
              <span>
                Date: {formatRangeDisplay(logisticsFilters.startDate, logisticsFilters.endDate)}
                {logisticsFilters.datePreset !== 'all' && logisticsFilters.datePreset !== 'custom' ? ` (${logisticsFilters.datePreset})` : ''}
              </span>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLogisticsFilters(prev => ({ ...prev, datePreset: 'all', startDate: '', endDate: '' }));
                }}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear date filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {logisticsFilters.couriers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-700/50 text-blue-200 text-xs shrink-0">
              <Truck size={11} className="text-blue-400" />
              <span>Couriers: {logisticsFilters.couriers.join(', ')}</span>
              <button 
                type="button"
                onClick={() => setLogisticsFilters(prev => ({ ...prev, couriers: [] }))}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear courier filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {logisticsFilters.states.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-200 text-xs shrink-0">
              <span>States: {logisticsFilters.states.join(', ')}</span>
              <button 
                type="button"
                onClick={() => setLogisticsFilters(prev => ({ ...prev, states: [], cities: [] }))}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear state filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {logisticsFilters.cities.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-200 text-xs shrink-0">
              <span>Cities: {logisticsFilters.cities.join(', ')}</span>
              <button 
                type="button"
                onClick={() => setLogisticsFilters(prev => ({ ...prev, cities: [] }))}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear city filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {logisticsFilters.trackingStatuses.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-700/50 text-amber-200 text-xs shrink-0">
              <span>Status: {logisticsFilters.trackingStatuses.join(', ')}</span>
              <button 
                type="button"
                onClick={() => setLogisticsFilters(prev => ({ ...prev, trackingStatuses: [] }))}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear status filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {logisticsFilters.paymentModes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-200 text-xs shrink-0">
              <span>Payment: {logisticsFilters.paymentModes.join(', ')}</span>
              <button 
                type="button"
                onClick={() => setLogisticsFilters(prev => ({ ...prev, paymentModes: [] }))}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear payment filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {logisticsFilters.missingAwbOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-700/50 text-rose-200 text-xs shrink-0">
              <span>Missing AWB Only</span>
              <button 
                type="button"
                onClick={() => setLogisticsFilters(prev => ({ ...prev, missingAwbOnly: false }))}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear missing AWB filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {selectedCourier !== 'All' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-700/50 text-purple-200 text-xs shrink-0">
              <span>Courier: {selectedCourier}</span>
              <button 
                type="button"
                onClick={() => setSelectedCourier('All')}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Clear quick courier filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setLogisticsFilters(INITIAL_LOGISTICS_FILTER_STATE);
              setSelectedCourier('All');
              toast.success('All filters cleared');
            }}
            className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto shrink-0 pl-2 font-medium"
          >
            Clear All
          </button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTENT: Full-Width Table + Side Review Panel (Side-by-Side on Desktop) */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden pb-1">
        
        {/* Left Column: Table View (or Analytics Dashboard or Prepare Dispatch Grouped View) */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {currentStage === 'analytics' ? (
            <LogisticsAnalyticsDashboard
              orders={filteredOrders}
              allOrders={unifiedOrders}
              filters={logisticsFilters}
              onResetFilters={() => {
                setLogisticsFilters(INITIAL_LOGISTICS_FILTER_STATE);
                setSelectedCourier('All');
              }}
              onNavigateStage={(st) => setCurrentStage(st)}
              onOpenDateCalendar={() => setIsDateCalendarOpen(true)}
            />
          ) : currentStage === 'prepare_dispatch' ? (
            <PrepareDispatchGroupedView
              orders={stageShipments}
              onDispatchSuccess={() => {
                setCurrentStage('dispatched');
              }}
              onReturnToActive={async (rawIds) => {
                const res = await returnToActiveStage(rawIds);
                if (res.success) {
                  toast.success(`Returned ${res.returnedCount} orders to Active`);
                } else {
                  toast.error('Failed to return orders: ' + res.errors.join(', '));
                }
              }}
            />
          ) : filteredOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center bg-[#0b1220] border border-slate-800/90 rounded-2xl animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-sm">
                <Truck size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">
                {unifiedOrders.length === 0 
                  ? 'No Orders or Shipments in Logistics' 
                  : currentStage === 'active'
                  ? 'No Unfulfilled Orders in Active'
                  : currentStage === 'fulfilled'
                  ? 'No Fulfilled Orders Found'
                  : currentStage === 'dispatched'
                  ? 'No Dispatched Orders Found'
                  : currentStage === 'tracking'
                  ? 'No Shipments Available to Track'
                  : `No shipments match ${selectedStatusTab} in ${currentStage}`}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                {unifiedOrders.length === 0 
                  ? 'Click Upload Orders above to import customer orders from Shopify or Excel/CSV spreadsheets.' 
                  : currentStage === 'active'
                  ? 'All active orders have been moved to dispatch preparation or dispatched. Import new files or check other tabs.'
                  : currentStage === 'fulfilled'
                  ? 'Fulfilled orders imported from Shopify or marked fulfilled will appear here.'
                  : currentStage === 'dispatched'
                  ? 'Orders will appear here once dispatched from Prepare Dispatch with courier and AWB details.'
                  : currentStage === 'tracking'
                  ? 'Shipments will appear here once dispatched from Prepare Dispatch, or upload courier tracking reports.'
                  : 'Try adjusting your search query, status filters, or courier tabs above.'}
              </p>
              {currentStage === 'active' || currentStage === 'fulfilled' || unifiedOrders.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <UploadCloud size={15} />
                  <span>Upload Customer Orders</span>
                </button>
              ) : currentStage === 'tracking' ? (
                <button
                  type="button"
                  onClick={() => setIsCourierTrackingModalOpen(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-600/30 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Truck size={15} />
                  <span>Upload Courier Tracking Report</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <OrderTableView
                orders={filteredOrders}
                stage={currentStage}
                onTrackOrder={handleTrackOrder}
                onSyncOrder={handleSyncOrder}
                onViewCustomer={(key) => setSelectedCustomerKey(key)}
                onOpenDispatchModal={setOrderToDispatch}
                onDeleteOrder={handleDeleteOrder}
                syncingOrderIds={syncingOrderIds}
                isSelectable={isBulkSelectMode && currentStage === 'active'}
                selectedOrderIds={selectedOrderIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                allSelected={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
              />
            </div>
          )}
        </div>

        {/* Right Column: Move to Prepare Dispatch Review Side Panel (Matching Image 1) */}
        {isMoveReviewPanelOpen && (
          <MoveToPrepareSidePanel
            isOpen={isMoveReviewPanelOpen}
            onClose={() => setIsMoveReviewPanelOpen(false)}
            onConfirm={handleConfirmMoveToPrepare}
            selectedOrders={selectedOrdersList}
            isMoving={isMovingToPrepare}
            onDeselectOrder={(id) => {
              setSelectedOrderIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                if (next.size === 0) {
                  setIsMoveReviewPanelOpen(false);
                }
                return next;
              });
            }}
          />
        )}

      </div>

      {/* Slide-over Filter Drawer (Advanced Drawer matching Image 2 design) */}
      <LogisticsFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        orders={unifiedOrders}
        filters={logisticsFilters}
        onApply={(nextFilters) => {
          setLogisticsFilters(nextFilters);
          setIsFilterDrawerOpen(false);
          toast.success('Filters applied');
        }}
        onResetAll={() => {
          setLogisticsFilters(INITIAL_LOGISTICS_FILTER_STATE);
          setSelectedCourier('All');
          toast.success('All filters reset');
        }}
      />

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
          setCurrentStage('tracking');
        }}
      />

      {/* Excel / CSV Customer Orders Import Modal */}
      <OrderImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => setCurrentStage('active')}
      />

      {/* Courier Tracking Report Import Modal */}
      <CourierTrackingImportModal
        isOpen={isCourierTrackingModalOpen}
        onClose={() => setIsCourierTrackingModalOpen(false)}
        onImportSuccess={() => setCurrentStage('tracking')}
      />

      {/* Single Shipment Tracking Modal */}
      {activeTrackingOrder && (
        <TrackingModal
          order={activeTrackingOrder}
          onClose={() => setActiveTrackingOrder(null)}
        />
      )}

      {/* Reusable Date Range Calendar Modal */}
      {isDateCalendarOpen && (
        <DateRangeCalendarModal
          isOpen={isDateCalendarOpen}
          onClose={() => setIsDateCalendarOpen(false)}
          startDate={logisticsFilters.startDate}
          endDate={logisticsFilters.endDate}
          preset={logisticsFilters.datePreset}
          targetDateField={logisticsFilters.dateField}
          onTargetDateFieldChange={(df) => setLogisticsFilters(prev => ({ ...prev, dateField: df }))}
          onApply={(range) => {
            setLogisticsFilters(prev => ({
              ...prev,
              startDate: range.startDate,
              endDate: range.endDate,
              datePreset: range.preset
            }));
            toast.success(`Date filter applied: ${formatRangeDisplay(range.startDate, range.endDate)}`);
          }}
        />
      )}

      {/* Logistics & Sales Data Reconciliation Diagnostics Modal */}
      <LogisticsReconciliationModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
      />

    </div>
  );
};
