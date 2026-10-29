import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Truck, 
  ChevronDown, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Copy, 
  RotateCcw,
  Sparkles,
  MapPin,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import db from '../../../lib/db';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../config/courierConfig';
import { executeDispatchOrder, executeBulkDispatchOrders } from '../../../services/unifiedLogisticsService';
import { validateCourierAwb } from '../../../utils/logisticsOrderUtils';

interface PrepareDispatchGroupedViewProps {
  orders: UnifiedLogisticsOrder[];
  onDispatchSuccess: () => void;
  onReturnToActive: (rawIds: number[]) => void;
}

interface BatchGroup {
  batchId: string;
  batchName: string;
  dispatchDate: string;
  orders: UnifiedLogisticsOrder[];
}

export const PrepareDispatchGroupedView: React.FC<PrepareDispatchGroupedViewProps> = ({
  orders,
  onDispatchSuccess,
  onReturnToActive
}) => {
  // Expanded batch cards state
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  // Selected individual order IDs
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Local draft inputs for Courier and AWB (order.id -> value)
  const [orderCouriers, setOrderCouriers] = useState<Record<string, string>>({});
  const [orderAwbs, setOrderAwbs] = useState<Record<string, string>>({});
  const [isDispatching, setIsDispatching] = useState(false);

  // Group orders into batches (by batchId/batchName or default to Batch 1)
  const batchGroups = useMemo<BatchGroup[]>(() => {
    const map = new Map<string, BatchGroup>();

    orders.forEach((ord, index) => {
      const bId = ord.batchId || 'batch_default';
      const bName = ord.batchName || (ord.batchId ? `Batch ${ord.batchId}` : 'Batch 1 — Ready for Dispatch');
      const dDate = ord.dispatchDate || new Date().toISOString().slice(0, 10);

      if (!map.has(bId)) {
        map.set(bId, {
          batchId: bId,
          batchName: bName,
          dispatchDate: dDate,
          orders: []
        });
      }
      map.get(bId)!.orders.push(ord);
    });

    const groups = Array.from(map.values());
    // Auto-expand first batch if only 1-2 batches
    return groups;
  }, [orders]);

  // Expand all by default if newly loaded
  React.useEffect(() => {
    if (batchGroups.length > 0 && expandedBatchIds.size === 0) {
      setExpandedBatchIds(new Set(batchGroups.map(b => b.batchId)));
    }
  }, [batchGroups]);

  const toggleExpand = (batchId: string) => {
    setExpandedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const handleToggleSelectOrder = (orderId: string) => {
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

  const handleToggleSelectBatch = (batch: BatchGroup) => {
    const batchOrderIds = batch.orders.map(o => o.id);
    const allSelected = batchOrderIds.every(id => selectedOrderIds.has(id));

    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        batchOrderIds.forEach(id => next.delete(id));
      } else {
        batchOrderIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBatchAssignCourier = (batch: BatchGroup, courierName: string) => {
    const updates: Record<string, string> = { ...orderCouriers };
    batch.orders.forEach(o => {
      updates[o.id] = courierName;
    });
    setOrderCouriers(updates);
    toast.success(`Assigned ${courierName} to all ${batch.orders.length} orders in ${batch.batchName}`);
  };

  const getEffectiveCourier = (order: UnifiedLogisticsOrder): string => {
    return orderCouriers[order.id] || order.courier || 'ST Courier';
  };

  const getEffectiveAwb = (order: UnifiedLogisticsOrder): string => {
    return orderAwbs[order.id] !== undefined ? orderAwbs[order.id] : (order.awbNumber || '');
  };

  // Dispatch single order
  const handleDispatchSingle = async (order: UnifiedLogisticsOrder) => {
    const courier = getEffectiveCourier(order);
    const awb = getEffectiveAwb(order).trim();

    const val = validateCourierAwb(courier, awb);
    if (!val.valid) {
      toast.error(val.error || `Please enter a valid AWB number for order #${order.orderId}`);
      return;
    }

    if (!order.rawId) {
      toast.error('Unable to dispatch: missing local database ID');
      return;
    }

    try {
      const res = await executeDispatchOrder({
        rawId: order.rawId,
        courier,
        awbNumber: awb,
        batchId: order.batchId,
        batchName: order.batchName
      });

      if (res.success) {
        toast.success(`Order #${order.orderId} dispatched with ${courier}! Available in Dispatched and Tracking.`);
        onDispatchSuccess();
      } else {
        toast.error('Dispatch failed: ' + res.error);
      }
    } catch (err: any) {
      toast.error('Dispatch failed: ' + err.message);
    }
  };

  // Bulk dispatch selected orders
  const handleDispatchSelected = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error('Select at least one order to dispatch');
      return;
    }

    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    
    // Validate all have valid couriers and AWBs
    for (const ord of selectedOrders) {
      const courier = getEffectiveCourier(ord);
      const awb = getEffectiveAwb(ord).trim();
      const val = validateCourierAwb(courier, awb);
      if (!val.valid) {
        toast.error(`Order #${ord.orderId}: ${val.error}`);
        return;
      }
    }

    setIsDispatching(true);
    const toastId = toast.loading(`Dispatching ${selectedOrders.length} orders...`);

    try {
      const dispatchItems = selectedOrders.map(ord => ({
        rawId: ord.rawId!,
        courier: getEffectiveCourier(ord),
        awbNumber: getEffectiveAwb(ord).trim(),
        batchId: ord.batchId,
        batchName: ord.batchName
      }));

      const res = await executeBulkDispatchOrders(dispatchItems);

      if (res.success) {
        toast.success(`Dispatched ${res.dispatchedCount} orders successfully! Available in Dispatched and Tracking.`, { id: toastId });
        setSelectedOrderIds(new Set());
        onDispatchSuccess();
      } else {
        toast.error(`Failed to dispatch orders: ${res.errors.join(', ')}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error('Dispatch failed: ' + err.message, { id: toastId });
    } finally {
      setIsDispatching(false);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0b1220] border border-slate-800/90 rounded-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-sm">
          <Package size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">
          No Orders Waiting to be Dispatched
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
          To prepare orders for dispatch, select unfulfilled orders in the Active tab and click 'Prepare Dispatch'.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-y-auto custom-scrollbar pb-10">
      {/* Top Batch Management Action Bar */}
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-700/60 flex items-center justify-center text-purple-300">
            <Package size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Prepare Dispatch</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                {orders.length} Orders
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Assign couriers, enter AWB numbers, and confirm dispatches by batch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedOrderIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const rawIds = orders
                  .filter(o => selectedOrderIds.has(o.id) && o.rawId)
                  .map(o => o.rawId!);
                onReturnToActive(rawIds);
                setSelectedOrderIds(new Set());
              }}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Return to Active ({selectedOrderIds.size})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDispatchSelected}
            disabled={selectedOrderIds.size === 0 || isDispatching}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={14} />
            <span>Confirm & Dispatch ({selectedOrderIds.size})</span>
          </button>
        </div>
      </div>

      {/* Batch Cards matching Influencer Logistics style */}
      <div className="space-y-4">
        {batchGroups.map((batch) => {
          const isExpanded = expandedBatchIds.has(batch.batchId);
          const allBatchSelected = batch.orders.every(o => selectedOrderIds.has(o.id));
          const readyCount = batch.orders.filter(o => !!getEffectiveAwb(o).trim()).length;

          return (
            <div 
              key={batch.batchId}
              className="bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg transition-all"
            >
              {/* Batch Card Header */}
              <div 
                className="px-5 py-4 bg-[#0e1626] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleExpand(batch.batchId)}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelectBatch(batch);
                    }}
                    className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    {allBatchSelected ? (
                      <CheckSquare size={16} className="text-purple-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{batch.batchName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {batch.orders.length} Orders
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      readyCount === batch.orders.length
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60'
                        : 'bg-amber-950 text-amber-400 border-amber-700/60'
                    }`}>
                      {readyCount} / {batch.orders.length} Ready
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                  {/* Quick Assign Courier to whole batch */}
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="text-[11px] hidden sm:inline">Set Courier:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBatchAssignCourier(batch, e.target.value);
                        }
                      }}
                      defaultValue=""
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value="" disabled>Select Courier for Batch</option>
                      {CONFIGURED_COURIERS.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Expand / Collapse Chevron */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(batch.batchId)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>
              </div>

              {/* Batch Orders Table */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b1220] text-slate-400 border-b border-slate-800/80 uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="px-3 py-3 w-8"></th>
                        <th className="px-3 py-3">ORDER ID</th>
                        <th className="px-3 py-3">CUSTOMER & SHIPPING</th>
                        <th className="px-3 py-3">PRODUCTS</th>
                        <th className="px-3 py-3">ASSIGN COURIER</th>
                        <th className="px-3 py-3">AWB / TRACKING NO</th>
                        <th className="px-3 py-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {batch.orders.map((order) => {
                        const isSelected = selectedOrderIds.has(order.id);
                        const curCourier = getEffectiveCourier(order);
                        const curAwb = getEffectiveAwb(order);
                        const isReady = curAwb.trim().length > 0;

                        return (
                          <tr 
                            key={order.id}
                            className={`hover:bg-slate-900/40 transition-colors ${
                              isSelected ? 'bg-purple-950/20' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectOrder(order.id)}
                                className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare size={15} className="text-purple-400" />
                                ) : (
                                  <Square size={15} className="text-slate-500" />
                                )}
                              </button>
                            </td>

                            {/* Order ID */}
                            <td className="px-3 py-3 font-mono font-bold text-slate-200">
                              <div className="flex flex-col">
                                <span>{order.displayOrderId}</span>
                                <span className="text-[10px] font-sans text-slate-500">{order.orderType}</span>
                              </div>
                            </td>

                            {/* Customer & Address */}
                            <td className="px-3 py-3 max-w-xs">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-200">{order.customerName}</span>
                                <span className="text-[11px] text-slate-400">{order.phoneNumber}</span>
                                <span className="text-[10px] text-slate-500 truncate" title={order.address}>
                                  {order.city || ''} {order.state ? `(${order.state})` : ''} - {order.pincode || ''}
                                </span>
                              </div>
                            </td>

                            {/* Products */}
                            <td className="px-3 py-3 max-w-[200px]">
                              <span className="text-[11px] text-slate-300 truncate block" title={order.products}>
                                {order.products}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-emerald-400">
                                ₹{order.amount}
                              </span>
                            </td>

                            {/* Courier Dropdown */}
                            <td className="px-3 py-3">
                              <select
                                value={curCourier}
                                onChange={(e) => {
                                  setOrderCouriers(prev => ({
                                    ...prev,
                                    [order.id]: e.target.value
                                  }));
                                }}
                                className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-purple-500 cursor-pointer"
                              >
                                {CONFIGURED_COURIERS.map(c => (
                                  <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* AWB Input */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={curAwb}
                                  placeholder="Enter AWB..."
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setOrderAwbs(prev => ({
                                      ...prev,
                                      [order.id]: val
                                    }));
                                  }}
                                  className={`w-36 bg-slate-900 border rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none transition-colors ${
                                    isReady 
                                      ? 'border-emerald-700/80 text-emerald-300 focus:border-emerald-500' 
                                      : 'border-slate-700 text-white focus:border-purple-500'
                                  }`}
                                />
                                {isReady ? (
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                ) : (
                                  <AlertCircle size={14} className="text-amber-400 shrink-0" title="AWB required before dispatch" />
                                )}
                              </div>
                            </td>

                            {/* Action Button */}
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDispatchSingle(order)}
                                disabled={!isReady}
                                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                              >
                                <span>Dispatch</span>
                                <ArrowRight size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
