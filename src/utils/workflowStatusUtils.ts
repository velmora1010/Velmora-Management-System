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
  | 'pay_advance'
  | 'timeline'
  | 'draft'
  | 'post_date'
  | 'payment'
  | 'after_post'
  | 'completed';

export interface WorkflowStepHelpers {
  isShareScriptCompleted?: (r: any, v: number) => boolean;
  isShareScriptInProgress?: (r: any, v: number) => boolean;
  isCallCompleted?: (r: any, v: number) => boolean;
  isCallSkipped?: (r: any, v: number) => boolean;
  isPayAdvanceCompleted?: (r: any, v: number) => boolean;
  isTimelineCompleted?: (r: any, v: number) => boolean;
  isDraftCompleted?: (r: any, v: number) => boolean;
  isPostDateCompleted?: (r: any, v: number) => boolean;
  isPaymentCompleted?: (r: any, v: number) => boolean;
  isAfterPostCompleted?: (r: any, v: number) => boolean;
  getDeliveryStatus?: (r: any) => string;
  isVideoStarted?: (r: any, v: number) => boolean;
}

// In-memory caches to prevent repetitive expensive JSON.parse during renders and filtering
const notesMetadataCache = new WeakMap<any, Record<string, any>>();
const notesStringCache = new Map<string, Record<string, any>>();

/**
 * Parses notes metadata safely from a record with high-performance memoization
 */
export function getRecordNotesMetadata(record: any): Record<string, any> {
  if (!record) return {};
  if (typeof record === 'object' && record !== null) {
    const cached = notesMetadataCache.get(record);
    if (cached) return cached;
  }

  let metadata: Record<string, any> = {};
  try {
    if (typeof record.notes === 'string') {
      const raw = record.notes || '{}';
      let parsed = notesStringCache.get(raw);
      if (!parsed) {
        parsed = JSON.parse(raw);
        if (notesStringCache.size > 2000) notesStringCache.clear();
        notesStringCache.set(raw, parsed);
      }
      metadata = parsed;
    } else {
      metadata = record.notes || {};
    }
  } catch (e) {
    metadata = {};
  }

  if (typeof record === 'object' && record !== null) {
    notesMetadataCache.set(record, metadata);
  }
  return metadata;
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

  if (record.redispatch || record.redispatch_record) {
    const rd = record.redispatch || record.redispatch_record;
    if (rd.redispatch_status === 'COMPLETED') return true;
    if (rd.redispatch_status === 'MOVED_TO_ACTIVE') {
      return Boolean(metadata.replacement_delivered_confirmed || metadata.delivered_confirmed || (record.delivered_confirmed && !metadata.re_dispatch_required && !metadata.re_dispatch_moved_to_active));
    }
    if (rd.redispatch_status === 'PENDING_REDISPATCH') return false;
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

  // 2. Evaluate step completions
  const isDelivered = isInfluencerDeliveryConfirmed(record);

  const isScriptCompleted = helpers?.isShareScriptCompleted
    ? helpers.isShareScriptCompleted(record, videoNumber)
    : false;

  const isCallSkipped = helpers?.isCallSkipped
    ? helpers.isCallSkipped(record, videoNumber)
    : false;

  const isCallCompleted = helpers?.isCallCompleted
    ? helpers.isCallCompleted(record, videoNumber)
    : false;

  const isPayAdvanceCompleted = helpers?.isPayAdvanceCompleted
    ? helpers.isPayAdvanceCompleted(record, videoNumber)
    : false;

  const isTimelineCompleted = helpers?.isTimelineCompleted
    ? helpers.isTimelineCompleted(record, videoNumber)
    : false;

  const isDraftCompleted = helpers?.isDraftCompleted
    ? helpers.isDraftCompleted(record, videoNumber)
    : false;

  const isPostDateCompleted = helpers?.isPostDateCompleted
    ? helpers.isPostDateCompleted(record, videoNumber)
    : false;

  const isPaymentCompleted = helpers?.isPaymentCompleted
    ? helpers.isPaymentCompleted(record, videoNumber)
    : false;

  const isAfterPostCompleted = helpers?.isAfterPostCompleted
    ? helpers.isAfterPostCompleted(record, videoNumber)
    : false;

  // True NOT STARTED: NO workflow step has been completed for this influencer/video
  const hasAnyStepCompleted = Boolean(
    isDelivered || 
    isScriptCompleted || 
    isCallCompleted || 
    isCallSkipped || 
    isPayAdvanceCompleted ||
    isTimelineCompleted || 
    isDraftCompleted || 
    isPostDateCompleted || 
    isPaymentCompleted ||
    isAfterPostCompleted
  );

  if (!hasAnyStepCompleted) {
    return 'not_started';
  }

  if (!isDelivered) {
    return 'not_started';
  }

  // ALL VIDEOS (1 TO 6) UNIFIED WORKFLOW:
  // 1. Delivered -> 2. Share Script -> 3. Call Explain -> 4. Draft -> 5. Payment -> 6. Post Date -> 7. After Post
  if (!isScriptCompleted) {
    return 'delivered';
  }
  if (!isCallCompleted && !isCallSkipped) {
    return 'share_script';
  }
  if (!isDraftCompleted) {
    return isCallSkipped ? 'call_skipped' : 'call_explain';
  }
  if (!isPaymentCompleted) {
    return 'draft';
  }
  if (!isPostDateCompleted) {
    return 'payment';
  }
  if (!isAfterPostCompleted) {
    return 'post_date';
  }
  return 'after_post';
}

/**
 * Single centralized function to query any step's exact completion boolean
 */
export function getStepCompletion(
  record: any,
  videoNumber: number,
  stepId: string,
  helpers?: WorkflowStepHelpers
): boolean {
  if (isInfluencerInReDispatch(record)) return false;
  if (stepId === 'delivered') return isInfluencerDeliveryConfirmed(record);
  if (stepId === 'share_script') return helpers?.isShareScriptCompleted ? helpers.isShareScriptCompleted(record, videoNumber) : false;
  if (stepId === 'call_explain') return helpers?.isCallCompleted ? helpers.isCallCompleted(record, videoNumber) : false;
  if (stepId === 'call_skipped') return helpers?.isCallSkipped ? helpers.isCallSkipped(record, videoNumber) : false;
  if (stepId === 'pay_advance') return helpers?.isPayAdvanceCompleted ? helpers.isPayAdvanceCompleted(record, videoNumber) : false;
  if (stepId === 'timeline') return helpers?.isTimelineCompleted ? helpers.isTimelineCompleted(record, videoNumber) : false;
  if (stepId === 'draft') return helpers?.isDraftCompleted ? helpers.isDraftCompleted(record, videoNumber) : false;
  if (stepId === 'post_date') return helpers?.isPostDateCompleted ? helpers.isPostDateCompleted(record, videoNumber) : false;
  if (stepId === 'payment') return helpers?.isPaymentCompleted ? helpers.isPaymentCompleted(record, videoNumber) : false;
  if (stepId === 'after_post') return helpers?.isAfterPostCompleted ? helpers.isAfterPostCompleted(record, videoNumber) : false;
  return false;
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
