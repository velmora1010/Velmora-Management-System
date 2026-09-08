import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer, Campaign } from '../types';
import { 
  dispatchBatchService, 
  formatBatchDateTime, 
  type DispatchBatch 
} from './dispatchBatchService';

export const logisticsWorkflowService = {
  /**
   * Moves selected active influencers to 'prepare_dispatch' stage and groups them into ONE newly created Batch.
   * - Persists individual influencer dispatch status in influencer_dispatch_details_rows.
   * - Persists the batch in Supabase system_settings and localStorage.
   */
  async moveToPrepareDispatch(
    campaign: Campaign,
    selectedInfluencers: CampaignInfluencer[]
  ): Promise<{ success: boolean; count: number; batch?: DispatchBatch; error?: string }> {
    if (!campaign?.id || selectedInfluencers.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const campaignId = String(campaign.id);
      const influencerIds = selectedInfluencers.map(inf => String(inf.id));
      const numericCampaignId = isNaN(Number(campaignId)) ? campaignId : Number(campaignId);
      const now = new Date();
      const { displayDate, displayTime } = formatBatchDateTime(now);

      // 1. Fetch existing rows for this campaign and selected influencers in influencer_dispatch_details_rows
      const { data: existingRows, error: fetchErr } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id, influencer_id, dispatch_status')
        .eq('campaign_id', numericCampaignId)
        .in('influencer_id', influencerIds.map(id => isNaN(Number(id)) ? id : Number(id)));

      if (fetchErr) {
        console.error('Error fetching existing dispatch rows:', fetchErr);
        throw fetchErr;
      }

      const existingMap = new Map<string, any>();
      (existingRows || []).forEach(r => {
        existingMap.set(String(r.influencer_id), r);
      });

      // 2. Rows to update to 'prepare_dispatch' (skip those already Dispatched or Tracking)
      const toUpdate = (existingRows || [])
        .filter(r => {
          const st = (r.dispatch_status || '').toLowerCase();
          return st !== 'dispatched' && st !== 'tracking';
        })
        .map(r => r.id);

      if (toUpdate.length > 0) {
        const { error: updateErr } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .update({
            dispatch_status: 'prepare_dispatch'
          })
          .in('id', toUpdate);

        if (updateErr) {
          console.error('Error updating existing dispatch rows to prepare_dispatch:', updateErr);
          throw updateErr;
        }
      }

      // 3. Influencers needing a new row in influencer_dispatch_details_rows
      const toInsertInfluencers = selectedInfluencers.filter(inf => !existingMap.has(String(inf.id)));

      if (toInsertInfluencers.length > 0) {
        // Query current max id in influencer_dispatch_details_rows
        const { data: maxData } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .order('id', { ascending: false })
          .limit(1);

        const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
        let nextId = isNaN(maxId) ? 1 : maxId + 1;

        const newRows = toInsertInfluencers.map(inf => {
          const numericInfId = isNaN(Number(inf.id)) ? inf.id : Number(inf.id);
          const row = {
            id: nextId++,
            influencer_id: numericInfId,
            campaign_id: numericCampaignId,
            creator_name: inf.influencer_name || inf.name || '',
            phone_number: inf.phone_number || '',
            alternative_phone_number: inf.alternative_number || '',
            address: inf.complete_address || (inf as any).address || '',
            state: inf.state || '',
            campaign_name: campaign.campaign_name || '',
            product_name: '',
            selected_products: [],
            total_products: 0,
            total_product_value: null,
            total_weight: null,
            product_photo_url: null,
            courier_partner: '',
            dispatch_photo_url: null,
            tracking_id: '',
            dispatch_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: null,
            dispatch_status: 'prepare_dispatch',
            created_at: now.toISOString()
          };
          return row;
        });

        const { error: insertErr } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .insert(newRows);

        if (insertErr) {
          console.error('Error inserting new dispatch rows for prepare_dispatch:', insertErr);
          throw insertErr;
        }
      }

      // 4. Create ONE Prepare Dispatch Batch for this single action
      const existingBatches = await dispatchBatchService.getBatches(campaign.id);
      const batchNumber = existingBatches.length + 1;
      const batchCode = `BATCH-${String(batchNumber).padStart(3, '0')}`;

      const newBatch: DispatchBatch = {
        id: `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        campaign_id: campaignId,
        batch_name: batchCode,
        dispatch_date: displayDate,
        dispatch_time: displayTime,
        status: 'Preparing',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        members: selectedInfluencers.map(inf => ({
          influencer_id: String(inf.id),
          influencer_code: inf.code || '',
          creator_name: inf.influencer_name || inf.name || '',
          profile_file_url: inf.profile_file_url,
          dispatch_status: 'Pending'
        }))
      };

      const updatedBatches = [...existingBatches, newBatch];
      await dispatchBatchService.saveBatches(campaign.id, updatedBatches);

      return { 
        success: true, 
        count: selectedInfluencers.length, 
        batch: newBatch 
      };
    } catch (err: any) {
      console.error('Error moving influencers to prepare dispatch:', err);
      return { 
        success: false, 
        count: 0, 
        error: err.message || 'Failed to move influencers to Prepare Dispatch' 
      };
    }
  },

  /**
   * Returns an influencer from 'prepare_dispatch' back to 'pending' (Logistics).
   * Also removes them from their batch in Supabase.
   */
  async returnToLogistics(
    campaignId: string,
    influencerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const numericCampaignId = isNaN(Number(campaignId)) ? campaignId : Number(campaignId);
      const numericInfId = isNaN(Number(influencerId)) ? influencerId : Number(influencerId);

      // 1. Update status in influencer_dispatch_details_rows
      const { error } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({ dispatch_status: 'pending' })
        .eq('campaign_id', numericCampaignId)
        .eq('influencer_id', numericInfId);

      if (error) throw error;

      // 2. Remove influencer from existing batches
      const batches = await dispatchBatchService.getBatches(campaignId);
      const updatedBatches = batches.map(batch => ({
        ...batch,
        members: batch.members.filter(m => String(m.influencer_id) !== String(influencerId))
      })).filter(batch => batch.members.length > 0);

      await dispatchBatchService.saveBatches(campaignId, updatedBatches);

      return { success: true };
    } catch (err: any) {
      console.error('Error returning influencer to logistics:', err);
      return { success: false, error: err.message || 'Failed to return to logistics' };
    }
  }
};
