import React, { useState, useMemo } from 'react';
import { ShoppingBag, ChevronDown, ChevronUp, Search, X, Eye, Trash2, ExternalLink } from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import { filterOrdersBySearch, resolveCanonicalLocation } from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
import { OrderDetailsModal } from './OrderDetailsModal';
import { AnalyticsProductCell } from './AnalyticsProductCell';
import toast from 'react-hot-toast';

interface CardMatchingOrdersListProps {
  orders: WebsiteConsolidatedOrder[];
  title?: string;
  emptyText?: string;
  onOrderDeleted?: (orderId: string) => void;
  onViewAll?: (title: string, orders: WebsiteConsolidatedOrder[]) => void;
}

export const CardMatchingOrdersList: React.FC<CardMatchingOrdersListProps> = ({
  orders,
  title = 'Matching Orders',
  emptyText = 'No matching orders.',
  onOrderDeleted,
  onViewAll
}) => {
  const [showAll, setShowAll] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WebsiteConsolidatedOrder | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  // Ensure unique Order IDs only and exclude locally deleted orders
  const uniqueOrders = useMemo(() => {
    const seen = new Set<string>();
    return orders.filter(o => {
      if (locallyDeletedIds.has(o.order_id)) return false;
      if (seen.has(o.order_id)) return false;
      seen.add(o.order_id);
      return true;
    });
  }, [orders, locallyDeletedIds]);

  // Apply local card search across the FULL dataset
  const searchedOrders = useMemo(() => {
    if (!localSearch.trim()) return uniqueOrders;
    return filterOrdersBySearch(uniqueOrders, localSearch);
  }, [uniqueOrders, localSearch]);

  const visibleOrders = (showAll || localSearch.trim()) ? searchedOrders : searchedOrders.slice(0, 5);

  const handleDeleteSingleOrder = async (order: WebsiteConsolidatedOrder) => {
    const hasAwb = !!order.awb_number;
    const isDispatchedOrDelivered = 
      hasAwb || 
      (order.fulfillment_status && ['fulfilled', 'shipped', 'delivered'].includes(order.fulfillment_status.toLowerCase()));

    let confirmMsg = `Are you sure you want to permanently delete order #${order.order_id}? This will automatically remove it from Sales and Logistics.`;

    if (isDispatchedOrDelivered) {
      confirmMsg = `⚠️ WARNING: Order #${order.order_id} has already been dispatched/fulfilled${hasAwb ? ` with AWB ${order.awb_number}` : ''}.\n\nDeleting this order will permanently remove it from all operational Logistics views, counts, and Analytics while retaining shipment audit records.\n\nAre you sure you want to permanently delete this order?`;
    }

    if (!window.confirm(confirmMsg)) return;

    const toastId = toast.loading(`Deleting order #${order.order_id}...`);
    try {
      await websiteSalesService.deleteSalesOrder(order.order_id);
      toast.success(`Order #${order.order_id} deleted from Sales and Logistics!`, { id: toastId });
      setLocallyDeletedIds(prev => new Set(prev).add(order.order_id));
      onOrderDeleted?.(order.order_id);
    } catch (err: any) {
      toast.error(`Failed to delete order: ${err.message}`, { id: toastId });
    }
  };

  return (
    <div className="border-t border-slate-800/80 pt-4 mt-2 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag size={14} className="text-indigo-400" />
          <span className="text-xs font-extrabold text-white tracking-tight">{title}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {searchedOrders.length} {searchedOrders.length === 1 ? 'Order' : 'Orders'}
            {localSearch.trim() && ` (filtered from ${uniqueOrders.length})`}
          </span>
        </div>

        {/* Action Controls Header */}
        <div className="flex items-center gap-2">
          {/* Compact Local Card Search Input */}
          <div className="relative min-w-[160px] max-w-[210px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder="Search Order, Name, Phone..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-7 pr-6 py-1 text-[11px] text-white placeholder-slate-500 outline-none focus:border-indigo-500/80 transition-colors"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {onViewAll && (
            <button
              onClick={() => onViewAll(title, searchedOrders)}
              className="p-1.5 text-indigo-400 hover:text-white hover:bg-indigo-600/20 rounded-lg border border-indigo-500/30 transition-colors cursor-pointer"
              title="Open in Dedicated Full-Page View"
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      {searchedOrders.length === 0 ? (
        <div className="py-3 px-4 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
          <span className="text-xs text-slate-400 font-medium">
            {localSearch.trim() ? 'No matching orders found.' : emptyText}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Order Value</th>
                  <th className="py-2.5 px-3 text-center">Payment Mode</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Pincode</th>
                  {/* WIDE COLUMN WITH COMPLETE PRODUCT NAMES */}
                  <th className="py-2.5 px-3 min-w-[220px] max-w-[380px]">Product / Items</th>
                  <th className="py-2.5 px-3 text-center">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Remaining COD</th>
                  <th className="py-2.5 px-3 text-center w-[85px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {visibleOrders.map(o => {
                  const resolvedLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
                  const canonicalState = o.canonicalState || resolvedLoc.stateName || o.state || '—';
                  const canonicalCity = o.canonicalCity || resolvedLoc.cityName || o.city || '—';
                  const canonicalPincode = o.canonicalPincode || resolvedLoc.pincode || o.pincode || '—';
                  const qtyVal = o.total_quantity ?? (o.items ? o.items.reduce((acc, i) => acc + (i.quantity || 0), 0) : 1);

                  return (
                    <tr key={o.order_id} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                      {/* 1. ORDER ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300 whitespace-nowrap">#{o.order_id}</td>
                      
                      {/* 2. CUSTOMER NAME */}
                      <td className="py-2.5 px-3 font-sans font-bold text-white max-w-[150px] truncate" title={o.customer_name}>
                        {o.customer_name || 'N/A'}
                      </td>

                      {/* 3. STATE */}
                      <td className="py-2.5 px-3 font-sans text-slate-300 whitespace-nowrap">
                        {canonicalState}
                      </td>

                      {/* 4. CITY */}
                      <td className="py-2.5 px-3 font-sans text-slate-300 whitespace-nowrap">
                        {canonicalCity}
                      </td>

                      {/* 5. ORDER VALUE */}
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        ₹{(o.price ?? 0).toLocaleString('en-IN')}
                      </td>

                      {/* 6. PAYMENT MODE */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {o.payment_mode === 'PREPAID' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            PREPAID
                          </span>
                        ) : o.payment_mode === 'PARTIAL COD' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            PARTIAL COD
                          </span>
                        ) : o.payment_mode === 'COD' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            COD
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            {o.payment_mode || 'UNKNOWN'}
                          </span>
                        )}
                      </td>

                      {/* 7. PHONE */}
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {o.phone || '—'}
                      </td>

                      {/* 8. PINCODE */}
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {canonicalPincode}
                      </td>

                      {/* 9. PRODUCT / ITEMS: Full visibility cell without ellipsis */}
                      <td className="py-2.5 px-3">
                        <AnalyticsProductCell order={o} />
                      </td>

                      {/* 10. QUANTITY */}
                      <td className="py-2.5 px-3 font-mono font-bold text-white text-center whitespace-nowrap">
                        {qtyVal}
                      </td>

                      {/* 11. REMAINING COD */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {o.payment_mode === 'PARTIAL COD' ? (
                          <span className="text-purple-300">
                            ₹{(o.remaining_payable ?? 0).toLocaleString('en-IN')}
                          </span>
                        ) : o.payment_mode === 'COD' ? (
                          <span className="text-amber-300">
                            ₹{(o.remaining_payable ?? o.price ?? 0).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                      </td>

                      {/* 12. ACTIONS */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedOrderForModal(o)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-colors cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteSingleOrder(o)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {searchedOrders.length > 5 && !localSearch.trim() && (
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              {onViewAll ? (
                <button
                  onClick={() => onViewAll(title, searchedOrders)}
                  className="px-3.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>View All Orders ({searchedOrders.length})</span>
                  <ExternalLink size={12} />
                </button>
              ) : (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-3.5 py-1 bg-slate-950 hover:bg-slate-800 text-indigo-300 font-bold text-[11px] rounded-lg border border-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm"
                >
                  {showAll ? (
                    <>Show Less <ChevronUp size={13} /></>
                  ) : (
                    <>View All Orders ({searchedOrders.length}) <ChevronDown size={13} /></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        onOrderDeleted={(deletedId) => {
          setLocallyDeletedIds(prev => new Set(prev).add(deletedId));
          setSelectedOrderForModal(null);
          onOrderDeleted?.(deletedId);
        }}
      />
    </div>
  );
};
