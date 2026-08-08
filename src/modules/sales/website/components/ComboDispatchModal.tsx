import React from 'react';
import { X, Layers } from 'lucide-react';

interface ComboDispatchItem {
  combo: string;
  orders: number;
  units: number;
}

interface ComboDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  combos: ComboDispatchItem[];
  selectedDate: string;
}

export const ComboDispatchModal: React.FC<ComboDispatchModalProps> = ({
  isOpen,
  onClose,
  combos,
  selectedDate
}) => {
  if (!isOpen) return null;

  const totalOrders = combos.reduce((sum, c) => sum + c.orders, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Layers size={20} className="text-purple-400" />
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">Combos Dispatched Breakdown</h3>
              <p className="text-xs text-slate-400">Total {totalOrders} combo orders dispatched</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Table */}
        <div className="p-5 pt-0 space-y-3 max-h-[60vh] overflow-y-auto">
          {combos.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No combos dispatched for the selected date/filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Combo / Offer</th>
                    <th className="py-2.5 px-4 text-center">Orders</th>
                    <th className="py-2.5 px-4 text-right">Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {combos.map(c => (
                    <tr key={c.combo} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-white truncate max-w-[220px]">{c.combo}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-purple-300">{c.orders}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-cyan-300">{c.units}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
