import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Campaign } from '../../types';
import { logActivity } from '../../services/activityService';

export const useCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadCampaigns = async (isMounted = { current: true }) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading influencer_create_campaigns_rows...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from('influencer_create_campaigns_rows')
        .select('*')
        .order('created_at', { ascending: false });

      let data = fetchResult;
      if (fetchError) {
        console.error('influencer_create_campaigns_rows fetch error:', fetchError.message);
        throw fetchError;
      }
      
      console.log('Loaded influencer_create_campaigns_rows:', data?.length);
      
      if (isMounted.current) {
        // Normalize campaign_name to be a string just in case it was saved as an object
        const normalizedData = (data || []).map((c: any) => {
          let name = c.campaign_name || c.name || c.title;
          
          if (name && typeof name === 'object') {
            name = name.campaign_name || name.name || name.title || JSON.stringify(name);
          }
          
          let finalName = String(name || 'Untitled Campaign');
          if (finalName === '[object Object]') {
             finalName = String(c.name || c.title || 'Untitled Campaign');
             if (finalName === '[object Object]') finalName = 'Untitled Campaign';
          }
          
          return { 
            ...c, 
            campaign_name: finalName,
            status: c.status || 'draft',
            total_budget: c.total_budget || 0,
            expected_influencers: c.expected_influencers || 0
          };
        });
        setCampaigns((normalizedData as Campaign[]) || []);
      }
    } catch (err: unknown) {
      console.error('[useCampaigns] Error fetching campaigns:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const isMounted = { current: true };
    loadCampaigns(isMounted);
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCampaign = async (campaignData: Partial<Campaign>) => {
    const { data: maxIdData } = await supabase
      .from('influencer_create_campaigns_rows')
      .select('id')
      .not('id', 'is', null)
      .order('id', { ascending: false })
      .limit(1);
    
    const maxId = maxIdData && maxIdData.length > 0 ? Number(maxIdData[0].id) : 0;
    const newCampaignId = (isNaN(maxId) ? 0 : maxId) + 1;

    const { data, error } = await supabase
      .from('influencer_create_campaigns_rows')
      .insert([{ ...campaignData, id: newCampaignId as any }])
      .select();
    
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data && (data as any[]).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inserted = (data as any[])[0] as Campaign;
      setCampaigns(prev => [inserted, ...prev]);

      // Non-blocking activity logging
      logActivity(
        'Marketing',
        'Campaign Created',
        `Campaign "${inserted.campaign_name}" was created.`
      );

      return inserted;
    }
    return null;
  };

  const updateCampaign = async (id: string, campaignData: Partial<Campaign>) => {
    const { data, error } = await supabase
      .from('influencer_create_campaigns_rows')
      .update(campaignData)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    if (data && data.length > 0) {
      setCampaigns(prev => prev.map(c => c.id === id ? data[0] : c));

      // Non-blocking activity logging
      logActivity(
        'Marketing',
        'Campaign Updated',
        `Campaign "${data[0].campaign_name || campaignData.campaign_name || id}" was updated.`
      );
    }
    return data;
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase
      .from('influencer_create_campaigns_rows')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  return {
    campaigns,
    isLoading,
    error,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    refreshCampaigns: loadCampaigns
  };
};
