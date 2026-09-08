import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { logActivity } from './activityService';
import type { CampaignInfluencer } from '../types';
import { isActiveStatus } from '../utils/marketingUtils';

export type BatchStatus = 'Pending' | 'Ready to Dispatch' | 'Dispatched';

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

const getStorageKey = (campaignId: string | number) => `velmora_dispatch_batches_${campaignId}`;

export const dispatchBatchService = {
  /**
   * Load all batches for a campaign from Supabase and/or localStorage.
   * Ensures data survives browser refresh.
   */
  async getBatches(campaignId: string | number): Promise<DispatchBatch[]> {
    const cId = String(campaignId);
    let batches: DispatchBatch[] = [];

    // 1. Try local storage first for fast instant response
    try {
      const cached = localStorage.getItem(getStorageKey(cId));
      if (cached) {
        batches = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse local batches cache:', e);
    }

    // 2. Try fetching from Supabase
    try {
      const { data: batchRows, error: batchError } = await supabase
        .from(SUPABASE_TABLES.influencerDispatchBatches || 'influencer_dispatch_batches')
        .select('*')
        .eq('campaign_id', cId)
        .order('created_at', { ascending: true });

      if (!batchError && batchRows && batchRows.length > 0) {
        // Fetch members
        const batchIds = batchRows.map(b => b.id);
        const { data: memberRows } = await supabase
          .from(SUPABASE_TABLES.influencerDispatchBatchMembers || 'influencer_dispatch_batch_members')
          .select('*')
          .in('batch_id', batchIds);

        const memberMap: Record<string, DispatchBatchMember[]> = {};
        (memberRows || []).forEach((m: any) => {
          if (!memberMap[m.batch_id]) memberMap[m.batch_id] = [];
          memberMap[m.batch_id].push({
            id: m.id,
            influencer_id: String(m.influencer_id),
            influencer_code: m.influencer_code,
            dispatch_status: (m.dispatch_status as BatchStatus) || 'Pending',
          });
        });

        const remoteBatches: DispatchBatch[] = batchRows.map(b => ({
          id: b.id,
          campaign_id: String(b.campaign_id),
          batch_name: b.batch_name,
          dispatch_date: b.dispatch_date,
          dispatch_time: b.dispatch_time,
          status: (b.status as BatchStatus) || 'Pending',
          members: memberMap[b.id] || [],
          created_at: b.created_at,
          updated_at: b.updated_at,
        }));

        batches = remoteBatches;
        // Keep local cache synced
        localStorage.setItem(getStorageKey(cId), JSON.stringify(batches));
      }
    } catch (err) {
      // Supabase table may not exist yet; gracefully fallback to local cache
      console.warn('Supabase batch table query skipped or failed, using local storage cache:', err);
    }

    return batches;
  },

  /**
   * Saves batches to localStorage and attempts to persist to Supabase tables.
   */
  async saveBatches(campaignId: string | number, batches: DispatchBatch[]): Promise<void> {
    const cId = String(campaignId);

    // 1. Immediately persist to localStorage
    try {
      localStorage.setItem(getStorageKey(cId), JSON.stringify(batches));
    } catch (e) {
      console.warn('Failed to persist batches to localStorage:', e);
    }

    // 2. Persist to Supabase if tables exist
    try {
      for (const batch of batches) {
        const batchPayload = {
          id: batch.id,
          campaign_id: cId,
          batch_name: batch.batch_name,
          dispatch_date: batch.dispatch_date,
          dispatch_time: batch.dispatch_time,
          status: batch.status,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertBatchErr } = await supabase
          .from(SUPABASE_TABLES.influencerDispatchBatches || 'influencer_dispatch_batches')
          .upsert(batchPayload, { onConflict: 'id' });

        if (!upsertBatchErr && batch.members.length > 0) {
          const membersPayload = batch.members.map(m => ({
            batch_id: batch.id,
            campaign_id: cId,
            influencer_id: String(m.influencer_id),
            influencer_code: m.influencer_code || '',
            dispatch_status: batch.status === 'Dispatched' ? 'Dispatched' : (m.dispatch_status || 'Pending'),
          }));

          // Upsert members
          await supabase
            .from(SUPABASE_TABLES.influencerDispatchBatchMembers || 'influencer_dispatch_batch_members')
            .upsert(membersPayload, { onConflict: 'batch_id,influencer_id' });
        }
      }
    } catch (err) {
      console.warn('Supabase batch upsert skipped or failed:', err);
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

        // Check if dispatch record exists
        const { data: existing } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .eq('influencer_id', member.influencer_id)
          .eq('campaign_id', cId)
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
            .not('id', 'is', null)
            .order('id', { ascending: false })
            .limit(1);

          const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
          const nextId = isNaN(maxId) ? 1 : maxId + 1;

          await supabase
            .from(SUPABASE_TABLES.influencerDispatch)
            .insert([{
              id: nextId,
              influencer_id: member.influencer_id,
              campaign_id: cId,
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
   * Filters out eliminated/recycled influencers from non-dispatched (Pending/Ready) batches
   * to ensure that eliminated influencers are never dispatched, while preserving
   * historical dispatched records.
   */
  pruneInactiveMembers(
    batches: DispatchBatch[],
    allCampaignInfluencers: CampaignInfluencer[]
  ): { updatedBatches: DispatchBatch[]; prunedCount: number } {
    const influencerMap = new Map<string, CampaignInfluencer>();
    allCampaignInfluencers.forEach(inf => {
      influencerMap.set(String(inf.id), inf);
    });

    let prunedCount = 0;

    const updatedBatches = batches.map(batch => {
      // Historical dispatched batches are never pruned
      if (batch.status === 'Dispatched') {
        return batch;
      }

      // Pending / Ready batches: prune members that are eliminated or recycled
      const validMembers = batch.members.filter(member => {
        const inf = influencerMap.get(String(member.influencer_id));
        if (!inf) return false;
        const isActive = isActiveStatus(inf.is_archived);
        if (!isActive) {
          prunedCount++;
          return false;
        }
        return true;
      });

      return {
        ...batch,
        members: validMembers,
      };
    });

    return { updatedBatches, prunedCount };
  }
};
