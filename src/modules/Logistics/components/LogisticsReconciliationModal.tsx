import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  ShoppingBag, 
  TrendingUp, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  reconcileLogisticsWithSales, 
  syncAllDexieOrdersToSales, 
  LogisticsSalesReconciliationReport 
} from '../../../services/logisticsOrderImportService';

interface LogisticsReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogisticsReconciliationModal: React.FC<LogisticsReconciliationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [report, setReport] = useState<LogisticsSalesReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfirmSync, setShowConfirmSync] = useState(false);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const data = await reconcileLogisticsWithSales();
      setReport(data);
    } catch (err: any) {
      toast.error('Failed to load reconciliation diagnostics: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReport();
      setShowConfirmSync(false);
    }
  }, [isOpen]);

  const handleRunSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Synchronizing Logistics orders with Sales department...');
    try {
      const result = await syncAllDexieOrdersToSales();
      toast.success(`Synchronized ${result.syncedCount} orders with Sales!`, { id: toastId });
      setShowConfirmSync(false);
      await fetchReport();
    } catch (err: any) {
      toast.error('Sync failed: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const orderDiff = report ? report.logisticsTotalOrders - report.salesTotalOrders : 0;
  const isOrdersMatched = orderDiff === 0 && report?.missingInSalesCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-[#0b1220] border border-cyan-900/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0e1626]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Logistics & Sales Data Reconciliation
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800 text-cyan-300">
                  Diagnostics
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Compare and harmonize order records, fulfillment states, and revenue between Logistics and Sales
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchReport}
              disabled={isLoading || isSyncing}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Report"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-cyan-400' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw size={32} className="animate-spin text-cyan-400" />
              <p className="text-sm font-semibold text-slate-300">Comparing Logistics Dexie database with Supabase Sales orders...</p>
              <p className="text-xs text-slate-500">Checking order counts, fulfillment states, and line items</p>
            </div>
          ) : report ? (
            <>
              {/* Overall Sync Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                isOrdersMatched 
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' 
                  : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
              }`}>
                <div className="flex items-center gap-3">
                  {isOrdersMatched ? (
                    <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={24} className="text-amber-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {isOrdersMatched 
                        ? 'Logistics and Sales Databases are Perfectly Aligned' 
                        : 'Discrepancy Detected Between Logistics and Sales'}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isOrdersMatched
                        ? 'All Logistics orders match Supabase sales_orders with zero missing records.'
                        : `${report.missingInSalesCount} order(s) in Logistics are not yet synchronized to Sales. Click Re-sync to repair.`}
                    </p>
                  </div>
                </div>

                {!isOrdersMatched && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmSync(true)}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition-all cursor-pointer shrink-0"
                  >
                    Sync to Sales
                  </button>
                )}
              </div>

              {/* Side-by-Side Comparison KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Orders */}
                <div className="bg-[#0e1626] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
                    <Database size={15} className="text-purple-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Logistics:</span>
                      <span className="font-mono font-bold text-purple-300">{report.logisticsTotalOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sales:</span>
                      <span className="font-mono font-bold text-cyan-300">{report.salesTotalOrders}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Difference:</span>
                    <span className={`font-mono font-bold ${orderDiff === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {orderDiff > 0 ? `+${orderDiff} in Logistics` : orderDiff < 0 ? `${Math.abs(orderDiff)} in Sales` : 'Matched'}
                    </span>
                  </div>
                </div>

                {/* 2. Fulfilled Orders */}
                <div className="bg-[#0e1626] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Fulfilled</span>
                    <ShieldCheck size={15} className="text-emerald-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Logistics:</span>
                      <span className="font-mono font-bold text-emerald-300">{report.logisticsFulfilledCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sales:</span>
                      <span className="font-mono font-bold text-emerald-300">{report.salesFulfilledCount}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Status Sync:</span>
                    <span className={`font-mono font-bold ${report.logisticsFulfilledCount === report.salesFulfilledCount ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {report.logisticsFulfilledCount === report.salesFulfilledCount ? 'Equal' : `${Math.abs(report.logisticsFulfilledCount - report.salesFulfilledCount)} diff`}
                    </span>
                  </div>
                </div>

                {/* 3. Active / Unfulfilled Orders */}
                <div className="bg-[#0e1626] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Active / Unfulfilled</span>
                    <Layers size={15} className="text-blue-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Logistics Active:</span>
                      <span className="font-mono font-bold text-blue-300">{report.logisticsActiveCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sales Unfulfilled:</span>
                      <span className="font-mono font-bold text-blue-300">{report.salesUnfulfilledCount}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Variance:</span>
                    <span className="font-mono font-bold text-slate-300">
                      {Math.abs(report.logisticsActiveCount - report.salesUnfulfilledCount)}
                    </span>
                  </div>
                </div>

                {/* 4. Total Order Value */}
                <div className="bg-[#0e1626] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Value</span>
                    <TrendingUp size={15} className="text-emerald-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Logistics:</span>
                      <span className="font-mono font-bold text-white">₹{report.logisticsTotalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sales:</span>
                      <span className="font-mono font-bold text-white">₹{report.salesTotalRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Difference:</span>
                    <span className={`font-mono font-bold ${report.logisticsTotalRevenue === report.salesTotalRevenue ? 'text-emerald-400' : 'text-slate-300'}`}>
                      ₹{Math.abs(report.logisticsTotalRevenue - report.salesTotalRevenue).toLocaleString()}
                    </span>
                  </div>
                </div>

              </div>

              {/* Missing Order Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Orders in Logistics but missing in Sales */}
                <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={15} className="text-amber-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Missing in Sales ({report.missingInSalesCount})
                      </h4>
                    </div>
                    {report.missingInSalesCount > 0 && (
                      <span className="text-[10px] bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800">
                        Requires Sync
                      </span>
                    )}
                  </div>
                  
                  {report.missingInSalesCount === 0 ? (
                    <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      <span>All Logistics orders exist in Sales!</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        These orders exist locally in Logistics but are missing from Supabase <code className="text-cyan-300">sales_orders</code>:
                      </p>
                      <div className="max-h-36 overflow-y-auto bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                        {report.missingInSalesOrderIds.map(id => (
                          <div key={id} className="flex items-center justify-between">
                            <span>#{id}</span>
                            <span className="text-[10px] text-amber-400 font-sans">Pending Sync</span>
                          </div>
                        ))}
                        {report.missingInSalesCount > report.missingInSalesOrderIds.length && (
                          <div className="text-[10px] text-slate-500 italic pt-1">
                            + {report.missingInSalesCount - report.missingInSalesOrderIds.length} more orders
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Orders in Sales but not in Logistics */}
                <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Database size={15} className="text-cyan-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Only in Sales ({report.missingInLogisticsCount})
                      </h4>
                    </div>
                  </div>

                  {report.missingInLogisticsCount === 0 ? (
                    <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      <span>Zero orphan orders in Sales.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        These orders were directly uploaded or created in Sales via other channels:
                      </p>
                      <div className="max-h-36 overflow-y-auto bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                        {report.missingInLogisticsOrderIds.map(id => (
                          <div key={id} className="flex items-center justify-between">
                            <span>#{id}</span>
                            <span className="text-[10px] text-cyan-400 font-sans">Sales Only</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Confirmation modal / box for Re-sync */}
              {showConfirmSync && (
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-white">Confirm Backfill Re-sync</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        This action will safely upsert all {report.logisticsTotalOrders} Logistics orders into Supabase <code className="text-purple-300">sales_orders</code> and create their corresponding line items in <code className="text-purple-300">sales_order_items</code>. Existing records are updated with <code className="text-cyan-300">onConflict: (channel, order_id)</code> so no duplicates will be created.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmSync(false)}
                      disabled={isSyncing}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRunSync}
                      disabled={isSyncing}
                      className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-600/30 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <span>Proceed with Re-sync</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0e1626] flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono">
            {report?.lastReconciledAt && `Last Checked: ${new Date(report.lastReconciledAt).toLocaleTimeString()}`}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmSync(true)}
              disabled={isLoading || isSyncing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeftRight size={14} />
              <span>Re-sync All to Sales</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
