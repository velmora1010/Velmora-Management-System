import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { CampaignInfluencer, InfluencerBargainHistory } from '../../types';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

// Language and Campaign code generation mapping helper
export const LANGUAGE_MAPPING: Record<string, string> = {
  Kannada: 'KA',
  Hindi: 'HI',
  Tamil: 'TN',
  Telugu: 'TL',
  Malayalam: 'KL',
  Punjabi: 'PB',
  Marathi: 'MH',
  Gujarati: 'GJ',
  Rajasthani: 'RJ',
  Haryanvi: 'HR',
  Bhojpuri: 'BR',
  Odia: 'OD',
  Bengali: 'WL',
  Magahi: 'JH'
};

export const getLanguageCode = (langs: string[]): string | null => {
  if (!langs || langs.length === 0) return null;
  for (const lang of langs) {
    if (LANGUAGE_MAPPING[lang]) {
      return LANGUAGE_MAPPING[lang];
    }
  }
  if (langs.includes('English')) return 'EN';
  if (langs.includes('Other')) return 'OT';
  return null;
};

export const getCampaignCode = (campaignName: string): string => {
  if (!campaignName) return 'CC';
  const cleanName = campaignName.trim().toLowerCase();
  
  if (cleanName.includes('june')) return 'JC';
  if (cleanName.includes('sep')) return 'SC';
  if (cleanName.includes('oct')) return 'OC';
  if (cleanName.includes('nov')) return 'NC';
  if (cleanName.includes('dec')) return 'DC';
  if (cleanName.includes('jan')) return 'JC';
  if (cleanName.includes('feb')) return 'FC';
  if (cleanName.includes('mar')) return 'MC';
  if (cleanName.includes('apr')) return 'AC';
  if (cleanName.includes('may')) return 'MC';
  if (cleanName.includes('jul')) return 'JC';
  if (cleanName.includes('aug')) return 'AC';
  
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (cleanName.substring(0, 2)).toUpperCase();
};

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
          let platformViews: any = null;
          const matchViewsElement = Array.isArray(inf.languages) 
            ? inf.languages.find((l: string) => l.startsWith('views_data:')) 
            : null;
          if (matchViewsElement) {
            try {
              const viewsJson = JSON.parse(matchViewsElement.substring('views_data:'.length));
              platformViews = viewsJson?.platform_views || {};
            } catch (e) {
              console.error('Error parsing views_data:', e);
            }
          }

          const cleanLangs = Array.isArray(inf.languages)
            ? inf.languages.filter((l: string) => !l.startsWith('views_data:'))
            : [];

          const platforms = (platformsData || []).filter(p => p.influencer_id === inf.id).map(p => {
            const video_views = Array(15).fill(null);
            const video_views_dates = Array(15).fill(null);
            
            let normKey = p.platform;
            if (p.platform.toLowerCase() === 'instagram') normKey = 'Instagram';
            else if (p.platform.toLowerCase() === 'facebook') normKey = 'Facebook';
            else if (p.platform.toLowerCase() === 'youtube') normKey = 'YouTube';

            const savedViewsList = platformViews?.[normKey] || [];
            savedViewsList.forEach((v: any) => {
              const idx = v.video_number - 1;
              if (idx >= 0 && idx < 15) {
                video_views[idx] = v.views !== null ? Number(v.views) : null;
                if (v.entered_date) {
                  const parts = v.entered_date.split('-');
                  if (parts.length === 3) {
                    const [yr, mo, dy] = parts;
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthName = months[parseInt(mo, 10) - 1] || 'Jan';
                    video_views_dates[idx] = `${dy}-${monthName}-${yr}`;
                  } else {
                    video_views_dates[idx] = v.entered_date;
                  }
                } else {
                  video_views_dates[idx] = null;
                }
              }
            });

            return {
              ...p,
              video_views,
              video_views_dates
            };
          });
          const pricing = (pricingData || []).find(p => p.influencer_id === inf.id) || {};
          const bargainHistory = bargainData.filter(b => b.pricing_id === pricing.id);
          const products = (productsData || []).filter(p => p.influencer_id === inf.id);
          const brandPerformance = (performanceData || []).filter(p => p.influencer_id === inf.id);
          const dispatchDetails = (dispatchData || []).find(d => d.influencer_id === inf.id);

          return {
            ...inf,
            languages: cleanLangs,
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

  const buildPlatformViewsPayload = (platforms: any[]) => {
    const platformViews: Record<string, any[]> = {};
    (platforms || []).forEach(p => {
      const platformName = p.platform;
      const viewsArray = Array.isArray(p.video_views) ? p.video_views : [];
      const datesArray = Array.isArray(p.video_views_dates) ? p.video_views_dates : [];
      const videosList: any[] = [];
      
      for (let i = 0; i < 15; i++) {
        const val = viewsArray[i];
        const date = datesArray[i];
        
        if (val !== undefined && val !== null && val !== '' && String(val).trim() !== '') {
          const viewVal = parseInt(String(val), 10);
          
          let enteredDate = date;
          if (!enteredDate || String(enteredDate).trim() === '' || enteredDate === '—') {
            const now = new Date();
            const yr = now.getFullYear();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = months[now.getMonth()];
            const dy = String(now.getDate()).padStart(2, '0');
            enteredDate = `${dy}-${monthName}-${yr}`;
          }

          let ymdDate = enteredDate;
          if (enteredDate && enteredDate.includes('-')) {
            const parts = enteredDate.split('-');
            if (parts.length === 3) {
              const [dy, moName, yr] = parts;
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const monthIdx = months.indexOf(moName);
              const mo = String(monthIdx !== -1 ? monthIdx + 1 : 1).padStart(2, '0');
              ymdDate = `${yr}-${mo}-${dy}`;
            }
          }

          videosList.push({
            video_number: i + 1,
            views: viewVal,
            entered_date: ymdDate
          });
        }
      }
      
      if (videosList.length > 0) {
        let normPlatform = platformName;
        if (platformName.toLowerCase() === 'instagram') normPlatform = 'Instagram';
        else if (platformName.toLowerCase() === 'facebook') normPlatform = 'Facebook';
        else if (platformName.toLowerCase() === 'youtube') normPlatform = 'YouTube';
        
        platformViews[normPlatform] = videosList;
      }
    });
    
    return { platform_views: platformViews };
  };

  const addInfluencer = async (influencerData: Partial<CampaignInfluencer>): Promise<boolean> => {
    if (!campaignId) return false;
    
    setIsSaving(true);
    setError(null);
    try {
        // 1. Get Campaign Name
        let campaignName = '';
        const { data: campaignData } = await supabase
          .from('influencer_create_campaigns_rows')
          .select('campaign_name')
          .eq('id', campaignId)
          .single();
        if (campaignData) {
          campaignName = campaignData.campaign_name || '';
        }

        const campaignCode = getCampaignCode(campaignName);
        const langCode = getLanguageCode(influencerData.languages || []) || 'INF';

        // 2. Query all existing codes for this campaign
        const { data: existingCodes, error: codeErr } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('code')
          .eq('campaign_id', campaignId);
        
        if (codeErr) throw codeErr;

        let maxNum = 0;
        if (existingCodes && existingCodes.length > 0) {
          (existingCodes as any[]).forEach(row => {
            const codeStr = (row.code || '').trim();
            const parts = codeStr.split('-');
            const numStr = parts[parts.length - 1];
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          });
        }
        const serialNum = maxNum + 1;
        const newCode = `${langCode}-${campaignCode}-${serialNum}`;

        // Get max ID for influencersInfo
        const maxInfoId = await getMaxId(SUPABASE_TABLES.influencersInfo);
        const newInfluencerId = maxInfoId + 1;

        const platformViewsPayload = buildPlatformViewsPayload(influencerData.platforms || []);
        const cleanLangs = (influencerData.languages || []).filter(l => !l.startsWith('views_data:'));
        const finalLanguages = [...cleanLangs, 'views_data:' + JSON.stringify(platformViewsPayload)];

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
          languages: finalLanguages,
          profile_file_url: influencerData.profile_file_url,
          auto_dm: influencerData.auto_dm || false,
          is_archived: false
        };

        console.log("FINAL INFLUENCER SAVE PAYLOAD", infoPayload);

        const { data, error: insertInfoErr } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .insert([infoPayload])
          .select();

        console.log("INFLUENCER SAVE RESULT", { data, error: insertInfoErr });

        if (insertInfoErr) {
          console.error("[Database Error] Table:", SUPABASE_TABLES.influencersInfo, "Operation: INSERT", "Payload Keys:", Object.keys(infoPayload), "Error:", insertInfoErr);
          throw new Error(`Failed inserting into ${SUPABASE_TABLES.influencersInfo}: ${insertInfoErr.message || JSON.stringify(insertInfoErr)}`);
        }

        let newPricingId: number | null = null;

        try {
          // 3. Platforms
          if (influencerData.platforms && (influencerData.platforms as any[]).length > 0) {
            let nextPlatformId = await getMaxId(SUPABASE_TABLES.influencerPlatform);
            const platformsToInsert = (influencerData.platforms as any[]).map(p => {
              nextPlatformId++;
              const { performance_code, video_views, video_views_dates, ...dbFields } = p;
              return {
                ...dbFields,
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
          const activeProducts = (influencerData.products as any[] || []).filter(p => p.selected && p.qty > 0);
          if (activeProducts.length > 0) {
            let nextProductId = await getMaxId(SUPABASE_TABLES.influencerProduct);
            const productsToInsert = activeProducts.map(p => {
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
      
      const { data: currentInf } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .select('code')
        .eq('id', id)
        .single();
      
      let finalCode = currentInf?.code || '';
      
      if (finalCode) {
        const parts = finalCode.split('-');
        if (parts.length === 3) {
          const [oldLang, campaignPart, serialPart] = parts;
          const newLangCode = getLanguageCode(influencerData.languages || []);
          if (newLangCode && newLangCode !== oldLang) {
            finalCode = `${newLangCode}-${campaignPart}-${serialPart}`;
          }
        }
      }

      const platformViewsPayload = buildPlatformViewsPayload(influencerData.platforms || []);
      const cleanLangs = (influencerData.languages || []).filter(l => !l.startsWith('views_data:'));
      const finalLanguages = [...cleanLangs, 'views_data:' + JSON.stringify(platformViewsPayload)];

      const updatePayload = {
        name: influencerData.name,
        influencer_name: influencerData.influencer_name,
        phone_number: influencerData.phone_number,
        alternative_number: influencerData.alternative_number,
        upi_number: influencerData.upi_number,
        complete_address: influencerData.complete_address,
        city: influencerData.city,
        state: influencerData.state,
        languages: finalLanguages,
        profile_file_url: influencerData.profile_file_url,
        auto_dm: influencerData.auto_dm || false,
        code: finalCode
      };
      console.log("FINAL INFLUENCER SAVE PAYLOAD", updatePayload);

      const { data, error: updateInfoErr } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .update(updatePayload)
        .eq('id', id)
        .select();

      console.log("INFLUENCER SAVE RESULT", { data, error: updateInfoErr });

      if (updateInfoErr) {
        console.error("[Database Error] Table:", SUPABASE_TABLES.influencersInfo, "Operation: UPDATE", "Payload Keys:", Object.keys(updatePayload), "Error:", updateInfoErr);
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
          const { performance_code, video_views, video_views_dates, ...dbFields } = p;
          return {
            ...dbFields,
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
      const activeProducts = (influencerData.products as any[] || []).filter(p => p.selected && p.qty > 0);
      if (activeProducts.length > 0) {
        let nextProductId = await getMaxId(SUPABASE_TABLES.influencerProduct);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productsToInsert = activeProducts.map(p => {
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