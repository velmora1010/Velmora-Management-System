import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export interface StatusTrackingRecord {
  id: string;
  dispatch_id: string;
  campaign_id: string;
  influencer_id: string;
  current_step: number;
  delivered_confirmed: boolean;
  pay_advance_completed: boolean;
  reference_video_received: boolean;
  expected_delivery_completed: boolean;
  draft_received: boolean;
  payment_remaining_completed: boolean;
  final_post_completed: boolean;
  delivery_photo_url: string;
  reference_video_url: string;
  draft_video_url: string;
  final_post_url: string;
  notes: string;
  status: string;
  advance_gpay_number: string;
  advance_total_amount: string;
  advance_paid_amount: string;
  pay_advance_photo_url: string;
  ref_concept: string;
  ref_script: string;
  ref_keypoints: string;
  ref_offer: string;
  ref_link: string;
  ref_call_explanation_required: boolean;
  reference_videos_list: string[];
  draft_expected_date: string;
  draft_expected_time: string;
  posting_timelines: any[];
  draft_approval_status: string;
  draft_timing_status: string;
  draft_corrections_required: string;
  draft_final_product_link: string;
  draft_final_description: string;
  payment_remaining_photo_url: string;
  final_post_link: string;
  final_post_actual_datetime: string;
  re_draft_expected_date: string;
  re_draft_expected_time: string;
  re_posting_timelines: any[];
  re_draft_video_url: string;
  re_draft_approval_status: string;
  re_draft_timing_status: string;
  re_draft_corrections_required: string;
  re_draft_final_product_link: string;
  re_draft_final_description: string;
  
  // Joined from influencer_dispatch_details & influencers_info
  dispatch?: {
    campaign_name: string;
    address: string;
    state: string;
    phone_number: string;
    alternative_phone_number: string;
    dispatch_date: string;
    expected_delivery_date: string;
    product_name: string;
    total_products: number;
    total_product_value: number;
    courier_partner: string;
    tracking_id: string;
    influencer_name: string;
    influencer_code: string;
    influencer_avatar: string;
  };
  pricing?: {
    final_price: number;
  };
}

export const useCampaignStatusTracking = (campaignId?: string) => {
  const [trackingRecords, setTrackingRecords] = useState<StatusTrackingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadTrackingRecords = useCallback(async () => {
    if (!campaignId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Fetch from influencer_status_tracking
      console.log('Loading', SUPABASE_TABLES.influencerStatus, '...');
      const { data: trackingData, error: trackingError } = await supabase
        .from(SUPABASE_TABLES.influencerStatus)
        .select('*')
        .eq('campaign_id', campaignId);
        
      if (trackingError) throw trackingError;
      
      console.log('Loaded table:', SUPABASE_TABLES.influencerStatus, trackingData?.length, trackingError);
      
      const records = (trackingData || []) as StatusTrackingRecord[];
      
      if (records.length > 0) {
        // Step 2: Fetch dispatch details to join
        const dispatchIds = [...new Set(records.map(r => r.dispatch_id).filter(Boolean))];
        const { data: dispatchData, error: dispatchError } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('*')
          .in('id', dispatchIds);
          
        if (dispatchError) throw dispatchError;
        
        // Step 3: Fetch influencer info to join
        const influencerIds = [...new Set(records.map(r => r.influencer_id).filter(Boolean))];
        const { data: infoData, error: infoError } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, name, profile_file_url, code')
          .in('id', influencerIds);
          
        if (infoError) throw infoError;

        // Step 4: Fetch pricing info to join
        const { data: pricingData, error: pricingError } = await supabase
          .from(SUPABASE_TABLES.influencerPricing)
          .select('influencer_id, final_price')
          .in('influencer_id', influencerIds);
          
        if (pricingError) throw pricingError;

        // Map dictionaries
        const dispatchMap = (dispatchData || []).reduce((acc: any, d: any) => {
          acc[d.id] = d;
          return acc;
        }, {});
        
        const infoMap = (infoData || []).reduce((acc: any, i: any) => {
          acc[i.id] = i;
          return acc;
        }, {});

        const pricingMap = (pricingData || []).reduce((acc: any, p: any) => {
          acc[p.influencer_id] = p;
          return acc;
        }, {});

        // Combine
        const combined = records.map(r => {
          const dispatch = dispatchMap[r.dispatch_id] || {};
          const info = infoMap[r.influencer_id] || {};
          const pricing = pricingMap[r.influencer_id] || {};
          
          return {
            ...r,
            dispatch: {
              campaign_name: dispatch.campaign_name,
              address: dispatch.address,
              state: dispatch.state,
              phone_number: dispatch.phone_number,
              alternative_phone_number: dispatch.alternative_phone_number,
              dispatch_date: dispatch.dispatch_date,
              expected_delivery_date: dispatch.expected_delivery_date,
              product_name: dispatch.product_name,
              total_products: dispatch.total_products,
              total_product_value: dispatch.total_product_value,
              courier_partner: dispatch.courier_partner,
              tracking_id: dispatch.tracking_id,
              influencer_name: info.name || dispatch.creator_name,
              influencer_code: info.code,
              influencer_avatar: info.profile_file_url
            },
            pricing: {
              final_price: pricing.final_price
            }
          };
        });
        
        setTrackingRecords(combined);
      } else {
        setTrackingRecords([]);
      }
    } catch (err: unknown) {
      console.error('Error fetching tracking records:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadTrackingRecords();
  }, [loadTrackingRecords]);

  // Save specific milestone data (PATCH only the provided fields)
  const saveMilestone = async (trackingId: string, updates: Partial<StatusTrackingRecord>) => {
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.influencerStatus)
        .update(updates)
        .eq('id', trackingId);
        
      if (error) throw error;
      
      // Update local state without full refetch
      setTrackingRecords(prev => prev.map(record => 
        record.id === trackingId ? { ...record, ...updates } : record
      ));
      
      return true;
    } catch (err) {
      console.error('Error saving milestone:', err);
      return false;
    }
  };

  return {
    trackingRecords,
    isLoading,
    error,
    refresh: loadTrackingRecords,
    saveMilestone
  };
};
