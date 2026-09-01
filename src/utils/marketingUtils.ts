export type InfluencerStatusType = 'active' | 'other' | 'recycle_bin';

export const getInfluencerStatus = (value: any): InfluencerStatusType => {
  if (value === 'other') return 'other';
  if (value === true || value === 'true' || value === 1 || value === '1') return 'recycle_bin';
  return 'active';
};

export const isArchived = (value: any): boolean => {
  return getInfluencerStatus(value) === 'recycle_bin';
};

export const isOtherStatus = (value: any): boolean => {
  return getInfluencerStatus(value) === 'other';
};

export const isActiveStatus = (value: any): boolean => {
  return getInfluencerStatus(value) === 'active';
};
