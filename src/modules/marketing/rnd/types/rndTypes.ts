export type ValidationStatus = 'ready' | 'warning' | 'invalid';

export interface ResearchInputProfile {
  influencerCode: string;
  username: string;
  name?: string;
  phone?: string;
  profileLink?: string;
  platform?: string;
  followers?: string;
  state?: string;
  city?: string;
  email?: string;
  pincode?: string;
  category?: string;
  creatorCategory?: string;
  languages?: string;
  originalData?: Record<string, any>;

  rowNumber: number;
  validationStatus: ValidationStatus;
  validationMessages: string[];
  researchStatus?: ProfileResearchStatus;
  researchResult?: ProfileResearchResult | any;
}

export type JobStatus = 'draft' | 'ready' | 'invalid';

export interface ResearchJob {
  jobId: string;
  fileName: string;
  createdAt: string;
  totalProfiles: number;
  readyProfiles: number;
  warningProfiles: number;
  invalidProfiles: number;
  duplicateProfiles: number;
  profiles: ResearchInputProfile[];
  status: JobStatus;
  categoryByCode?: Record<string, string>;
  categoryByUsername?: Record<string, string>;
}

export type ProfileResearchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'reels_not_enough' | 'reels_not_found' | 'partial';

export interface DiscoveredReel {
  reelUrl: string;
  isPinned: boolean;
  discoveryIndex: number;
  viewCount?: number | null;
  rawViewText?: string | null;
  viewIconLocation?: string | null;
}

export interface ProfileResearchResult {
  jobId: string;
  influencerCode: string;
  requestedUsername: string;
  verifiedUsername: string;
  followerDisplay: string | null;
  followerCount: number;
  
  // Milestone 2 additions
  reelsDiscovered?: number;
  pinnedReelsExcluded?: number;
  selectedReelCount?: number;
  selectedReels?: DiscoveredReel[];
  validViewCountsCount?: number;
  averageViews?: number;
  rawViewCounts?: number[];
  missingViewCountsCount?: number;
  category?: string;
  creatorCategory?: string;

  status: ProfileResearchStatus;
  error?: string;
  startedAt: number;
  completedAt: number;

  // Batch consistency & diagnostic details
  finalUrl?: string;
  navigationSuccess?: boolean;
  pageReadiness?: string;
  reelAnchorsAtStart?: number;
  failureStage?: string | null;
  failureReason?: string | null;
  extractionMoment?: any;
}
