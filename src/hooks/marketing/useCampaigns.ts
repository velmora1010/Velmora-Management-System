import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Campaign } from '../../types';

export const useCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadCampaigns = async (isMounted = { current: true }) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading campaigns_rows...');
      let { data: fetchResult, error: fetchError } = await supabase
        .from('campaigns_rows')
        .select('*')
        .order('created_at', { ascending: false });

      let data = fetchResult;
      if (fetchError) {
        console.error('campaigns_rows fetch error:', fetchError.message);
        const fallback = localStorage.getItem('campaigns');
        if (fallback) data = JSON.parse(fallback);
        else throw fetchError;
      }
      
      console.log('Loaded campaigns_rows:', data?.length);
      
      if (isMounted.current) {
        // Normalize campaign_name to be a string just in case it was saved as an object
        const normalizedData = (data || []).map((c: any) => {
          let name = c.campaign_name;
          if (name && typeof name === 'object') {
            name = name.name || name.campaign_name || JSON.stringify(name);
          }
          if (!name && typeof c.name === 'string') {
            name = c.name;
          }
          return { ...c, campaign_name: name || 'Unnamed Campaign' };
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
    const { data, error } = await supabase
      .from('campaigns_rows')
      .insert([campaignData])
      .select();
    
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data && (data as any[]).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inserted = (data as any[])[0] as Campaign;
      setCampaigns(prev => [inserted, ...prev]);
      return inserted;
    }
    return null;
  };

  const updateCampaign = async (id: string, campaignData: Partial<Campaign>) => {
    const { data, error } = await supabase
      .from('campaigns_rows')
      .update(campaignData)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    if (data && data.length > 0) {
      setCampaigns(prev => prev.map(c => c.id === id ? data[0] : c));
    }
    return data;
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase
      .from('campaigns_rows')
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
