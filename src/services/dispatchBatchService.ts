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
   * Ensures batches survive browser refresh and device reloads.
   */
  async getBatches(campaignId: string | number): Promise<DispatchBatch[]> {
    const cId = String(campaignId);
    const settingKey = getStorageKey(cId);

    // 1. Try fetching from Supabase system_settings
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
        const batches = data.setting_value as DispatchBatch[];
        // Keep local cache synced
        try {
          localStorage.setItem(settingKey, JSON.stringify(batches));
        } catch (e) {}
        return batches;
      }
    } catch (err) {
      console.warn('Failed to query batches from Supabase system_settings:', err);
    }

    // 2. Fallback to localStorage
    try {
      const cached = localStorage.getItem(settingKey);
      if (cached) {
        return JSON.parse(cached) as DispatchBatch[];
      }
    } catch (e) {
      console.warn('Failed to parse local batches cache:', e);
    }

    return [];
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
