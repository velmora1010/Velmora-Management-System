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
  creatorCategory?: string;
  languages?: string;

  rowNumber: number;
  validationStatus: ValidationStatus;
  validationMessages: string[];
  researchStatus?: ProfileResearchStatus;
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
}

export type ProfileResearchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'reels_not_enough' | 'reels_not_found';

export interface DiscoveredReel {
  reelUrl: string;
  isPinned: boolean;
  discoveryIndex: number;
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

  status: ProfileResearchStatus;
  error?: string;
  startedAt: number;
  completedAt: number;
}
