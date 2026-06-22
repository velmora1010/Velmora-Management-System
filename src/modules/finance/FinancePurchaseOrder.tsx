import { useState } from 'react';
import { PurchaseOrderForm } from '../purchase-orders/PurchaseOrderForm';
import { POHistoryTable } from '../purchase-orders/POHistoryTable';
import { usePOHistory } from '../../hooks/analytics/usePOHistory';

export const FinancePurchaseOrder = () => {
  const [activeTab, setActiveTab] = useState<'add' | 'view'>('add');
  const history = usePOHistory(10);

  return (
    <div className="flex flex-col h-full fade-in">
      {/* Finance Sub Navigation matching Vanilla UI */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        <button
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'add' 
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110' 
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Add Purchase Order
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'view' 
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110' 
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          View Purchase Order
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'add' ? (
          <div className="animate-in fade-in duration-300">
            <PurchaseOrderForm />
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 min-h-[500px]">
             {history.error && (
              <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                Error loading history: {history.error}
              </div>
            )}
            <POHistoryTable {...history} />
          </div>
        )}
      </div>
    </div>
  );
};
