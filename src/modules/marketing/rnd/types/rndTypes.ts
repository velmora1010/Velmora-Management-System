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

export type ProfileResearchStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ProfileResearchResult {
  jobId: string;
  influencerCode: string;
  requestedUsername: string;
  verifiedUsername: string;
  followerDisplay: string | null;
  followerCount: number;
  status: ProfileResearchStatus;
  error?: string;
  startedAt: number;
  completedAt: number;
}
