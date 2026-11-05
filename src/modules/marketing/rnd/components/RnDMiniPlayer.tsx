import React from 'react';
import {
  UserSearch,
  ExternalLink,
  Maximize2,
  X,
  Loader2,
  CheckCircle2,
  Pause,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Layers,
  Info
} from 'lucide-react';

export interface RnDMiniPlayerProps {
  isBatchRunning: boolean;
  batchProgress: {
    currentIndex: number;
    totalEligible: number;
    currentProfileCode?: string;
    currentUsername?: string;
    completedCount: number;
    partialCount: number;
    failedCount: number;
  } | null;
  researchState: {
    profileCode: string;
    username: string;
    statusText: string;
    isComplete?: boolean;
    error?: string | null;
  } | null;
  isEngineConnected: boolean;
  isPipMode: boolean;
  isPaused?: boolean;
  onRetryFailed?: () => void;
  onFocusMainApp: () => void;
  onClose: () => void;
}

export const setupMiniWindowDocument = (targetDoc: Document) => {
  targetDoc.title = 'Influencer R&D · Mini Player';

  targetDoc.documentElement.classList.add('dark');
  targetDoc.documentElement.style.backgroundColor = '#0B111A';
  targetDoc.documentElement.style.colorScheme = 'dark';

  targetDoc.body.style.margin = '0';
  targetDoc.body.style.padding = '0';
  targetDoc.body.style.backgroundColor = '#0B111A';
  targetDoc.body.style.color = '#F1F5F9';
  targetDoc.body.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Copy style and link elements from parent
  if (typeof document !== 'undefined') {
    Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach(node => {
      targetDoc.head.appendChild(node.cloneNode(true));
    });
  }
};

export const RnDMiniPlayer: React.FC<RnDMiniPlayerProps> = ({
  isBatchRunning,
  batchProgress,
  researchState,
  isEngineConnected,
  isPipMode,
  isPaused,
  onRetryFailed,
  onFocusMainApp,
  onClose,
}) => {
  const total = batchProgress?.totalEligible || 0;
  const current = batchProgress?.currentIndex || 0;
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  const completed = batchProgress?.completedCount || 0;
  const partial = batchProgress?.partialCount || 0;
  const failed = batchProgress?.failedCount || 0;
  const remaining = Math.max(0, total - (completed + partial + failed));

  const currentCode = batchProgress?.currentProfileCode || researchState?.profileCode || '—';
  const currentUsername = batchProgress?.currentUsername || researchState?.username || '—';
  const stageText = researchState?.statusText || (isBatchRunning ? 'Processing profile...' : 'Ready');

  return (
    <div className="min-h-screen w-full bg-[#0B111A] text-[#F1F5F9] p-4 flex flex-col justify-between select-none box-border text-xs leading-normal">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-md border border-[#3B82F6]/20">
            <UserSearch size={15} />
          </div>
          <div>
            <div className="font-bold text-xs text-[#F1F5F9] flex items-center gap-1.5">
              <span>Influencer R&D</span>
              <span className={`px-1.5 py-0.2 text-[9px] font-mono font-medium rounded ${
                isPipMode
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
              }`}>
                {isPipMode ? 'Always-on-Top' : 'Mini Window'}
              </span>
            </div>
            <p className="text-[10px] text-[#64748B]">
              {isBatchRunning ? 'Batch in progress' : 'Monitoring view'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onFocusMainApp}
            title="Focus Main App Dashboard"
            className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded-md transition-colors"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Mini Player"
            className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-md transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 py-3 flex flex-col gap-3 justify-center">
        {/* Active Influencer Card */}
        <div className="bg-[#111827] border border-[#293548] rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Current Influencer</span>
            {isPaused ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/30 animate-pulse">
                <Pause size={10} />
                <span>Paused</span>
              </span>
            ) : isBatchRunning ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded-full border border-[#3B82F6]/20">
                <Loader2 size={10} className="animate-spin" />
                <span>Active</span>
              </span>
            ) : total > 0 && current >= total ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                <CheckCircle2 size={10} />
                <span>Complete</span>
              </span>
            ) : (
              <span className="text-[10px] font-medium text-[#64748B] bg-[#1E293B]/60 px-2 py-0.5 rounded-full">
                Idle
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-bold font-mono text-[#F1F5F9] truncate">
              {currentCode}
            </span>
            <span className="text-xs text-[#3B82F6] font-medium truncate max-w-[170px]" title={currentUsername !== '—' ? `@${currentUsername}` : ''}>
              {currentUsername !== '—' ? `@${currentUsername}` : '—'}
            </span>
          </div>

          <div className={`mt-2 pt-2 border-t border-[#1E293B] flex ${isPaused ? 'flex-col gap-1 items-start' : 'items-center justify-between'} text-[11px]`}>
            <span className="text-[#64748B]">Status:</span>
            <span
              className={
                isPaused
                  ? 'text-[#F59E0B] font-medium leading-snug whitespace-normal break-words w-full'
                  : 'text-[#94A3B8] font-medium truncate max-w-[200px]'
              }
              title={stageText}
            >
              {stageText}
            </span>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-[#111827] border border-[#293548] rounded-xl p-3 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[#F1F5F9]">Progress</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#94A3B8]">
                {total > 0 ? `${current}/${total}` : '0/0'}
              </span>
              <span className="font-mono font-bold text-[#3B82F6]">
                {percent}%
              </span>
            </div>
          </div>

          <div className="w-full bg-[#1E293B] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#3B82F6] h-full transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-[#111827] border border-[#10B981]/25 rounded-lg p-2 text-center">
            <div className="text-[9px] font-medium text-[#64748B] uppercase">Done</div>
            <div className="text-sm font-bold font-mono text-[#10B981] mt-0.5">{completed}</div>
          </div>
          <div className="bg-[#111827] border border-[#F59E0B]/25 rounded-lg p-2 text-center">
            <div className="text-[9px] font-medium text-[#64748B] uppercase">Partial</div>
            <div className="text-sm font-bold font-mono text-[#F59E0B] mt-0.5">{partial}</div>
          </div>
          <div className="bg-[#111827] border border-[#EF4444]/25 rounded-lg p-2 text-center">
            <div className="text-[9px] font-medium text-[#64748B] uppercase">Failed</div>
            <div className="text-sm font-bold font-mono text-[#EF4444] mt-0.5">{failed}</div>
          </div>
          <div className="bg-[#111827] border border-[#293548] rounded-lg p-2 text-center">
            <div className="text-[9px] font-medium text-[#64748B] uppercase">Remain</div>
            <div className="text-sm font-bold font-mono text-[#94A3B8] mt-0.5">{remaining}</div>
          </div>
        </div>
      </div>

      {/* Bottom Advisory & Expand Action */}
      <div className="pt-2 border-t border-[#1E293B] flex flex-col gap-2">
        {/* Companion Notice */}
        <div className="bg-[#1E293B]/60 border border-[#334155]/50 rounded-lg p-2 flex items-start gap-2">
          <Info size={13} className="text-[#3B82F6] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[#94A3B8] leading-tight">
            Keep the Instagram companion window <strong className="text-[#F1F5F9]">open & unminimized</strong> to prevent scraping pauses.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onFocusMainApp}
          className="w-full py-1.5 bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] text-xs font-semibold rounded-lg transition-colors border border-[#293548] flex items-center justify-center gap-1.5"
        >
          <ExternalLink size={12} />
          <span>Expand / Focus Main Dashboard</span>
        </button>
      </div>
    </div>
  );
};
