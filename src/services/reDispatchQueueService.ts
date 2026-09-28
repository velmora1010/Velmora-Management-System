import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { naturalSortCompare } from '../config/skuMapping';
import { dispatchBatchService } from './dispatchBatchService';
import { getCourierTrackingUrl } from './influencerTrackingService';

export interface ReDispatchQueueItem {
  id: string; // unique key
  influencer_id: number;
  status_tracking_id?: string | number;
  dispatch_id?: string | number;
  code: string;
  influencer_name: string;
  username: string;
  phone_number?: string;
  previous_awb: string;
  courier: string;
  issue_type: string;
  issue_remarks: string;
  issue_reported_at?: string;
  date_display: string;
  status: 'pending' | 'moved_to_active';
  status_display: string;
  tracking_url?: string | null;
  profile_photo_url?: string;
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
   * Fetches all Re-Dispatch queue records dynamically from the database
   * using the exact same workflow criteria as Status Tracking.
   */
  async fetchQueueItems(campaignId: string | number): Promise<ReDispatchQueueItem[]> {
    const cId = String(campaignId).trim();
    if (!cId) return [];

    try {
      const numCampId = Number(cId);
      const campQuery = !isNaN(numCampId) ? numCampId : cId;

      // 1. Fetch Status Tracking rows, Dispatch Details, Influencer Info & Shipment Attempts in parallel
      const [stRes, dispRes, infoRes, attemptsRes] = await Promise.all([
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('id, influencer_id, dispatch_id, status, notes, updated_at, created_at')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id, influencer_id, dispatch_status, tracking_id, courier_partner, remarks, dispatch_date')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, code, influencer_name, name, username, phone_number, is_archived, profile_photo_url, profile_file_url')
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

      // Index info and dispatch by influencer_id
      const infoMap = new Map<string, any>();
      infos.forEach(inf => {
        infoMap.set(String(inf.id), inf);
      });

      const dispMap = new Map<string, any>();
      dispatches.forEach(d => {
        dispMap.set(String(d.influencer_id), d);
      });

      const attemptsByInf = new Map<string, any[]>();
      attempts.forEach(a => {
        const k = String(a.influencer_id);
        if (!attemptsByInf.has(k)) attemptsByInf.set(k, []);
        attemptsByInf.get(k)!.push(a);
      });

      const items: ReDispatchQueueItem[] = [];
      const seenInfluencerIds = new Set<string>();

      // 2. Identify Re-Dispatch records from Status Tracking (primary source of truth for the 39 records)
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
        const infAttempts = attemptsByInf.get(String(st.influencer_id)) || [];
        const hasIssueAttempt = infAttempts.some(a => a.issue_reported === true);

        const isReDispatchCandidate = Boolean(
          rawStatus.includes('re-dispatch') ||
          rawStatus.includes('redispatch') ||
          dispStatus.includes('re_dispatch') ||
          dispStatus.includes('redispatch') ||
          meta.re_dispatch_required ||
          meta.shipment_issue ||
          meta.issue_reported ||
          hasIssueAttempt
        );

        if (!isReDispatchCandidate) return;

        const infIdStr = String(st.influencer_id);
        seenInfluencerIds.add(infIdStr);

        const inf = infoMap.get(infIdStr);
        // Exclude archived influencers
        if (inf && (inf.is_archived === true || inf.is_archived === 'true' || inf.is_archived === 1 || inf.is_archived === '1')) {
          return;
        }

        const latestAttempt = infAttempts[infAttempts.length - 1];
        const isMovedToActive = Boolean(meta.re_dispatch_moved_to_active || meta.moved_to_active);

        const codeVal = cleanCode(inf?.code || (inf as any)?.influencer_code || latestAttempt?.order_id || '');
        const rawName = (inf?.influencer_name || inf?.name || (inf as any)?.username || '').trim();
        const cleanName = rawName.replace(/^@+/, '').trim() || 'Influencer';
        const usernameVal = rawName.startsWith('@') ? rawName : `@${cleanName.toLowerCase().replace(/\s+/g, '_')}`;

        const awbVal = (
          disp?.tracking_id ||
          meta.source_awb ||
          latestAttempt?.awb_number ||
          ''
        ).trim();

        const courierVal = (
          disp?.courier_partner ||
          meta.source_courier ||
          latestAttempt?.courier ||
          'Delhivery'
        ).trim();

        // Issue format
        let issueTypeVal = (meta.issue_type || latestAttempt?.issue_type || 'Damaged Product').replace(/_/g, ' ');
        // Capitalize words
        issueTypeVal = issueTypeVal.replace(/\b\w/g, (c: string) => c.toUpperCase());

        const issueRemarksVal = (
          meta.issue_remarks ||
          latestAttempt?.issue_remarks ||
          latestAttempt?.remarks ||
          disp?.remarks ||
          ''
        ).trim();

        const reportedAt = meta.issue_reported_at || meta.last_updated || latestAttempt?.issue_reported_at || st.updated_at || st.created_at;
        const trackingUrl = awbVal && courierVal ? getCourierTrackingUrl(courierVal, awbVal) : undefined;

        items.push({
          id: `rd_${st.id}_${infIdStr}`,
          influencer_id: Number(st.influencer_id),
          status_tracking_id: st.id,
          dispatch_id: st.dispatch_id || disp?.id,
          code: codeVal,
          influencer_name: cleanName,
          username: usernameVal,
          phone_number: inf?.phone_number || (inf as any)?.phone || '',
          previous_awb: awbVal,
          courier: courierVal,
          issue_type: issueTypeVal,
          issue_remarks: issueRemarksVal,
          issue_reported_at: reportedAt,
          date_display: formatQueueDate(reportedAt),
          status: isMovedToActive ? 'moved_to_active' : 'pending',
          status_display: isMovedToActive ? 'Moved to Active' : 'Pending Re-Dispatch',
          tracking_url: trackingUrl,
          profile_photo_url: inf?.profile_photo_url || inf?.profile_file_url || ''
        });
      });

      // 3. Natural sort by Influencer Code (HIS1, HIS9, HIS12, KAS175, etc.)
      items.sort((a, b) => naturalSortCompare(a.code, b.code));

      return items;
    } catch (err) {
      console.error('Error fetching Re-Dispatch queue items:', err);
      return [];
    }
  },

  /**
   * Moves a single influencer from the Re-Dispatch queue to Active for Re-Dispatch.
   * - Sets influencer_dispatch_details_rows.dispatch_status = 're_dispatch'
   * - Updates status tracking metadata to re_dispatch_moved_to_active = true
   * - Preserves previous shipment attempt history
   * - Broadcasts cross-module synchronization events
   */
  async moveInfluencerToActive(
    campaignId: string | number,
    item: ReDispatchQueueItem
  ): Promise<{ success: boolean; error?: string }> {
    const cId = String(campaignId).trim();
    const infId = item.influencer_id;
    if (!cId || !infId) {
      return { success: false, error: 'Invalid campaign or influencer ID' };
    }

    try {
      const numCampId = Number(cId);
      const campQuery = !isNaN(numCampId) ? numCampId : cId;
      const nowIso = new Date().toISOString();

      // 1. Update influencer_dispatch_details_rows: dispatch_status = 're_dispatch'
      const { error: dispError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({
          dispatch_status: 're_dispatch',
          remarks: `Moved to Active for Re-Dispatch (${item.issue_type || 'Issue'})`
        })
        .eq('campaign_id', campQuery)
        .eq('influencer_id', infId);

      if (dispError) {
        console.error('Error updating dispatch status:', dispError);
      }

      // 2. Remove influencer from existing dispatch batches if any
      await dispatchBatchService.removeInfluencerFromBatches(cId, infId);

      // 3. Update influencer_status_tracking_rows notes: set re_dispatch_moved_to_active = true
      const { data: stRow } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .select('id, notes, status')
        .eq('campaign_id', campQuery)
        .eq('influencer_id', String(infId))
        .maybeSingle();

      if (stRow?.id) {
        let meta: any = {};
        try {
          meta = typeof stRow.notes === 'string' ? JSON.parse(stRow.notes || '{}') : (stRow.notes || {});
        } catch (e) {
          meta = {};
        }

        meta.re_dispatch_moved_to_active = true;
        meta.re_dispatch_required = false;
        meta.moved_to_active_at = nowIso;
        meta.last_updated = nowIso;

        await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .update({
            status: 'Re-Dispatch (Active)',
            notes: JSON.stringify(meta),
            updated_at: nowIso
          })
          .eq('id', stRow.id);
      }

      // 4. Update localStorage shipment cache if present
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
          detail: { campaignId: cId, influencerId: infId }
        }));
        window.dispatchEvent(new CustomEvent('influencer_status_updated', {
          detail: { campaignId: cId, influencerId: infId }
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
