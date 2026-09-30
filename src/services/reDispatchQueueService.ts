import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { naturalSortCompare } from '../config/skuMapping';
import { dispatchBatchService } from './dispatchBatchService';
import { getCourierTrackingUrl } from './influencerTrackingService';
import { shipmentAttemptService } from './shipmentAttemptService';
import { isActiveStatus } from '../utils/marketingUtils';

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
  redispatch_code: string; // e.g. "R HIS1"
  redispatch_awb?: string; // replacement AWB if available
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
   * Authoritative Database Reconciliation Function.
   * Scans existing Re-Dispatch records against uploaded Delhivery/courier shipments.
   * Recalculates actual status based on uploaded shipment data as the SOLE SOURCE OF TRUTH.
   * Fixes records that were incorrectly marked Dispatched / Moved to Active (e.g. HIS1).
   */
  async reconcileRedispatchShipments(campaignId: string | number): Promise<{
    total: number;
    dispatchedCount: number;
    pendingCount: number;
    fixedCount: number;
    fixedCodes: string[];
  }> {
    const cId = String(campaignId).trim();
    if (!cId) return { total: 0, dispatchedCount: 0, pendingCount: 0, fixedCount: 0, fixedCodes: [] };

    try {
      const numCampId = Number(cId);
      const campQuery = !isNaN(numCampId) ? numCampId : cId;

      // 1. Fetch all redispatch_records for campaign joined with active influencer
      // SINGLE SOURCE OF TRUTH: Only consider records where the linked campaign influencer exists and is active
      let rdRows: any[] = [];
      const { data: joinedRows, error: rdErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .select('*, influencer:influencer_id!inner(id, code, is_archived, campaign_id)')
        .eq('campaign_id', cId)
        .eq('influencer.campaign_id', cId)
        .or('is_archived.eq.false,is_archived.is.null', { foreignTable: 'influencer' });

      if (rdErr) {
        console.warn('Error in joined query in reconcileRedispatchShipments, falling back:', rdErr);
        const { data: baseRows } = await supabaseAdmin
          .from(SUPABASE_TABLES.redispatchRecords)
          .select('*')
          .eq('campaign_id', cId);
        rdRows = baseRows || [];
      } else {
        rdRows = joinedRows || [];
      }

      if (rdRows.length === 0) {
        return { total: 0, dispatchedCount: 0, pendingCount: 0, fixedCount: 0, fixedCodes: [] };
      }

      // 2. Fetch all tracking shipments for campaign across all courier sources (Delhivery, ST Courier, Amazon/iThink, India Post) + campaign influencers
      const [trackingRes, ithinkRes, indiaPostRes, infoRes] = await Promise.all([
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .select('id, campaign_id, influencer_id, influencer_code, order_id, awb_number, courier, status, sync_error, dispatch_date, expected_delivery_date')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.ithinkLogistics)
          .select('id, order_number, awb_no, courier_company, order_status, order_pickup_date, campaign_id'),
        supabaseAdmin
          .from(SUPABASE_TABLES.indiaPostTracking)
          .select('id, order_id, awb_number, courier, status, dispatch_date, expected_delivery_date, campaign_id')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, code, is_archived, campaign_id')
          .eq('campaign_id', campQuery)
      ]);

      if (trackingRes.error) {
        console.error('Error fetching tracking shipments in reconcileRedispatchShipments:', trackingRes.error);
      }

      const trackingRows = trackingRes.data || [];
      const ithinkRows = (ithinkRes.data || []).filter((r: any) => !r.campaign_id || String(r.campaign_id) === cId);
      const indiaPostRows = indiaPostRes.data || [];

      // Unified tracking shipments across all couriers
      const allCourierShipments: Array<{
        id: string;
        order_id: string;
        awb_number: string;
        courier: string;
        status: string;
        dispatch_date?: string | null;
        expected_delivery_date?: string | null;
      }> = [];

      trackingRows.forEach((s: any) => {
        allCourierShipments.push({
          id: s.id,
          order_id: s.order_id || s.influencer_code,
          awb_number: s.awb_number,
          courier: s.courier || 'Delhivery',
          status: s.status,
          dispatch_date: s.dispatch_date,
          expected_delivery_date: s.expected_delivery_date
        });
      });

      ithinkRows.forEach((r: any) => {
        allCourierShipments.push({
          id: r.id,
          order_id: r.order_number,
          awb_number: r.awb_no,
          courier: r.courier_company || 'Amazon',
          status: r.order_status || 'In Transit',
          dispatch_date: r.order_pickup_date,
          expected_delivery_date: null
        });
      });

      indiaPostRows.forEach((r: any) => {
        allCourierShipments.push({
          id: r.id,
          order_id: r.order_id,
          awb_number: r.awb_number,
          courier: r.courier || 'India Post',
          status: r.status || 'In Transit',
          dispatch_date: r.dispatch_date,
          expected_delivery_date: r.expected_delivery_date
        });
      });

      // 3. Index verified replacement shipments strictly by R-prefixed Order ID or different AWB
      const repShipmentByCode = new Map<string, any>();
      const allShipmentsByCode = new Map<string, any[]>();

      allCourierShipments.forEach(s => {
        const oId = String(s.order_id || '').trim();
        const awb = String(s.awb_number || '').trim();
        if (!awb) return;

        // Match strictly R-prefixed order ID (e.g. "R HIS1", "#R HIS1", "R-HIS1", "R_HIS1", "RHIS1")
        const rMatch = /^#?R[\s#_\-]+([A-Za-z0-9]+)$/i.exec(oId) || /^R([A-Za-z]+[0-9]+)$/i.exec(oId);
        if (rMatch) {
          const rawCode = rMatch[1].trim().toUpperCase();
          if (rawCode) {
            repShipmentByCode.set(rawCode, s);
          }
        }

        const baseCode = oId.replace(/^#+/, '').replace(/^R[\s#_\-]+/i, '').replace(/^R(?=[A-Za-z])/i, '').trim().toUpperCase();
        if (baseCode) {
          if (!allShipmentsByCode.has(baseCode)) {
            allShipmentsByCode.set(baseCode, []);
          }
          allShipmentsByCode.get(baseCode)!.push(s);
        }
      });

      const nowIso = new Date().toISOString();
      let dispatchedCount = 0;
      let pendingCount = 0;
      let fixedCount = 0;
      const fixedCodes: string[] = [];

      const infoById = new Map<string, any>();
      const infoByCode = new Map<string, any>();
      (infoRes.data || []).forEach((inf: any) => {
        if (inf.id) infoById.set(String(inf.id), inf);
        if (inf.code) infoByCode.set(cleanCode(inf.code).toUpperCase(), inf);
      });

      for (const row of rdRows) {
        const code = cleanCode(row.influencer_code);
        const codeUpper = code.toUpperCase();

        const linkedInf = (row.influencer_id ? infoById.get(String(row.influencer_id)) : null) || infoByCode.get(codeUpper);

        // SINGLE SOURCE OF TRUTH: If linked campaign influencer does not exist or is eliminated / recycled, EXCLUDE!
        if (!linkedInf || !linkedInf.id || !isActiveStatus(linkedInf.is_archived) || (linkedInf.campaign_id && String(linkedInf.campaign_id) !== cId)) {
          continue;
        }

        // 1. Primary match: strictly by R-prefix
        let matchedRepShipment = repShipmentByCode.get(codeUpper);

        // 2. Secondary match: if shipment has different AWB than previous_awb
        if (!matchedRepShipment && allShipmentsByCode.has(codeUpper)) {
          const list = allShipmentsByCode.get(codeUpper)!;
          const prevAwbNorm = (row.previous_awb || '').trim().toLowerCase();
          const candidate = list.find(s => {
            const cAwb = (s.awb_number || '').trim().toLowerCase();
            return cAwb && cAwb !== prevAwbNorm;
          });
          if (candidate) {
            matchedRepShipment = candidate;
          }
        }

        const hasVerifiedCourierShipment = Boolean(
          matchedRepShipment &&
          matchedRepShipment.awb_number &&
          String(matchedRepShipment.awb_number).trim().length > 0
        );

        if (hasVerifiedCourierShipment) {
          dispatchedCount++;
          const targetOrderId = `R ${code}`;
          const repCourier = matchedRepShipment.courier || 'Delhivery';
          const repAwb = String(matchedRepShipment.awb_number).trim();
          const repDispDate = matchedRepShipment.dispatch_date || null;
          const repEdd = matchedRepShipment.expected_delivery_date || null;
          const repStatus = matchedRepShipment.status || 'Dispatched';

          // If not marked MOVED_TO_ACTIVE or order_id missing 'R ' prefix, update it
          if (row.redispatch_status !== 'MOVED_TO_ACTIVE' && row.redispatch_status !== 'COMPLETED') {
            await supabaseAdmin
              .from(SUPABASE_TABLES.redispatchRecords)
              .update({
                redispatch_status: 'MOVED_TO_ACTIVE',
                order_id: targetOrderId,
                courier: repCourier,
                moved_to_active_at: row.moved_to_active_at || nowIso,
                updated_at: nowIso
              })
              .eq('id', row.id);

            fixedCount++;
            fixedCodes.push(code);
          }

          // Ensure shipment_attempts has Attempt #2 for this re-dispatch
          if (row.influencer_id) {
            try {
              const existingAttempts = await shipmentAttemptService.getShipmentAttempts(cId, row.influencer_id);
              const reAttempt = existingAttempts.find(a => 
                (a.awb_number && a.awb_number.trim().toLowerCase() === repAwb.toLowerCase()) || 
                a.shipment_type === 'RE_DISPATCH'
              );

              if (!reAttempt) {
                await supabaseAdmin.from(SUPABASE_TABLES.shipmentAttempts).insert({
                  campaign_id: cId,
                  influencer_id: row.influencer_id,
                  parent_attempt_id: existingAttempts.length > 0 ? existingAttempts[0].id : null,
                  attempt_number: 2,
                  shipment_type: 'RE_DISPATCH',
                  courier: repCourier,
                  order_id: targetOrderId,
                  awb_number: repAwb,
                  shipment_status: repStatus,
                  dispatch_date: repDispDate,
                  estimated_delivery_date: repEdd,
                  remarks: `Re-Dispatch replacement shipment via ${repCourier}`,
                  delivery_confirmed: false,
                  status_tracking_started: false,
                  created_at: nowIso,
                  updated_at: nowIso
                });
              } else {
                await supabaseAdmin.from(SUPABASE_TABLES.shipmentAttempts).update({
                  courier: repCourier,
                  awb_number: repAwb,
                  order_id: targetOrderId,
                  shipment_status: repStatus,
                  dispatch_date: repDispDate || reAttempt.dispatch_date || null,
                  estimated_delivery_date: repEdd || reAttempt.estimated_delivery_date || null,
                  updated_at: nowIso
                }).eq('id', reAttempt.id);
              }
            } catch (attErr) {
              console.warn(`Error ensuring shipment attempt for ${code}:`, attErr);
            }
          }

          // Ensure influencer_dispatch_details_rows is updated with replacement shipment logistics
          // Automatically moves to 'prepare_dispatch' unless already confirmed dispatched by user
          if (row.influencer_id) {
            try {
              const { data: currDisp } = await supabaseAdmin
                .from(SUPABASE_TABLES.influencerDispatch)
                .select('id, dispatch_status, remarks')
                .eq('campaign_id', campQuery)
                .eq('influencer_id', row.influencer_id)
                .maybeSingle();

              const isAlreadyDispatched = 
                currDisp?.dispatch_status?.toLowerCase() === 'dispatched' && 
                Boolean(currDisp?.remarks?.includes('Re-Dispatch sent via'));
              const targetStatus = isAlreadyDispatched ? 'Dispatched' : 'prepare_dispatch';

              await supabaseAdmin
                .from(SUPABASE_TABLES.influencerDispatch)
                .update({
                  courier_partner: repCourier,
                  tracking_id: repAwb,
                  dispatch_date: repDispDate,
                  expected_delivery_date: repEdd,
                  dispatch_status: targetStatus,
                  remarks: isAlreadyDispatched 
                    ? currDisp?.remarks 
                    : `Re-Dispatch replacement shipment (AWB: ${repAwb})`
                })
                .eq('campaign_id', campQuery)
                .eq('influencer_id', row.influencer_id);
            } catch (dErr) {
              console.warn(`Error updating dispatch details for ${code}:`, dErr);
            }
          }
        } else {
          // NOT in uploaded courier files -> MUST BE PENDING_REDISPATCH!
          pendingCount++;

          if (row.redispatch_status !== 'PENDING_REDISPATCH') {
            // Fix erroneously marked record (e.g. HIS1)
            await supabaseAdmin
              .from(SUPABASE_TABLES.redispatchRecords)
              .update({
                redispatch_status: 'PENDING_REDISPATCH',
                moved_to_active_at: null,
                updated_at: nowIso
              })
              .eq('id', row.id);

            fixedCount++;
            fixedCodes.push(code);
          }

          // Also reset influencer_status_tracking_rows notes so it doesn't show as moved to active
          if (row.influencer_id) {
            try {
              const { data: stRow } = await supabaseAdmin
                .from(SUPABASE_TABLES.influencerStatus)
                .select('id, notes')
                .eq('campaign_id', campQuery)
                .eq('influencer_id', row.influencer_id)
                .maybeSingle();

              if (stRow?.id) {
                let meta: any = {};
                try {
                  meta = typeof stRow.notes === 'string' ? JSON.parse(stRow.notes || '{}') : (stRow.notes || {});
                } catch (e) {
                  meta = {};
                }

                meta.redispatch_lifecycle_status = 'PENDING_REDISPATCH';
                meta.re_dispatch_moved_to_active = false;
                meta.re_dispatch_required = true;
                meta.redispatch_awb = null;
                meta.moved_to_active_at = null;
                meta.last_updated = nowIso;

                await supabaseAdmin
                  .from(SUPABASE_TABLES.influencerStatus)
                  .update({
                    status: 'Re-Dispatch Required',
                    notes: JSON.stringify(meta),
                    updated_at: nowIso
                  })
                  .eq('id', stRow.id);
              }
            } catch (stErr) {
              console.warn(`Error resetting status tracking notes for ${code}:`, stErr);
            }

            // Also check influencer_dispatch_details_rows remarks and reset status
            try {
              await supabaseAdmin
                .from(SUPABASE_TABLES.influencerDispatch)
                .update({
                  dispatch_status: 're_dispatch',
                  tracking_id: null,
                  remarks: `Issue Reported: ${row.issue_type || 'DAMAGED_PRODUCT'}`
                })
                .eq('campaign_id', campQuery)
                .eq('influencer_id', row.influencer_id);
            } catch (dispErr) {
              console.warn(`Error resetting dispatch details for ${code}:`, dispErr);
            }
          }
        }
      }

      // Reconcile batches with prepare_dispatch records so replacement influencers appear in batches
      try {
        await dispatchBatchService.reconcileBatchesWithDispatchRecords(cId);
      } catch (bErr) {
        console.warn('Batch reconciliation error in reconcileRedispatchShipments:', bErr);
      }

      console.log(`[reconcileRedispatchShipments] Campaign ${cId}: Total=${rdRows.length}, Dispatched=${dispatchedCount}, Pending=${pendingCount}, Fixed=${fixedCount} (${fixedCodes.join(', ')})`);

      return {
        total: dispatchedCount + pendingCount,
        dispatchedCount,
        pendingCount,
        fixedCount,
        fixedCodes
      };
    } catch (e) {
      console.error('Error in reconcileRedispatchShipments:', e);
      return { total: 0, dispatchedCount: 0, pendingCount: 0, fixedCount: 0, fixedCodes: [] };
    }
  },

  /**
   * Fetches all Re-Dispatch queue records from the dedicated `redispatch_records` Supabase table.
   * Enriches records with influencer info, current logistics status, and tracking URLs.
   * UPLOADED SHIPMENTS (Delhivery/ST Courier) are the SOLE SOURCE OF TRUTH for dispatch status.
   */
  async fetchQueueItems(campaignId: string | number): Promise<ReDispatchQueueItem[]> {
    const cId = String(campaignId).trim();
    if (!cId) return [];

    try {
      const numCampId = Number(cId);
      const campQuery = !isNaN(numCampId) ? numCampId : cId;

      // 1. Fetch Authoritative Re-Dispatch Records from public.redispatch_records
      // Enforce database-level join requiring linked influencer to exist, belong to this campaign, and be active
      let redispatchRows: any[] = [];
      const { data: joinedRows, error: rdErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .select('*, influencer:influencer_id!inner(id, code, is_archived, campaign_id)')
        .eq('campaign_id', cId)
        .eq('influencer.campaign_id', cId)
        .or('is_archived.eq.false,is_archived.is.null', { foreignTable: 'influencer' })
        .order('created_at', { ascending: false });

      if (rdErr) {
        console.warn('Error fetching joined redispatch_records, falling back to base select:', rdErr);
        const { data: baseRows } = await supabaseAdmin
          .from(SUPABASE_TABLES.redispatchRecords)
          .select('*')
          .eq('campaign_id', cId)
          .order('created_at', { ascending: false });
        redispatchRows = baseRows || [];
      } else {
        redispatchRows = joinedRows || [];
      }

      // If redispatch_records is empty for this campaign, run auto-migration/reconciliation
      if (!redispatchRows || redispatchRows.length === 0) {
        return await this.fallbackAndAutoMigrate(campaignId);
      }

      // 2. Fetch accompanying data in parallel to enrich view (including tracking shipments as SOURCE OF TRUTH)
      const [infoRes, dispRes, stRes, batchesRes, attemptsRes, trackingShipmentsRes, ithinkRes, indiaPostRes] = await Promise.all([
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
          .maybeSingle(),
        supabaseAdmin
          .from(SUPABASE_TABLES.shipmentAttempts)
          .select('*')
          .eq('campaign_id', cId),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .select('id, campaign_id, influencer_id, influencer_code, order_id, awb_number, courier, status, sync_error')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.ithinkLogistics)
          .select('id, order_number, awb_no, courier_company, order_status, order_pickup_date, campaign_id'),
        supabaseAdmin
          .from(SUPABASE_TABLES.indiaPostTracking)
          .select('id, order_id, awb_number, courier, status, dispatch_date, expected_delivery_date, campaign_id')
          .eq('campaign_id', campQuery)
      ]);

      const infos = (infoRes.data || []) as any[];
      const dispatches = (dispRes.data || []) as any[];
      const stRows = (stRes.data || []) as any[];
      const batches = (batchesRes.data?.setting_value || []) as any[];
      const attempts = (attemptsRes.data || []) as any[];
      const trackingShipments = (trackingShipmentsRes.data || []) as any[];
      const ithinkRows = (ithinkRes.data || []).filter((r: any) => !r.campaign_id || String(r.campaign_id) === cId);
      const indiaPostRows = (indiaPostRes.data || []) as any[];

      // Unified tracking shipments across all couriers (Delhivery, ST Courier, Amazon, India Post)
      const allCourierShipments: Array<{
        id: string;
        order_id: string;
        awb_number: string;
        courier: string;
        status: string;
        dispatch_date?: string | null;
        expected_delivery_date?: string | null;
      }> = [];

      trackingShipments.forEach((s: any) => {
        allCourierShipments.push({
          id: s.id,
          order_id: s.order_id || s.influencer_code,
          awb_number: s.awb_number,
          courier: s.courier || 'Delhivery',
          status: s.status,
          dispatch_date: s.dispatch_date,
          expected_delivery_date: s.expected_delivery_date
        });
      });

      ithinkRows.forEach((r: any) => {
        allCourierShipments.push({
          id: r.id,
          order_id: r.order_number,
          awb_number: r.awb_no,
          courier: r.courier_company || 'Amazon',
          status: r.order_status || 'In Transit',
          dispatch_date: r.order_pickup_date,
          expected_delivery_date: null
        });
      });

      indiaPostRows.forEach((r: any) => {
        allCourierShipments.push({
          id: r.id,
          order_id: r.order_id,
          awb_number: r.awb_number,
          courier: r.courier || 'India Post',
          status: r.status || 'In Transit',
          dispatch_date: r.dispatch_date,
          expected_delivery_date: r.expected_delivery_date
        });
      });

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

      const attemptsByInf = new Map<string, any[]>();
      attempts.forEach(a => {
        const k = String(a.influencer_id);
        if (!attemptsByInf.has(k)) attemptsByInf.set(k, []);
        attemptsByInf.get(k)!.push(a);
      });

      const batchMap = new Map<string, any[]>();
      batches.forEach(b => {
        (b.members || []).forEach((m: any) => {
          const k = String(m.influencer_id);
          if (!batchMap.has(k)) batchMap.set(k, []);
          batchMap.get(k)!.push(b);
        });
      });

      // Index verified replacement shipments from all uploaded courier files (SOURCE OF TRUTH)
      const repShipmentByCode = new Map<string, any>();
      const allShipmentsByCode = new Map<string, any[]>();

      allCourierShipments.forEach(s => {
        const oId = String(s.order_id || '').trim();
        const awb = String(s.awb_number || '').trim();
        if (!awb) return;

        // 1. R-prefixed: R HIS1, #R HIS1, R-HIS1, R_HIS1, RHIS1
        const rMatch = /^#?R[\s#_\-]+([A-Za-z0-9]+)$/i.exec(oId) || /^R([A-Za-z]+[0-9]+)$/i.exec(oId);
        if (rMatch) {
          const rawCode = rMatch[1].trim().toUpperCase();
          if (rawCode) {
            repShipmentByCode.set(rawCode, s);
          }
        }

        const baseCode = oId.replace(/^#+/, '').replace(/^R[\s#_\-]+/i, '').replace(/^R(?=[A-Za-z])/i, '').trim().toUpperCase();
        if (baseCode) {
          if (!allShipmentsByCode.has(baseCode)) {
            allShipmentsByCode.set(baseCode, []);
          }
          allShipmentsByCode.get(baseCode)!.push(s);
        }
      });

      const items: ReDispatchQueueItem[] = [];

      for (const row of redispatchRows) {
        const code = cleanCode(row.influencer_code);
        const codeUpper = code.toUpperCase();
        const redispatchCode = `R ${code}`;
        const inf = (row.influencer_id ? infoById.get(String(row.influencer_id)) : null) || infoByCode.get(code);

        // SINGLE SOURCE OF TRUTH: If influencer does not exist, belongs to another campaign, or is eliminated / recycled, EXCLUDE!
        if (!inf || !inf.id || !isActiveStatus(inf.is_archived)) {
          continue;
        }

        if (inf.campaign_id && String(inf.campaign_id) !== cId) {
          continue;
        }

        const infId = row.influencer_id || inf?.id || 0;
        const infIdStr = String(infId);
        const disp = dispById.get(infIdStr);
        const st = stById.get(infIdStr);

        // SOURCE OF TRUTH: Match against uploaded courier replacement shipments
        let matchedRepShipment = repShipmentByCode.get(codeUpper);

        // Secondary match: if shipment has different AWB than previous_awb
        if (!matchedRepShipment && allShipmentsByCode.has(codeUpper)) {
          const list = allShipmentsByCode.get(codeUpper)!;
          const prevAwbNorm = (row.previous_awb || '').trim().toLowerCase();
          const candidate = list.find(s => {
            const cAwb = (s.awb_number || '').trim().toLowerCase();
            return cAwb && cAwb !== prevAwbNorm;
          });
          if (candidate) {
            matchedRepShipment = candidate;
          }
        }

        const prevAwbVal = (row.previous_awb || disp?.tracking_id || '').trim();

        // Valid replacement shipment must exist with a non-empty AWB
        const hasVerifiedCourierShipment = Boolean(
          matchedRepShipment &&
          matchedRepShipment.awb_number &&
          String(matchedRepShipment.awb_number).trim().length > 0
        );

        const redispatchAwb = hasVerifiedCourierShipment ? String(matchedRepShipment.awb_number).trim() : undefined;
        const courierVal = (matchedRepShipment?.courier || row.courier || disp?.courier_partner || 'Delhivery').trim();

        const dispStatus = (disp?.dispatch_status || '').toLowerCase();
        const memberBatches = batchMap.get(infIdStr) || [];
        const isInPrepareBatch = memberBatches.some((b: any) => b.status === 'Preparing' || b.status === 'Pending');

        // Current logistics stage of the influencer (independent from redispatch_status)
        const currentStage: 'active' | 'prepare_dispatch' | 'dispatched' =
          (dispStatus === 'prepare_dispatch' || isInPrepareBatch) ? 'prepare_dispatch' :
          (dispStatus === 'dispatched' || dispStatus === 'tracking') ? 'dispatched' : 'active';

        const isDispatched = hasVerifiedCourierShipment;
        const isCompleted = row.redispatch_status === 'COMPLETED';

        const redispatchStatus: 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'COMPLETED' =
          isCompleted ? 'COMPLETED' :
          isDispatched ? 'MOVED_TO_ACTIVE' : 'PENDING_REDISPATCH';

        const status: 'pending' | 'moved_to_active' | 'completed' =
          isCompleted ? 'completed' :
          isDispatched ? 'moved_to_active' : 'pending';

        const statusDisplay =
          isCompleted
            ? 'Completed'
            : isDispatched
            ? 'Dispatched'
            : 'Pending Re-Dispatch';

        const creatorName = (inf?.influencer_name || disp?.creator_name || '').trim();
        const handleName = (inf?.name || disp?.creator_name || '').trim();
        const cleanName = creatorName || handleName || 'Influencer';
        const usernameVal = handleName
          ? (handleName.startsWith('@') ? handleName : `@${handleName}`)
          : `@${cleanName.toLowerCase().replace(/\s+/g, '_')}`;

        const trackingUrl = redispatchAwb
          ? getCourierTrackingUrl(courierVal, redispatchAwb)
          : (prevAwbVal ? getCourierTrackingUrl(courierVal, prevAwbVal) : undefined);

        let issueTypeVal = (row.issue_type || 'Damaged Product').replace(/_/g, ' ');
        issueTypeVal = issueTypeVal.replace(/\b\w/g, (c: string) => c.toUpperCase());

        items.push({
          id: row.id,
          influencer_id: Number(infId),
          status_tracking_id: st?.id,
          dispatch_id: disp?.id,
          code,
          redispatch_code: redispatchCode,
          redispatch_awb: redispatchAwb,
          order_id: row.order_id || redispatchCode,
          influencer_name: cleanName,
          username: usernameVal,
          phone_number: inf?.phone_number || '',
          previous_awb: prevAwbVal,
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
      const [stRes, dispRes, infoRes, attemptsRes, trackingShipmentsRes] = await Promise.all([
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
          .eq('campaign_id', cId),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .select('id, campaign_id, influencer_id, influencer_code, order_id, awb_number, courier, status, sync_error')
          .eq('campaign_id', campQuery)
      ]);

      const stRecords = (stRes.data || []) as any[];
      const dispatches = (dispRes.data || []) as any[];
      const infos = (infoRes.data || []) as any[];
      const attempts = (attemptsRes.data || []) as any[];
      const trackingShipments = (trackingShipmentsRes.data || []) as any[];

      const repShipmentByCode = new Map<string, any>();
      trackingShipments.forEach(s => {
        const oId = String(s.order_id || '').trim();
        let isResend = false;
        if (s.sync_error) {
          try {
            const p = typeof s.sync_error === 'string' ? JSON.parse(s.sync_error) : s.sync_error;
            if (p.is_resend) isResend = true;
          } catch (e) {}
        }
        if ((oId.startsWith('R ') || oId.startsWith('R') || isResend) && s.awb_number) {
          const rawCode = oId.startsWith('R ') ? oId.slice(2).trim() : (s.influencer_code || oId.replace(/^R\s*/i, '')).trim();
          const clean = cleanCode(rawCode).toUpperCase();
          if (clean) repShipmentByCode.set(clean, s);
        }
      });

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
        if (!inf || !inf.id || !isActiveStatus(inf.is_archived) || (inf.campaign_id && String(inf.campaign_id) !== cId)) return;

        const codeVal = cleanCode(inf?.code || '');
        if (!codeVal) return;

        // DO NOT ASSUME DISPATCHED: Only consider moved/dispatched if verified replacement shipment exists
        const matchedRepShipment = repShipmentByCode.get(codeVal.toUpperCase());
        const hasVerifiedRepShipment = Boolean(matchedRepShipment && matchedRepShipment.awb_number);

        const isCompleted = meta.redispatch_lifecycle_status === 'COMPLETED' || meta.redispatch_completed === true;
        const isMoved = isCompleted ? false : hasVerifiedRepShipment;

        const latestAttempt = infAttempts[infAttempts.length - 1];
        const awbVal = disp?.tracking_id || meta.source_awb || latestAttempt?.awb_number || null;
        const courierVal = disp?.courier_partner || meta.source_courier || latestAttempt?.courier || 'Delhivery';

        const redispatchStatus = isCompleted ? 'COMPLETED' : isMoved ? 'MOVED_TO_ACTIVE' : 'PENDING_REDISPATCH';

        recordsToInsert.push({
          campaign_id: cId,
          influencer_id: st.influencer_id ? Number(st.influencer_id) : null,
          influencer_code: codeVal,
          order_id: `R ${codeVal}`,
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
      let numInfId = data.influencer_id ? Number(data.influencer_id) : null;

      // Validate single source of truth: Influencer must exist, belong to campaign, and be active
      if (!numInfId || isNaN(numInfId)) {
        const { data: infRow } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, is_archived, campaign_id')
          .eq('campaign_id', cId)
          .ilike('code', code)
          .maybeSingle();
        if (!infRow || !isActiveStatus(infRow.is_archived)) {
          return { success: false, error: 'Cannot record re-dispatch for an eliminated or inactive influencer' };
        }
        numInfId = Number(infRow.id);
      } else {
        const { data: infRow } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, is_archived, campaign_id')
          .eq('id', numInfId)
          .maybeSingle();
        if (!infRow || !isActiveStatus(infRow.is_archived) || String(infRow.campaign_id) !== cId) {
          return { success: false, error: 'Cannot record re-dispatch for an eliminated or inactive influencer' };
        }
      }

      const recordPayload = {
        campaign_id: cId,
        influencer_id: numInfId,
        influencer_code: code,
        order_id: data.order_id || `R ${code}`,
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
   * Automatically transitions a Re-Dispatch record when matched in courier upload (Delhivery or ST Courier):
   * 1. Updates redispatch_records: redispatch_status = 'MOVED_TO_ACTIVE', moved_to_active_at = now, order_id = 'R ' + code
   * 2. Upserts shipment_attempts: records attempt with shipment_type = 'RE_DISPATCH', awb_number = new AWB, order_id = 'R ' + code
   * 3. Updates influencer_status_tracking_rows: updates redispatch_cycles with new AWB, status = 'Re-Dispatch (Active)'
   * 4. Updates influencer_dispatch_details_rows: populates replacement logistics details and automatically moves to 'prepare_dispatch'!
   */
  async transitionReDispatchToPrepareDispatch(
    campaignId: string | number,
    data: {
      influencer_id?: number | string | null;
      influencer_code: string;
      order_id?: string;
      redispatch_awb: string;
      courier?: string;
      displayStatus?: string;
      dispatchDate?: string | null;
      estimatedDeliveryDate?: string | null;
      deliveredDate?: string | null;
      remarks?: string;
      attemptNumber?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const cId = String(campaignId).trim();
    const code = cleanCode(data.influencer_code);
    const numInfId = data.influencer_id ? Number(data.influencer_id) : null;
    const awb = (data.redispatch_awb || '').trim();
    if (!cId || (!code && !numInfId) || !awb) {
      return { success: false, error: 'Invalid parameters for transitionReDispatchToPrepareDispatch' };
    }

    try {
      const nowIso = new Date().toISOString();
      const courierName = data.courier || 'Delhivery';
      const displayStatus = data.displayStatus || 'Pending';
      const orderId = data.order_id || `R ${code}`;

      // Validate single source of truth: Influencer must exist, belong to campaign, and be active
      let targetInfId = numInfId;
      if (!targetInfId || isNaN(targetInfId)) {
        const { data: infRow } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, is_archived, campaign_id')
          .eq('campaign_id', cId)
          .ilike('code', code)
          .maybeSingle();
        if (!infRow || !isActiveStatus(infRow.is_archived)) {
          return { success: false, error: 'Cannot transition re-dispatch for an eliminated or inactive influencer' };
        }
        targetInfId = Number(infRow.id);
      } else {
        const { data: infRow } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, is_archived, campaign_id')
          .eq('id', targetInfId)
          .maybeSingle();
        if (!infRow || !isActiveStatus(infRow.is_archived) || String(infRow.campaign_id) !== cId) {
          return { success: false, error: 'Cannot transition re-dispatch for an eliminated or inactive influencer' };
        }
      }

      // 1. Authoritative update in redispatch_records: redispatch_status = 'MOVED_TO_ACTIVE'
      let rdQuery = supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .update({
          influencer_id: targetInfId,
          redispatch_status: 'MOVED_TO_ACTIVE',
          moved_to_active_at: nowIso,
          order_id: orderId,
          updated_at: nowIso
        })
        .eq('campaign_id', cId);

      if (code) {
        rdQuery = rdQuery.eq('influencer_code', code);
      } else if (numInfId && !isNaN(numInfId)) {
        rdQuery = rdQuery.eq('influencer_id', numInfId);
      }
      await rdQuery;

      // 2. Upsert shipment_attempts (Attempt #2, RE_DISPATCH)
      if (numInfId && !isNaN(numInfId)) {
        try {
          const existingAttempts = await shipmentAttemptService.getShipmentAttempts(cId, numInfId);
          const existingAttempt = existingAttempts.find(
            a => a.awb_number === awb || (a.shipment_type === 'RE_DISPATCH' && !a.delivery_confirmed)
          );

          if (existingAttempt) {
            await supabaseAdmin
              .from(SUPABASE_TABLES.shipmentAttempts)
              .update({
                order_id: orderId,
                awb_number: awb,
                courier: courierName,
                shipment_status: displayStatus,
                dispatch_date: data.dispatchDate || existingAttempt.dispatch_date || null,
                estimated_delivery_date: data.estimatedDeliveryDate || existingAttempt.estimated_delivery_date || null,
                delivered_date: data.deliveredDate || existingAttempt.delivered_date || null,
                remarks: data.remarks || existingAttempt.remarks || `Re-Dispatch replacement shipment via ${courierName}`,
                updated_at: nowIso
              })
              .eq('id', existingAttempt.id);
          } else {
            const nextAttemptNum = data.attemptNumber || (existingAttempts.length > 0 ? existingAttempts[existingAttempts.length - 1].attempt_number + 1 : 2);
            await supabaseAdmin
              .from(SUPABASE_TABLES.shipmentAttempts)
              .insert({
                campaign_id: cId,
                influencer_id: numInfId,
                attempt_number: nextAttemptNum,
                shipment_type: 'RE_DISPATCH',
                courier: courierName,
                order_id: orderId,
                awb_number: awb,
                shipment_status: displayStatus,
                dispatch_date: data.dispatchDate || null,
                estimated_delivery_date: data.estimatedDeliveryDate || null,
                delivered_date: data.deliveredDate || null,
                remarks: data.remarks || `Re-Dispatch replacement shipment via ${courierName}`,
                delivery_confirmed: false,
                status_tracking_started: false,
                created_at: nowIso,
                updated_at: nowIso
              });
          }
        } catch (attErr) {
          console.error('Error updating shipment_attempts in transitionReDispatchToPrepareDispatch:', attErr);
        }
      }

      // 3. Update influencer_status_tracking_rows notes
      if (numInfId && !isNaN(numInfId)) {
        try {
          const numCampId = Number(cId);
          const campQuery = !isNaN(numCampId) ? numCampId : cId;
          const { data: stRow } = await supabaseAdmin
            .from(SUPABASE_TABLES.influencerStatus)
            .select('id, notes, status')
            .eq('campaign_id', campQuery)
            .eq('influencer_id', numInfId)
            .maybeSingle();

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
            meta.redispatch_awb = awb;
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
        } catch (stErr) {
          console.error('Error updating influencer_status in transitionReDispatchToPrepareDispatch:', stErr);
        }
      }

      // 4. Update influencer_dispatch_details_rows:
      // If already dispatched by the user, keep 'Dispatched'. Otherwise set dispatch_status = 'prepare_dispatch'!
      if (numInfId && !isNaN(numInfId)) {
        try {
          const numCampId = Number(cId);
          const campQuery = !isNaN(numCampId) ? numCampId : cId;

          const { data: currDisp } = await supabaseAdmin
            .from(SUPABASE_TABLES.influencerDispatch)
            .select('id, dispatch_status')
            .eq('campaign_id', campQuery)
            .eq('influencer_id', numInfId)
            .maybeSingle();

          const isAlreadyDispatched = 
            currDisp?.dispatch_status?.toLowerCase() === 'dispatched' && 
            Boolean(currDisp?.remarks?.includes('Re-Dispatch sent via'));
          const targetStatus = isAlreadyDispatched ? 'Dispatched' : 'prepare_dispatch';

          await supabaseAdmin
            .from(SUPABASE_TABLES.influencerDispatch)
            .update({
              courier_partner: courierName,
              tracking_id: awb,
              dispatch_date: data.dispatchDate || null,
              expected_delivery_date: data.estimatedDeliveryDate || null,
              dispatch_status: targetStatus,
              remarks: isAlreadyDispatched
                ? currDisp?.remarks
                : (data.remarks || `Re-Dispatch replacement shipment (AWB: ${awb})`)
            })
            .eq('campaign_id', campQuery)
            .eq('influencer_id', numInfId);
        } catch (dispErr) {
          console.error('Error updating influencer_dispatch in transitionReDispatchToPrepareDispatch:', dispErr);
        }
      }

      // Reconcile batches with prepare_dispatch records so replacement influencers appear in batches
      try {
        await dispatchBatchService.reconcileBatchesWithDispatchRecords(cId);
      } catch (bErr) {
        console.warn('Batch reconciliation error in transitionReDispatchToPrepareDispatch:', bErr);
      }

      // 5. Broadcast real-time reactivity events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('influencer_tracking_updated', {
          detail: { campaignId: cId, influencerId: numInfId, code }
        }));
        window.dispatchEvent(new CustomEvent('influencer_status_updated', {
          detail: { campaignId: cId, influencerId: numInfId, code }
        }));
        window.dispatchEvent(new CustomEvent('velmora:influencer-updated'));
      }

      return { success: true };
    } catch (e: any) {
      console.error('Exception in transitionReDispatchToPrepareDispatch:', e);
      return { success: false, error: e?.message || 'Failed to transition re-dispatch' };
    }
  },

  /**
   * Automatically transitions a Re-Dispatch record when user completes dispatch:
   * 1. Updates redispatch_records: redispatch_status = 'MOVED_TO_ACTIVE', moved_to_active_at = now, order_id = 'R ' + code
   * 2. Upserts shipment_attempts: records attempt with shipment_type = 'RE_DISPATCH', awb_number = new AWB, order_id = 'R ' + code
   * 3. Updates influencer_status_tracking_rows: updates redispatch_cycles with new AWB, status = 'Re-Dispatch (Active)'
   * 4. Updates influencer_dispatch_details_rows: sets dispatch_status = 'Dispatched'
   */
  async transitionReDispatchToDispatched(
    campaignId: string | number,
    data: {
      influencer_id?: number | string | null;
      influencer_code: string;
      order_id?: string;
      redispatch_awb: string;
      courier?: string;
      displayStatus?: string;
      dispatchDate?: string | null;
      estimatedDeliveryDate?: string | null;
      deliveredDate?: string | null;
      remarks?: string;
      attemptNumber?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const cId = String(campaignId).trim();
    const code = cleanCode(data.influencer_code);
    const numInfId = data.influencer_id ? Number(data.influencer_id) : null;
    const awb = (data.redispatch_awb || '').trim();
    if (!cId || (!code && !numInfId) || !awb) {
      return { success: false, error: 'Invalid parameters for transitionReDispatchToDispatched' };
    }

    try {
      const nowIso = new Date().toISOString();
      const courierName = data.courier || 'Delhivery';
      const displayStatus = data.displayStatus || 'Dispatched';
      const orderId = data.order_id || `R ${code}`;

      // 1. Authoritative update in redispatch_records: redispatch_status = 'MOVED_TO_ACTIVE'
      let rdQuery = supabaseAdmin
        .from(SUPABASE_TABLES.redispatchRecords)
        .update({
          redispatch_status: 'MOVED_TO_ACTIVE',
          moved_to_active_at: nowIso,
          order_id: orderId,
          updated_at: nowIso
        })
        .eq('campaign_id', cId);

      if (code) {
        rdQuery = rdQuery.eq('influencer_code', code);
      } else if (numInfId && !isNaN(numInfId)) {
        rdQuery = rdQuery.eq('influencer_id', numInfId);
      }
      await rdQuery;

      // 2. Upsert shipment_attempts
      if (numInfId && !isNaN(numInfId)) {
        try {
          const existingAttempts = await shipmentAttemptService.getShipmentAttempts(cId, numInfId);
          const existingAttempt = existingAttempts.find(
            a => a.awb_number === awb || (a.shipment_type === 'RE_DISPATCH' && !a.delivery_confirmed)
          );

          if (existingAttempt) {
            await supabaseAdmin
              .from(SUPABASE_TABLES.shipmentAttempts)
              .update({
                order_id: orderId,
                awb_number: awb,
                courier: courierName,
                shipment_status: displayStatus,
                dispatch_date: data.dispatchDate || existingAttempt.dispatch_date || null,
                estimated_delivery_date: data.estimatedDeliveryDate || existingAttempt.estimated_delivery_date || null,
                delivered_date: data.deliveredDate || existingAttempt.delivered_date || null,
                remarks: data.remarks || existingAttempt.remarks || `Re-Dispatch sent via ${courierName}`,
                updated_at: nowIso
              })
              .eq('id', existingAttempt.id);
          } else {
            const nextAttemptNum = data.attemptNumber || (existingAttempts.length > 0 ? existingAttempts.length + 1 : 2);
            await supabaseAdmin
              .from(SUPABASE_TABLES.shipmentAttempts)
              .insert({
                campaign_id: cId,
                influencer_id: numInfId,
                attempt_number: nextAttemptNum,
                shipment_type: 'RE_DISPATCH',
                courier: courierName,
                order_id: orderId,
                awb_number: awb,
                shipment_status: displayStatus,
                dispatch_date: data.dispatchDate || null,
                estimated_delivery_date: data.estimatedDeliveryDate || null,
                delivered_date: data.deliveredDate || null,
                remarks: data.remarks || `Re-Dispatch sent via ${courierName}`,
                delivery_confirmed: displayStatus.toLowerCase() === 'delivered',
                status_tracking_started: false,
                created_at: nowIso,
                updated_at: nowIso
              });
          }
        } catch (attErr) {
          console.error('Error updating shipment_attempts in transitionReDispatchToDispatched:', attErr);
        }
      }

      // 3. Update influencer_status_tracking_rows notes: update redispatch_cycles with redispatch_awb
      if (numInfId && !isNaN(numInfId)) {
        try {
          const numCampId = Number(cId);
          const campQuery = !isNaN(numCampId) ? numCampId : cId;
          const { data: stRow } = await supabaseAdmin
            .from(SUPABASE_TABLES.influencerStatus)
            .select('id, notes, status')
            .eq('campaign_id', campQuery)
            .eq('influencer_id', numInfId)
            .maybeSingle();

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
            meta.redispatch_awb = awb;
            meta.last_updated = nowIso;

            if (Array.isArray(meta.redispatch_cycles) && meta.redispatch_cycles.length > 0) {
              const lastCycle = meta.redispatch_cycles[meta.redispatch_cycles.length - 1];
              lastCycle.status = 'MOVED_TO_ACTIVE';
              lastCycle.redispatch_awb = awb;
              lastCycle.redispatch_code = orderId;
              lastCycle.courier = courierName;
              lastCycle.moved_to_active_at = lastCycle.moved_to_active_at || nowIso;
              lastCycle.updated_at = nowIso;
            } else {
              meta.redispatch_cycles = [{
                cycle_number: 1,
                status: 'MOVED_TO_ACTIVE',
                redispatch_awb: awb,
                redispatch_code: orderId,
                courier: courierName,
                issue_type: meta.issue_type || 'DAMAGED_PRODUCT',
                issue_remarks: meta.issue_remarks || '',
                moved_to_active_at: nowIso,
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
          }
        } catch (stErr) {
          console.error('Error updating influencer_status in transitionReDispatchToDispatched:', stErr);
        }
      }

      // 4. Update influencer_dispatch_details_rows: auto-populate replacement dispatch details
      if (numInfId && !isNaN(numInfId)) {
        try {
          const numCampId = Number(cId);
          const campQuery = !isNaN(numCampId) ? numCampId : cId;
          await supabaseAdmin
            .from(SUPABASE_TABLES.influencerDispatch)
            .update({
              courier_partner: courierName,
              tracking_id: awb,
              dispatch_date: data.dispatchDate || null,
              expected_delivery_date: data.estimatedDeliveryDate || null,
              dispatch_status: 'Dispatched',
              remarks: data.remarks || `Re-Dispatch sent via ${courierName} (AWB: ${awb})`
            })
            .eq('campaign_id', campQuery)
            .eq('influencer_id', numInfId);
        } catch (dispErr) {
          console.error('Error updating influencer_dispatch in transitionReDispatchToDispatched:', dispErr);
        }
      }

      // 5. Broadcast real-time reactivity events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('influencer_tracking_updated', {
          detail: { campaignId: cId, influencerId: numInfId, code }
        }));
        window.dispatchEvent(new CustomEvent('influencer_status_updated', {
          detail: { campaignId: cId, influencerId: numInfId, code }
        }));
        window.dispatchEvent(new CustomEvent('velmora:influencer-updated'));
      }

      return { success: true };
    } catch (e: any) {
      console.error('Exception in transitionReDispatchToDispatched:', e);
      return { success: false, error: e?.message || 'Failed to transition re-dispatch' };
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

      // 0. Verify influencer exists, belongs to campaign, and is active
      if (!isNaN(numInfId) && numInfId > 0) {
        const { data: infCheck } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, is_archived, campaign_id')
          .eq('id', numInfId)
          .maybeSingle();

        if (!infCheck || !isActiveStatus(infCheck.is_archived) || String(infCheck.campaign_id) !== cId) {
          return { success: false, error: 'Cannot move eliminated or inactive influencer to active' };
        }
      }

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
