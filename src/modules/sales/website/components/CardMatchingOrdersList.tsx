import React, { useState } from 'react';
import { ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';

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

  // Ensure unique Order IDs only
  const uniqueOrders = React.useMemo(() => {
    const seen = new Set<string>();
    return orders.filter(o => {
      if (seen.has(o.order_id)) return false;
      seen.add(o.order_id);
      return true;
    });
  }, [orders]);

  const visibleOrders = showAll ? uniqueOrders : uniqueOrders.slice(0, 5);

  return (
    <div className="border-t border-slate-800/80 pt-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={14} className="text-indigo-400" />
          <span className="text-xs font-extrabold text-white tracking-tight">{title}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {uniqueOrders.length} {uniqueOrders.length === 1 ? 'Order' : 'Orders'}
          </span>
        </div>
      </div>

      {uniqueOrders.length === 0 ? (
        <div className="py-3 px-4 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
          <span className="text-xs text-slate-500 font-medium">{emptyText}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3 w-32 sm:w-36">Order ID</th>
                  <th className="py-2 px-3">Customer Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {visibleOrders.map(o => (
                  <tr key={o.order_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-bold text-indigo-300">#{o.order_id}</td>
                    <td className="py-2 px-3 font-sans font-bold text-white truncate max-w-[220px]">
                      {o.customer_name || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uniqueOrders.length > 5 && (
            <div className="pt-1 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="px-3.5 py-1 bg-slate-950 hover:bg-slate-800 text-indigo-300 font-bold text-[11px] rounded-lg border border-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm"
              >
                {showAll ? (
                  <>Show Less <ChevronUp size={13} /></>
                ) : (
                  <>View All Orders ({uniqueOrders.length}) <ChevronDown size={13} /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
