import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import { isActiveStatus } from '../../utils/marketingUtils';
import { naturalCompareCodes } from '../../services/influencerStatusHandoffService';
import { parseToYMD, calculateDraftDate, calculatePostDateFromDraft } from '../../utils/influencerDateUtils';
import type { InfluencerVideoPayment } from '../../services/influencerVideoPaymentService';
import { fetchCampaignVideoScripts, type CampaignVideoScriptRecord } from '../../services/campaignVideoScriptService';
import { fetchAllInChunks } from './useCampaignInfluencers';

export { naturalCompareCodes, parseToYMD, calculateDraftDate, calculatePostDateFromDraft };

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
    auto_dm?: any;
    platforms?: string[];
    languages?: string[];
    payment_method?: 'UPI' | 'ACCOUNT_DETAILS' | string | null;
    upi_number?: string | null;
    account_holder_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
    bank_name?: string | null;
  };
  pricing?: {
    final_price: number;
    total_videos?: number;
    product_pricing?: any;
  };
  postDates?: Array<{
    id?: any;
    video_number: number;
    post_date?: string | null;
    draft_date?: string | null;
  }>;
  influencer?: any;
  videoPayments?: InfluencerVideoPayment[];
  videoScripts?: CampaignVideoScriptRecord[];
  redispatch?: {
    id: string;
    campaign_id: string;
    influencer_id: number;
    influencer_code: string;
    order_id?: string | null;
    previous_awb?: string | null;
    courier?: string | null;
    issue_type?: string | null;
    issue_remark?: string | null;
    redispatch_status: 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'COMPLETED';
    moved_to_active_at?: string | null;
    completed_at?: string | null;
  } | null;
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
      const cleanCampaignId = String(campaignId).trim();
      const numCampId = Number(cleanCampaignId);
      const campQuery = !isNaN(numCampId) ? numCampId : cleanCampaignId;

      // 1. Fetch all campaign influencers first - they are the single source of truth!
      const { data: rawInfoData, error: infoError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*')
        .eq('campaign_id', campQuery);

      if (infoError) throw infoError;

      // Keep only active campaign influencers (exclude eliminate, recycle bin, and archived)
      const activeInfluencers = (rawInfoData || []).filter(i => isActiveStatus(i.is_archived));
      
      if (activeInfluencers.length === 0) {
        setTrackingRecords([]);
        setIsLoading(false);
        return;
      }

      const activeInfluencerIds = activeInfluencers.map(i => i.id);

      // 2. Fetch all related data in parallel for the active influencers
      const [
        trackingRes,
        dispatchRes,
        pricingData,
        productsData,
        postDatesRes,
        videoPaymentsRes,
        videoScriptsData,
        platformData,
        redispatchRes
      ] = await Promise.all([
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('*')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('*')
          .eq('campaign_id', campQuery),
        fetchAllInChunks(
          chunk => supabaseAdmin.from(SUPABASE_TABLES.influencerPricing).select('id, influencer_id, final_price, total_videos, product_pricing, video1_price, video2_price, video1_count, video2_count').in('influencer_id', chunk),
          activeInfluencerIds,
          200
        ),
        fetchAllInChunks(
          chunk => supabaseAdmin.from(SUPABASE_TABLES.influencerProduct).select('id, influencer_id, product_name, name, video_number, qty, selected').in('influencer_id', chunk),
          activeInfluencerIds,
          200
        ),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerPostDates)
          .select('*')
          .eq('campaign_id', campQuery),
        supabaseAdmin
          .from(SUPABASE_TABLES.influencerVideoPayment)
          .select('*')
          .eq('campaign_id', campQuery),
        fetchCampaignVideoScripts(cleanCampaignId, activeInfluencerIds),
        fetchAllInChunks(
          chunk => supabaseAdmin.from(SUPABASE_TABLES.influencerPlatform).select('influencer_id, username, platform').in('influencer_id', chunk),
          activeInfluencerIds,
          200
        ),
        supabaseAdmin
          .from(SUPABASE_TABLES.redispatchRecords)
          .select('id, campaign_id, influencer_id, influencer_code, order_id, previous_awb, courier, issue_type, issue_remark, redispatch_status, moved_to_active_at, completed_at')
          .eq('campaign_id', cleanCampaignId)
      ]);

      const trackingData = trackingRes.data || [];
      const dispatchData = dispatchRes.data || [];
      const postDatesData = postDatesRes.data || [];
      const videoPaymentsData = videoPaymentsRes.data || [];
      const redispatchData = redispatchRes.data || [];

      // Map status tracking records by influencer_id
      const statusMapByInfId = new Map<string, any>();
      (trackingData || []).forEach((st: any) => {
        if (st.influencer_id) {
          statusMapByInfId.set(String(st.influencer_id), st);
        }
      });

      // Map dispatch records by both id and influencer_id
      const dispatchMapById: Record<string, any> = {};
      const dispatchMapByInfId: Record<string, any> = {};
      (dispatchData || []).forEach((d: any) => {
        if (d.id) dispatchMapById[String(d.id)] = d;
        if (d.influencer_id) dispatchMapByInfId[String(d.influencer_id)] = d;
      });

      const redispatchMap: Record<string, any> = {};
      (redispatchData || []).forEach((rd: any) => {
        if (rd.influencer_id) {
          redispatchMap[String(rd.influencer_id)] = rd;
        }
      });

      let platformMap: Record<string, string> = {};
      const rawPlatformsData: any[] = platformData || [];
      rawPlatformsData.forEach(pl => {
        if (pl.username && !platformMap[pl.influencer_id]) {
          platformMap[pl.influencer_id] = pl.username;
        }
      });

      const pricingMap = (pricingData || []).reduce((acc: any, p: any) => {
        acc[p.influencer_id] = p;
        return acc;
      }, {});

      const productsByInfluencer: Record<string, any[]> = {};
      (productsData || []).forEach((p: any) => {
        const infKey = String(p.influencer_id);
        if (!productsByInfluencer[infKey]) productsByInfluencer[infKey] = [];
        productsByInfluencer[infKey].push(p);
      });

      const videoScriptsByInfluencer: Record<string, CampaignVideoScriptRecord[]> = {};
      (videoScriptsData || []).forEach(vs => {
        const infKey = String(vs.influencer_id);
        if (!videoScriptsByInfluencer[infKey]) videoScriptsByInfluencer[infKey] = [];
        videoScriptsByInfluencer[infKey].push(vs);
      });

      // Combine active campaign influencers with status and dispatch data
      const combined: StatusTrackingRecord[] = activeInfluencers.map(info => {
        const existingStatus = statusMapByInfId.get(String(info.id));
        const dispatch = (existingStatus?.dispatch_id ? dispatchMapById[String(existingStatus.dispatch_id)] : null) 
          || dispatchMapByInfId[String(info.id)] 
          || {};
        const pricing = pricingMap[info.id] || {};
        const rawUser = platformMap[info.id] || info.name || '';
        const cleanUser = rawUser ? (rawUser.startsWith('@') ? rawUser : `@${rawUser}`) : '—';
        
        const rawPlatforms = rawPlatformsData.filter(p => String(p.influencer_id) === String(info.id));
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
                const postYmd = hasPost 
                  ? parseToYMD(pd.post_date, 2026) 
                  : (hasDraft ? calculatePostDateFromDraft(pd.draft_date, 2026) : null);
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
          .filter((pd: any) => String(pd.influencer_id) === String(info.id))
          .forEach((pd: any, pIdx: number) => {
            const hasPost = pd.post_date && String(pd.post_date).trim() !== '';
            const hasDraft = pd.draft_date && String(pd.draft_date).trim() !== '';
            if (hasPost || hasDraft) {
              const vNum = Number(pd.video_number) || (pIdx + 1);
              const postYmd = hasPost 
                ? parseToYMD(pd.post_date, 2026) 
                : (hasDraft ? calculatePostDateFromDraft(pd.draft_date, 2026) : null);
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
          const postYmd = pd.post_date 
            ? parseToYMD(pd.post_date, 2026) 
            : (pd.draft_date ? calculatePostDateFromDraft(pd.draft_date, 2026) : null);
          const draftYmd = pd.draft_date ? parseToYMD(pd.draft_date, 2026) : (postYmd ? calculateDraftDate(postYmd, 2026) : '');
          return {
            ...pd,
            post_date: postYmd || pd.post_date || null,
            draft_date: draftYmd || null
          };
        }).sort((a: any, b: any) => (a.video_number || 0) - (b.video_number || 0));

        const fullInfluencer = {
          ...info,
          auto_dm: info.auto_dm,
          pricing: pricingMap[info.id] || {},
          products: productsByInfluencer[String(info.id)] || []
        };

        const vPayments = (videoPaymentsData || []).filter(
          (vp: any) => String(vp.influencer_id) === String(info.id) && String(vp.campaign_id) === String(cleanCampaignId)
        );

        // Fallback or synthesized status row if not yet persisted in database
        const baseStatusRow = existingStatus || {
          id: `sync-${info.id}`,
          dispatch_id: dispatch.id ? String(dispatch.id) : '',
          campaign_id: String(campQuery),
          influencer_id: String(info.id),
          current_step: 1,
          delivered_confirmed: Boolean(dispatch.delivered_date),
          pay_advance_completed: false,
          reference_video_received: false,
          expected_delivery_completed: false,
          draft_received: false,
          payment_remaining_completed: false,
          final_post_completed: false,
          delivery_photo_url: '',
          reference_video_url: '',
          draft_video_url: '',
          final_post_url: '',
          notes: '',
          status: 'Active',
          advance_gpay_number: '',
          advance_total_amount: '',
          advance_paid_amount: '',
          pay_advance_photo_url: '',
          ref_concept: '',
          ref_script: '',
          ref_keypoints: '',
          ref_offer: '',
          ref_link: '',
          ref_call_explanation_required: false,
          reference_videos_list: [],
          draft_expected_date: '',
          draft_expected_time: '',
          posting_timelines: [],
          draft_approval_status: '',
          draft_timing_status: '',
          draft_corrections_required: '',
          draft_final_product_link: '',
          draft_final_description: '',
          payment_remaining_photo_url: '',
          final_post_link: '',
          final_post_actual_datetime: '',
          re_draft_expected_date: '',
          re_draft_expected_time: '',
          re_posting_timelines: [],
          re_draft_video_url: '',
          re_draft_approval_status: '',
          re_draft_timing_status: '',
          re_draft_corrections_required: '',
          re_draft_final_product_link: '',
          re_draft_final_description: ''
        };

        return {
          ...baseStatusRow,
          influencer: fullInfluencer,
          postDates,
          videoPayments: vPayments,
          dispatch: {
            campaign_name: dispatch.campaign_name || '',
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
            auto_dm: info.auto_dm,
            platforms: userPlatforms as string[],
            languages: Array.from(new Set(cleanLangs)) as string[],
            payment_method: info.payment_method || (info.upi_number ? 'UPI' : (info.account_number ? 'ACCOUNT_DETAILS' : null)),
            upi_number: info.upi_number || '',
            account_holder_name: info.account_holder_name || '',
            account_number: info.account_number || '',
            ifsc_code: info.ifsc_code || '',
            bank_name: info.bank_name || '',
            pan_number: info.pan_number || ''
          },
          pricing: {
            final_price: pricing.final_price,
            total_videos: pricing.total_videos !== undefined ? pricing.total_videos : 1,
            product_pricing: pricing.product_pricing
          },
          videoScripts: videoScriptsByInfluencer[String(info.id)] || [],
          redispatch: redispatchMap[String(info.id)] || null
        };
      });
      
      // Ascending natural sort by Influencer Code (HIS1, HIS2, ... HIS10)
      combined.sort((a, b) => {
        return naturalCompareCodes(
          a.dispatch?.influencer_code || a.influencer?.code || a.influencer_id,
          b.dispatch?.influencer_code || b.influencer?.code || b.influencer_id
        );
      });

      setTrackingRecords(combined);
    } catch (err: unknown) {
      console.error('Error fetching tracking records:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadTrackingRecords();

    const handleSync = (e?: any) => {
      const targetCampId = e?.detail?.campaignId;
      if (!targetCampId || String(targetCampId) === String(campaignId)) {
        loadTrackingRecords();
      }
    };

    window.addEventListener('status_tracking_updated', handleSync);
    window.addEventListener('influencer_tracking_updated', handleSync);
    window.addEventListener('velmora:influencer-updated', handleSync);
    window.addEventListener('velmora:video-payment-updated', handleSync);
    window.addEventListener('velmora:post-date-updated', handleSync);
    window.addEventListener('velmora:campaign-video-script-updated', handleSync);

    return () => {
      window.removeEventListener('status_tracking_updated', handleSync);
      window.removeEventListener('influencer_tracking_updated', handleSync);
      window.removeEventListener('velmora:influencer-updated', handleSync);
      window.removeEventListener('velmora:video-payment-updated', handleSync);
      window.removeEventListener('velmora:post-date-updated', handleSync);
      window.removeEventListener('velmora:campaign-video-script-updated', handleSync);
    };
  }, [campaignId, loadTrackingRecords]);

  // Save specific milestone data (PATCH only the provided fields)
  const saveMilestone = async (trackingId: string, updates: Partial<StatusTrackingRecord>) => {
    try {
      const targetRecord = trackingRecords.find(r => String(r.id) === String(trackingId));
      const influencerName = (targetRecord as any)?.influencer_name || (targetRecord as any)?.creator_name || `ID ${targetRecord?.influencer_id || 'Unknown'}`;

      let actualId = trackingId;
      if (String(trackingId).startsWith('sync-')) {
        const cleanCampaignId = String(campaignId).trim();
        const numCampId = Number(cleanCampaignId);
        const campVal = !isNaN(numCampId) ? numCampId : cleanCampaignId;

        const { data: maxIdData } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
        const newId = (Number(maxIdData?.[0]?.id) || 0) + 1;

        const newRow: any = {
          id: newId,
          campaign_id: campVal,
          influencer_id: targetRecord?.influencer_id,
          dispatch_id: targetRecord?.dispatch_id ? (Number(targetRecord.dispatch_id) || null) : null,
          current_step: 1,
          delivered_confirmed: Boolean(targetRecord?.delivered_confirmed),
          pay_advance_completed: false,
          reference_video_received: false,
          expected_delivery_completed: false,
          draft_received: false,
          payment_remaining_completed: false,
          final_post_completed: false,
          ...updates,
          status: 'Active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insErr } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .insert([newRow]);
        if (insErr) throw insErr;
        actualId = String(newId);
      } else {
        const { error } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerStatus)
          .update(updates)
          .eq('id', trackingId);
          
        if (error) throw error;
      }
      
      // Update local state without full refetch
      setTrackingRecords(prev => prev.map(record => 
        String(record.id) === String(trackingId) ? { ...record, id: actualId, ...updates } : record
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

  // Permanently clear all Status Tracking records for this campaign from Supabase
  const clearAllStatusTracking = async (): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
    if (!campaignId) {
      return { success: false, error: 'No campaign ID provided' };
    }

    const cleanCampaignId = String(campaignId).trim();
    if (!cleanCampaignId) {
      return { success: false, error: 'Campaign ID is empty' };
    }

    try {
      const numCampId = Number(cleanCampaignId);
      const campVal = !isNaN(numCampId) ? numCampId : cleanCampaignId;

      // 1. Delete all records for this campaign from influencer_status_tracking_rows
      const { data, error: delError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .delete()
        .eq('campaign_id', campVal)
        .select('id');

      if (delError) {
        console.error('Failed to clear status tracking rows from database:', delError);
        return { success: false, error: delError.message };
      }

      // 2. Clear local React state immediately
      setTrackingRecords([]);

      // 3. Invalidate/clear any Status Tracking specific local storage cache if any exists
      try {
        if (typeof window !== 'undefined') {
          const prefix = `status_tracking_${cleanCampaignId}`;
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith(prefix) || key.startsWith(`influencer_status_${cleanCampaignId}`)) {
              localStorage.removeItem(key);
            }
          });
        }
      } catch (storageErr) {
        console.warn('Status tracking localStorage cleanup warning:', storageErr);
      }

      // 4. Re-verify directly from DB
      await loadTrackingRecords();

      // 5. Dispatch sync events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
      }

      return {
        success: true,
        deletedCount: data ? data.length : 0
      };
    } catch (err: any) {
      console.error('clearAllStatusTracking exception:', err);
      await loadTrackingRecords();
      return {
        success: false,
        error: err?.message || String(err)
      };
    }
  };

  // Delete an individual status tracking record
  const deleteStatusTrackingRecord = async (recordId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: delErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .delete()
        .eq('id', recordId);

      if (delErr) throw delErr;

      setTrackingRecords(prev => prev.filter(r => String(r.id) !== String(recordId)));
      await loadTrackingRecords();

      if (typeof window !== 'undefined' && campaignId) {
        window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: String(campaignId) } }));
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting status tracking record:', err);
      return { success: false, error: err?.message || String(err) };
    }
  };

  return {
    trackingRecords,
    isLoading,
    error,
    refresh: loadTrackingRecords,
    saveMilestone,
    clearAllStatusTracking,
    deleteStatusTrackingRecord
  };
};
