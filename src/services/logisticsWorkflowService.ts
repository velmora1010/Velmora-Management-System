import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer, Campaign } from '../types';

export const logisticsWorkflowService = {
  /**
   * Moves selected active influencers to 'prepare_dispatch' stage.
   * Persists their status in influencer_dispatch_details_rows in Supabase.
   */
  async moveToPrepareDispatch(
    campaign: Campaign,
    selectedInfluencers: CampaignInfluencer[]
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!campaign?.id || selectedInfluencers.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const campaignId = String(campaign.id);
      const influencerIds = selectedInfluencers.map(inf => String(inf.id));

      // 1. Fetch existing rows for this campaign and selected influencers
      const { data: existingRows, error: fetchErr } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id, influencer_id, dispatch_status')
        .eq('campaign_id', campaignId)
        .in('influencer_id', influencerIds);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map<string, any>();
      (existingRows || []).forEach(r => {
        existingMap.set(String(r.influencer_id), r);
      });

      // Rows to update to 'prepare_dispatch' (skip those already Dispatched or Tracking)
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

        if (updateErr) throw updateErr;
      }

      // Influencers needing a new row in influencer_dispatch_details_rows
      const toInsertInfluencers = selectedInfluencers.filter(inf => !existingMap.has(String(inf.id)));

      if (toInsertInfluencers.length > 0) {
        // Query current max id
        const { data: maxData } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .not('id', 'is', null)
          .order('id', { ascending: false })
          .limit(1);

        const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
        let nextId = isNaN(maxId) ? 1 : maxId + 1;

        const newRows = toInsertInfluencers.map(inf => {
          const row = {
            id: nextId++,
            influencer_id: String(inf.id),
            campaign_id: campaignId,
            creator_name: inf.influencer_name || inf.name || '',
            influencer_code: inf.code || '',
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
            courier_partner: '',
            tracking_id: '',
            dispatch_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: null,
            dispatch_status: 'prepare_dispatch',
            created_at: new Date().toISOString()
          };
          return row;
        });

        const { error: insertErr } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .insert(newRows);

        if (insertErr) throw insertErr;
      }

      return { success: true, count: selectedInfluencers.length };
    } catch (err: any) {
      console.error('Error moving influencers to prepare dispatch:', err);
      return { success: false, count: 0, error: err.message || 'Failed to move influencers' };
    }
  },

  /**
   * Returns an influencer from 'prepare_dispatch' back to 'pending' (Logistics).
   */
  async returnToLogistics(
    campaignId: string,
    influencerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({ dispatch_status: 'pending' })
        .eq('campaign_id', campaignId)
        .eq('influencer_id', influencerId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Error returning influencer to logistics:', err);
      return { success: false, error: err.message || 'Failed to return to logistics' };
    }
  }
};
