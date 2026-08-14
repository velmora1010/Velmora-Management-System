import React, { useState } from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { trackingEngine } from '../../services/tracking/trackingEngine';
import { Search, RefreshCw, AlertCircle, Clock, Truck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LogisticsOrder } from '../../types/logistics';
import { isCourierActive } from '../../config/courierConfig';

const TABS = [
  'All',
  'Exception',
  'Failed Attempt',
  'Pending',
  'In Transit',
  'Delivered',
  'Out for Delivery',
  'Info Received',
  'Expired'
] as const;

type TabType = typeof TABS[number];

export const TrackingStatus: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [syncingIds, setSyncingIds] = useState<number[]>([]);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    completed: number;
    total: number;
    checking: number;
    queued: number;
    success: number;
    failed: number;
    phase: 'first-pass' | 'retrying' | 'complete';
    retryCount?: number;
  } | null>(null);
  
  // State for showing the detailed sync error log modal
  const [errorOrder, setErrorOrder] = useState<LogisticsOrder | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Load orders in tracking stage
  const trackingOrdersRaw = useLiveQuery(
    () => db.logistics_orders.where('stage').equals('tracking').reverse().toArray(),
    []
  ) ?? [];

  const trackingOrders = React.useMemo(() => {
    return trackingOrdersRaw.filter(o => isCourierActive(o.courier));
  }, [trackingOrdersRaw]);

  // Status mapping helper
  const getOrderTabStatus = (ord: LogisticsOrder): string => {
    let statusText = (ord.status || '').trim();
    if (ord.trackingError === 'Sync not available for this courier') {
      statusText = 'Sync not available';
    }

    // Check syncState first
    if (ord.syncState === 'queued' || ord.syncState === 'checking' || ord.syncState === 'retrying') {
      if (statusText && statusText !== 'Waiting...' && statusText !== 'Checking...' && statusText !== 'Queued') {
        // fallthrough to evaluate the actual status text
      } else {
        return 'Pending';
      }
    }

    if (statusText === '' || statusText === 'Not Tracked') {
      return 'Pending';
    }

    const s = statusText.toLowerCase();
    
    if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
      return 'Out for Delivery';
    }
    if (s.includes('in transit')) {
      return 'In Transit';
    }
    if (s.includes('delivered')) {
      return 'Delivered';
    }
    if (s.includes('pending')) {
      return 'Pending';
    }
    if (
      s.includes('exception') || 
      s.includes('error') || 
      s.includes('unable to fetch') || 
      s.includes('sync failed') || 
      s.includes('rto') ||
      s.includes('returned') ||
      s.includes('sync not available') || 
      s.includes('unknown')
    ) {
      return 'Exception';
    }
    if (s.includes('failed')) {
      return 'Failed Attempt';
    }
    if (s.includes('info received') || s.includes('shipment created') || s.includes('booked')) {
      return 'Info Received';
    }
    if (s.includes('expired')) {
      return 'Expired';
    }
    
    return 'Pending'; 
  };

  // Tab counts calculation from live tracking orders
  const tabCounts = React.useMemo(() => {
    const counts: Record<TabType, number> = {
      All: trackingOrders.length,
      Exception: 0,
      'Failed Attempt': 0,
      Pending: 0,
      'In Transit': 0,
      Delivered: 0,
      'Out for Delivery': 0,
      'Info Received': 0,
      Expired: 0
    };

    for (const ord of trackingOrders) {
      const tabStatus = getOrderTabStatus(ord) as TabType;
      if (counts[tabStatus] !== undefined) {
        counts[tabStatus]++;
      }
    }

    return counts;
  }, [trackingOrders]);

  // Filter orders by search term and active tab status
  const filteredOrders = trackingOrders.filter((ord) => {
    const search = searchTerm.toLowerCase().trim();
    const matchesSearch = !search ||
      ord.orderId.toLowerCase().includes(search) ||
      ord.phoneNumber.toLowerCase().includes(search) ||
      (ord.awbNumber && ord.awbNumber.toLowerCase().includes(search));

    const ordTabStatus = getOrderTabStatus(ord);
    const matchesTab = activeTab === 'All' || ordTabStatus === activeTab;

    return matchesSearch && matchesTab;
  });

  const getButtonState = (ord: LogisticsOrder) => {
    if (syncingIds.includes(ord.id!) || ord.syncState === 'checking' || ord.syncState === 'retrying') {
      return 'Checking...';
    }
    if (ord.syncState === 'queued') {
      return 'Queued';
    }
    if (ord.courier === 'Delhivery' || ord.courier === 'Ekart' || ord.trackingError === 'Sync not available for this courier') {
      return 'Not Available';
    }
    if (ord.status === 'Sync Failed') {
      return 'Retry';
    }
    if (ord.syncedAt || ord.lastFailedAt) {
      return 'Sync Again';
    }
    return 'Sync';
  };

  const syncRow = async (order: LogisticsOrder, isBulk = false) => {
    if (!order.id || !order.awbNumber) return { success: false, error: 'Missing AWB' };
    
    setSyncingIds(prev => [...prev, order.id!]);

    const toastId = `sync-${order.id}`;
    if (!isBulk) {
      toast.loading('Syncing status...', { id: toastId });
    }

    try {
      const originalStatus = order.status;
      const isNew = !originalStatus || originalStatus === 'Not Tracked' || originalStatus === 'Pending';
      
      await db.logistics_orders.update(order.id, {
        status: isNew ? 'Checking...' : originalStatus,
        syncState: 'checking',
        trackingError: undefined
      });

      const res = await trackingEngine.syncOrder(order.id, originalStatus);
      
      if (!isBulk) {
        if (res.success) {
          toast.success('Synced successfully', { id: toastId });
        } else if (res.supported === false) {
          toast.error('Sync not available', { id: toastId });
        } else {
          toast.error('Sync Failed', { id: toastId });
        }
      }
      return {
        success: res.success,
        status: res.status,
        notAvailable: res.supported === false
      };
    } catch (err: any) {
      if (!isBulk) {
        toast.error('Sync Failed', { id: toastId });
      }
      return { success: false, status: 'Sync Failed', error: err.message || String(err) };
    } finally {
      setSyncingIds(prev => prev.filter(id => id !== order.id));
    }
  };

  const handleBulkSync = async () => {
    const syncableOrders = filteredOrders.filter(o => o.awbNumber);
    
    // Filter out already Delivered and RTO terminal states
    const eligibleOrders = syncableOrders.filter(o => {
      const statusLower = (o.status || '').toLowerCase().trim();
      const isDelivered = statusLower.includes('delivered');
      const isRto = statusLower.includes('rto') || statusLower.includes('returned') || statusLower.includes('return to origin');
      return !isDelivered && !isRto;
    });

    if (eligibleOrders.length === 0) {
      toast.error('No eligible active shipments (non-Delivered/non-RTO ST Courier shipments) found to sync.', { id: 'bulk-sync-toast' });
      return;
    }

    setIsBulkSyncing(true);
    const total = eligibleOrders.length;
    const progressToastId = 'bulk-sync-toast';
    toast.loading(
      `ST Courier Bulk Sync\n\nCompleted: 0 / ${total}\nChecking: 0\nQueued: ${total}\nSuccessful: 0\nFailed: 0`,
      { id: progressToastId }
    );

    try {
      const res = await trackingEngine.syncBulkOptimized(eligibleOrders, (stats) => {
        setBulkProgress(stats);

        if (stats.phase === 'first-pass') {
          toast.loading(
            `ST Courier Bulk Sync\n\nCompleted: ${stats.completed} / ${stats.total}\nChecking: ${stats.checking}\nQueued: ${stats.queued}\nSuccessful: ${stats.success}\nFailed: ${stats.failed}`,
            { id: progressToastId }
          );
        } else if (stats.phase === 'retrying') {
          toast.loading(
            `ST Courier Bulk Sync (Retrying Failed Shipments...)\n\nCompleted: ${stats.completed} / ${stats.total}\nChecking: ${stats.checking}\nQueued: ${stats.queued}\nSuccessful: ${stats.success}\nFailed: ${stats.failed}`,
            { id: progressToastId }
          );
        }
      });

      toast.dismiss(progressToastId);
      toast.success(`Bulk sync complete. Successful: ${res.success}, Failed: ${res.failed}`);
    } catch (err) {
      toast.error('Bulk sync failed.', { id: progressToastId });
    } finally {
      setIsBulkSyncing(false);
      setBulkProgress(null);
    }
  };

  const confirmClearAll = async () => {
    setIsClearModalOpen(false);
    const toastId = toast.loading('Clearing tracking records...');
    try {
      const ordersToClear = await db.logistics_orders.where('stage').equals('tracking').toArray();
      
      for (const order of ordersToClear) {
        if (order.id) {
          await db.logistics_orders.update(order.id, {
            stage: 'order_data',
            awbNumber: undefined,
            courier: undefined,
            status: undefined,
            trackingError: undefined,
            syncedAt: undefined
          });
        }
      }

      await db.tracking_logs.clear();
      toast.success('Tracking records cleared successfully.', { id: toastId });
    } catch (err: any) {
      toast.error(`Failed to clear tracking records: ${err.message || String(err)}`, { id: toastId });
    }
  };

  const getStatusDisplay = (ord: LogisticsOrder) => {
    if (ord.courier === 'Delhivery' || ord.courier === 'Ekart' || ord.trackingError === 'Sync not available for this courier') {
      return 'Sync not available';
    }
    
    let statusText = (ord.status || '').trim();
    if (statusText === '' || statusText === 'Not Tracked') {
      return 'Pending';
    }

    const s = statusText.toLowerCase();
    
    if (s.includes('rto') || s.includes('returned') || s === 'rto') {
      return 'RTO';
    }
    if (s.includes('delivered')) {
      return 'Delivered';
    }
    if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
      return 'Out for Delivery';
    }
    if (
      s.includes('transit') ||
      s.includes('processed') ||
      s.includes('forwarded')
    ) {
      return 'In Transit';
    }
    if (
      s.includes('booked') ||
      s.includes('info received') ||
      s.includes('manifest')
    ) {
      return 'Info Received';
    }
    if (s.includes('pending')) {
      return 'Pending';
    }
    if (
      s.includes('exception') || 
      s.includes('error') || 
      s.includes('unable to fetch') || 
      s.includes('unknown')
    ) {
      return 'Exception';
    }
    if (s.includes('failed') || ord.trackingError) {
      return 'Sync Failed';
    }
    return statusText;
  };

  const getStatusBadgeClass = (statusText: string) => {
    if (statusText === 'Sync not available') return 'bg-slate-800 text-slate-500 border-slate-700/50';
    if (statusText === 'Pending') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    
    const s = statusText.toLowerCase();
    if (s.includes('delivered')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s.includes('transit') || s.includes('out')) return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    if (s.includes('rto') || s.includes('fail') || s.includes('exception')) return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-slate-850 text-slate-400 border-slate-750/80';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-5">
      
      {/* Top Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Tracking Status</h2>
          <p className="text-muted text-[11px] mt-1">Monitor shipment delivery statuses. Sync updates automatically from couriers.</p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => setIsClearModalOpen(true)}
            disabled={isBulkSyncing || syncingIds.length > 0 || trackingOrders.length === 0}
            className="h-9 flex items-center gap-1.5 border border-red-500/35 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent text-red-400 text-xs px-4 rounded-xl font-semibold transition-all shadow-sm cursor-pointer"
          >
            Clear All
          </button>

          <button
            onClick={handleBulkSync}
            disabled={isBulkSyncing || filteredOrders.length === 0}
            className="h-9 flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white text-xs px-4 rounded-xl font-semibold transition-all shadow-sm shadow-primary/10 cursor-pointer"
          >
            <RefreshCw size={13} className={isBulkSyncing ? 'animate-spin' : ''} />
            {isBulkSyncing ? 'Syncing...' : 'Sync Current List'}
          </button>
        </div>
      </div>

      {/* Filters and Tabs Area */}
      <div className="flex flex-col gap-4 bg-slate-900/40 p-4 rounded-xl border border-border/10 shrink-0">
        {/* Search Bar */}
        <div className="relative max-w-sm">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ID, Phone, AWB..."
            className="h-9 w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs text-slate-200 focus:outline-none focus:border-primary placeholder:text-slate-600 shadow-sm"
          />
          <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
        </div>

        {/* Horizontal Status Tab Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-1.5 rounded-2xl shrink-0 flex items-center overflow-x-auto custom-scrollbar shadow-lg">
          <div className="flex items-center gap-1.5">
            {TABS.map((tab, idx) => {
              const count = tabCounts[tab];
              const isActive = activeTab === tab;
              return (
                <React.Fragment key={tab}>
                  {idx > 0 && <div className="w-[1px] h-5 bg-slate-800/60 shrink-0 mx-1"></div>}
                  <button
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
                      isActive
                        ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                    }`}
                  >
                    <span>{tab}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-850 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="flex-1 min-h-0 bg-slate-950/40 border border-border/10 rounded-xl flex flex-col overflow-hidden">
        {filteredOrders.length > 0 ? (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-auto min-w-[900px]">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Order ID</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">AWB Number</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Courier</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center">Status</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center">Last Synced</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {filteredOrders.map((ord) => {
                  const isSyncing = syncingIds.includes(ord.id!);
                  const buttonState = getButtonState(ord);
                  return (
                    <tr key={ord.id} className="hover:bg-slate-900/35 transition-colors">
                      <td className="px-4 py-2 text-slate-300 font-mono font-bold">{ord.orderId}</td>
                      <td className="px-4 py-2 text-slate-200 font-mono font-bold">{ord.awbNumber}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                          {ord.courier}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(getStatusDisplay(ord))}`}>
                            {(isSyncing || ord.syncState === 'checking' || ord.syncState === 'retrying') && <RefreshCw size={10} className="animate-spin" />}
                            {getStatusDisplay(ord)}
                          </span>
                          {ord.syncState && ord.syncState !== 'idle' && (
                            <span className="text-[9px] text-slate-500 font-semibold animate-pulse">
                              {ord.syncState === 'queued' ? 'queued' : ord.syncState === 'checking' ? 'checking...' : 'retrying...'}
                            </span>
                          )}
                          
                          {/* Sync Error View Error Trigger */}
                          {ord.trackingError && ord.trackingError !== 'Sync not available for this courier' && (
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-red-400 font-semibold">
                              <span>Last sync failed</span>
                              <span className="text-slate-500">·</span>
                              <button
                                onClick={() => setErrorOrder(ord)}
                                className="hover:text-red-300 underline transition-colors cursor-pointer"
                              >
                                View Error
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center text-slate-400 font-medium">
                        {ord.syncedAt ? (
                          <div className="flex items-center justify-center gap-1">
                            <Clock size={11} className="text-slate-500" />
                            <span>{ord.syncedAt}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2 text-center bg-transparent">
                        <button
                          onClick={() => syncRow(ord)}
                          disabled={isSyncing || buttonState === 'Checking...' || buttonState === 'Not Available' || isBulkSyncing}
                          className={`h-7 px-3 border rounded-xl text-[10px] font-bold transition-all w-24 cursor-pointer ${
                            buttonState === 'Checking...'
                              ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                              : buttonState === 'Sync Again'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                              : buttonState === 'Retry'
                              ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                              : buttonState === 'Not Available'
                              ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                              : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                          }`}
                          title={buttonState === 'Not Available' ? 'Sync not supported for this courier' : 'Sync latest status'}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {buttonState === 'Checking...' && <RefreshCw size={10} className="animate-spin" />}
                            <span>{buttonState}</span>
                          </div>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic p-6 space-y-3">
            <Truck size={32} className="opacity-40 text-primary" />
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-400">No tracking records available.</p>
              <p className="text-[11px] text-muted mt-1 font-normal">Track an order from the Order Data section to start monitoring shipments.</p>
            </div>
          </div>
        )}
      </div>

      {/* View Error Modal */}
      {errorOrder && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md shadow-2xl overflow-hidden relative">
            <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-850">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <AlertCircle size={16} /> Sync Error Log
              </h3>
              <button 
                onClick={() => setErrorOrder(null)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-700/60 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-border/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Order ID:</span>
                  <span className="text-white font-mono font-bold">{errorOrder.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">AWB Number:</span>
                  <span className="text-white font-mono font-bold">{errorOrder.awbNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Courier:</span>
                  <span className="text-slate-200 font-semibold">{errorOrder.courier}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-muted uppercase tracking-wider text-[10px] font-bold">Backend Error Message</span>
                <p className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 text-red-400 font-mono font-semibold leading-relaxed break-words whitespace-pre-wrap">
                  {errorOrder.trackingError || 'No error message returned.'}
                </p>
              </div>
            </div>

            <div className="p-5 pt-0 border-t border-border/10 bg-slate-800/10 flex justify-end h-16 items-center">
              <button
                onClick={() => setErrorOrder(null)}
                className="px-5 h-9 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md shadow-2xl overflow-hidden relative">
            <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-850">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <AlertCircle size={16} /> Clear Tracking Records
              </h3>
              <button 
                onClick={() => setIsClearModalOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-700/60 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                This will permanently remove all tracking records from the Tracking Status list. This action cannot be undone.
              </p>
            </div>

            <div className="p-5 pt-0 border-t border-border/10 bg-slate-800/10 flex justify-end h-16 items-center gap-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-5 h-9 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearAll}
                className="px-5 h-9 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkSyncing && bulkProgress && (
        <div className="fixed bottom-6 right-6 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-5 w-80 text-xs text-slate-300 font-semibold z-50 animate-in slide-in-from-bottom duration-300">
          <div className="text-white font-bold text-sm border-b border-slate-800/80 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="text-primary animate-spin" size={14} />
              {bulkProgress.phase === 'first-pass' ? 'ST Courier Bulk Sync' : 'Retrying Failed Shipments'}
            </span>
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              {Math.round((bulkProgress.completed / bulkProgress.total) * 100) || 0}%
            </span>
          </div>
          
          <div className="space-y-2 mt-3.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Completed:</span>
              <span className="text-white font-mono font-bold">{bulkProgress.completed} / {bulkProgress.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Checking (Active):</span>
              <span className="text-blue-400 font-mono font-bold">{bulkProgress.checking}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Queued:</span>
              <span className="text-slate-500 font-mono font-bold">{bulkProgress.queued}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/60 pt-2">
              <span className="text-emerald-400">Successful:</span>
              <span className="text-emerald-400 font-mono font-bold">{bulkProgress.success}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">Failed:</span>
              <span className="text-red-400 font-mono font-bold">{bulkProgress.failed}</span>
            </div>
          </div>
          
          {bulkProgress.phase === 'retrying' && (
            <div className="mt-3.5 pt-2.5 border-t border-slate-850 text-[10px] text-yellow-400/90 flex items-center gap-1.5">
              <AlertCircle size={12} />
              <span>Retrying failed shipments (Attempt {bulkProgress.retryCount || 2})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
