import { History, AlertTriangle } from 'lucide-react';
import { usePOHistory } from '../hooks/analytics/usePOHistory';
import { POHistoryTable } from '../modules/purchase-orders/POHistoryTable';

export const POHistoryPage = () => {
  const history = usePOHistory(10); // 10 items per page

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-700/70 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/10">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              Purchase Order History
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              View, search, and download past purchase orders
            </p>
          </div>
        </div>
      </div>

      {history.error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="font-semibold text-rose-200">Error loading purchase order history</p>
            <p className="text-xs text-rose-300/80 mt-0.5">{history.error}</p>
          </div>
        </div>
      )}

      <div className="min-h-[500px]">
        <POHistoryTable {...history} />
      </div>
    </div>
  );
};
