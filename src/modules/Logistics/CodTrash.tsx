import React, { useState } from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, RotateCcw, Trash2, Recycle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LogisticsOrder } from '../../types/logistics';

export const CodTrash: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Load all trashed orders
  const trashedOrders = useLiveQuery(
    () => db.logistics_orders.where('stage').equals('trash').reverse().toArray(),
    []
  ) ?? [];

  // Filter orders
  const filteredOrders = trashedOrders.filter((ord) => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    return (
      ord.orderId.toLowerCase().includes(search) ||
      ord.customerName.toLowerCase().includes(search) ||
      ord.phoneNumber.toLowerCase().includes(search)
    );
  });

  const handleRestore = async (order: LogisticsOrder) => {
    if (confirm(`Are you sure you want to restore Order ${order.orderId} back to active Order Data?`)) {
      try {
        await db.logistics_orders.update(order.id!, {
          stage: 'order_data'
        });
        toast.success(`Order ${order.orderId} restored.`);
      } catch (err: any) {
        toast.error(`Restore failed: ${err.message}`);
      }
    }
  };

  const handlePermanentDelete = async (order: LogisticsOrder) => {
    if (confirm(`WARNING: Are you sure you want to PERMANENTLY delete Order ${order.orderId}? This action CANNOT be undone.`)) {
      try {
        await db.logistics_orders.delete(order.id!);
        toast.success(`Order ${order.orderId} permanently deleted.`);
      } catch (err: any) {
        toast.error(`Purge failed: ${err.message}`);
      }
    }
  };

  const handleClearTrash = async () => {
    if (trashedOrders.length === 0) return;
    if (confirm(`WARNING: Are you sure you want to PERMANENTLY purge all ${trashedOrders.length} orders in trash? This cannot be undone.`)) {
      try {
        const ids = trashedOrders.map(o => o.id!).filter(Boolean);
        await db.logistics_orders.bulkDelete(ids);
        toast.success('Trash cleared completely.');
      } catch (err: any) {
        toast.error(`Failed to clear trash: ${err.message}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-5">
      
      {/* Action panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">COD Restore</h2>
          <p className="text-muted text-[11px] mt-1">Review deleted COD order records. Restore them to active lists or purge them permanently.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search trash..."
              className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs text-slate-200 focus:outline-none focus:border-primary w-64 placeholder:text-slate-600 shadow-sm"
            />
            <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
          </div>

          {/* Purge All */}
          {trashedOrders.length > 0 && (
            <button
              onClick={handleClearTrash}
              className="h-9 flex items-center gap-1.5 bg-red-650/10 hover:bg-red-650 border border-red-500/20 text-red-400 hover:text-white text-xs px-4 rounded-xl font-semibold transition-all shadow-sm"
            >
              <Trash2 size={13} /> Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 min-h-0 bg-slate-950/40 border border-border/10 rounded-xl flex flex-col overflow-hidden">
        {filteredOrders.length > 0 ? (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Order ID</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Customer Name</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Phone</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-right">Amount</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider w-1/3">Products</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-900/35 transition-colors">
                    <td className="px-4 py-2 text-slate-300 font-mono font-bold">{ord.orderId}</td>
                    <td className="px-4 py-2 text-slate-200 font-semibold">{ord.customerName}</td>
                    <td className="px-4 py-2 text-slate-400 font-medium">{ord.phoneNumber}</td>
                    <td className="px-4 py-2 text-slate-300 font-bold text-right">₹{ord.amount}</td>
                    <td className="px-4 py-2 text-slate-400 font-medium truncate max-w-xs" title={ord.products}>{ord.products}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Restore Action */}
                        <button
                          onClick={() => handleRestore(ord)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl text-[10px] font-bold transition-all shadow-sm"
                          title="Restore order to active list"
                        >
                          <RotateCcw size={10} /> Restore
                        </button>
                        
                        {/* Purge Action */}
                        <button
                          onClick={() => handlePermanentDelete(ord)}
                          className="p-1.5 border border-slate-700 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all shadow-sm"
                          title="Permanently delete order"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic p-6 space-y-3">
            <Recycle size={32} className="opacity-40 text-primary" />
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-400">COD Restore is empty</p>
              <p className="text-[11px] text-muted mt-1 font-normal">Deleted COD orders will appear here for restoration.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
