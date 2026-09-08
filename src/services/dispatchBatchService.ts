import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { logActivity } from './activityService';
import type { CampaignInfluencer } from '../types';
import { isActiveStatus } from '../utils/marketingUtils';

export type BatchStatus = 'Pending' | 'Ready to Dispatch' | 'Dispatched' | 'Preparing';

export interface DispatchBatchMember {
  id?: string;
  influencer_id: string;
  influencer_code?: string;
  creator_name?: string;
  profile_file_url?: string;
  dispatch_status: BatchStatus;
}

export interface DispatchBatch {
  id: string;
  campaign_id: string;
  batch_name: string;
  dispatch_date: string;
  dispatch_time: string;
  status: BatchStatus;
  members: DispatchBatchMember[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

const getStorageKey = (campaignId: string | number) => `influencer_dispatch_batches_${campaignId}`;

/**
 * Format a Date or ISO timestamp into readable Date and Time:
 * Date: "08 Sep 2026"
 * Time: "03:54 PM"
 */
export const formatBatchDateTime = (dateStrOrObj?: string | Date) => {
  const d = dateStrOrObj ? new Date(dateStrOrObj) : new Date();
  if (isNaN(d.getTime())) {
    return { displayDate: '—', displayTime: '—' };
  }

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const displayDate = `${day} ${month} ${year}`;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const displayTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

  return { displayDate, displayTime };
};

export const dispatchBatchService = {
  /**
   * Load all batches for a campaign from Supabase system_settings and/or localStorage.
   * Authoritatively reconciles with influencer_dispatch_details_rows:
   * 1. Any active influencer with status 'prepare_dispatch' missing from batches is automatically grouped into a batch and persisted.
   * 2. Any influencer returned to 'pending' in the database is pruned from batches.
   * 3. Ensures batches survive browser refresh and device reloads with 100% data consistency.
   */
  async getBatches(campaignId: string | number, options?: { skipReconcile?: boolean }): Promise<DispatchBatch[]> {
    const cId = String(campaignId);
    const settingKey = getStorageKey(cId);

    // 1. Try fetching from Supabase system_settings
    let rawBatches: DispatchBatch[] = [];
    let loadedFromSettings = false;

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
        rawBatches = data.setting_value as DispatchBatch[];
        loadedFromSettings = true;
      }
    } catch (err) {
      console.warn('Failed to query batches from Supabase system_settings:', err);
    }

    // 2. Fallback to localStorage
    if (!loadedFromSettings) {
      try {
        const cached = localStorage.getItem(settingKey);
        if (cached) {
          rawBatches = JSON.parse(cached) as DispatchBatch[];
        }
      } catch (e) {
        console.warn('Failed to parse local batches cache:', e);
      }
    }

    // If skipReconcile requested, return rawBatches directly
    if (options?.skipReconcile) {
      return rawBatches;
    }

    // 3. Authoritative Reconciliation with Supabase influencer_dispatch_details_rows
    try {
      const numericCampaignId = isNaN(Number(cId)) ? cId : Number(cId);
      const { data: dispatchRows, error: dispatchErr } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id, influencer_id, campaign_id, creator_name, dispatch_status, dispatch_date, created_at')
        .eq('campaign_id', numericCampaignId);

      if (!dispatchErr && dispatchRows) {
        let hasChanges = false;
        
        // Build map of current dispatch statuses in DB
        const dbStatusMap = new Map<string, string>();
        const prepareDispatchRows: typeof dispatchRows = [];
        
        dispatchRows.forEach(r => {
          const infIdStr = String(r.influencer_id);
          const st = (r.dispatch_status || '').trim().toLowerCase();
          dbStatusMap.set(infIdStr, st);
          if (st === 'prepare_dispatch' || st === 'ready to dispatch') {
            prepareDispatchRows.push(r);
          }
        });

        // Track which influencer IDs already exist in rawBatches
        const batchedIdSet = new Set<string>();
        
        // A. Clean up existing batches based on DB status
        const cleanedBatches = rawBatches.map(b => {
          const originalMemberCount = b.members.length;
          const validMembers = b.members.filter(m => {
            const dbStatus = dbStatusMap.get(String(m.influencer_id));
            // If DB explicitly marks them as pending, they were returned to logistics
            if (dbStatus === 'pending') {
              hasChanges = true;
              return false;
            }
            return true;
          }).map(m => {
            const dbStatus = dbStatusMap.get(String(m.influencer_id));
            if ((dbStatus === 'dispatched' || dbStatus === 'tracking') && m.dispatch_status !== 'Dispatched') {
              hasChanges = true;
              return { ...m, dispatch_status: 'Dispatched' as BatchStatus };
            }
            return m;
          });

          if (validMembers.length !== originalMemberCount) {
            hasChanges = true;
          }

          validMembers.forEach(m => batchedIdSet.add(String(m.influencer_id)));

          return {
            ...b,
            members: validMembers
          };
        }).filter(b => b.members.length > 0);

        if (cleanedBatches.length !== rawBatches.length) {
          hasChanges = true;
        }
        rawBatches = cleanedBatches;

        // B. Check for unbatched influencers with 'prepare_dispatch' in DB
        const unbatched = prepareDispatchRows.filter(r => !batchedIdSet.has(String(r.influencer_id)));

        if (unbatched.length > 0) {
          hasChanges = true;
          
          // Fetch influencer details from influencers_info_rows
          const unbatchedIds = unbatched.map(u => isNaN(Number(u.influencer_id)) ? u.influencer_id : Number(u.influencer_id));
          const { data: infDetails } = await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .select('id, code, name, influencer_name, profile_file_url, is_archived')
            .in('id', unbatchedIds);

          const infMap = new Map<string, any>();
          (infDetails || []).forEach(inf => infMap.set(String(inf.id), inf));

          // Find current max batch number to ensure sequential numbering
          let maxNum = 0;
          for (const b of rawBatches) {
            const match = (b.batch_name || '').match(/BATCH-(\d+)/i);
            if (match) {
              const n = parseInt(match[1], 10);
              if (!isNaN(n) && n > maxNum) maxNum = n;
            }
          }

          const nextBatchNumber = maxNum + 1;
          const batchCode = `BATCH-${String(nextBatchNumber).padStart(3, '0')}`;
          const firstRow = unbatched[0];
          const { displayDate, displayTime } = formatBatchDateTime(firstRow.created_at || firstRow.dispatch_date || new Date());

          const synthesizedBatch: DispatchBatch = {
            id: `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            campaign_id: cId,
            batch_name: batchCode,
            dispatch_date: displayDate,
            dispatch_time: displayTime,
            status: 'Preparing',
            created_at: firstRow.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: 'Admin',
            members: unbatched.map(u => {
              const inf = infMap.get(String(u.influencer_id));
              return {
                influencer_id: String(u.influencer_id),
                influencer_code: inf?.code || '',
                creator_name: inf?.name || inf?.influencer_name || u.creator_name || 'Influencer',
                profile_file_url: inf?.profile_file_url || '',
                dispatch_status: 'Pending' as BatchStatus
              };
            })
          };

          rawBatches.push(synthesizedBatch);
        }

        // C. If changes occurred during reconciliation, persist them immediately
        if (hasChanges) {
          await this.saveBatches(campaignId, rawBatches);
        }
      }
    } catch (reconcileErr) {
      console.warn('Error during batch reconciliation with Supabase dispatch records:', reconcileErr);
    }

    // Keep local cache synced
    try {
      localStorage.setItem(settingKey, JSON.stringify(rawBatches));
    } catch (e) {}

    return rawBatches;
  },

  /**
   * Saves batches to Supabase system_settings and localStorage.
   */
  async saveBatches(campaignId: string | number, batches: DispatchBatch[]): Promise<boolean> {
    const cId = String(campaignId);
    const settingKey = getStorageKey(cId);

    // 1. Immediately persist to localStorage for instant UI response
    try {
      localStorage.setItem(settingKey, JSON.stringify(batches));
    } catch (e) {
      console.warn('Failed to persist batches to localStorage:', e);
    }

    // 2. Persist to Supabase system_settings
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (existing?.id) {
        const { error: updateErr } = await supabase
          .from('system_settings')
          .update({
            setting_value: batches,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('system_settings')
          .insert([{
            setting_key: settingKey,
            setting_value: batches,
            description: `Dispatch batches for campaign ${cId}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertErr) throw insertErr;
      }
      return true;
    } catch (err) {
      console.error('Failed to persist batches to Supabase system_settings:', err);
      return false;
    }
  },

  /**
   * Confirms dispatch for a batch:
   * 1. Marks batch as Dispatched
   * 2. Marks batch members as Dispatched
   * 3. Updates influencer_dispatch_details_rows in Supabase for all member influencers
   * 4. Persists the updated state
   * 5. Logs activity
   */
  async confirmDispatch(
    campaignId: string | number,
    batchId: string,
    allBatches: DispatchBatch[],
    activeInfluencers: CampaignInfluencer[]
  ): Promise<DispatchBatch[]> {
    const cId = String(campaignId);
    const numericCampaignId = isNaN(Number(cId)) ? cId : Number(cId);
    const targetBatch = allBatches.find(b => b.id === batchId);
    if (!targetBatch) {
      throw new Error(`Batch with ID ${batchId} not found`);
    }

    const updatedBatch: DispatchBatch = {
      ...targetBatch,
      status: 'Dispatched',
      members: targetBatch.members.map(m => ({
        ...m,
        dispatch_status: 'Dispatched',
      })),
      updated_at: new Date().toISOString(),
    };

    const updatedBatches = allBatches.map(b => (b.id === batchId ? updatedBatch : b));

    // Update influencer_dispatch_details_rows for every influencer in the batch
    const influencerMap = new Map<string, CampaignInfluencer>();
    activeInfluencers.forEach(inf => {
      influencerMap.set(String(inf.id), inf);
    });

    for (const member of updatedBatch.members) {
      try {
        const inf = influencerMap.get(String(member.influencer_id));
        const creatorName = inf?.name || inf?.influencer_name || member.creator_name || 'Influencer';
        const numericInfId = isNaN(Number(member.influencer_id)) ? member.influencer_id : Number(member.influencer_id);

        // Check if dispatch record exists
        const { data: existing } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .eq('influencer_id', numericInfId)
          .eq('campaign_id', numericCampaignId)
          .maybeSingle();

        if (existing && existing.id) {
          await supabase
            .from(SUPABASE_TABLES.influencerDispatch)
            .update({
              dispatch_status: 'Dispatched',
              dispatch_date: updatedBatch.dispatch_date,
            })
            .eq('id', existing.id);
        } else {
          // Get max ID
          const { data: maxData } = await supabase
            .from(SUPABASE_TABLES.influencerDispatch)
            .select('id')
            .order('id', { ascending: false })
            .limit(1);

          const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
          const nextId = isNaN(maxId) ? 1 : maxId + 1;

          await supabase
            .from(SUPABASE_TABLES.influencerDispatch)
            .insert([{
              id: nextId,
              influencer_id: numericInfId,
              campaign_id: numericCampaignId,
              creator_name: creatorName,
              dispatch_date: updatedBatch.dispatch_date,
              dispatch_status: 'Dispatched',
              created_at: new Date().toISOString(),
            }]);
        }
      } catch (e) {
        console.error(`Failed to update dispatch record for influencer ${member.influencer_id}:`, e);
      }
    }

    // Save updated batches
    await this.saveBatches(cId, updatedBatches);

    // Non-blocking activity logging
    logActivity(
      'Logistics',
      'Batch Dispatched',
      `Batch "${updatedBatch.batch_name}" with ${updatedBatch.members.length} influencers was dispatched on ${updatedBatch.dispatch_date} at ${updatedBatch.dispatch_time}.`
    );

    return updatedBatches;
  },

  /**
   * Filter out eliminated or recycle bin influencers from all batches.
   */
  pruneInactiveMembers(
    batches: DispatchBatch[],
    activeInfluencers: CampaignInfluencer[]
  ): { updatedBatches: DispatchBatch[]; removedCount: number } {
    const activeIdSet = new Set(
      activeInfluencers
        .filter(inf => isActiveStatus(inf.is_archived))
        .map(inf => String(inf.id))
    );

    let removedCount = 0;
    const updatedBatches = batches.map(batch => {
      const filteredMembers = batch.members.filter(m => {
        const isAct = activeIdSet.has(String(m.influencer_id));
        if (!isAct) removedCount++;
        return isAct;
      });

      return {
        ...batch,
        members: filteredMembers,
      };
    }).filter(batch => batch.members.length > 0);

    return { updatedBatches, removedCount };
  }
};
