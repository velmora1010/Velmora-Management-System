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
  Layers,
  Archive,
  Download,
  RotateCcw,
  Truck,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  reconcileLogisticsWithSales, 
  syncAllDexieOrdersToSales, 
  archiveUnmatchedLogisticsOrders,
  restoreArchivedLogisticsOrders,
  createLogisticsBackup,
  downloadLogisticsBackup,
  LogisticsSalesReconciliationReport 
} from '../../../services/logisticsOrderImportService';

interface LogisticsReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconciliationCompleted?: () => void;
}

export const LogisticsReconciliationModal: React.FC<LogisticsReconciliationModalProps> = ({
  isOpen,
  onClose,
  onReconciliationCompleted
}) => {
  const [report, setReport] = useState<LogisticsSalesReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [showConfirmSync, setShowConfirmSync] = useState(false);
  const [showConfirmArchive, setShowConfirmArchive] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

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
      setShowConfirmArchive(false);
      setShowConfirmRestore(false);
    }
  }, [isOpen]);

  // ACTION 1: Harmonize / Backfill legacy Logistics orders into Sales
  const handleRunSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Synchronizing Logistics orders into Sales department...');
    try {
      const result = await syncAllDexieOrdersToSales();
      toast.success(`Successfully synchronized ${result.syncedCount.toLocaleString()} orders into Sales!`, { id: toastId });
      setShowConfirmSync(false);
      await fetchReport();
      onReconciliationCompleted?.();
    } catch (err: any) {
      toast.error('Sync failed: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // ACTION 2: Safe Archive unmatched legacy Logistics orders to align with Sales
  const handleRunArchive = async () => {
    setIsArchiving(true);
    const toastId = toast.loading('Creating backup and archiving unmatched legacy orders...');
    try {
      const result = await archiveUnmatchedLogisticsOrders();
      toast.success(
        `Backup downloaded! Safely archived ${result.archivedCount.toLocaleString()} orders out of active operational views.`, 
        { id: toastId, duration: 6000 }
      );
      setShowConfirmArchive(false);
      await fetchReport();
      onReconciliationCompleted?.();
    } catch (err: any) {
      toast.error('Archival failed: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsArchiving(false);
    }
  };

  // ACTION 3: Restore archived records
  const handleRunRestore = async () => {
    setIsRestoring(true);
    const toastId = toast.loading('Restoring archived orders to operational views...');
    try {
      const count = await restoreArchivedLogisticsOrders();
      toast.success(`Restored ${count.toLocaleString()} archived orders back to operational stages!`, { id: toastId });
      setShowConfirmRestore(false);
      await fetchReport();
      onReconciliationCompleted?.();
    } catch (err: any) {
      toast.error('Restore failed: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsRestoring(false);
    }
  };

  // ACTION 4: Download manual JSON backup anytime
  const handleManualBackup = async () => {
    setIsDownloading(true);
    const toastId = toast.loading('Generating Logistics JSON backup file...');
    try {
      const { backupJson, recordCount } = await createLogisticsBackup();
      downloadLogisticsBackup(backupJson);
      toast.success(`Downloaded backup file containing ${recordCount.toLocaleString()} records!`, { id: toastId });
    } catch (err: any) {
      toast.error('Backup generation failed: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const orderDiff = report ? report.logisticsTotalOrders - report.salesTotalOrders : 0;
  const isOrdersMatched = orderDiff === 0 && (report?.legacyUnmatchedCount ?? 0) === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-[#0b1220] border border-cyan-900/60 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0e1626]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Sales & Logistics Data Reconciliation
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800 text-cyan-300">
                  Diagnostics & Resolution
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Identify discrepancies, protect shipment history, and establish Sales as the single canonical source of truth
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualBackup}
              disabled={isLoading || isDownloading}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              title="Download Full JSON Backup"
            >
              <Download size={13} className="text-indigo-400" />
              <span className="hidden sm:inline">Export Backup</span>
            </button>
            <button
              type="button"
              onClick={fetchReport}
              disabled={isLoading || isSyncing || isArchiving}
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
              <p className="text-sm font-semibold text-slate-300">Auditing Supabase Sales records vs local Logistics IndexedDB...</p>
              <p className="text-xs text-slate-500">Checking canonical order IDs, fulfillment states, and shipment tracking history</p>
            </div>
          ) : report ? (
            <>
              {/* ROOT CAUSE DIAGNOSTIC ALERT */}
              {report.salesTotalOrders === 0 && report.logisticsTotalOrders > 0 && (
                <div className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-950/30 text-indigo-200 space-y-2">
                  <div className="flex items-center gap-2.5 font-bold text-white text-sm">
                    <Database size={18} className="text-indigo-400 shrink-0" />
                    <span>Root Cause Identified: Legacy Independent Logistics Data</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The Supabase cloud database currently has <strong>0</strong> active orders in the Sales department (<code className="text-cyan-300">sales_orders</code>), while your browser&apos;s local IndexedDB contains <strong>{report.logisticsTotalOrders.toLocaleString()}</strong> orders imported independently through the legacy Logistics file import.
                  </p>
                  <p className="text-xs text-slate-400">
                    Because Sales is the canonical source of truth for customer orders, you can choose below whether to <strong>Archive unmatched legacy records</strong> (so Logistics reflects 0 orders) or <strong>Promote legacy records to Sales</strong> (so all 10,005 orders appear in Sales Files, Dashboard, and Analytics).
                  </p>
                </div>
              )}

              {/* Overall Alignment Status Banner */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
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
                        ? 'All Logistics orders match Supabase sales_orders with zero orphaned records.'
                        : `${report.legacyUnmatchedCount.toLocaleString()} order(s) in Logistics are not linked to Sales.`}
                    </p>
                  </div>
                </div>

                {report.archivedRecordsCount > 0 && (
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0 self-start sm:self-auto">
                    {report.archivedRecordsCount.toLocaleString()} Archived
                  </span>
                )}
              </div>

              {/* RESOLUTION ACTION CARDS */}
              {!isOrdersMatched && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  
                  {/* OPTION A: Align Logistics with Sales (Archive Unmatched) */}
                  <div className="p-4 rounded-xl bg-[#0e1626] border border-amber-700/50 flex flex-col justify-between space-y-3 shadow-lg">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                        <Archive size={15} className="text-amber-400" />
                        <span>Option 1: Align Logistics with Sales</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Safely archives the <strong>{report.legacyUnmatchedCount.toLocaleString()}</strong> unmatched legacy orders out of the active operational pipeline (Active, Fulfilled, Prepare Dispatch).
                      </p>
                      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-200/90 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                          <ShieldCheck size={13} />
                          <span>Reversible Safety Guarantee</span>
                        </div>
                        <p>
                          Automatically downloads a complete JSON backup to your computer before making any changes. Operational counts will immediately drop to {report.salesTotalOrders} to match Sales.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowConfirmArchive(true)}
                      disabled={isArchiving || isSyncing}
                      className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/30 transition-all disabled:opacity-50"
                    >
                      <Archive size={14} />
                      <span>Archive Unmatched & Download Backup</span>
                    </button>
                  </div>

                  {/* OPTION B: Promote Legacy Logistics Orders to Canonical Sales */}
                  <div className="p-4 rounded-xl bg-[#0e1626] border border-cyan-700/50 flex flex-col justify-between space-y-3 shadow-lg">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                        <FileSpreadsheet size={15} className="text-cyan-400" />
                        <span>Option 2: Promote to Canonical Sales</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Creates an official upload batch in <code className="text-cyan-300">sales_uploads</code> and backfills all <strong>{report.legacyUnmatchedCount.toLocaleString()}</strong> orders into Supabase <code className="text-cyan-300">sales_orders</code>.
                      </p>
                      <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-[11px] text-cyan-200/90 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                          <CheckCircle2 size={13} />
                          <span>Complete Sales Visibility</span>
                        </div>
                        <p>
                          Website Sales Files tab will display the file, and Sales Dashboard & Analytics will reflect all historical customer orders.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowConfirmSync(true)}
                      disabled={isSyncing || isArchiving}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-cyan-600/30 transition-all disabled:opacity-50"
                    >
                      <ArrowLeftRight size={14} />
                      <span>Promote All to Canonical Sales</span>
                    </button>
                  </div>

                </div>
              )}

              {/* RESTORE ARCHIVE BANNER (if archived records exist) */}
              {report.archivedRecordsCount > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-xs">
                    <RotateCcw size={15} className="text-purple-400 shrink-0" />
                    <span className="text-slate-300">
                      <strong>{report.archivedRecordsCount.toLocaleString()}</strong> orders are currently safely archived out of active operational views.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfirmRestore(true)}
                    disabled={isRestoring}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 font-semibold text-xs cursor-pointer transition-colors shrink-0"
                  >
                    Restore from Archive
                  </button>
                </div>
              )}

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
                      <span className="text-slate-400">Logistics Operational:</span>
                      <span className="font-mono font-bold text-purple-300">{report.logisticsTotalOrders.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Canonical Sales:</span>
                      <span className="font-mono font-bold text-cyan-300">{report.salesTotalOrders.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Difference:</span>
                    <span className={`font-mono font-bold ${orderDiff === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {orderDiff > 0 ? `+${orderDiff.toLocaleString()} in Logistics` : orderDiff < 0 ? `${Math.abs(orderDiff).toLocaleString()} in Sales` : 'Matched'}
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
                      <span className="font-mono font-bold text-emerald-300">{report.logisticsFulfilledCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sales:</span>
                      <span className="font-mono font-bold text-emerald-300">{report.salesFulfilledCount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Status Sync:</span>
                    <span className={`font-mono font-bold ${report.logisticsFulfilledCount === report.salesFulfilledCount ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {report.logisticsFulfilledCount === report.salesFulfilledCount ? 'Equal' : `${Math.abs(report.logisticsFulfilledCount - report.salesFulfilledCount).toLocaleString()} diff`}
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
                      <span className="font-mono font-bold text-blue-300">{report.logisticsActiveCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sales Unfulfilled:</span>
                      <span className="font-mono font-bold text-blue-300">{report.salesUnfulfilledCount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Variance:</span>
                    <span className="font-mono font-bold text-slate-300">
                      {Math.abs(report.logisticsActiveCount - report.salesUnfulfilledCount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 4. Tracking & Shipment History */}
                <div className="bg-[#0e1626] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Dispatched & AWB</span>
                    <Truck size={15} className="text-indigo-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">With Shipment Info:</span>
                      <span className="font-mono font-bold text-indigo-300">{report.dispatchedHistoricalCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Matched in Sales:</span>
                      <span className="font-mono font-bold text-cyan-300">{report.matchedOrdersCount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Historical Shipments:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      Preserved
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
                        Unmatched in Sales ({report.missingInSalesCount.toLocaleString()})
                      </h4>
                    </div>
                    {report.missingInSalesCount > 0 && (
                      <span className="text-[10px] bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800">
                        Action Required
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
                        These orders exist in Logistics IndexedDB but are missing from Supabase <code className="text-cyan-300">sales_orders</code>:
                      </p>
                      <div className="max-h-36 overflow-y-auto bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 text-xs font-mono text-slate-300 space-y-1 custom-scrollbar">
                        {report.missingInSalesOrderIds.map(id => (
                          <div key={id} className="flex items-center justify-between">
                            <span>#{id}</span>
                            <span className="text-[10px] text-amber-400 font-sans">Unmatched</span>
                          </div>
                        ))}
                        {report.missingInSalesCount > report.missingInSalesOrderIds.length && (
                          <div className="text-[10px] text-slate-500 italic pt-1">
                            + {(report.missingInSalesCount - report.missingInSalesOrderIds.length).toLocaleString()} more orders
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
                        Only in Sales ({report.missingInLogisticsCount.toLocaleString()})
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
                        These orders exist in Sales but have not yet been synchronized into Logistics:
                      </p>
                      <div className="max-h-36 overflow-y-auto bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 text-xs font-mono text-slate-300 space-y-1 custom-scrollbar">
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

              {/* Confirmation Box for Option 1: Archive */}
              {showConfirmArchive && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/80 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-white">Confirm Archival of Unmatched Records</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        This action will safely archive <strong>{report.legacyUnmatchedCount.toLocaleString()}</strong> unmatched orders out of active operational views (Active, Fulfilled, Prepare Dispatch). A full JSON backup file will be automatically downloaded to your computer first, and you can restore them anytime using the &quot;Restore from Archive&quot; button.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmArchive(false)}
                      disabled={isArchiving}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRunArchive}
                      disabled={isArchiving}
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-amber-600/30 disabled:opacity-50"
                    >
                      {isArchiving ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Archiving & Downloading...</span>
                        </>
                      ) : (
                        <span>Download Backup & Proceed</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation Box for Option 2: Backfill Re-sync */}
              {showConfirmSync && (
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/80 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-white">Confirm Canonical Backfill to Sales</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        This action will create an official upload batch in Supabase <code className="text-cyan-300">sales_uploads</code> and backfill all {report.logisticsTotalOrders.toLocaleString()} Logistics orders into <code className="text-cyan-300">sales_orders</code> and <code className="text-cyan-300">sales_order_items</code>. Existing records are updated with stable IDs, ensuring no duplicate rows.
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
                          <span>Backfilling to Sales...</span>
                        </>
                      ) : (
                        <span>Proceed with Backfill</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation Box for Option 3: Restore */}
              {showConfirmRestore && (
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/80 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <RotateCcw size={20} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-white">Confirm Restoration of Archived Records</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        This action will restore all {report.archivedRecordsCount.toLocaleString()} archived orders back to their previous operational stages (Active or Fulfilled).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmRestore(false)}
                      disabled={isRestoring}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRunRestore}
                      disabled={isRestoring}
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-purple-600/30 disabled:opacity-50"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Restoring...</span>
                        </>
                      ) : (
                        <span>Proceed with Restore</span>
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
            {report?.lastReconciledAt && `Audited: ${new Date(report.lastReconciledAt).toLocaleTimeString()}`}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
