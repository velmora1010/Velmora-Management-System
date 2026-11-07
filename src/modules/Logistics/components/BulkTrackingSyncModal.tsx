import React, { useEffect, useState, useRef } from 'react';
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
  providedOrders?: any[];
  expectedCount?: number;
}

export const BulkTrackingSyncModal: React.FC<BulkTrackingSyncModalProps> = ({
  isOpen,
  onClose,
  onRefreshView,
  providedOrders,
  expectedCount
}) => {
  const [syncState, setSyncState] = useState<BulkSyncState>(bulkTrackingSyncService.getState());
  const [showFailedDetails, setShowFailedDetails] = useState(false);
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = bulkTrackingSyncService.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  // When modal is opened, if it is idle or was not started, auto-start sync with provided orders
  useEffect(() => {
    if (isOpen) {
      const currentState = bulkTrackingSyncService.getState();
      if ((currentState.status === 'idle' || currentState.totalCandidates === 0) && !hasAutoStartedRef.current) {
        hasAutoStartedRef.current = true;
        bulkTrackingSyncService.startBulkSync({
          providedOrders,
          fallbackCount: expectedCount || (providedOrders?.length) || 1314
        });
      }
    } else {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen, providedOrders, expectedCount]);

  if (!isOpen) return null;

  const isRunning = syncState.status === 'running';
  const isCompleted = syncState.status === 'completed';
  const isPaused = syncState.status === 'paused';
  const isFailed = syncState.status === 'failed';

  const displayedTotal = syncState.totalCandidates > 0 ? syncState.totalCandidates : (expectedCount || providedOrders?.length || 1314);

  const handleStop = () => {
    bulkTrackingSyncService.stopSync();
  };

  const handleResumeOrStart = () => {
    bulkTrackingSyncService.startBulkSync({
      providedOrders,
      fallbackCount: displayedTotal
    });
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
              isPaused ? 'bg-amber-950/60 border-amber-500/50 text-amber-400' :
              isFailed ? 'bg-rose-950/60 border-rose-500/50 text-rose-400' :
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
                  isFailed ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {isRunning ? 'Syncing In Progress' : isCompleted ? 'Completed' : isPaused ? 'Paused' : isFailed ? 'Error' : 'Ready'}
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Minimize to background"
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
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
                {syncState.processed.toLocaleString()} / {displayedTotal.toLocaleString()} AWBs Processed
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 shadow-sm shadow-purple-500/50"
                style={{ width: `${Math.min(100, Math.max(isRunning ? 2 : 0, syncState.progress))}%` }}
              />
            </div>

            {/* Live active item info */}
            {syncState.currentAwb && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono animate-in fade-in">
                {isRunning && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />}
                <span className="truncate">
                  {syncState.currentAwb.startsWith('Discovering') ? (
                    <span className="text-purple-300">{syncState.currentAwb}</span>
                  ) : (
                    <>
                      Checking {syncState.currentCourier}: <strong className="text-cyan-300">{syncState.currentAwb}</strong> 
                      {syncState.currentOrderId ? ` (Order #${syncState.currentOrderId})` : ''}
                    </>
                  )}
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
                {displayedTotal.toLocaleString()}
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

          {/* Courier Breakdown Pill Section */}
          <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Courier Breakdown:</span>
            
            {/* Delhivery Pill */}
            <div className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span className="font-semibold text-rose-200">Delhivery:</span>
              <span className="font-mono text-rose-300 font-bold">
                {syncState.courierBreakdown['Delhivery']?.processed ?? 0} / {syncState.courierBreakdown['Delhivery']?.total ?? displayedTotal}
              </span>
              {(syncState.courierBreakdown['Delhivery']?.updated ?? 0) > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  (+{syncState.courierBreakdown['Delhivery'].updated} updated)
                </span>
              )}
            </div>

            {/* ST Courier Pill */}
            <div className="px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/60 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              <span className="font-semibold text-purple-200">ST Courier:</span>
              <span className="font-mono text-purple-300 font-bold">
                {syncState.courierBreakdown['ST Courier']?.processed ?? 0} / {syncState.courierBreakdown['ST Courier']?.total ?? 0}
              </span>
              {(syncState.courierBreakdown['ST Courier']?.updated ?? 0) > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  (+{syncState.courierBreakdown['ST Courier'].updated} updated)
                </span>
              )}
            </div>
          </div>

          {/* Live Recent Updates Feed */}
          {syncState.recentUpdates.length > 0 && (
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Recent Status Transitions ({syncState.recentUpdates.length})</span>
              </h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {syncState.recentUpdates.slice(0, 8).map((up, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-purple-300 font-mono">#{up.orderId}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{up.awb}</span>
                      <span className="text-slate-400 text-[11px] truncate">
                        {up.oldStatus} &rarr; <strong className="text-emerald-300">{up.newStatus}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">{up.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Failed Shipments Section */}
          {syncState.failedList.length > 0 && (
            <div className="p-3.5 bg-rose-950/20 rounded-xl border border-rose-900/50">
              <button
                type="button"
                onClick={() => setShowFailedDetails(!showFailedDetails)}
                className="w-full flex items-center justify-between text-xs font-bold text-rose-300 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-rose-400" />
                  <span>Failed Tracking Requests ({syncState.failedList.length})</span>
                </div>
                {showFailedDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showFailedDetails && (
                <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar border-t border-rose-900/40 pt-2">
                  {syncState.failedList.map((fail, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-rose-950/40 border border-rose-800/40">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-rose-200">#{fail.orderId}</span>
                        <span className="font-mono text-slate-400 text-[11px]">{fail.awb} ({fail.courier})</span>
                        <span className="text-rose-300 text-[11px] truncate">{fail.error}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono ml-2">{fail.lastAttempt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-900/70">
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
            ) : isCompleted ? (
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
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleResumeOrStart}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-purple-600/30"
                >
                  <Play size={14} />
                  <span>Start Synchronization ({displayedTotal.toLocaleString()} AWBs)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDoneAndRefresh}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
