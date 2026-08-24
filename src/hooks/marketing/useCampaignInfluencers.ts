import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { CampaignInfluencer, InfluencerBargainHistory } from '../../types';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

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
      console.log('Loading', SUPABASE_TABLES.influencersInfo, '...');
      const { data: infData, error: infError } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (infError) throw infError;
      
      console.log('Loaded table:', SUPABASE_TABLES.influencersInfo, infData?.length, infError);

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
          supabase.from(SUPABASE_TABLES.influencerPlatform).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerPricing).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerProduct).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerBrandPerformance).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerDispatch).select('*').in('influencer_id', influencerIds).eq('campaign_id', campaignId)
        ]);

        let bargainData: InfluencerBargainHistory[] = [];
        if (pricingData && pricingData.length > 0) {
          const pricingIds = pricingData.map(p => p.id);
          const { data: bData } = await supabase.from(SUPABASE_TABLES.influencerBargainHistory).select('*').in('pricing_id', pricingIds);
          bargainData = bData || [];
        }

        combinedData = infoList.map(inf => {
          const platforms = (platformsData || []).filter(p => p.influencer_id === inf.id);
          const pricing = (pricingData || []).find(p => p.influencer_id === inf.id) || {};
          const bargainHistory = bargainData.filter(b => b.pricing_id === pricing.id);
          const products = (productsData || []).filter(p => p.influencer_id === inf.id);
          const brandPerformance = (performanceData || []).filter(p => p.influencer_id === inf.id);
          const dispatchDetails = (dispatchData || []).find(d => d.influencer_id === inf.id);

          return {
            ...inf,
            platforms,
            pricing: { ...pricing, bargainHistory },
            products,
            performance: brandPerformance,
            brandPerformance,
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

  const addInfluencer = async (influencerData: Partial<CampaignInfluencer>): Promise<boolean> => {
    if (!campaignId) return false;
    
    setIsSaving(true);
    setError(null);
    try {
        const prefix = influencerData.name ? 
          influencerData.name.split(' ').map(w => w[0]?.toUpperCase() || '').join('').substring(0, 3).toUpperCase() : 'INF';
        
        const { data: existingCodes, error: codeErr } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
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

        // Get max ID for influencersInfo
        const maxInfoId = await getMaxId(SUPABASE_TABLES.influencersInfo);
        const newInfluencerId = maxInfoId + 1;

        const infoPayload = {
          id: newInfluencerId,
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
        };

        const { error: insertInfoErr } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .insert([infoPayload]);

        if (insertInfoErr) {
          console.error(insertInfoErr);
          throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencersInfo}: ${insertInfoErr.message || JSON.stringify(insertInfoErr)}`);
        }

        let newPricingId: number | null = null;

        try {
          // 3. Platforms
          if (influencerData.platforms && (influencerData.platforms as any[]).length > 0) {
            let nextPlatformId = await getMaxId(SUPABASE_TABLES.influencerPlatform);
            const platformsToInsert = (influencerData.platforms as any[]).map(p => {
              nextPlatformId++;
              return {
                ...p,
                id: nextPlatformId,
                influencer_id: newInfluencerId
              };
            });

            const { error: platErr } = await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .insert(platformsToInsert);

            if (platErr) {
              console.error(platErr);
              throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerPlatform}: ${platErr.message || JSON.stringify(platErr)}`);
            }
          }

          // 4. Pricing
          if (influencerData.pricing) {
            const nextPricingIdVal = (await getMaxId(SUPABASE_TABLES.influencerPricing)) + 1;
            const pricingPayload = {
              id: nextPricingIdVal,
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
              final_price: (influencerData.pricing as any).final_price,
              product_pricing: influencerData.pricing.product_pricing || {}
            };

            const { error: priceErr } = await supabase
              .from(SUPABASE_TABLES.influencerPricing)
              .insert([pricingPayload]);

            if (priceErr) {
              console.error(priceErr);
              throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerPricing}: ${priceErr.message || JSON.stringify(priceErr)}`);
            }
            newPricingId = nextPricingIdVal;

            // 5. Bargain History
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((influencerData.pricing as any).bargainHistory && (influencerData.pricing as any).bargainHistory.length > 0) {
              let nextBargainId = await getMaxId(SUPABASE_TABLES.influencerBargainHistory);
              const bargainsToInsert = (influencerData.pricing as any).bargainHistory.map((b: any) => {
                nextBargainId++;
                return {
                  id: nextBargainId,
                  pricing_id: newPricingId,
                  creator_request: b.creator_request,
                  brand_request: b.brand_request
                };
              });

              const { error: bargainErr } = await supabase
                .from(SUPABASE_TABLES.influencerBargainHistory)
                .insert(bargainsToInsert);

              if (bargainErr) {
                console.error(bargainErr);
                throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerBargainHistory}: ${bargainErr.message || JSON.stringify(bargainErr)}`);
              }
            }
          }

          // 6. Products
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (influencerData.products && (influencerData.products as any[]).length > 0) {
            let nextProductId = await getMaxId(SUPABASE_TABLES.influencerProduct);
            const productsToInsert = (influencerData.products as any[]).map(p => {
              nextProductId++;
              return {
                ...p,
                id: nextProductId,
                influencer_id: newInfluencerId
              };
            });

            const { error: prodErr } = await supabase
              .from(SUPABASE_TABLES.influencerProduct)
              .insert(productsToInsert);

            if (prodErr) {
              console.error(prodErr);
              throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerProduct}: ${prodErr.message || JSON.stringify(prodErr)}`);
            }
          }

          // 7. Performance
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const perfData = influencerData.brandPerformance || influencerData.performance;
          if (perfData && (perfData as any[]).length > 0) {
            let nextPerfId = await getMaxId(SUPABASE_TABLES.influencerBrandPerformance);
            const perfsToInsert = (perfData as any[]).map(p => {
              nextPerfId++;
              return {
                ...p,
                id: nextPerfId,
                influencer_id: newInfluencerId
              };
            });

            const { error: perfErr } = await supabase
              .from(SUPABASE_TABLES.influencerBrandPerformance)
              .insert(perfsToInsert);

            if (perfErr) {
              console.error(perfErr);
              throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerBrandPerformance}: ${perfErr.message || JSON.stringify(perfErr)}`);
            }
          }
        } catch (innerErr) {
          console.error("Error copying related data, rolling back:", innerErr);
          await supabase.from(SUPABASE_TABLES.influencersInfo).delete().eq('id', newInfluencerId);
          throw innerErr;
        }

        await loadInfluencers();
        return true;
    } catch (err: any) {
      console.error('Error saving campaign influencer:', err);
      setError(err instanceof Error ? err : new Error(err?.message || JSON.stringify(err)));
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
      console.log("Saving table:", SUPABASE_TABLES.influencersInfo);
      const updatePayload = {
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
      };
      const { error: updateInfoErr } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .update(updatePayload)
        .eq('id', id);

      if (updateInfoErr) {
        console.error(updateInfoErr);
        throw new Error(`Failed updating ${SUPABASE_TABLES.influencersInfo}: ${updateInfoErr.message || JSON.stringify(updateInfoErr)}`);
      }

      // 2. Delete existing relational data safely
      await supabase.from(SUPABASE_TABLES.influencerPlatform).delete().eq('influencer_id', id);
      
      const { data: oldPricing } = await supabase.from(SUPABASE_TABLES.influencerPricing).select('id').eq('influencer_id', id);
      if (oldPricing && oldPricing.length > 0) {
        const oldPricingIds = oldPricing.map(p => p.id).filter(Boolean);
        if (oldPricingIds.length > 0) {
          await supabase.from(SUPABASE_TABLES.influencerBargainHistory).delete().in('pricing_id', oldPricingIds);
        }
      }
      
      await supabase.from(SUPABASE_TABLES.influencerPricing).delete().eq('influencer_id', id);
      await supabase.from(SUPABASE_TABLES.influencerProduct).delete().eq('influencer_id', id);
      await supabase.from(SUPABASE_TABLES.influencerBrandPerformance).delete().eq('influencer_id', id);

      let newPricingId: number | null = null;

      // 3. Platforms
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (influencerData.platforms && (influencerData.platforms as any[]).length > 0) {
        let nextPlatformId = await getMaxId(SUPABASE_TABLES.influencerPlatform);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platformsToInsert = (influencerData.platforms as any[]).map(p => {
          nextPlatformId++;
          return {
            ...p,
            id: nextPlatformId,
            influencer_id: id
          };
        });

        const { error: platErr } = await supabase
          .from(SUPABASE_TABLES.influencerPlatform)
          .insert(platformsToInsert);

        if (platErr) {
          console.error(platErr);
          throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerPlatform}: ${platErr.message || JSON.stringify(platErr)}`);
        }
      }

      // 4. Pricing
      if (influencerData.pricing) {
        const nextPricingIdVal = (await getMaxId(SUPABASE_TABLES.influencerPricing)) + 1;
        const pricingPayload = {
          id: nextPricingIdVal,
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
          final_price: (influencerData.pricing as any).final_price,
          product_pricing: influencerData.pricing.product_pricing || {}
        };

        const { error: priceErr } = await supabase
          .from(SUPABASE_TABLES.influencerPricing)
          .insert([pricingPayload]);

        if (priceErr) {
          console.error(priceErr);
          throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerPricing}: ${priceErr.message || JSON.stringify(priceErr)}`);
        }
        newPricingId = nextPricingIdVal;

        // 5. Bargain History
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((influencerData.pricing as any).bargainHistory && (influencerData.pricing as any).bargainHistory.length > 0) {
          let nextBargainId = await getMaxId(SUPABASE_TABLES.influencerBargainHistory);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bargainsToInsert = (influencerData.pricing as any).bargainHistory.map((b: any) => {
            nextBargainId++;
            return {
              id: nextBargainId,
              pricing_id: newPricingId,
              creator_request: b.creator_request,
              brand_request: b.brand_request
            };
          });

          const { error: bargainErr } = await supabase
            .from(SUPABASE_TABLES.influencerBargainHistory)
            .insert(bargainsToInsert);

          if (bargainErr) {
            console.error(bargainErr);
            throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerBargainHistory}: ${bargainErr.message || JSON.stringify(bargainErr)}`);
          }
        }
      }

      // 6. Products
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (influencerData.products && (influencerData.products as any[]).length > 0) {
        let nextProductId = await getMaxId(SUPABASE_TABLES.influencerProduct);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productsToInsert = (influencerData.products as any[]).map(p => {
          nextProductId++;
          return {
            ...p,
            id: nextProductId,
            influencer_id: id
          };
        });

        const { error: prodErr } = await supabase
          .from(SUPABASE_TABLES.influencerProduct)
          .insert(productsToInsert);

        if (prodErr) {
          console.error(prodErr);
          throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerProduct}: ${prodErr.message || JSON.stringify(prodErr)}`);
        }
      }

      // 7. Performance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfData = influencerData.brandPerformance || influencerData.performance;
      if (perfData && (perfData as any[]).length > 0) {
        let nextPerfId = await getMaxId(SUPABASE_TABLES.influencerBrandPerformance);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perfsToInsert = (perfData as any[]).map(p => {
          nextPerfId++;
          return {
            ...p,
            id: nextPerfId,
            influencer_id: id
          };
        });

        const { error: perfErr } = await supabase
          .from(SUPABASE_TABLES.influencerBrandPerformance)
          .insert(perfsToInsert);

        if (perfErr) {
          console.error(perfErr);
          throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencerBrandPerformance}: ${perfErr.message || JSON.stringify(perfErr)}`);
        }
      }

      await loadInfluencers();
      return true;
    } catch (err: any) {
      console.error('Error updating campaign influencer:', err);
      setError(err instanceof Error ? err : new Error(err?.message || JSON.stringify(err)));
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
        .from(SUPABASE_TABLES.influencersInfo)
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