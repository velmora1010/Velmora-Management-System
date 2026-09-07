import { supabase } from '../lib/supabase';

export interface OfferAgreementDbRow {
  id: string;
  campaign_id: string;
  influencer_id: string;
  influencer_code: string;
  username: string;
  price_per_video: number;
  agreement_price: number;
  publishing_dates: any;
  draft_dates: any;
  agreement_text: string;
  pdf_path?: string | null;
  pdf_url?: string | null;
  generated_at?: string;
  created_at?: string;
  updated_at?: string;
  mail_acceptance?: 'Accepted' | 'Not Accepted' | null;
}

export interface UpdateMailAcceptanceTarget {
  id?: string;
  campaignId?: string | number;
  influencerId?: string | number;
  influencerCode?: string;
}

export const offerAgreementService = {
  /**
   * Fetch all existing offer agreements for a campaign directly from Supabase
   */
  async getAgreements(campaignId: string | number): Promise<OfferAgreementDbRow[]> {
    const { data, error } = await supabase
      .from('offer_agreements')
      .select('*')
      .eq('campaign_id', String(campaignId));

    if (error) {
      console.error('Failed to fetch offer_agreements from Supabase:', error);
      throw error;
    }

    return (data || []) as OfferAgreementDbRow[];
  },

  /**
   * Canonical update function for Mail Acceptance on an existing Offer Agreement record.
   * Priority:
   * 1. Existing offer_agreements.id
   * 2. campaign_id + influencer_id
   * 3. campaign_id + influencer_code
   */
  async updateMailAcceptance(
    target: UpdateMailAcceptanceTarget,
    status: 'Accepted' | 'Not Accepted' | null
  ): Promise<boolean> {
    const now = new Date().toISOString();
    let query = supabase.from('offer_agreements').update({
      mail_acceptance: status,
      updated_at: now
    });

    if (target.id) {
      query = query.eq('id', target.id);
    } else if (target.campaignId && target.influencerId) {
      query = query
        .eq('campaign_id', String(target.campaignId))
        .eq('influencer_id', String(target.influencerId));
    } else if (target.campaignId && target.influencerCode) {
      query = query
        .eq('campaign_id', String(target.campaignId))
        .eq('influencer_code', target.influencerCode.trim());
    } else {
      throw new Error('updateMailAcceptance requires an id, or campaignId + influencerId/influencerCode');
    }

    const { error } = await query;
    if (error) {
      console.error('Failed to update mail_acceptance in offer_agreements:', error);
      throw error;
    }

    return true;
  },

  /**
   * Efficient batch update for Excel import.
   * Runs in parallel batches of 15 to safely update all records without duplicate creation.
   */
  async batchUpdateMailAcceptance(
    campaignId: string | number,
    updates: Array<{
      id?: string;
      influencerId?: string | number;
      influencerCode?: string;
      mailAcceptance: 'Accepted' | 'Not Accepted';
    }>
  ): Promise<{ updatedCount: number; errors: any[] }> {
    let updatedCount = 0;
    const errors: any[] = [];

    const chunkSize = 15;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async item => {
          try {
            await this.updateMailAcceptance(
              {
                id: item.id,
                campaignId,
                influencerId: item.influencerId,
                influencerCode: item.influencerCode
              },
              item.mailAcceptance
            );
            updatedCount++;
          } catch (err) {
            console.error('Failed to update mail acceptance for ' + (item.influencerCode || item.influencerId) + ':', err);
            errors.push({ item, err });
          }
        })
      );
    }

    return { updatedCount, errors };
  }
};
