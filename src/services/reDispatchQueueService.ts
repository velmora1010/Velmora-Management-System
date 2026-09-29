import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { naturalSortCompare } from '../config/skuMapping';
import { dispatchBatchService } from './dispatchBatchService';
import { getCourierTrackingUrl } from './influencerTrackingService';
import { shipmentAttemptService } from './shipmentAttemptService';

export interface ReDispatchRecord {
  id: string;
  campaign_id: string;
  influencer_id: number | null;
  influencer_code: string;
  order_id: string | null;
  previous_awb: string | null;
  courier: string | null;
  issue_type: string | null;
  issue_remark: string | null;
  redispatch_status: 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'COMPLETED';
  moved_to_active_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReDispatchQueueItem {
  id: string; // unique key (UUID from redispatch_records)
  influencer_id: number;
  status_tracking_id?: string | number;
  dispatch_id?: string | number;
  code: string;
  order_id?: string;
  influencer_name: string;
  username: string;
  phone_number?: string;
  previous_awb: string;
  courier: string;
  issue_type: string;
  issue_remarks: string;
  issue_reported_at?: string;
  date_display: string;
  status: 'pending' | 'moved_to_active' | 'completed';
  redispatch_status: 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'COMPLETED';
  status_display: string;
  tracking_url?: string | null;
  profile_photo_url?: string;
  current_logistics_stage?: 'active' | 'prepare_dispatch' | 'dispatched';
  moved_to_active_at?: string | null;
  completed_at?: string | null;
}

export function formatQueueDate(rawDate?: string | null): string {
  if (!rawDate) return '-';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(rawDate);
  }
}

export function cleanCode(code?: string | null): string {
  if (!code) return '';
  return String(code).trim().replace(/^#+/, '');
}

export const reDispatchQueueService = {
  /**
   * Fetches all Re-Dispatch queue records from the dedicated `redispatch_records` Supabase table.
   * Enriches records with influencer info, current logistics status, and tracking URLs.
   */
  async fetchQueueItems(campaignId: string | number): Promise<ReDispatchQueueItem[]> {
    const cId = String(campaignId).trim();
    if (!cId) return [];

    try {
      const numCampId = Number(cId);
      const campQuery = !isNaN(numCampId) ? numCampId : cId;

      // 1. Fetch Authoritative Re-Dispatch Records from public.redispatch_records
      const { data: redispatchRows, error: rdErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .select('*')
        .eq('campaign_id', cId)
        .order('created_at', { ascending: false });

      if (rdErr) {
        console.error('Error fetching redispatch_records:', rdErr);
      }

      // If redispatch_records is empty for this campaign, run auto-migration/reconciliation
      if (!redispatchRows || redispatchRows.length === 0) {
        return await this.fallbackAndAutoMigrate(campaignId);
      }

      // 2. Fetch accompanying data in parallel to enrich view
      const [infoRes, dispRes, stRes, batchesRes] = await Promise.all([
        supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, code, influencer_name, name, phone_number, is_archived, profile_file_url')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id, influencer_id, creator_name, dispatch_status, tracking_id, courier_partner, remarks')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('id, influencer_id, status, notes')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', `influencer_dispatch_batches_${cId}`)
          .maybeSingle()
      ]);

      const infos = (infoRes.data || []) as any[];
      const dispatches = (dispRes.data || []) as any[];
      const stRows = (stRes.data || []) as any[];
      const batches = (batchesRes.data?.setting_value || []) as any[];

      const infoByCode = new Map<string, any>();
      const infoById = new Map<string, any>();
      infos.forEach(inf => {
        if (inf.id) infoById.set(String(inf.id), inf);
        if (inf.code) infoByCode.set(cleanCode(inf.code), inf);
      });

      const dispById = new Map<string, any>();
      dispatches.forEach(d => {
        if (d.influencer_id) dispById.set(String(d.influencer_id), d);
      });

      const stById = new Map<string, any>();
      stRows.forEach(st => {
        if (st.influencer_id) stById.set(String(st.influencer_id), st);
      });

      const batchMap = new Map<string, any[]>();
      batches.forEach(b => {
        (b.members || []).forEach((m: any) => {
          const k = String(m.influencer_id);
          if (!batchMap.has(k)) batchMap.set(k, []);
          batchMap.get(k)!.push(b);
        });
      });

      const items: ReDispatchQueueItem[] = [];

      for (const row of redispatchRows) {
        const code = cleanCode(row.influencer_code);
        const inf = (row.influencer_id ? infoById.get(String(row.influencer_id)) : null) || infoByCode.get(code);

        // Exclude archived influencers
        if (inf && (inf.is_archived === true || inf.is_archived === 'true' || inf.is_archived === 1)) {
          continue;
        }

        const infId = row.influencer_id || inf?.id || 0;
        const infIdStr = String(infId);
        const disp = dispById.get(infIdStr);
        const st = stById.get(infIdStr);

        const dispStatus = (disp?.dispatch_status || '').toLowerCase();
        const memberBatches = batchMap.get(infIdStr) || [];
        const isInPrepareBatch = memberBatches.some((b: any) => b.status === 'Preparing' || b.status === 'Pending');

        // Current logistics stage of the influencer (independent from redispatch_status)
        const currentStage: 'active' | 'prepare_dispatch' | 'dispatched' =
          (dispStatus === 'prepare_dispatch' || isInPrepareBatch) ? 'prepare_dispatch' :
          (dispStatus === 'dispatched' || dispStatus === 'tracking') ? 'dispatched' : 'active';

        const redispatchStatus = (row.redispatch_status || 'PENDING_REDISPATCH') as 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'COMPLETED';

        const status: 'pending' | 'moved_to_active' | 'completed' =
          redispatchStatus === 'MOVED_TO_ACTIVE' ? 'moved_to_active' :
          redispatchStatus === 'COMPLETED' ? 'completed' : 'pending';

        const statusDisplay =
          redispatchStatus === 'MOVED_TO_ACTIVE' ? 'Moved to Active' :
          redispatchStatus === 'COMPLETED' ? 'Completed' : 'Pending Re-Dispatch';

        const creatorName = (inf?.influencer_name || disp?.creator_name || '').trim();
        const handleName = (inf?.name || disp?.creator_name || '').trim();
        const cleanName = creatorName || handleName || 'Influencer';
        const usernameVal = handleName
          ? (handleName.startsWith('@') ? handleName : `@${handleName}`)
          : `@${cleanName.toLowerCase().replace(/\s+/g, '_')}`;

        const awbVal = (row.previous_awb || disp?.tracking_id || '').trim();
        const courierVal = (row.courier || disp?.courier_partner || 'Delhivery').trim();
        const trackingUrl = awbVal && courierVal ? getCourierTrackingUrl(courierVal, awbVal) : undefined;

        let issueTypeVal = (row.issue_type || 'Damaged Product').replace(/_/g, ' ');
        issueTypeVal = issueTypeVal.replace(/\b\w/g, (c: string) => c.toUpperCase());

        items.push({
          id: row.id,
          influencer_id: Number(infId),
          status_tracking_id: st?.id,
          dispatch_id: disp?.id,
          code,
          order_id: row.order_id || `#${code}`,
          influencer_name: cleanName,
          username: usernameVal,
          phone_number: inf?.phone_number || '',
          previous_awb: awbVal,
          courier: courierVal,
          issue_type: issueTypeVal,
          issue_remarks: row.issue_remark || '',
          issue_reported_at: row.created_at,
          date_display: formatQueueDate(row.created_at),
          status,
          redispatch_status: redispatchStatus,
          status_display: statusDisplay,
          tracking_url: trackingUrl,
          profile_photo_url: inf?.profile_file_url || '',
          current_logistics_stage: currentStage,
          moved_to_active_at: row.moved_to_active_at,
          completed_at: row.completed_at
        });
      }

      // Natural sort by Influencer Code (HIS1, HIS9, HIS12, KAS151, KAS175, etc.)
      items.sort((a, b) => naturalSortCompare(a.code, b.code));

      return items;
    } catch (err) {
      console.error('Error in fetchQueueItems:', err);
      return [];
    }
  },

  /**
   * Fallback and auto-migration method if redispatch_records is not yet populated for a campaign.
   */
  async fallbackAndAutoMigrate(campaignId: string | number): Promise<ReDispatchQueueItem[]> {
    const cId = String(campaignId).trim();
    const numCampId = Number(cId);
    const campQuery = !isNaN(numCampId) ? numCampId : cId;

    try {
      const [stRes, dispRes, infoRes, attemptsRes] = await Promise.all([
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('id, influencer_id, dispatch_id, status, notes, updated_at, created_at')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id, influencer_id, creator_name, dispatch_status, tracking_id, courier_partner, remarks')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, code, influencer_name, name, phone_number, is_archived, profile_file_url')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.shipmentAttempts)
          .select('*')
          .eq('campaign_id', cId)
      ]);

      const stRecords = (stRes.data || []) as any[];
      const dispatches = (dispRes.data || []) as any[];
      const infos = (infoRes.data || []) as any[];
      const attempts = (attemptsRes.data || []) as any[];

      const infoMap = new Map<string, any>();
      infos.forEach(inf => infoMap.set(String(inf.id), inf));

      const dispMap = new Map<string, any>();
      dispatches.forEach(d => dispMap.set(String(d.influencer_id), d));

      const attemptsByInf = new Map<string, any[]>();
      attempts.forEach(a => {
        const k = String(a.influencer_id);
        if (!attemptsByInf.has(k)) attemptsByInf.set(k, []);
        attemptsByInf.get(k)!.push(a);
      });

      const recordsToInsert: any[] = [];

      stRecords.forEach(st => {
        let meta: any = {};
        try {
          meta = typeof st.notes === 'string' ? JSON.parse(st.notes || '{}') : (st.notes || {});
        } catch (e) {
          meta = {};
        }

        const rawStatus = (st.status || '').toLowerCase();
        const disp = dispMap.get(String(st.influencer_id));
        const dispStatus = (disp?.dispatch_status || '').toLowerCase();
        const dispRemarks = (disp?.remarks || '').toLowerCase();
        const infAttempts = attemptsByInf.get(String(st.influencer_id)) || [];
        const hasIssueAttempt = infAttempts.some(a => a.issue_reported === true);

        const isCand = Boolean(
          meta.redispatch_lifecycle_status === 'MOVED_TO_ACTIVE' ||
          meta.redispatch_lifecycle_status === 'PENDING_REDISPATCH' ||
          meta.re_dispatch_moved_to_active === true ||
          meta.re_dispatch_required === true ||
          rawStatus.includes('re-dispatch') ||
          rawStatus.includes('redispatch') ||
          dispStatus.includes('re_dispatch') ||
          dispStatus.includes('redispatch') ||
          dispRemarks.includes('moved to active') ||
          dispRemarks.includes('issue reported') ||
          meta.shipment_issue ||
          meta.issue_reported ||
          hasIssueAttempt
        );

        if (!isCand) return;

        const inf = infoMap.get(String(st.influencer_id));
        if (inf && (inf.is_archived === true || inf.is_archived === 'true' || inf.is_archived === 1)) return;

        const isMoved = Boolean(
          meta.redispatch_lifecycle_status === 'MOVED_TO_ACTIVE' ||
          meta.re_dispatch_moved_to_active === true ||
          meta.moved_to_active === true ||
          rawStatus.includes('re-dispatch (active)') ||
          dispStatus === 're_dispatch' ||
          dispRemarks.includes('moved to active')
        );

        const isCompleted = meta.redispatch_lifecycle_status === 'COMPLETED' || meta.redispatch_completed === true;

        const codeVal = cleanCode(inf?.code || '');
        if (!codeVal) return;

        const latestAttempt = infAttempts[infAttempts.length - 1];
        const awbVal = disp?.tracking_id || meta.source_awb || latestAttempt?.awb_number || null;
        const courierVal = disp?.courier_partner || meta.source_courier || latestAttempt?.courier || 'Delhivery';

        const redispatchStatus = isCompleted ? 'COMPLETED' : isMoved ? 'MOVED_TO_ACTIVE' : 'PENDING_REDISPATCH';

        recordsToInsert.push({
          campaign_id: cId,
          influencer_id: st.influencer_id ? Number(st.influencer_id) : null,
          influencer_code: codeVal,
          order_id: latestAttempt?.order_id || `#${codeVal}`,
          previous_awb: awbVal,
          courier: courierVal,
          issue_type: meta.issue_type || latestAttempt?.issue_type || 'Damaged Product',
          issue_remark: meta.issue_remarks || latestAttempt?.issue_remarks || dispRemarks || 'Reported shipment issue',
          redispatch_status: redispatchStatus,
          moved_to_active_at: isMoved ? (meta.moved_to_active_at || new Date().toISOString()) : null,
          completed_at: isCompleted ? (meta.completed_at || new Date().toISOString()) : null,
          created_at: meta.issue_reported_at || st.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      if (recordsToInsert.length > 0) {
        await supabaseAdmin
          .from(SUPABASE_TABLES.redispatchRecords)
          .upsert(recordsToInsert, { onConflict: 'campaign_id,influencer_code' });
      }

      // Re-fetch using standard path
      return await this.fetchQueueItems(campaignId);
    } catch (e) {
      console.error('Error in fallbackAndAutoMigrate:', e);
      return [];
    }
  },

  /**
   * Records or updates a Re-Dispatch issue in the dedicated `redispatch_records` table.
   * Invoked when a shipment is marked as Re-Dispatch Required (e.g. from Step 1 Delivery Confirmation or Tracking).
   */
  async recordReDispatchIssue(
    campaignId: string | number,
    data: {
      influencer_id?: number | string | null;
      influencer_code: string;
      order_id?: string | null;
      previous_awb?: string | null;
      courier?: string | null;
      issue_type?: string | null;
      issue_remark?: string | null;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const cId = String(campaignId).trim();
    const code = cleanCode(data.influencer_code);
    if (!cId || !code) {
      return { success: false, error: 'Campaign ID and influencer code are required' };
    }

    try {
      const nowIso = new Date().toISOString();
      const numInfId = data.influencer_id ? Number(data.influencer_id) : null;

      const recordPayload = {
        campaign_id: cId,
        influencer_id: numInfId && !isNaN(numInfId) ? numInfId : null,
        influencer_code: code,
        order_id: data.order_id || `#${code}`,
        previous_awb: data.previous_awb || null,
        courier: data.courier || 'Delhivery',
        issue_type: data.issue_type || 'Damaged Product',
        issue_remark: data.issue_remark || '',
        redispatch_status: 'PENDING_REDISPATCH',
        moved_to_active_at: null,
        completed_at: null,
        updated_at: nowIso
      };

      const { error } = await supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .upsert(
          {
            ...recordPayload,
            created_at: nowIso
          },
          { onConflict: 'campaign_id,influencer_code' }
        );

      if (error) {
        console.error('Error upserting into redispatch_records:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Exception in recordReDispatchIssue:', err);
      return { success: false, error: err.message || 'Failed to record re-dispatch' };
    }
  },

  /**
   * Completes / resolves a Re-Dispatch lifecycle record in `redispatch_records`.
   * Invoked when replacement shipment is delivered and confirmed with no issue.
   */
  async completeReDispatch(
    campaignId: string | number,
    data: {
      influencer_id?: number | string | null;
      influencer_code?: string | null;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const cId = String(campaignId).trim();
    if (!cId) return { success: false, error: 'Missing campaign ID' };

    try {
      const nowIso = new Date().toISOString();
      const code = cleanCode(data.influencer_code);
      const infId = data.influencer_id ? Number(data.influencer_id) : null;

      let query = supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .update({
          redispatch_status: 'COMPLETED',
          completed_at: nowIso,
          updated_at: nowIso
        })
        .eq('campaign_id', cId);

      if (code) {
        query = query.eq('influencer_code', code);
      } else if (infId && !isNaN(infId)) {
        query = query.eq('influencer_id', infId);
      } else {
        return { success: false, error: 'Influencer code or ID required' };
      }

      const { error } = await query;
      if (error) {
        console.error('Error marking redispatch completed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Exception in completeReDispatch:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Moves a single influencer from the Re-Dispatch queue to Active for Re-Dispatch.
   * - Sets redispatch_records.redispatch_status = 'MOVED_TO_ACTIVE'
   * - Sets influencer_dispatch_details_rows.dispatch_status = 're_dispatch'
   * - Updates status tracking metadata: redispatch_lifecycle_status = 'MOVED_TO_ACTIVE'
   * - Preserves previous shipment attempt history
   * - Broadcasts cross-module synchronization events
   */
  async moveInfluencerToActive(
    campaignId: string | number,
    item: ReDispatchQueueItem
  ): Promise<{ success: boolean; error?: string }> {
    const cId = String(campaignId).trim();
    const infId = item.influencer_id;
    const code = cleanCode(item.code);
    if (!cId || (!infId && !code)) {
      return { success: false, error: 'Invalid campaign or influencer identifier' };
    }

    try {
      const numCampId = Number(cId);
      const campQuery = !isNaN(numCampId) ? numCampId : cId;
      const numInfId = Number(infId);
      const nowIso = new Date().toISOString();

      // 1. Authoritative Update in redispatch_records: redispatch_status = 'MOVED_TO_ACTIVE'
      let rdQuery = supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .update({
          redispatch_status: 'MOVED_TO_ACTIVE',
          moved_to_active_at: nowIso,
          updated_at: nowIso
        })
        .eq('campaign_id', cId);

      if (code) {
        rdQuery = rdQuery.eq('influencer_code', code);
      } else if (!isNaN(numInfId) && numInfId > 0) {
        rdQuery = rdQuery.eq('influencer_id', numInfId);
      }

      const { error: rdUpdateErr } = await rdQuery;
      if (rdUpdateErr) {
        console.error('Error updating redispatch_records:', rdUpdateErr);
      }

      // 2. Update influencer_dispatch_details_rows: dispatch_status = 're_dispatch'
      if (item.dispatch_id) {
        await supabaseAdmin
          .from(SUPABASE_TABLES.influencerDispatch)
          .update({
            dispatch_status: 're_dispatch',
            remarks: `Moved to Active for Re-Dispatch (${item.issue_type || 'Issue'})`
          })
          .eq('id', item.dispatch_id);
      }

      if (!isNaN(numInfId) && numInfId > 0) {
        await supabaseAdmin
          .from(SUPABASE_TABLES.influencerDispatch)
          .update({
            dispatch_status: 're_dispatch',
            remarks: `Moved to Active for Re-Dispatch (${item.issue_type || 'Issue'})`
          })
          .eq('campaign_id', campQuery)
          .eq('influencer_id', numInfId);
      }

      // 3. Remove influencer from existing dispatch batches if any
      if (infId) {
        await dispatchBatchService.removeInfluencerFromBatches(cId, infId);
      }

      // 4. Update influencer_status_tracking_rows notes: set redispatch_lifecycle_status = 'MOVED_TO_ACTIVE'
      let stRow: any = null;

      if (item.status_tracking_id) {
        const { data } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('id, notes, status')
          .eq('id', item.status_tracking_id)
          .maybeSingle();
        stRow = data;
      }

      if (!stRow && !isNaN(numInfId) && numInfId > 0) {
        const { data } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('id, notes, status')
          .eq('campaign_id', campQuery)
          .eq('influencer_id', numInfId)
          .maybeSingle();
        stRow = data;
      }

      if (stRow?.id) {
        let meta: any = {};
        try {
          meta = typeof stRow.notes === 'string' ? JSON.parse(stRow.notes || '{}') : (stRow.notes || {});
        } catch (e) {
          meta = {};
        }

        meta.redispatch_lifecycle_status = 'MOVED_TO_ACTIVE';
        meta.re_dispatch_moved_to_active = true;
        meta.re_dispatch_required = false;
        meta.moved_to_active_at = nowIso;
        meta.last_updated = nowIso;

        // Maintain structured redispatch_cycles array
        if (Array.isArray(meta.redispatch_cycles) && meta.redispatch_cycles.length > 0) {
          const lastCycle = meta.redispatch_cycles[meta.redispatch_cycles.length - 1];
          lastCycle.status = 'MOVED_TO_ACTIVE';
          lastCycle.moved_to_active_at = nowIso;
          lastCycle.delivered_confirmed = false;
          lastCycle.updated_at = nowIso;
        } else {
          meta.redispatch_cycles = [{
            cycle_number: 1,
            status: 'MOVED_TO_ACTIVE',
            issue_type: meta.issue_type || item.issue_type || 'DAMAGED_PRODUCT',
            issue_remarks: meta.issue_remarks || item.issue_remarks || '',
            issue_proof_url: meta.issue_proof_url || '',
            reported_at: meta.issue_reported_at || nowIso,
            previous_awb: item.previous_awb || '',
            previous_courier: item.courier || '',
            moved_to_active_at: nowIso,
            delivered_confirmed: false,
            created_at: nowIso,
            updated_at: nowIso
          }];
        }

        await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .update({
            status: 'Re-Dispatch (Active)',
            notes: JSON.stringify(meta),
            updated_at: nowIso
          })
          .eq('id', stRow.id);

        // Ensure replacement shipment attempt exists in shipment_attempts
        try {
          const targetInfId = numInfId || Number(infId);
          if (targetInfId) {
            const cleanInfCode = cleanCode(item.code);
            const existingAttempts = await shipmentAttemptService.getShipmentAttempts(cId, targetInfId);
            const lastAtt = existingAttempts.length > 0 ? existingAttempts[existingAttempts.length - 1] : null;
            if (!lastAtt || lastAtt.issue_reported || lastAtt.shipment_status === 'Issue Reported') {
              await shipmentAttemptService.createReDispatchAttempt({
                campaign_id: cId,
                influencer_id: targetInfId,
                influencer_code: cleanInfCode,
                courier: item.courier,
                remarks: `Re-Dispatch cycle for issue: ${item.issue_type || 'Defective/Damaged product'}`
              });
            }
          }
        } catch (attErr) {
          console.error('Error creating re-dispatch shipment attempt:', attErr);
        }
      }

      // 5. Update localStorage shipment cache if present
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = `velmora_campaign_shipments_${cId}`;
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const updated = list.map((s: any) => {
                const shipInfId = String(s.influencerId || '');
                if (shipInfId && shipInfId === String(infId)) {
                  return {
                    ...s,
                    isResend: true,
                    workflow_state: 'active_re_dispatch',
                    remarks: 'Moved to Active for Re-Dispatch'
                  };
                }
                return s;
              });
              localStorage.setItem(cacheKey, JSON.stringify(updated));
            }
          }
        } catch (e) {}

        // Broadcast cross-module synchronization events
        window.dispatchEvent(new CustomEvent('influencer_tracking_updated', {
          detail: { campaignId: cId, influencerId: infId, code }
        }));
        window.dispatchEvent(new CustomEvent('influencer_status_updated', {
          detail: { campaignId: cId, influencerId: infId, code }
        }));
        window.dispatchEvent(new CustomEvent('velmora:influencer-updated'));
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error in moveInfluencerToActive:', err);
      return { success: false, error: err.message || 'Failed to move to Active' };
    }
  },

  /**
   * Bulk moves multiple influencers from the Re-Dispatch queue to Active for Re-Dispatch.
   */
  async bulkMoveInfluencersToActive(
    campaignId: string | number,
    items: ReDispatchQueueItem[]
  ): Promise<{ success: boolean; movedCount: number; error?: string }> {
    if (!items || items.length === 0) {
      return { success: true, movedCount: 0 };
    }

    let successCount = 0;
    for (const item of items) {
      const res = await this.moveInfluencerToActive(campaignId, item);
      if (res.success) {
        successCount++;
      }
    }

    return {
      success: successCount > 0,
      movedCount: successCount
    };
  }
};
