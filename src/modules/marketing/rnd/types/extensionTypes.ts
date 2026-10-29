export const VELMORA_RND_SOURCE = 'VELMORA_RND_WEB';
export const VELMORA_RND_EXTENSION = 'VELMORA_RND_EXTENSION';

export type ExtensionCommandType = 
  | 'PING'
  | 'GET_EXTENSION_STATUS'
  | 'CHECK_INSTAGRAM_LOGIN'
  | 'CHECK_INSTAGRAM_SESSION'
  | 'CHECK_INSTAGRAM_TAB'
  | 'START_RND_JOB'
  | 'PAUSE_RND_JOB'
  | 'RESUME_RND_JOB'
  | 'STOP_RND_JOB'
  | 'GET_STATUS'
  | 'START_PROFILE_RESEARCH'
  | 'DIAGNOSE_REEL_DISCOVERY';

export type ExtensionEventType = 
  | 'PONG'
  | 'EXTENSION_READY'
  | 'INSTAGRAM_STATUS'
  | 'LOGIN_REQUIRED'
  | 'LOGIN_DETECTED'
  | 'SCRAPING_STARTED'
  | 'PROFILE_STARTED'
  | 'PROFILE_OPENING'
  | 'PROFILE_VERIFYING'
  | 'PROFILE_DATA_FOUND'
  | 'REELS_PAGE_OPENING'
  | 'REELS_LOADING'
  | 'REELS_SCROLLING'
  | 'REELS_DISCOVERED'
  | 'PINNED_REELS_FILTERED'
  | 'REELS_SELECTION_COMPLETE'
  | 'REELS_NOT_ENOUGH'
  | 'RESEARCH_RETRYING'
  | 'PROFILE_PROGRESS'
  | 'PROFILE_COMPLETED'
  | 'PROFILE_FAILED'
  | 'JOB_PROGRESS'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'DIAGNOSTIC_COMPLETED';

export type DiagnosticStage =
  | 'communication_failure'
  | 'navigation_failure'
  | 'zero_reels'
  | 'reels_discovered';

export interface DiagnosticVisibleAnchor {
  href: string;
  text: string;
}

export interface DiagnosticVisibleMediaItem {
  tag: string;
  src?: string;
  alt?: string;
  nearestClickableTag?: string | null;
  nearestClickableHref?: string | null;
  nearestClickableRole?: string | null;
  nearestTileAnchorHref?: string | null;
  containerDescription?: string;
}

export interface DiagnosticDomEvidence {
  first10VisibleAnchors: DiagnosticVisibleAnchor[];
  first20VisibleAnchors?: DiagnosticVisibleAnchor[];
  allAnchorsInMain?: DiagnosticVisibleAnchor[];
  mainText?: string;
  pageTitle?: string;
  windowScrollY?: number;
  scrollHeight?: number;
  first10VisibleMedia: DiagnosticVisibleMediaItem[];
  sampleTileOuterHTML?: string;
  totalHrefAnchors: number;
  reelHrefAnchorsCount: number;
  reelsHrefAnchorsCount: number;
  postHrefAnchorsCount: number;
  containerContext: {
    isInMain: boolean;
    isInArticle: boolean;
    isInDialog: boolean;
    parentSummary: string;
  };
  collectionError?: string | null;
}

export interface DiagnosticInspectedReel {
  reelUrl: string;
  isPinned: boolean;
  anchorText: string;
  viewIconFound?: boolean;
  viewCount?: number | null;
  rawViewText?: string | null;
  viewIconLocation?: string | null;
  descendantTexts: Array<{
    tag: string;
    text: string;
    aria?: string;
    title?: string;
    role?: string;
    className?: string;
  }>;
  accessibleLabels: Array<{
    tag: string;
    attr: string;
    value: string;
  }>;
  tileContainerTag: string;
  tileContainerText: string;
  tileExtraDescendants: Array<{
    tag: string;
    text: string;
    aria?: string;
    title?: string;
    role?: string;
  }>;
  tileLabels: Array<{
    tag: string;
    attr: string;
    value: string;
  }>;
  candidateNumbers: string[];
  hasViewCountText: boolean;
  anchorOuterHTML: string;
  tileOuterHTML: string;
}

export interface DiagnosticResult {
  stage: DiagnosticStage;
  success: boolean;
  message: string;
  tabId?: number;
  actualUrl?: string;
  targetUrl?: string;
  readyState?: string;
  requestedUsername?: string;
  detectedUsername?: string;
  totalReelAnchors?: number;
  uniqueReelUrls?: number;
  first10Reels?: string[];
  postAnchorsCount?: number;
  visibleMediaCount?: number;
  gridElementCount?: number;
  snapshotRetried?: boolean;
  domEvidence?: DiagnosticDomEvidence;
  inspectedReels?: DiagnosticInspectedReel[];
  validViewCountsCount?: number;
  averageViews?: number;
  rawViewCounts?: number[];
  pinnedReelsCount?: number;
  nonPinnedReelsCount?: number;
  error?: string;
}

export interface ExtensionMessage {
  source: typeof VELMORA_RND_SOURCE;
  id: string;
  type: ExtensionCommandType;
  payload?: any;
}

export interface ExtensionStatusResponse {
  type: 'PONG';
  status: 'OK' | 'ERROR';
  extensionVersion?: string;
  timestamp?: number;
  error?: string;
}

export interface InstagramStatusResponse {
  type: 'INSTAGRAM_STATUS';
  available: boolean;
  session: 'detected' | 'login_required' | 'unknown';
  tabId?: number;
  error?: string;
}

export interface ExtensionResponse {
  source: typeof VELMORA_RND_EXTENSION;
  id?: string;
  type: ExtensionEventType;
  status?: 'OK' | 'ERROR';
  loggedIn?: boolean;
  available?: boolean;
  session?: 'detected' | 'login_required' | 'unknown';
  tabId?: number;
  extensionVersion?: string;
  timestamp?: number;
  error?: string;
  payload?: any;
}

export type ExtensionConnectionState = 'NOT_DETECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type InstagramSessionState = 'NOT_AVAILABLE' | 'LOGIN_REQUIRED' | 'SESSION_DETECTED' | 'SESSION_INVALID' | 'CHECKING';
