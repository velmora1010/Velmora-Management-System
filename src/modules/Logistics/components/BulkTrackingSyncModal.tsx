import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Truck, 
  Package, 
  RotateCcw,
  UploadCloud,
  ShieldCheck,
  RefreshCw,
  Database,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import db from '../../../lib/db';
import { 
  getLastReportSyncSummary, 
  type LastReportSyncSummary 
} from '../../../services/courierTrackingFileService';

interface BulkTrackingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshView: () => void;
  onOpenUploadModal?: () => void;
  providedOrders?: any[];
  expectedCount?: number;
}

export const BulkTrackingSyncModal: React.FC<BulkTrackingSyncModalProps> = ({
  isOpen,
  onClose,
  onRefreshView,
  onOpenUploadModal,
  providedOrders,
  expectedCount
}) => {
  const [summary, setSummary] = useState<LastReportSyncSummary | null>(null);
  const [dbStats, setDbStats] = useState<{
    totalWithAwb: number;
    deliveredCount: number;
    inTransitCount: number;
    lastSyncedDate: string;
  }>({
    totalWithAwb: 0,
    deliveredCount: 0,
    inTransitCount: 0,
    lastSyncedDate: 'Live'
  });
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load saved report summary from localStorage
    const saved = getLastReportSyncSummary();
    setSummary(saved);

    // Load live database shipment counts for context
    const loadDbStats = async () => {
      try {
        const orders = await db.logistics_orders.toArray();
        const withAwb = orders.filter(o => o.awbNumber && o.awbNumber.trim().length > 0 && o.stage !== 'trash');
        const delivered = withAwb.filter(o => (o.status || '').toLowerCase().includes('delivered'));
        const inTransit = withAwb.filter(o => {
          const s = (o.status || '').toLowerCase();
          return s.includes('transit') || s.includes('shipped') || s.includes('dispatched');
        });

        let latestTime = 'Live';
        for (const o of withAwb) {
          if (o.syncedAt && o.syncedAt > latestTime) {
            latestTime = o.syncedAt;
          }
        }

        setDbStats({
          totalWithAwb: withAwb.length,
          deliveredCount: delivered.length,
          inTransitCount: inTransit.length,
          lastSyncedDate: latestTime !== 'Live' ? latestTime : (saved?.displayTime || 'Today')
        });
      } catch (err) {
        console.warn('Error loading db stats for sync modal:', err);
      }
    };

    loadDbStats();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRefreshDatabase = async () => {
    setIsRefreshingLocal(true);
    try {
      await onRefreshView();
      toast.success('Database synchronized with cloud. Zero external courier API requests made.', {
        icon: '🛡️',
        duration: 4000
      });
    } catch (err: any) {
      toast.error('Local refresh failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const handleUploadReport = () => {
    onClose();
    if (onOpenUploadModal) {
      onOpenUploadModal();
    }
  };

  const displayedUpdated = summary ? summary.updatedCount : dbStats.totalWithAwb;
  const displayedUnmatched = summary ? summary.unmatchedCount : 0;
  const displayedDuplicates = summary ? (summary.duplicateCount + summary.invalidCount) : 0;
  const displayedSource = summary ? summary.courier : 'Delhivery & ST Courier Reports';
  const displayedTime = summary?.displayTime || dbStats.lastSyncedDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border bg-purple-950/60 border-purple-500/50 text-purple-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Report Status Synchronization</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <ShieldCheck size={11} /> Authoritative
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Uploaded courier tracking reports are the primary source of truth
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Architecture Explanation Card */}
          <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl relative overflow-hidden">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-purple-400 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                  Report-Based Architecture Active
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Automatic courier bot tracking has been disabled. Shipment statuses are updated strictly through uploaded 
                  <strong> Delhivery</strong> and <strong>ST Courier</strong> tracking reports. This guarantees 100% data consistency, eliminates API rate limits, and prevents accidental status regressions.
                </p>
              </div>
            </div>
          </div>

          {/* Sync & Health KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            
            {/* Last Import Time */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Last Report Import</span>
                <Clock size={14} className="text-purple-400" />
              </div>
              <div className="text-sm font-bold font-mono text-purple-200 mt-1 truncate" title={displayedTime}>
                {displayedTime}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">Source: {displayedSource}</div>
            </div>

            {/* Shipments Updated */}
            <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-800/40">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-medium">
                <span>Shipments Updated</span>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {displayedUpdated.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-0.5">Authoritative status</div>
            </div>

            {/* Delivered Shipments */}
            <div className="p-3 bg-sky-950/20 rounded-xl border border-sky-800/40">
              <div className="flex items-center justify-between text-[11px] text-sky-300 font-medium">
                <span>Delivered Count</span>
                <Package size={14} className="text-sky-400" />
              </div>
              <div className="text-xl font-bold font-mono text-sky-200 mt-1">
                {dbStats.deliveredCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-sky-400/80 mt-0.5">Protected from downgrade</div>
            </div>

            {/* Unmatched AWBs */}
            <div className="p-3 bg-amber-950/20 rounded-xl border border-amber-800/40">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-medium">
                <span>Unmatched AWBs</span>
                <AlertCircle size={14} className="text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                {displayedUnmatched.toLocaleString()}
              </div>
              <div className="text-[10px] text-amber-500/80 mt-0.5">Not present in system</div>
            </div>

            {/* Duplicates / Invalid */}
            <div className="p-3 bg-rose-950/20 rounded-xl border border-rose-800/40">
              <div className="flex items-center justify-between text-[11px] text-rose-300 font-medium">
                <span>Duplicate / Invalid</span>
                <AlertCircle size={14} className="text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                {displayedDuplicates.toLocaleString()}
              </div>
              <div className="text-[10px] text-rose-400/80 mt-0.5">Safely deduplicated</div>
            </div>

            {/* In Transit Moving */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>In Transit Shipments</span>
                <Truck size={14} className="text-cyan-400" />
              </div>
              <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                {dbStats.inTransitCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-cyan-500/80 mt-0.5">Active on road</div>
            </div>

          </div>

          {/* Safe Synchronization Guide */}
          <div className="p-4 bg-slate-900/40 border border-slate-800/70 rounded-xl text-xs space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Database size={14} className="text-purple-400" />
              <span>How Report-Based Synchronization Works:</span>
            </div>
            <ul className="text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Upload your courier Excel or CSV tracking export directly in the Logistics workspace.</li>
              <li>The system dynamically maps columns (`Waybill`, `Reference No.`, `Status`, `Remarks`).</li>
              <li>Statuses like <span className="text-emerald-400 font-medium">Delivered</span> cannot be downgraded by older or ambiguous reports.</li>
              <li>Order #12089 matches its exact AWB from the uploaded report.</li>
            </ul>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRefreshDatabase}
            disabled={isRefreshingLocal}
            className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh local database consistency with cloud without calling external courier APIs"
          >
            <RefreshCw size={14} className={isRefreshingLocal ? 'animate-spin text-purple-400' : ''} />
            <span>{isRefreshingLocal ? 'Refreshing Local Data...' : 'Refresh Local Database'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onOpenUploadModal && (
              <button
                type="button"
                onClick={handleUploadReport}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
              >
                <UploadCloud size={14} />
                <span>Upload Courier Report</span>
                <ArrowRight size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
