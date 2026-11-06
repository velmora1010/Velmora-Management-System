import React, { useEffect, useState } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Truck, 
  Package, 
  Check, 
  Pause, 
  Play, 
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Minus
} from 'lucide-react';
import { bulkTrackingSyncService, BulkSyncState } from '../../../services/tracking/bulkTrackingSyncService';

interface BulkTrackingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshView: () => void;
}

export const BulkTrackingSyncModal: React.FC<BulkTrackingSyncModalProps> = ({
  isOpen,
  onClose,
  onRefreshView
}) => {
  const [syncState, setSyncState] = useState<BulkSyncState>(bulkTrackingSyncService.getState());
  const [showFailedDetails, setShowFailedDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = bulkTrackingSyncService.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const isRunning = syncState.status === 'running';
  const isCompleted = syncState.status === 'completed';
  const isPaused = syncState.status === 'paused';

  const handleStop = () => {
    bulkTrackingSyncService.stopSync();
  };

  const handleResumeOrStart = () => {
    bulkTrackingSyncService.startBulkSync();
  };

  const handleRetryFailed = () => {
    bulkTrackingSyncService.retryFailed();
  };

  const handleDoneAndRefresh = () => {
    onClose();
    onRefreshView();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isRunning ? 'bg-purple-950/60 border-purple-500/50 text-purple-400' :
              isCompleted ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400' :
              'bg-slate-800/60 border-slate-700 text-slate-300'
            }`}>
              <RefreshCw size={20} className={isRunning ? 'animate-spin' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Tracking Synchronization</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isRunning ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse' :
                  isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  isPaused ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {isRunning ? 'Syncing In Progress' : isCompleted ? 'Completed' : isPaused ? 'Paused' : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk courier tracking audit across Delhivery &amp; ST Courier
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              title="Minimize to background"
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Progress Bar & Current Status */}
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-semibold">
                Progress: <span className="font-mono text-purple-300 font-bold">{syncState.progress}%</span>
              </span>
              <span className="text-slate-400 font-mono">
                {syncState.processed.toLocaleString()} / {syncState.totalCandidates.toLocaleString()} AWBs Processed
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 shadow-sm shadow-purple-500/50"
                style={{ width: `${Math.min(100, syncState.progress)}%` }}
              />
            </div>

            {/* Live active item info */}
            {isRunning && syncState.currentAwb && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="truncate">
                  Checking {syncState.currentCourier}: <strong className="text-cyan-300">{syncState.currentAwb}</strong> 
                  {syncState.currentOrderId ? ` (Order #${syncState.currentOrderId})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* KPI Stat Cards (6 Key Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            
            {/* Total AWBs */}
            <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Total AWBs</span>
                <Package size={14} className="text-purple-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">
                {syncState.totalCandidates.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Eligible for tracking</div>
            </div>

            {/* Successfully Updated */}
            <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-800/40">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-medium">
                <span>Updated</span>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {syncState.updated.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-0.5">Status moved forward</div>
            </div>

            {/* Already Up to Date */}
            <div className="p-3 bg-sky-950/20 rounded-xl border border-sky-800/40">
              <div className="flex items-center justify-between text-[11px] text-sky-300 font-medium">
                <span>Already Up to Date</span>
                <Check size={14} className="text-sky-400" />
              </div>
              <div className="text-xl font-bold font-mono text-sky-200 mt-1">
                {syncState.alreadyUpToDate.toLocaleString()}
              </div>
              <div className="text-[10px] text-sky-400/80 mt-0.5">Verified unchanged</div>
            </div>

            {/* Failed Requests */}
            <div className="p-3 bg-rose-950/20 rounded-xl border border-rose-800/40">
              <div className="flex items-center justify-between text-[11px] text-rose-300 font-medium">
                <span>Failed</span>
                <AlertCircle size={14} className="text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                {syncState.failed.toLocaleString()}
              </div>
              <div className="text-[10px] text-rose-400/80 mt-0.5">API / network errors</div>
            </div>

            {/* Tracking Unavailable */}
            <div className="p-3 bg-amber-950/20 rounded-xl border border-amber-800/40">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-medium">
                <span>Tracking Unavailable</span>
                <Clock size={14} className="text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                {syncState.trackingUnavailable.toLocaleString()}
              </div>
              <div className="text-[10px] text-amber-500/80 mt-0.5">Not found on portal</div>
            </div>

            {/* Without AWB */}
            <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Without AWB</span>
                <Truck size={14} className="text-slate-500" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-300 mt-1">
                {syncState.withoutAwbCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Awaiting dispatch</div>
            </div>
          </div>

          {/* Courier Breakdown */}
          {Object.keys(syncState.courierBreakdown).length > 0 && (
            <div className="p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                Courier Performance Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(syncState.courierBreakdown).map(([courier, stats]) => (
                  <div key={courier} className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200">{courier}</span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">
                        {stats.processed} / {stats.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-emerald-400 font-semibold">+{stats.updated} updated</span>
                      {stats.failed > 0 && (
                        <span className="text-rose-400 font-semibold">{stats.failed} failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently Updated Stream */}
          {syncState.recentUpdates.length > 0 && (
            <div className="p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Live Update Stream ({syncState.recentUpdates.length})
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Real-time status reconciliation</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {syncState.recentUpdates.slice(0, 8).map((up, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-purple-300">#{up.orderId}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{up.awb}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{up.courier}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 text-[11px] line-through">{up.oldStatus}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-emerald-300 font-semibold">{up.newStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Records Details (Collapsible) */}
          {syncState.failedList.length > 0 && (
            <div className="border border-rose-900/40 bg-rose-950/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowFailedDetails(!showFailedDetails)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-rose-300 hover:bg-rose-950/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>Failed Shipments Audit ({syncState.failedList.length})</span>
                </div>
                {showFailedDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showFailedDetails && (
                <div className="p-3 border-t border-rose-900/30 max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                  {syncState.failedList.map((f, i) => (
                    <div key={i} className="p-2 bg-slate-950/80 rounded border border-rose-900/30 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-rose-200">#{f.orderId}</span>
                        <span className="text-slate-400 font-mono ml-2">{f.awb} ({f.courier})</span>
                      </div>
                      <span className="text-rose-400 text-[11px] max-w-xs truncate" title={f.error}>
                        {f.error}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            {syncState.startedAt && (
              <span className="text-[11px] text-slate-500 font-mono">
                Started: {new Date(syncState.startedAt).toLocaleTimeString('en-IN')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Run in Background
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Pause size={14} />
                  <span>Pause Sync</span>
                </button>
              </>
            ) : isPaused ? (
              <>
                <button
                  type="button"
                  onClick={handleResumeOrStart}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-purple-600/30"
                >
                  <Play size={14} />
                  <span>Resume Sync</span>
                </button>
                <button
                  type="button"
                  onClick={handleDoneAndRefresh}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                {syncState.failedList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-rose-600/30"
                  >
                    <RotateCcw size={14} />
                    <span>Retry Failed ({syncState.failedList.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDoneAndRefresh}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  <Check size={15} />
                  <span>Done &amp; Refresh Logistics</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
