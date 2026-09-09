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

export type InfluencerDispatchStage = 'pending' | 'prepare_dispatch' | 'dispatched';

/**
 * Returns true ONLY when actual dispatch has been successfully completed and confirmed (status is 'dispatched' or 'tracking').
 * Merely moving to Prepare Dispatch, batch membership, or drafting details does NOT mark an influencer as Dispatched.
 */
export const isInfluencerDispatched = (
  inf: { dispatchDetails?: any; id?: string | number } | null | undefined,
  dispatchRecords?: any[]
): boolean => {
  if (!inf) return false;
  const dispatch = inf.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(inf.id)));
  if (!dispatch) return false;
  const status = (dispatch.dispatch_status || '').trim().toLowerCase();
  return status === 'dispatched' || status === 'tracking';
};

/**
 * Returns true when an influencer has been moved into Prepare Dispatch (or a batch) but has NOT yet been dispatched.
 */
export const isInfluencerInPrepareDispatch = (
  inf: { dispatchDetails?: any; id?: string | number } | null | undefined,
  dispatchRecords?: any[]
): boolean => {
  if (!inf) return false;
  if (isInfluencerDispatched(inf, dispatchRecords)) return false;
  const dispatch = inf.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(inf.id)));
  if (!dispatch) return false;
  const status = (dispatch.dispatch_status || '').trim().toLowerCase();
  return status === 'prepare_dispatch' || status === 'ready to dispatch';
};

/**
 * Resolves the current logistics stage of an influencer:
 * - 'dispatched': Confirmed shipped/dispatched or in tracking
 * - 'prepare_dispatch': In a batch / waiting for dispatch
 * - 'pending': Normal active logistics pending selection/preparation
 */
export const getInfluencerLogisticsStage = (
  inf: { dispatchDetails?: any; id?: string | number } | null | undefined,
  dispatchRecords?: any[]
): InfluencerDispatchStage => {
  if (isInfluencerDispatched(inf, dispatchRecords)) return 'dispatched';
  if (isInfluencerInPrepareDispatch(inf, dispatchRecords)) return 'prepare_dispatch';
  return 'pending';
};

