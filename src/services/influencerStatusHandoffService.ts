import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import db from '../lib/db';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer } from '../types';
import type { DispatchDetails } from '../hooks/marketing/useCampaignDispatch';
import {
  type InfluencerDispatchedShipment,
  isShipmentDelivered,
  deleteCampaignShipmentsFromDb,
  deleteSingleCampaignShipmentFromDb,
  fetchCampaignShipmentsFromDb
} from './influencerTrackingService';

/**
 * Extracts the numeric integer value from an influencer code.
 * E.g. "HIS1" -> 1, "#HIS1" -> 1, "GJS140" -> 140, "#BHS214" -> 214.
 * Returns Infinity if no numeric digits are found so non-numeric codes sort to the end.
 */
export function getInfluencerCodeNumber(code?: string | null): number {
  if (!code) return Infinity;
  const clean = String(code).replace(/^#+/, '').trim();
  const match = clean.match(/\d+/);
  if (match) {
    const n = parseInt(match[0], 10);
    return isNaN(n) ? Infinity : n;
  }
  return Infinity;
}

/**
 * Centralized strict numeric influencer code comparator.
 * PRIMARY: Numeric value strictly ascending (e.g. 1 < 2 < 3 < 10 < 140 < 214).
 * The alphabetic prefix is completely ignored for the primary ordering.
 * SECONDARY (tie-breaker only when numeric values are identical):
 * Code / prefix alphabetically (e.g. BHS12 < GJS12 < HIS12).
 */
export function naturalCompareInfluencerCodes(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const numA = getInfluencerCodeNumber(a);
  const numB = getInfluencerCodeNumber(b);

  // PRIMARY: Numeric value strictly ascending
  if (numA !== numB) {
    return numA - numB;
  }

  // SECONDARY: When numbers are equal (e.g. BHS12 vs GJS12 vs HIS12)
  const cleanA = String(a).replace(/^#+/, '').trim().toUpperCase();
  const cleanB = String(b).replace(/^#+/, '').trim().toUpperCase();
  return cleanA.localeCompare(cleanB);
}

/**
 * Backwards-compatible alias for naturalCompareInfluencerCodes.
 */
export const naturalCompareCodes = naturalCompareInfluencerCodes;

/**
 * Resolves the primary influencer code for a shipment record safely.
 * Checks influencerCode, orderId, or code fields.
 */
export function getShipmentInfluencerCode(s: any): string {
  if (!s) return '';
  if (s.influencerCode && String(s.influencerCode).trim()) {
    const code = String(s.influencerCode).trim();
    if (/\d+/.test(code)) return code;
  }
  if (s.orderId && String(s.orderId).trim()) {
    const ord = String(s.orderId).trim();
    if (/\d+/.test(ord)) return ord;
  }
  if (s.code && String(s.code).trim()) {
    const c = String(s.code).trim();
    if (/\d+/.test(c)) return c;
  }
  return s.influencerCode || s.orderId || s.code || '';
}

/**
 * Stable comparator for shipment records ordered by natural influencer code ascending.
 * Secondary order:
 * 1. Influencer code natural sort
 * 2. Video number if available
 * 3. AWB number
 * 4. dispatchDate or created_at
 * 5. Record ID
 */
export function compareShipmentsByInfluencerCodeNaturally(
  a: any,
  b: any
): number {
  const codeA = getShipmentInfluencerCode(a);
  const codeB = getShipmentInfluencerCode(b);

  const codeComparison = naturalCompareInfluencerCodes(codeA, codeB);
  if (codeComparison !== 0) {
    return codeComparison;
  }

  // Stable secondary sorts:
  // 1. Video number if available
  const videoNumA = a?.videoNumber ?? a?.video_number ?? a?.videoNo ?? null;
  const videoNumB = b?.videoNumber ?? b?.video_number ?? b?.videoNo ?? null;
  if (videoNumA !== null && videoNumB !== null && videoNumA !== videoNumB) {
    const vA = Number(videoNumA);
    const vB = Number(videoNumB);
    if (!isNaN(vA) && !isNaN(vB) && vA !== vB) {
      return vA - vB;
    }
  }

  // 2. AWB number
  const awbA = String(a?.awbNumber || a?.awb_number || '').trim();
  const awbB = String(b?.awbNumber || b?.awb_number || '').trim();
  if (awbA !== awbB) {
    return awbA.localeCompare(awbB, undefined, { numeric: true, sensitivity: 'base' });
  }

  // 3. dispatchDate or created_at
  const dateA = a?.dispatchDate || a?.created_at || '';
  const dateB = b?.dispatchDate || b?.created_at || '';
  if (dateA !== dateB) {
    return String(dateA).localeCompare(String(dateB));
  }

  // 4. Record ID
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

/**
 * Sorts an array of shipment records naturally by influencer code ascending without mutating the original array.
 */
export function sortInfluencerShipmentsNaturally<T>(shipments: T[]): T[] {
  return [...shipments].sort(compareShipmentsByInfluencerCodeNaturally);
}

/**
 * Normalizes an influencer code or shipment order reference for canonical comparison.
 * - converts to string
 * - trims whitespace
 * - removes leading "#"
 * - converts to lowercase
 * Example: "#HIS1", "HIS1", " his1 ", "#his1" all resolve to "his1"
 * But "#4536" resolves to "4536", which will only match if an actual campaign influencer has code "4536".
 */
export function normalizeInfluencerReference(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[\t\r\n]/g, ' ')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .toLowerCase();
}

export interface InfluencerMatchResult {
  matchedInfluencer?: CampaignInfluencer;
  matchedDispatch?: DispatchDetails;
  matchPriority?: 1 | 2 | 3 | 4 | 5;
  matchReason?: string;
}

/**
 * Matches a shipment to an influencer using strict priority rules:
 * 1. Influencer Code
 * 2. Explicit Influencer ID (only if already set on shipment)
 * 3. Order ID matching canonical Influencer Code
 * 4. AWB mapping to existing dispatch tracking ID
 * 5. Existing dispatch record relationship
 * 
 * Never converts arbitrary customer numeric IDs into influencer IDs.
 * Never matches solely by generic display name or phone.
 */
export function matchShipmentToInfluencer(
  shipment: InfluencerDispatchedShipment,
  campaignInfluencers: CampaignInfluencer[],
  dispatchRecords: DispatchDetails[]
): InfluencerMatchResult {
  const cleanShipCode = normalizeInfluencerReference(shipment.influencerCode);
  const cleanOrderId = normalizeInfluencerReference(shipment.orderId);
  const cleanShipInfId = shipment.influencerId ? String(shipment.influencerId).trim() : '';
  const cleanAwb = (shipment.awbNumber || '').trim().toLowerCase();

  // -------------------------------------------------------------
  // Priority 1: Influencer Code
  // -------------------------------------------------------------
  if (cleanShipCode) {
    const infByCode = campaignInfluencers.find(inf => {
      const code = normalizeInfluencerReference(inf.code);
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
      const code = normalizeInfluencerReference((d as any).influencer_code);
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
  // Priority 2: Influencer ID / internal ID (Only if explicitly assigned on shipment)
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

  // -------------------------------------------------------------
  // Priority 3: Order ID / shipment relationship matching canonical Influencer Code
  // -------------------------------------------------------------
  if (cleanOrderId) {
    const infByOrderAsCode = campaignInfluencers.find(inf => {
      const code = normalizeInfluencerReference(inf.code);
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

/**
 * Ensures candidate influencers and dispatch records for the campaign are loaded.
 * If not provided or empty (e.g. during async React render/mount), automatically fetches
 * all influencers and dispatches directly from Supabase to prevent empty-state matching bugs.
 */
export async function ensureCampaignInfluencersAndDispatches(
  campaignId: string | number,
  candidateInfluencers?: CampaignInfluencer[],
  dispatchRecords?: DispatchDetails[]
): Promise<{ influencers: CampaignInfluencer[]; dispatches: DispatchDetails[] }> {
  const cleanCampaignId = String(campaignId).trim();
  const numericCampaignId = Number(cleanCampaignId);

  let influencers = candidateInfluencers && candidateInfluencers.length > 0 ? [...candidateInfluencers] : [];
  let dispatches = dispatchRecords && dispatchRecords.length > 0 ? [...dispatchRecords] : [];

  if (influencers.length === 0 && cleanCampaignId) {
    try {
      let query = supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*');

      if (!isNaN(numericCampaignId)) {
        query = query.or(`campaign_id.eq.${cleanCampaignId},campaign_id.eq.${numericCampaignId}`);
      } else {
        query = query.eq('campaign_id', cleanCampaignId);
      }

      const { data: dbInfs, error } = await query;
      if (!error && dbInfs) {
        influencers = dbInfs as unknown as CampaignInfluencer[];
      }
    } catch (e) {
      console.warn('Could not auto-fetch campaign influencers:', e);
    }
  }

  if (dispatches.length === 0 && cleanCampaignId) {
    try {
      let query = supabaseAdmin
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('*');

      if (!isNaN(numericCampaignId)) {
        query = query.or(`campaign_id.eq.${cleanCampaignId},campaign_id.eq.${numericCampaignId}`);
      } else {
        query = query.eq('campaign_id', cleanCampaignId);
      }

      const { data: dbDispatches, error } = await query;
      if (!error && dbDispatches) {
        dispatches = dbDispatches as unknown as DispatchDetails[];
      }
    } catch (e) {
      console.warn('Could not auto-fetch campaign dispatches:', e);
    }
  }

  return { influencers, dispatches };
}

/**
 * Resolves the influencer ID associated with a shipment using 4 layers of resolution:
 * 1. shipment.influencerId (if already populated)
 * 2. matchShipmentToInfluencer using campaignInfluencers & dispatchRecords
 * 3. Database lookup in influencer_dispatch_details_rows matching tracking_id = shipment.awbNumber
 * 4. Database lookup in influencers_info_rows matching code = shipment.influencerCode or orderId
 */
export async function resolveShipmentInfluencerId(
  campaignId: string | number,
  shipment: InfluencerDispatchedShipment,
  campaignInfluencers: CampaignInfluencer[],
  dispatchRecords: DispatchDetails[]
): Promise<string | null> {
  // Layer 1: Direct property on shipment
  if (shipment.influencerId) {
    return String(shipment.influencerId);
  }

  // Layer 2: 5-priority matching using candidate influencers & dispatches
  const { matchedInfluencer } = matchShipmentToInfluencer(shipment, campaignInfluencers, dispatchRecords);
  if (matchedInfluencer?.id) {
    return String(matchedInfluencer.id);
  }

  const cleanCampaignId = String(campaignId).trim();
  const numericCampaignId = Number(cleanCampaignId);
  const cleanAwb = (shipment.awbNumber || '').trim();
  const cleanCode = (shipment.influencerCode || '').replace(/^#+/, '').trim();
  const cleanOrderId = (shipment.orderId || '').replace(/^#+/, '').trim();

  // Layer 3: Direct DB lookup in influencer_dispatch_details_rows by AWB / tracking_id
  if (cleanAwb) {
    try {
      let query = supabaseAdmin
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('influencer_id')
        .ilike('tracking_id', cleanAwb);

      if (!isNaN(numericCampaignId)) {
        query = query.or(`campaign_id.eq.${cleanCampaignId},campaign_id.eq.${numericCampaignId}`);
      } else {
        query = query.eq('campaign_id', cleanCampaignId);
      }

      const { data: dispRows, error: dispErr } = await query.limit(1);
      if (!dispErr && dispRows && dispRows.length > 0 && dispRows[0].influencer_id) {
        return String(dispRows[0].influencer_id);
      }
    } catch (e) {
      console.warn('Fallback dispatch lookup failed:', e);
    }
  }

  // Layer 4: Direct DB lookup in influencers_info_rows by code or orderId
  const searchCodes = [cleanCode, cleanOrderId].filter(Boolean);
  if (searchCodes.length > 0) {
    try {
      let query = supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .select('id, code');

      if (!isNaN(numericCampaignId)) {
        query = query.or(`campaign_id.eq.${cleanCampaignId},campaign_id.eq.${numericCampaignId}`);
      } else {
        query = query.eq('campaign_id', cleanCampaignId);
      }

      const { data: infRows, error: infErr } = await query;
      if (!infErr && infRows && infRows.length > 0) {
        const matched = infRows.find(inf => {
          const infCode = (inf.code || '').replace(/^#+/, '').trim().toLowerCase();
          return searchCodes.some(sc => sc.toLowerCase() === infCode || sc === String(inf.id));
        });
        if (matched?.id) {
          return String(matched.id);
        }
      }
    } catch (e) {
      console.warn('Fallback influencer info lookup failed:', e);
    }
  }

  return null;
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
 * Determines whether Step 1: Delivery Confirmation is genuinely completed in the Status Tracking workflow.
 * Requires:
 * 1. delivered_confirmed === true
 * AND
 * 2. delivery_photo_url is present (uploaded proof image) OR legacy record has already progressed to later steps.
 */
export function isDeliveryStepCompleted(record: any): boolean {
  if (!record) return false;

  // If explicitly not confirmed, definitely not completed
  if (!record.delivered_confirmed) return false;

  // Genuine completion requires delivery proof photo
  if (record.delivery_photo_url && typeof record.delivery_photo_url === 'string' && record.delivery_photo_url.trim() !== '') {
    return true;
  }

  // Check notes for metadata delivery_photo_url
  try {
    const meta = typeof record.notes === 'string' ? JSON.parse(record.notes) : record.notes;
    if (meta?.delivery_photo_url && typeof meta.delivery_photo_url === 'string' && meta.delivery_photo_url.trim() !== '') {
      return true;
    }
  } catch (e) {}

  // Preserve legacy records from older campaigns that had already progressed to later workflow steps
  if (
    Number(record.current_step) >= 2 ||
    record.draft_received ||
    record.pay_advance_completed ||
    record.final_post_completed
  ) {
    return true;
  }

  return false;
}

/**
 * Idempotently moves a single delivered shipment to Status Tracking.
 * - Only 'Delivered' shipments are eligible.
 * - If the influencer already has a Status Tracking record for this campaign,
 *   it preserves all existing progress and returns alreadyExisted = true.
 * - If not present, inserts a new record with current_step: 0, delivered_confirmed: false, status: 'Not Started'.
 */
export async function handoffDeliveredShipmentToStatusTracking(
  campaignId: string | number,
  shipment: InfluencerDispatchedShipment,
  campaignInfluencers?: CampaignInfluencer[],
  dispatchRecords?: DispatchDetails[]
): Promise<HandoffResult> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) {
    return { success: false, alreadyExisted: false, error: 'Campaign ID is required.' };
  }

  if (!isShipmentDelivered(shipment)) {
    return {
      success: false,
      alreadyExisted: false,
      error: `Shipment status is "${shipment.status}". Only "Delivered" shipments qualify for Status Tracking.`
    };
  }

  // Ensure campaign influencers and dispatches are available (auto-fetches from Supabase if empty)
  const { influencers, dispatches } = await ensureCampaignInfluencersAndDispatches(
    cleanCampaignId,
    campaignInfluencers,
    dispatchRecords
  );

  // Match influencer safely
  const { matchedInfluencer, matchedDispatch, matchReason } = matchShipmentToInfluencer(
    shipment,
    influencers,
    dispatches
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
      }
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
        await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .update({
            dispatch_status: 'Tracking',
            tracking_id: shipment.awbNumber || undefined,
            courier_partner: shipment.courier || undefined,
            dispatch_date: shipment.dispatchedDate || shipment.dispatchDate || undefined,
            expected_delivery_date: shipment.estimatedDeliveryDate || shipment.expectedDeliveryDate || undefined
          })
          .eq('id', dispatchId);
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
            dispatch_date: shipment.dispatchedDate || shipment.dispatchDate || null,
            expected_delivery_date: shipment.estimatedDeliveryDate || shipment.expectedDeliveryDate || null,
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
        .update({
          dispatch_status: 'Tracking',
          tracking_id: shipment.awbNumber || undefined,
          courier_partner: shipment.courier || undefined,
          dispatch_date: shipment.dispatchedDate || shipment.dispatchDate || undefined,
          expected_delivery_date: shipment.estimatedDeliveryDate || shipment.expectedDeliveryDate || undefined
        })
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

    // 4. Insert new Status Tracking row (Step 1 Delivery is confirmed)
    const nowIso = new Date().toISOString();
    const deliveredDateVal = shipment.deliveredDate || nowIso.split('T')[0];
    const initialNotes = JSON.stringify({
      delivered_date: deliveredDateVal,
      handoff_source: 'Tracking',
      source_courier: shipment.courier,
      source_awb: shipment.awbNumber
    });

    const trackingPayload: any = {
      id: nextId,
      campaign_id: isNaN(Number(cleanCampaignId)) ? cleanCampaignId : Number(cleanCampaignId),
      influencer_id: isNaN(Number(cleanInfId)) ? cleanInfId : Number(cleanInfId),
      dispatch_id: dispatchId ? (isNaN(Number(dispatchId)) ? dispatchId : Number(dispatchId)) : null,
      current_step: 0,
      delivered_confirmed: false,
      delivery_photo_url: null,
      pay_advance_completed: false,
      reference_video_received: false,
      expected_delivery_completed: false,
      draft_received: false,
      payment_remaining_completed: false,
      final_post_completed: false,
      notes: initialNotes,
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

    // 5. Dispatch sync events to refresh UI immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
      window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
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
  campaignInfluencers?: CampaignInfluencer[],
  dispatchRecords?: DispatchDetails[]
): Promise<BulkHandoffSummary> {
  const cleanCampaignId = String(campaignId).trim();
  const delivered = shipments.filter(s => isShipmentDelivered(s));
  const existingSet = await fetchCampaignStatusTrackingInfluencerIds(cleanCampaignId);

  const summary: BulkHandoffSummary = {
    totalDelivered: delivered.length,
    addedCount: 0,
    alreadyPresentCount: 0,
    unmatchedCount: 0,
    failedCount: 0,
    results: []
  };

  // Ensure campaign influencers and dispatches are available (auto-fetches from Supabase if empty)
  const { influencers, dispatches } = await ensureCampaignInfluencersAndDispatches(
    cleanCampaignId,
    campaignInfluencers,
    dispatchRecords
  );

  // Group delivered shipments by matched influencer to avoid duplicate work
  const processedInfluencerIds = new Set<string>();

  for (const s of delivered) {
    const { matchedInfluencer } = matchShipmentToInfluencer(s, influencers, dispatches);

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
      cleanCampaignId,
      s,
      influencers,
      dispatches
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
    window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
  }

  return summary;
}

/**
 * Permanently deletes a single tracking shipment from Supabase & localStorage,
 * and if that shipment was linked to a Status Tracking row, removes the corresponding
 * row from influencer_status_tracking_rows (provided no other tracking shipments for this influencer remain).
 * MASTER INFLUENCER RECORDS IN influencers_info_rows ARE NEVER DELETED.
 */
export async function deleteShipmentWithStatusTrackingSync(
  campaignId: string | number,
  shipment: InfluencerDispatchedShipment,
  candidateInfluencers?: CampaignInfluencer[],
  dispatchRecords?: DispatchDetails[]
): Promise<{ success: boolean; error?: string; deletedStatusTracking: boolean }> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) {
    return { success: false, error: 'Campaign ID required', deletedStatusTracking: false };
  }

  try {
    // 0. Ensure influencers and dispatches are available (auto-fetches from Supabase if empty)
    const { influencers, dispatches } = await ensureCampaignInfluencersAndDispatches(
      cleanCampaignId,
      candidateInfluencers,
      dispatchRecords
    );

    // 1. Resolve matched influencer using canonical 4-layer resolution
    const targetInfluencerId = await resolveShipmentInfluencerId(
      cleanCampaignId,
      shipment,
      influencers,
      dispatches
    );

    // 2. Delete the shipment from influencer_tracking_shipments & localStorage
    const deleteShipmentRes = await deleteSingleCampaignShipmentFromDb(cleanCampaignId, shipment);
    if (!deleteShipmentRes.success) {
      return { success: false, error: deleteShipmentRes.error, deletedStatusTracking: false };
    }

    let deletedStatusTracking = false;

    // 3. If there is a targetInfluencerId, verify if any remaining tracking shipment in this campaign links to this influencer
    if (targetInfluencerId) {
      const remainingShipments = await fetchCampaignShipmentsFromDb(cleanCampaignId);
      let otherShipmentForSameInfluencer = false;
      for (const s of remainingShipments) {
        if (s.id === shipment.id) continue;
        if (s.influencerId && String(s.influencerId) === String(targetInfluencerId)) {
          otherShipmentForSameInfluencer = true;
          break;
        }
        const otherInfId = await resolveShipmentInfluencerId(cleanCampaignId, s, influencers, dispatches);
        if (otherInfId && String(otherInfId) === String(targetInfluencerId)) {
          otherShipmentForSameInfluencer = true;
          break;
        }
      }

      // If no other shipment links to this influencer, safely remove the status tracking row
      if (!otherShipmentForSameInfluencer) {
        const numericCampaignId = Number(cleanCampaignId);
        const numericInfId = Number(targetInfluencerId);
        const campQuery = !isNaN(numericCampaignId) ? numericCampaignId : cleanCampaignId;
        const infQuery = !isNaN(numericInfId) ? numericInfId : String(targetInfluencerId);

        const { error: statusDeleteError } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .delete()
          .eq('campaign_id', campQuery)
          .eq('influencer_id', infQuery);

        if (statusDeleteError) {
          console.warn('Could not delete corresponding status tracking row:', statusDeleteError);
        } else {
          deletedStatusTracking = true;
        }
      }
    }

    // 4. Dispatch sync events to refresh UI reactively
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
      window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
    }

    return { success: true, deletedStatusTracking };
  } catch (err: any) {
    console.error('deleteShipmentWithStatusTrackingSync exception:', err);
    return { success: false, error: err?.message || String(err), deletedStatusTracking: false };
  }
}

/**
 * Permanently deletes ALL tracking shipments for a campaign from Supabase & localStorage,
 * and automatically removes ONLY the corresponding Status Tracking rows for those influencers
 * who belonged to the tracking dataset being cleared.
 *
 * SAFETY RULES:
 * - Unrelated Status Tracking records (e.g. HIS2, HIS5) are completely preserved.
 * - Master influencer records in influencers_info_rows are NEVER deleted.
 */
export async function clearAllCampaignTrackingWithStatusSync(
  campaignId: string | number,
  candidateInfluencers?: CampaignInfluencer[],
  dispatchRecords?: DispatchDetails[]
): Promise<{ success: boolean; deletedShipmentCount: number; deletedStatusCount: number; error?: string }> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) {
    return { success: false, deletedShipmentCount: 0, deletedStatusCount: 0, error: 'Campaign ID required' };
  }

  try {
    // 1. Fetch current tracking shipments to identify exactly which influencers belong to this tracking dataset
    const currentShipments = await fetchCampaignShipmentsFromDb(cleanCampaignId);

    // 2. Ensure influencers and dispatches are available (auto-fetches from Supabase if empty)
    const { influencers, dispatches } = await ensureCampaignInfluencersAndDispatches(
      cleanCampaignId,
      candidateInfluencers,
      dispatchRecords
    );

    // 3. Identify all influencer IDs that are linked to these shipments
    const linkedInfluencerIds = new Set<string>();
    for (const s of currentShipments) {
      const infId = await resolveShipmentInfluencerId(cleanCampaignId, s, influencers, dispatches);
      if (infId) {
        linkedInfluencerIds.add(String(infId));
      }
    }

    // 4. Delete all tracking shipments from influencer_tracking_shipments & localStorage
    const deleteRes = await deleteCampaignShipmentsFromDb(cleanCampaignId);
    if (!deleteRes.success) {
      return {
        success: false,
        deletedShipmentCount: 0,
        deletedStatusCount: 0,
        error: deleteRes.error
      };
    }

    let deletedStatusCount = 0;

    // 5. Delete ONLY those Status Tracking rows belonging to the linked influencers
    // (Leaves unrelated influencers like HIS2, HIS5 untouched!)
    // NEVER deletes from influencers_info_rows!
    if (linkedInfluencerIds.size > 0) {
      const numericCampaignId = Number(cleanCampaignId);
      const campQuery = !isNaN(numericCampaignId) ? numericCampaignId : cleanCampaignId;

      const influencerIdArray = Array.from(linkedInfluencerIds);
      const numericInfIds = influencerIdArray.map(id => Number(id)).filter(n => !isNaN(n));
      const idsToDelete = numericInfIds.length === influencerIdArray.length ? numericInfIds : influencerIdArray;

      const { data: deletedStatusRows, error: statusErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .delete()
        .eq('campaign_id', campQuery)
        .in('influencer_id', idsToDelete)
        .select('id');

      if (statusErr) {
        console.warn('Error deleting linked status tracking records:', statusErr);
      } else if (deletedStatusRows) {
        deletedStatusCount = deletedStatusRows.length;
      }
    }

    // 6. Clean up Dexie tracking-stage orders if present
    try {
      if (db?.logistics_orders) {
        await db.logistics_orders.where('stage').equals('tracking').delete();
      }
      if (db?.tracking_logs) {
        await db.tracking_logs.clear();
      }
    } catch (dexieErr) {
      console.warn('Dexie tracking cleanup warning:', dexieErr);
    }

    // 7. Dispatch sync events to refresh all views reactively
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
      window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
    }

    return {
      success: true,
      deletedShipmentCount: deleteRes.deletedCount || 0,
      deletedStatusCount
    };
  } catch (err: any) {
    console.error('clearAllCampaignTrackingWithStatusSync exception:', err);
    return {
      success: false,
      deletedShipmentCount: 0,
      deletedStatusCount: 0,
      error: err?.message || String(err)
    };
  }
}
