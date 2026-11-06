import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Pause, UserSearch } from 'lucide-react';
import { rndExtensionService } from '../services/rndExtensionService';
import { ExtensionConnectionState, InstagramSessionState, DiagnosticResult } from '../types/extensionTypes';
import { ResearchJob, DiscoveredReel, ProfileResearchResult } from '../types/rndTypes';
import { RnDMiniPlayer, setupMiniWindowDocument } from '../components/RnDMiniPlayer';
import { parseInfluencerExcel } from '../utils/excelParser';
import { categorize, extractValidViewsFromResult } from '../utils/rndExportService';

export interface RnDBatchProgress {
  currentIndex: number;
  totalEligible: number;
  currentProfileCode: string;
  currentUsername: string;
  completedCount: number;
  partialCount: number;
  failedCount: number;
}

export interface RnDResearchLiveState {
  profileCode: string;
  username: string;
  statusText: string;
  followerDisplay: string | null;
  reelsDiscovered: number | null;
  pinnedReelsExcluded: number | null;
  selectedReelCount: number | null;
  validViewCountsCount?: number | null;
  averageViews?: number | null;
  rawViewCounts?: number[] | null;
  selectedReels?: DiscoveredReel[] | null;
  missingViewCountsCount?: number | null;
  category?: string | null;
  isComplete: boolean;
  error: string | null;
  finalUrl?: string;
  navigationSuccess?: boolean;
  pageReadiness?: string;
  reelAnchorsAtStart?: number;
  failureStage?: string | null;
  failureReason?: string | null;
}

export interface MiniPlayerPosition {
  x: number;
  y: number;
}

export interface MiniPlayerDimensions {
  width: number;
  height: number;
}

export interface RnDContextValue {
  // Connection state
  extState: ExtensionConnectionState;
  igState: InstagramSessionState;
  extVersion: string | undefined;
  isEngineConnected: boolean;
  handleManualCheck: () => void;
  handleOpenInstagram: () => void;

  // Job & batch research state
  currentJob: ResearchJob | null;
  setCurrentJob: React.Dispatch<React.SetStateAction<ResearchJob | null>>;
  isParsing: boolean;
  parseError: string | null;
  researchMessage: string | null;
  isBatchRunning: boolean;
  isResearchPaused: boolean;
  isUserPaused: boolean;
  selectedProfileCode: string | null;
  setSelectedProfileCode: React.Dispatch<React.SetStateAction<string | null>>;
  researchResults: Record<string, ProfileResearchResult>;
  batchProgress: RnDBatchProgress | null;
  researchState: RnDResearchLiveState | null;
  failedProfilesCount: number;

  // Actions
  handleFileSelect: (file: File) => Promise<void>;
  handleReplaceFile: () => void;
  handleStartResearch: (options?: { retryOnlyFailed?: boolean }) => Promise<void>;
  handleRetryFailed: () => void;
  handleTogglePause: () => void;
  handleStopSession: () => Promise<void>;

  // Phase 1 Diagnostics
  diagnosticResult: DiagnosticResult | null;
  setDiagnosticResult: React.Dispatch<React.SetStateAction<DiagnosticResult | null>>;
  isDiagnosing: boolean;
  diagTargetUser: string;
  isDiagModalOpen: boolean;
  setIsDiagModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  manualUsernameInput: string;
  setManualUsernameInput: React.Dispatch<React.SetStateAction<string>>;
  handleOpenDiagModal: () => void;
  handleRunDiagnostic: (usernameToTest?: string) => Promise<void>;

  // Global MiniPlayer state & controls
  isMiniPlayerOpen: boolean;
  isMiniPlayerMinimized: boolean;
  isMiniPlayerExpanded: boolean;
  isPipOpen: boolean;
  isPipActive: boolean;
  miniPlayerPosition: MiniPlayerPosition | null;
  miniPlayerDimensions: MiniPlayerDimensions;
  setMiniPlayerPosition: React.Dispatch<React.SetStateAction<MiniPlayerPosition | null>>;
  setMiniPlayerDimensions: React.Dispatch<React.SetStateAction<MiniPlayerDimensions>>;
  handleOpenMiniPlayer: () => void;
  handleCloseMiniPlayer: () => void;
  handleToggleMinimize: () => void;
  handleToggleExpand: () => void;
  handleOpenPipWindow: () => Promise<void>;
  miniPlayerWindowRef: React.MutableRefObject<Window | null>;
}

const RnDContext = createContext<RnDContextValue | null>(null);

const MINI_PLAYER_POS_KEY = 'velmora_rnd_miniplayer_pos';
const MINI_PLAYER_DIM_KEY = 'velmora_rnd_miniplayer_dim';
const MINI_PLAYER_OPEN_KEY = 'velmora_rnd_miniplayer_open';
const MINI_PLAYER_MIN_KEY = 'velmora_rnd_miniplayer_minimized';
const MINI_PLAYER_EXP_KEY = 'velmora_rnd_miniplayer_expanded';

export const DEFAULT_MINI_PLAYER_DIMENSIONS: MiniPlayerDimensions = {
  width: 360,
  height: 470,
};

export const EXPANDED_MINI_PLAYER_DIMENSIONS: MiniPlayerDimensions = {
  width: 390,
  height: 560,
};

export const RnDProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [extState, setExtState] = useState<ExtensionConnectionState>('CONNECTING');
  const [igState, setIgState] = useState<InstagramSessionState>('CHECKING');
  const [extVersion, setExtVersion] = useState<string | undefined>();

  const [currentJob, setCurrentJob] = useState<ResearchJob | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [researchMessage, setResearchMessage] = useState<string | null>(null);

  // Batch Research states
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [isResearchPaused, setIsResearchPaused] = useState<boolean>(false);
  const [isUserPaused, setIsUserPaused] = useState<boolean>(false);
  const [selectedProfileCode, setSelectedProfileCode] = useState<string | null>(null);
  const [researchResults, setResearchResults] = useState<Record<string, ProfileResearchResult>>({});
  const [batchProgress, setBatchProgress] = useState<RnDBatchProgress | null>(null);
  const [researchState, setResearchState] = useState<RnDResearchLiveState | null>(null);

  // Refs for asynchronous batch control across route changes
  const isUserPausedRef = useRef<boolean>(false);
  const userPauseResolversRef = useRef<Array<() => void>>([]);
  const stopRequestedRef = useRef<boolean>(false);

  // Global MiniPlayer states (preserved across all department navigations)
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(MINI_PLAYER_OPEN_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isMiniPlayerMinimized, setIsMiniPlayerMinimized] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(MINI_PLAYER_MIN_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isMiniPlayerExpanded, setIsMiniPlayerExpanded] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(MINI_PLAYER_EXP_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [miniPlayerPosition, setMiniPlayerPosition] = useState<MiniPlayerPosition | null>(() => {
    try {
      const saved = sessionStorage.getItem(MINI_PLAYER_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [miniPlayerDimensions, setMiniPlayerDimensions] = useState<MiniPlayerDimensions>(() => {
    try {
      const saved = sessionStorage.getItem(MINI_PLAYER_DIM_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.width === 'number' && typeof parsed?.height === 'number') {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_MINI_PLAYER_DIMENSIONS;
  });

  // Optional Document PiP / Popup Window states
  const [isPipOpen, setIsPipOpen] = useState<boolean>(false);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const miniPlayerWindowRef = useRef<Window | null>(null);

  // Phase 1 Diagnostic states
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagTargetUser, setDiagTargetUser] = useState<string>('');
  const [isDiagModalOpen, setIsDiagModalOpen] = useState(false);
  const [manualUsernameInput, setManualUsernameInput] = useState('');

  // Restore persisted batch session on initial mount (handles full browser reload cleanly)
  useEffect(() => {
    try {
      const savedJob = localStorage.getItem('velmora_rnd_current_job');
      const savedResults = localStorage.getItem('velmora_rnd_results');
      const savedProgress = localStorage.getItem('velmora_rnd_progress');
      const parsedResults: Record<string, ProfileResearchResult> = savedResults ? JSON.parse(savedResults) : {};

      if (savedResults) {
        setResearchResults(parsedResults);
      }

      if (savedJob) {
        const parsedJob: ResearchJob = JSON.parse(savedJob);
        // Normalize any profile that was mid-flight ('running') prior to a full browser page refresh
        let hadInterruptedRunningProfile = false;
        if (Array.isArray(parsedJob.profiles)) {
          parsedJob.profiles = parsedJob.profiles.map(p => {
            if (p.researchStatus === 'running') {
              hadInterruptedRunningProfile = true;
              const existingRes = parsedResults[p.influencerCode];
              if (existingRes) {
                const isPartial = existingRes.status === 'partial' || existingRes.status === 'reels_not_enough' || (existingRes.validViewCountsCount !== undefined && existingRes.validViewCountsCount < 15);
                const isFailed = existingRes.status === 'reels_not_found' || existingRes.status === 'failed';
                return {
                  ...p,
                  researchStatus: isFailed ? 'failed' : isPartial ? 'partial' : 'completed',
                  researchResult: existingRes
                };
              }
              return { ...p, researchStatus: 'pending' };
            }
            return p;
          });
        }
        setCurrentJob(parsedJob);
        if (hadInterruptedRunningProfile) {
          setResearchMessage('Previous batch was interrupted by a browser page reload. Click Retry Failed / Remaining to resume.');
        }
      }

      if (savedProgress) {
        const parsedProgress = JSON.parse(savedProgress);
        setBatchProgress(parsedProgress);
        if (parsedProgress.currentProfileCode) {
          setSelectedProfileCode(parsedProgress.currentProfileCode);
        }
      }
    } catch (e) {
      console.warn('Failed to restore R&D session from localStorage', e);
    }
  }, []);

  // Sync session state to localStorage continuously (even when navigated away from InfluencerRnD)
  useEffect(() => {
    if (currentJob) {
      try {
        localStorage.setItem('velmora_rnd_current_job', JSON.stringify(currentJob));
      } catch {}
    }
  }, [currentJob]);

  useEffect(() => {
    if (researchResults && Object.keys(researchResults).length > 0) {
      try {
        localStorage.setItem('velmora_rnd_results', JSON.stringify(researchResults));
      } catch {}
    }
  }, [researchResults]);

  useEffect(() => {
    if (batchProgress) {
      try {
        localStorage.setItem('velmora_rnd_progress', JSON.stringify(batchProgress));
      } catch {}
    }
  }, [batchProgress]);

  // Persist MiniPlayer UI preferences across route changes and reloads
  useEffect(() => {
    try {
      sessionStorage.setItem(MINI_PLAYER_OPEN_KEY, String(isMiniPlayerOpen));
    } catch {}
  }, [isMiniPlayerOpen]);

  useEffect(() => {
    try {
      sessionStorage.setItem(MINI_PLAYER_MIN_KEY, String(isMiniPlayerMinimized));
    } catch {}
  }, [isMiniPlayerMinimized]);

  useEffect(() => {
    try {
      sessionStorage.setItem(MINI_PLAYER_EXP_KEY, String(isMiniPlayerExpanded));
    } catch {}
  }, [isMiniPlayerExpanded]);

  useEffect(() => {
    if (miniPlayerPosition) {
      try {
        sessionStorage.setItem(MINI_PLAYER_POS_KEY, JSON.stringify(miniPlayerPosition));
      } catch {}
    }
  }, [miniPlayerPosition]);

  useEffect(() => {
    try {
      sessionStorage.setItem(MINI_PLAYER_DIM_KEY, JSON.stringify(miniPlayerDimensions));
    } catch {}
  }, [miniPlayerDimensions]);

  // Clean up PiP/popup window ONLY when the entire application unmounts
  useEffect(() => {
    return () => {
      if (miniPlayerWindowRef.current && !miniPlayerWindowRef.current.closed) {
        try {
          miniPlayerWindowRef.current.close();
        } catch {}
        miniPlayerWindowRef.current = null;
      }
    };
  }, []);

  const checkStatus = useCallback(async (mounted: { current: boolean }) => {
    const status = await rndExtensionService.getExtensionStatus();
    if (!mounted.current) return;

    if (!status.connected) {
      setExtState('NOT_DETECTED');
      setIgState('NOT_AVAILABLE');
      setExtVersion(undefined);
      return;
    }

    setExtState('CONNECTED');
    setExtVersion(status.version);

    const igResult = await rndExtensionService.checkInstagramSession();
    if (!mounted.current) return;

    if (igResult.error) {
      setIgState('NOT_AVAILABLE');
    } else if (igResult.available) {
      if (igResult.session === 'detected') {
        setIgState('SESSION_DETECTED');
      } else {
        setIgState('LOGIN_REQUIRED');
      }
    } else {
      setIgState('NOT_AVAILABLE');
    }
  }, []);

  useEffect(() => {
    const mounted = { current: true };
    checkStatus(mounted);
    const interval = setInterval(() => checkStatus(mounted), 5000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [checkStatus]);

  const handleManualCheck = useCallback(() => {
    setExtState('CONNECTING');
    setIgState('CHECKING');
    checkStatus({ current: true });
  }, [checkStatus]);

  const handleOpenInstagram = useCallback(() => {
    window.open('https://www.instagram.com', '_blank');
  }, []);

  // Global subscription to live Chrome Extension events (persists across all department routes)
  useEffect(() => {
    const unsubscribe = rndExtensionService.onEvent((event) => {
      const type = event.type;
      const textMap: Record<string, string> = {
        'PROFILE_OPENING': 'Opening profile...',
        'PROFILE_VERIFYING': 'Verifying profile...',
        'PROFILE_DATA_FOUND': 'Reading followers...',
        'REELS_PAGE_OPENING': 'Opening Reels (waiting for grid to render)...',
        'REELS_LOADING': event.payload?.extractionMoment?.reelAnchorsCount
          ? `Reels grid rendered (${event.payload.extractionMoment.reelAnchorsCount} reels found)...`
          : 'Loading Reels grid...',
        'REELS_SCROLLING': 'Discovering reels...',
        'REELS_DISCOVERED': `Discovering reels (${event.payload?.discovered || 0} found, ${event.payload?.validViews || 0} views)...`,
        'PINNED_REELS_FILTERED': `Filtering pinned reels (${event.payload?.excluded || 0} excluded)...`,
        'REELS_SELECTION_COMPLETE': `Selected ${event.payload?.selected || 0} reels (avg views: ${(event.payload?.averageViews || 0).toLocaleString()})...`,
        'RESEARCH_RETRYING': 'Not enough valid reel views, retrying...',
      };

      if (type === 'RESEARCH_PAUSED') {
        setIsResearchPaused(true);
        const pauseMsg =
          event.payload?.statusText ||
          (event.payload?.reason === 'occlusion_suspected'
            ? 'Paused — Instagram Companion window appears to be covered. Bring it to the front to continue.'
            : 'Paused — Instagram window inactive');
        setResearchState(prev => (prev ? { ...prev, statusText: pauseMsg, error: null } : null));
        return;
      }

      if (type === 'RESEARCH_RESUMED') {
        setIsResearchPaused(false);
        setResearchState(prev =>
          prev ? { ...prev, statusText: 'Resumed — continuing reel discovery...', error: null } : null
        );
        return;
      }

      if (textMap[type]) {
        setIsResearchPaused(false);
        setResearchState(prev => prev ? { ...prev, statusText: textMap[type], error: null } : null);
      }
    });
    return unsubscribe;
  }, []);

  const releaseUserPauseResolvers = useCallback(() => {
    const resolvers = userPauseResolversRef.current.splice(0);
    resolvers.forEach(resolve => resolve());
  }, []);

  const waitWhileUserPaused = useCallback(async () => {
    while (isUserPausedRef.current && !stopRequestedRef.current) {
      await new Promise<void>(resolve => {
        userPauseResolversRef.current.push(resolve);
      });
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (!isBatchRunning) return;
    if (isUserPausedRef.current) {
      isUserPausedRef.current = false;
      setIsUserPaused(false);
      setResearchState(prev =>
        prev ? { ...prev, statusText: 'Resumed — continuing batch research...', error: null } : null
      );
      releaseUserPauseResolvers();
    } else {
      isUserPausedRef.current = true;
      setIsUserPaused(true);
      setResearchState(prev =>
        prev
          ? {
              ...prev,
              statusText: 'Paused by user — click Resume when ready to continue.',
              error: null
            }
          : null
      );
    }
  }, [isBatchRunning, releaseUserPauseResolvers]);

  const handleStopSession = useCallback(async () => {
    stopRequestedRef.current = true;
    isUserPausedRef.current = false;
    setIsUserPaused(false);
    setIsResearchPaused(false);
    setIsBatchRunning(false);
    releaseUserPauseResolvers();

    await rndExtensionService.cancelResearch();

    setCurrentJob(prev => {
      if (!prev) return prev;
      const profiles = prev.profiles.map(p =>
        p.researchStatus === 'running' ? { ...p, researchStatus: 'pending' as const } : p
      );
      return { ...prev, profiles };
    });

    setResearchState(prev =>
      prev
        ? {
            ...prev,
            statusText: 'Session stopped by user',
            isComplete: true
          }
        : null
    );
  }, [releaseUserPauseResolvers]);

  const handleOpenMiniPlayer = useCallback(() => {
    setIsMiniPlayerOpen(true);
    setIsMiniPlayerMinimized(false);
    if (miniPlayerWindowRef.current && !miniPlayerWindowRef.current.closed) {
      try {
        miniPlayerWindowRef.current.focus();
      } catch {}
    }
  }, []);

  // Hides the MiniPlayer UI WITHOUT stopping the active R&D session
  const handleCloseMiniPlayer = useCallback(() => {
    if (miniPlayerWindowRef.current && !miniPlayerWindowRef.current.closed) {
      try {
        miniPlayerWindowRef.current.close();
      } catch {}
    }
    miniPlayerWindowRef.current = null;
    setIsPipOpen(false);
    setIsMiniPlayerOpen(false);
  }, []);

  const handleToggleMinimize = useCallback(() => {
    setIsMiniPlayerMinimized(prev => !prev);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setIsMiniPlayerExpanded(prev => {
      const next = !prev;
      setMiniPlayerDimensions(next ? EXPANDED_MINI_PLAYER_DIMENSIONS : DEFAULT_MINI_PLAYER_DIMENSIONS);
      return next;
    });
  }, []);

  const handleOpenPipWindow = useCallback(async () => {
    if (miniPlayerWindowRef.current && !miniPlayerWindowRef.current.closed) {
      try {
        miniPlayerWindowRef.current.focus();
      } catch {}
      return;
    }

    let newWin: Window | null = null;
    let isPip = false;

    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      try {
        const pip = (window as any).documentPictureInPicture;
        if (typeof pip?.requestWindow === 'function') {
          newWin = await pip.requestWindow({
            width: 380,
            height: 520
          });
          isPip = true;
        }
      } catch (pipErr) {
        console.warn('Document Picture-in-Picture request failed or denied, using popup fallback:', pipErr);
      }
    }

    if (!newWin && typeof window !== 'undefined') {
      try {
        const left = Math.max(0, (window.screenLeft || window.screenX || 0) + (window.outerWidth || 1024) - 400);
        const top = Math.max(0, (window.screenTop || window.screenY || 0) + 60);
        newWin = window.open(
          '',
          'VelmoraRnDMiniPlayer',
          `width=380,height=520,left=${left},top=${top},resizable=yes,scrollbars=no`
        );
        isPip = false;
      } catch (openErr) {
        console.error('Failed to open popup window for Mini Player:', openErr);
      }
    }

    if (!newWin) {
      return;
    }

    setupMiniWindowDocument(newWin.document);

    const handleClosed = () => {
      setIsPipOpen(false);
      miniPlayerWindowRef.current = null;
    };

    newWin.addEventListener('pagehide', handleClosed);
    newWin.addEventListener('unload', handleClosed);

    miniPlayerWindowRef.current = newWin;
    setIsPipActive(isPip);
    setIsPipOpen(true);
    setIsMiniPlayerOpen(true);
  }, []);

  const handleOpenDiagModal = useCallback(() => {
    const firstReady = currentJob?.profiles.find(p => p.validationStatus !== 'invalid');
    setManualUsernameInput(prev => firstReady?.username || prev || '');
    setIsDiagModalOpen(true);
  }, [currentJob]);

  const handleRunDiagnostic = useCallback(async (usernameToTest?: string) => {
    const user = (usernameToTest || manualUsernameInput).trim().replace(/^@/, '');
    if (!user) {
      handleOpenDiagModal();
      return;
    }
    setIsDiagModalOpen(false);
    setIsDiagnosing(true);
    setDiagTargetUser(user);
    setDiagnosticResult(null);

    const result = await rndExtensionService.runReelDiagnostic(user);
    setDiagnosticResult(result);
    setIsDiagnosing(false);
  }, [manualUsernameInput, handleOpenDiagModal]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setResearchMessage(null);
    setBatchProgress(null);
    setIsBatchRunning(false);
    setIsResearchPaused(false);
    setIsUserPaused(false);
    isUserPausedRef.current = false;
    setResearchResults({});
    setSelectedProfileCode(null);
    setResearchState(null);

    try {
      const job = await parseInfluencerExcel(file);
      setCurrentJob(job);
      try {
        localStorage.removeItem('velmora_rnd_results');
        localStorage.removeItem('velmora_rnd_progress');
      } catch {}
    } catch (err: any) {
      setParseError(err.message || 'An error occurred while parsing the file.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleReplaceFile = useCallback(() => {
    setCurrentJob(null);
    setBatchProgress(null);
    setIsBatchRunning(false);
    setIsResearchPaused(false);
    setIsUserPaused(false);
    isUserPausedRef.current = false;
    setResearchResults({});
    setSelectedProfileCode(null);
    setResearchState(null);
    try {
      localStorage.removeItem('velmora_rnd_current_job');
      localStorage.removeItem('velmora_rnd_results');
      localStorage.removeItem('velmora_rnd_progress');
    } catch {}
  }, []);

  const handleStartResearch = useCallback(async (options?: { retryOnlyFailed?: boolean }) => {
    if (!currentJob || isBatchRunning) return;

    const allEligible = currentJob.profiles.filter(p => p.validationStatus !== 'invalid');
    if (allEligible.length === 0) {
      setResearchMessage('No valid profiles to research.');
      return;
    }

    const targetProfiles = options?.retryOnlyFailed
      ? allEligible.filter(p => p.researchStatus !== 'completed')
      : allEligible;

    if (targetProfiles.length === 0) {
      setResearchMessage('All eligible profiles are already completed.');
      return;
    }

    stopRequestedRef.current = false;
    isUserPausedRef.current = false;
    setIsUserPaused(false);
    setIsBatchRunning(true);
    setIsResearchPaused(false);
    setResearchMessage(null);

    // Ensure the Global Persistent MiniPlayer is visible as soon as an R&D session starts
    setIsMiniPlayerOpen(true);

    let completedCount = options?.retryOnlyFailed
      ? allEligible.filter(p => p.researchStatus === 'completed').length
      : 0;
    let partialCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < targetProfiles.length; i++) {
        if (stopRequestedRef.current) break;
        await waitWhileUserPaused();
        if (stopRequestedRef.current) break;

        const profile = targetProfiles[i];

        setIsResearchPaused(false);
        setSelectedProfileCode(profile.influencerCode);
        setBatchProgress({
          currentIndex: completedCount + partialCount + failedCount + 1,
          totalEligible: allEligible.length,
          currentProfileCode: profile.influencerCode,
          currentUsername: profile.username,
          completedCount,
          partialCount,
          failedCount
        });

        setResearchState({
          profileCode: profile.influencerCode,
          username: profile.username,
          statusText: 'Starting research...',
          followerDisplay: null,
          reelsDiscovered: null,
          pinnedReelsExcluded: null,
          selectedReelCount: null,
          validViewCountsCount: null,
          averageViews: null,
          rawViewCounts: null,
          selectedReels: null,
          missingViewCountsCount: null,
          isComplete: false,
          error: null
        });

        setCurrentJob(prev => {
          if (!prev) return prev;
          const profiles = prev.profiles.map(p =>
            p.influencerCode === profile.influencerCode ? { ...p, researchStatus: 'running' as const } : p
          );
          return { ...prev, profiles };
        });

        const profileStartTime = Date.now();

        try {
          const result = await rndExtensionService.startProfileResearch(
            currentJob.jobId,
            profile.influencerCode,
            profile.username
          );
          if (stopRequestedRef.current) break;

          setIsResearchPaused(false);

          const isPartial = result.status === 'partial' || result.status === 'reels_not_enough' || (result.validViewCountsCount !== undefined && result.validViewCountsCount < 15);
          const isFailed = result.status === 'reels_not_found' || result.status === 'failed';
          const finalStatus: 'completed' | 'partial' | 'failed' = isFailed ? 'failed' : isPartial ? 'partial' : 'completed';

          if (finalStatus === 'completed') completedCount++;
          else if (finalStatus === 'partial') partialCount++;
          else failedCount++;

          const calculatedCategory =
            result.category ||
            result.creatorCategory ||
            categorize(extractValidViewsFromResult(result));
          const enrichedResult: ProfileResearchResult = {
            ...result,
            category: calculatedCategory,
            creatorCategory: calculatedCategory
          };

          setResearchResults(prev => ({
            ...prev,
            [profile.influencerCode]: enrichedResult
          }));

          setResearchState({
            profileCode: enrichedResult.influencerCode,
            username: enrichedResult.requestedUsername,
            statusText: isFailed
              ? (enrichedResult.error || 'Failed')
              : isPartial
                ? `Partial (${enrichedResult.validViewCountsCount ?? 0}/15 valid view counts)`
                : 'Completed',
            followerDisplay: enrichedResult.followerDisplay,
            reelsDiscovered: enrichedResult.reelsDiscovered || 0,
            pinnedReelsExcluded: enrichedResult.pinnedReelsExcluded || 0,
            selectedReelCount: enrichedResult.selectedReelCount || 0,
            validViewCountsCount: enrichedResult.validViewCountsCount || 0,
            averageViews: enrichedResult.averageViews || 0,
            rawViewCounts: enrichedResult.rawViewCounts || [],
            selectedReels: enrichedResult.selectedReels || [],
            missingViewCountsCount: typeof enrichedResult.missingViewCountsCount === 'number'
              ? enrichedResult.missingViewCountsCount
              : Math.max(0, 15 - (enrichedResult.validViewCountsCount || 0)),
            category: calculatedCategory,
            isComplete: true,
            error: isFailed ? (enrichedResult.error || 'Zero reels were discovered') : null,
            finalUrl: enrichedResult.finalUrl,
            navigationSuccess: enrichedResult.navigationSuccess,
            pageReadiness: enrichedResult.pageReadiness,
            reelAnchorsAtStart: enrichedResult.reelAnchorsAtStart,
            failureStage: enrichedResult.failureStage,
            failureReason: enrichedResult.failureReason
          });

          setCurrentJob(prev => {
            if (!prev) return prev;
            const profiles = prev.profiles.map(p =>
              p.influencerCode === profile.influencerCode
                ? {
                    ...p,
                    category: calculatedCategory,
                    creatorCategory: calculatedCategory,
                    researchStatus: finalStatus,
                    researchResult: enrichedResult
                  }
                : p
            );
            return { ...prev, profiles };
          });

        } catch (profileErr: any) {
          setIsResearchPaused(false);
          if (stopRequestedRef.current || profileErr?.message === 'RESEARCH_STOPPED_BY_USER') {
            break;
          }

          failedCount++;
          const errorMsg = profileErr?.message || 'An error occurred during research.';
          const failedResult: ProfileResearchResult = {
            jobId: currentJob.jobId,
            influencerCode: profile.influencerCode,
            requestedUsername: profile.username,
            verifiedUsername: profile.username,
            followerDisplay: null,
            followerCount: 0,
            status: 'failed',
            error: errorMsg,
            startedAt: profileStartTime,
            completedAt: Date.now()
          };

          setResearchResults(prev => ({
            ...prev,
            [profile.influencerCode]: failedResult
          }));

          setResearchState({
            profileCode: profile.influencerCode,
            username: profile.username,
            statusText: 'Failed',
            followerDisplay: null,
            reelsDiscovered: null,
            pinnedReelsExcluded: null,
            selectedReelCount: null,
            validViewCountsCount: null,
            averageViews: null,
            rawViewCounts: null,
            selectedReels: null,
            missingViewCountsCount: null,
            isComplete: true,
            error: errorMsg
          });

          setCurrentJob(prev => {
            if (!prev) return prev;
            const profiles = prev.profiles.map(p =>
              p.influencerCode === profile.influencerCode
                ? { ...p, researchStatus: 'failed' as const, researchResult: failedResult }
                : p
            );
            return { ...prev, profiles };
          });
        }

        if (stopRequestedRef.current) break;

        setBatchProgress({
          currentIndex: Math.min(allEligible.length, completedCount + partialCount + failedCount),
          totalEligible: allEligible.length,
          currentProfileCode: profile.influencerCode,
          currentUsername: profile.username,
          completedCount,
          partialCount,
          failedCount
        });

        if (i < targetProfiles.length - 1 && !stopRequestedRef.current) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } finally {
      setIsBatchRunning(false);
      setIsResearchPaused(false);
      setIsUserPaused(false);
      isUserPausedRef.current = false;
    }
  }, [currentJob, isBatchRunning, waitWhileUserPaused]);

  const handleRetryFailed = useCallback(() => {
    handleStartResearch({ retryOnlyFailed: true });
  }, [handleStartResearch]);

  const failedProfilesCount = useMemo(() => {
    if (!currentJob) return 0;
    const hasAnyRun = currentJob.profiles.some(p => p.researchStatus && p.researchStatus !== 'pending');
    if (!hasAnyRun && !batchProgress) return 0;
    return currentJob.profiles.filter(p => p.validationStatus !== 'invalid' && p.researchStatus !== 'completed').length;
  }, [currentJob, batchProgress]);

  const isEngineConnected = extState === 'CONNECTED' && igState === 'SESSION_DETECTED';

  const contextValue = useMemo<RnDContextValue>(() => ({
    extState,
    igState,
    extVersion,
    isEngineConnected,
    handleManualCheck,
    handleOpenInstagram,
    currentJob,
    setCurrentJob,
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
    failedProfilesCount,
    handleFileSelect,
    handleReplaceFile,
    handleStartResearch,
    handleRetryFailed,
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
    isMiniPlayerMinimized,
    isMiniPlayerExpanded,
    isPipOpen,
    isPipActive,
    miniPlayerPosition,
    miniPlayerDimensions,
    setMiniPlayerPosition,
    setMiniPlayerDimensions,
    handleOpenMiniPlayer,
    handleCloseMiniPlayer,
    handleToggleMinimize,
    handleToggleExpand,
    handleOpenPipWindow,
    miniPlayerWindowRef
  }), [
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
    researchResults,
    batchProgress,
    researchState,
    failedProfilesCount,
    handleFileSelect,
    handleReplaceFile,
    handleStartResearch,
    handleRetryFailed,
    handleTogglePause,
    handleStopSession,
    diagnosticResult,
    isDiagnosing,
    diagTargetUser,
    isDiagModalOpen,
    manualUsernameInput,
    handleOpenDiagModal,
    handleRunDiagnostic,
    isMiniPlayerOpen,
    isMiniPlayerMinimized,
    isMiniPlayerExpanded,
    isPipOpen,
    isPipActive,
    miniPlayerPosition,
    miniPlayerDimensions,
    handleOpenMiniPlayer,
    handleCloseMiniPlayer,
    handleToggleMinimize,
    handleToggleExpand,
    handleOpenPipWindow
  ]);

  return (
    <RnDContext.Provider value={contextValue}>
      {children}
    </RnDContext.Provider>
  );
};

export const useRnDContext = (): RnDContextValue => {
  const ctx = useContext(RnDContext);
  if (!ctx) {
    throw new Error('useRnDContext must be used within an RnDProvider');
  }
  return ctx;
};

/**
 * Global Persistent MiniPlayer Host mounted once inside MainLayout.
 * Remains mounted across all department navigations (/sales, /logistics, /finance, /marketing, etc.),
 * preserving position, dimensions, and live R&D session state.
 */
export const GlobalRnDMiniPlayer: React.FC = () => {
  const {
    isBatchRunning,
    batchProgress,
    researchState,
    isEngineConnected,
    isResearchPaused,
    isUserPaused,
    failedProfilesCount,
    isMiniPlayerOpen,
    isMiniPlayerMinimized,
    isMiniPlayerExpanded,
    isPipOpen,
    isPipActive,
    miniPlayerPosition,
    miniPlayerDimensions,
    setMiniPlayerPosition,
    handleOpenMiniPlayer,
    handleCloseMiniPlayer,
    handleToggleMinimize,
    handleToggleExpand,
    handleTogglePause,
    handleStopSession,
    handleRetryFailed,
    handleOpenPipWindow,
    miniPlayerWindowRef,
  } = useRnDContext();

  const navigate = useNavigate();
  const location = useLocation();
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleFocusOrNavigateToRnD = useCallback(() => {
    try {
      window.focus();
    } catch {}
    const isOnRnDView =
      location.pathname === '/marketing' &&
      new URLSearchParams(location.search).get('tab') === 'influencer-rnd';
    if (!isOnRnDView) {
      navigate('/marketing?tab=influencer-rnd');
    }
  }, [location.pathname, location.search, navigate]);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const startX = miniPlayerPosition?.x ?? (rect ? rect.left : Math.max(16, window.innerWidth - miniPlayerDimensions.width - 24));
    const startY = miniPlayerPosition?.y ?? (rect ? rect.top : Math.max(16, window.innerHeight - miniPlayerDimensions.height - 24));

    dragOffsetRef.current = {
      offsetX: e.clientX - startX,
      offsetY: e.clientY - startY,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!dragOffsetRef.current) return;
      const maxX = Math.max(16, window.innerWidth - 260);
      const maxY = Math.max(16, window.innerHeight - 80);
      const nextX = Math.min(maxX, Math.max(12, Math.round(moveEvt.clientX - dragOffsetRef.current.offsetX)));
      const nextY = Math.min(maxY, Math.max(12, Math.round(moveEvt.clientY - dragOffsetRef.current.offsetY)));
      setMiniPlayerPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragOffsetRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [miniPlayerPosition, miniPlayerDimensions, setMiniPlayerPosition]);

  const floatingStyle: React.CSSProperties = useMemo(() => {
    const width = isMiniPlayerMinimized ? 310 : miniPlayerDimensions.width;
    if (miniPlayerPosition) {
      return {
        position: 'fixed',
        left: `${miniPlayerPosition.x}px`,
        top: `${miniPlayerPosition.y}px`,
        width: `${width}px`,
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 70,
      };
    }
    return {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      width: `${width}px`,
      maxWidth: 'calc(100vw - 24px)',
      zIndex: 70,
    };
  }, [miniPlayerPosition, miniPlayerDimensions, isMiniPlayerMinimized]);

  const effectivePaused = Boolean(isResearchPaused || isUserPaused);

  return (
    <>
      {/* In-App Global Persistent Floating MiniPlayer */}
      {isMiniPlayerOpen && (
        <div
          ref={containerRef}
          style={floatingStyle}
          data-testid="global-rnd-miniplayer"
          className="transition-shadow duration-200"
        >
          <RnDMiniPlayer
            isBatchRunning={isBatchRunning}
            batchProgress={batchProgress}
            researchState={researchState}
            isEngineConnected={isEngineConnected}
            isPipMode={false}
            isFloatingMode={true}
            isPaused={isResearchPaused}
            isUserPaused={isUserPaused}
            isMinimized={isMiniPlayerMinimized}
            isExpanded={isMiniPlayerExpanded}
            onRetryFailed={failedProfilesCount > 0 ? handleRetryFailed : undefined}
            onTogglePause={handleTogglePause}
            onStopSession={handleStopSession}
            onToggleMinimize={handleToggleMinimize}
            onToggleExpand={handleToggleExpand}
            onOpenPipWindow={handleOpenPipWindow}
            onHeaderPointerDown={handleHeaderPointerDown}
            onFocusMainApp={handleFocusOrNavigateToRnD}
            onClose={handleCloseMiniPlayer}
          />
        </div>
      )}

      {/* Unobtrusive Restore Pill if user hid MiniPlayer while an R&D session is still running */}
      {!isMiniPlayerOpen && isBatchRunning && (
        <button
          type="button"
          onClick={handleOpenMiniPlayer}
          data-testid="global-rnd-restore-pill"
          title="Restore Instagram R&D MiniPlayer"
          className="fixed bottom-5 right-5 z-[70] flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#0B111A] hover:bg-[#111827] text-[#F1F5F9] border border-[#3B82F6]/40 shadow-2xl text-xs font-semibold transition-all"
        >
          <div className="p-1 bg-[#3B82F6]/15 text-[#3B82F6] rounded-full">
            <UserSearch size={13} />
          </div>
          {effectivePaused ? (
            <span className="flex items-center gap-1.5 text-[#F59E0B]">
              <Pause size={12} />
              <span>R&amp;D Paused ({batchProgress?.currentIndex || 0}/{batchProgress?.totalEligible || 0})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin text-[#3B82F6]" />
              <span>R&amp;D Active ({batchProgress?.currentIndex || 0}/{batchProgress?.totalEligible || 0})</span>
            </span>
          )}
          <span className="text-[10px] text-[#3B82F6] underline ml-1">Show Player</span>
        </button>
      )}

      {/* Optional Document PiP / Popup Window Portal (also preserved across department navigation) */}
      {isPipOpen && miniPlayerWindowRef.current?.document?.body && createPortal(
        <RnDMiniPlayer
          isBatchRunning={isBatchRunning}
          batchProgress={batchProgress}
          researchState={researchState}
          isEngineConnected={isEngineConnected}
          isPipMode={isPipActive}
          isFloatingMode={false}
          isPaused={isResearchPaused}
          isUserPaused={isUserPaused}
          isExpanded={isMiniPlayerExpanded}
          onRetryFailed={failedProfilesCount > 0 ? handleRetryFailed : undefined}
          onTogglePause={handleTogglePause}
          onStopSession={handleStopSession}
          onToggleExpand={handleToggleExpand}
          onFocusMainApp={handleFocusOrNavigateToRnD}
          onClose={handleCloseMiniPlayer}
        />,
        miniPlayerWindowRef.current.document.body
      )}
    </>
  );
};
