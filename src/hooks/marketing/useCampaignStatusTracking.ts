import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import { isActiveStatus } from '../../utils/marketingUtils';
import { naturalCompareCodes } from '../../services/influencerStatusHandoffService';
import { parseToYMD, calculateDraftDate } from './useCampaignInfluencers';

export { naturalCompareCodes, parseToYMD, calculateDraftDate };

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
  created_at?: string;
  updated_at?: string;
  
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
    is_archived?: any;
    platforms?: string[];
    languages?: string[];
  };
  pricing?: {
    final_price: number;
  };
  postDates?: Array<{
    id?: any;
    video_number: number;
    post_date?: string | null;
    draft_date?: string | null;
  }>;
}

export const useCampaignStatusTracking = (campaignId?: string) => {
  const [trackingRecords, setTrackingRecords] = useState<StatusTrackingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTrackingRecords = useCallback(async () => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const { data: trackingData, error: trackingError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .select('*')
        .eq('campaign_id', campaignId);
        
      if (trackingError) throw trackingError;
      
      const records = (trackingData || []) as StatusTrackingRecord[];
      
      if (records.length > 0) {
        const dispatchIds = Array.from(new Set(records.map(r => r.dispatch_id).filter(Boolean)));
        const influencerIds = Array.from(new Set(records.map(r => r.influencer_id).filter(Boolean)));
        const [
          { data: dispatchData, error: dispatchError },
          { data: infoData, error: infoError },
          { data: pricingData, error: pricingError },
          { data: postDatesData }
        ] = await Promise.all([
          supabase.from(SUPABASE_TABLES.influencerDispatch).select('*').in('id', dispatchIds),
          supabase.from(SUPABASE_TABLES.influencersInfo).select('id, name, influencer_name, profile_file_url, code, phone_number, state, complete_address, is_archived, languages').in('id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerPricing).select('influencer_id, final_price, total_videos').in('influencer_id', influencerIds),
          supabase.from(SUPABASE_TABLES.influencerPostDates).select('*').in('influencer_id', influencerIds)
        ]);

        let platformMap: Record<string, string> = {};
        let rawPlatformsData: any[] = [];
        try {
          const { data: platformData } = await supabase
            .from(SUPABASE_TABLES.influencerPlatform)
            .select('influencer_id, username, platform')
            .in('influencer_id', influencerIds);
          rawPlatformsData = platformData || [];
          rawPlatformsData.forEach(pl => {
            if (pl.username && !platformMap[pl.influencer_id]) {
              platformMap[pl.influencer_id] = pl.username;
            }
          });
        } catch (e) {
          // Ignore platform query error if table unavailable
        }

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

        // Combine and filter out archived
        const combined = records
          .map(r => {
            const dispatch = dispatchMap[r.dispatch_id] || {};
            const info = infoMap[r.influencer_id] || {};
            const pricing = pricingMap[r.influencer_id] || {};
            const rawUser = platformMap[r.influencer_id] || info.name || '';
            const cleanUser = rawUser ? (rawUser.startsWith('@') ? rawUser : `@${rawUser}`) : '—';
            
            const rawPlatforms = rawPlatformsData.filter(p => String(p.influencer_id) === String(r.influencer_id));
            const userPlatforms = Array.from(new Set(rawPlatforms.map(p => {
              const pLower = (p.platform || '').toLowerCase();
              if (pLower.includes('insta') || pLower === 'ig') return 'Instagram';
              if (pLower.includes('you') || pLower === 'yt') return 'YouTube';
              if (pLower.includes('face') || pLower === 'fb') return 'Facebook';
              return p.platform || 'Other';
            }).filter(Boolean)));

            const cleanLangs = Array.isArray(info.languages)
              ? info.languages.filter((l: string) => typeof l === 'string' && !l.startsWith('views_data:'))
              : (typeof info.languages === 'string' ? info.languages.split(/[,/]+/).map((s: string) => s.trim()).filter(Boolean) : []);

            // Process Post Dates from views_data and influencer_post_dates table
            const postDatesMap = new Map<number, any>();
            const matchViewsElement = Array.isArray(info.languages)
              ? info.languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:'))
              : null;
            if (matchViewsElement) {
              try {
                const viewsJson = JSON.parse(matchViewsElement.substring('views_data:'.length));
                (viewsJson?.post_dates || []).forEach((pd: any, pIdx: number) => {
                  const hasPost = pd.post_date && String(pd.post_date).trim() !== '';
                  const hasDraft = pd.draft_date && String(pd.draft_date).trim() !== '';
                  if (hasPost || hasDraft) {
                    const vNum = Number(pd.video_number) || (pIdx + 1);
                    const postYmd = hasPost ? parseToYMD(pd.post_date, 2026) : null;
                    const draftYmd = hasDraft
                      ? parseToYMD(pd.draft_date, 2026)
                      : (postYmd ? calculateDraftDate(postYmd, 2026) : '');
                    postDatesMap.set(vNum, {
                      video_number: vNum,
                      post_date: postYmd || pd.post_date || null,
                      draft_date: draftYmd || null
                    });
                  }
                });
              } catch (e) {}
            }

            (postDatesData || [])
              .filter((pd: any) => String(pd.influencer_id) === String(r.influencer_id))
              .forEach((pd: any, pIdx: number) => {
                const hasPost = pd.post_date && String(pd.post_date).trim() !== '';
                const hasDraft = pd.draft_date && String(pd.draft_date).trim() !== '';
                if (hasPost || hasDraft) {
                  const vNum = Number(pd.video_number) || (pIdx + 1);
                  const postYmd = hasPost ? parseToYMD(pd.post_date, 2026) : null;
                  const draftYmd = hasDraft
                    ? parseToYMD(pd.draft_date, 2026)
                    : (postYmd ? calculateDraftDate(postYmd, 2026) : '');
                  postDatesMap.set(vNum, {
                    id: pd.id,
                    influencer_id: pd.influencer_id,
                    campaign_id: pd.campaign_id,
                    video_number: vNum,
                    post_date: postYmd || pd.post_date || null,
                    draft_date: draftYmd || null
                  });
                }
              });

            const postDates = Array.from(postDatesMap.values()).map((pd: any) => {
              const postYmd = pd.post_date ? parseToYMD(pd.post_date, 2026) : null;
              const draftYmd = pd.draft_date ? parseToYMD(pd.draft_date, 2026) : (postYmd ? calculateDraftDate(postYmd, 2026) : '');
              return {
                ...pd,
                post_date: postYmd || pd.post_date || null,
                draft_date: draftYmd || null
              };
            }).sort((a: any, b: any) => (a.video_number || 0) - (b.video_number || 0));

            return {
              ...r,
              postDates,
              dispatch: {
                campaign_name: dispatch.campaign_name,
                address: dispatch.address || info.complete_address || '',
                state: dispatch.state || info.state || '',
                phone_number: dispatch.phone_number || info.phone_number || '',
                alternative_phone_number: dispatch.alternative_phone_number || '',
                dispatch_date: dispatch.dispatch_date,
                expected_delivery_date: dispatch.expected_delivery_date,
                product_name: dispatch.product_name,
                total_products: dispatch.total_products,
                total_product_value: dispatch.total_product_value,
                courier_partner: dispatch.courier_partner,
                tracking_id: dispatch.tracking_id,
                influencer_name: info.influencer_name || info.name || dispatch.creator_name || 'Unknown Influencer',
                influencer_code: info.code || dispatch.influencer_code || '',
                username: cleanUser,
                influencer_avatar: info.profile_file_url,
                is_archived: info.is_archived,
                platforms: userPlatforms as string[],
                languages: Array.from(new Set(cleanLangs)) as string[]
              },
              pricing: {
                final_price: pricing.final_price,
                total_videos: pricing.total_videos !== undefined ? pricing.total_videos : 1
              }
            };
          })
          .filter(r => {
            // Keep only active influencers (exclude eliminate and recycle bin)
            return isActiveStatus(r.dispatch.is_archived);
          });
        
        // Ascending natural sort by Influencer Code (J2, J10, J61, J174, J203)
        combined.sort((a, b) => {
          return naturalCompareCodes(
            a.dispatch?.influencer_code || a.influencer_id,
            b.dispatch?.influencer_code || b.influencer_id
          );
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
      const targetRecord = trackingRecords.find(r => String(r.id) === String(trackingId));
      const influencerName = (targetRecord as any)?.influencer_name || (targetRecord as any)?.creator_name || `ID ${targetRecord?.influencer_id || 'Unknown'}`;

      const { error } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .update(updates)
        .eq('id', trackingId);
        
      if (error) throw error;
      
      // Update local state without full refetch
      setTrackingRecords(prev => prev.map(record => 
        String(record.id) === String(trackingId) ? { ...record, ...updates } : record
      ));

      // Non-blocking activity logging
      logActivity(
        'Logistics',
        'Dispatch Updated',
        `Milestone tracking updated for influencer "${influencerName}".`
      );
      
      return { success: true };
    } catch (err: any) {
      console.error('Error saving milestone:', err);
      return { success: false, error: err };
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
