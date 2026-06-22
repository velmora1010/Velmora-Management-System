import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface Milestone {
  id: string;
  influencer_id: string;
  status: string;
  created_at: string;
}

export const useCampaignMilestones = (campaignId: string) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMilestones = useCallback(async (isMounted = { current: true }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('influencer_status_tracking')
        .select('id, influencer_id, status, created_at')
        .eq('campaign_id', campaignId)
        .is('dispatch_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (isMounted.current) {
        setMilestones(data || []);
      }
    } catch (err: unknown) {
      console.error('Error fetching milestones:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [campaignId]);

  useEffect(() => {
    const isMounted = { current: true };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMilestones(isMounted);
    return () => {
      isMounted.current = false;
    };
  }, [fetchMilestones]);

  const logMilestone = async (influencerId: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('influencer_status_tracking')
        .insert([{
          campaign_id: campaignId,
          influencer_id: influencerId,
          status
        }])
        .select('id, influencer_id, status, created_at')
        .single();

      if (error) throw error;
      setMilestones(prev => [data, ...prev]);
      return true;
    } catch (err: unknown) {
      console.error('Failed to log milestone:', err);
      return false;
    }
  };

  return { milestones, isLoading, error, logMilestone, refresh: () => fetchMilestones({ current: true }) };
};
