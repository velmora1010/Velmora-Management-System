import React, { useMemo, useState, useCallback } from 'react';
import { ArrowLeft, UserSearch, Globe, Camera, CheckCircle2, XCircle, AlertCircle, Activity, AlertTriangle, ExternalLink, X, Code, Layers, Eye, Loader2, Clock, Info, Pause, Play, Square, Download, BarChart2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DiscoveredReel } from './rnd/types/rndTypes';
import { RnDUploadArea } from './rnd/components/RnDUploadArea';
import { RnDPreviewTable, RnDInputFileSummary } from './rnd/components/RnDPreviewTable';
import { RnDExportButton } from './rnd/components/RnDExportButton';
import { RnDViewProfiles } from './rnd/components/RnDViewProfiles';
import { categorize, extractValidViewsFromResult } from './rnd/utils/rndExportService';
import { useRnDContext } from './rnd/context/RnDContext';
import { EXTENSION_RELEASE_METADATA } from './rnd/config/extensionReleaseConfig';
import { downloadExtensionPackage } from './rnd/utils/extensionPackageDownload';

function getCategoryQualifyingInfo(
  category?: string | null,
  rawViews?: number[] | null,
  selectedReels?: DiscoveredReel[] | null,
  isFailed?: boolean
): string | null {
  if (isFailed || !category || category === 'NotEnoughReels' || category === 'Uncategorized') {
    return null;
  }

  let validViews: number[] = [];
  if (Array.isArray(rawViews) && rawViews.length > 0) {
    validViews = rawViews.filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  } else if (Array.isArray(selectedReels) && selectedReels.length > 0) {
    validViews = selectedReels
      .filter(r => r && !r.isPinned && typeof r.viewCount === 'number' && Number.isFinite(r.viewCount) && r.viewCount >= 0)
      .map(r => r.viewCount as number);
  }

  if (validViews.length === 0) return null;

  const totalValid = validViews.length;
  let qualifyingCount = 0;

  switch (category) {
    case 'C1L1':
      qualifyingCount = validViews.filter(v => v >= 1000000).length;
      break;
    case 'C1L2':
      qualifyingCount = validViews.filter(v => v >= 500000).length;
      break;
    case 'C2L1':
      qualifyingCount = validViews.filter(v => v >= 250000).length;
      break;
    case 'C2L2':
      qualifyingCount = validViews.filter(v => v >= 100000).length;
      break;
    case 'C3L1':
      qualifyingCount = validViews.filter(v => v >= 50000).length;
      break;
    case 'C3L2':
      qualifyingCount = validViews.filter(v => v >= 25000).length;
      break;
    case 'C4L1':
      qualifyingCount = validViews.filter(v => v >= 10000).length;
      break;
    case 'C4L2':
      qualifyingCount = validViews.filter(v => v < 10000).length;
      break;
    default:
      return null;
  }

  return `${qualifyingCount}/${totalValid} qualifying`;
}

interface InfluencerRnDProps {
  onBack: () => void;
}

export const InfluencerRnD: React.FC<InfluencerRnDProps> = ({ onBack }) => {
  const {
    extState,
    igState,
    extVersion,
    isEngineConnected,
    handleManualCheck,
    handleOpenInstagram,
    currentJob,
    isParsing,
    parseError,
    researchMessage,
    isBatchRunning,
    isResearchPaused,
    isUserPaused,
    selectedProfileCode,
    setSelectedProfileCode,
    researchResults,
    batchProgress,
    researchState,
    handleFileSelect,
    handleReplaceFile,
    handleStartResearch,
    handleTogglePause,
    handleStopSession,
    diagnosticResult,
    setDiagnosticResult,
    isDiagnosing,
    diagTargetUser,
    isDiagModalOpen,
    setIsDiagModalOpen,
    manualUsernameInput,
    setManualUsernameInput,
    handleOpenDiagModal,
    handleRunDiagnostic,
    isMiniPlayerOpen,
    handleOpenMiniPlayer,
    handleCloseMiniPlayer,
  } = useRnDContext();

  const [isDownloadingExtension, setIsDownloadingExtension] = useState(false);
  const [extensionDownloadStatus, setExtensionDownloadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const isAnalyticsSubview = searchParams.get('subview') === 'analytics';

  const handleOpenAnalytics = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'influencer-rnd');
    nextParams.set('subview', 'analytics');
    setSearchParams(nextParams);

    if (typeof document !== 'undefined') {
      const targetEl =
        document.getElementById('rnd-analytics-section') ||
        document.getElementById('rnd-workspace-section');
      if (targetEl && typeof targetEl.scrollIntoView === 'function') {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [searchParams, setSearchParams]);

  const handleDownloadExtensionAndGuide = useCallback(async () => {
    if (isDownloadingExtension) return;
    setIsDownloadingExtension(true);
    setExtensionDownloadStatus(null);
    try {
      const result = await downloadExtensionPackage();
      setExtensionDownloadStatus({
        type: result.success ? 'success' : 'error',
        message: result.message
      });
    } finally {
      setIsDownloadingExtension(false);
    }
  }, [isDownloadingExtension]);

  const activeCardData = useMemo(() => {
    if (!selectedProfileCode) return researchState;
    if (researchState && researchState.profileCode === selectedProfileCode) {
      return researchState;
    }
    const saved = researchResults[selectedProfileCode];
    if (saved) {
      const isPartial = saved.status === 'partial' || saved.status === 'reels_not_enough' || (saved.validViewCountsCount !== undefined && saved.validViewCountsCount < 15);
      const isFailed = saved.status === 'reels_not_found' || saved.status === 'failed';
      return {
        profileCode: saved.influencerCode,
        username: saved.requestedUsername,
        statusText: saved.status === 'reels_not_found'
          ? 'Failed (No Reels)'
          : isFailed
            ? (saved.error || 'Failed')
            : isPartial
              ? `Partial (${saved.validViewCountsCount ?? 0}/15 valid view counts)`
              : 'Completed',
        followerDisplay: saved.followerDisplay,
        reelsDiscovered: saved.reelsDiscovered ?? 0,
        pinnedReelsExcluded: saved.pinnedReelsExcluded ?? 0,
        selectedReelCount: saved.selectedReelCount ?? 0,
        validViewCountsCount: saved.validViewCountsCount ?? 0,
        averageViews: saved.averageViews ?? 0,
        rawViewCounts: saved.rawViewCounts ?? [],
        selectedReels: saved.selectedReels ?? [],
        missingViewCountsCount: typeof saved.missingViewCountsCount === 'number'
          ? saved.missingViewCountsCount
          : Math.max(0, 15 - (saved.validViewCountsCount ?? 0)),
        category:
          saved.category ||
          saved.creatorCategory ||
          (saved.status !== 'failed' ? categorize(extractValidViewsFromResult(saved)) : null),
        isComplete: true,
        error: isFailed ? (saved.error || 'Zero reels were discovered') : null,
        finalUrl: saved.finalUrl,
        navigationSuccess: saved.navigationSuccess,
        pageReadiness: saved.pageReadiness,
        reelAnchorsAtStart: saved.reelAnchorsAtStart,
        failureStage: saved.failureStage,
        failureReason: saved.failureReason
      };
    }
    return researchState;
  }, [selectedProfileCode, researchState, researchResults]);

  return (
    <div className="p-4 sm:p-6 text-[#F1F5F9] max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Row 1: Main Header (Title + Extension Distribution + Version + Analytics) */}
      <div className="space-y-3">
        <div
          data-testid="rnd-main-header"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-[#293548]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] rounded-lg transition-colors border border-[#293548] shrink-0"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded-lg shrink-0">
                <UserSearch size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[#F1F5F9] tracking-tight truncate">Influencer Research & Development</h2>
                <p className="text-xs text-[#94A3B8] truncate">Discover, scrape, and categorize Instagram creators</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={handleDownloadExtensionAndGuide}
              disabled={isDownloadingExtension}
              data-testid="download-extension-setup-guide-btn"
              title={`Download ${EXTENSION_RELEASE_METADATA.zipFilename} (Extension v${EXTENSION_RELEASE_METADATA.version} + Setup Guide PDF + README)`}
              className="px-3.5 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-colors border border-[#60A5FA]/30 shadow-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              {isDownloadingExtension ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Preparing Download...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download Extension + Setup Guide</span>
                </>
              )}
            </button>
            <span
              data-testid="extension-release-version-badge"
              className="px-2.5 py-1.5 text-[11px] font-mono font-semibold text-[#93C5FD] bg-[#1E293B] border border-[#3B82F6]/30 rounded-lg"
              title="Latest approved Velmora Instagram Companion extension release version"
            >
              v{EXTENSION_RELEASE_METADATA.version}
            </span>
            <button
              type="button"
              onClick={handleOpenAnalytics}
              data-testid="rnd-analytics-btn"
              title="Open Influencer R&D Analytics section"
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors border flex items-center gap-1.5 ${
                isAnalyticsSubview
                  ? 'bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/40'
                  : 'bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] border-[#293548]'
              }`}
            >
              <BarChart2 size={14} />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* Row 2: Second-Level Operational Action Toolbar (Export Results | Open Mini Player | Check Connection) */}
        <div
          data-testid="rnd-action-toolbar"
          className="flex flex-wrap items-center justify-start sm:justify-end gap-2.5"
        >
          <RnDExportButton
            job={currentJob}
            researchResults={researchResults}
            isBatchRunning={isBatchRunning}
            size="sm"
          />
          <button
            type="button"
            onClick={isMiniPlayerOpen ? handleCloseMiniPlayer : handleOpenMiniPlayer}
            data-testid="rnd-open-miniplayer-btn"
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors border flex items-center gap-1.5 ${
              isMiniPlayerOpen
                ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30'
                : 'bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] border-[#293548]'
            }`}
            title={isMiniPlayerOpen ? 'Mini Player is currently open' : 'Open compact monitoring window'}
          >
            <ExternalLink size={13} />
            <span>{isMiniPlayerOpen ? 'Mini Player Open' : 'Open Mini Player'}</span>
          </button>
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isBatchRunning}
            data-testid="rnd-check-connection-btn"
            className="px-3.5 py-2 bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] text-xs font-semibold rounded-lg transition-colors border border-[#293548] disabled:opacity-50"
          >
            Check Connection
          </button>
        </div>
      </div>

      {extensionDownloadStatus && (
        <div
          data-testid="extension-download-feedback"
          className={`max-w-6xl mx-auto px-4 py-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            extensionDownloadStatus.type === 'success'
              ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#D1FAE5]'
              : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#FEE2E2]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {extensionDownloadStatus.type === 'success' ? (
              <CheckCircle2 size={16} className="text-[#10B981] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-[#EF4444] shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{extensionDownloadStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setExtensionDownloadStatus(null)}
            className="text-[#94A3B8] hover:text-[#F1F5F9] p-0.5 rounded transition-colors shrink-0"
            title="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
        {/* Extension Status Card */}
        <div className="bg-[#171F2B] border border-[#293548] rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#111827] border border-[#293548] rounded-lg text-[#3B82F6]">
                  <Globe size={18} />
                </div>
                <h3 className="text-sm font-semibold text-[#F1F5F9]">Chrome Extension</h3>
              </div>
              {extState === 'CONNECTING' && (
                <span className="text-xs text-[#94A3B8] animate-pulse">Checking...</span>
              )}
              {extState === 'CONNECTED' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 size={14} /> Connected
                </span>
              )}
              {extState === 'NOT_DETECTED' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/25 px-2.5 py-0.5 rounded-full">
                  <XCircle size={14} /> Not Detected
                </span>
              )}
              {extState === 'ERROR' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/25 px-2.5 py-0.5 rounded-full">
                  <AlertCircle size={14} /> Connection Error
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed mb-2">
              {extState === 'CONNECTED'
                ? 'Connected to Velmora R&D browser extension.'
                : 'Velmora Influencer R&D extension is not connected. Please ensure the extension is installed and enabled in your browser.'}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-2 pt-2 border-t border-[#293548]/60 font-mono">
            <span>Latest Package: v{EXTENSION_RELEASE_METADATA.version}</span>
            {extVersion && <span>Installed: v{extVersion}</span>}
          </div>
        </div>

        {/* Instagram Status Card */}
        <div className="bg-[#171F2B] border border-[#293548] rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#111827] border border-[#293548] rounded-lg text-[#3B82F6]">
                  <Camera size={18} />
                </div>
                <h3 className="text-sm font-semibold text-[#F1F5F9]">Instagram Session</h3>
              </div>
              {igState === 'CHECKING' && (
                <span className="text-xs text-[#94A3B8] animate-pulse">Waiting...</span>
              )}
              {igState === 'SESSION_DETECTED' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 size={14} /> Session Detected
                </span>
              )}
              {igState === 'LOGIN_REQUIRED' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/25 px-2.5 py-0.5 rounded-full">
                  <AlertCircle size={14} /> Login Required
                </span>
              )}
              {igState === 'NOT_AVAILABLE' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/25 px-2.5 py-0.5 rounded-full">
                  <XCircle size={14} /> Not Available
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {igState === 'SESSION_DETECTED'
                ? 'Your Instagram browser session appears authenticated.'
                : igState === 'LOGIN_REQUIRED'
                  ? 'An Instagram tab was found, but login is required.'
                  : igState === 'NOT_AVAILABLE'
                    ? 'Instagram tab is not open or extension cannot reach it.'
                    : 'Waiting for Chrome extension connection...'}
            </p>
          </div>

          {(igState === 'LOGIN_REQUIRED' || igState === 'NOT_AVAILABLE') && extState === 'CONNECTED' && (
            <div className="mt-3">
              <button
                onClick={handleOpenInstagram}
                className="px-3.5 py-1.5 bg-[#1D2736] hover:bg-[#253245] text-[#F1F5F9] text-xs font-medium rounded-lg transition-colors border border-[#293548]"
              >
                Open Instagram
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div id="rnd-workspace-section" className="max-w-6xl mx-auto space-y-5">
        <h2 className="text-base font-bold text-[#F1F5F9] mb-3 tracking-tight">New Research Run</h2>

        {/* Phase 1: Communication & Reel Discovery Diagnostic Panel */}
        {(diagnosticResult || isDiagnosing) && (
          <div className="mb-6 bg-[#171F2B] p-5 sm:p-6 rounded-xl border border-[#293548] shadow-sm flex flex-col gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#293548] pb-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded-full border border-[#3B82F6]/20">
                    Phase 1 Diagnostic
                  </span>
                  <h3 className="text-base font-bold text-[#F1F5F9]">
                    Communication &amp; Reel Discovery
                  </h3>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1 flex flex-wrap items-center gap-2">
                  <span>Target:</span>
                  <span className="font-semibold text-[#F1F5F9]">@{diagTargetUser}</span>
                  {diagnosticResult?.tabId && (
                    <>
                      <span>•</span>
                      <span className="text-xs text-[#64748B]">Instagram Tab ID: {diagnosticResult.tabId}</span>
                    </>
                  )}
                  {diagnosticResult?.readyState && (
                    <>
                      <span>•</span>
                      <span className="text-xs text-[#64748B]">readyState: <code className="text-[#3B82F6] font-mono">{diagnosticResult.readyState}</code></span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isDiagnosing ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] text-xs font-medium">
                    <div className="w-3.5 h-3.5 border-2 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin"></div>
                    <span>Testing Handshake &amp; DOM...</span>
                  </div>
                ) : diagnosticResult?.stage === 'reels_discovered' ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 size={14} /> Discovery Successful
                  </span>
                ) : diagnosticResult?.stage === 'zero_reels' ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-2.5 py-1 rounded-lg">
                    <AlertTriangle size={14} /> Zero Reels Discovered
                  </span>
                ) : diagnosticResult?.stage === 'navigation_failure' ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-2.5 py-1 rounded-lg">
                    <AlertCircle size={14} /> Navigation / Tab Failure
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-2.5 py-1 rounded-lg">
                    <XCircle size={14} /> Communication Failure
                  </span>
                )}

                <button
                  onClick={() => setDiagnosticResult(null)}
                  className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] rounded-lg hover:bg-[#1D2736] transition-colors ml-1"
                  title="Dismiss diagnostic"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Diagnostic In Progress Banner */}
            {isDiagnosing && (
              <div className="bg-slate-800/40 border border-slate-700/60 p-4 rounded-lg flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Diagnostic Steps Running</span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>Locating open Instagram tab and validating tab ID</li>
                  <li>Executing PING message into tab and awaiting PONG with readyState</li>
                  <li>Verifying navigation completion to profile/reels URL</li>
                  <li>Taking passive DOM snapshot querying <code className="text-amber-300">a[href*="/reel/"]</code></li>
                </ul>
              </div>
            )}

            {/* Diagnostic Result Details */}
            {!isDiagnosing && diagnosticResult && (
              <div className="flex flex-col gap-4">
                {/* Stage: Communication Failure */}
                {diagnosticResult.stage === 'communication_failure' && (
                  <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                      <XCircle size={18} />
                      <span>Communication Failure</span>
                    </div>
                    <p className="text-sm text-red-300">{diagnosticResult.message}</p>
                    <div className="text-xs text-slate-400 mt-1 bg-slate-900/60 p-3 rounded-lg border border-red-500/20 space-y-1 font-mono">
                      <div>Error Code: {diagnosticResult.error || 'COMMUNICATION_ERROR'}</div>
                      <div>Tab ID: {diagnosticResult.tabId || 'No tab found'}</div>
                      <div className="text-slate-400 font-sans mt-2">
                        💡 Tip: Please ensure the Chrome extension is enabled and at least one Instagram tab is open in Chrome.
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage: Navigation / Wrong Tab Failure */}
                {diagnosticResult.stage === 'navigation_failure' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <AlertCircle size={18} />
                      <span>Navigation or Wrong-Tab Failure</span>
                    </div>
                    <p className="text-sm text-amber-300">{diagnosticResult.message}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-lg border border-amber-500/20 font-mono text-slate-300">
                      <div><span className="text-slate-500">Target URL:</span> {diagnosticResult.targetUrl || '-'}</div>
                      <div><span className="text-slate-500">Actual URL:</span> {diagnosticResult.actualUrl || '-'}</div>
                      <div><span className="text-slate-500">readyState:</span> {diagnosticResult.readyState || '-'}</div>
                      <div><span className="text-slate-500">Error Code:</span> {diagnosticResult.error || '-'}</div>
                    </div>
                  </div>
                )}

                {/* Stage: Zero Reels Discovered */}
                {diagnosticResult.stage === 'zero_reels' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <AlertTriangle size={18} />
                      <span>Page Loaded Correctly — Zero Reel Anchors (a[href*="/reel/"]) Discovered</span>
                    </div>
                    <p className="text-sm text-amber-200/90">{diagnosticResult.message}</p>

                    {/* Metric Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-amber-500/20">
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Reel Anchors</span>
                        <span className="text-xl font-bold text-amber-400">0</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Post Anchors (/p/)</span>
                        <span className="text-xl font-bold text-slate-200">{diagnosticResult.postAnchorsCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Media Elements</span>
                        <span className="text-xl font-bold text-slate-200">{diagnosticResult.visibleMediaCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Grid Elements</span>
                        <span className="text-xl font-bold text-slate-200">{diagnosticResult.gridElementCount || 0}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-amber-500/20 space-y-1">
                      <div><span className="text-slate-400">Actual Page URL:</span> <span className="font-mono text-slate-200">{diagnosticResult.actualUrl}</span></div>
                      <div><span className="text-slate-400">Detected Username:</span> <strong className="text-slate-200">@{diagnosticResult.detectedUsername}</strong></div>
                      <div><span className="text-slate-400">Snapshot Retried (3s rendering wait):</span> <span className="text-slate-200">{diagnosticResult.snapshotRetried ? 'Yes (Retried, still 0)' : 'No'}</span></div>
                    </div>
                  </div>
                )}

                {/* Stage: Successful Reel-Anchor Discovery */}
                {diagnosticResult.stage === 'reels_discovered' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 size={18} />
                      <span>Reel Discovery Handshake Verified</span>
                    </div>
                    <p className="text-sm text-emerald-200/90">{diagnosticResult.message}</p>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-900/60 p-3 rounded-lg border border-emerald-500/20">
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Unique Reels</span>
                        <span className="text-2xl font-bold text-emerald-400">{diagnosticResult.uniqueReelUrls || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Valid View Counts</span>
                        <span className="text-2xl font-bold text-blue-400">{diagnosticResult.validViewCountsCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Average Views</span>
                        <span className="text-2xl font-bold text-emerald-300">{(diagnosticResult.averageViews || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Pinned Excluded</span>
                        <span className="text-2xl font-bold text-amber-400">{diagnosticResult.pinnedReelsCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Total Anchors</span>
                        <span className="text-2xl font-bold text-slate-200">{diagnosticResult.totalReelAnchors || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Media Elements</span>
                        <span className="text-2xl font-bold text-slate-300">{diagnosticResult.visibleMediaCount || 0}</span>
                      </div>
                    </div>

                    {/* Raw Extracted View Counts */}
                    {diagnosticResult.rawViewCounts && diagnosticResult.rawViewCounts.length > 0 && (
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-emerald-500/20">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                          Raw Extracted View Counts ({diagnosticResult.rawViewCounts.length} Non-Pinned Samples)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {diagnosticResult.rawViewCounts.map((count, cIdx) => (
                            <span key={cIdx} className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded font-mono text-xs font-semibold">
                              #{cIdx + 1}: {count.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-emerald-500/20 space-y-1">
                      <div><span className="text-slate-400">Actual URL:</span> <span className="font-mono text-slate-200">{diagnosticResult.actualUrl}</span></div>
                      <div><span className="text-slate-400">Detected Username:</span> <strong className="text-slate-200">@{diagnosticResult.detectedUsername}</strong></div>
                      <div><span className="text-slate-400">Snapshot Retried:</span> <span className="text-slate-200">{diagnosticResult.snapshotRetried ? 'Yes' : 'No (Found immediately)'}</span></div>
                    </div>

                    {/* First 10 Discovered Reels List */}
                    {diagnosticResult.first10Reels && diagnosticResult.first10Reels.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                          First {diagnosticResult.first10Reels.length} Discovered Reels (Passive Snapshot)
                        </span>
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                          {diagnosticResult.first10Reels.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-colors">
                              <span className="text-slate-400 font-mono text-[11px] shrink-0">#{idx + 1}</span>
                              <span className="font-mono text-slate-200 truncate flex-1">{url}</span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 shrink-0 p-1"
                                title="Open Reel"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Read-Only DOM Evidence Inspector */}
                {diagnosticResult.domEvidence && (
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-4 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                      <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                        <Layers size={16} className="text-blue-400" />
                        <span>DOM Evidence & Selector Diagnostics</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Read-Only Page Snapshot</span>
                    </div>

                    {diagnosticResult.domEvidence.collectionError && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-red-300">
                        <strong>Collection Error:</strong> {diagnosticResult.domEvidence.collectionError}
                      </div>
                    )}

                    {/* Selector Counts Grid */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Anchor Counts by Selector
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Total a[href]</span>
                          <span className="text-base font-bold text-slate-100">{diagnosticResult.domEvidence.totalHrefAnchors}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-mono">a[href*="/reel/"]</span>
                          <span className={`text-base font-bold ${diagnosticResult.domEvidence.reelHrefAnchorsCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {diagnosticResult.domEvidence.reelHrefAnchorsCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-mono">a[href*="/reels/"]</span>
                          <span className={`text-base font-bold ${diagnosticResult.domEvidence.reelsHrefAnchorsCount > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                            {diagnosticResult.domEvidence.reelsHrefAnchorsCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-mono">a[href*="/p/"]</span>
                          <span className="text-base font-bold text-slate-200">{diagnosticResult.domEvidence.postHrefAnchorsCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Container Context */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Media Container Context
                      </span>
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                        <div className="flex flex-wrap gap-4 text-[11px]">
                          <span>In &lt;main&gt;: <strong className={diagnosticResult.domEvidence.containerContext.isInMain ? 'text-emerald-400' : 'text-slate-400'}>{diagnosticResult.domEvidence.containerContext.isInMain ? 'Yes' : 'No'}</strong></span>
                          <span>In &lt;article&gt;: <strong className={diagnosticResult.domEvidence.containerContext.isInArticle ? 'text-emerald-400' : 'text-slate-400'}>{diagnosticResult.domEvidence.containerContext.isInArticle ? 'Yes' : 'No'}</strong></span>
                          <span>In Dialog: <strong className={diagnosticResult.domEvidence.containerContext.isInDialog ? 'text-amber-400' : 'text-slate-400'}>{diagnosticResult.domEvidence.containerContext.isInDialog ? 'Yes' : 'No'}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          <span className="text-slate-500">Parent hierarchy:</span> <code className="font-mono text-slate-300">{diagnosticResult.domEvidence.containerContext.parentSummary}</code>
                        </div>
                      </div>
                    </div>

                    {/* First 10 Visible Media Elements */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        First {diagnosticResult.domEvidence.first10VisibleMedia.length} Visible Media Elements (IMG/VIDEO)
                      </span>
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {diagnosticResult.domEvidence.first10VisibleMedia.map((m, idx) => (
                          <div key={idx} className="bg-slate-950/70 p-2 rounded border border-slate-800 space-y-0.5 text-[11px]">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="font-mono text-blue-400 font-semibold">#{idx + 1} &lt;{m.tag}&gt;</span>
                              <span className="text-slate-400">
                                Clickable: <strong className={m.nearestClickableTag ? 'text-emerald-400' : 'text-slate-500'}>{m.nearestClickableTag || 'None'}</strong>
                                {m.nearestClickableRole ? ` (role="${m.nearestClickableRole}")` : ''}
                              </span>
                            </div>
                            {m.nearestClickableHref && (
                              <div className="font-mono text-emerald-300 truncate">
                                Clickable href: <span className="underline">{m.nearestClickableHref}</span>
                              </div>
                            )}
                            {m.nearestTileAnchorHref && m.nearestTileAnchorHref !== m.nearestClickableHref && (
                              <div className="font-mono text-sky-300 truncate">
                                Tile anchor href: <span className="underline">{m.nearestTileAnchorHref}</span>
                              </div>
                            )}
                            <div className="text-slate-500 truncate text-[10px]">
                              Container: {m.containerDescription}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* First 10 Visible a[href] Elements */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        First {diagnosticResult.domEvidence.first10VisibleAnchors.length} Visible a[href] Elements
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {diagnosticResult.domEvidence.first10VisibleAnchors.map((a, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800 text-[11px]">
                            <span className="font-mono text-slate-300 truncate flex-1">{a.href}</span>
                            <span className="text-slate-400 text-[10px] shrink-0 truncate max-w-xs">{a.text || '<no text>'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Representative Media Tile Outer HTML */}
                    {diagnosticResult.domEvidence.sampleTileOuterHTML && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Code size={13} className="text-slate-400" />
                            Representative Media Tile Outer HTML
                          </span>
                        </div>
                        <pre className="text-[10px] font-mono bg-slate-950 p-2.5 rounded-lg overflow-x-auto text-slate-300 max-h-56 border border-slate-800 whitespace-pre-wrap break-all select-all">
                          {diagnosticResult.domEvidence.sampleTileOuterHTML}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 4: Inspected Reel Tiles — View-Count DOM Evidence */}
                {diagnosticResult.inspectedReels && diagnosticResult.inspectedReels.length > 0 && (
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-4 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                      <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                        <Eye size={16} className="text-emerald-400" />
                        <span>Reel View-Count DOM Diagnostics ({diagnosticResult.inspectedReels.length} Tiles Inspected)</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Live DOM Inspection (Single-Tile Isolated)</span>
                    </div>

                    <div className="space-y-4">
                      {diagnosticResult.inspectedReels.map((reel, idx) => (
                        <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-3">
                          {/* Reel Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs font-bold text-blue-400 shrink-0">Reel #{idx + 1}</span>
                              <span className="font-mono text-slate-200 text-xs truncate">{reel.reelUrl}</span>
                              <a
                                href={reel.reelUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 shrink-0 p-0.5"
                                title="Open Reel"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                reel.isPinned ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {reel.isPinned ? 'Pinned (Excluded)' : 'Not Pinned'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                reel.hasViewCountText
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                              }`}>
                                {reel.hasViewCountText ? 'Candidate Numbers Found' : 'No View Text in DOM'}
                              </span>
                            </div>
                          </div>

                          {/* Extracted View Count Card */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded border border-emerald-500/30 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Extracted View Count</span>
                              <span className="font-mono font-bold text-sm text-emerald-400">
                                {typeof reel.viewCount === 'number' ? reel.viewCount.toLocaleString() : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Raw View Text</span>
                              <span className="font-mono text-slate-200">
                                {reel.rawViewText ? `"${reel.rawViewText}"` : 'None'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">View Icon Status & Location</span>
                              <span className="font-mono text-slate-300">
                                {reel.viewIconFound ? `Found (${reel.viewIconLocation || 'in-anchor'})` : 'Icon not found'}
                              </span>
                            </div>
                          </div>

                          {/* Candidate Numbers & View Count Strings */}
                          <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                              Candidate Numbers / View-Count Strings
                            </span>
                            {reel.candidateNumbers.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {reel.candidateNumbers.map((num, nIdx) => (
                                  <span key={nIdx} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded font-mono text-[11px] font-bold">
                                    {num}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Zero numbers, K/M/B counts, or 'views'/'plays' found inside anchor or its isolated tile container.
                              </span>
                            )}
                          </div>

                          {/* Anchor Text & Tile Text */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Anchor Text (&lt;a&gt;)
                              </span>
                              <span className="font-mono text-slate-200 block truncate">
                                {reel.anchorText || '<Empty direct text>'}
                              </span>
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Tile Container Text (&lt;{reel.tileContainerTag}&gt;)
                              </span>
                              <span className="font-mono text-slate-200 block truncate">
                                {reel.tileContainerText || '<Empty direct text>'}
                              </span>
                            </div>
                          </div>

                          {/* Accessible Labels & Title Attributes */}
                          {reel.accessibleLabels.length > 0 && (
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800 text-[11px]">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                Accessible Attributes (aria-label, title, alt)
                              </span>
                              <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
                                {reel.accessibleLabels.map((lbl, lIdx) => (
                                  <div key={lIdx} className="font-mono text-[10px] text-slate-300 truncate">
                                    <span className="text-blue-400">&lt;{lbl.tag}&gt;</span> <span className="text-slate-400">{lbl.attr}=</span>
                                    <span className="text-amber-300 font-semibold">"{lbl.value}"</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Descendants Inside Anchor */}
                          {reel.descendantTexts.length > 0 && (
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800 text-[11px]">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                Nested Descendants inside &lt;a&gt; ({reel.descendantTexts.length} elements with text/aria)
                              </span>
                              <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                                {reel.descendantTexts.map((desc, dIdx) => (
                                  <div key={dIdx} className="font-mono text-[10px] text-slate-300 flex items-center gap-1.5 truncate">
                                    <span className="text-purple-400 shrink-0">&lt;{desc.tag}&gt;</span>
                                    {desc.text && <span className="text-slate-200 truncate">"{desc.text}"</span>}
                                    {desc.aria && <span className="text-amber-300 shrink-0">[aria: "{desc.aria}"]</span>}
                                    {desc.role && <span className="text-slate-500 shrink-0">[role: "{desc.role}"]</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tile Extra Descendants outside <a> */}
                          {reel.tileExtraDescendants.length > 0 && (
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800 text-[11px]">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                Tile Container Elements (outside &lt;a&gt;)
                              </span>
                              <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                                {reel.tileExtraDescendants.map((desc, dIdx) => (
                                  <div key={dIdx} className="font-mono text-[10px] text-slate-300 flex items-center gap-1.5 truncate">
                                    <span className="text-indigo-400 shrink-0">&lt;{desc.tag}&gt;</span>
                                    {desc.text && <span className="text-slate-200 truncate">"{desc.text}"</span>}
                                    {desc.aria && <span className="text-amber-300 shrink-0">[aria: "{desc.aria}"]</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Outer HTML Preview */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Anchor Outer HTML (truncated)
                            </span>
                            <pre className="text-[10px] font-mono bg-slate-950 p-2 rounded overflow-x-auto text-slate-300 max-h-36 border border-slate-800/80 whitespace-pre-wrap break-all select-all">
                              {reel.anchorOuterHTML}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!currentJob && (
          <div className="bg-[#171F2B] p-6 sm:p-8 rounded-xl border border-[#293548] shadow-sm">
            {isParsing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-[#293548] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
                <p className="text-[#F1F5F9] font-medium text-sm">Parsing Excel file...</p>
              </div>
            ) : (
              <RnDUploadArea onFileSelect={handleFileSelect} />
            )}

            {parseError && (
              <div className="mt-4 p-3.5 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {currentJob && (
          <div className="flex flex-col gap-5">
            {/* 3 & 4. Input File Card (with Replace File, Run Reel Diagnostic, Start Research) & Validation Summary Cards */}
            <RnDInputFileSummary
              job={currentJob}
              onReplaceFile={handleReplaceFile}
              onStartResearch={handleStartResearch}
              onRunDiagnostic={() => {
                const firstReady = currentJob?.profiles.find(p => p.validationStatus !== 'invalid');
                if (firstReady) {
                  handleRunDiagnostic(firstReady.username);
                } else {
                  handleOpenDiagModal();
                }
              }}
              isEngineConnected={isEngineConnected}
              isDiagnosing={isDiagnosing}
              isBatchRunning={isBatchRunning}
            />
            {researchMessage && (
              <div className="p-3.5 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg text-[#3B82F6] text-xs flex items-center justify-center font-medium animate-fade-in">
                {researchMessage}
              </div>
            )}

            {/* 1. New Research Run / Batch Progress Banner */}
            {batchProgress && (
              <div className="bg-[#171F2B] p-5 sm:p-6 rounded-xl border border-[#293548] shadow-sm flex flex-col gap-5 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#293548] pb-4">
                  <div className="flex items-center gap-3.5">
                    {isBatchRunning ? (
                      <div className="p-2.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-xl border border-[#3B82F6]/20 shrink-0">
                        <Loader2 size={20} className="animate-spin" />
                      </div>
                    ) : (
                      <div className="p-2.5 bg-[#10B981]/10 text-[#10B981] rounded-xl border border-[#10B981]/20 shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-bold text-[#F1F5F9]">
                          {isBatchRunning ? 'Batch Research in Progress' : 'Batch Research Complete'}
                        </h3>
                        <span className="text-xs font-mono font-semibold text-[#94A3B8] bg-[#111827] px-2.5 py-0.5 rounded-md border border-[#293548]">
                          {batchProgress.currentIndex} / {batchProgress.totalEligible}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        {isBatchRunning ? (
                          <span>Currently researching: <strong className="text-[#3B82F6] font-mono">{batchProgress.currentProfileCode}</strong> (@{batchProgress.currentUsername})</span>
                        ) : (
                          <span>Finished processing all {batchProgress.totalEligible} eligible profile{batchProgress.totalEligible !== 1 ? 's' : ''}.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                    {isBatchRunning && (
                      <>
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          className="px-2.5 py-1.5 bg-[#111827] hover:bg-[#1A2332] text-[#94A3B8] hover:text-[#F59E0B] border border-[#293548] rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          title={isUserPaused || isResearchPaused ? 'Resume Batch' : 'Pause Batch'}
                        >
                          {isUserPaused || isResearchPaused ? <Play size={12} /> : <Pause size={12} />}
                          <span>{isUserPaused || isResearchPaused ? 'Resume' : 'Pause'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStopSession}
                          className="px-2.5 py-1.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          title="Explicitly stop active R&D session"
                        >
                          <Square size={11} />
                          <span>Stop Session</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenMiniPlayer}
                      className="px-2.5 py-1.5 bg-[#111827] hover:bg-[#1A2332] text-[#94A3B8] hover:text-[#3B82F6] border border-[#293548] rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Show Global Mini Player"
                    >
                      <ExternalLink size={12} />
                      <span>Mini Player</span>
                    </button>
                    <div className="flex items-center gap-2 bg-[#111827] px-3 py-1.5 rounded-lg border border-[#293548]">
                      <span className="text-xs text-[#64748B] font-medium">Progress:</span>
                      <span className="text-xs font-bold text-[#F1F5F9] font-mono">
                        {Math.round((((batchProgress.completedCount + batchProgress.partialCount + batchProgress.failedCount) / batchProgress.totalEligible) * 100))}%
                      </span>
                    </div>
                  </div>
                </div>

                {isBatchRunning && (isResearchPaused || isUserPaused) && (
                  <div className="p-3.5 bg-[#F59E0B]/15 border border-[#F59E0B]/40 rounded-xl text-[#F59E0B] text-xs flex items-start gap-2.5 animate-pulse">
                    <Pause size={16} className="mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold">Research Paused</span>
                      <span className="text-[#FDE68A]">
                        {researchState?.statusText || 'Paused — Instagram Companion window appears to be covered. Bring it to the front to continue.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress Bar & Sub-indicators */}
                <div className="space-y-1.5">
                  <div className="w-full bg-[#111827] rounded-full h-2.5 overflow-hidden border border-[#293548]">
                    <div
                      className="bg-[#3B82F6] h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.min(100, Math.round((((batchProgress.completedCount + batchProgress.partialCount + batchProgress.failedCount) / batchProgress.totalEligible) * 100)))}%`
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                    <span>Processed {batchProgress.completedCount + batchProgress.partialCount + batchProgress.failedCount} of {batchProgress.totalEligible}</span>
                    <span>{Math.round((((batchProgress.completedCount + batchProgress.partialCount + batchProgress.failedCount) / batchProgress.totalEligible) * 100))}% completed</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-[#111827] p-3.5 rounded-xl border border-[#10B981]/25 hover:border-[#10B981]/40 transition-colors flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Completed</span>
                      <span className="text-xl font-bold font-mono text-[#10B981]">{batchProgress.completedCount}</span>
                    </div>
                    <CheckCircle2 size={18} className="text-[#10B981]/60 shrink-0" />
                  </div>

                  <div className="bg-[#111827] p-3.5 rounded-xl border border-[#F59E0B]/25 hover:border-[#F59E0B]/40 transition-colors flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Partial</span>
                      <span className="text-xl font-bold font-mono text-[#F59E0B]">{batchProgress.partialCount}</span>
                    </div>
                    <AlertTriangle size={18} className="text-[#F59E0B]/60 shrink-0" />
                  </div>

                  <div className="bg-[#111827] p-3.5 rounded-xl border border-[#EF4444]/25 hover:border-[#EF4444]/40 transition-colors flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Failed</span>
                      <span className="text-xl font-bold font-mono text-[#EF4444]">{batchProgress.failedCount}</span>
                    </div>
                    <XCircle size={18} className="text-[#EF4444]/60 shrink-0" />
                  </div>

                  <div className="bg-[#111827] p-3.5 rounded-xl border border-[#293548] hover:border-[#3B82F6]/30 transition-colors flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Remaining</span>
                      <span className="text-xl font-bold font-mono text-[#F1F5F9]">
                        {Math.max(0, batchProgress.totalEligible - (batchProgress.completedCount + batchProgress.partialCount + batchProgress.failedCount))}
                      </span>
                    </div>
                    <Clock size={18} className="text-[#64748B] shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* View Profiles & Analytics Section */}
            <div id="rnd-analytics-section" className="contents" />
            {currentJob && (Object.keys(researchResults).length > 0 || isBatchRunning) && (
              <RnDViewProfiles
                profiles={currentJob.profiles}
                researchResults={researchResults}
                selectedProfileCode={selectedProfileCode || researchState?.profileCode || null}
                onSelectProfile={(code) => setSelectedProfileCode(code)}
                currentRunningCode={isBatchRunning ? batchProgress?.currentProfileCode : undefined}
              />
            )}

            {/* 2. Research Details / Selected Influencer Result Card */}
            {activeCardData && (
              <div className="bg-[#171F2B] p-5 sm:p-6 rounded-xl border border-[#293548] shadow-sm flex flex-col gap-5 animate-fade-in">
                {/* Header: Selected Influencer Code, Username, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#293548] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-lg text-sm font-bold font-mono bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 shrink-0">
                      {activeCardData.profileCode}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#F1F5F9]">@{activeCardData.username}</h3>
                        <a
                          href={`https://www.instagram.com/${activeCardData.username}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#64748B] hover:text-[#3B82F6] transition-colors"
                          title="View on Instagram"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Research Details & Reel Metrics
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {activeCardData.isComplete ? (
                      activeCardData.error ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/25 text-[#EF4444] text-xs font-semibold">
                          <XCircle size={14} />
                          <span>Failed</span>
                        </div>
                      ) : (typeof activeCardData.validViewCountsCount === 'number' && activeCardData.validViewCountsCount < 15) ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] text-xs font-semibold">
                          <AlertTriangle size={14} />
                          <span>Partial ({activeCardData.validViewCountsCount}/15)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 text-[#10B981] text-xs font-semibold">
                          <CheckCircle2 size={14} />
                          <span>Completed</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/25 text-[#3B82F6] text-xs font-medium">
                        <Loader2 size={14} className="animate-spin" />
                        <span>{activeCardData.statusText}</span>
                      </div>
                    )}
                  </div>
                </div>

                {activeCardData.isComplete && !activeCardData.error && (
                  <div className="flex flex-col gap-4">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <div className="bg-[#111827] p-3 rounded-lg border border-[#293548] flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Followers</span>
                        <span className="text-sm sm:text-base font-bold font-mono text-[#F1F5F9] truncate">
                          {activeCardData.followerDisplay || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-lg border border-[#293548] flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Discovered</span>
                        <span className="text-sm sm:text-base font-bold font-mono text-[#F1F5F9]">
                          {activeCardData.reelsDiscovered ?? '—'}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-lg border border-[#293548] flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Pinned Excluded</span>
                        <span className="text-sm sm:text-base font-bold font-mono text-[#94A3B8]">
                          {activeCardData.pinnedReelsExcluded ?? '—'}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-lg border border-[#293548] flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Non-Pinned</span>
                        <span className="text-sm sm:text-base font-bold font-mono text-[#F1F5F9]">
                          {activeCardData.selectedReelCount !== null ? `${activeCardData.selectedReelCount} / 15` : '—'}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-lg border border-[#293548] flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Valid Views</span>
                        <span className={`text-sm sm:text-base font-bold font-mono ${activeCardData.missingViewCountsCount ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                          {typeof activeCardData.validViewCountsCount === 'number' ? `${activeCardData.validViewCountsCount} / 15` : '—'}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-lg border border-[#293548] flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Avg Views</span>
                        <span className="text-sm sm:text-base font-bold font-mono text-[#10B981] truncate">
                          {typeof activeCardData.averageViews === 'number' ? activeCardData.averageViews.toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Category & Qualifying Rule Banner */}
                    {activeCardData.category && (
                      <div className="bg-[#111827] p-3.5 rounded-xl border border-[#293548] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="px-3 py-1 rounded-md text-xs font-bold font-mono bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30">
                            {activeCardData.category}
                          </span>
                          {(() => {
                            const ratio = getCategoryQualifyingInfo(
                              activeCardData.category,
                              activeCardData.rawViewCounts,
                              activeCardData.selectedReels,
                              !!activeCardData.error || activeCardData.statusText === 'Failed'
                            );
                            if (!ratio) return null;
                            return (
                              <span className="text-xs font-semibold text-[#F1F5F9] font-mono">
                                · {ratio}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                          <Info size={13} className="text-[#64748B] shrink-0" />
                          <span>≥7 non-pinned Reels threshold rule · outliers alone do not qualify higher tiers</span>
                        </div>
                      </div>
                    )}

                    {/* Selected Reels List */}
                    {activeCardData.selectedReels && activeCardData.selectedReels.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#94A3B8] uppercase tracking-wider">
                            Selected Reels & Extracted View Counts ({activeCardData.selectedReels.length})
                          </span>
                          <span className="text-[#64748B] text-[11px] font-mono">Max 15 non-pinned</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar">
                          {activeCardData.selectedReels.map((reel, rIdx) => (
                            <div
                              key={rIdx}
                              className="flex items-center justify-between gap-3 text-xs bg-[#111827] px-3.5 py-2 rounded-lg border border-[#293548] hover:border-[#3B82F6]/30 transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-[#64748B] font-mono text-[10px] w-5 shrink-0">#{reel.discoveryIndex}</span>
                                <span className="font-mono text-[#F1F5F9] truncate max-w-[200px] sm:max-w-md">{reel.reelUrl}</span>
                                <a
                                  href={reel.reelUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#64748B] hover:text-[#3B82F6] shrink-0 transition-colors"
                                  title="Open Reel"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {reel.rawViewText && (
                                  <span className="text-[10px] text-[#94A3B8] font-mono">({reel.rawViewText})</span>
                                )}
                                <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs border ${
                                  typeof reel.viewCount === 'number'
                                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                                    : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                                }`}>
                                  {typeof reel.viewCount === 'number' ? reel.viewCount.toLocaleString() : 'Missing View'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Diagnostic Evidence (Secondary Accordion / Panel) */}
                    {(activeCardData.finalUrl || activeCardData.pageReadiness || activeCardData.failureStage) && (
                      <details className="group rounded-xl border border-[#293548] bg-[#111827]/60 overflow-hidden text-xs">
                        <summary className="px-3.5 py-2.5 cursor-pointer flex items-center justify-between text-[#94A3B8] hover:text-[#F1F5F9] transition-colors select-none">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                            Diagnostic & Verification Evidence
                          </span>
                          <span className="text-[10px] font-mono text-[#64748B] group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-3.5 pt-0 border-t border-[#293548]/40 space-y-2 mt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-[#141A22] p-3 rounded-lg border border-[#293548]">
                            {activeCardData.finalUrl && (
                              <div className="truncate sm:col-span-2">
                                <span className="text-[#64748B]">Final URL:</span> <code className="text-[#F1F5F9] font-mono text-[10px] ml-1">{activeCardData.finalUrl}</code>
                              </div>
                            )}
                            <div>
                              <span className="text-[#64748B]">Page Readiness:</span> <strong className="text-[#F1F5F9] font-mono ml-1">{activeCardData.pageReadiness || 'complete'}</strong>
                            </div>
                            <div>
                              <span className="text-[#64748B]">Initial Reel Anchors:</span> <strong className="text-[#F1F5F9] font-mono ml-1">{activeCardData.reelAnchorsAtStart ?? 0}</strong>
                            </div>
                            {activeCardData.failureStage && (
                              <div className="sm:col-span-2">
                                <span className="text-[#64748B]">Stage:</span> <span className="text-[#F59E0B] font-mono font-medium ml-1">{activeCardData.failureStage}</span>
                              </div>
                            )}
                            {activeCardData.failureReason && (
                              <div className="sm:col-span-2 text-[#94A3B8]">
                                <span className="text-[#64748B]">Details:</span> {activeCardData.failureReason}
                              </div>
                            )}
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {activeCardData.error && (
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/25 p-4 rounded-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#EF4444] uppercase tracking-wider">
                        <XCircle size={14} />
                        <span>Research Failure Details</span>
                      </div>
                      {activeCardData.failureStage && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                          Stage: {activeCardData.failureStage}
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm text-[#EF4444] font-medium">{activeCardData.error}</span>
                    {activeCardData.finalUrl && (
                      <div className="text-xs text-[#94A3B8] pt-2 border-t border-[#EF4444]/20 truncate">
                        <span className="text-[#64748B]">Attempted URL:</span> <code className="font-mono text-[#F1F5F9] text-[10px] ml-1">{activeCardData.finalUrl}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 9. Profile Queue Table */}
            <RnDPreviewTable
              job={currentJob}
              researchResults={researchResults}
              onSelectProfile={(profile) => setSelectedProfileCode(profile.influencerCode)}
              selectedProfileCode={selectedProfileCode}
            />
          </div>
        )}
      </div>

      {/* Phase 1 Diagnostic Username Modal */}
      {isDiagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#171F2B] border border-[#293548] w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#293548] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded-lg">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F1F5F9]">Run Reel Diagnostic</h3>
                  <p className="text-xs text-[#94A3B8]">Phase 1: Handshake &amp; a[href*="/reel/"] discovery</p>
                </div>
              </div>
              <button
                onClick={() => setIsDiagModalOpen(false)}
                className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] rounded-lg hover:bg-[#1D2736]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Instagram Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] font-semibold text-sm">@</span>
                <input
                  type="text"
                  placeholder="e.g. zomato or influencer handle"
                  value={manualUsernameInput}
                  onChange={(e) => setManualUsernameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunDiagnostic(manualUsernameInput);
                  }}
                  className="w-full bg-[#111827] border border-[#293548] rounded-xl pl-8 pr-4 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] transition-colors"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                Will test Instagram tab selection, script injection handshake (PING/PONG), navigation completion, and passive DOM snapshot for Reel anchors without scrolling or view-count extraction.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsDiagModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] bg-[#171F2B] hover:bg-[#1D2736] rounded-xl border border-[#293548] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRunDiagnostic(manualUsernameInput)}
                disabled={!manualUsernameInput.trim() || isDiagnosing}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/20"
              >
                <Activity size={14} />
                <span>Run Diagnostic</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
