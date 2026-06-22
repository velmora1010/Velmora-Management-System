import { usePOHistory } from '../hooks/analytics/usePOHistory';
import { POHistoryTable } from '../modules/purchase-orders/POHistoryTable';

export const POHistoryPage = () => {
  const history = usePOHistory(10); // 10 items per page

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white">Purchase Order History</h1>
        <p className="text-muted text-sm mt-1">View, search, and download past purchase orders</p>
      </div>
      
      {history.error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
          Error loading history: {history.error}
        </div>
      )}

      <div className="min-h-[500px]">
        <POHistoryTable {...history} />
      </div>
    </div>
  );
};
