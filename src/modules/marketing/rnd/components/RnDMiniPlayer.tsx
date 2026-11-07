import React from 'react';
import {
  UserSearch,
  ExternalLink,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  CheckCircle2,
  Pause,
  Play,
  Square,
  RotateCcw,
  Info,
  GripHorizontal,
  PictureInPicture2
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
    followerDisplay?: string | null;
    reelsDiscovered?: number | null;
    pinnedReelsExcluded?: number | null;
    selectedReelCount?: number | null;
    validViewCountsCount?: number | null;
    averageViews?: number | null;
    category?: string | null;
  } | null;
  isEngineConnected: boolean;
  isPipMode: boolean;
  isPaused?: boolean;
  isUserPaused?: boolean;
  isMinimized?: boolean;
  isExpanded?: boolean;
  isFloatingMode?: boolean;
  onRetryFailed?: () => void;
  onTogglePause?: () => void;
  onStopSession?: () => void;
  onToggleMinimize?: () => void;
  onToggleExpand?: () => void;
  onOpenPipWindow?: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
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
  isUserPaused,
  isMinimized = false,
  isExpanded = false,
  isFloatingMode = false,
  onRetryFailed,
  onTogglePause,
  onStopSession,
  onToggleMinimize,
  onToggleExpand,
  onOpenPipWindow,
  onHeaderPointerDown,
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
  const effectivePaused = Boolean(isPaused || isUserPaused);
  const stageText = researchState?.statusText || (isBatchRunning ? 'Processing profile...' : total > 0 ? 'Session ready' : 'No active R&D session');

  // Minimized Compact Pill View
  if (isMinimized) {
    return (
      <div data-testid="rnd-miniplayer-minimized" className="w-full bg-[#0B111A] text-[#F1F5F9] px-3.5 py-2.5 flex flex-col gap-2 select-none box-border text-xs leading-normal rounded-2xl border border-[#293548] shadow-2xl">
        <div
          className={`flex items-center justify-between gap-2 ${onHeaderPointerDown ? 'cursor-move' : ''}`}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-md border border-[#3B82F6]/20 shrink-0">
              <UserSearch size={13} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#F1F5F9] font-mono truncate">{currentCode}</span>
                {effectivePaused ? (
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-[#F59E0B] bg-[#F59E0B]/15 px-1.5 py-0.5 rounded-full border border-[#F59E0B]/30 shrink-0">
                    <Pause size={9} />
                    <span>{isUserPaused ? 'USER PAUSED' : 'Paused'}</span>
                  </span>
                ) : isBatchRunning ? (
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5 rounded-full border border-[#3B82F6]/20 shrink-0">
                    <Loader2 size={9} className="animate-spin" />
                    <span>{`${current}/${total}`}</span>
                  </span>
                ) : total > 0 && current >= total ? (
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-full border border-[#10B981]/20 shrink-0">
                    <CheckCircle2 size={9} />
                    <span>Done</span>
                  </span>
                ) : (
                  <span className="text-[9px] font-medium text-[#64748B] bg-[#1E293B]/60 px-1.5 py-0.5 rounded-full shrink-0">
                    Idle
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#94A3B8] truncate">
                {currentUsername !== '—' ? `@${currentUsername}` : stageText}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            {isBatchRunning && onTogglePause && (
              <button
                type="button"
                onClick={onTogglePause}
                title={effectivePaused ? 'Resume R&D Session' : 'Pause R&D Queue'}
                className={`p-1.5 rounded-md transition-colors ${
                  effectivePaused
                    ? 'text-[#F59E0B] hover:bg-[#F59E0B]/15'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B]'
                }`}
              >
                {effectivePaused ? <Play size={12} /> : <Pause size={12} />}
              </button>
            )}
            {onToggleMinimize && (
              <button
                type="button"
                onClick={onToggleMinimize}
                title="Restore Mini Player"
                className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded-md transition-colors"
              >
                <Maximize2 size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Hide Mini Player (session continues in background)"
              className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-md transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden">
          <div
            data-testid="rnd-miniplayer-progress-bar"
      className={`${effectivePaused ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'} h-full transition-all duration-300 rounded-full`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="rnd-miniplayer-card"
      className={`${
        isFloatingMode ? 'w-full h-full rounded-2xl border border-[#293548] shadow-2xl' : 'min-h-screen w-full'
      } bg-[#0B111A] text-[#F1F5F9] p-4 flex flex-col justify-between select-none box-border text-xs leading-normal`}
    >
      {/* Top Bar */}
      <div
        className={`flex items-center justify-between pb-3 border-b border-[#1E293B] ${
          onHeaderPointerDown ? 'cursor-move' : ''
        }`}
        onPointerDown={onHeaderPointerDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-md border border-[#3B82F6]/20 shrink-0">
            <UserSearch size={15} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-[#F1F5F9] flex items-center gap-1.5">
              <span className="truncate">Influencer R&amp;D</span>
              <span className={`px-1.5 py-0.2 text-[9px] font-mono font-medium rounded shrink-0 ${
                isPipMode
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : isFloatingMode
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
              }`}>
                {isPipMode ? 'Always-on-Top' : isFloatingMode ? 'Global Player' : 'Mini Window'}
              </span>
            </div>
            <p className="text-[10px] text-[#64748B] flex items-center gap-1">
              {onHeaderPointerDown && <GripHorizontal size={11} className="text-[#475569] shrink-0" />}
              <span>{isBatchRunning ? 'Batch in progress' : 'Monitoring view'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {isFloatingMode && onOpenPipWindow && (
            <button
              type="button"
              onClick={onOpenPipWindow}
              title="Pop out Always-on-Top Window"
              className="p-1.5 text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#1E293B] rounded-md transition-colors"
            >
              <PictureInPicture2 size={13} />
            </button>
          )}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              title={isExpanded ? 'Collapse Details' : 'Expand Details'}
              className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded-md transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              title="Minimize Mini Player"
              className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded-md transition-colors"
            >
              <Minimize2 size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onFocusMainApp}
            title="Open / Focus Influencer R&D Dashboard"
            className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded-md transition-colors"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Hide Mini Player (keeps active R&D session running)"
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
            {effectivePaused ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/30 animate-pulse">
                <Pause size={10} />
                <span>{isUserPaused ? 'USER PAUSED' : 'Paused'}</span>
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

          <div className={`mt-2 pt-2 border-t border-[#1E293B] flex ${effectivePaused ? 'flex-col gap-1 items-start' : 'items-center justify-between'} text-[11px]`}>
            <span className="text-[#64748B]">Status:</span>
            <span
              className={
                effectivePaused
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
              data-testid="rnd-miniplayer-progress-bar"
      className={`${effectivePaused ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'} h-full transition-all duration-300 rounded-full`}
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

        {/* Expanded Live Telemetry Section */}
        {isExpanded && (
          <div data-testid="rnd-miniplayer-expanded-details" className="bg-[#111827] border border-[#293548] rounded-xl p-3 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
              <span>Live Session Details</span>
              <span className={isEngineConnected ? 'text-[#10B981]' : 'text-[#F59E0B]'}>
                {isEngineConnected ? 'Engine Connected' : 'Check Extension'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-2">
                <div className="text-[9px] text-[#64748B] uppercase">Followers</div>
                <div className="font-mono font-bold text-[#F1F5F9] truncate mt-0.5">
                  {researchState?.followerDisplay || '—'}
                </div>
              </div>
              <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-2">
                <div className="text-[9px] text-[#64748B] uppercase">Valid Views</div>
                <div className="font-mono font-bold text-[#3B82F6] mt-0.5">
                  {typeof researchState?.validViewCountsCount === 'number' ? `${researchState.validViewCountsCount}/15` : '—'}
                </div>
              </div>
              <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-2">
                <div className="text-[9px] text-[#64748B] uppercase">Category</div>
                <div className="font-mono font-bold text-[#10B981] truncate mt-0.5">
                  {researchState?.category || '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Playback & Stop Controls */}
        {(isBatchRunning || (!isBatchRunning && onRetryFailed && (failed > 0 || remaining > 0))) && (
          <div className="flex items-center gap-2">
            {isBatchRunning && onTogglePause && (
              <button
                type="button"
                onClick={onTogglePause}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border flex items-center justify-center gap-1.5 ${
                  effectivePaused
                    ? 'bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border-[#F59E0B]/35'
                    : 'bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] border-[#293548]'
                }`}
              >
                {effectivePaused ? <Play size={12} /> : <Pause size={12} />}
                <span>{effectivePaused ? 'Resume' : 'Pause'}</span>
              </button>
            )}

            {isBatchRunning && onStopSession && (
              <button
                type="button"
                onClick={onStopSession}
                title="Explicitly stop the active R&D scraping session"
                className="flex-1 py-1.5 px-3 bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-xs font-semibold rounded-lg transition-colors border border-[#EF4444]/35 flex items-center justify-center gap-1.5"
              >
                <Square size={11} />
                <span>Stop Session</span>
              </button>
            )}

            {!isBatchRunning && onRetryFailed && (failed > 0 || remaining > 0) && (
              <button
                type="button"
                onClick={onRetryFailed}
                className="w-full py-1.5 px-3 bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[#3B82F6] text-xs font-semibold rounded-lg transition-colors border border-[#3B82F6]/35 flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={12} />
                <span>Retry Failed / Remaining ({failed + remaining})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Advisory & Expand Action */}
      <div className="pt-2 border-t border-[#1E293B] flex flex-col gap-2">
        {/* Companion Notice */}
        <div className="bg-[#1E293B]/60 border border-[#334155]/50 rounded-lg p-2 flex items-start gap-2">
          <Info size={13} className="text-[#3B82F6] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[#94A3B8] leading-tight">
            Keep the Instagram companion window <strong className="text-[#F1F5F9]">open &amp; unminimized</strong> to prevent scraping pauses.
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
