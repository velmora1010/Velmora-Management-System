import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export interface DispatchDetails {
  id: string;
  influencer_id: string;
  campaign_id: string;
  creator_name: string;
  phone_number: string;
  alternative_phone_number: string;
  address: string;
  state: string;
  campaign_name: string;
  product_name: string;
  selected_products: { product_name: string; quantity: number | string }[];
  total_products: number;
  total_product_value: number;
  total_weight: string;
  product_photo_url: string;
  courier_partner: string;
  dispatch_photo_url: string;
  tracking_id: string;
  dispatch_date: string;
  expected_delivery_date: string;
  dispatch_status: string;
  created_at: string;
  
  // Joined from influencers_info
  influencer?: {
    code: string;
    name: string;
    profile_file_url: string;
  };
}

export const useCampaignDispatch = (campaignId?: string) => {
  const [dispatchRecords, setDispatchRecords] = useState<DispatchDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadDispatchRecords = useCallback(async () => {
    if (!campaignId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Phase 1 Audit: Exact query from script.js 
      // script.js fetched from influencer_dispatch_details eq campaign_id
      console.log('Loading', SUPABASE_TABLES.influencerDispatch, '...');
      const { data: dispatchData, error: dispatchError } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (dispatchError) throw dispatchError;
      
      console.log('Loaded table:', SUPABASE_TABLES.influencerDispatch, dispatchData?.length, dispatchError);
      
      const records = (dispatchData || []) as DispatchDetails[];

      if (records.length > 0) {
        // Fetch influencer info like original script.js
        const influencerIds = [...new Set(records.map(r => r.influencer_id))];
        const { data: infoData, error: infoError } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('id, name, profile_file_url, code')
          .in('id', influencerIds);
          
        if (infoError) throw infoError;

        const infoMap: Record<string, any> = {};
        if (infoData) {
          infoData.forEach(info => {
            infoMap[info.id] = info;
          });
        }

        // Map together
        const combined = records.map(r => ({
          ...r,
          influencer: infoMap[r.influencer_id]
        }));
        
        setDispatchRecords(combined);
      } else {
        setDispatchRecords([]);
      }
      
    } catch (err: unknown) {
      console.error('Error fetching dispatch records:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadDispatchRecords();
  }, [loadDispatchRecords]);

  return {
    dispatchRecords,
    isLoading,
    error,
    refresh: loadDispatchRecords
  };
};
