import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer } from '../types';
import type { DispatchDetails } from '../hooks/marketing/useCampaignDispatch';
import type { InfluencerDispatchedShipment } from './influencerTrackingService';

/**
 * Natural/code sorting for influencer codes (e.g. J2, J10, J61, J174, J203).
 * Preserves alphanumeric prefix and naturally sorts the numeric suffix.
 */
export function naturalCompareCodes(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const cleanA = String(a).replace(/^#+/, '').trim();
  const cleanB = String(b).replace(/^#+/, '').trim();

  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

export interface InfluencerMatchResult {
  matchedInfluencer?: CampaignInfluencer;
  matchedDispatch?: DispatchDetails;
  matchPriority?: 1 | 2 | 3 | 4 | 5;
  matchReason?: string;
}

/**
 * Matches a shipment to an influencer using the 5 priority rules:
 * 1. Influencer Code
 * 2. Influencer ID / internal ID
 * 3. Order ID / shipment relationship
 * 4. AWB mapping
 * 5. Existing dispatch relationship
 * 
 * Never matches solely by generic display name.
 */
export function matchShipmentToInfluencer(
  shipment: InfluencerDispatchedShipment,
  campaignInfluencers: CampaignInfluencer[],
  dispatchRecords: DispatchDetails[]
): InfluencerMatchResult {
  const cleanShipCode = (shipment.influencerCode || '').replace(/^#+/, '').trim().toLowerCase();
  const cleanOrderId = (shipment.orderId || '').replace(/^#+/, '').trim().toLowerCase();
  const cleanShipInfId = shipment.influencerId ? String(shipment.influencerId).trim() : '';
  const cleanAwb = (shipment.awbNumber || '').trim().toLowerCase();

  // -------------------------------------------------------------
  // Priority 1: Influencer Code
  // -------------------------------------------------------------
  if (cleanShipCode) {
    const infByCode = campaignInfluencers.find(inf => {
      const code = (inf.code || '').replace(/^#+/, '').trim().toLowerCase();
      return code && code === cleanShipCode;
    });
    if (infByCode) {
      const dispatch = dispatchRecords.find(d => String(d.influencer_id) === String(infByCode.id));
      return {
        matchedInfluencer: infByCode,
        matchedDispatch: dispatch,
        matchPriority: 1,
        matchReason: `Matched by Influencer Code: ${infByCode.code}`
      };
    }

    const dispByCode = dispatchRecords.find(d => {
      const code = ((d as any).influencer_code || '').replace(/^#+/, '').trim().toLowerCase();
      return code && code === cleanShipCode;
    });
    if (dispByCode) {
      const inf = campaignInfluencers.find(i => String(i.id) === String(dispByCode.influencer_id));
      if (inf) {
        return {
          matchedInfluencer: inf,
          matchedDispatch: dispByCode,
          matchPriority: 1,
          matchReason: `Matched by Dispatch Influencer Code: ${cleanShipCode}`
        };
      }
    }
  }

  // -------------------------------------------------------------
  // Priority 2: Influencer ID / internal ID
  // -------------------------------------------------------------
  if (cleanShipInfId) {
    const infById = campaignInfluencers.find(inf => String(inf.id) === cleanShipInfId);
    if (infById) {
      const dispatch = dispatchRecords.find(d => String(d.influencer_id) === String(infById.id));
      return {
        matchedInfluencer: infById,
        matchedDispatch: dispatch,
        matchPriority: 2,
        matchReason: `Matched by Influencer ID: ${cleanShipInfId}`
      };
    }
  }

  // Check if orderId is a direct numeric influencer ID
  if (cleanOrderId && /^\d+$/.test(cleanOrderId)) {
    const infByNumOrder = campaignInfluencers.find(inf => String(inf.id) === cleanOrderId);
    if (infByNumOrder) {
      const dispatch = dispatchRecords.find(d => String(d.influencer_id) === String(infByNumOrder.id));
      return {
        matchedInfluencer: infByNumOrder,
        matchedDispatch: dispatch,
        matchPriority: 2,
        matchReason: `Matched Order ID as Influencer ID: ${cleanOrderId}`
      };
    }
  }

  // -------------------------------------------------------------
  // Priority 3: Order ID / shipment relationship
  // -------------------------------------------------------------
  if (cleanOrderId) {
    const infByOrderAsCode = campaignInfluencers.find(inf => {
      const code = (inf.code || '').replace(/^#+/, '').trim().toLowerCase();
      return code && code === cleanOrderId;
    });
    if (infByOrderAsCode) {
      const dispatch = dispatchRecords.find(d => String(d.influencer_id) === String(infByOrderAsCode.id));
      return {
        matchedInfluencer: infByOrderAsCode,
        matchedDispatch: dispatch,
        matchPriority: 3,
        matchReason: `Matched Order ID to Influencer Code: ${infByOrderAsCode.code}`
      };
    }
  }

  // -------------------------------------------------------------
  // Priority 4: AWB mapping
  // -------------------------------------------------------------
  if (cleanAwb) {
    const dispByAwb = dispatchRecords.find(d => {
      const trId = (d.tracking_id || '').trim().toLowerCase();
      return trId && trId === cleanAwb;
    });
    if (dispByAwb) {
      const inf = campaignInfluencers.find(i => String(i.id) === String(dispByAwb.influencer_id));
      if (inf) {
        return {
          matchedInfluencer: inf,
          matchedDispatch: dispByAwb,
          matchPriority: 4,
          matchReason: `Matched by AWB to Dispatch Tracking ID: ${cleanAwb}`
        };
      }
    }
  }

  // -------------------------------------------------------------
  // Priority 5: Existing dispatch relationship
  // -------------------------------------------------------------
  if (shipment.id) {
    const dispById = dispatchRecords.find(d => String(d.id) === String(shipment.id));
    if (dispById) {
      const inf = campaignInfluencers.find(i => String(i.id) === String(dispById.influencer_id));
      if (inf) {
        return {
          matchedInfluencer: inf,
          matchedDispatch: dispById,
          matchPriority: 5,
          matchReason: `Matched by Dispatch Record ID: ${dispById.id}`
        };
      }
    }
  }

  // Unmatched
  return {
    matchedInfluencer: undefined,
    matchedDispatch: undefined
  };
}

/**
 * Loads the set of influencer IDs already present in Status Tracking for this campaign.
 */
export async function fetchCampaignStatusTrackingInfluencerIds(campaignId: string | number): Promise<Set<string>> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) return new Set();

  try {
    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerStatus)
      .select('influencer_id')
      .eq('campaign_id', cleanCampaignId);

    if (error) {
      console.error('Error fetching campaign status tracking influencer IDs:', error);
      return new Set();
    }

    const set = new Set<string>();
    (data || []).forEach(r => {
      if (r.influencer_id !== null && r.influencer_id !== undefined) {
        set.add(String(r.influencer_id));
      }
    });
    return set;
  } catch (e) {
    console.error('Exception fetching campaign status tracking influencer IDs:', e);
    return new Set();
  }
}

export interface HandoffResult {
  success: boolean;
  alreadyExisted: boolean;
  matchedInfluencer?: CampaignInfluencer;
  recordId?: any;
  error?: string;
  matchReason?: string;
}

/**
 * Idempotently moves a single delivered shipment to Status Tracking.
 * - Only 'Delivered' shipments are eligible.
 * - If the influencer already has a Status Tracking record for this campaign,
 *   it preserves all existing progress and returns alreadyExisted = true.
 * - If not present, inserts a new record with current_step: 0, delivered_confirmed: true, status: 'Active'.
 */
export async function handoffDeliveredShipmentToStatusTracking(
  campaignId: string | number,
  shipment: InfluencerDispatchedShipment,
  campaignInfluencers: CampaignInfluencer[],
  dispatchRecords: DispatchDetails[]
): Promise<HandoffResult> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) {
    return { success: false, alreadyExisted: false, error: 'Campaign ID is required.' };
  }

  if (shipment.status !== 'Delivered') {
    return {
      success: false,
      alreadyExisted: false,
      error: `Shipment status is "${shipment.status}". Only "Delivered" shipments qualify for Status Tracking.`
    };
  }

  // Match influencer safely
  const { matchedInfluencer, matchedDispatch, matchReason } = matchShipmentToInfluencer(
    shipment,
    campaignInfluencers,
    dispatchRecords
  );

  if (!matchedInfluencer) {
    return {
      success: false,
      alreadyExisted: false,
      error: `Could not safely match shipment (AWB: ${shipment.awbNumber || '—'}, Code: ${shipment.influencerCode || shipment.orderId || '—'}) to an influencer in this campaign.`
    };
  }

  const cleanInfId = String(matchedInfluencer.id);

  try {
    // 1. Check if Status Tracking record already exists for (campaign_id, influencer_id)
    const { data: existing, error: findError } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerStatus)
      .select('id, current_step, notes, delivered_confirmed')
      .eq('campaign_id', cleanCampaignId)
      .eq('influencer_id', cleanInfId);

    if (findError) {
      console.error('Error checking existing status tracking row:', findError);
      return { success: false, alreadyExisted: false, error: findError.message };
    }

    if (existing && existing.length > 0) {
      // Idempotent: preserve all existing progress!
      const existingRow = existing[0];
      return {
        success: true,
        alreadyExisted: true,
        matchedInfluencer,
        recordId: existingRow.id,
        matchReason
      };
    }

    // 2. Ensure or link a dispatch row in influencer_dispatch_details_rows
    let dispatchId: string | number | undefined = matchedDispatch?.id;
    if (!dispatchId) {
      const { data: existingDispatches } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id')
        .eq('campaign_id', cleanCampaignId)
        .eq('influencer_id', cleanInfId)
        .limit(1);

      if (existingDispatches && existingDispatches.length > 0) {
        dispatchId = existingDispatches[0].id;
      } else {
        // Create dispatch record so logistics state aligns
        const { data: maxDispData } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .order('id', { ascending: false })
          .limit(1);

        const maxDispId = maxDispData && maxDispData.length > 0 ? Number(maxDispData[0].id) : 0;
        const nextDispId = isNaN(maxDispId) ? 1 : maxDispId + 1;

        const { data: insertedDisp, error: dispErr } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .insert([{
            id: nextDispId,
            campaign_id: isNaN(Number(cleanCampaignId)) ? cleanCampaignId : Number(cleanCampaignId),
            influencer_id: isNaN(Number(cleanInfId)) ? cleanInfId : Number(cleanInfId),
            creator_name: matchedInfluencer.influencer_name || matchedInfluencer.name || '',
            phone_number: matchedInfluencer.phone_number || '',
            alternative_phone_number: matchedInfluencer.alternative_number || '',
            address: matchedInfluencer.complete_address || '',
            state: matchedInfluencer.state || '',
            courier_partner: shipment.courier || '',
            tracking_id: shipment.awbNumber || '',
            dispatch_status: 'Tracking',
            created_at: new Date().toISOString()
          }])
          .select('id');

        if (!dispErr && insertedDisp && insertedDisp.length > 0) {
          dispatchId = insertedDisp[0].id;
        } else {
          dispatchId = nextDispId;
        }
      }
    } else {
      // Update existing dispatch status to Tracking
      await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({ dispatch_status: 'Tracking', tracking_id: shipment.awbNumber || undefined })
        .eq('id', dispatchId);
    }

    // 3. Query next ID in influencer_status_tracking_rows
    const { data: maxData, error: maxError } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerStatus)
      .select('id')
      .not('id', 'is', null)
      .order('id', { ascending: false })
      .limit(1);

    if (maxError) {
      console.error('Error fetching max id from status tracking:', maxError);
      return { success: false, alreadyExisted: false, error: maxError.message };
    }

    const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
    const nextId = isNaN(maxId) ? 1 : maxId + 1;

    // 4. Insert new Status Tracking row
    const nowIso = new Date().toISOString();
    const trackingPayload: any = {
      id: nextId,
      campaign_id: isNaN(Number(cleanCampaignId)) ? cleanCampaignId : Number(cleanCampaignId),
      influencer_id: isNaN(Number(cleanInfId)) ? cleanInfId : Number(cleanInfId),
      dispatch_id: dispatchId ? (isNaN(Number(dispatchId)) ? dispatchId : Number(dispatchId)) : null,
      current_step: 0,
      delivered_confirmed: false,
      pay_advance_completed: false,
      reference_video_received: false,
      expected_delivery_completed: false,
      draft_received: false,
      payment_remaining_completed: false,
      final_post_completed: false,
      status: 'Not Started',
      created_at: nowIso,
      updated_at: nowIso
    };

    const { error: insertError } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerStatus)
      .insert([trackingPayload]);

    if (insertError) {
      console.error('Error inserting status tracking record:', insertError);
      return { success: false, alreadyExisted: false, error: insertError.message };
    }

    return {
      success: true,
      alreadyExisted: false,
      matchedInfluencer,
      recordId: nextId,
      matchReason
    };
  } catch (err: any) {
    console.error('Exception in handoffDeliveredShipmentToStatusTracking:', err);
    return {
      success: false,
      alreadyExisted: false,
      error: err?.message || String(err)
    };
  }
}

export interface BulkHandoffSummary {
  totalDelivered: number;
  addedCount: number;
  alreadyPresentCount: number;
  unmatchedCount: number;
  failedCount: number;
  results: {
    shipmentAwb: string;
    influencerName?: string;
    influencerCode?: string;
    status: 'added' | 'already_present' | 'unmatched' | 'failed';
    error?: string;
  }[];
}

/**
 * Bulk handoff for all Delivered shipments in a campaign.
 * Deduplicates multiple shipments for the same influencer to maintain exactly 1 status tracking record per influencer.
 */
export async function bulkHandoffDeliveredShipments(
  campaignId: string | number,
  shipments: InfluencerDispatchedShipment[],
  campaignInfluencers: CampaignInfluencer[],
  dispatchRecords: DispatchDetails[]
): Promise<BulkHandoffSummary> {
  const delivered = shipments.filter(s => s.status === 'Delivered');
  const existingSet = await fetchCampaignStatusTrackingInfluencerIds(campaignId);

  const summary: BulkHandoffSummary = {
    totalDelivered: delivered.length,
    addedCount: 0,
    alreadyPresentCount: 0,
    unmatchedCount: 0,
    failedCount: 0,
    results: []
  };

  // Group delivered shipments by matched influencer to avoid duplicate work
  const processedInfluencerIds = new Set<string>();

  for (const s of delivered) {
    const { matchedInfluencer } = matchShipmentToInfluencer(s, campaignInfluencers, dispatchRecords);

    if (!matchedInfluencer) {
      summary.unmatchedCount++;
      summary.results.push({
        shipmentAwb: s.awbNumber,
        status: 'unmatched',
        error: 'No matching influencer found in current campaign'
      });
      continue;
    }

    const infId = String(matchedInfluencer.id);

    // If already in DB before this run
    if (existingSet.has(infId)) {
      summary.alreadyPresentCount++;
      summary.results.push({
        shipmentAwb: s.awbNumber,
        influencerName: matchedInfluencer.influencer_name || matchedInfluencer.name,
        influencerCode: matchedInfluencer.code,
        status: 'already_present'
      });
      continue;
    }

    // If already processed in this bulk run
    if (processedInfluencerIds.has(infId)) {
      summary.alreadyPresentCount++;
      summary.results.push({
        shipmentAwb: s.awbNumber,
        influencerName: matchedInfluencer.influencer_name || matchedInfluencer.name,
        influencerCode: matchedInfluencer.code,
        status: 'already_present'
      });
      continue;
    }

    processedInfluencerIds.add(infId);

    // Execute handoff
    const res = await handoffDeliveredShipmentToStatusTracking(
      campaignId,
      s,
      campaignInfluencers,
      dispatchRecords
    );

    if (res.success) {
      if (res.alreadyExisted) {
        existingSet.add(infId);
        summary.alreadyPresentCount++;
        summary.results.push({
          shipmentAwb: s.awbNumber,
          influencerName: matchedInfluencer.influencer_name || matchedInfluencer.name,
          influencerCode: matchedInfluencer.code,
          status: 'already_present'
        });
      } else {
        existingSet.add(infId);
        summary.addedCount++;
        summary.results.push({
          shipmentAwb: s.awbNumber,
          influencerName: matchedInfluencer.influencer_name || matchedInfluencer.name,
          influencerCode: matchedInfluencer.code,
          status: 'added'
        });
      }
    } else {
      summary.failedCount++;
      summary.results.push({
        shipmentAwb: s.awbNumber,
        influencerName: matchedInfluencer.influencer_name || matchedInfluencer.name,
        influencerCode: matchedInfluencer.code,
        status: 'failed',
        error: res.error
      });
    }
  }

  return summary;
}
