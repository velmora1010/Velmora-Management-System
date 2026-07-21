import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import type { LocalInfluencer } from '../../types';
import toast from 'react-hot-toast';

export const useInfluenceDB = () => {
  const [influencers, setInfluencers] = useState<LocalInfluencer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getMaxId = async (table: string): Promise<number> => {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .not('id', 'is', null)
      .order('id', { ascending: false })
      .limit(1);
    if (error) {
      console.warn(`Could not fetch max id for ${table}:`, error);
      return 0;
    }
    const maxVal = data && data.length > 0 ? Number(data[0].id) : 0;
    return isNaN(maxVal) ? 0 : maxVal;
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all general influencers (campaign_id is null)
      const { data: infData, error: infError } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*')
        .is('campaign_id', null)
        .order('created_at', { ascending: false });

      if (infError) throw infError;

      const infoList = infData || [];
      const influencerIds = infoList.map(inf => inf.id);

      if (influencerIds.length === 0) {
        setInfluencers([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch related details in parallel
      const [
        { data: platformsData },
        { data: pricingData },
        { data: productsData },
        { data: performanceData }
      ] = await Promise.all([
        supabase.from(SUPABASE_TABLES.influencerPlatform).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerPricing).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerProduct).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerBrandPerformance).select('*').in('influencer_id', influencerIds)
      ]);

      // 3. Map relations to LocalInfluencer shape
      const mapped = infoList.map(inf => {
        const platforms = platformsData || [];
        const pricing = (pricingData || []).find(p => p.influencer_id === inf.id);
        const products = (productsData || []).filter(p => p.influencer_id === inf.id);
        const performance = (performanceData || []).filter(p => p.influencer_id === inf.id);

        // Availability platforms (avail) vs Performance platforms (posted)
        const availPlatforms = platforms
          .filter(p => p.influencer_id === inf.id && p.type === 'availability')
          .map(p => ({
            platform: p.platform,
            username: p.username || '',
            link: p.profile_link || '',
            count: Number(p.followers_count || 0)
          }));

        const postedPlatforms = platforms
          .filter(p => p.influencer_id === inf.id && p.type === 'performance')
          .map(p => ({
            platform: p.platform,
            username: p.username || '',
            link: p.profile_link || '',
            count: Number(p.video_views?.[0] || p.followers_count || 0)
          }));

        return {
          id: inf.id,
          name: inf.influencer_name || '',
          handle: inf.name || '',
          payment: pricing ? String(pricing.final_price || '') : '',
          brand: performance?.[0]?.brand_name || '',
          product: products?.[0]?.product_name || '',
          contact: {
            phone: inf.phone_number || '',
            altPhone: inf.alternative_number || '',
            upi: inf.upi_number || '',
            city: inf.city || '',
            state: inf.state || '',
            language: inf.languages?.[0] || '',
            address: inf.complete_address || ''
          },
          availability: availPlatforms,
          performance: postedPlatforms,
          createdAt: inf.created_at || new Date().toISOString()
        };
      });

      setInfluencers(mapped);
    } catch (e) {
      console.error('Failed to load influencer database from Supabase:', e);
      toast.error('Failed to load influencer database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveInfluencer = async (influencer: LocalInfluencer) => {
    try {
      // 1. Get next ID for influencersInfo
      const newInfluencerId = (await getMaxId(SUPABASE_TABLES.influencersInfo)) + 1;

      // 2. Insert main info
      const { error: infoErr } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .insert([{
          id: newInfluencerId,
          campaign_id: null,
          name: influencer.handle,
          influencer_name: influencer.name,
          phone_number: influencer.contact.phone,
          alternative_number: influencer.contact.altPhone,
          upi_number: influencer.contact.upi,
          city: influencer.contact.city,
          state: influencer.contact.state,
          complete_address: influencer.contact.address,
          languages: influencer.contact.language ? [influencer.contact.language] : [],
          created_at: new Date().toISOString(),
          is_archived: false,
          auto_dm: false
        }]);

      if (infoErr) throw infoErr;

      // 3. Insert Pricing
      if (influencer.payment) {
        const nextPricingId = (await getMaxId(SUPABASE_TABLES.influencerPricing)) + 1;
        await supabase
          .from(SUPABASE_TABLES.influencerPricing)
          .insert([{
            id: nextPricingId,
            influencer_id: newInfluencerId,
            final_price: Number(influencer.payment),
            video1_count: 0,
            video1_price: 0,
            video2_count: 0,
            video2_price: 0,
            total_videos: 0
          }]);
      }

      // 4. Insert Brand Performance / Products
      if (influencer.brand || influencer.product) {
        const nextPerfId = (await getMaxId(SUPABASE_TABLES.influencerBrandPerformance)) + 1;
        await supabase
          .from(SUPABASE_TABLES.influencerBrandPerformance)
          .insert([{
            id: nextPerfId,
            influencer_id: newInfluencerId,
            brand_name: influencer.brand,
            product_name: influencer.product,
            views: '0',
            uploaded_platforms: ''
          }]);

        const nextProdId = (await getMaxId(SUPABASE_TABLES.influencerProduct)) + 1;
        await supabase
          .from(SUPABASE_TABLES.influencerProduct)
          .insert([{
            id: nextProdId,
            influencer_id: newInfluencerId,
            product_name: influencer.product,
            video_number: 1,
            selected: true,
            qty: 1
          }]);
      }

      // 5. Insert Platforms (availability + performance)
      const platformsToInsert: any[] = [];
      let nextPlatId = await getMaxId(SUPABASE_TABLES.influencerPlatform);

      if (influencer.availability && influencer.availability.length > 0) {
        influencer.availability.forEach(avail => {
          nextPlatId++;
          platformsToInsert.push({
            id: nextPlatId,
            influencer_id: newInfluencerId,
            platform: avail.platform,
            username: avail.username,
            profile_link: avail.link,
            followers_count: Number(avail.count || 0),
            video_views: [],
            type: 'availability'
          });
        });
      }

      if (influencer.performance && influencer.performance.length > 0) {
        influencer.performance.forEach(perf => {
          nextPlatId++;
          platformsToInsert.push({
            id: nextPlatId,
            influencer_id: newInfluencerId,
            platform: perf.platform,
            username: perf.username,
            profile_link: perf.link,
            followers_count: 0,
            video_views: [Number(perf.count || 0)],
            type: 'performance'
          });
        });
      }

      if (platformsToInsert.length > 0) {
        await supabase.from(SUPABASE_TABLES.influencerPlatform).insert(platformsToInsert);
      }

      toast.success('Influencer saved to database');
      loadData();
    } catch (e) {
      console.error('Failed to save influencer to database:', e);
      toast.error('Failed to save influencer');
    }
  };

  const deleteInfluencer = async (id: number) => {
    try {
      // 1. Delete dependent relations
      await Promise.all([
        supabase.from(SUPABASE_TABLES.influencerPlatform).delete().eq('influencer_id', id),
        supabase.from(SUPABASE_TABLES.influencerPricing).delete().eq('influencer_id', id),
        supabase.from(SUPABASE_TABLES.influencerProduct).delete().eq('influencer_id', id),
        supabase.from(SUPABASE_TABLES.influencerBrandPerformance).delete().eq('influencer_id', id)
      ]);

      // 2. Delete main info record
      const { error } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Influencer deleted from database');
      loadData();
    } catch (e) {
      console.error('Failed to delete influencer:', e);
      toast.error('Failed to delete influencer');
    }
  };

  return {
    influencers,
    isLoading,
    saveInfluencer,
    deleteInfluencer,
    refreshInfluenceDB: loadData
  };
};
