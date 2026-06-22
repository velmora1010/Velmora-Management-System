import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { CampaignInfluencer, InfluencerBargainHistory } from '../../types';

export const useCampaignInfluencers = (campaignId?: string) => {
  const [influencers, setInfluencers] = useState<CampaignInfluencer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadInfluencers = useCallback(async () => {
    if (!campaignId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const { data: infData, error: infError } = await supabase
        .from('influencers_info')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (infError) throw infError;
      
      const infoList = infData || [];
      const influencerIds = infoList.map(inf => inf.id);

      let combinedData = infoList;

      if (influencerIds.length > 0) {
        const [
          { data: platformsData },
          { data: pricingData },
          { data: productsData },
          { data: performanceData },
          { data: dispatchData }
        ] = await Promise.all([
          supabase.from('influencer_platforms_details').select('*').in('influencer_id', influencerIds),
          supabase.from('influencer_pricing').select('*').in('influencer_id', influencerIds),
          supabase.from('influencer_products').select('*').in('influencer_id', influencerIds),
          supabase.from('influencer_brand_performance').select('*').in('influencer_id', influencerIds),
          supabase.from('influencer_dispatch_details').select('*').in('influencer_id', influencerIds).eq('campaign_id', campaignId)
        ]);

        let bargainData: InfluencerBargainHistory[] = [];
        if (pricingData && pricingData.length > 0) {
          const pricingIds = pricingData.map(p => p.id);
          const { data: bData } = await supabase.from('influencer_bargain_history').select('*').in('pricing_id', pricingIds);
          bargainData = bData || [];
        }

        combinedData = infoList.map(inf => {
          const platforms = (platformsData || []).filter(p => p.influencer_id === inf.id);
          const pricing = (pricingData || []).find(p => p.influencer_id === inf.id) || {};
          const bargainHistory = bargainData.filter(b => b.pricing_id === pricing.id);
          const products = (productsData || []).filter(p => p.influencer_id === inf.id);
          const performance = (performanceData || []).filter(p => p.influencer_id === inf.id);
          const dispatchDetails = (dispatchData || []).find(d => d.influencer_id === inf.id);

          return {
            ...inf,
            platforms,
            pricing: { ...pricing, bargainHistory },
            products,
            performance,
            dispatchDetails
          };
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInfluencers(combinedData as any[]);
    } catch (err: unknown) {
      console.error('Error fetching campaign influencers:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadInfluencers();
  }, [loadInfluencers]);

  const addInfluencer = async (influencerData: Partial<CampaignInfluencer>): Promise<boolean> => {
    if (!campaignId) return false;
    
    setIsSaving(true);
    setError(null);
    try {
        // 1. Generate new Code
        const prefix = influencerData.name ? 
          influencerData.name.split(' ').map(w => w[0]?.toUpperCase() || '').join('').substring(0, 3).toUpperCase() : 'INF';
        
        const { data: existingCodes, error: codeErr } = await supabase
          .from('influencers_info')
          .select('code')
          .eq('campaign_id', campaignId)
          .ilike('code', `${prefix}%`);
        
        if (codeErr) throw codeErr;

        let maxNum = 0;
        if (existingCodes && existingCodes.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (existingCodes as any[]).forEach(row => {
            const numStr = (row.code || '').replace(prefix, '');
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          });
        }
        const newCode = `${prefix}${maxNum + 1}`;

        // 2. Insert into influencers_info
        const { data: newInfo, error: insertInfoErr } = await supabase
          .from('influencers_info')
          .insert([{
            campaign_id: campaignId,
            code: newCode,
            name: influencerData.name,
            influencer_name: influencerData.influencer_name,
            phone_number: influencerData.phone_number,
            alternative_number: influencerData.alternative_number,
            upi_number: influencerData.upi_number,
            complete_address: influencerData.complete_address,
            city: influencerData.city,
            state: influencerData.state,
            languages: influencerData.languages,
            profile_file_url: influencerData.profile_file_url,
            auto_dm: influencerData.auto_dm || false,
            is_archived: false
          }])
          .select('id')
          .single();

        if (insertInfoErr) throw insertInfoErr;
        const newInfluencerId = newInfo.id;

        let newPricingId: string | null = null;

        try {
          // 3. Platforms
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (influencerData.platforms && (influencerData.platforms as any[]).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const platformsToInsert = (influencerData.platforms as any[]).map(p => ({
              ...p,
              influencer_id: newInfluencerId
            }));
            const { error: platErr } = await supabase.from('influencer_platforms_details').insert(platformsToInsert);
            if (platErr) throw platErr;
          }

          // 4. Pricing
          if (influencerData.pricing) {
            const { data: newPricing, error: priceErr } = await supabase
              .from('influencer_pricing')
              .insert([{
                influencer_id: newInfluencerId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                video1_count: (influencerData.pricing as any).video1_count,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                video1_price: (influencerData.pricing as any).video1_price,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                video2_count: (influencerData.pricing as any).video2_count,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                video2_price: (influencerData.pricing as any).video2_price,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                total_videos: (influencerData.pricing as any).total_videos,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                final_price: (influencerData.pricing as any).final_price
              }])
              .select('id')
              .single();
            if (priceErr) throw priceErr;
            newPricingId = newPricing.id;

            // 5. Bargain History
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((influencerData.pricing as any).bargainHistory && (influencerData.pricing as any).bargainHistory.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bargainsToInsert = (influencerData.pricing as any).bargainHistory.map((b: any) => ({
                pricing_id: newPricingId,
                creator_request: b.creator_request,
                brand_request: b.brand_request
              }));
              const { error: bargainErr } = await supabase.from('influencer_bargain_history').insert(bargainsToInsert);
              if (bargainErr) throw bargainErr;
            }
          }

          // 6. Products
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (influencerData.products && (influencerData.products as any[]).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const productsToInsert = (influencerData.products as any[]).map(p => ({
              ...p,
              influencer_id: newInfluencerId
            }));
            const { error: prodErr } = await supabase.from('influencer_products').insert(productsToInsert);
            if (prodErr) throw prodErr;
          }

          // 7. Performance
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (influencerData.performance && (influencerData.performance as any[]).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const perfsToInsert = (influencerData.performance as any[]).map(p => ({
              ...p,
              influencer_id: newInfluencerId
            }));
            const { error: perfErr } = await supabase.from('influencer_brand_performance').insert(perfsToInsert);
            if (perfErr) throw perfErr;
          }
        } catch (innerErr) {
          console.error("Error copying related data, rolling back:", innerErr);
          await supabase.from('influencers_info').delete().eq('id', newInfluencerId);
          throw innerErr;
        }

        await loadInfluencers();
        return true;
    } catch (err: unknown) {
      console.error('Error saving campaign influencer:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const updateInfluencer = async (id: string, influencerData: Partial<CampaignInfluencer>): Promise<boolean> => {
    if (!campaignId) return false;
    
    setIsSaving(true);
    setError(null);
    try {
      // 1. Update basic info
      const { error: updateInfoErr } = await supabase
        .from('influencers_info')
        .update({
          name: influencerData.name,
          influencer_name: influencerData.influencer_name,
          phone_number: influencerData.phone_number,
          alternative_number: influencerData.alternative_number,
          upi_number: influencerData.upi_number,
          complete_address: influencerData.complete_address,
          city: influencerData.city,
          state: influencerData.state,
          languages: influencerData.languages,
          profile_file_url: influencerData.profile_file_url,
          auto_dm: influencerData.auto_dm || false
        })
        .eq('id', id);

      if (updateInfoErr) throw updateInfoErr;

      // 2. Delete existing relational data safely
      await supabase.from('influencer_platforms_details').delete().eq('influencer_id', id);
      
      const { data: oldPricing } = await supabase.from('influencer_pricing').select('id').eq('influencer_id', id);
      if (oldPricing && oldPricing.length > 0) {
        const oldPricingIds = oldPricing.map(p => p.id);
        await supabase.from('influencer_bargain_history').delete().in('pricing_id', oldPricingIds);
      }
      
      await supabase.from('influencer_pricing').delete().eq('influencer_id', id);
      await supabase.from('influencer_products').delete().eq('influencer_id', id);
      await supabase.from('influencer_brand_performance').delete().eq('influencer_id', id);

      let newPricingId: string | null = null;

      // 3. Platforms
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (influencerData.platforms && (influencerData.platforms as any[]).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platformsToInsert = (influencerData.platforms as any[]).map(p => ({
          ...p,
          id: undefined, // remove old ids
          influencer_id: id
        }));
        const { error: platErr } = await supabase.from('influencer_platforms_details').insert(platformsToInsert);
        if (platErr) throw platErr;
      }

      // 4. Pricing
      if (influencerData.pricing) {
        const { data: newPricing, error: priceErr } = await supabase
          .from('influencer_pricing')
          .insert([{
            influencer_id: id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            video1_count: (influencerData.pricing as any).video1_count,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            video1_price: (influencerData.pricing as any).video1_price,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            video2_count: (influencerData.pricing as any).video2_count,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            video2_price: (influencerData.pricing as any).video2_price,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            total_videos: (influencerData.pricing as any).total_videos,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            final_price: (influencerData.pricing as any).final_price
          }])
          .select('id')
          .single();
        if (priceErr) throw priceErr;
        newPricingId = newPricing.id;

        // 5. Bargain History
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((influencerData.pricing as any).bargainHistory && (influencerData.pricing as any).bargainHistory.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bargainsToInsert = (influencerData.pricing as any).bargainHistory.map((b: any) => ({
            pricing_id: newPricingId,
            creator_request: b.creator_request,
            brand_request: b.brand_request
          }));
          const { error: bargainErr } = await supabase.from('influencer_bargain_history').insert(bargainsToInsert);
          if (bargainErr) throw bargainErr;
        }
      }

      // 6. Products
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (influencerData.products && (influencerData.products as any[]).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productsToInsert = (influencerData.products as any[]).map(p => ({
          ...p,
          id: undefined,
          influencer_id: id
        }));
        const { error: prodErr } = await supabase.from('influencer_products').insert(productsToInsert);
        if (prodErr) throw prodErr;
      }

      // 7. Performance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (influencerData.performance && (influencerData.performance as any[]).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perfsToInsert = (influencerData.performance as any[]).map(p => ({
          ...p,
          id: undefined,
          influencer_id: id
        }));
        const { error: perfErr } = await supabase.from('influencer_brand_performance').insert(perfsToInsert);
        if (perfErr) throw perfErr;
      }

      await loadInfluencers();
      return true;
    } catch (err: unknown) {
      console.error('Error updating campaign influencer:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchiveStatus = async (id: string, isArchived: boolean): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('influencers_info')
        .update({ is_archived: isArchived })
        .eq('id', id);
      if (error) throw error;
      
      setInfluencers(prev => prev.map(inf => inf.id === id ? { ...inf, is_archived: isArchived } : inf));
      return true;
    } catch (err: unknown) {
      console.error('Error toggling archive status:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    influencers,
    isLoading,
    isSaving,
    error,
    addInfluencer,
    updateInfluencer,
    toggleArchiveStatus,
    refresh: () => loadInfluencers()
  };
};