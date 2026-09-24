import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';

export type ShipmentType = 'ORIGINAL' | 'RE_DISPATCH';
export type ShipmentIssueType = 'DAMAGED_PRODUCT' | 'MISSING_PRODUCT' | 'WRONG_PRODUCT' | 'OTHER';

export interface ShipmentAttempt {
  id: string;
  parent_attempt_id: string | null;
  campaign_id: string;
  influencer_id: number;
  attempt_number: number;
  shipment_type: ShipmentType;
  courier: string | null;
  order_id: string | null;
  awb_number: string | null;
  shipment_status: string;
  dispatch_date: string | null;
  estimated_delivery_date: string | null;
  delivered_date: string | null;
  remarks: string | null;
  issue_reported: boolean;
  issue_type: ShipmentIssueType | null;
  issue_remarks: string | null;
  issue_proof_url: string | null;
  issue_reported_at: string | null;
  delivery_proof_url: string | null;
  delivery_confirmed: boolean;
  status_tracking_started: boolean;
  created_at: string;
  updated_at: string;
}

import { normalizeOrderId } from '../utils/orderIdUtils';

/**
 * Normalizes an influencer code or Order ID reference by stripping leading '#' characters and whitespace.
 */
export function cleanCodeRef(val?: string | null): string {
  if (!val) return '';
  return String(val).replace(/[\t\r\n]/g, ' ').trim().replace(/^#+/, '').trim();
}

/**
 * Generates the Courier-compliant Order ID for a shipment attempt:
 * - Delhivery:
 *   - Attempt 1: #HIS1
 *   - Attempt 2: #RHIS1
 *   - Attempt 3: #RRHIS1
 *   - Attempt N: #${'R'.repeat(attempt_number - 1)}${code}
 * - ST Courier / Others:
 *   - Uses the canonical code (e.g. HIS1), differentiated internally by shipment_attempts.id
 */
export function generateReDispatchOrderId(
  influencerCode: string,
  courier?: string | null,
  attemptNumber: number = 1
): string {
  const info = normalizeOrderId(influencerCode);
  const code = info.baseCode || cleanCodeRef(influencerCode);
  if (!code) return '';
  
  const isDelhivery = (courier || '').toLowerCase().includes('delhivery');
  if (isDelhivery) {
    if (attemptNumber <= 1) {
      return `#${code}`;
    }
    const rPrefix = 'R'.repeat(attemptNumber - 1);
    return `#${rPrefix}${code}`;
  }

  // ST Courier and other couriers
  return code;
}

/**
 * Extracts the canonical influencer code from an Order ID by stripping '#' and any leading 'R' repeat prefixes.
 * Examples:
 * - "#HIS1"   -> "HIS1"
 * - "#RHIS1"  -> "HIS1"
 * - "#RRHIS1" -> "HIS1"
 * - "RHIS1"   -> "HIS1"
 * - "R HIS1"  -> "HIS1"
 * - "HIS1"    -> "HIS1"
 */
export function extractInfluencerCodeFromOrderId(orderId?: string | null): string {
  if (!orderId) return '';
  const info = normalizeOrderId(orderId);
  return info.baseCode || cleanCodeRef(orderId);
}

export const shipmentAttemptService = {
  /**
   * Fetches all shipment attempts for a specific influencer in a campaign, ordered by attempt_number ascending.
   */
  async getShipmentAttempts(
    campaignId: string | number,
    influencerId: string | number
  ): Promise<ShipmentAttempt[]> {
    const cId = String(campaignId).trim();
    const infId = Number(influencerId);
    if (!cId || isNaN(infId)) return [];

    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.shipmentAttempts)
        .select('*')
        .eq('campaign_id', cId)
        .eq('influencer_id', infId)
        .order('attempt_number', { ascending: true });

      if (error) {
        console.error('Error fetching shipment attempts:', error);
        return [];
      }
      return (data || []) as ShipmentAttempt[];
    } catch (e) {
      console.error('Exception in getShipmentAttempts:', e);
      return [];
    }
  },

  /**
   * Fetches all shipment attempts for an entire campaign.
   */
  async getCampaignShipmentAttempts(campaignId: string | number): Promise<ShipmentAttempt[]> {
    const cId = String(campaignId).trim();
    if (!cId) return [];

    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.shipmentAttempts)
        .select('*')
        .eq('campaign_id', cId)
        .order('attempt_number', { ascending: true });

      if (error) {
        console.error('Error fetching campaign shipment attempts:', error);
        return [];
      }
      return (data || []) as ShipmentAttempt[];
    } catch (e) {
      console.error('Exception in getCampaignShipmentAttempts:', e);
      return [];
    }
  },

  /**
   * Gets the latest/current shipment attempt for an influencer.
   */
  async getLatestShipmentAttempt(
    campaignId: string | number,
    influencerId: string | number
  ): Promise<ShipmentAttempt | null> {
    const attempts = await this.getShipmentAttempts(campaignId, influencerId);
    if (attempts.length === 0) return null;
    return attempts[attempts.length - 1];
  },

  /**
   * Creates an Initial Shipment Attempt (Attempt 1, ORIGINAL).
   * Safe & Idempotent: If Attempt 1 already exists, returns the existing attempt.
   */
  async createInitialShipmentAttempt(params: {
    campaign_id: string | number;
    influencer_id: string | number;
    influencer_code: string;
    courier?: string | null;
    awb_number?: string | null;
    order_id?: string | null;
    dispatch_date?: string | null;
    estimated_delivery_date?: string | null;
    remarks?: string | null;
  }): Promise<ShipmentAttempt | null> {
    const cId = String(params.campaign_id).trim();
    const infId = Number(params.influencer_id);
    if (!cId || isNaN(infId)) return null;

    try {
      // Check existing attempts
      const existing = await this.getShipmentAttempts(cId, infId);
      if (existing.length > 0) {
        // Return existing Attempt 1
        return existing[0];
      }

      const courier = params.courier || null;
      const orderId = params.order_id || generateReDispatchOrderId(params.influencer_code, courier, 1);

      const payload = {
        campaign_id: cId,
        influencer_id: infId,
        attempt_number: 1,
        shipment_type: 'ORIGINAL',
        courier,
        order_id: orderId,
        awb_number: params.awb_number || null,
        shipment_status: params.awb_number ? 'In Transit' : 'Pending',
        dispatch_date: params.dispatch_date || new Date().toISOString().split('T')[0],
        estimated_delivery_date: params.estimated_delivery_date || null,
        remarks: params.remarks || null,
        parent_attempt_id: null,
        issue_reported: false,
        delivery_confirmed: false,
        status_tracking_started: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from(SUPABASE_TABLES.shipmentAttempts)
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error creating initial shipment attempt:', error);
        return null;
      }

      this.notifyUpdates(cId);
      return data as ShipmentAttempt;
    } catch (e) {
      console.error('Exception in createInitialShipmentAttempt:', e);
      return null;
    }
  },

  /**
   * Creates a Replacement Shipment Attempt (Attempt N+1, RE_DISPATCH).
   * Links parent_attempt_id to the previous attempt to maintain the audit chain.
   */
  async createReDispatchAttempt(params: {
    campaign_id: string | number;
    influencer_id: string | number;
    influencer_code: string;
    courier?: string | null;
    awb_number?: string | null;
    order_id?: string | null;
    dispatch_date?: string | null;
    estimated_delivery_date?: string | null;
    remarks?: string | null;
  }): Promise<ShipmentAttempt | null> {
    const cId = String(params.campaign_id).trim();
    const infId = Number(params.influencer_id);
    if (!cId || isNaN(infId)) return null;

    try {
      const existing = await this.getShipmentAttempts(cId, infId);
      const prevAttempt = existing.length > 0 ? existing[existing.length - 1] : null;
      const nextAttemptNumber = prevAttempt ? prevAttempt.attempt_number + 1 : 1;
      const shipmentType: ShipmentType = nextAttemptNumber === 1 ? 'ORIGINAL' : 'RE_DISPATCH';

      const courier = params.courier || prevAttempt?.courier || null;
      const orderId = params.order_id || generateReDispatchOrderId(params.influencer_code, courier, nextAttemptNumber);

      const payload = {
        campaign_id: cId,
        influencer_id: infId,
        parent_attempt_id: prevAttempt ? prevAttempt.id : null,
        attempt_number: nextAttemptNumber,
        shipment_type: shipmentType,
        courier,
        order_id: orderId,
        awb_number: params.awb_number || null,
        shipment_status: params.awb_number ? 'In Transit' : 'Pending',
        dispatch_date: params.dispatch_date || new Date().toISOString().split('T')[0],
        estimated_delivery_date: params.estimated_delivery_date || null,
        remarks: params.remarks || null,
        issue_reported: false,
        delivery_confirmed: false,
        status_tracking_started: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from(SUPABASE_TABLES.shipmentAttempts)
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error creating re-dispatch shipment attempt:', error);
        return null;
      }

      // Update influencer_dispatch_details_rows with the new attempt info
      await supabaseAdmin
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({
          dispatch_status: 'Dispatched',
          courier_partner: courier,
          tracking_id: params.awb_number || null,
          dispatch_date: payload.dispatch_date,
          expected_delivery_date: payload.estimated_delivery_date,
          delivered_date: null
        })
        .eq('campaign_id', isNaN(Number(cId)) ? cId : Number(cId))
        .eq('influencer_id', infId);

      this.notifyUpdates(cId);
      return data as ShipmentAttempt;
    } catch (e) {
      console.error('Exception in createReDispatchAttempt:', e);
      return null;
    }
  },

  /**
   * Reports a product issue for the active shipment attempt and transitions influencer to Re-Dispatch.
   * - Preserves the attempt and stores issue details.
   * - Sets influencer status tracking status = 'Re-Dispatch Required' and delivered_confirmed = false.
   * - Sets influencer dispatch_status = 're_dispatch' so they appear in Logistics for Prepare Dispatch.
   */
  async reportShipmentIssue(
    attemptId: string,
    issueData: {
      issue_type: ShipmentIssueType;
      issue_remarks?: string;
      issue_proof_url?: string;
    }
  ): Promise<{ success: boolean; attempt?: ShipmentAttempt; error?: any }> {
    try {
      const nowIso = new Date().toISOString();

      // 1. Fetch attempt to get campaign_id and influencer_id
      const { data: attempt, error: fetchErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.shipmentAttempts)
        .select('*')
        .eq('id', attemptId)
        .single();

      if (fetchErr || !attempt) {
        return { success: false, error: fetchErr || new Error('Shipment attempt not found') };
      }

      // 2. Update shipment_attempts row
      const { data: updatedAttempt, error: updateAttemptErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.shipmentAttempts)
        .update({
          issue_reported: true,
          issue_type: issueData.issue_type,
          issue_remarks: issueData.issue_remarks || null,
          issue_proof_url: issueData.issue_proof_url || null,
          issue_reported_at: nowIso,
          shipment_status: 'Issue Reported',
          delivery_confirmed: false,
          updated_at: nowIso
        })
        .eq('id', attemptId)
        .select()
        .single();

      if (updateAttemptErr) {
        console.error('Error reporting shipment issue on attempt:', updateAttemptErr);
        return { success: false, error: updateAttemptErr };
      }

      const campaignId = attempt.campaign_id;
      const influencerId = attempt.influencer_id;
      const numCampaignId = isNaN(Number(campaignId)) ? campaignId : Number(campaignId);
      const numInfId = Number(influencerId);

      // 3. Update influencer_dispatch_details_rows -> 're_dispatch'
      await supabaseAdmin
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({
          dispatch_status: 're_dispatch',
          remarks: `Issue Reported: ${issueData.issue_type}${issueData.issue_remarks ? ' - ' + issueData.issue_remarks : ''}`
        })
        .eq('campaign_id', numCampaignId)
        .eq('influencer_id', numInfId);

      // Also update influencers_info_rows -> 're_dispatch'
      await supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .update({
          dispatch_status: 're_dispatch'
        })
        .eq('id', numInfId);

      // 4. Update influencer_status_tracking_rows -> 'Re-Dispatch Required', reset delivery confirmation
      const { data: existingStatus } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .select('id, notes')
        .eq('campaign_id', String(campaignId))
        .eq('influencer_id', String(influencerId))
        .maybeSingle();

      let notesObj: any = {};
      if (existingStatus?.notes) {
        try {
          notesObj = typeof existingStatus.notes === 'string' ? JSON.parse(existingStatus.notes) : existingStatus.notes;
        } catch (e) {
          notesObj = {};
        }
      }

      notesObj.issue_reported = true;
      notesObj.issue_type = issueData.issue_type;
      notesObj.issue_remarks = issueData.issue_remarks || '';
      notesObj.issue_proof_url = issueData.issue_proof_url || '';
      notesObj.issue_reported_at = nowIso;
      notesObj.re_dispatch_required = true;
      notesObj.delivered_confirmed = false;
      notesObj.last_updated = nowIso;

      if (existingStatus?.id) {
        await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .update({
            delivered_confirmed: false,
            current_step: 0,
            status: 'Re-Dispatch Required',
            notes: JSON.stringify(notesObj),
            updated_at: nowIso
          })
          .eq('id', existingStatus.id);
      }

      this.notifyUpdates(campaignId);
      return { success: true, attempt: updatedAttempt as ShipmentAttempt };
    } catch (e: any) {
      console.error('Exception in reportShipmentIssue:', e);
      return { success: false, error: e };
    }
  },

  /**
   * Confirms delivery for the active shipment attempt with delivery proof.
   */
  async confirmShipmentDelivery(
    attemptId: string,
    deliveryProofUrl: string
  ): Promise<{ success: boolean; attempt?: ShipmentAttempt; error?: any }> {
    try {
      const nowIso = new Date().toISOString();
      const { data: updatedAttempt, error } = await supabaseAdmin
        .from(SUPABASE_TABLES.shipmentAttempts)
        .update({
          delivery_confirmed: true,
          delivery_proof_url: deliveryProofUrl,
          issue_reported: false,
          shipment_status: 'Delivered',
          delivered_date: nowIso.split('T')[0],
          status_tracking_started: true,
          updated_at: nowIso
        })
        .eq('id', attemptId)
        .select()
        .single();

      if (error) {
        console.error('Error confirming delivery on attempt:', error);
        return { success: false, error };
      }

      if (updatedAttempt) {
        this.notifyUpdates(updatedAttempt.campaign_id);
      }

      return { success: true, attempt: updatedAttempt as ShipmentAttempt };
    } catch (e: any) {
      console.error('Exception in confirmShipmentDelivery:', e);
      return { success: false, error: e };
    }
  },

  /**
   * Resets status tracking record for a newly delivered replacement attempt.
   * Step 1 starts uncompleted ("Not Started") until manually confirmed.
   */
  async resetStatusTrackingForNewAttempt(
    campaignId: string | number,
    influencerId: string | number,
    attemptId: string
  ): Promise<boolean> {
    const cId = String(campaignId).trim();
    const infId = String(influencerId).trim();
    try {
      const { data: existingStatus } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .select('id, notes')
        .eq('campaign_id', cId)
        .eq('influencer_id', infId)
        .maybeSingle();

      if (!existingStatus) return false;

      let notesObj: any = {};
      try {
        notesObj = typeof existingStatus.notes === 'string' ? JSON.parse(existingStatus.notes) : existingStatus.notes;
      } catch (e) {
        notesObj = {};
      }

      notesObj.active_attempt_id = attemptId;
      notesObj.delivered_confirmed = false;
      notesObj.delivery_photo_url = null;
      notesObj.re_dispatch_required = false;

      await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .update({
          delivered_confirmed: false,
          delivery_photo_url: null,
          current_step: 0,
          status: 'Not Started',
          notes: JSON.stringify(notesObj),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStatus.id);

      this.notifyUpdates(cId);
      return true;
    } catch (e) {
      console.error('Exception resetting status tracking for new attempt:', e);
      return false;
    }
  },

  /**
   * Emits application-wide synchronization events across tabs and modules.
   */
  notifyUpdates(campaignId: string | number) {
    if (typeof window === 'undefined') return;
    const detail = { campaignId: String(campaignId) };
    window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail }));
    window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail }));
    window.dispatchEvent(new CustomEvent('velmora:influencer-updated', { detail }));
    window.dispatchEvent(new CustomEvent('dispatch_batches_updated', { detail }));
    window.dispatchEvent(new CustomEvent('shipment_attempts_updated', { detail }));
  }
};
