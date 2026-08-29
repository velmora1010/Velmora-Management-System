import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { CampaignInfluencer, InfluencerBargainHistory, InfluencerPlatformDetail, InfluencerPostDate } from '../../types';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';

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

export const notifyInfluencerChange = (campaignId?: string | number) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('velmora:influencer-updated', { 
      detail: { campaignId: campaignId ? String(campaignId) : undefined } 
    }));
  }
};

export const useCampaignInfluencers = (campaignId?: string) => {
  const [influencers, setInfluencers] = useState<CampaignInfluencer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);

  const loadInfluencers = useCallback(async () => {
    if (!campaignId) {
      setInfluencers([]);
      return;
    }
    
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading', SUPABASE_TABLES.influencersInfo, 'for campaign', campaignId, '...');
      const { data: infData, error: infError } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (infError) throw infError;

      if (fetchIdRef.current !== currentFetchId) return;
      
      const infoList = infData || [];
      const influencerIds = infoList.map(inf => inf.id);

      let combinedData = infoList;

      if (influencerIds.length > 0) {
        const [
          { data: platformsData },
          { data: videoViewsData },
          { data: pricingData },
          { data: productsData },
          { data: performanceData },
          { data: dispatchData },
          { data: postDatesData }
        ] = await Promise.all([
          supabase.from(SUPABASE_TABLES.influencerPlatform).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerVideoViews).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerPricing).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerProduct).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerBrandPerformance).select('*').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerDispatch).select('*').in('influencer_id', influencerIds).eq('campaign_id', campaignId),
          supabase.from(SUPABASE_TABLES.influencerPostDates).select('*').in('influencer_id', influencerIds)
        ]);

        if (fetchIdRef.current !== currentFetchId) return;

        let bargainData: InfluencerBargainHistory[] = [];
        if (pricingData && pricingData.length > 0) {
          const pricingIds = pricingData.map(p => p.id);
          const { data: bData } = await supabase.from(SUPABASE_TABLES.influencerBargainHistory).select('*').in('pricing_id', pricingIds);
          bargainData = bData || [];
        }

        if (fetchIdRef.current !== currentFetchId) return;

        combinedData = infoList.map(inf => {
          let platformViews: any = null;
          let viewsJson: any = null;
          const matchViewsElement = Array.isArray(inf.languages) 
            ? inf.languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:')) 
            : null;
          if (matchViewsElement) {
            try {
              viewsJson = JSON.parse(matchViewsElement.substring('views_data:'.length));
              platformViews = viewsJson?.platform_views || {};
            } catch (e) {
              console.error('Error parsing views_data:', e);
            }
          }
          const instagram_view_code = viewsJson?.instagram_view_code || null;
          const facebook_view_code = viewsJson?.facebook_view_code || null;
          const youtube_view_code = viewsJson?.youtube_view_code || null;
          const instagram_view_code_mode = viewsJson?.instagram_view_code_mode || 'auto';
          const facebook_view_code_mode = viewsJson?.facebook_view_code_mode || 'auto';
          const youtube_view_code_mode = viewsJson?.youtube_view_code_mode || 'auto';

          const postDatesFromJSON = (viewsJson?.post_dates || []).map((pd: any) => ({
            video_number: pd.video_number,
            post_date: pd.post_date || null,
            draft_date: pd.draft_date || null
          }));
          const postDatesFromTable = (postDatesData || [])
            .filter(pd => String(pd.influencer_id) === String(inf.id))
            .map(pd => ({
              id: pd.id,
              influencer_id: pd.influencer_id,
              campaign_id: pd.campaign_id,
              video_number: pd.video_number,
              post_date: pd.post_date || null,
              draft_date: pd.draft_date || null
            }));
            
          const rawPostDates = postDatesFromTable.length > 0 ? postDatesFromTable : postDatesFromJSON;
          const postDates = rawPostDates.sort((a: any, b: any) => (a.video_number || 0) - (b.video_number || 0));

          const cleanLangs = Array.isArray(inf.languages)
            ? inf.languages.filter((l: string) => typeof l === 'string' && !l.startsWith('views_data:'))
            : (typeof inf.languages === 'string' ? inf.languages.split(/[,/]+/).map((s: string) => s.trim()).filter(Boolean) : []);

          const rawPlatforms = (platformsData || []).filter(p => String(p.influencer_id) === String(inf.id));
          const rawVideoViews = (videoViewsData || []).filter(v => String(v.influencer_id) === String(inf.id));

          const uniquePlatformsMap: Record<string, any> = {};
          rawPlatforms.forEach(p => {
            let normKey = p.platform;
            if (p.platform.toLowerCase() === 'instagram') normKey = 'Instagram';
            else if (p.platform.toLowerCase() === 'facebook') normKey = 'Facebook';
            else if (p.platform.toLowerCase() === 'youtube') normKey = 'YouTube';
            
            if (!uniquePlatformsMap[normKey] || p.id > uniquePlatformsMap[normKey].id) {
              uniquePlatformsMap[normKey] = p;
            }
          });

          const platforms = Object.values(uniquePlatformsMap).map((p: any) => {
            let normKey = p.platform;
            if (p.platform.toLowerCase() === 'instagram') normKey = 'Instagram';
            else if (p.platform.toLowerCase() === 'facebook') normKey = 'Facebook';
            else if (p.platform.toLowerCase() === 'youtube') normKey = 'YouTube';

            const matchingViewsRec = rawVideoViews.find(v => 
              v.platform && v.platform.toLowerCase() === normKey.toLowerCase()
            );

            const rawViews = (Array.isArray(p.video_views) && p.video_views.length > 0)
              ? p.video_views
              : (matchingViewsRec && Array.isArray(matchingViewsRec.video_views) ? matchingViewsRec.video_views : []);

            const video_views = Array(15).fill(0);
            if (Array.isArray(rawViews)) {
              rawViews.forEach((val: any, idx: number) => {
                if (idx < 15) {
                  const num = parseViewCountLocal(val);
                  video_views[idx] = isNaN(num) || num < 0 ? 0 : Math.round(num);
                }
              });
            }

            return {
              ...p,
              video_views,
              video_views_dates: Array(15).fill('')
            };
          });
          const pricing = (pricingData || []).find(p => String(p.influencer_id) === String(inf.id)) || {};
          const bargainHistory = bargainData.filter(b => b.pricing_id === pricing.id);
          const products = (productsData || []).filter(p => String(p.influencer_id) === String(inf.id));
          const brandPerformance = (performanceData || []).filter(p => String(p.influencer_id) === String(inf.id));
          const dispatchDetails = (dispatchData || []).find(d => String(d.influencer_id) === String(inf.id));

          return {
            ...inf,
            languages: cleanLangs,
            platforms,
            pricing: { ...pricing, bargainHistory },
            products,
            performance: brandPerformance,
            brandPerformance,
            dispatchDetails,
            postDates,
            instagram_view_code,
            facebook_view_code,
            youtube_view_code,
            instagram_view_code_mode,
            facebook_view_code_mode,
            youtube_view_code_mode
          };
        });
      }

      if (fetchIdRef.current === currentFetchId) {
        setInfluencers(combinedData as any[]);
      }
    } catch (err: any) {
      if (fetchIdRef.current === currentFetchId) {
        console.error('Error loading campaign influencers:', err);
        setError(err instanceof Error ? err : new Error(err?.message || String(err)));
      }
    } finally {
      if (fetchIdRef.current === currentFetchId) {
        setIsLoading(false);
      }
    }
  }, [campaignId]);

  useEffect(() => {
    setInfluencers([]);
    loadInfluencers();
  }, [campaignId, loadInfluencers]);

  useEffect(() => {
    const handleGlobalUpdate = (e: any) => {
      const targetCampId = e.detail?.campaignId;
      if (!targetCampId || String(targetCampId) === String(campaignId)) {
        loadInfluencers();
      }
    };
    window.addEventListener('velmora:influencer-updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('velmora:influencer-updated', handleGlobalUpdate);
    };
  }, [campaignId, loadInfluencers]);

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

  const parseViewCountLocal = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    let str = String(val).trim().toUpperCase();
    str = str.replace(/,/g, '');
    if (str.endsWith('M')) {
      const num = parseFloat(str.slice(0, -1));
      return isNaN(num) ? 0 : num * 1000000;
    }
    if (str.endsWith('K')) {
      const num = parseFloat(str.slice(0, -1));
      return isNaN(num) ? 0 : num * 1000;
    }
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  const buildPlatformViewsPayload = (
    platforms: InfluencerPlatformDetail[],
    instagramViewCode?: string | null,
    facebookViewCode?: string | null,
    youtubeViewCode?: string | null,
    instagramViewCodeMode?: string | null,
    facebookViewCodeMode?: string | null,
    youtubeViewCodeMode?: string | null,
    postDates?: InfluencerPostDate[]
  ) => {
    const platformViews: Record<string, any[]> = {};
    
    platforms.forEach(p => {
      const platformName = p.platform;
      const viewsArr = p.video_views || [];
      const datesArr = p.video_views_dates || [];
      const videosList: any[] = [];
      
      for (let i = 0; i < 15; i++) {
        const viewVal = viewsArr[i];
        const dateVal = datesArr[i];
        
        if (viewVal !== undefined && viewVal !== null && String(viewVal).trim() !== '') {
          let ymdDate = null;
          if (dateVal && typeof dateVal === 'string') {
            const date = dateVal.trim();
            if (date.includes('-')) {
              const parts = date.split('-');
              if (parts.length === 3) {
                const dy = parts[0].padStart(2, '0');
                const moName = parts[1];
                const yr = parts[2];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIdx = months.indexOf(moName);
                const mo = String(monthIdx !== -1 ? monthIdx + 1 : 1).padStart(2, '0');
                ymdDate = `${yr}-${mo}-${dy}`;
              } else {
                ymdDate = date;
              }
            } else {
              ymdDate = date;
            }
          }

          videosList.push({
            video_number: i + 1,
            views: parseViewCountLocal(viewVal),
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
    
    return { 
      platform_views: platformViews,
      instagram_view_code: instagramViewCode || null,
      facebook_view_code: facebookViewCode || null,
      youtube_view_code: youtubeViewCode || null,
      instagram_view_code_mode: instagramViewCodeMode || 'auto',
      facebook_view_code_mode: facebookViewCodeMode || 'auto',
      youtube_view_code_mode: youtubeViewCodeMode || 'auto',
      post_dates: (postDates || []).map(pd => ({
        video_number: pd.video_number,
        post_date: pd.post_date || null,
        draft_date: pd.draft_date || null
      }))
    };
  };

  const addInfluencer = async (influencerData: Partial<CampaignInfluencer>): Promise<boolean> => {
    if (!campaignId) return false;
    
    setIsSaving(true);
    setError(null);
    try {
        const finalCode = (influencerData.code || '').trim();

        // Get max ID for influencersInfo
        const maxInfoId = await getMaxId(SUPABASE_TABLES.influencersInfo);
        const newInfluencerId = maxInfoId + 1;

        const finalLanguages = (influencerData.languages || []).filter(l => typeof l === 'string' && !l.startsWith('views_data:'));

        const infoPayload = {
          id: newInfluencerId,
          campaign_id: campaignId,
          code: finalCode,
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
              const { performance_code, video_views_dates, video_views, ...dbFields } = p;
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

            // Also insert into public.influencer_video_views
            let nextViewsId = await getMaxId(SUPABASE_TABLES.influencerVideoViews);
            const infCode = influencerData.code || (influencerData as any).influencer_code || '';
            for (const p of (influencerData.platforms as any[])) {
              if (!p || !p.platform) continue;
              nextViewsId++;
              const normPlatform = p.platform.toLowerCase() === 'instagram' ? 'Instagram' :
                                   p.platform.toLowerCase() === 'youtube' ? 'YouTube' :
                                   p.platform.toLowerCase() === 'facebook' ? 'Facebook' : p.platform;
              const viewsArr = Array.isArray(p.video_views) ? p.video_views : [];
              const numeric15Views = Array.from({ length: 15 }, (_, i) => {
                const viewVal = viewsArr[i];
                if (viewVal !== undefined && viewVal !== null && String(viewVal).trim() !== '') {
                  const num = parseViewCountLocal(viewVal);
                  return isNaN(num) || num < 0 ? 0 : Math.round(num);
                }
                return 0;
              });

              await supabase
                .from(SUPABASE_TABLES.influencerVideoViews)
                .insert([{
                  id: nextViewsId,
                  influencer_id: newInfluencerId,
                  influencer_code: infCode,
                  username: p.username || '',
                  platform: normPlatform,
                  video_views: numeric15Views,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }]);
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

          // Save Post Dates if provided
          if (influencerData.postDates && influencerData.postDates.length > 0) {
            const validPostDates = influencerData.postDates.filter(pd => pd.post_date && String(pd.post_date).trim() !== '');
            if (validPostDates.length > 0) {
              let nextPostDateId = await getMaxId(SUPABASE_TABLES.influencerPostDates);
              const postDatesToInsert = validPostDates.map(pd => {
                nextPostDateId++;
                return {
                  id: nextPostDateId,
                  influencer_id: newInfluencerId,
                  campaign_id: campaignId,
                  video_number: pd.video_number,
                  post_date: pd.post_date,
                  draft_date: pd.draft_date || null
                };
              });

              const { error: postDateErr } = await supabase
                .from(SUPABASE_TABLES.influencerPostDates)
                .insert(postDatesToInsert);

              if (postDateErr) {
                console.error("Error inserting post dates:", postDateErr);
              }
            }
          }
        } catch (innerErr) {
          console.error("Error copying related data, rolling back:", innerErr);
          await supabase.from(SUPABASE_TABLES.influencersInfo).delete().eq('id', newInfluencerId);
          throw innerErr;
        }

        await loadInfluencers();
        notifyInfluencerChange(campaignId);

        // Non-blocking activity logging
        (async () => {
          let campaignName = 'Campaign';
          try {
            const { data: campData } = await supabase
              .from('influencer_create_campaigns_rows')
              .select('campaign_name')
              .eq('id', campaignId)
              .single();
            if (campData?.campaign_name) {
              campaignName = campData.campaign_name;
            }
          } catch (err) {
            console.error('Failed to fetch campaign name for log:', err);
          }
          logActivity(
            'Marketing',
            'Influencer Added',
            `Influencer "${influencerData.influencer_name || influencerData.name || 'Unknown'}" was added to ${campaignName}.`
          );
        })();

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
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error(`Invalid influencer ID: ${id}`);
      }

      // 1. Update basic info
      console.log("Saving table:", SUPABASE_TABLES.influencersInfo);
      
      const finalCode = (influencerData.code || '').trim();

      const finalLanguages = (influencerData.languages || []).filter(l => typeof l === 'string' && !l.startsWith('views_data:'));

      const rawUpdatePayload: Record<string, any> = {
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
        auto_dm: influencerData.auto_dm !== undefined ? influencerData.auto_dm : undefined,
        code: finalCode
      };

      const updatePayload: Record<string, any> = {};
      Object.keys(rawUpdatePayload).forEach(k => {
        if (rawUpdatePayload[k] !== undefined) {
          updatePayload[k] = rawUpdatePayload[k];
        }
      });

      console.log("FINAL INFLUENCER SAVE PAYLOAD", updatePayload);

      const { data, error: updateInfoErr } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .update(updatePayload)
        .eq('id', numericId)
        .select();

      console.log("INFLUENCER SAVE RESULT", { data, error: updateInfoErr });

      if (updateInfoErr) {
        console.error("[Database Error] Table:", SUPABASE_TABLES.influencersInfo, "Operation: UPDATE", "Payload Keys:", Object.keys(updatePayload), "Error:", updateInfoErr);
        throw new Error(`Failed updating ${SUPABASE_TABLES.influencersInfo}: ${updateInfoErr.message || JSON.stringify(updateInfoErr)}`);
      }

      // 2. Safely Update Relational Tables (Only update sections passed in payload)
      if (influencerData.platforms !== undefined && Array.isArray(influencerData.platforms)) {
        for (const p of (influencerData.platforms as any[])) {
          if (!p || !p.platform) continue;
          const platformName = p.platform;
          const viewsArr = Array.isArray(p.video_views) ? p.video_views : [];
          const numeric15Views = Array.from({ length: 15 }, (_, i) => {
            const viewVal = viewsArr[i];
            if (viewVal !== undefined && viewVal !== null && String(viewVal).trim() !== '') {
              const num = parseViewCountLocal(viewVal);
              return isNaN(num) || num < 0 ? 0 : Math.round(num);
            }
            return 0;
          });

          // 2a. Update platform metadata in influencer_platforms_details_rows
          const { data: existingPlats } = await supabase
            .from(SUPABASE_TABLES.influencerPlatform)
            .select('id, platform')
            .eq('influencer_id', numericId);

          const existingPlat = (existingPlats || []).find(ep => ep.platform && ep.platform.toLowerCase() === platformName.toLowerCase());

          if (existingPlat?.id) {
            await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .update({
                username: p.username || '',
                profile_link: p.profile_link || '',
                followers_count: Number(p.followers_count || 0),
                video_views: numeric15Views
              })
              .eq('id', existingPlat.id);
          } else {
            let nextPlatformId = await getMaxId(SUPABASE_TABLES.influencerPlatform);
            nextPlatformId++;
            await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .insert([{
                id: nextPlatformId,
                influencer_id: numericId,
                platform: platformName,
                username: p.username || '',
                profile_link: p.profile_link || '',
                followers_count: Number(p.followers_count || 0),
                video_views: numeric15Views
              }]);
          }

          // 2b. Upsert 15 video views into public.influencer_video_views
          const infCode = influencerData.code || (influencerData as any).influencer_code || '';
          const normPlatform = platformName.toLowerCase() === 'instagram' ? 'Instagram' :
                               platformName.toLowerCase() === 'youtube' ? 'YouTube' :
                               platformName.toLowerCase() === 'facebook' ? 'Facebook' : platformName;

          const { data: existingViewsRec } = await supabase
            .from(SUPABASE_TABLES.influencerVideoViews)
            .select('id')
            .eq('influencer_id', numericId)
            .ilike('platform', normPlatform)
            .maybeSingle();

          if (existingViewsRec?.id) {
            const { error: viewsUpdateErr } = await supabase
              .from(SUPABASE_TABLES.influencerVideoViews)
              .update({
                influencer_code: infCode,
                username: p.username || '',
                video_views: numeric15Views,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingViewsRec.id);

            if (viewsUpdateErr) {
              console.error(`[Database Error] Failed to update video_views for ${normPlatform}:`, viewsUpdateErr);
              throw viewsUpdateErr;
            }
          } else {
            let nextViewsId = await getMaxId(SUPABASE_TABLES.influencerVideoViews);
            nextViewsId++;
            const { error: viewsInsertErr } = await supabase
              .from(SUPABASE_TABLES.influencerVideoViews)
              .insert([{
                id: nextViewsId,
                influencer_id: numericId,
                influencer_code: infCode,
                username: p.username || '',
                platform: normPlatform,
                video_views: numeric15Views,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);

            if (viewsInsertErr) {
              console.error(`[Database Error] Failed to insert video_views for ${normPlatform}:`, viewsInsertErr);
              throw viewsInsertErr;
            }
          }
        }
      }

      let newPricingId: number | null = null;
      if (influencerData.pricing !== undefined) {
        const { data: oldPricing } = await supabase.from(SUPABASE_TABLES.influencerPricing).select('id').eq('influencer_id', numericId);
        if (oldPricing && oldPricing.length > 0) {
          const oldPricingIds = oldPricing.map(p => p.id).filter(Boolean);
          if (oldPricingIds.length > 0) {
            await supabase.from(SUPABASE_TABLES.influencerBargainHistory).delete().in('pricing_id', oldPricingIds);
          }
        }
        await supabase.from(SUPABASE_TABLES.influencerPricing).delete().eq('influencer_id', numericId);

        if (influencerData.pricing) {
          const nextPricingIdVal = (await getMaxId(SUPABASE_TABLES.influencerPricing)) + 1;
          const pricingPayload = {
            id: nextPricingIdVal,
            influencer_id: numericId,
            video1_count: (influencerData.pricing as any).video1_count,
            video1_price: (influencerData.pricing as any).video1_price,
            video2_count: (influencerData.pricing as any).video2_count,
            video2_price: (influencerData.pricing as any).video2_price,
            total_videos: (influencerData.pricing as any).total_videos,
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
      }

      // 6. Products
      if (influencerData.products !== undefined) {
        await supabase.from(SUPABASE_TABLES.influencerProduct).delete().eq('influencer_id', numericId);

        const activeProducts = (influencerData.products as any[] || []).filter(p => p.selected && p.qty > 0);
        if (activeProducts.length > 0) {
          let nextProductId = await getMaxId(SUPABASE_TABLES.influencerProduct);
          const productsToInsert = activeProducts.map(p => {
            nextProductId++;
            return {
              ...p,
              id: nextProductId,
              influencer_id: numericId
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
      }

      // 7. Performance
      const perfData = influencerData.brandPerformance || influencerData.performance;
      if (perfData !== undefined) {
        await supabase.from(SUPABASE_TABLES.influencerBrandPerformance).delete().eq('influencer_id', numericId);

        if (perfData && (perfData as any[]).length > 0) {
          let nextPerfId = await getMaxId(SUPABASE_TABLES.influencerBrandPerformance);
          const perfsToInsert = (perfData as any[]).map(p => {
            nextPerfId++;
            return {
              ...p,
              id: nextPerfId,
              influencer_id: numericId
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
      }

      // 8. Post Dates (Sync / Upsert)
      if (influencerData.postDates !== undefined) {
        const currentPostDates = (influencerData.postDates || []).filter(pd => pd.post_date && String(pd.post_date).trim() !== '');
        const { data: existingPostDates } = await supabase
          .from(SUPABASE_TABLES.influencerPostDates)
          .select('*')
          .eq('influencer_id', numericId)
          .eq('campaign_id', campaignId);

        const existingMap = new Map((existingPostDates || []).map(ep => [ep.video_number, ep]));
        let nextPostDateId = await getMaxId(SUPABASE_TABLES.influencerPostDates);

        const rowsToInsert: any[] = [];
        const currentVideoNumbers = new Set<number>();

        for (const pd of currentPostDates) {
          currentVideoNumbers.add(pd.video_number);
          const existing = existingMap.get(pd.video_number);
          if (existing) {
            if (existing.post_date !== pd.post_date || existing.draft_date !== pd.draft_date) {
              await supabase
                .from(SUPABASE_TABLES.influencerPostDates)
                .update({
                  post_date: pd.post_date,
                  draft_date: pd.draft_date || null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
            }
          } else {
            nextPostDateId++;
            rowsToInsert.push({
              id: nextPostDateId,
              influencer_id: numericId,
              campaign_id: campaignId,
              video_number: pd.video_number,
              post_date: pd.post_date,
              draft_date: pd.draft_date || null
            });
          }
        }

        if (rowsToInsert.length > 0) {
          await supabase
            .from(SUPABASE_TABLES.influencerPostDates)
            .insert(rowsToInsert);
        }

        for (const existing of (existingPostDates || [])) {
          if (!currentVideoNumbers.has(existing.video_number)) {
            await supabase
              .from(SUPABASE_TABLES.influencerPostDates)
              .delete()
              .eq('id', existing.id);
          }
        }
      }

      await loadInfluencers();
      notifyInfluencerChange(campaignId);

      // Non-blocking activity logging
      (async () => {
        let campaignName = 'Campaign';
        try {
          const { data: campData } = await supabase
            .from('influencer_create_campaigns_rows')
            .select('campaign_name')
            .eq('id', campaignId)
            .single();
          if (campData?.campaign_name) {
            campaignName = campData.campaign_name;
          }
        } catch (err) {
          console.error('Failed to fetch campaign name for log:', err);
        }
        logActivity(
          'Marketing',
          'Influencer Updated',
          `Influencer "${influencerData.influencer_name || influencerData.name || id}" was updated in ${campaignName}.`
        );
      })();

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
      notifyInfluencerChange(campaignId);
      return true;
    } catch (err: unknown) {
      console.error('Error toggling archive status:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsSaving(false);
    }
  };
  const deleteInfluencer = async (id: string): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error(`Invalid influencer ID: ${id}`);
      }

      const targetInfluencer = influencers.find(inf => String(inf.id) === String(id));
      const influencerName = targetInfluencer?.influencer_name || targetInfluencer?.name || `ID ${id}`;

      // 1. Delete pricing and bargain history
      const { data: oldPricing } = await supabase.from(SUPABASE_TABLES.influencerPricing).select('id').eq('influencer_id', numericId);
      if (oldPricing && oldPricing.length > 0) {
        const oldPricingIds = oldPricing.map(p => p.id).filter(Boolean);
        if (oldPricingIds.length > 0) {
          const { error: bargainDelErr } = await supabase.from(SUPABASE_TABLES.influencerBargainHistory).delete().in('pricing_id', oldPricingIds);
          if (bargainDelErr) throw bargainDelErr;
        }
      }

      // 2. Delete other relational tables safely
      const { error: platDelErr } = await supabase.from(SUPABASE_TABLES.influencerPlatform).delete().eq('influencer_id', numericId);
      if (platDelErr) throw platDelErr;

      const { error: pricingDelErr } = await supabase.from(SUPABASE_TABLES.influencerPricing).delete().eq('influencer_id', numericId);
      if (pricingDelErr) throw pricingDelErr;

      const { error: prodDelErr } = await supabase.from(SUPABASE_TABLES.influencerProduct).delete().eq('influencer_id', numericId);
      if (prodDelErr) throw prodDelErr;

      const { error: perfDelErr } = await supabase.from(SUPABASE_TABLES.influencerBrandPerformance).delete().eq('influencer_id', numericId);
      if (perfDelErr) throw perfDelErr;

      const { error: dispatchDelErr } = await supabase.from(SUPABASE_TABLES.influencerDispatch).delete().eq('influencer_id', numericId);
      if (dispatchDelErr) throw dispatchDelErr;

      // 3. Delete base influencer info row
      const { error: infoDelErr } = await supabase.from(SUPABASE_TABLES.influencersInfo).delete().eq('id', numericId);
      if (infoDelErr) throw infoDelErr;

      await loadInfluencers();
      notifyInfluencerChange(campaignId);

      // Non-blocking activity logging
      logActivity(
        'Marketing',
        'Influencer Deleted',
        `Influencer "${influencerName}" was deleted.`
      );

      return true;
    } catch (err: any) {
      console.error('Error deleting influencer:', err);
      setError(err instanceof Error ? err : new Error(err?.message || JSON.stringify(err)));
      throw err;
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
    deleteInfluencer,
    refresh: () => loadInfluencers()
  };
};