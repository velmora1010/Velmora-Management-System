import { StatusTrackingRecord } from '../hooks/marketing/useCampaignStatusTracking';
import { isDeliveryStepCompleted } from '../services/influencerStatusHandoffService';

export interface WorkflowStatusInfo {
  stepId: string;
  label: string;
  badgeClass: string;
  dotClass: string;
}

export type WorkflowStateKey = 
  | 're_dispatch'
  | 'not_started'
  | 'delivered'
  | 'share_script'
  | 'call_explain'
  | 'call_skipped'
  | 'timeline'
  | 'draft'
  | 'post_date'
  | 'payment'
  | 'completed';

export interface WorkflowStepHelpers {
  isShareScriptCompleted?: (r: any, v: number) => boolean;
  isShareScriptInProgress?: (r: any, v: number) => boolean;
  isCallCompleted?: (r: any, v: number) => boolean;
  isCallSkipped?: (r: any, v: number) => boolean;
  isTimelineCompleted?: (r: any, v: number) => boolean;
  isDraftCompleted?: (r: any, v: number) => boolean;
  isPostDateCompleted?: (r: any, v: number) => boolean;
  isPaymentCompleted?: (r: any, v: number) => boolean;
  getDeliveryStatus?: (r: any) => string;
  isVideoStarted?: (r: any, v: number) => boolean;
}

/**
 * Parses notes metadata safely from a record
 */
export function getRecordNotesMetadata(record: any): Record<string, any> {
  if (!record) return {};
  try {
    if (typeof record.notes === 'string') {
      return JSON.parse(record.notes || '{}');
    }
    return record.notes || {};
  } catch (e) {
    return {};
  }
}

/**
 * Centralized check if an influencer is currently in the active/pending Re-Dispatch queue
 * (awaiting logistics action / replacement to be created).
 * 
 * SOLE SOURCE OF TRUTH:
 * - If record has redispatch_record linked from `redispatch_records` table, that is authoritative.
 * - If redispatch_status is 'MOVED_TO_ACTIVE' or 'COMPLETED', they are NOT pending re-dispatch.
 * - If re_dispatch_moved_to_active is true, they are NOT pending re-dispatch.
 * - Only records with active/pending re-dispatch requirement return true.
 */
export function isInfluencerInReDispatch(record: any): boolean {
  if (!record) return false;

  // 1. Authoritative redispatch record from public.redispatch_records
  if (record.redispatch || record.redispatch_record) {
    const rd = record.redispatch || record.redispatch_record;
    if (rd.redispatch_status === 'MOVED_TO_ACTIVE' || rd.redispatch_status === 'COMPLETED') {
      return false;
    }
    if (rd.redispatch_status === 'PENDING_REDISPATCH') {
      return true;
    }
  }

  const metadata = getRecordNotesMetadata(record);

  // 2. If moved to active or completed in metadata, they are no longer in pending queue
  if (
    metadata.re_dispatch_moved_to_active ||
    metadata.moved_to_active ||
    metadata.redispatch_lifecycle_status === 'MOVED_TO_ACTIVE' ||
    metadata.redispatch_lifecycle_status === 'COMPLETED'
  ) {
    return false;
  }

  // 3. Check structured redispatch_cycles
  if (Array.isArray(metadata.redispatch_cycles) && metadata.redispatch_cycles.length > 0) {
    const latest = metadata.redispatch_cycles[metadata.redispatch_cycles.length - 1];
    if (latest.status === 'MOVED_TO_ACTIVE' || latest.status === 'DELIVERED') {
      return false;
    }
    if (latest.status === 'PENDING_REDISPATCH') {
      return true;
    }
  }

  // 4. Lifecycle status flag
  if (metadata.redispatch_lifecycle_status === 'PENDING_REDISPATCH') {
    return true;
  }

  // 5. Raw status check (strictly pending / required, not active)
  const rawStatus = (record.status || '').toLowerCase().trim();
  const dispatchStatus = ((record.dispatch as any)?.dispatch_status || '').toLowerCase().trim();

  if (rawStatus.includes('active') || dispatchStatus.includes('active')) {
    return false;
  }

  return Boolean(
    rawStatus.includes('re-dispatch required') ||
    rawStatus === 're-dispatch' ||
    rawStatus === 'redispatch' ||
    metadata.re_dispatch_required
  );
}

/**
 * Checks if an influencer had a Re-Dispatch that was moved to active dispatch.
 */
export function isInfluencerReDispatchActive(record: any): boolean {
  if (!record) return false;

  if (isInfluencerInReDispatch(record)) return false;

  if (record.redispatch || record.redispatch_record) {
    const rd = record.redispatch || record.redispatch_record;
    if (rd.redispatch_status === 'MOVED_TO_ACTIVE') return true;
  }

  const metadata = getRecordNotesMetadata(record);
  if (
    metadata.re_dispatch_moved_to_active ||
    metadata.moved_to_active ||
    metadata.redispatch_lifecycle_status === 'MOVED_TO_ACTIVE'
  ) {
    return true;
  }

  const rawStatus = (record.status || '').toLowerCase();
  return rawStatus.includes('re-dispatch (active)') || rawStatus.includes('active - re-dispatch');
}

/**
 * Checks whether the influencer's current required shipment delivery has been confirmed.
 * If re-dispatch cycles exist, delivery is confirmed ONLY when the latest re-dispatch shipment is confirmed delivered.
 * Otherwise, falls back to canonical initial delivery confirmation.
 */
export function isInfluencerDeliveryConfirmed(record: any): boolean {
  if (!record) return false;

  const metadata = getRecordNotesMetadata(record);

  if (Array.isArray(metadata.redispatch_cycles) && metadata.redispatch_cycles.length > 0) {
    const latest = metadata.redispatch_cycles[metadata.redispatch_cycles.length - 1];
    return Boolean(latest.delivered_confirmed || latest.status === 'DELIVERED');
  }

  return isDeliveryStepCompleted(record);
}

/**
 * ONE CENTRALIZED WORKFLOW-STATE CALCULATION
 * Determines exactly ONE mutually exclusive workflow state for an influencer
 * for a specific video number.
 * 
 * Rules:
 * 1. RE-DISPATCH: Authoritative check if influencer currently requires Re-Dispatch.
 * 2. NOT_STARTED: Influencer has completed ZERO workflow steps (Delivered = false).
 * 3. DELIVERED: Delivered step completed, but Share Script has NOT been completed/started.
 *    (Influencers who only reached Delivered appear here, NOT in Share Script).
 * 4. SHARE_SCRIPT: Share Script step is completed/in progress, but Call & Explain not completed or skipped.
 * 5. CALL_EXPLAIN: Call & Explain step is completed, Timeline not completed.
 * 6. CALL_SKIPPED: Call & Explain was explicitly skipped, Timeline not completed.
 * 7. TIME_LINE: Timeline step is completed, Draft not completed.
 * 8. DRAFT: Draft step is completed/approved, Post Date not completed.
 * 9. POST_DATE: Post Date step is completed.
 * 10. PAYMENT: For Video > 1, Post Date completed, final payment pending.
 */
export function getCurrentWorkflowState(
  record: any,
  videoNumber: number = 1,
  helpers?: WorkflowStepHelpers
): WorkflowStateKey {
  if (!record) return 'not_started';

  // 1. Re-Dispatch check (Authoritative: pending re-dispatch requirement)
  if (isInfluencerInReDispatch(record)) {
    return 're_dispatch';
  }

  // 2. Delivery check
  const isDelivered = isInfluencerDeliveryConfirmed(record);

  if (!isDelivered) {
    return 'not_started';
  }

  // 3. For Video > 1: Has this video started?
  if (videoNumber > 1 && helpers?.isVideoStarted) {
    if (!helpers.isVideoStarted(record, videoNumber)) {
      return 'not_started';
    }
  }

  // 4. Share Script step
  const isScriptCompleted = helpers?.isShareScriptCompleted
    ? helpers.isShareScriptCompleted(record, videoNumber)
    : false;

  const isScriptInProgress = helpers?.isShareScriptInProgress
    ? helpers.isShareScriptInProgress(record, videoNumber)
    : false;

  const hasScriptActivity = isScriptCompleted || isScriptInProgress;

  // Delivered completed, but Share Script NOT completed/started
  // -> Belongs to 'delivered', MUST NOT appear in 'share_script'
  if (!hasScriptActivity) {
    return 'delivered';
  }

  // 5. Call & Explain / Call Skipped
  const isCallSkipped = helpers?.isCallSkipped
    ? helpers.isCallSkipped(record, videoNumber)
    : false;

  const isCallCompleted = helpers?.isCallCompleted
    ? helpers.isCallCompleted(record, videoNumber)
    : false;

  const isTimelineCompleted = helpers?.isTimelineCompleted
    ? helpers.isTimelineCompleted(record, videoNumber)
    : false;

  // Share Script completed/started, but Call Explain not completed or skipped
  if (!isCallCompleted && !isCallSkipped) {
    return 'share_script';
  }

  // Call was explicitly skipped, Timeline not completed
  if (isCallSkipped && !isTimelineCompleted) {
    return 'call_skipped';
  }

  // Call was completed, Timeline not completed
  if (!isTimelineCompleted) {
    return 'call_explain';
  }

  // 6. Timeline step
  const isDraftCompleted = helpers?.isDraftCompleted
    ? helpers.isDraftCompleted(record, videoNumber)
    : false;

  // Timeline completed, Draft not completed
  if (!isDraftCompleted) {
    return 'timeline';
  }

  // 7. Draft step
  const isPostDateCompleted = helpers?.isPostDateCompleted
    ? helpers.isPostDateCompleted(record, videoNumber)
    : false;

  // Draft completed, Post Date not completed
  if (!isPostDateCompleted) {
    return 'draft';
  }

  // 8. Post Date / Payment (Video > 1)
  if (videoNumber > 1) {
    const isPaymentCompleted = helpers?.isPaymentCompleted
      ? helpers.isPaymentCompleted(record, videoNumber)
      : false;

    if (!isPaymentCompleted) {
      return 'payment';
    }
  }

  return 'post_date';
}

/**
 * Checks if the influencer is currently at the NOT_STARTED workflow state.
 */
export function isInfluencerWorkflowNotStarted(
  record: any,
  videoNumber: number = 1,
  helpers?: WorkflowStepHelpers
): boolean {
  return getCurrentWorkflowState(record, videoNumber, helpers) === 'not_started';
}

/**
 * Centralized Canonical Helper to resolve workflow status for an influencer.
 * Used uniformly across Status Tracking, Re-Dispatch, Influencer Logistics,
 * filter counts, and status cards.
 */
export function getInfluencerWorkflowStatus(
  record: any,
  videoNumber: number = 1,
  helpers?: WorkflowStepHelpers
): string {
  return getCurrentWorkflowState(record, videoNumber, helpers);
}
