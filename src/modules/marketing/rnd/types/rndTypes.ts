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
