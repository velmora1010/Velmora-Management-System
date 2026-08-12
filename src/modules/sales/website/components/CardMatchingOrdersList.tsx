import React, { useState, useMemo } from 'react';
import { ShoppingBag, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import { filterOrdersBySearch, resolveCanonicalLocation } from '../websiteSalesUtils';

interface CardMatchingOrdersListProps {
  orders: WebsiteConsolidatedOrder[];
  title?: string;
  emptyText?: string;
}

export const CardMatchingOrdersList: React.FC<CardMatchingOrdersListProps> = ({
  orders,
  title = 'Matching Orders',
  emptyText = 'No matching orders.'
}) => {
  const [showAll, setShowAll] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>('');

  // Ensure unique Order IDs only
  const uniqueOrders = useMemo(() => {
    const seen = new Set<string>();
    return orders.filter(o => {
      if (seen.has(o.order_id)) return false;
      seen.add(o.order_id);
      return true;
    });
  }, [orders]);

  // Apply local card search across the FULL dataset
  const searchedOrders = useMemo(() => {
    if (!localSearch.trim()) return uniqueOrders;
    return filterOrdersBySearch(uniqueOrders, localSearch);
  }, [uniqueOrders, localSearch]);

  const visibleOrders = (showAll || localSearch.trim()) ? searchedOrders : searchedOrders.slice(0, 5);

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

        {/* Compact Local Card Search Input */}
        <div className="relative flex-1 max-w-[220px] min-w-[160px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Search Order ID, Name or Phone..."
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
            <table className="w-full text-left text-xs text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Order Value</th>
                  <th className="py-2.5 px-3 text-center">Payment Mode</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Pincode</th>
                  <th className="py-2.5 px-3">Product / Items</th>
                  <th className="py-2.5 px-3 text-center">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Remaining COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {visibleOrders.map(o => {
                  const resolvedLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
                  const canonicalState = o.canonicalState || resolvedLoc.stateName || o.state || '—';
                  const canonicalCity = o.canonicalCity || resolvedLoc.cityName || o.city || '—';
                  const canonicalPincode = o.canonicalPincode || resolvedLoc.pincode || o.pincode || '—';
                  const productVal = o.order_formatted || o.product_name || (o.items && o.items.length > 0 ? o.items.map(i => `${i.product_name} x ${i.quantity}`).join(', ') : '—');
                  const qtyVal = o.total_quantity ?? (o.items ? o.items.reduce((acc, i) => acc + (i.quantity || 0), 0) : 1);

                  return (
                    <tr key={o.order_id} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                      {/* 1. ORDER ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">#{o.order_id}</td>
                      
                      {/* 2. CUSTOMER NAME */}
                      <td className="py-2.5 px-3 font-sans font-bold text-white max-w-[150px] truncate">
                        {o.customer_name || 'N/A'}
                      </td>

                      {/* 3. STATE */}
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        {canonicalState}
                      </td>

                      {/* 4. CITY */}
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        {canonicalCity}
                      </td>

                      {/* 5. ORDER VALUE */}
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        ₹{(o.price ?? 0).toLocaleString('en-IN')}
                      </td>

                      {/* 6. PAYMENT MODE */}
                      <td className="py-2.5 px-3 text-center">
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
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {o.phone || '—'}
                      </td>

                      {/* 8. PINCODE */}
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {canonicalPincode}
                      </td>

                      {/* 9. PRODUCT / ITEMS */}
                      <td className="py-2.5 px-3 font-sans text-cyan-300 max-w-[180px] truncate" title={productVal}>
                        {productVal}
                      </td>

                      {/* 10. QUANTITY */}
                      <td className="py-2.5 px-3 font-mono font-bold text-white text-center">
                        {qtyVal}
                      </td>

                      {/* 11. REMAINING COD */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {searchedOrders.length > 5 && !localSearch.trim() && (
            <div className="pt-1 text-center">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};


