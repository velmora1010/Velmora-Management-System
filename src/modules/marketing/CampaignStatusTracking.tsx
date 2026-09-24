import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Campaign } from '../../types';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import { 
  Clock, Package, Phone, FileText, Video, Check, 
  XCircle, PauseCircle, Users, Target, Search, Trash2, MoreHorizontal, 
  RefreshCcw, X, UploadCloud, IndianRupee, Eye, Copy, ArrowLeft,
  History, RotateCcw, AlertTriangle, Lock, RefreshCw, Play, Edit3, Loader2,
  Mic, Volume2, ExternalLink, SlidersHorizontal
} from 'lucide-react';
import { logActivity } from '../../services/activityService';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { isActiveStatus } from '../../utils/marketingUtils';
import { naturalCompareCodes, isDeliveryStepCompleted } from '../../services/influencerStatusHandoffService';
import { getOriginalOrderId } from '../../utils/orderIdUtils';
import { parseToYMD, calculateDraftDate, calculatePostDateFromDraft } from '../../utils/influencerDateUtils';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { getInfluencerResolvedVideoProducts, isVideoLabel } from './AddCampaignInfluencer';
import { StatusTrackingPaymentCard, PaymentDetailsInfo } from './StatusTrackingPaymentCard';
import { saveVideoPayment, fetchVideoPaymentTransactions, InfluencerVideoPayment, InfluencerVideoPaymentTransaction } from '../../services/influencerVideoPaymentService';
import { upsertCampaignVideoScript, type CampaignVideoScriptRecord } from '../../services/campaignVideoScriptService';
import { 
  StatusTrackingFilterDrawer, 
  type StatusTrackingFilterState, 
  initialStatusTrackingFilterState,
  STATUS_TRACKING_PRICE_RANGES
} from '../../components/marketing/StatusTrackingFilterDrawer';
import { areFilterValuesEqual, getUniqueFilterOptions } from '../../utils/filterUtils';
import { 
  shipmentAttemptService, 
  type ShipmentAttempt, 
  type ShipmentIssueType,
  cleanCodeRef
} from '../../services/shipmentAttemptService';

interface CampaignStatusTrackingProps {
  campaign: Campaign;
  onBack: () => void;
}

// Configurable default videos count for this campaign
export const DEFAULT_CAMPAIGN_VIDEOS_COUNT = 6;

export interface VideoStepConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: any;
}

// Video 1 Steps: Share Script -> Call & Explain -> Pay Advance -> Time Line -> Draft -> Post Date
export const VIDEO_1_STEP_CONFIGS: VideoStepConfig[] = [
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'call_explain', label: 'Call & Explain', shortLabel: 'Call Explain', icon: Phone },
  { id: 'pay_advance', label: 'Pay Advance', shortLabel: 'Pay Advance', icon: IndianRupee },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Check },
];

// Videos 2 through N Steps: Share Script -> Call & Explain -> Time Line -> Draft -> Post Date -> Payment
export const VIDEO_N_STEP_CONFIGS: VideoStepConfig[] = [
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'call_explain', label: 'Call & Explain', shortLabel: 'Call Explain', icon: Phone },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Check },
  { id: 'payment', label: 'Payment', shortLabel: 'Payment', icon: IndianRupee },
];

const isFakeUrl = (url: string | undefined | null) => {
  if (!url) return true;
  const clean = url.trim().toLowerCase();
  return clean === '' || 
         clean === 'default' || 
         clean === 'default2' || 
         clean.includes('instagram.com/p/default') || 
         clean.includes('instagram.com/p/default2');
};

const formatForDateTimeInput = (dateStr: string | undefined | null) => {
  if (!dateStr) return '';
  // If already in local YYYY-MM-DDTHH:mm format, return directly to prevent UTC offset shifting
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
};

export const formatDisplayDateLocal = (dateStr: string | null | undefined): string => {
  if (!dateStr || !dateStr.trim()) return 'Not Assigned';
  const ymd = parseToYMD(dateStr, 2026);
  if (!ymd) return dateStr;
  const parts = ymd.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[month - 1] || '';
  const dd = String(day).padStart(2, '0');
  return `${dd} ${monthName} ${year}`;
};

// =========================================================================
// PRODUCT RESOLUTION HELPER (REUSING getInfluencerResolvedVideoProducts)
// =========================================================================
export interface ResolvedVideoProductInfo {
  productName: string;
  isAssigned: boolean;
  amount: number;
}

export const getResolvedProductForVideo = (
  influencer: any,
  videoNumber: number
): ResolvedVideoProductInfo => {
  if (!influencer) {
    return { productName: 'Product not assigned', isAssigned: false, amount: 0 };
  }

  try {
    const resolvedVideos = getInfluencerResolvedVideoProducts(influencer);
    const found = (resolvedVideos || []).find(v => Number(v.videoNumber) === Number(videoNumber));

    if (!found) {
      return { productName: 'Product not assigned', isAssigned: false, amount: 0 };
    }

    const amt = found.amount || 0;

    // 1. Check found.combination (Canonical assigned combination from Pricing/Product)
    const comb = (found.combination || '').trim();
    if (comb && !isVideoLabel(comb) && comb.toLowerCase() !== '5-6 products') {
      return { productName: comb, isAssigned: true, amount: amt };
    }

    // 2. Check structured products in found.products
    if (Array.isArray(found.products) && found.products.length > 0) {
      const validProds = found.products.filter((p: any) => p && !isVideoLabel(p.name || p.product_name));
      if (validProds.length > 0) {
        const names = validProds
          .map((p: any) => (p.name || p.product_name || '').trim())
          .filter((n: string) => n && !isVideoLabel(n));
        if (names.length > 0) {
          return { productName: names.join(' + '), isAssigned: true, amount: amt };
        }
      }
    }

    return { productName: 'Product not assigned', isAssigned: false, amount: amt };
  } catch (e) {
    console.error('Error in getResolvedProductForVideo:', e);
    return { productName: 'Product not assigned', isAssigned: false, amount: 0 };
  }
};

// =========================================================================
// PER-VIDEO PRICING RESOLUTION HELPERS
// =========================================================================
export const getInfluencerVideoPrice = (influencer: any, videoNumber: number): number | null => {
  if (!influencer) return null;

  // Priority 1: Check canonical resolved video items
  try {
    const resolvedList = getInfluencerResolvedVideoProducts(influencer);
    const found = (resolvedList || []).find(v => Number(v.videoNumber) === Number(videoNumber));
    if (found && found.amount !== undefined && found.amount !== null && !isNaN(Number(found.amount)) && Number(found.amount) > 0) {
      return Number(found.amount);
    }
  } catch (e) {
    // Ignore and fall through
  }

  // Priority 2: Direct lookup in pricing.product_pricing.videos
  const pricingObj = influencer.pricing || {};
  const pricingVideos = Array.isArray(pricingObj.product_pricing?.videos)
    ? pricingObj.product_pricing.videos
    : [];
  if (pricingVideos[videoNumber - 1]) {
    const vEntry = pricingVideos[videoNumber - 1];
    const amt = (vEntry && typeof vEntry === 'object' && vEntry.amount !== undefined && vEntry.amount !== null)
      ? Number(vEntry.amount)
      : Number(vEntry);
    if (!isNaN(amt) && amt > 0) {
      return amt;
    }
  }

  // Priority 3: Check legacy video1_price / video2_price columns
  if (Number(videoNumber) === 1 && pricingObj.video1_price) {
    const v1 = Number(pricingObj.video1_price);
    if (!isNaN(v1) && v1 > 0) return v1;
  }
  if (Number(videoNumber) === 2 && pricingObj.video2_price) {
    const v2 = Number(pricingObj.video2_price);
    if (!isNaN(v2) && v2 > 0) return v2;
  }

  return null;
};

export const getInfluencerCampaignTotalPrice = (influencer: any, recordPricing?: any): number | null => {
  const finalPrice = recordPricing?.final_price ?? influencer?.pricing?.final_price;
  if (finalPrice !== undefined && finalPrice !== null && !isNaN(Number(finalPrice)) && Number(finalPrice) > 0) {
    return Number(finalPrice);
  }
  return null;
};

// =========================================================================
// FILTER RESOLUTION HELPERS FOR VIDEOS, CATEGORIES & DELIVERY STATUS
// =========================================================================
export const getInfluencerAssignedVideos = (record: StatusTrackingRecord): number[] => {
  let count = Number(record.pricing?.total_videos) || 0;
  
  if (Array.isArray(record.postDates) && record.postDates.length > 0) {
    const maxPd = Math.max(...record.postDates.map(p => Number(p.video_number) || 0));
    if (maxPd > count) count = maxPd;
  }
  
  try {
    const meta = JSON.parse(record.notes || '{}');
    if (meta.videos && typeof meta.videos === 'object') {
      const keys = Object.keys(meta.videos).map(k => Number(k)).filter(n => !isNaN(n));
      if (keys.length > 0) {
        const maxK = Math.max(...keys);
        if (maxK > count) count = maxK;
      }
    }
  } catch (e) {}

  if (count <= 0) count = DEFAULT_CAMPAIGN_VIDEOS_COUNT;

  const result: number[] = [];
  for (let i = 1; i <= count; i++) {
    result.push(i);
  }
  return result;
};

export const getInfluencerCategories = (record: StatusTrackingRecord): string[] => {
  const categories: string[] = [];
  const inf = record.influencer || {};
  
  if (inf.creatorCategory && typeof inf.creatorCategory === 'string') {
    categories.push(inf.creatorCategory);
  }
  if (inf.category && typeof inf.category === 'string') {
    categories.push(inf.category);
  }
  if ((record.dispatch as any)?.category && typeof (record.dispatch as any).category === 'string') {
    categories.push((record.dispatch as any).category);
  }

  if (Array.isArray(inf.platforms)) {
    inf.platforms.forEach((p: any) => {
      if (p.performance_code && typeof p.performance_code === 'string') categories.push(p.performance_code);
      if (p.creator_category && typeof p.creator_category === 'string') categories.push(p.creator_category);
      if (p.category && typeof p.category === 'string') categories.push(p.category);
    });
  }

  if (Array.isArray(inf.languages)) {
    const vd = inf.languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:'));
    if (vd) {
      try {
        const parsed = JSON.parse(vd.replace('views_data:', ''));
        if (parsed.platform_views && typeof parsed.platform_views === 'object') {
          Object.values(parsed.platform_views).forEach((pv: any) => {
            if (pv?.creator_category && typeof pv.creator_category === 'string') {
              categories.push(pv.creator_category);
            }
          });
        }
      } catch (e) {}
    }
  }

  if (inf.instagram_view_code) categories.push(inf.instagram_view_code);
  if (inf.facebook_view_code) categories.push(inf.facebook_view_code);
  if (inf.youtube_view_code) categories.push(inf.youtube_view_code);

  return getUniqueFilterOptions(categories);
};

export const getInfluencerDeliveryStatus = (record: StatusTrackingRecord): 'Delivery Confirmed' | 'Delivered' | 'Not Delivered' => {
  if (isDeliveryStepCompleted(record)) {
    return 'Delivery Confirmed';
  }
  
  const dispatch = record.dispatch as any;
  const dispatchStatus = (dispatch?.dispatch_status || '').toLowerCase();
  const trackingStatus = (record.status || '').toLowerCase();
  
  if (
    record.delivered_confirmed || 
    dispatchStatus === 'delivered' || 
    trackingStatus === 'delivered' ||
    dispatch?.delivered_date
  ) {
    return 'Delivered';
  }

  return 'Not Delivered';
};

// =========================================================================
// TYPES & HELPERS FOR DRAFT ATTEMPTS, RE-DRAFT & TIMELINE AUDIT HISTORY
// =========================================================================
export interface DraftAttempt {
  attempt_number: number;
  video_url: string;
  approval_status: 'Approved' | 'Not Approved' | 'Pending Approval';
  timing_status?: string;
  corrections?: string;
  re_draft_submit_date?: string;
  expected_submit_date?: string;
  final_product_link?: string;
  final_description?: string;
  uploaded_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface TimelineHistoryEntry {
  id?: string;
  old_date: string;
  new_date: string;
  changed_by: string;
  changed_at: string;
  reason?: string;
}

export const getCurrentUserName = async (): Promise<string> => {
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser();
    if (user?.email) return user.email.split('@')[0] || user.email;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
  } catch (e) {}
  try {
    const local = localStorage.getItem('velmora_active_user') || localStorage.getItem('active_account');
    if (local) return local;
  } catch (e) {}
  return 'Admin';
};

export const formatHistoryTimestamp = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day} ${month} ${year}, ${time}`;
  } catch (e) {
    return isoStr || '';
  }
};

export interface PostDateHistoryEntry {
  id?: string;
  old_date: string;
  new_date: string;
  changed_by: string;
  changed_at: string;
  reason?: string;
}

/**
 * Synchronizes a video's Post Date change with Supabase tables:
 * 1. influencer_post_dates_rows: updates row for (influencer_id, video_number) preserving draft_date
 * 2. influencers_info_rows: preserves all languages & platform_views in views_data, updating only views_data.post_dates[video_number]
 */
export const syncInfluencerPostDate = async ({
  influencerId,
  campaignId,
  videoNumber,
  newPostDate,
  newDraftDate
}: {
  influencerId: string | number;
  campaignId?: string;
  videoNumber: number;
  newPostDate: string;
  newDraftDate?: string;
}): Promise<{ success: boolean; error?: string }> => {
  const numericInfId = parseInt(String(influencerId), 10);
  if (isNaN(numericInfId)) {
    return { success: false, error: `Invalid influencer ID: ${influencerId}` };
  }

  try {
    // 1. Update influencer_post_dates_rows for strictly (influencer_id, video_number)
    const { data: existingRows, error: fetchPdErr } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerPostDates)
      .select('*')
      .eq('influencer_id', numericInfId)
      .eq('video_number', videoNumber);

    if (fetchPdErr) {
      console.error('Error fetching influencer_post_dates_rows:', fetchPdErr);
      return { success: false, error: fetchPdErr.message || 'Failed to check existing post dates' };
    }

    if (existingRows && existingRows.length > 0) {
      // Modify ONLY this specific video row
      const updateData: any = {
        post_date: newPostDate,
        updated_at: new Date().toISOString()
      };
      if (newDraftDate) {
        updateData.draft_date = newDraftDate;
      }
      const { error: updatePdErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerPostDates)
        .update(updateData)
        .eq('id', existingRows[0].id);

      if (updatePdErr) {
        console.error('Error updating influencer_post_dates_rows:', updatePdErr);
        return { success: false, error: updatePdErr.message || 'Failed to update post dates table' };
      }
    } else {
      let nextId = Date.now();
      try {
        const { data: maxRows } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerPostDates)
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
        if (maxRows && maxRows[0]?.id) nextId = Number(maxRows[0].id) + 1;
      } catch (e) {}

      const { error: insertPdErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerPostDates)
        .insert([{
          id: nextId,
          influencer_id: numericInfId,
          campaign_id: campaignId || null,
          video_number: videoNumber,
          post_date: newPostDate,
          draft_date: newDraftDate || null
        }]);

      if (insertPdErr) {
        console.error('Error inserting into influencer_post_dates_rows:', insertPdErr);
        return { success: false, error: insertPdErr.message || 'Failed to insert post dates table' };
      }
    }

    // 2. Safely Update views_data in influencers_info_rows
    const { data: infData, error: fetchInfErr } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencersInfo)
      .select('languages')
      .eq('id', numericInfId)
      .single();

    if (fetchInfErr) {
      console.error('Error fetching influencers_info_rows:', fetchInfErr);
      return { success: false, error: fetchInfErr.message || 'Failed to fetch influencer info' };
    }

    if (infData) {
      // Preserve ALL existing properties in languages
      let rawLangs: string[] = Array.isArray(infData.languages) ? [...infData.languages] : [];
      let viewsIdx = rawLangs.findIndex(l => typeof l === 'string' && l.startsWith('views_data:'));
      let viewsJson: any = {};

      if (viewsIdx >= 0) {
        try {
          viewsJson = JSON.parse(rawLangs[viewsIdx].substring('views_data:'.length));
        } catch (e) {
          viewsJson = {};
        }
      }

      // Preserve ALL properties of viewsJson (platform_views, etc.)
      if (!Array.isArray(viewsJson.post_dates)) {
        viewsJson.post_dates = [];
      }

      // Modify ONLY views_data.post_dates for this videoNumber
      let pdItem = viewsJson.post_dates.find((p: any) => Number(p.video_number) === Number(videoNumber));
      if (pdItem) {
        pdItem.post_date = newPostDate;
        if (newDraftDate) {
          pdItem.draft_date = newDraftDate;
        }
      } else {
        viewsJson.post_dates.push({
          video_number: videoNumber,
          post_date: newPostDate,
          draft_date: newDraftDate || null
        });
      }

      const newViewsStr = `views_data:${JSON.stringify(viewsJson)}`;
      if (viewsIdx >= 0) {
        rawLangs[viewsIdx] = newViewsStr;
      } else {
        rawLangs.push(newViewsStr);
      }

      const { error: updateInfErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .update({ languages: rawLangs })
        .eq('id', numericInfId);

      if (updateInfErr) {
        console.error('Error updating influencers_info_rows languages:', updateInfErr);
        return { success: false, error: updateInfErr.message || 'Failed to update influencer info' };
      }
    }

    // 3. Notify any other active listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velmora:influencer-updated', { detail: { influencerId: numericInfId } }));
      if (campaignId) {
        window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId } }));
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('syncInfluencerPostDate exception:', err);
    return { success: false, error: err.message || 'Unknown synchronization error' };
  }
};

// =========================================================================
// HELPER: PARSE & DERIVE VIDEO WORKFLOW STATE
// =========================================================================
export interface VideoWorkflowData {
  videoNumber: number;
  configs: VideoStepConfig[];
  steps: Record<string, {
    completed: boolean;
    data: any;
    updated_at?: string;
  }>;
  completedCount: number;
  totalSteps: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  activeStepId: string;
  isReDraftRequired: boolean;
  draftStatus: 'Approved' | 'Not Approved' | 'Pending Approval' | 'Not Started';
}

export const getVideoWorkflow = (record: StatusTrackingRecord, videoNum: number): VideoWorkflowData => {
  const configs = videoNum === 1 ? VIDEO_1_STEP_CONFIGS : VIDEO_N_STEP_CONFIGS;
  let metadata: any = {};
  try {
    metadata = JSON.parse(record.notes || '{}');
  } catch (e) {
    metadata = {};
  }

  const storedVideo = metadata.videos?.[String(videoNum)] || metadata.videos?.[videoNum];

  // Resolve scheduled draft date & post date for this specific video from record.postDates
  const scheduleEntry = (record.postDates || []).find(
    (pd: any) => Number(pd.video_number) === Number(videoNum)
  );
  let scheduledDraftDate = scheduleEntry?.draft_date || '';
  let scheduledPostDate = scheduleEntry?.post_date || '';
  if ((!scheduledDraftDate || !scheduledPostDate) && Array.isArray((record.dispatch as any)?.languages)) {
    const matchViews = (record.dispatch as any).languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:'));
    if (matchViews) {
      try {
        const vJson = JSON.parse(matchViews.substring('views_data:'.length));
        const found = (vJson?.post_dates || []).find((pd: any) => Number(pd.video_number) === Number(videoNum));
        if (found?.post_date && !scheduledPostDate) {
          scheduledPostDate = parseToYMD(found.post_date, 2026) || found.post_date;
        }
        if (found?.draft_date && !scheduledDraftDate) {
          scheduledDraftDate = parseToYMD(found.draft_date, 2026);
        } else if (found?.post_date && !scheduledDraftDate) {
          scheduledDraftDate = calculateDraftDate(found.post_date, 2026);
        }
      } catch (e) {}
    }
  }

  // Load-time derivation if one date exists but the other is missing
  if (!scheduledPostDate && scheduledDraftDate) {
    scheduledPostDate = calculatePostDateFromDraft(scheduledDraftDate, 2026);
  } else if (!scheduledDraftDate && scheduledPostDate) {
    scheduledDraftDate = calculateDraftDate(scheduledPostDate, 2026);
  }

  // Initialize steps record
  const steps: Record<string, { completed: boolean; data: any; updated_at?: string }> = {};

  configs.forEach(cfg => {
    // Dedicated Step 2: Share Script Resolution (Priority: 1. campaign_video_scripts, 2. notes JSON, 3. legacy columns)
    if (cfg.id === 'share_script') {
      const videoScript = (record.videoScripts || []).find((vs: any) => Number(vs.video_number) === Number(videoNum));
      const st = storedVideo?.steps?.['share_script'];

      let isScriptCompleted = false;
      let scriptData: any = {};

      if (videoScript) {
        // Priority 1: campaign_video_scripts relational record
        isScriptCompleted = Boolean(videoScript.script_shared_approved);
        scriptData = {
          concept: videoScript.custom_concept || '',
          hooks: videoScript.hooks || '',
          script: videoScript.proposed_script || '',
          voice_record: videoScript.voice_record_url ? {
            url: videoScript.voice_record_url,
            file_name: videoScript.voice_record_file_name || 'voice_recording',
            file_size_formatted: videoScript.voice_record_file_size || '',
            storage_path: videoScript.voice_record_storage_path || ''
          } : null,
          script_shared: isScriptCompleted,
          keypoints: st?.data?.keypoints || (videoNum === 1 ? (record.ref_keypoints || metadata.keypoints || '') : ''),
          link: st?.data?.link || (videoNum === 1 ? (record.ref_link || metadata.link || '') : ''),
          reference_videos_list: st?.data?.reference_videos_list || (videoNum === 1 ? (record.reference_videos_list || []) : [])
        };
      } else if (st) {
        // Priority 2: existing notes JSON data
        isScriptCompleted = Boolean(st.completed);
        scriptData = {
          concept: st.data?.concept || '',
          hooks: st.data?.hooks || '',
          script: st.data?.script || '',
          voice_record: st.data?.voice_record || null,
          script_shared: isScriptCompleted,
          keypoints: st.data?.keypoints || '',
          link: st.data?.link || '',
          reference_videos_list: st.data?.reference_videos_list || []
        };
      } else if (videoNum === 1) {
        // Priority 3: legacy ref_concept / ref_script fields
        isScriptCompleted = Boolean(metadata.script_shared || record.reference_video_received || record.ref_script || ((record.current_step || 0) >= 3));
        scriptData = {
          concept: record.ref_concept || metadata.concept || '',
          hooks: metadata.videos?.[1]?.steps?.share_script?.data?.hooks || metadata.hooks || '',
          script: record.ref_script || metadata.script || '',
          voice_record: metadata.videos?.[1]?.steps?.share_script?.data?.voice_record || metadata.voice_record || null,
          script_shared: isScriptCompleted,
          keypoints: record.ref_keypoints || metadata.keypoints || '',
          link: record.ref_link || metadata.link || '',
          reference_videos_list: record.reference_videos_list || []
        };
      } else {
        isScriptCompleted = false;
        scriptData = {
          concept: '',
          hooks: '',
          script: '',
          voice_record: null,
          script_shared: false,
          keypoints: '',
          link: '',
          reference_videos_list: []
        };
      }

      steps[cfg.id] = {
        completed: isScriptCompleted,
        data: scriptData
      };
      return;
    }

    // If structured in metadata.videos, use that
    if (storedVideo?.steps?.[cfg.id]) {
      const st = storedVideo.steps[cfg.id];
      if (cfg.id === 'timeline') {
        const isReUpload = st.data?.is_re_upload_timeline === true || !!st.data?.re_draft_submit_date;
        const isOver = st.data?.manualOverride === true;
        const effDate = isReUpload 
          ? (st.data?.date || st.data?.re_draft_submit_date || '') 
          : (isOver ? (st.data?.date || '') : (scheduledDraftDate || st.data?.date || (videoNum === 1 ? (record.draft_expected_date || '') : '')));
        steps[cfg.id] = {
          ...st,
          completed: isReUpload ? (st.data?.re_upload_status === 'Completed') : st.completed,
          data: {
            ...st.data,
            date: effDate,
            scheduled_draft_date: scheduledDraftDate,
            is_re_upload_timeline: isReUpload,
            re_upload_status: st.data?.re_upload_status || (isReUpload ? 'Scheduled' : 'Completed'),
            manualOverride: isOver,
            history: Array.isArray(st.data?.history) ? st.data.history : []
          }
        };
      } else if (cfg.id === 'draft') {
        const draftData = st.data || {};
        const attempts: DraftAttempt[] = Array.isArray(draftData.attempts) ? [...draftData.attempts] : [];
        
        // Backward compatibility if attempts is empty but draft video was stored
        if (attempts.length === 0 && (draftData.vid || draftData.video_url || (videoNum === 1 && record.draft_video_url))) {
          const legacyVid = draftData.vid || draftData.video_url || record.draft_video_url || '';
          const legacyApp = draftData.appStat || draftData.approval_status || record.draft_approval_status || (st.completed ? 'Approved' : '');
          attempts.push({
            attempt_number: 1,
            video_url: legacyVid,
            approval_status: legacyApp === 'Approved' ? 'Approved' : (legacyApp === 'Not Approved' ? 'Not Approved' : 'Pending Approval'),
            timing_status: draftData.timing || record.draft_timing_status || '',
            corrections: draftData.corr || record.draft_corrections_required || '',
            final_product_link: draftData.finalL || record.draft_final_product_link || '',
            final_description: draftData.finalD || record.draft_final_description || '',
            uploaded_at: st.updated_at || record.created_at || new Date().toISOString(),
            reviewed_at: st.updated_at,
            reviewed_by: 'Admin'
          });
        }

        const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
        const activeApprovalStatus = latestAttempt ? latestAttempt.approval_status : (draftData.approval_status || (st.completed ? 'Approved' : ''));
        const isApproved = activeApprovalStatus === 'Approved';

        steps[cfg.id] = {
          ...st,
          completed: isApproved, // STRICTLY ONLY COMPLETED IF APPROVED
          data: {
            ...draftData,
            attempts,
            active_attempt_number: latestAttempt?.attempt_number || 1,
            approval_status: activeApprovalStatus,
            vid: latestAttempt?.video_url || draftData.vid || '',
            timing: latestAttempt?.timing_status || draftData.timing || '',
            corr: latestAttempt?.corrections || draftData.corr || '',
            finalL: latestAttempt?.final_product_link || draftData.finalL || '',
            finalD: latestAttempt?.final_description || draftData.finalD || ''
          }
        };
      } else if (cfg.id === 'post_date') {
        const postData = st.data || {};
        const timelineDate = storedVideo?.steps?.timeline?.data?.date;
        const derivedFromTimeline = timelineDate ? calculatePostDateFromDraft(timelineDate, 2026) : '';
        const isPostOver = postData.manualOverride === true;
        const effPostDate = isPostOver 
          ? (postData.scheduled_post_date || scheduledPostDate || '') 
          : (scheduledPostDate || postData.scheduled_post_date || derivedFromTimeline || '');
        steps[cfg.id] = {
          ...st,
          data: {
            ...postData,
            scheduled_post_date: effPostDate,
            history: Array.isArray(postData.history) ? postData.history : []
          }
        };
      } else if (cfg.id === 'pay_advance') {
        const v1Price = getInfluencerVideoPrice(record.influencer, 1);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === 1 && vp.payment_type === 'advance');
        const isPaid = videoPayment ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) : st.completed;
        steps[cfg.id] = {
          ...st,
          completed: isPaid,
          data: {
            ...st.data,
            gpay: videoPayment?.transaction_reference || st.data?.gpay || record.advance_gpay_number || '',
            total: (videoPayment?.agreed_amount != null ? String(videoPayment.agreed_amount) : (st.data?.total || (v1Price !== null ? String(v1Price) : (record.advance_total_amount || '')))),
            advance: (videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (st.data?.advance || record.advance_paid_amount || '')),
            photo: videoPayment?.payment_proof_url || st.data?.photo || record.pay_advance_photo_url || '',
            payment_status: videoPayment?.payment_status || (isPaid ? 'paid' : 'pending'),
            payment_method: videoPayment?.payment_method || st.data?.payment_method || '',
            payment_record: videoPayment
          }
        };
      } else if (cfg.id === 'payment') {
        const vPrice = getInfluencerVideoPrice(record.influencer, videoNum);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === videoNum && vp.payment_type === 'final');
        const isPaid = videoPayment ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) : st.completed;
        steps[cfg.id] = {
          ...st,
          completed: isPaid,
          data: {
            ...st.data,
            amount: (videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (st.data?.amount || (vPrice !== null ? String(vPrice) : ''))),
            gpay: videoPayment?.transaction_reference || st.data?.gpay || '',
            photo: videoPayment?.payment_proof_url || st.data?.photo || '',
            payment_status: videoPayment?.payment_status || (isPaid ? 'paid' : 'pending'),
            payment_completed: isPaid,
            payment_method: videoPayment?.payment_method || st.data?.payment_method || '',
            payment_record: videoPayment
          }
        };
      } else {
        steps[cfg.id] = st;
      }
      return;
    }

    // Otherwise, backward compatibility with legacy columns / metadata
    let completed = false;
    let data: any = {};

    if (videoNum === 1) {
      if (cfg.id === 'call_explain') {
        completed = !!metadata.call_explained || (!!record.ref_call_explanation_required && !metadata.call_explanation_pending) || ((record.current_step || 0) >= 2 && !metadata.call_explanation_pending);
        data = {
          call_explained: completed,
          phone_called: metadata.phone_called || record.dispatch?.phone_number || '',
          call_datetime: metadata.call_datetime || '',
          call_notes: metadata.call_notes || ''
        };
      } else if (cfg.id === 'share_script') {
        completed = !!metadata.script_shared || !!record.reference_video_received || !!record.ref_script || ((record.current_step || 0) >= 3);
        data = {
          script_shared: completed,
          concept: record.ref_concept || metadata.concept || '',
          hooks: metadata.videos?.[1]?.steps?.share_script?.data?.hooks || metadata.hooks || '',
          script: record.ref_script || metadata.script || '',
          voice_record: metadata.videos?.[1]?.steps?.share_script?.data?.voice_record || metadata.voice_record || null,
          keypoints: record.ref_keypoints || metadata.keypoints || '',
          link: record.ref_link || metadata.link || '',
          reference_videos_list: record.reference_videos_list || []
        };
      } else if (cfg.id === 'pay_advance') {
        const v1Price = getInfluencerVideoPrice(record.influencer, 1);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === 1 && vp.payment_type === 'advance');
        completed = videoPayment 
          ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0)
          : (!!record.pay_advance_completed || (parseFloat(record.advance_paid_amount || '0') > 0));
        data = {
          gpay: videoPayment?.transaction_reference || record.advance_gpay_number || '',
          total: videoPayment?.agreed_amount != null ? String(videoPayment.agreed_amount) : (record.advance_total_amount || (v1Price !== null ? String(v1Price) : '')),
          advance: videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (record.advance_paid_amount || ''),
          photo: videoPayment?.payment_proof_url || record.pay_advance_photo_url || '',
          payment_status: videoPayment?.payment_status || (completed ? 'paid' : 'pending'),
          payment_method: videoPayment?.payment_method || '',
          payment_record: videoPayment
        };
      } else if (cfg.id === 'timeline') {
        completed = !!record.expected_delivery_completed || (!!record.draft_expected_date && !!record.draft_expected_time);
        data = {
          date: scheduledDraftDate || record.draft_expected_date || '',
          time: record.draft_expected_time || '',
          manualOverride: false,
          history: []
        };
      } else if (cfg.id === 'draft') {
        const legacyVid = record.draft_video_url || '';
        const legacyApp = record.draft_approval_status || '';
        const isApproved = legacyApp === 'Approved';
        const attempts: DraftAttempt[] = [];
        if (legacyVid) {
          attempts.push({
            attempt_number: 1,
            video_url: legacyVid,
            approval_status: isApproved ? 'Approved' : (legacyApp === 'Not Approved' ? 'Not Approved' : 'Pending Approval'),
            timing_status: record.draft_timing_status || '',
            corrections: record.draft_corrections_required || '',
            final_product_link: record.draft_final_product_link || '',
            final_description: record.draft_final_description || '',
            uploaded_at: record.created_at || new Date().toISOString()
          });
        }
        completed = isApproved;
        data = {
          vid: legacyVid,
          appStat: legacyApp,
          timing: record.draft_timing_status || '',
          corr: record.draft_corrections_required || '',
          finalL: record.draft_final_product_link || '',
          finalD: record.draft_final_description || '',
          attempts,
          active_attempt_number: 1,
          approval_status: legacyApp
        };
      } else if (cfg.id === 'post_date') {
        completed = !!record.final_post_completed || (!!record.final_post_link && !isFakeUrl(record.final_post_link)) || !!metadata.video1_confirmed;
        data = {
          scheduled_post_date: scheduledPostDate || '',
          history: [],
          link: record.final_post_link || metadata.video1_final_post_link || '',
          postedAt: record.final_post_actual_datetime || metadata.video1_posted_at || '',
          platform: metadata.video1_platform || 'Instagram',
          confirmed: completed
        };
      }
    } else {
      if (cfg.id === 'timeline') {
        data = {
          date: scheduledDraftDate || '',
          time: '',
          manualOverride: false,
          history: []
        };
      } else if (cfg.id === 'draft') {
        data = {
          vid: '',
          appStat: '',
          timing: 'Not Submit',
          corr: '',
          finalL: '',
          finalD: '',
          attempts: [],
          active_attempt_number: 1,
          approval_status: ''
        };
      } else if (cfg.id === 'post_date') {
        if (videoNum === 2 && metadata.video2_final_post_link && !isFakeUrl(metadata.video2_final_post_link)) {
          completed = !!metadata.video2_confirmed;
        }
        data = {
          scheduled_post_date: scheduledPostDate || '',
          history: [],
          link: (videoNum === 2 ? metadata.video2_final_post_link : '') || '',
          postedAt: (videoNum === 2 ? metadata.video2_posted_at : '') || '',
          platform: (videoNum === 2 ? metadata.video2_platform : 'Instagram') || 'Instagram',
          confirmed: completed
        };
      } else if (cfg.id === 'payment') {
        const vPrice = getInfluencerVideoPrice(record.influencer, videoNum);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === videoNum && vp.payment_type === 'final');
        completed = videoPayment ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) : false;
        data = {
          amount: videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (vPrice !== null ? String(vPrice) : ''),
          gpay: videoPayment?.transaction_reference || '',
          photo: videoPayment?.payment_proof_url || '',
          payment_status: videoPayment?.payment_status || (completed ? 'paid' : 'pending'),
          payment_completed: completed,
          payment_method: videoPayment?.payment_method || '',
          payment_record: videoPayment
        };
      }
    }

    steps[cfg.id] = { completed, data };
  });

  const draftStep = steps['draft'];
  const draftApprovalStatus = draftStep?.data?.approval_status || '';
  const isReDraftRequired = draftApprovalStatus === 'Not Approved';
  const draftStatus = isReDraftRequired 
    ? 'Not Approved' 
    : (draftStep?.completed ? 'Approved' : (draftStep?.data?.vid ? 'Pending Approval' : 'Not Started'));

  const completedCount = configs.filter(c => steps[c.id]?.completed).length;
  const totalSteps = configs.length;

  let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
  if (completedCount === totalSteps) {
    status = 'COMPLETED';
  } else if (completedCount > 0 || isReDraftRequired) {
    status = 'IN_PROGRESS';
  }

  // Active step calculation:
  // If Re-Draft is required, active step MUST remain 'draft'
  let activeStepId = configs[0].id;
  if (isReDraftRequired) {
    activeStepId = 'draft';
  } else {
    const firstIncomplete = configs.find(c => !steps[c.id]?.completed);
    activeStepId = firstIncomplete ? firstIncomplete.id : configs[configs.length - 1].id;
  }

  return {
    videoNumber: videoNum,
    configs,
    steps,
    completedCount,
    totalSteps,
    status,
    activeStepId,
    isReDraftRequired,
    draftStatus
  };
};

export const CampaignStatusTracking: React.FC<CampaignStatusTrackingProps> = ({ campaign, onBack }) => {
  const { 
    trackingRecords, 
    isLoading, 
    refresh, 
    saveMilestone,
    clearAllStatusTracking,
    deleteStatusTrackingRecord
  } = useCampaignStatusTracking(campaign.id);

  const [searchParams, setSearchParams] = useSearchParams();

  // Scroll Container & State Persistence Refs
  const listScrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);
  const lastOpenedRecordIdRef = useRef<string | null>(null);

  // Clear All & Single Delete Confirmation States
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<StatusTrackingRecord | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Advanced Filter Drawer State (persisted per campaign across navigation & refreshes)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<StatusTrackingFilterState>(() => {
    try {
      const saved = sessionStorage.getItem(`st_filters_${campaign.id}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return initialStatusTrackingFilterState;
  });

  // Search input state (persisted per campaign across navigation & refreshes)
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return sessionStorage.getItem(`st_search_${campaign.id}`) || '';
  });

  // Persist filters and search query
  useEffect(() => {
    try {
      sessionStorage.setItem(`st_filters_${campaign.id}`, JSON.stringify(activeFilters));
    } catch (e) {}
  }, [activeFilters, campaign.id]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`st_search_${campaign.id}`, searchQuery);
    } catch (e) {}
  }, [searchQuery, campaign.id]);

  // Active filter count calculation (total individual criteria selected)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += activeFilters.videos.length;
    count += activeFilters.languages.length;
    count += activeFilters.priceRanges.length;
    count += activeFilters.categories.length;
    count += activeFilters.workflowStatuses.length;
    count += activeFilters.platforms.length;
    count += activeFilters.deliveryStatuses.length;
    return count;
  }, [activeFilters]);

  // Modals & Menu State
  const [activeModal, setActiveModal] = useState<{ recordId: string; stageId: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailsRecord, setDetailsRecord] = useState<StatusTrackingRecord | null>(null);

  // LEVEL 2 VIEW STATE: null = Main List View; object = Video Detail View
  // Initialized from URL query params (stInfluencer, stVideo)
  const [selectedVideo, setSelectedVideo] = useState<{ recordId: string; videoNumber: number } | null>(() => {
    const stInf = searchParams.get('stInfluencer');
    const stVid = searchParams.get('stVideo');
    if (stInf) {
      return { recordId: stInf, videoNumber: parseInt(stVid || '1', 10) || 1 };
    }
    return null;
  });

  // Synchronize selectedVideo with URL query parameters (e.g. browser back/forward or direct refresh)
  useEffect(() => {
    const stInf = searchParams.get('stInfluencer');
    const stVid = searchParams.get('stVideo');
    if (stInf) {
      const vNum = parseInt(stVid || '1', 10) || 1;
      setSelectedVideo(prev => {
        if (prev?.recordId === stInf && prev?.videoNumber === vNum) return prev;
        return { recordId: stInf, videoNumber: vNum };
      });
    } else {
      setSelectedVideo(null);
    }
  }, [searchParams]);

  // Navigation handlers for detail view and list view
  const handleOpenVideo = useCallback((record: StatusTrackingRecord, videoNumber: number) => {
    if (listScrollContainerRef.current) {
      const currentScroll = listScrollContainerRef.current.scrollTop;
      savedScrollTopRef.current = currentScroll;
      sessionStorage.setItem(`st_scroll_${campaign.id}`, String(currentScroll));
    }
    const recId = record.id;
    lastOpenedRecordIdRef.current = recId;
    sessionStorage.setItem(`st_last_record_${campaign.id}`, recId);

    const influencerIdentifier = record.dispatch?.influencer_code || record.id;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('stInfluencer', influencerIdentifier);
      next.set('stVideo', String(videoNumber));
      return next;
    });
    setSelectedVideo({ recordId: record.id, videoNumber });
  }, [campaign.id, setSearchParams]);

  const handleBackFromDetail = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('stInfluencer');
      next.delete('stVideo');
      return next;
    });
    setSelectedVideo(null);
  }, [setSearchParams]);

  const handleSwitchVideo = useCallback((recordId: string, videoNumber: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('stVideo', String(videoNumber));
      return next;
    });
    setSelectedVideo(prev => prev ? { ...prev, videoNumber } : { recordId, videoNumber });
  }, [setSearchParams]);

  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    savedScrollTopRef.current = top;
    sessionStorage.setItem(`st_scroll_${campaign.id}`, String(top));
  }, [campaign.id]);

  // Scroll restoration: when returning to list view, smoothly restore exact scroll position
  useEffect(() => {
    if (!selectedVideo && !isLoading && listScrollContainerRef.current) {
      const savedPos = savedScrollTopRef.current || Number(sessionStorage.getItem(`st_scroll_${campaign.id}`) || '0');
      if (savedPos > 0) {
        listScrollContainerRef.current.scrollTop = savedPos;
        const raf = requestAnimationFrame(() => {
          if (listScrollContainerRef.current) {
            listScrollContainerRef.current.scrollTop = savedPos;
          }
        });
        return () => cancelAnimationFrame(raf);
      } else {
        const lastRecordId = lastOpenedRecordIdRef.current || sessionStorage.getItem(`st_last_record_${campaign.id}`);
        if (lastRecordId) {
          const el = document.getElementById(`st-card-${lastRecordId}`);
          if (el) {
            el.scrollIntoView({ block: 'nearest' });
          }
        }
      }
    }
  }, [selectedVideo, isLoading, campaign.id]);

  // Close menus on click outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.three-dot-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Filter out archived & naturally sort by Influencer Code
  const activeTrackingRecords = useMemo(() => {
    const list = (trackingRecords || []).filter(r => isActiveStatus(r.dispatch?.is_archived));
    return list.sort((a, b) => {
      return naturalCompareCodes(
        a.dispatch?.influencer_code || a.influencer_id,
        b.dispatch?.influencer_code || b.influencer_id
      );
    });
  }, [trackingRecords]);

  // Derive Overall Status Badge for each influencer
  const getOverallStatus = (record: StatusTrackingRecord) => {
    let metadata: any = {};
    try {
      metadata = JSON.parse(record.notes || '{}');
    } catch (e) {
      metadata = {};
    }

    const rawStatus = (record.status || '').toLowerCase();

    // Re-Dispatch Required: if shipment issue reported or re-dispatch required
    if (
      rawStatus.includes('re-dispatch') ||
      rawStatus.includes('redispatch') ||
      metadata.re_dispatch_required ||
      metadata.shipment_issue ||
      metadata.issue_reported
    ) {
      return {
        key: 'RE_DISPATCH_REQUIRED',
        label: 'Re-Dispatch Required',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/60',
        dotClass: 'bg-amber-400'
      };
    }

    // On Hold
    if (rawStatus === 'on_hold' || rawStatus === 'on hold' || metadata.on_hold) {
      return {
        key: 'ON_HOLD',
        label: 'On Hold',
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
        dotClass: 'bg-slate-400'
      };
    }

    // Not Started: if delivery is not confirmed yet
    if (!isDeliveryStepCompleted(record)) {
      return {
        key: 'NOT_STARTED',
        label: 'Not Started',
        badgeClass: 'bg-slate-900 text-slate-400 border-slate-800',
        dotClass: 'bg-slate-500'
      };
    }

    // Check all 6 videos status
    const v1 = getVideoWorkflow(record, 1);
    const v2 = getVideoWorkflow(record, 2);
    const v3 = getVideoWorkflow(record, 3);
    const v4 = getVideoWorkflow(record, 4);
    const v5 = getVideoWorkflow(record, 5);
    const v6 = getVideoWorkflow(record, 6);

    const allVideos = [v1, v2, v3, v4, v5, v6];
    const allCompleted = allVideos.every(v => v.status === 'COMPLETED');

    if (allCompleted) {
      return {
        key: 'COMPLETED',
        label: 'Completed',
        badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
        dotClass: 'bg-emerald-400'
      };
    }

    const anyInProgressOrCompleted = allVideos.some(v => v.status === 'COMPLETED' || v.status === 'IN_PROGRESS');

    if (anyInProgressOrCompleted) {
      return {
        key: 'IN_PROGRESS',
        label: 'In Progress',
        badgeClass: 'bg-blue-950/80 text-blue-400 border-blue-700/60',
        dotClass: 'bg-blue-400'
      };
    }

    // If delivered but videos not started
    return {
      key: 'IN_PROGRESS',
      label: 'Delivery Confirmed',
      badgeClass: 'bg-indigo-950/80 text-indigo-400 border-indigo-700/60',
      dotClass: 'bg-indigo-400'
    };
  };

  // DYNAMIC FILTER OPTIONS POPULATED FROM LOADED CAMPAIGN INFLUENCER DATA
  // 1. Available videos based on campaign influencer data
  const availableFilterVideos = useMemo(() => {
    let maxV = 1;
    activeTrackingRecords.forEach(r => {
      const vids = getInfluencerAssignedVideos(r);
      const m = Math.max(...vids, 1);
      if (m > maxV) maxV = m;
    });
    return Array.from({ length: maxV }, (_, i) => i + 1);
  }, [activeTrackingRecords]);

  // 2. Available languages dynamically deduplicated
  const availableFilterLanguages = useMemo(() => {
    const allLangs = activeTrackingRecords.flatMap(r => r.dispatch?.languages || []);
    return getUniqueFilterOptions(allLangs);
  }, [activeTrackingRecords]);

  // 3. Available categories dynamically extracted
  const availableFilterCategories = useMemo(() => {
    const allCats = activeTrackingRecords.flatMap(r => getInfluencerCategories(r));
    return getUniqueFilterOptions(allCats);
  }, [activeTrackingRecords]);

  // 4. Available platforms & combinations dynamically extracted
  const availableFilterPlatforms = useMemo(() => {
    const plats = new Set<string>();
    activeTrackingRecords.forEach(r => {
      const pList = (r.dispatch?.platforms || []).map((p: string) => p.trim()).filter(Boolean);
      pList.forEach(p => plats.add(p));
      if (pList.length > 1) {
        plats.add(pList.slice().sort().join(' + '));
      }
    });
    return getUniqueFilterOptions(Array.from(plats));
  }, [activeTrackingRecords]);

  // 5. Available delivery statuses dynamically extracted
  const availableFilterDeliveryStatuses = useMemo(() => {
    const statuses = new Set<string>();
    activeTrackingRecords.forEach(r => {
      statuses.add(getInfluencerDeliveryStatus(r));
    });
    return Array.from(statuses);
  }, [activeTrackingRecords]);

  // Filtered influencers based on user selections across 7 sections + search
  const filteredRecords = useMemo(() => {
    return activeTrackingRecords.filter(record => {
      const dispatch = record.dispatch || ({} as any);

      // 1. Video filter (OR within section)
      if (activeFilters.videos.length > 0) {
        const assignedVideos = getInfluencerAssignedVideos(record);
        const matchesVideo = activeFilters.videos.some(v => assignedVideos.includes(v));
        if (!matchesVideo) return false;
      }

      // 2. Language filter (OR within section)
      if (activeFilters.languages.length > 0) {
        const recordLangs = dispatch.languages || [];
        const matchesLanguage = activeFilters.languages.some(filterLang => 
          recordLangs.some((recLang: string) => areFilterValuesEqual(recLang, filterLang))
        );
        if (!matchesLanguage) return false;
      }

      // 3. Price filter (OR within section)
      if (activeFilters.priceRanges.length > 0) {
        const price = getInfluencerCampaignTotalPrice(record.influencer, record.pricing);
        if (price === null || isNaN(price)) {
          return false;
        }
        const matchesPrice = activeFilters.priceRanges.some(rangeId => {
          const range = STATUS_TRACKING_PRICE_RANGES.find(r => r.id === rangeId);
          if (!range) return false;
          return price >= range.min && price <= range.max;
        });
        if (!matchesPrice) return false;
      }

      // 4. Category filter (OR within section)
      if (activeFilters.categories.length > 0) {
        const recordCategories = getInfluencerCategories(record);
        const matchesCategory = activeFilters.categories.some(filterCat =>
          recordCategories.some(recCat => areFilterValuesEqual(recCat, filterCat))
        );
        if (!matchesCategory) return false;
      }

      // 5. Workflow status filter (OR within section)
      if (activeFilters.workflowStatuses.length > 0) {
        const overallStatus = getOverallStatus(record);
        let statusLabel = overallStatus.label;
        if (statusLabel === 'Delivery Confirmed') {
          statusLabel = 'In Progress';
        }
        const matchesStatus = activeFilters.workflowStatuses.some(st => 
          areFilterValuesEqual(st, statusLabel) || areFilterValuesEqual(st, overallStatus.key)
        );
        if (!matchesStatus) return false;
      }

      // 6. Platform filter (OR within section)
      if (activeFilters.platforms.length > 0) {
        const platforms = (dispatch.platforms || []).map((p: string) => p.trim());
        const combo = platforms.slice().sort().join(' + ');
        
        const matchesPlatform = activeFilters.platforms.some(filterPlat => {
          if (areFilterValuesEqual(filterPlat, combo)) return true;
          return platforms.some((p: string) => areFilterValuesEqual(p, filterPlat));
        });
        if (!matchesPlatform) return false;
      }

      // 7. Delivery status filter (OR within section)
      if (activeFilters.deliveryStatuses.length > 0) {
        const delStatus = getInfluencerDeliveryStatus(record);
        const matchesDelivery = activeFilters.deliveryStatuses.some(st => 
          areFilterValuesEqual(st, delStatus)
        );
        if (!matchesDelivery) return false;
      }

      // 8. Search query (AND with all filters)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (dispatch.influencer_name || '').toLowerCase();
        const code = (dispatch.influencer_code || String(record.influencer_id)).toLowerCase();
        const username = (dispatch.username || '').toLowerCase();
        const phone = (dispatch.phone_number || '').toLowerCase();
        const tracking = (dispatch.tracking_id || '').toLowerCase();
        const matches = name.includes(q) || code.includes(q) || username.includes(q) || phone.includes(q) || tracking.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [activeTrackingRecords, activeFilters, searchQuery]);

  // Overall KPI Counts based on unique filtered influencers
  const kpiCounts = useMemo(() => {
    const total = filteredRecords.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let onHold = 0;
    let reDispatch = 0;
    let notStarted = 0;

    filteredRecords.forEach(r => {
      const status = getOverallStatus(r);
      if (status.key === 'COMPLETED') completed++;
      else if (status.key === 'IN_PROGRESS') inProgress++;
      else if (status.key === 'PENDING') pending++;
      else if (status.key === 'ON_HOLD') onHold++;
      else if (status.key === 'RE_DISPATCH_REQUIRED') reDispatch++;
      else if (status.key === 'NOT_STARTED') notStarted++;
    });

    const calcPct = (cnt: number) => total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      completed,
      completedPct: calcPct(completed),
      inProgress,
      inProgressPct: calcPct(inProgress),
      pending,
      pendingPct: calcPct(pending),
      onHold,
      onHoldPct: calcPct(onHold),
      reDispatch,
      reDispatchPct: calcPct(reDispatch),
      notStarted,
      notStartedPct: calcPct(notStarted)
    };
  }, [filteredRecords]);

  // Active filter chip removal handlers
  const removeFilterVideo = (vNum: number) => {
    setActiveFilters(prev => ({
      ...prev,
      videos: prev.videos.filter(v => v !== vNum)
    }));
  };

  const removeFilterLanguage = (lang: string) => {
    setActiveFilters(prev => ({
      ...prev,
      languages: prev.languages.filter(l => !areFilterValuesEqual(l, lang))
    }));
  };

  const removeFilterPriceRange = (rangeId: string) => {
    setActiveFilters(prev => ({
      ...prev,
      priceRanges: prev.priceRanges.filter(id => id !== rangeId)
    }));
  };

  const removeFilterCategory = (cat: string) => {
    setActiveFilters(prev => ({
      ...prev,
      categories: prev.categories.filter(c => !areFilterValuesEqual(c, cat))
    }));
  };

  const removeFilterWorkflowStatus = (status: string) => {
    setActiveFilters(prev => ({
      ...prev,
      workflowStatuses: prev.workflowStatuses.filter(s => !areFilterValuesEqual(s, status))
    }));
  };

  const removeFilterPlatform = (plat: string) => {
    setActiveFilters(prev => ({
      ...prev,
      platforms: prev.platforms.filter(p => !areFilterValuesEqual(p, plat))
    }));
  };

  const removeFilterDeliveryStatus = (delStatus: string) => {
    setActiveFilters(prev => ({
      ...prev,
      deliveryStatuses: prev.deliveryStatuses.filter(d => !areFilterValuesEqual(d, delStatus))
    }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters(initialStatusTrackingFilterState);
    setSearchQuery('');
  };

  // Clear All Status Tracking Records for Current Campaign
  const handleConfirmClearAll = async () => {
    if (isClearing) return;
    setIsClearing(true);
    const toastId = toast.loading('Clearing all Status Tracking records...');

    try {
      const res = await clearAllStatusTracking();
      if (!res.success) {
        toast.error(`Failed to clear Status Tracking: ${res.error || 'Unknown error'}`, { id: toastId });
      } else {
        // Reset search/filter states
        handleClearAllFilters();

        toast.success('All Status Tracking records cleared successfully.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Clear all status tracking error:', err);
      toast.error(`Failed to clear Status Tracking: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setIsClearing(false);
      setIsClearModalOpen(false);
    }
  };

  // Remove Single Influencer from Status Tracking
  const handleConfirmDeleteSingle = async () => {
    if (!recordToDelete || isDeletingSingle) return;
    setIsDeletingSingle(true);
    const toastId = toast.loading('Removing influencer from Status Tracking...');

    try {
      const res = await deleteStatusTrackingRecord(recordToDelete.id);
      if (!res.success) {
        toast.error(`Failed to remove: ${res.error || 'Unknown error'}`, { id: toastId });
      } else {
        toast.success('Influencer removed from Status Tracking successfully.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Delete single status record error:', err);
      toast.error(`Failed to remove: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setIsDeletingSingle(false);
      setRecordToDelete(null);
    }
  };

  // Milestone Save Handler for Top-Level Delivery & Modals (Step 1 Delivery Confirmation or Re-Dispatch Issue)
  const handleDeliverySave = async (recordId: string, data: any) => {
    const record = activeTrackingRecords.find(r => r.id === recordId) || trackingRecords.find(r => r.id === recordId);
    if (!record) return;

    const toastId = toast.loading('Saving delivery status...');

    try {
      // Ensure we have an active shipment attempt for this influencer
      let attemptId = data.attempt_id;
      if (!attemptId) {
        const latest = await shipmentAttemptService.getLatestShipmentAttempt(record.campaign_id, record.influencer_id);
        if (latest) {
          attemptId = latest.id;
        } else {
          const initial = await shipmentAttemptService.createInitialShipmentAttempt({
            campaign_id: record.campaign_id,
            influencer_id: record.influencer_id,
            influencer_code: record.dispatch?.influencer_code || record.influencer_id,
            courier: record.dispatch?.courier_partner,
            awb_number: record.dispatch?.tracking_id,
            order_id: (record.dispatch as any)?.order_id
          });
          if (initial) attemptId = initial.id;
        }
      }

      let metadata: any = {};
      try {
        metadata = JSON.parse(record.notes || '{}');
      } catch (e) {
        metadata = {};
      }

      if (data.option === 'PRODUCT_ISSUE') {
        if (!data.issue_type) {
          toast.error('Please select an issue type.', { id: toastId });
          return;
        }

        if (attemptId) {
          await shipmentAttemptService.reportShipmentIssue(attemptId, {
            issue_type: data.issue_type,
            issue_remarks: data.issue_remarks,
            issue_proof_url: data.issue_proof_url
          });
        }

        metadata.last_updated = new Date().toISOString();
        metadata.issue_reported = true;
        metadata.issue_type = data.issue_type;
        metadata.issue_remarks = data.issue_remarks || '';
        metadata.issue_proof_url = data.issue_proof_url || '';
        metadata.re_dispatch_required = true;
        metadata.delivered_confirmed = false;

        const updates: Partial<StatusTrackingRecord> = {
          delivered_confirmed: false,
          current_step: 0,
          status: 'Re-Dispatch Required',
          notes: JSON.stringify(metadata)
        };

        const result = await saveMilestone(recordId, updates);
        if (result.success) {
          toast.success('Shipment issue reported. Influencer moved to Re-Dispatch in Logistics.', { id: toastId });
          await refresh();
          setActiveModal(null);
        } else {
          toast.error('Failed to report issue: ' + (result.error?.message || 'Unknown error'), { id: toastId });
        }
      } else {
        // Option A: NO_ISSUE (Standard delivery confirmation)
        if (!data.delivered_confirmed || !data.delivery_photo_url || !String(data.delivery_photo_url).trim()) {
          toast.error('Please confirm delivery and upload the delivery proof photo before completing Step 1.', { id: toastId });
          return;
        }

        if (attemptId) {
          await shipmentAttemptService.confirmShipmentDelivery(attemptId, data.delivery_photo_url);
        }

        metadata.last_updated = new Date().toISOString();
        metadata.delivered_confirmed = true;
        metadata.delivery_photo_url = data.delivery_photo_url;
        delete metadata.re_dispatch_required;
        delete metadata.issue_reported;
        delete metadata.issue_type;
        delete metadata.issue_remarks;
        delete metadata.issue_proof_url;

        const updates: Partial<StatusTrackingRecord> = {
          delivered_confirmed: true,
          delivery_photo_url: data.delivery_photo_url,
          current_step: Math.max(record.current_step || 0, 1),
          status: 'Active',
          notes: JSON.stringify(metadata)
        };

        const result = await saveMilestone(recordId, updates);
        if (result.success) {
          toast.success('Delivery confirmation saved successfully.', { id: toastId });
          await refresh();
          setActiveModal(null);
        } else {
          toast.error('Failed to save delivery: ' + (result.error?.message || 'Unknown error'), { id: toastId });
        }
      }
    } catch (err: any) {
      console.error('handleDeliverySave error:', err);
      toast.error('Failed to save delivery status: ' + (err?.message || String(err)), { id: toastId });
    }
  };

  // Dedicated Save Handler for Video Steps (Persists independently inside notes.videos)
  const handleSaveVideoStep = async (
    recordId: string, 
    videoNumber: number, 
    stepId: string, 
    stepData: any, 
    isStepCompleted: boolean
  ) => {
    const record = activeTrackingRecords.find(r => String(r.id) === String(recordId)) || trackingRecords.find(r => String(r.id) === String(recordId));
    if (!record) {
      console.error('handleSaveVideoStep: record not found for id', recordId);
      return { success: false, error: 'Tracking record not found' };
    }

    let metadata: any = {};
    try {
      metadata = JSON.parse(record.notes || '{}');
    } catch (e) {
      metadata = {};
    }

    if (!metadata.videos) metadata.videos = {};
    if (!metadata.videos[String(videoNumber)]) {
      metadata.videos[String(videoNumber)] = {
        video_number: videoNumber,
        steps: {}
      };
    }

    const videoObj = metadata.videos[String(videoNumber)];
    if (!videoObj.steps) videoObj.steps = {};

    const { suppressDefaultToast, ...cleanStepData } = stepData || {};

    videoObj.steps[stepId] = {
      completed: isStepCompleted,
      data: cleanStepData,
      updated_at: new Date().toISOString()
    };

    const updates: Partial<StatusTrackingRecord> = {};

    if (stepId === 'draft') {
      videoObj.is_re_draft_required = (stepData.approval_status === 'Not Approved');

      if (stepData.approval_status === 'Not Approved' && stepData.re_draft_submit_date) {
        // Automatically populate / update timeline step for Re-Upload
        if (!videoObj.steps.timeline) {
          videoObj.steps.timeline = { completed: false, data: {} };
        }
        const tlData = videoObj.steps.timeline.data || {};
        const prevTlDate = tlData.date;
        const newTlDate = stepData.re_draft_submit_date;
        const currentAttemptNum = stepData.active_attempt_number || 1;

        let tlHistory = Array.isArray(tlData.history) ? [...tlData.history] : [];
        if (prevTlDate && prevTlDate !== newTlDate) {
          tlHistory = [{
            id: `th-${Date.now()}`,
            old_date: formatDisplayDateLocal(prevTlDate),
            new_date: formatDisplayDateLocal(newTlDate),
            changed_by: stepData.reviewed_by || 'Admin',
            changed_at: new Date().toISOString(),
            reason: `Draft Attempt ${currentAttemptNum}`
          }, ...tlHistory];
        }

        // Entering the date sets progression to 'Scheduled', NOT completed yet
        videoObj.steps.timeline.completed = false;
        videoObj.steps.timeline.data = {
          ...tlData,
          date: newTlDate,
          re_draft_submit_date: newTlDate,
          is_re_upload_timeline: true,
          re_upload_status: 'Scheduled',
          source_attempt_number: currentAttemptNum,
          history: tlHistory
        };

        if (videoNumber === 1) {
          updates.re_draft_expected_date = newTlDate;
        }
      } else if (stepData.approval_status === 'Pending Approval' && videoObj.steps.timeline?.data?.is_re_upload_timeline) {
        videoObj.steps.timeline.data.re_upload_status = 'Submitted';
      } else if (stepData.approval_status === 'Approved' && videoObj.steps.timeline?.data?.is_re_upload_timeline) {
        videoObj.steps.timeline.completed = true;
        videoObj.steps.timeline.data.re_upload_status = 'Completed';
      }
    } else if (stepId === 'timeline') {
      if (stepData.is_re_upload_timeline && stepData.date && videoObj.steps.draft?.data) {
        videoObj.steps.draft.data.latest_re_draft_submit_date = stepData.date;
        if (videoNumber === 1) {
          updates.re_draft_expected_date = stepData.date;
        }
      }
    }

    // =========================================================================
    // AUTOMATIC DRAFT DATE -> POST DATE SYNC (+3 CALENDAR DAYS) & HISTORY
    // Business Rule: For every video, Post Date = Draft Date + 3 Calendar Days
    // =========================================================================
    let targetDraftDate: string | null = null;
    if (stepId === 'timeline' && cleanStepData?.date) {
      targetDraftDate = parseToYMD(cleanStepData.date, 2026) || cleanStepData.date;
    } else if (stepId === 'draft' && cleanStepData?.approval_status === 'Not Approved' && cleanStepData?.re_draft_submit_date) {
      targetDraftDate = parseToYMD(cleanStepData.re_draft_submit_date, 2026) || cleanStepData.re_draft_submit_date;
    }

    if (targetDraftDate) {
      const calculatedPostDate = calculatePostDateFromDraft(targetDraftDate, 2026);
      if (calculatedPostDate) {
        const postStep = videoObj.steps.post_date || { completed: false, data: {} };
        const postStepData = postStep.data || {};

        // Find previous post date strictly for this videoNumber
        let prevPostDate = postStepData.scheduled_post_date || '';
        if (!prevPostDate) {
          const scheduleEntry = (record.postDates || []).find((pd: any) => Number(pd.video_number) === Number(videoNumber));
          prevPostDate = scheduleEntry?.post_date || '';
        }
        if (!prevPostDate && Array.isArray((record.dispatch as any)?.languages)) {
          const matchViews = (record.dispatch as any).languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:'));
          if (matchViews) {
            try {
              const vJson = JSON.parse(matchViews.substring('views_data:'.length));
              const found = (vJson?.post_dates || []).find((pd: any) => Number(pd.video_number) === Number(videoNumber));
              if (found?.post_date) {
                prevPostDate = parseToYMD(found.post_date, 2026) || found.post_date;
              }
            } catch (e) {}
          }
        }
        const normalizedPrevPostDate = parseToYMD(prevPostDate, 2026) || prevPostDate;

        // ONLY record history and update if Post Date actually changed
        if (calculatedPostDate !== normalizedPrevPostDate) {
          const currentUserName = await getCurrentUserName();
          const prevDisplay = normalizedPrevPostDate ? formatDisplayDateLocal(normalizedPrevPostDate) : 'Not Scheduled';
          const newDisplay = formatDisplayDateLocal(calculatedPostDate);
          const postHistoryList: PostDateHistoryEntry[] = Array.isArray(postStepData.history) ? [...postStepData.history] : [];

          const autoHistoryEntry: PostDateHistoryEntry = {
            id: `pdh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            old_date: prevDisplay,
            new_date: newDisplay,
            changed_by: currentUserName || 'Admin',
            changed_at: new Date().toISOString(),
            reason: 'Automatically updated from Draft Date (+3 days)'
          };

          videoObj.steps.post_date = {
            ...postStep,
            completed: postStep.completed || false,
            data: {
              ...postStepData,
              scheduled_post_date: calculatedPostDate,
              history: [autoHistoryEntry, ...postHistoryList],
              is_modified: false // Auto-synced with Draft Date (+3 days)
            },
            updated_at: new Date().toISOString()
          };

          // Persist both post_date and draft_date to influencer_post_dates_rows & influencers_info_rows
          await syncInfluencerPostDate({
            influencerId: record.influencer_id,
            campaignId: record.campaign_id,
            videoNumber,
            newPostDate: calculatedPostDate,
            newDraftDate: targetDraftDate
          });

          // Log activity
          logActivity({
            department: 'Marketing',
            action: 'Post Date Auto-Synced',
            description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} Post Date auto-updated to ${newDisplay} from Draft Date ${formatDisplayDateLocal(targetDraftDate)} (+3 days)`,
            metadata: { 
              video_number: videoNumber, 
              draft_date: targetDraftDate, 
              post_date: calculatedPostDate, 
              old_post_date: normalizedPrevPostDate,
              reason: 'Automatically updated from Draft Date (+3 days)'
            }
          });
        }
      }
    }

    // Calculate video completion status
    const configs = videoNumber === 1 ? VIDEO_1_STEP_CONFIGS : VIDEO_N_STEP_CONFIGS;
    const completedStepsCount = configs.filter(c => videoObj.steps[c.id]?.completed).length;
    videoObj.completed_count = completedStepsCount;
    videoObj.status = completedStepsCount === configs.length ? 'COMPLETED' : ((completedStepsCount > 0 || videoObj.is_re_draft_required) ? 'IN_PROGRESS' : 'NOT_STARTED');

    metadata.last_updated = new Date().toISOString();
    updates.notes = JSON.stringify(metadata);

    // Handle dedicated Step 2: Share Script relational persistence
    if (stepId === 'share_script') {
      try {
        await upsertCampaignVideoScript({
          campaign_id: String(record.campaign_id),
          influencer_id: Number(record.influencer_id),
          video_number: Number(videoNumber),
          custom_concept: stepData.concept || null,
          hooks: stepData.hooks || null,
          proposed_script: stepData.script || null,
          voice_record_url: stepData.voice_record?.url || null,
          voice_record_file_name: stepData.voice_record?.file_name || null,
          voice_record_file_size: stepData.voice_record?.file_size_formatted || null,
          voice_record_storage_path: stepData.voice_record?.storage_path || null,
          script_shared_approved: isStepCompleted
        });
      } catch (err) {
        console.error(`Failed to persist video ${videoNumber} script record:`, err);
      }
    }

    // For Video 1, mirror corresponding legacy columns to maintain backward compatibility
    if (videoNumber === 1) {
      if (stepId === 'call_explain') {
        updates.ref_call_explanation_required = isStepCompleted;
        metadata.call_explained = isStepCompleted;
      } else if (stepId === 'share_script') {
        updates.reference_video_received = isStepCompleted;
        if (stepData.concept) updates.ref_concept = stepData.concept;
        if (stepData.script) updates.ref_script = stepData.script;
        metadata.script_shared = isStepCompleted;
      } else if (stepId === 'pay_advance') {
        updates.pay_advance_completed = isStepCompleted;
        if (stepData.gpay) updates.advance_gpay_number = stepData.gpay;
        if (stepData.total) updates.advance_total_amount = stepData.total;
        if (stepData.advance) updates.advance_paid_amount = stepData.advance;
        if (stepData.photo) updates.pay_advance_photo_url = stepData.photo;

        try {
          const v1Agreed = parseFloat(stepData.total) || getInfluencerVideoPrice(record.influencer, 1) || 0;
          const v1Paid = parseFloat(stepData.advance) || 0;
          await saveVideoPayment({
            campaignId: record.campaign_id,
            influencerId: record.influencer_id,
            videoNumber: 1,
            paymentType: 'advance',
            agreedAmount: v1Agreed,
            paidAmount: v1Paid,
            paymentStatus: isStepCompleted || v1Paid > 0 ? 'paid' : 'pending',
            paymentMethod: stepData.payment_method || (stepData.isAccount ? 'ACCOUNT_DETAILS' : 'UPI'),
            transactionReference: stepData.gpay || stepData.upi_id || stepData.upi_number || null,
            paymentProofUrl: stepData.photo || null,
            notes: stepData.notes || (stepData.account_number ? `Account: ${stepData.account_number}` : null),
          });
        } catch (err) {
          console.error('Failed to persist video 1 payment record:', err);
        }
      } else if (stepId === 'timeline') {
        updates.expected_delivery_completed = isStepCompleted;
        if (stepData.date) updates.draft_expected_date = stepData.date;
        if (stepData.time) updates.draft_expected_time = stepData.time;
      } else if (stepId === 'draft') {
        updates.draft_received = isStepCompleted;
        if (stepData.vid) updates.draft_video_url = stepData.vid;
        if (stepData.approval_status || stepData.appStat) updates.draft_approval_status = stepData.approval_status || stepData.appStat;
        if (stepData.timing) updates.draft_timing_status = stepData.timing;
        if (stepData.corr) updates.draft_corrections_required = stepData.corr;
        if (stepData.finalL) updates.draft_final_product_link = stepData.finalL;
        if (stepData.finalD) updates.draft_final_description = stepData.finalD;
      } else if (stepId === 'post_date') {
        updates.final_post_completed = isStepCompleted;
        if (stepData.link) updates.final_post_link = stepData.link;
        if (stepData.postedAt) updates.final_post_actual_datetime = stepData.postedAt;
      }
      updates.notes = JSON.stringify(metadata);
    } else if (stepId === 'payment') {
      try {
        const vAgreed = getInfluencerVideoPrice(record.influencer, videoNumber) || parseFloat(stepData.amount) || 0;
        const vPaid = parseFloat(stepData.amount) || 0;
        await saveVideoPayment({
          campaignId: record.campaign_id,
          influencerId: record.influencer_id,
          videoNumber: videoNumber,
          paymentType: 'final',
          agreedAmount: vAgreed,
          paidAmount: vPaid,
          paymentStatus: isStepCompleted || vPaid > 0 ? 'paid' : 'pending',
          paymentMethod: stepData.payment_method || (stepData.isAccount ? 'ACCOUNT_DETAILS' : 'UPI'),
          transactionReference: stepData.upi_number || stepData.gpay || null,
          paymentProofUrl: stepData.photo || null,
          notes: stepData.notes || (stepData.account_number ? `Account: ${stepData.account_number}` : null),
        });
      } catch (err) {
        console.error(`Failed to persist video ${videoNumber} payment record:`, err);
      }
    }

    const result = await saveMilestone(recordId, updates);
    if (result.success) {
      if (!stepData?.suppressDefaultToast) {
        toast.success(`Video ${videoNumber} step updated successfully!`);
      }
      if (stepId === 'share_script' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velmora:campaign-video-script-updated', {
          detail: {
            campaignId: record.campaign_id,
            influencerId: record.influencer_id,
            videoNumber
          }
        }));
      }
      await refresh();
      return { success: true };
    } else {
      toast.error('Failed to save step: ' + (result.error?.message || 'Unknown error'));
      return { success: false, error: result.error?.message };
    }
  };

  const handleToggleOnHold = async (record: StatusTrackingRecord) => {
    let metadata: any = {};
    try {
      metadata = JSON.parse(record.notes || '{}');
    } catch (e) {
      metadata = {};
    }
    const isCurrentlyOnHold = (record.status || '').toLowerCase() === 'on_hold' || !!metadata.on_hold;
    const newOnHold = !isCurrentlyOnHold;
    metadata.on_hold = newOnHold;
    const newStatus = newOnHold ? 'on_hold' : 'in_progress';

    const result = await saveMilestone(record.id, {
      status: newStatus,
      notes: JSON.stringify(metadata)
    });
    if (result.success) {
      toast.success(newOnHold ? 'Influencer set to On Hold' : 'Influencer resumed');
      await refresh();
      setOpenMenuId(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied code: ${code}`);
    setOpenMenuId(null);
  };

  // Last Updated timestamp formatted
  const lastUpdatedStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, []);

  // Check active record for Level 2 Video Detail View
  const selectedRecord = useMemo(() => {
    if (!selectedVideo) return null;
    const targetId = String(selectedVideo.recordId).trim().toLowerCase();
    const cleanTargetId = targetId.replace(/^#+/, '');

    return (
      activeTrackingRecords.find(r => {
        const rId = String(r.id).toLowerCase();
        const code = (r.dispatch?.influencer_code || '').trim().toLowerCase();
        const cleanCode = code.replace(/^#+/, '');
        const infId = String(r.influencer_id || '').toLowerCase();
        return rId === targetId || code === targetId || cleanCode === cleanTargetId || infId === targetId;
      }) ||
      trackingRecords.find(r => {
        const rId = String(r.id).toLowerCase();
        const code = (r.dispatch?.influencer_code || '').trim().toLowerCase();
        const cleanCode = code.replace(/^#+/, '');
        const infId = String(r.influencer_id || '').toLowerCase();
        return rId === targetId || code === targetId || cleanCode === cleanTargetId || infId === targetId;
      }) || null
    );
  }, [selectedVideo, activeTrackingRecords, trackingRecords]);

  return (
    <div className="bg-[#070c18] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[calc(100vh-120px)] min-h-[750px] shadow-2xl p-3 sm:p-5 gap-4 w-full max-w-full min-w-0">
      
      {/* =========================================================================
          LEVEL 2: DEDICATED VIDEO DETAIL VIEW
      ========================================================================= */}
      {selectedVideo ? (
        selectedRecord ? (
          <VideoDetailView 
            record={selectedRecord}
            videoNumber={selectedVideo.videoNumber}
            onBack={handleBackFromDetail}
            onSwitchVideo={(num) => handleSwitchVideo(selectedRecord.id, num)}
            onSaveStep={(stepId, data, completed) => handleSaveVideoStep(selectedRecord.id, selectedVideo.videoNumber, stepId, data, completed)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
            <RefreshCcw size={32} className="animate-spin text-purple-400 mb-3" />
            <p className="text-sm font-medium text-slate-300">Loading influencer workflow...</p>
            <button 
              onClick={handleBackFromDetail} 
              className="mt-4 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Back to List
            </button>
          </div>
        )
      ) : (
        /* =========================================================================
            LEVEL 1: MAIN STATUS TRACKING LIST VIEW
        ========================================================================= */
        <>
          {/* 1. PAGE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-md">
                <Target size={22} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Status Tracking</h2>
                <p className="text-xs text-slate-400 mt-0.5">Track and manage influencer activity status for this campaign</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-[#0c1326] px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Last Updated: {lastUpdatedStr}</span>
              </div>
              <button 
                onClick={refresh}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 rounded-lg transition-colors"
                title="Refresh Data"
              >
                <RefreshCcw size={16} />
              </button>
              <button 
                onClick={onBack}
                className="px-3.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Back to Overview
              </button>
            </div>
          </div>

          {/* 2. FILTER BAR */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search influencer name, phone, code or tracking ID..."
                className="w-full bg-[#0b1329] border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(true)}
                className={`px-3.5 py-2 bg-[#0b1329] border ${
                  activeFilterCount > 0 
                    ? 'border-purple-500 text-purple-300 font-semibold bg-purple-600/10' 
                    : 'border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
                } rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors relative cursor-pointer shadow-sm`}
                title="Filter Status Tracking"
              >
                <SlidersHorizontal size={16} className={activeFilterCount > 0 ? 'text-purple-400' : 'text-slate-400'} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-purple-600 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center select-none shadow-sm">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {(activeFilterCount > 0 || searchQuery.trim()) && (
                <button 
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-2 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
                  title="Reset all active search and filter criteria"
                >
                  Reset Filters
                </button>
              )}
              <button 
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                disabled={isClearing || activeTrackingRecords.length === 0}
                className="border border-rose-500/50 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:bg-transparent text-rose-400 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                title="Clear all Status Tracking records for this campaign"
              >
                <Trash2 size={15} className={isClearing ? 'animate-spin' : ''} />
                {isClearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>

          {/* 2.1 ACTIVE FILTER CHIPS BAR */}
          {(activeFilterCount > 0 || searchQuery.trim()) && (
            <div className="px-3.5 py-2 bg-[#0b1329]/90 border border-slate-800/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 font-medium mr-1 text-[11px]">Active Filters:</span>
                {searchQuery.trim() && (
                  <span className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    Search: "{searchQuery.trim()}"
                    <button onClick={() => setSearchQuery('')} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                )}
                {activeFilters.videos.map(vNum => (
                  <span key={`chip-v-${vNum}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    Video {vNum}
                    <button onClick={() => removeFilterVideo(vNum)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                ))}
                {activeFilters.languages.map(lang => (
                  <span key={`chip-lang-${lang}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    {lang}
                    <button onClick={() => removeFilterLanguage(lang)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                ))}
                {activeFilters.priceRanges.map(rangeId => {
                  const rObj = STATUS_TRACKING_PRICE_RANGES.find(r => r.id === rangeId);
                  return (
                    <span key={`chip-price-${rangeId}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                      {rObj?.label || rangeId}
                      <button onClick={() => removeFilterPriceRange(rangeId)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                    </span>
                  );
                })}
                {activeFilters.categories.map(cat => (
                  <span key={`chip-cat-${cat}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    Category: {cat}
                    <button onClick={() => removeFilterCategory(cat)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                ))}
                {activeFilters.workflowStatuses.map(status => (
                  <span key={`chip-status-${status}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    Status: {status}
                    <button onClick={() => removeFilterWorkflowStatus(status)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                ))}
                {activeFilters.platforms.map(plat => (
                  <span key={`chip-plat-${plat}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    Platform: {plat}
                    <button onClick={() => removeFilterPlatform(plat)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                ))}
                {activeFilters.deliveryStatuses.map(delStatus => (
                  <span key={`chip-del-${delStatus}`} className="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium text-[11px]">
                    Delivery: {delStatus}
                    <button onClick={() => removeFilterDeliveryStatus(delStatus)} className="hover:text-white text-purple-400 cursor-pointer">&times;</button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-purple-400 hover:text-purple-300 font-semibold text-xs ml-auto transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}

          {/* 3. SUMMARY CARDS (6 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
            {/* Total Influencers */}
            <div className="bg-[#0b1329] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">Total Influencers</span>
                <span className="text-base sm:text-lg font-black text-white">{kpiCounts.total}</span>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-[#0b1329] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">Completed</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {kpiCounts.completed} <span className="text-xs font-semibold text-emerald-400/80">({kpiCounts.completedPct}%)</span>
                </span>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-[#0b1329] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Target size={18} />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">In Progress</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {kpiCounts.inProgress} <span className="text-xs font-semibold text-blue-400/80">({kpiCounts.inProgressPct}%)</span>
                </span>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-[#0b1329] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">Pending</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {kpiCounts.pending} <span className="text-xs font-semibold text-amber-400/80">({kpiCounts.pendingPct}%)</span>
                </span>
              </div>
            </div>

            {/* On Hold */}
            <div className="bg-[#0b1329] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700/30 text-slate-400 border border-slate-600/30 flex items-center justify-center shrink-0">
                <PauseCircle size={18} />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">On Hold</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {kpiCounts.onHold} <span className="text-xs font-semibold text-slate-400">({kpiCounts.onHoldPct}%)</span>
                </span>
              </div>
            </div>

            {/* Not Started */}
            <div className="bg-[#0b1329] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <XCircle size={18} />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">Not Started</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {kpiCounts.notStarted} <span className="text-xs font-semibold text-rose-400/80">({kpiCounts.notStartedPct}%)</span>
                </span>
              </div>
            </div>
          </div>

          {/* 4. DEDICATED INTERNAL VERTICAL SCROLL CONTAINER */}
          <div 
            ref={listScrollContainerRef}
            onScroll={handleListScroll}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-3 w-full max-w-full"
          >
            {isLoading ? (
              <div className="flex justify-center items-center h-64 text-slate-400">
                <RefreshCcw size={22} className="animate-spin mr-2 text-blue-400" />
                <span>Loading status tracking records...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-64 text-slate-500 italic bg-[#0b1329]/50 rounded-2xl border border-slate-800/60 p-8">
                <div className="text-4xl mb-3 opacity-60">🎯</div>
                <h3 className="text-slate-300 text-base font-semibold mb-1">
                  {activeFilterCount > 0 || searchQuery.trim()
                    ? 'No influencers match the selected filters.'
                    : 'No matching status tracking records'}
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  {activeFilterCount > 0 || searchQuery.trim()
                    ? 'Try adjusting or clearing your filters to view influencers.'
                    : 'Dispatch an influencer with Delivered shipment status to begin status tracking.'}
                </p>
                {(activeFilterCount > 0 || searchQuery.trim()) && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="px-4 py-2 bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/30 text-purple-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              filteredRecords.map(record => {
                const dispatch = record.dispatch || ({} as any);
                const avatarUrl = dispatch.influencer_avatar;
                const rawCode = dispatch.influencer_code || record.influencer_id;
                const canonicalBase = getOriginalOrderId(rawCode) || String(rawCode).replace(/^#+/, '');
                const influencerCode = `#${canonicalBase}`;
                const influencerName = dispatch.influencer_name || 'Unknown Influencer';
                const username = dispatch.username || '—';

                const isDelivered = isDeliveryStepCompleted(record);
                const overallStatus = getOverallStatus(record);
                const isMenuOpen = openMenuId === record.id;

                // Derive status for all 6 videos
                const videoWorkflows = [1, 2, 3, 4, 5, 6].map(num => getVideoWorkflow(record, num));

                return (
                  <div 
                    key={record.id}
                    id={`st-card-${record.dispatch_id || record.id}`}
                    className="bg-[#0b1329] hover:bg-[#0e1733] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 transition-all duration-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 w-full min-w-0"
                  >
                    {/* LEFT SECTION: Compact Code Badge, Profile, Name, Username */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-auto max-w-[175px] sm:max-w-[195px] xl:max-w-[225px] min-w-0">
                      {/* Compact Influencer Code Badge */}
                      <div className="px-2 py-0.5 rounded-md bg-[#070c18] border border-slate-700/80 text-white font-mono font-bold text-[11px] sm:text-xs tracking-wider shrink-0 shadow-sm text-center">
                        {influencerCode}
                      </div>

                      {/* Profile Avatar */}
                      <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full overflow-hidden shrink-0 border border-slate-700 bg-slate-900 flex items-center justify-center shadow">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={influencerName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 font-extrabold text-xs sm:text-sm">{influencerName.charAt(0) || '?'}</span>
                        )}
                      </div>

                      {/* Influencer Name & Username */}
                      <div className="truncate min-w-0 flex-1">
                        <h4 className="text-white font-bold text-xs sm:text-sm leading-tight truncate" title={influencerName}>
                          {influencerName}
                        </h4>
                        <p className="text-slate-400 text-[10px] sm:text-xs font-medium mt-0.5 truncate" title={username}>
                          {username}
                        </p>
                      </div>
                    </div>

                    {/* CENTER SECTION: 7 Horizontal Stages (Delivery + 6 Videos) */}
                    <div className="flex-1 px-1 sm:px-2 py-0.5 min-w-0 w-full">
                      <div className="flex items-center w-full min-w-0">
                        
                        {/* 1. STEP 1: DELIVERY CONFIRMATION STAGE */}
                        {(() => {
                          const isReDispatch = overallStatus.key === 'RE_DISPATCH_REQUIRED';
                          return (
                            <div 
                              className="flex flex-col items-center cursor-pointer group relative select-none shrink-0 min-w-0"
                              onClick={() => setActiveModal({ recordId: record.id, stageId: 'delivered' })}
                              title={
                                isDelivered 
                                  ? 'STEP 1: Delivery Confirmed (Click to view/edit)' 
                                  : isReDispatch
                                  ? 'STEP 1: Re-Dispatch Required (Click to review issue & attempts)'
                                  : 'STEP 1: Delivery Confirmation: Not Started (Click to confirm)'
                              }
                            >
                              <div className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center transition-all duration-200 z-10 shrink-0 ${
                                isDelivered 
                                  ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-400 hover:scale-110'
                                  : isReDispatch
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:scale-110'
                                  : 'bg-[#151f32] text-slate-400 border border-slate-700/80 hover:border-slate-500 hover:text-slate-200'
                              }`}>
                                {isDelivered ? (
                                  <Check size={15} strokeWidth={3} className="text-white sm:w-4 sm:h-4" />
                                ) : isReDispatch ? (
                                  <AlertTriangle size={14} className="text-amber-400 sm:w-4 sm:h-4" />
                                ) : (
                                  <span className="font-bold text-[11px] sm:text-xs text-slate-400 group-hover:text-white">1</span>
                                )}
                              </div>
                              <div className="flex flex-col items-center mt-1 text-center min-w-0">
                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider block whitespace-nowrap">
                                  STEP 1
                                </span>
                                <span className={`text-[9px] sm:text-[10px] lg:text-[11px] text-center leading-tight transition-colors whitespace-nowrap block ${
                                  isDelivered 
                                    ? 'text-emerald-400 font-bold' 
                                    : isReDispatch
                                    ? 'text-amber-400 font-bold'
                                    : 'text-slate-400'
                                }`}>
                                  {isReDispatch ? 'Re-Dispatch' : 'Delivery'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Connecting Line from Delivery to Video 1 */}
                        <div className="flex-1 min-w-[6px] sm:min-w-[10px] h-[2px] mx-0.5 sm:mx-1 -mt-4 transition-colors duration-300">
                          <div className={`h-full w-full rounded-full ${
                            isDelivered ? 'bg-emerald-500/80' : 'bg-slate-700/60'
                          }`} />
                        </div>

                        {/* 2 to 7: VIDEOS 1 THROUGH 6 (STEP 2 TO STEP 7) */}
                        {videoWorkflows.map((vw, idx) => {
                          const vNum = vw.videoNumber;
                          const stepNumber = vNum + 1; // Video 1 is STEP 2, Video 2 is STEP 3, ..., Video 6 is STEP 7
                          const isVCompleted = vw.status === 'COMPLETED';
                          const isVInProgress = vw.status === 'IN_PROGRESS';
                          const isReDraftReq = vw.isReDraftRequired;
                          const isNextActive = idx < videoWorkflows.length - 1 && (videoWorkflows[idx + 1].status === 'COMPLETED' || videoWorkflows[idx + 1].status === 'IN_PROGRESS');
                          const isLineActive = isVCompleted && (isNextActive || (isDelivered && videoWorkflows[idx + 1]?.status !== 'NOT_STARTED'));

                          let circleStyle = "bg-[#151f32] text-slate-400 border border-slate-700/80 hover:border-blue-500 hover:text-blue-300";
                          let labelStyle = "text-slate-400";

                          if (isVCompleted) {
                            circleStyle = "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-400 hover:scale-110";
                            labelStyle = "text-emerald-400 font-bold";
                          } else if (isReDraftReq) {
                            circleStyle = "bg-amber-950/80 text-amber-400 border border-amber-600/80 shadow-[0_0_12px_rgba(245,158,11,0.5)] hover:scale-110 animate-pulse";
                            labelStyle = "text-amber-400 font-bold";
                          } else if (isVInProgress) {
                            circleStyle = "bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.7)] ring-4 ring-blue-500/30 border border-blue-400 hover:scale-110";
                            labelStyle = "text-blue-400 font-bold";
                          }

                          return (
                            <React.Fragment key={`v-${vNum}`}>
                              {/* Video Stage Node */}
                              <div 
                                className="flex flex-col items-center cursor-pointer group relative select-none shrink-0 min-w-0"
                                onClick={() => {
                                  if (!isDelivered) {
                                    toast.error('Please complete Step 1: Delivery Confirmation first.');
                                    setActiveModal({ recordId: record.id, stageId: 'delivered' });
                                    return;
                                  }
                                  handleOpenVideo(record, vNum);
                                }}
                                title={`STEP ${stepNumber}: Video ${vNum} (${vw.completedCount} of ${vw.totalSteps} completed)`}
                              >
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center transition-all duration-200 z-10 shrink-0 ${circleStyle}`}>
                                  {isVCompleted ? (
                                    <Check size={15} strokeWidth={3} className="text-white sm:w-4 sm:h-4" />
                                  ) : isReDraftReq ? (
                                    <span className="font-black text-[10px] sm:text-xs text-amber-400 tracking-tight">RD</span>
                                  ) : isVInProgress ? (
                                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white animate-ping"></span>
                                  ) : (
                                    <span className="font-bold text-[11px] sm:text-xs text-slate-400 group-hover:text-white">{stepNumber}</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-center mt-1 text-center min-w-0">
                                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider block whitespace-nowrap">
                                    STEP {stepNumber}
                                  </span>
                                  <span className={`text-[9px] sm:text-[10px] lg:text-[11px] text-center leading-tight transition-colors whitespace-nowrap block ${labelStyle}`}>
                                    Video {vNum}
                                  </span>
                                  {isReDraftReq && (
                                    <span className="text-[8px] font-bold text-amber-400 bg-amber-950/90 border border-amber-800/80 px-1 py-0.2 rounded mt-0.5 whitespace-nowrap shadow-sm">
                                      RD Req
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Connecting Line between Videos */}
                              {idx !== videoWorkflows.length - 1 && (
                                <div className="flex-1 min-w-[6px] sm:min-w-[10px] h-[2px] mx-0.5 sm:mx-1 -mt-4 transition-colors duration-300">
                                  <div className={`h-full w-full rounded-full ${isLineActive ? 'bg-emerald-500' : isVInProgress ? 'bg-blue-500/50' : 'bg-slate-700/60'}`} />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* RIGHT SECTION: Overall Status & Three-Dot Menu */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end w-auto min-w-0">
                      {/* Status Badge */}
                      <span className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 border shadow-sm whitespace-nowrap shrink-0 ${overallStatus.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${overallStatus.dotClass}`}></span>
                        <span>{overallStatus.label}</span>
                      </span>

                      {/* Three-Dot Menu */}
                      <div className="relative three-dot-menu-container shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : record.id);
                          }}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="More actions"
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-10 w-52 bg-[#0c1326] border border-slate-700/80 rounded-xl shadow-2xl z-40 py-1.5 overflow-hidden animate-fade-in text-xs">
                            <button 
                              onClick={() => {
                                setDetailsRecord(record);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                            >
                              <Eye size={14} className="text-blue-400" />
                              <span>View Influencer Details</span>
                            </button>
                            <button 
                              onClick={() => handleToggleOnHold(record)}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                            >
                              <PauseCircle size={14} className="text-amber-400" />
                              <span>{overallStatus.key === 'ON_HOLD' ? 'Resume Workflow' : 'Toggle On Hold'}</span>
                            </button>
                            <button 
                              onClick={() => {
                                setActiveModal({ recordId: record.id, stageId: 'delivered' });
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                            >
                              <Package size={14} className="text-emerald-400" />
                              <span>Confirm Delivery</span>
                            </button>
                            <div className="h-[1px] bg-slate-800 my-1" />
                            <button 
                              onClick={() => handleCopyCode(influencerCode)}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                            >
                              <Copy size={14} className="text-slate-400" />
                              <span>Copy Influencer Code</span>
                            </button>
                            <div className="h-[1px] bg-slate-800 my-1" />
                            <button 
                              onClick={() => {
                                setRecordToDelete(record);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 size={14} className="text-rose-400" />
                              <span>Remove from Status Tracking</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ========================================================
          DELIVERY CONFIRMATION MODAL
      ======================================================== */}
      {activeModal && activeModal.stageId === 'delivered' && (() => {
        const targetRecord = activeTrackingRecords.find(r => r.id === activeModal.recordId) || trackingRecords.find(r => r.id === activeModal.recordId);
        if (!targetRecord) return null;

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in relative">
              <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#070c18]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <Package size={18} />
                  </div>
                  <div>
                    <h5 className="text-base sm:text-lg font-bold text-white leading-none">Step 1: Delivery Confirmation</h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {targetRecord.dispatch?.influencer_name} ({targetRecord.dispatch?.influencer_code || targetRecord.influencer_id})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveModal(null)} 
                  className="text-slate-400 hover:text-white transition-colors p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 max-h-[calc(85vh-120px)] overflow-y-auto">
                <DeliveredForm record={targetRecord} onSave={(data: any) => handleDeliverySave(targetRecord.id, data)} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          INFLUENCER DETAILS MODAL (Via Three-Dot Menu)
      ======================================================== */}
      {detailsRecord && (() => {
        const d = detailsRecord.dispatch || ({} as any);
        const p = detailsRecord.pricing || ({} as any);
        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in relative">
              <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#070c18]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center shrink-0">
                    {d.influencer_avatar ? (
                      <img src={d.influencer_avatar} alt={d.influencer_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">{d.influencer_name?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">{d.influencer_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{d.username} • Code: {d.influencer_code || detailsRecord.influencer_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDetailsRecord(null)}
                  className="text-slate-400 hover:text-white p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-4 bg-[#070c18] p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Phone Number</span>
                    <span className="text-white font-semibold">{d.phone_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Alternative Phone</span>
                    <span className="text-white font-semibold">{d.alternative_phone_number || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Address</span>
                    <span className="text-slate-200">{d.address || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Courier Partner</span>
                    <span className="text-emerald-400 font-semibold">{d.courier_partner || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Tracking ID</span>
                    <span className="text-white font-mono font-semibold">{d.tracking_id || '—'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-[#070c18] p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Product Name</span>
                    <span className="text-white font-semibold">{d.product_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Total Products</span>
                    <span className="text-white font-semibold">{d.total_products || 1}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Total Agreed Price</span>
                    <span className="text-white font-semibold">₹{p.final_price || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Advance Paid</span>
                    <span className="text-emerald-400 font-semibold">₹{detailsRecord.advance_paid_amount || '0'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-[#070c18] flex justify-end">
                <button 
                  onClick={() => setDetailsRecord(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          CONFIRMATION MODAL: CLEAR ALL STATUS TRACKING RECORDS
      ======================================================== */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Clear All Status Tracking Records?"
        message="This will permanently delete all Status Tracking records for this campaign from the database. Master influencer profiles in Campaign Influencer will NOT be deleted. This action cannot be undone."
        confirmText={isClearing ? "Clearing..." : "Clear All"}
        cancelText="Cancel"
        isDestructive={true}
        onClose={() => {
          if (!isClearing) {
            setIsClearModalOpen(false);
          }
        }}
        onConfirm={handleConfirmClearAll}
      />

      {/* ========================================================
          CONFIRMATION MODAL: REMOVE SINGLE INFLUENCER
      ======================================================== */}
      <ConfirmModal
        isOpen={Boolean(recordToDelete)}
        title="Remove Influencer from Status Tracking?"
        message={`Are you sure you want to remove ${recordToDelete?.dispatch?.influencer_name || 'this influencer'} (${recordToDelete?.dispatch?.influencer_code || recordToDelete?.influencer_id || ''}) from Status Tracking? Master influencer profiles in Campaign Influencer will NOT be deleted.`}
        confirmText={isDeletingSingle ? "Removing..." : "Remove"}
        cancelText="Cancel"
        isDestructive={true}
        onClose={() => {
          if (!isDeletingSingle) {
            setRecordToDelete(null);
          }
        }}
        onConfirm={handleConfirmDeleteSingle}
      />

      {/* ========================================================
          MULTI-CRITERIA STATUS TRACKING FILTER DRAWER
      ======================================================== */}
      <StatusTrackingFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={activeFilters}
        onApplyFilters={setActiveFilters}
        onResetFilters={() => setActiveFilters(initialStatusTrackingFilterState)}
        availableOptions={{
          videos: availableFilterVideos,
          languages: availableFilterLanguages,
          categories: availableFilterCategories,
          platforms: availableFilterPlatforms,
          deliveryStatuses: availableFilterDeliveryStatuses
        }}
      />

    </div>
  );
};

// =========================================================================
// LEVEL 2: DEDICATED VIDEO DETAIL VIEW COMPONENT
// =========================================================================
interface VideoDetailViewProps {
  record: StatusTrackingRecord;
  videoNumber: number;
  onBack: () => void;
  onSwitchVideo: (num: number) => void;
  onSaveStep: (stepId: string, data: any, completed: boolean) => Promise<{ success: boolean; error?: any } | void>;
}

const VideoDetailView: React.FC<VideoDetailViewProps> = ({
  record,
  videoNumber,
  onBack,
  onSwitchVideo,
  onSaveStep
}) => {
  const dispatch = record.dispatch || ({} as any);
  const rawCode = dispatch.influencer_code || record.influencer_id;
  const canonicalBase = getOriginalOrderId(rawCode) || String(rawCode).replace(/^#+/, '');
  const influencerCode = `#${canonicalBase}`;
  const influencerName = dispatch.influencer_name || 'Unknown Influencer';
  const username = dispatch.username || '—';
  const avatarUrl = dispatch.influencer_avatar;

  // Derive workflow data for this specific video
  const videoData = useMemo(() => getVideoWorkflow(record, videoNumber), [record, videoNumber]);
  const [activeStepId, setActiveStepId] = useState<string>(videoData.activeStepId);

  // Derive resolved product & per-video price for this specific video from Campaign Influencer data
  const resolvedProductInfo = useMemo(() => getResolvedProductForVideo(record.influencer, videoNumber), [record.influencer, videoNumber]);
  const currentVideoPrice = useMemo(() => getInfluencerVideoPrice(record.influencer, videoNumber), [record.influencer, videoNumber]);

  // Sync active step when video changes
  useEffect(() => {
    setActiveStepId(videoData.activeStepId);
  }, [videoNumber, videoData.activeStepId]);

  const activeStepConfig = videoData.configs.find(c => c.id === activeStepId) || videoData.configs[0];
  const activeStepState = videoData.steps[activeStepId] || { completed: false, data: {} };

  // Status badge style for Video Title
  let videoStatusBadge = (
    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
      Not Started
    </span>
  );
  if (videoData.status === 'COMPLETED') {
    videoStatusBadge = (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-400 border border-emerald-700/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        Completed
      </span>
    );
  } else if (videoData.isReDraftRequired) {
    videoStatusBadge = (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950/90 text-amber-400 border border-amber-700/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        Re-Draft Required
      </span>
    );
  } else if (videoData.status === 'IN_PROGRESS') {
    videoStatusBadge = (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950/90 text-blue-400 border border-blue-700/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
        In Progress
      </span>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      
      {/* 1. TOP NAVIGATION & INFLUENCER HEADER */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 shadow-md">
        
        {/* Left: Back button & Influencer Info */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Status Tracking</span>
          </button>

          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Influencer Badge & Info */}
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded-lg bg-[#070c18] border border-slate-700 text-white font-mono font-bold text-xs tracking-wider">
              {influencerCode}
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={influencerName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">{influencerName.charAt(0) || '?'}</span>
              )}
            </div>
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base leading-none">{influencerName}</h3>
              <p className="text-slate-400 text-xs mt-1">{username}</p>
            </div>
          </div>
        </div>

        {/* Right: Video Selector Tabs & Current Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Video Tabs: 1 to 6 */}
          <div className="flex items-center bg-[#070c18] p-1 rounded-xl border border-slate-800 gap-1">
            {[1, 2, 3, 4, 5, 6].map(num => {
              const vW = getVideoWorkflow(record, num);
              const isActive = num === videoNumber;
              let dotColor = 'bg-slate-600';
              if (vW.status === 'COMPLETED') dotColor = 'bg-emerald-400';
              else if (vW.status === 'IN_PROGRESS') dotColor = 'bg-blue-400';

              return (
                <button
                  key={num}
                  onClick={() => onSwitchVideo(num)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                  Video {num}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white uppercase tracking-wider">STEP {videoNumber + 1}: VIDEO {videoNumber}</span>
            <div className="flex items-center gap-1.5 bg-[#070c18] px-2.5 py-1 rounded-lg border border-slate-800" title={resolvedProductInfo.productName}>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product:</span>
              <span className={`text-xs font-bold truncate max-w-[170px] sm:max-w-[220px] ${
                resolvedProductInfo.isAssigned ? 'text-purple-300' : 'text-slate-500 italic'
              }`}>
                {resolvedProductInfo.productName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#070c18] px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount:</span>
              {currentVideoPrice !== null ? (
                <span className="text-xs font-mono font-bold text-emerald-400">
                  ₹{Number(currentVideoPrice).toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  Not assigned
                </span>
              )}
            </div>
            {videoStatusBadge}
          </div>
        </div>
      </div>

      {/* 2. COMPACT 6-STEP PROGRESS STEPPER CARD */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 shrink-0 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider">STEP {videoNumber + 1}: VIDEO {videoNumber} WORKFLOW</span>
            <span className="text-xs text-slate-400">
              ({videoNumber === 1 ? '6 Steps: with Advance Payment' : '6 Steps: with Final Payment'})
            </span>
          </div>
          <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-3 py-1 rounded-full">
            {videoData.completedCount} of {videoData.totalSteps} completed
          </span>
        </div>

        {/* Horizontal Step Stepper */}
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto py-2">
          {videoData.configs.map((cfg, idx) => {
            const stepInfo = videoData.steps[cfg.id];
            const isCompleted = !!stepInfo?.completed;
            const isSelected = cfg.id === activeStepId;
            const StepIcon = cfg.icon;

            // Step locking rules: Post Date locked until Draft is Approved; Payment locked until Post Date completed
            const isDraftApproved = !!videoData.steps['draft']?.completed;
            const isPostDateCompleted = !!videoData.steps['post_date']?.completed;
            const isLocked = (cfg.id === 'post_date' && !isDraftApproved) || (cfg.id === 'payment' && !isPostDateCompleted);
            const isStepReDraftReq = cfg.id === 'draft' && videoData.isReDraftRequired;

            const nextStepCompleted = idx < videoData.configs.length - 1 && !!videoData.steps[videoData.configs[idx + 1].id]?.completed;
            const isLineActive = isCompleted && nextStepCompleted;

            let circleStyle = "bg-[#070c18] text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white";
            let labelStyle = "text-slate-400";

            if (isCompleted) {
              circleStyle = "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-400";
              labelStyle = "text-emerald-400 font-bold";
            } else if (isStepReDraftReq) {
              circleStyle = "bg-amber-950/80 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.6)] border border-amber-500 ring-2 ring-amber-500/40 animate-pulse";
              labelStyle = "text-amber-400 font-bold";
            } else if (isSelected) {
              circleStyle = "bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.7)] ring-4 ring-blue-500/30 border border-blue-400";
              labelStyle = "text-blue-400 font-bold";
            } else if (isLocked) {
              circleStyle = "bg-[#050811] text-slate-600 border border-slate-800/80 opacity-60";
              labelStyle = "text-slate-600";
            }

            const handleNodeClick = () => {
              if (cfg.id === 'post_date' && !isDraftApproved) {
                if (videoData.isReDraftRequired) {
                  toast.error('Post Date is locked. Re-Draft is required and must be Approved first.');
                } else {
                  toast.error('Post Date is locked until Draft is Approved.');
                }
                return;
              }
              if (cfg.id === 'payment' && !isPostDateCompleted) {
                toast.error('Payment is locked until Post Date is completed.');
                return;
              }
              setActiveStepId(cfg.id);
            };

            return (
              <React.Fragment key={cfg.id}>
                {/* Step Node */}
                <div 
                  onClick={handleNodeClick}
                  className={`flex flex-col items-center group select-none relative ${isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                  title={isLocked ? `${cfg.label} is locked` : `Click to open: ${cfg.label}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${circleStyle}`}>
                    {isCompleted ? (
                      <Check size={18} strokeWidth={3} className="text-white" />
                    ) : isLocked ? (
                      <Lock size={15} className="text-slate-500" />
                    ) : (
                      <StepIcon size={17} />
                    )}
                  </div>
                  <span className={`text-[11px] text-center w-20 leading-tight mt-2 transition-colors ${labelStyle}`}>
                    {cfg.id === 'timeline' && (stepInfo?.data?.is_re_upload_timeline === true || !!stepInfo?.data?.re_draft_submit_date)
                      ? 'Re-Upload Timeline'
                      : cfg.shortLabel}
                  </span>
                  {isStepReDraftReq && (
                    <span className="text-[8px] font-bold text-amber-400 bg-amber-950/80 px-1 rounded -mt-0.5">
                      Re-Draft
                    </span>
                  )}
                  {isSelected && (
                    <div className="absolute -bottom-2 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  )}
                </div>

                {/* Connecting Line */}
                {idx !== videoData.configs.length - 1 && (
                  <div className="flex-1 h-[2px] mx-2 -mt-6 transition-colors duration-300">
                    <div className={`h-full w-full rounded-full ${isLineActive ? 'bg-emerald-500' : isCompleted ? 'bg-blue-500/60' : 'bg-slate-800'}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. ACTIVE STEP INTERACTIVE WORKFLOW PANEL */}
      <div className="flex-1 min-h-0 bg-[#0b1329] border border-slate-800 rounded-2xl p-5 overflow-y-auto shadow-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <activeStepConfig.icon size={19} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white leading-none">
                Step {videoData.configs.findIndex(c => c.id === activeStepId) + 1}: {
                  activeStepId === 'timeline' && (activeStepState.data?.is_re_upload_timeline === true || !!activeStepState.data?.re_draft_submit_date)
                    ? 'Re-Upload Timeline'
                    : activeStepConfig.label
                }
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Configure details for Video {videoNumber} • {influencerName} ({influencerCode})
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            activeStepState.completed 
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60' 
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}>
            {activeStepState.completed ? '✓ Completed' : '○ In Progress / Not Started'}
          </span>
        </div>

        {/* Step Component Form */}
        <div>
          {activeStepId === 'call_explain' && (
            <CallExplainForm 
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('call_explain', formData, formData.call_explained)} 
            />
          )}

          {activeStepId === 'share_script' && (
            <ShareScriptForm 
              key={`v-${videoNumber}-share-script-${record.id}`}
              record={record} 
              videoNumber={videoNumber}
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('share_script', formData, formData.reference_video_received)} 
            />
          )}

          {activeStepId === 'pay_advance' && (
            <PayAdvanceForm 
              key={`v1-pay-advance-${record.id}`}
              videoNumber={1}
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('pay_advance', formData, formData.pay_advance_completed)} 
            />
          )}

          {activeStepId === 'timeline' && (
            <ExpectedTimelineForm 
              record={record} 
              videoNumber={videoNumber}
              stepNumber={videoData.configs.findIndex(c => c.id === 'timeline') + 1}
              existingData={activeStepState.data}
              onSave={async (formData: any) => { await onSaveStep('timeline', formData, formData.expected_delivery_completed); }} 
            />
          )}

          {activeStepId === 'draft' && (
            <DraftForm 
              record={record} 
              videoNumber={videoNumber}
              existingData={activeStepState.data}
              onSave={async (formData: any, completed: boolean) => { await onSaveStep('draft', formData, completed); }} 
              onNavigateToPostDate={() => setActiveStepId('post_date')}
            />
          )}

          {activeStepId === 'post_date' && (
            <VideoPostForm 
              key={`v-${videoNumber}-post-form-${record.id}`}
              videoNumber={videoNumber}
              record={record}
              existingData={activeStepState.data}
              onSave={(formData: any, completed?: boolean) => onSaveStep('post_date', formData, completed !== undefined ? completed : formData.confirmed_live)}
            />
          )}

          {activeStepId === 'payment' && (
            <VideoPaymentForm 
              key={`v-${videoNumber}-payment-${record.id}`}
              videoNumber={videoNumber}
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('payment', formData, formData.payment_completed)}
            />
          )}
        </div>
      </div>

    </div>
  );
};

// =========================================================================
// SUB-FORM COMPONENTS (Maintained & Enhanced for all Steps)
// =========================================================================

// --- STEP: Delivery Confirmation (Option A: No Issue vs Option B: Re-Dispatch Required + Shipment History) ---
const DeliveredForm = ({ record, onSave }: any) => {
  const isInitiallyCompleted = isDeliveryStepCompleted(record);
  
  let metadata: any = {};
  try {
    metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
  } catch (e) {
    metadata = {};
  }

  const rawStatus = (record.status || '').toLowerCase();
  const hasExistingIssue = Boolean(
    rawStatus.includes('re-dispatch') || 
    rawStatus.includes('redispatch') || 
    metadata.re_dispatch_required || 
    metadata.issue_reported
  );

  // Segmented Selection: 'NO_ISSUE' | 'PRODUCT_ISSUE'
  const [selectedOption, setSelectedOption] = useState<'NO_ISSUE' | 'PRODUCT_ISSUE'>(
    hasExistingIssue ? 'PRODUCT_ISSUE' : 'NO_ISSUE'
  );

  // Option A State: Normal Delivery Confirmation
  const [confirmed, setConfirmed] = useState(isInitiallyCompleted);
  const [deliveryPhoto, setDeliveryPhoto] = useState<string>(
    record.delivery_photo_url || metadata.delivery_photo_url || ''
  );
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [deliveryPreview, setDeliveryPreview] = useState<string | null>(
    record.delivery_photo_url || metadata.delivery_photo_url || null
  );

  // Option B State: Product Issue / Re-Dispatch
  const [issueType, setIssueType] = useState<ShipmentIssueType>(
    (metadata.issue_type as ShipmentIssueType) || 'DAMAGED_PRODUCT'
  );
  const [issueRemarks, setIssueRemarks] = useState<string>(metadata.issue_remarks || '');
  const [issuePhoto, setIssuePhoto] = useState<string>(metadata.issue_proof_url || '');
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [issuePreview, setIssuePreview] = useState<string | null>(metadata.issue_proof_url || null);

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shipment History Attempts Chain State
  const [attempts, setAttempts] = useState<ShipmentAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);

  // Load shipment attempts chain from Supabase
  const loadAttempts = useCallback(async () => {
    if (!record?.campaign_id || !record?.influencer_id) return;
    setIsLoadingAttempts(true);
    try {
      const data = await shipmentAttemptService.getShipmentAttempts(record.campaign_id, record.influencer_id);
      setAttempts(data);
    } catch (e) {
      console.error('Error loading shipment attempts:', e);
    } finally {
      setIsLoadingAttempts(false);
    }
  }, [record?.campaign_id, record?.influencer_id]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  // Handlers for Delivery Photo (Option A)
  const handleDeliveryPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setDeliveryFile(f);
      setDeliveryPreview(URL.createObjectURL(f));
    }
  };

  // Handlers for Issue Photo (Option B)
  const handleIssuePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setIssueFile(f);
      setIssuePreview(URL.createObjectURL(f));
    }
  };

  const uploadFileToStorage = async (fileToUpload: File, subfolder: string = 'delivery') => {
    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `dispatch/${subfolder}/${fileName}`;

    const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, fileToUpload);
    if (error) throw error;

    const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
    return publicData.publicUrl;
  };

  // Active attempt ID if existing
  const currentAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  // Save / Submit Handler
  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      if (selectedOption === 'PRODUCT_ISSUE') {
        // Option B: Report Issue & Move to Re-Dispatch
        if (!issueType) {
          toast.error('Please select the type of product issue.');
          setIsSubmitting(false);
          return;
        }

        let finalIssueUrl = issuePhoto;
        if (issueFile) {
          try {
            finalIssueUrl = await uploadFileToStorage(issueFile, 'issues');
            setIssuePhoto(finalIssueUrl);
          } catch (err) {
            console.error('Error uploading issue photo:', err);
            toast.error('Failed to upload issue proof photo. Please try again.');
            setIsSubmitting(false);
            return;
          }
        }

        await onSave({
          option: 'PRODUCT_ISSUE',
          attempt_id: currentAttempt?.id,
          issue_type: issueType,
          issue_remarks: issueRemarks.trim(),
          issue_proof_url: finalIssueUrl
        });
      } else {
        // Option A: Confirm Delivery Successfully
        if (!confirmed) {
          toast.error('Please check the confirmation box indicating the package was delivered.');
          setIsSubmitting(false);
          return;
        }

        let finalDeliveryUrl = deliveryPhoto;
        if (deliveryFile) {
          try {
            finalDeliveryUrl = await uploadFileToStorage(deliveryFile, 'delivery');
            setDeliveryPhoto(finalDeliveryUrl);
          } catch (err) {
            console.error('Error uploading delivery photo:', err);
            toast.error('Failed to upload delivery proof photo. Please try again.');
            setIsSubmitting(false);
            return;
          }
        }

        if (!finalDeliveryUrl || !finalDeliveryUrl.trim()) {
          toast.error('Please upload a delivery proof photo before confirming Step 1.');
          setIsSubmitting(false);
          return;
        }

        await onSave({
          option: 'NO_ISSUE',
          attempt_id: currentAttempt?.id,
          delivered_confirmed: true,
          delivery_photo_url: finalDeliveryUrl
        });
      }
    } catch (e: any) {
      console.error('DeliveredForm handleSave error:', e);
      toast.error('An error occurred while saving: ' + (e?.message || String(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SEGMENTED OPTION SELECTOR (Option A vs Option B) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Option A: Product Received Successfully */}
        <button
          type="button"
          onClick={() => setSelectedOption('NO_ISSUE')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
            selectedOption === 'NO_ISSUE'
              ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
              : 'bg-[#070c18] border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              selectedOption === 'NO_ISSUE' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              <Check size={18} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-sm font-bold text-white block">
                Product Received Successfully
              </span>
              <span className="text-xs text-slate-400 mt-1 block leading-relaxed">
                No issue with the shipment. Package verified and delivered to creator.
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Unlocks Video Workflow</span>
          </div>
        </button>

        {/* Option B: Product Issue Reported */}
        <button
          type="button"
          onClick={() => setSelectedOption('PRODUCT_ISSUE')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
            selectedOption === 'PRODUCT_ISSUE'
              ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50'
              : 'bg-[#070c18] border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              selectedOption === 'PRODUCT_ISSUE' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              <AlertTriangle size={18} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-sm font-bold text-white block">
                Product Issue Reported
              </span>
              <span className="text-xs text-slate-400 mt-1 block leading-relaxed">
                Damaged, missing, or incorrect product requiring replacement re-dispatch.
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Triggers Re-Dispatch in Logistics</span>
          </div>
        </button>
      </div>

      {/* 2. OPTION BODY FORMS */}
      {selectedOption === 'NO_ISSUE' ? (
        /* ================= OPTION A FORM ================= */
        <div className="bg-[#070c18] border border-slate-800/90 rounded-xl p-5 space-y-5 animate-fade-in">
          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
            <input 
              type="checkbox" 
              id="delivered-confirmed"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 mt-0.5 cursor-pointer" 
            />
            <label htmlFor="delivered-confirmed" className="text-xs sm:text-sm font-medium text-slate-200 cursor-pointer select-none">
              Yes, the creator has received the package intact with all required products.
            </label>
          </div>

          {/* Delivery Proof Photo Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Delivery Proof Photo <span className="text-emerald-400">*</span>
              </label>
              {deliveryPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryPhoto('');
                    setDeliveryFile(null);
                    setDeliveryPreview(null);
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                >
                  Remove Photo
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-slate-700/80 rounded-xl p-4 text-center relative hover:border-emerald-500/70 transition-colors bg-[#0b1329] min-h-[160px] flex items-center justify-center">
              {deliveryPreview ? (
                <div className="relative w-full max-h-56 flex items-center justify-center">
                  <img src={deliveryPreview} alt="Delivery Proof" className="max-h-56 max-w-full object-contain rounded-lg shadow-md" />
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <UploadCloud className="text-slate-500 mb-2" size={32} />
                  <span className="text-xs sm:text-sm text-slate-300 font-medium mb-1">Click or drag delivery confirmation image</span>
                  <span className="text-[11px] text-slate-500">PNG, JPG, WEBP up to 5MB</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleDeliveryPhotoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          </div>
        </div>
      ) : (
        /* ================= OPTION B FORM ================= */
        <div className="bg-[#070c18] border border-amber-900/40 rounded-xl p-5 space-y-5 animate-fade-in">
          {/* Warning Banner */}
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <span className="font-bold text-amber-300 block mb-0.5">Re-Dispatch Action:</span>
              Reporting an issue marks this creator for <strong className="text-white">Re-Dispatch in Influencer Logistics</strong>. Step 1 will remain uncompleted and video production will stay locked until the replacement package is delivered.
            </div>
          </div>

          {/* Issue Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
              Issue Type <span className="text-amber-400">*</span>
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as ShipmentIssueType)}
              className="w-full bg-[#0b1329] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
            >
              <option value="DAMAGED_PRODUCT">Damaged Product / Broken packaging</option>
              <option value="MISSING_ITEMS">Missing Items / Incomplete box</option>
              <option value="WRONG_PRODUCT">Wrong Product / Incorrect variant</option>
              <option value="LOST_IN_TRANSIT">Lost in Transit / Delivery failed</option>
              <option value="OTHER">Other shipment issue</option>
            </select>
          </div>

          {/* Issue Remarks Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
              Issue Remarks / Creator Feedback
            </label>
            <textarea
              rows={3}
              value={issueRemarks}
              onChange={(e) => setIssueRemarks(e.target.value)}
              placeholder="Provide specific notes regarding the issue (e.g. bottles leaked, wrong shade received, courier delivered empty box)..."
              className="w-full bg-[#0b1329] border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Issue Proof Photo Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Issue Proof Photo (Optional but recommended)
              </label>
              {issuePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setIssuePhoto('');
                    setIssueFile(null);
                    setIssuePreview(null);
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                >
                  Remove Photo
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-amber-900/50 rounded-xl p-4 text-center relative hover:border-amber-500/70 transition-colors bg-[#0b1329] min-h-[140px] flex items-center justify-center">
              {issuePreview ? (
                <div className="relative w-full max-h-52 flex items-center justify-center">
                  <img src={issuePreview} alt="Issue Proof" className="max-h-52 max-w-full object-contain rounded-lg shadow-md" />
                </div>
              ) : (
                <div className="py-5 flex flex-col items-center">
                  <UploadCloud className="text-amber-500/60 mb-2" size={28} />
                  <span className="text-xs sm:text-sm text-slate-300 font-medium mb-1">Upload damage / missing item photo</span>
                  <span className="text-[11px] text-slate-500">PNG, JPG, WEBP up to 5MB</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleIssuePhotoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. SHIPMENT HISTORY & ATTEMPTS TIMELINE */}
      <div className="bg-[#070c18] border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <History size={15} className="text-indigo-400" />
            <span>Shipment Attempts & History</span>
          </div>
          {isLoadingAttempts && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Loading chain...
            </span>
          )}
        </div>

        {attempts.length === 0 ? (
          <div className="bg-[#0b1329] rounded-lg p-3 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-[10px]">
                Attempt 1
              </span>
              <span>{record.dispatch?.courier_partner || 'Courier'} &bull; Order: #{record.dispatch?.influencer_code || record.influencer_id}</span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              AWB: {record.dispatch?.tracking_id || '—'}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {attempts.map((att, idx) => {
              const isReplacement = att.shipment_type === 'RE_DISPATCH' || att.attempt_number > 1;
              const hasIssue = Boolean(att.issue_reported || att.issue_type);
              const isDelivered = Boolean(att.delivery_confirmed);

              return (
                <div 
                  key={att.id || idx}
                  className={`rounded-xl p-3 border text-xs transition-all ${
                    hasIssue 
                      ? 'bg-amber-950/20 border-amber-800/40' 
                      : isDelivered 
                      ? 'bg-emerald-950/20 border-emerald-800/40' 
                      : 'bg-[#0b1329] border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        isReplacement
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        Attempt {att.attempt_number} {isReplacement ? '(Re-Dispatch)' : '(Original)'}
                      </span>
                      <span className="font-mono text-white font-semibold">
                        {att.order_id || `#${record.dispatch?.influencer_code || record.influencer_id}`}
                      </span>
                      <span className="text-slate-400">
                        {att.courier || record.dispatch?.courier_partner || 'Courier'}
                      </span>
                      {att.awb_number && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          &bull; AWB: {att.awb_number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {att.dispatch_date && (
                        <span className="text-slate-500 text-[11px]">
                          {att.dispatch_date}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        hasIssue
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : isDelivered
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {hasIssue ? `Issue: ${att.issue_type?.replace(/_/g, ' ')}` : isDelivered ? 'Delivered' : (att.shipment_status || 'Pending')}
                      </span>
                    </div>
                  </div>

                  {/* Issue details if present on this attempt */}
                  {hasIssue && (
                    <div className="mt-2 pt-2 border-t border-amber-800/30 flex items-start justify-between gap-3 text-[11px] text-amber-200/90">
                      <div>
                        {att.issue_remarks ? (
                          <span>{att.issue_remarks}</span>
                        ) : (
                          <span className="italic text-amber-300/70">No additional remarks provided</span>
                        )}
                      </div>
                      {att.issue_proof_url && (
                        <a 
                          href={att.issue_proof_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="shrink-0 text-amber-400 hover:text-amber-300 underline font-medium flex items-center gap-1"
                        >
                          <Eye size={12} /> View Proof
                        </a>
                      )}
                    </div>
                  )}

                  {/* Delivery proof if confirmed on this attempt */}
                  {isDelivered && att.delivery_proof_url && (
                    <div className="mt-2 pt-2 border-t border-emerald-800/30 flex items-center justify-between text-[11px] text-emerald-300">
                      <span>Delivery confirmed by creator</span>
                      <a 
                        href={att.delivery_proof_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline font-medium flex items-center gap-1"
                      >
                        <Eye size={12} /> View Proof
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. ACTIONS FOOTER */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
        {selectedOption === 'PRODUCT_ISSUE' ? (
          <button 
            type="button"
            onClick={handleSave} 
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Reporting Issue...
              </>
            ) : (
              <>
                <AlertTriangle size={16} /> Report Issue & Request Re-Dispatch
              </>
            )}
          </button>
        ) : (
          <button 
            type="button"
            onClick={handleSave} 
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving Delivery...
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={3} /> Confirm Delivery & Unlock Video Steps
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// --- STEP: Call & Explain ---
const CallExplainForm = ({ record, existingData = {}, onSave }: any) => {
  const [callExplained, setCallExplained] = useState(
    existingData.call_explained !== undefined ? existingData.call_explained : (record.ref_call_explanation_required || false)
  );
  const [callNotes, setCallNotes] = useState(existingData.call_notes || '');
  const [callDatetime, setCallDatetime] = useState(
    existingData.call_datetime ? formatForDateTimeInput(existingData.call_datetime) : ''
  );
  const [phoneCalled, setPhoneCalled] = useState(
    existingData.phone_called || record.dispatch?.phone_number || ''
  );

  const handleSave = async () => {
    await onSave({
      call_explained: callExplained,
      call_notes: callNotes,
      call_datetime: callDatetime ? new Date(callDatetime).toISOString() : new Date().toISOString(),
      phone_called: phoneCalled
    });
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
        <input 
          type="checkbox" 
          id="call-explained-checkbox"
          checked={callExplained}
          onChange={(e) => setCallExplained(e.target.checked)}
          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" 
        />
        <label htmlFor="call-explained-checkbox" className="text-sm font-medium text-slate-200 cursor-pointer">
          Call explanation completed with influencer (deliverables, guidelines & creative briefing explained).
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Phone Called</label>
          <input 
            type="text" 
            value={phoneCalled} 
            onChange={e => setPhoneCalled(e.target.value)} 
            placeholder="Influencer phone number"
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Call Date & Time</label>
          <input 
            type="datetime-local" 
            value={callDatetime} 
            onChange={e => setCallDatetime(e.target.value)} 
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Call Notes & Instructions</label>
          <textarea 
            value={callNotes} 
            onChange={e => setCallNotes(e.target.value)} 
            placeholder="Record influencer agreement, special requests, or instructions discussed during the call..."
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 h-28"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          Save Call Details
        </button>
      </div>
    </div>
  );
};

// --- STEP: Share Script ---
interface VoiceRecordData {
  file_name: string;
  file_size?: number;
  file_size_formatted?: string;
  storage_path?: string;
  url: string;
  uploaded_at?: string;
}

const formatAudioFileSize = (bytes?: number): string => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeVoiceRecord = (raw: any): VoiceRecordData | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      file_name: trimmed.split('/').pop() || 'voice-record.audio',
      url: trimmed
    };
  }
  if (typeof raw === 'object' && raw.url) {
    return {
      file_name: raw.file_name || raw.fileName || raw.url.split('/').pop() || 'voice-record.audio',
      file_size: raw.file_size || raw.fileSize,
      file_size_formatted: raw.file_size_formatted || (raw.file_size ? formatAudioFileSize(raw.file_size) : ''),
      storage_path: raw.storage_path || raw.storagePath || '',
      url: raw.url,
      uploaded_at: raw.uploaded_at || raw.uploadedAt
    };
  }
  return null;
};

const ShareScriptForm = ({ record, videoNumber = 1, existingData = {}, onSave }: any) => {
  const resolvedProductInfo = useMemo(() => getResolvedProductForVideo(record.influencer, videoNumber), [record.influencer, videoNumber]);
  const resolvedProductName = resolvedProductInfo.productName;

  // Detect if concept is currently empty or contains legacy video label placeholder (e.g. "Video 1", "Video 2")
  const rawConcept = existingData.concept || (videoNumber === 1 ? record.ref_concept : '') || '';
  const isLegacy = isVideoLabel(rawConcept);
  const initialConcept = isLegacy ? '' : rawConcept;

  const [concept, setConcept] = useState(initialConcept);
  const [hooks, setHooks] = useState(existingData.hooks || (videoNumber === 1 ? (record.ref_hooks || '') : '') || '');
  const [script, setScript] = useState(existingData.script || (videoNumber === 1 ? (record.ref_script || '') : '') || '');
  const [voiceRecord, setVoiceRecord] = useState<VoiceRecordData | null>(normalizeVoiceRecord(existingData.voice_record));
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scriptShared, setScriptShared] = useState(
    existingData.script_shared !== undefined 
      ? existingData.script_shared 
      : (videoNumber === 1 ? (!!record.reference_video_received || !!record.ref_script) : false)
  );

  const handleAudioFileSelect = async (file: File) => {
    if (!file) return;

    // Validate audio extension / type
    const validExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExts.includes(fileExt) && !file.type.startsWith('audio/')) {
      toast.error(`Please select a valid audio file (${validExts.join(', ').toUpperCase()})`);
      return;
    }

    // Size limit 50MB
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Audio file size must be less than 50MB');
      return;
    }

    setIsUploadingVoice(true);
    const toastId = toast.loading(`Uploading voice record: ${file.name}...`);

    try {
      const campId = record.campaign_id || 'general';
      const infId = record.influencer_id || 'inf';
      const uniqueKey = Math.random().toString(36).substring(2, 9);
      const filePath = `voice_records/camp_${campId}_inf_${infId}_v${videoNumber}_${Date.now()}_${uniqueKey}.${fileExt}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('influencer-profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabaseAdmin.storage
        .from('influencer-profiles')
        .getPublicUrl(filePath);

      const finalUrl = publicData.publicUrl;

      const newVoiceRecord: VoiceRecordData = {
        file_name: file.name,
        file_size: file.size,
        file_size_formatted: formatAudioFileSize(file.size),
        storage_path: filePath,
        url: finalUrl,
        uploaded_at: new Date().toISOString()
      };

      setVoiceRecord(newVoiceRecord);

      // Clean up previous storage file if replacing
      if (voiceRecord?.storage_path && voiceRecord.storage_path !== filePath) {
        supabaseAdmin.storage
          .from('influencer-profiles')
          .remove([voiceRecord.storage_path])
          .catch(e => console.warn('Previous voice record delete error:', e));
      }

      // Persist immediately so audio isn't lost on refresh or navigation
      const finalConcept = concept.trim() || (resolvedProductInfo.isAssigned ? resolvedProductName : '');
      await onSave({
        reference_video_received: scriptShared,
        script_shared: scriptShared,
        concept: finalConcept,
        product_name: resolvedProductInfo.isAssigned ? resolvedProductName : '',
        hooks: hooks || '',
        script: script || '',
        voice_record: newVoiceRecord,
        keypoints: existingData.keypoints || '',
        link: existingData.link || '',
        reference_videos_list: existingData.reference_videos_list || []
      });

      toast.success('Voice recording uploaded and saved successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Error uploading voice record:', err);
      toast.error('Failed to upload voice record: ' + (err?.message || err), { id: toastId });
    } finally {
      setIsUploadingVoice(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveVoiceRecord = async () => {
    if (!voiceRecord) return;
    const oldPath = voiceRecord.storage_path;
    setVoiceRecord(null);

    if (oldPath) {
      supabaseAdmin.storage
        .from('influencer-profiles')
        .remove([oldPath])
        .catch(e => console.warn('Could not remove file from storage:', e));
    }

    try {
      const finalConcept = concept.trim() || (resolvedProductInfo.isAssigned ? resolvedProductName : '');
      await onSave({
        reference_video_received: scriptShared,
        script_shared: scriptShared,
        concept: finalConcept,
        product_name: resolvedProductInfo.isAssigned ? resolvedProductName : '',
        hooks: hooks || '',
        script: script || '',
        voice_record: null,
        keypoints: existingData.keypoints || '',
        link: existingData.link || '',
        reference_videos_list: existingData.reference_videos_list || []
      });
      toast.success('Voice recording removed');
    } catch (err: any) {
      console.error('Error removing voice record:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAudioFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalConcept = concept.trim() || (resolvedProductInfo.isAssigned ? resolvedProductName : '');
      await onSave({ 
        reference_video_received: scriptShared,
        script_shared: scriptShared,
        concept: finalConcept, 
        product_name: resolvedProductInfo.isAssigned ? resolvedProductName : '',
        hooks: hooks || '',
        script: script || '', 
        voice_record: voiceRecord || null,
        keypoints: existingData.keypoints || '', 
        link: existingData.link || '', 
        reference_videos_list: existingData.reference_videos_list || []
      });
      toast.success('Script details saved successfully');
    } catch (err: any) {
      console.error('Error saving script details:', err);
      toast.error('Failed to save script details: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5 animate-fade-in">
      {/* 1. Checkbox: Script & Reference Materials Shared */}
      <div className="flex items-center gap-3 bg-[#0b1329] p-3.5 sm:p-4 rounded-xl border border-slate-800/90">
        <input 
          type="checkbox" 
          id="script-shared-checkbox"
          checked={scriptShared}
          onChange={(e) => setScriptShared(e.target.checked)}
          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
        />
        <label htmlFor="script-shared-checkbox" className="text-sm font-medium text-slate-200 cursor-pointer select-none">
          Script & reference materials shared and approved with the creator.
        </label>
      </div>

      {/* 2-Column Responsive Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-6 sm:gap-y-7">
        {/* ROW 1 - COL 1: Product / Campaign Concept */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            PRODUCT / CAMPAIGN CONCEPT
          </label>
          <div className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 flex items-center justify-between gap-3 h-[88px] sm:h-[92px]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0">
                <Package size={20} className={resolvedProductInfo.isAssigned ? 'text-purple-400' : 'text-slate-500'} />
              </div>
              <div className="min-w-0">
                <span className={`text-sm sm:text-base font-bold truncate block ${
                  resolvedProductInfo.isAssigned ? 'text-white' : 'text-slate-500 italic'
                }`}>
                  {resolvedProductName}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Assigned Campaign Product
                </span>
              </div>
            </div>
            <span className="text-[11px] text-purple-300 font-medium flex items-center gap-1.5 bg-purple-950/70 px-3 py-1.5 rounded-lg border border-purple-800/50 shrink-0 select-none shadow-sm">
              <Lock size={12} /> Auto-filled from Campaign Influencer
            </span>
          </div>
        </div>

        {/* ROW 1 - COL 2: Upload Voice Record */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              UPLOAD VOICE RECORD
            </label>
            <span className="text-xs text-slate-500 font-medium">Optional</span>
          </div>

          {!voiceRecord ? (
            /* Dropzone / Upload Area */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl px-4 py-3 h-[88px] sm:h-[92px] transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                isDragOver 
                  ? 'border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/20' 
                  : 'border-purple-800/60 bg-[#0b1329]/80 hover:border-purple-600 hover:bg-[#0b1329]'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleAudioFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden" 
              />

              {isUploadingVoice ? (
                <div className="flex items-center justify-center gap-3 w-full py-2">
                  <Loader2 size={24} className="text-purple-400 animate-spin shrink-0" />
                  <div className="text-left">
                    <span className="text-xs font-bold text-purple-300 block">Uploading voice recording...</span>
                    <span className="text-[11px] text-slate-500 block">Please wait a moment</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
                      <UploadCloud size={20} />
                    </div>
                    <div className="truncate min-w-0 text-left">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        Upload Voice Recording
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        Drag & drop or click to upload
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        MP3, WAV, M4A, AAC, OGG, WEBM (Max 50MB)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 shrink-0 pointer-events-none"
                  >
                    <UploadCloud size={13} />
                    <span>Choose File</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Uploaded Audio File Card with Audio Player */
            <div className="bg-[#0b1329] border border-purple-900/50 rounded-xl px-4 py-2.5 h-[88px] sm:h-[92px] flex flex-col justify-between gap-1.5 shadow-sm">
              {/* Top row: Audio Info + Actions */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-800/70 flex items-center justify-center text-purple-400 shrink-0">
                    <Volume2 size={14} />
                  </div>
                  <div className="truncate min-w-0">
                    <p className="text-xs font-bold text-white truncate" title={voiceRecord.file_name}>
                      {voiceRecord.file_name}
                    </p>
                    <p className="text-[10px] text-purple-300 font-mono">
                      {voiceRecord.file_size_formatted || ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a 
                    href={voiceRecord.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80 shrink-0" 
                    title="Open Audio in New Tab"
                  >
                    <ExternalLink size={12} />
                  </a>
                  <label className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold cursor-pointer transition-colors border border-slate-700/80 flex items-center gap-1 shrink-0">
                    <UploadCloud size={10} />
                    <span>Replace</span>
                    <input 
                      type="file" 
                      accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleAudioFileSelect(e.target.files[0]);
                        }
                      }} 
                      className="hidden" 
                    />
                  </label>
                  <button 
                    type="button" 
                    onClick={handleRemoveVoiceRecord} 
                    className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[10px] font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Remove voice recording"
                  >
                    <Trash2 size={10} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* Bottom row: Compact Audio Player */}
              <div className="w-full flex items-center">
                <audio 
                  controls 
                  src={voiceRecord.url} 
                  className="h-6 w-full rounded accent-purple-500" 
                  preload="metadata" 
                />
              </div>
            </div>
          )}
        </div>

        {/* ROW 2 - COL 1: Custom Concept / Angle Notes */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              CUSTOM CONCEPT / ANGLE NOTES
            </label>
            <span className="text-xs text-slate-500 font-medium">Optional</span>
          </div>
          <div className="relative">
            <textarea 
              rows={5}
              value={concept} 
              onChange={e => setConcept(e.target.value)} 
              placeholder="e.g. Morning Glow Routine, Unboxing & First Impressions..."
              className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 pb-7 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none h-[135px] sm:h-[140px]" 
            />
            <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 font-mono select-none">
              {concept.length}/1000
            </span>
          </div>
        </div>

        {/* ROW 2 - COL 2: Hooks */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              HOOKS
            </label>
            <span className="text-xs text-slate-500 font-medium">Optional</span>
          </div>
          <div className="relative">
            <textarea 
              rows={5}
              value={hooks} 
              onChange={e => setHooks(e.target.value)} 
              placeholder="Enter the video hook, opening line, attention-grabber..."
              className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 pb-7 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none h-[135px] sm:h-[140px]" 
            />
            <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 font-mono select-none">
              {hooks.length}/1000
            </span>
          </div>
        </div>

        {/* ROW 3: Proposed Script (Full Width across both columns) */}
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            PROPOSED SCRIPT
          </label>
          <div className="relative">
            <textarea 
              rows={6}
              value={script} 
              onChange={e => setScript(e.target.value)} 
              placeholder="Enter the proposed video talking points, hook, body, and call-to-action..."
              className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 pb-7 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none min-h-[160px] sm:min-h-[170px]" 
            />
            <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 font-mono select-none">
              {script.length}/2000
            </span>
          </div>
        </div>
      </div>

      {/* Save Action Button */}
      <div className="flex justify-end pt-3 border-t border-slate-800/90">
        <button 
          type="button"
          onClick={handleSave} 
          disabled={isSaving || isUploadingVoice}
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Script Details</span>
          )}
        </button>
      </div>
    </div>
  );
};

// --- STEP: Pay Advance (Video 1 Only) ---
const PayAdvanceForm = ({ record, existingData = {}, onSave, videoNumber = 1 }: any) => {
  const influencer = record.influencer || {};
  const dispatch = record.dispatch || {};

  const currentPaymentMethod = (influencer.payment_method || dispatch.payment_method || '').toUpperCase().trim();
  const currentUpi = (influencer.upi_number || dispatch.upi_number || '').trim();
  const currentAccountHolder = influencer.account_holder_name || dispatch.account_holder_name || '';
  const currentAccountNumber = influencer.account_number || dispatch.account_number || '';
  const currentIfsc = influencer.ifsc_code || dispatch.ifsc_code || '';
  const currentBankName = influencer.bank_name || dispatch.bank_name || '';

  const isAccount = currentPaymentMethod === 'ACCOUNT_DETAILS' || currentPaymentMethod.includes('ACCOUNT');
  const isUPI = currentPaymentMethod === 'UPI' || (!currentPaymentMethod && Boolean(currentUpi));
  const isHistorical = Boolean(existingData.pay_advance_completed || record.pay_advance_completed);

  const v1Price = useMemo(() => getInfluencerVideoPrice(influencer, 1), [influencer]);
  const totalCampaignPrice = useMemo(() => getInfluencerCampaignTotalPrice(influencer, record.pricing), [influencer, record.pricing]);

  const defaultTotal = isHistorical 
    ? (existingData.total || record.advance_total_amount || (v1Price !== null ? String(v1Price) : ''))
    : (v1Price !== null ? String(v1Price) : (existingData.total || record.advance_total_amount || ''));

  const [gpay, setGpay] = useState(existingData.gpay || record.advance_gpay_number || currentUpi || '');
  const [total, setTotal] = useState(defaultTotal);
  const [advance, setAdvance] = useState(existingData.advance || record.advance_paid_amount || '');

  // Keep total in sync if not historical and v1Price changes in Campaign Influencer
  useEffect(() => {
    if (!isHistorical && v1Price !== null) {
      setTotal(String(v1Price));
    }
  }, [v1Price, isHistorical]);
  
  const [photo, setPhoto] = useState(existingData.photo || record.pay_advance_photo_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const [transactions, setTransactions] = useState<InfluencerVideoPaymentTransaction[]>([]);

  const loadTransactions = useCallback(async () => {
    if (record?.campaign_id && record?.influencer_id) {
      const txs = await fetchVideoPaymentTransactions(record.campaign_id, record.influencer_id, 1);
      setTransactions(txs);
    }
  }, [record?.campaign_id, record?.influencer_id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const paymentInfoForCard: PaymentDetailsInfo = {
    payment_method: isHistorical && existingData.payment_method 
      ? existingData.payment_method 
      : (isAccount ? 'ACCOUNT_DETAILS' : (isUPI ? 'UPI' : (currentPaymentMethod || null))),
    upi_number: isHistorical && existingData.gpay ? existingData.gpay : (currentUpi || gpay),
    account_holder_name: currentAccountHolder,
    account_number: currentAccountNumber,
    ifsc_code: currentIfsc,
    bank_name: currentBankName
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    if (!total || !advance) {
      toast.error('Please enter both Video 1 Agreed Amount and Advance Amount.');
      return;
    }
    setIsUploading(true);
    let finalUrl = photo;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dispatch/${fileName}`;

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setPhoto(finalUrl);
      } catch (err) {
        console.error('Error uploading photo:', err);
        setIsUploading(false);
        return;
      }
    }

    await onSave({ 
      gpay: isUPI ? gpay : '', 
      total, 
      advance, 
      photo: finalUrl,
      payment_method: isAccount ? 'ACCOUNT_DETAILS' : 'UPI',
      upi_number: isUPI ? (gpay || currentUpi) : null,
      account_holder_name: currentAccountHolder,
      account_number: currentAccountNumber,
      ifsc_code: currentIfsc,
      bank_name: currentBankName,
      pay_advance_completed: true
    });
    setIsUploading(false);
    await loadTransactions();
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
      {/* Compact Payment Details Card */}
      <StatusTrackingPaymentCard 
        paymentInfo={paymentInfoForCard} 
        isHistorical={isHistorical}
        videoNumber={1}
        perVideoAmount={v1Price}
        totalCampaignAmount={totalCampaignPrice}
        paymentStatus={existingData.payment_status || (isHistorical ? 'paid' : 'pending')}
        transactions={transactions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Inputs & Upload */}
        <div className="space-y-4">
          {isUPI && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">
                GPay / UPI Number
              </label>
              <input 
                type="text" 
                value={gpay} 
                onChange={e => setGpay(e.target.value)} 
                placeholder="e.g. 9876543210@upi"
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">
              Video 1 Agreed Amount (₹)
            </label>
            <input 
              type="text" 
              value={total} 
              onChange={e => setTotal(e.target.value)} 
              placeholder={v1Price !== null ? String(v1Price) : "Not assigned"}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Advance Paid Amount (₹)</label>
            <input 
              type="text" 
              value={advance} 
              onChange={e => setAdvance(e.target.value)} 
              placeholder="e.g. 2000"
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
            />
          </div>

          {/* Remaining Balance Indicator for Video 1 */}
          {(() => {
            const numTotal = parseFloat(total);
            const numAdv = parseFloat(advance);
            if (!isNaN(numTotal) && !isNaN(numAdv) && numTotal > 0 && numAdv > 0) {
              const remaining = Math.max(0, numTotal - numAdv);
              return (
                <div className="bg-[#0b1329]/60 border border-slate-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Remaining Balance for Video 1:</span>
                  <span className="font-mono font-bold text-amber-400">₹{remaining.toLocaleString('en-IN')}</span>
                </div>
              );
            }
            return null;
          })()}
          
          <div className="pt-2">
            <div className="relative w-full h-24 border-2 border-dashed border-slate-700/80 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
              <UploadCloud className="text-blue-400 mb-1" size={20} />
              <span className="text-xs text-blue-300 font-medium">Upload Payment Screenshot</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          </div>
        </div>

        {/* Right: Screenshot Preview */}
        <div className="flex flex-col items-center justify-center">
          {preview ? (
            <div className="flex flex-col items-center w-full">
              <div className="w-full h-52 bg-[#0b1329] rounded-xl border border-slate-800 flex items-center justify-center p-2 mb-2 overflow-hidden shadow-lg">
                <img src={preview} alt="Screenshot Preview" className="max-w-full max-h-full object-contain rounded-lg" />
              </div>
              <span className="text-xs text-slate-400">Payment Screenshot Preview</span>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center w-full h-52 bg-[#0b1329] rounded-xl border border-slate-800/60 p-4 opacity-50">
               <UploadCloud className="text-slate-500 mb-2" size={28} />
               <span className="text-xs text-slate-400">No screenshot selected</span>
             </div>
          )}
        </div>

      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
        >
          {isUploading ? 'Saving...' : 'Save Advance Details'}
        </button>
      </div>
    </div>
  );
};

// --- STEP: Time Line (Auto-populated from Post Date / Draft Date with manual edit, reset & complete audit history) ---
interface ExpectedTimelineFormProps {
  record: StatusTrackingRecord;
  videoNumber: number;
  stepNumber?: number;
  existingData?: any;
  onSave: (data: any) => Promise<any> | void;
}

const ExpectedTimelineForm: React.FC<ExpectedTimelineFormProps> = ({ 
  record, 
  videoNumber, 
  stepNumber,
  existingData = {}, 
  onSave 
}) => {
  const dynamicStepNumber = stepNumber || (videoNumber === 1 ? 4 : 3);

  // Check if this is a Re-Upload Timeline (from rejected draft)
  const isReUploadTimeline = existingData.is_re_upload_timeline === true || !!existingData.re_draft_submit_date;
  const sourceAttemptNum = existingData.source_attempt_number || 1;
  const reUploadStatus: 'Scheduled' | 'Submitted' | 'Completed' = existingData.re_upload_status || (isReUploadTimeline ? 'Scheduled' : 'Completed');

  // 1. Resolve scheduled draft date strictly for this videoNumber
  const scheduleEntry = (record.postDates || []).find(
    (pd: any) => Number(pd.video_number) === Number(videoNumber)
  );
  let scheduledDraftDate = scheduleEntry?.draft_date || '';
  if (!scheduledDraftDate && Array.isArray((record.dispatch as any)?.languages)) {
    const matchViews = (record.dispatch as any).languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:'));
    if (matchViews) {
      try {
        const vJson = JSON.parse(matchViews.substring('views_data:'.length));
        const found = (vJson?.post_dates || []).find((pd: any) => Number(pd.video_number) === Number(videoNumber));
        if (found?.draft_date) {
          scheduledDraftDate = parseToYMD(found.draft_date, 2026);
        } else if (found?.post_date) {
          scheduledDraftDate = calculateDraftDate(found.post_date, 2026);
        }
      } catch (e) {}
    }
  }

  // 2. Active date calculation
  const hasManualOverride = existingData.manualOverride === true;
  const initialEffectiveDate = isReUploadTimeline
    ? (existingData.date || existingData.re_draft_submit_date || '')
    : (hasManualOverride
        ? (existingData.date || '')
        : (scheduledDraftDate || existingData.date || (videoNumber === 1 ? (record.draft_expected_date || '') : '')));

  const [effectiveDate, setEffectiveDate] = useState<string>(initialEffectiveDate);
  const [time, setTime] = useState(existingData.time || (videoNumber === 1 ? (record.draft_expected_time || '') : ''));
  const [isOverride, setIsOverride] = useState<boolean>(hasManualOverride);

  // Editing state for date
  const [isEditing, setIsEditing] = useState(false);
  const [tempEditDate, setTempEditDate] = useState(parseToYMD(initialEffectiveDate, 2026) || initialEffectiveDate || '');

  // History list
  const historyList: TimelineHistoryEntry[] = Array.isArray(existingData.history) ? existingData.history : [];

  // Synchronize state if props change
  useEffect(() => {
    const isOver = existingData.manualOverride === true;
    const eff = isReUploadTimeline
      ? (existingData.date || existingData.re_draft_submit_date || '')
      : (isOver
          ? (existingData.date || '')
          : (scheduledDraftDate || existingData.date || (videoNumber === 1 ? (record.draft_expected_date || '') : '')));
    setEffectiveDate(eff);
    setIsOverride(isOver);
    setTempEditDate(parseToYMD(eff, 2026) || eff || '');
    setTime(existingData.time || (videoNumber === 1 ? (record.draft_expected_time || '') : ''));
  }, [videoNumber, record.id, scheduledDraftDate, isReUploadTimeline, existingData.re_draft_submit_date, existingData.manualOverride, existingData.date, existingData.time]);

  const handleStartEdit = () => {
    setTempEditDate(parseToYMD(effectiveDate, 2026) || effectiveDate || '');
    setIsEditing(true);
  };

  const handleApplyEdit = async () => {
    if (!tempEditDate) {
      toast.error('Please pick a valid date.');
      return;
    }
    const normalizedNew = parseToYMD(tempEditDate, 2026) || tempEditDate;
    const previousDateFormatted = formatDisplayDateLocal(effectiveDate);
    const newDateFormatted = formatDisplayDateLocal(normalizedNew);

    if (previousDateFormatted === newDateFormatted) {
      setIsEditing(false);
      return;
    }

    const userName = await getCurrentUserName();
    const changeEntry: TimelineHistoryEntry = {
      id: `th-${Date.now()}`,
      old_date: previousDateFormatted,
      new_date: newDateFormatted,
      changed_by: userName,
      changed_at: new Date().toISOString(),
      reason: isReUploadTimeline 
        ? `Draft Attempt ${sourceAttemptNum}` 
        : (isOverride ? 'Manual Timeline override' : 'Timeline date updated')
    };

    const updatedHistory = [changeEntry, ...historyList];

    setEffectiveDate(normalizedNew);
    setIsEditing(false);

    // Save immediately to persist and update database
    await onSave({
      ...existingData,
      date: normalizedNew,
      time: time || '',
      is_re_upload_timeline: isReUploadTimeline,
      re_draft_submit_date: isReUploadTimeline ? normalizedNew : existingData.re_draft_submit_date,
      source_attempt_number: sourceAttemptNum,
      re_upload_status: reUploadStatus,
      manualOverride: !isReUploadTimeline,
      history: updatedHistory,
      expected_delivery_completed: !isReUploadTimeline
    });

    logActivity({
      department: 'Marketing',
      action: isReUploadTimeline ? 'Re-Upload Timeline Edited' : 'Timeline Date Edited',
      description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} ${isReUploadTimeline ? 're-upload timeline' : 'timeline'} changed from ${previousDateFormatted} to ${newDateFormatted}`,
      metadata: { video_number: videoNumber, old_date: previousDateFormatted, new_date: newDateFormatted }
    });

    toast.success(`Timeline date updated to ${newDateFormatted} and Post Date synced to ${formatDisplayDateLocal(calculatePostDateFromDraft(normalizedNew))} (+3 days).`);
  };

  const handleCancelEdit = () => {
    setTempEditDate(effectiveDate);
    setIsEditing(false);
  };

  const handleResetToDraftDate = async () => {
    if (!scheduledDraftDate) {
      toast.error('No scheduled draft date found for this video.');
      return;
    }
    const normalizedScheduled = parseToYMD(scheduledDraftDate, 2026) || scheduledDraftDate;
    const previousDateFormatted = formatDisplayDateLocal(effectiveDate);
    const newDateFormatted = formatDisplayDateLocal(normalizedScheduled);

    const userName = await getCurrentUserName();
    const resetHistoryEntry: TimelineHistoryEntry = {
      id: `th-${Date.now()}`,
      old_date: previousDateFormatted,
      new_date: newDateFormatted,
      changed_by: userName,
      changed_at: new Date().toISOString(),
      reason: 'Reset to original Draft Date'
    };

    const updatedHistory = [resetHistoryEntry, ...historyList];

    setEffectiveDate(normalizedScheduled);
    setIsOverride(false);
    setIsEditing(false);
    setTempEditDate(normalizedScheduled);

    // Persist reset state immediately
    await onSave({
      date: normalizedScheduled,
      time: time || '',
      manualOverride: false,
      is_re_upload_timeline: false,
      history: updatedHistory,
      expected_delivery_completed: true
    });

    logActivity({
      department: 'Marketing',
      action: 'Timeline Date Reset',
      description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} timeline reset to ${newDateFormatted}`,
      metadata: { video_number: videoNumber, old_date: previousDateFormatted, new_date: newDateFormatted }
    });

    toast.success(`Reset to scheduled draft date: ${newDateFormatted} and Post Date synced to ${formatDisplayDateLocal(calculatePostDateFromDraft(normalizedScheduled))} (+3 days).`);
  };

  const handleSaveTimeline = async () => {
    if (!effectiveDate) {
      toast.error(isReUploadTimeline ? 'Please assign an Expected Re-Draft Submit Date.' : 'Please assign an Expected Draft Delivery Date.');
      return;
    }

    const previousDateFormatted = formatDisplayDateLocal(initialEffectiveDate);
    const newDateFormatted = formatDisplayDateLocal(effectiveDate);
    let updatedHistory = [...historyList];

    // If date changed, record in history
    if (previousDateFormatted !== newDateFormatted || isOverride !== hasManualOverride) {
      const userName = await getCurrentUserName();
      const changeEntry: TimelineHistoryEntry = {
        id: `th-${Date.now()}`,
        old_date: previousDateFormatted,
        new_date: newDateFormatted,
        changed_by: userName,
        changed_at: new Date().toISOString(),
        reason: isReUploadTimeline 
          ? `Draft Attempt ${sourceAttemptNum}` 
          : (isOverride ? 'Manual Timeline override' : 'Timeline date updated')
      };
      updatedHistory = [changeEntry, ...historyList];

      logActivity({
        department: 'Marketing',
        action: isReUploadTimeline ? 'Re-Upload Timeline Saved' : 'Timeline Date Edited',
        description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} timeline changed from ${previousDateFormatted} to ${newDateFormatted}`,
        metadata: { video_number: videoNumber, old_date: previousDateFormatted, new_date: newDateFormatted }
      });
    }

    await onSave({
      ...existingData,
      date: effectiveDate,
      time: time || '',
      is_re_upload_timeline: isReUploadTimeline,
      re_draft_submit_date: isReUploadTimeline ? effectiveDate : existingData.re_draft_submit_date,
      source_attempt_number: sourceAttemptNum,
      re_upload_status: reUploadStatus,
      manualOverride: !isReUploadTimeline && isOverride,
      history: updatedHistory,
      expected_delivery_completed: !isReUploadTimeline
    });

    toast.success(isReUploadTimeline ? 'Re-Upload Timeline details saved!' : `Timeline details saved! Post Date synced to ${formatDisplayDateLocal(calculatePostDateFromDraft(effectiveDate))} (+3 days).`);
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      
      {/* Date Display or Inline Edit Card */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            {isReUploadTimeline ? `Step ${dynamicStepNumber}: Re-Upload Timeline` : 'Expected Draft Delivery Date'}
          </label>
          {isReUploadTimeline && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${
              reUploadStatus === 'Completed'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                : reUploadStatus === 'Submitted'
                  ? 'bg-blue-950/80 text-blue-400 border-blue-700/60'
                  : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
            }`}>
              {reUploadStatus === 'Completed' ? '✓ Completed' : (reUploadStatus === 'Submitted' ? '● Submitted' : '○ Scheduled')}
            </span>
          )}
        </div>
        
        {!isEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#0b1329] border border-slate-800 rounded-xl gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-base sm:text-lg font-bold font-mono tracking-wide ${effectiveDate ? 'text-white' : 'text-slate-500 italic'}`}>
                {effectiveDate ? formatDisplayDateLocal(effectiveDate) : 'Not Assigned'}
              </span>

              {effectiveDate && calculatePostDateFromDraft(effectiveDate) && (
                <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-[#070c18] px-2.5 py-1 rounded-lg border border-slate-800 shadow-sm">
                  <span className="text-slate-500 font-medium">Post Date (+3d):</span>
                  <span className="font-bold text-blue-400 font-mono">
                    {formatDisplayDateLocal(calculatePostDateFromDraft(effectiveDate))}
                  </span>
                </div>
              )}

              {isReUploadTimeline ? (
                <>
                  <span className="text-[11px] font-bold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2.5 py-0.5 rounded-md">
                    Re-Upload Timeline
                  </span>
                  <span className="text-xs text-slate-400">
                    Source: <strong className="text-slate-200 font-semibold">Draft Attempt {sourceAttemptNum}</strong>
                  </span>
                </>
              ) : isOverride ? (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2.5 py-0.5 rounded-md">
                  Manual Override
                </span>
              ) : scheduledDraftDate ? (
                <span className="text-[11px] font-bold text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2.5 py-0.5 rounded-md">
                  Auto-filled from Post Date (Video {videoNumber})
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-3.5 py-1.5 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Edit
              </button>

              {!isReUploadTimeline && isOverride && scheduledDraftDate && (
                <button
                  type="button"
                  onClick={handleResetToDraftDate}
                  className="px-3.5 py-1.5 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-bold transition-colors shadow-sm"
                  title="Restore original scheduled Draft Date"
                >
                  Reset to Draft Date
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#0b1329] border border-blue-500/60 rounded-xl space-y-3 animate-fade-in">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
              {isReUploadTimeline 
                ? `Edit Expected Re-Draft Submit Date (Video ${videoNumber})` 
                : `Edit Expected Draft Delivery Date (Video ${videoNumber})`}
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input 
                type="date" 
                value={tempEditDate} 
                onChange={e => setTempEditDate(e.target.value)} 
                className="flex-1 bg-[#070c18] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
            {tempEditDate && calculatePostDateFromDraft(tempEditDate) && (
              <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                <span className="text-slate-500">Calculated Post Date:</span>
                <strong className="text-blue-300 font-mono font-semibold">
                  {formatDisplayDateLocal(calculatePostDateFromDraft(tempEditDate))}
                </strong>
                <span className="text-slate-500 text-[11px]">(+3 calendar days)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expected Time Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Expected Time
          </label>
          <span className="text-[11px] text-slate-500 font-medium">[optional]</span>
        </div>
        <input 
          type="time" 
          value={time} 
          onChange={e => setTime(e.target.value)} 
          className="w-full sm:w-64 bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
        />
      </div>

      {/* Timeline Date History Section */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className={isReUploadTimeline ? "text-rose-400" : "text-blue-400"} />
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {isReUploadTimeline ? 'RE-DRAFT DATE HISTORY' : 'Timeline Date History'}
            </h5>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {historyList.length} change{historyList.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        <div className="space-y-2">
          {/* Base initial schedule reference */}
          <div className="p-3 rounded-xl bg-[#0b1329] border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full ${isReUploadTimeline ? 'bg-rose-400' : 'bg-purple-400'}`}></span>
              <span className="text-slate-400">
                {isReUploadTimeline 
                  ? `Initial Re-Draft Date from Draft Attempt ${sourceAttemptNum}:` 
                  : `Initial date from Post Date (Video ${videoNumber}):`}
              </span>
              <span className="font-bold text-white">
                {isReUploadTimeline 
                  ? formatDisplayDateLocal(existingData.re_draft_submit_date || effectiveDate) 
                  : (scheduledDraftDate ? formatDisplayDateLocal(scheduledDraftDate) : 'Not Scheduled')}
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
              isReUploadTimeline 
                ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' 
                : 'bg-purple-950/60 text-purple-300 border-purple-800/50'
            }`}>
              {isReUploadTimeline ? `Draft Attempt ${sourceAttemptNum}` : 'Source Schedule'}
            </span>
          </div>

          {/* Chronological History entries */}
          {historyList.map((entry, hIdx) => (
            <div key={entry.id || hIdx} className="p-3 rounded-xl bg-[#0b1329] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`w-2 h-2 rounded-full ${entry.reason?.includes('Reset') ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                <span className="text-slate-400 font-medium">{entry.old_date}</span>
                <span className="text-slate-500">→</span>
                <span className="font-bold text-white">{entry.new_date}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Changed by: <span className="text-slate-200 font-semibold">{entry.changed_by || 'Admin'}</span></span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-slate-500 text-[11px]">{formatHistoryTimestamp(entry.changed_at)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  entry.reason?.includes('Reset') 
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' 
                    : 'bg-amber-950/60 text-amber-300 border-amber-800/50'
                }`}>
                  {entry.reason || (isReUploadTimeline ? `Draft Attempt ${sourceAttemptNum}` : 'Override')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={handleSaveTimeline} 
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          {isReUploadTimeline ? 'Save Re-Upload Timeline' : 'Save Timeline'}
        </button>
      </div>
    </div>
  );
};

// --- STEP: Draft (Complete Approval / Re-Draft Loop / Multiple Attempts History) ---
interface DraftFormProps {
  record: StatusTrackingRecord;
  videoNumber: number;
  existingData?: any;
  onSave: (data: any, completed: boolean) => Promise<void> | void;
  onNavigateToPostDate?: () => void;
}

const DraftForm: React.FC<DraftFormProps> = ({ 
  record, 
  videoNumber, 
  existingData = {}, 
  onSave, 
  onNavigateToPostDate 
}) => {
  // Extract attempts or initialize with full video preservation
  const attempts: DraftAttempt[] = useMemo(() => {
    if (Array.isArray(existingData.attempts) && existingData.attempts.length > 0) {
      return existingData.attempts;
    }
    const legacyVid = existingData.vid || (videoNumber === 1 ? record.draft_video_url : '');
    const legacyApp = existingData.approval_status || existingData.appStat || (videoNumber === 1 ? record.draft_approval_status : '');
    if (legacyVid) {
      return [{
        attempt_number: 1,
        video_url: legacyVid,
        approval_status: legacyApp === 'Approved' ? 'Approved' : (legacyApp === 'Not Approved' ? 'Not Approved' : 'Pending Approval'),
        timing_status: existingData.timing || (videoNumber === 1 ? record.draft_timing_status : 'On Time'),
        corrections: existingData.corr || (videoNumber === 1 ? record.draft_corrections_required : ''),
        final_product_link: existingData.finalL || (videoNumber === 1 ? record.draft_final_product_link : ''),
        final_description: existingData.finalD || (videoNumber === 1 ? record.draft_final_description : ''),
        uploaded_at: record.created_at || new Date().toISOString()
      }];
    }
    return [];
  }, [existingData, record, videoNumber]);

  const activeAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  // Form State
  const [appStat, setAppStat] = useState<'Approved' | 'Not Approved' | ''>(
    (activeAttempt?.approval_status === 'Approved' || activeAttempt?.approval_status === 'Not Approved') 
      ? activeAttempt.approval_status 
      : (existingData.approval_status || '')
  );
  const [corr, setCorr] = useState(activeAttempt?.corrections || existingData.corr || '');
  const [finalL, setFinalL] = useState(activeAttempt?.final_product_link || existingData.finalL || '');
  const [finalD, setFinalD] = useState(activeAttempt?.final_description || existingData.finalD || '');

  // Re-Draft Submit Date for Not Approved
  const [reDraftSubmitDate, setReDraftSubmitDate] = useState<string>(
    activeAttempt?.re_draft_submit_date || existingData.latest_re_draft_submit_date || existingData.re_draft_submit_date || ''
  );

  useEffect(() => {
    if (activeAttempt?.re_draft_submit_date) {
      setReDraftSubmitDate(activeAttempt.re_draft_submit_date);
    } else if (existingData.latest_re_draft_submit_date) {
      setReDraftSubmitDate(existingData.latest_re_draft_submit_date);
    } else if (existingData.re_draft_submit_date) {
      setReDraftSubmitDate(existingData.re_draft_submit_date);
    }
  }, [activeAttempt, existingData.latest_re_draft_submit_date, existingData.re_draft_submit_date]);
  
  // Re-Draft Upload Mode State
  const [isReDraftMode, setIsReDraftMode] = useState(false);
  const [reDraftFile, setReDraftFile] = useState<File | null>(null);
  const [reDraftUrl, setReDraftUrl] = useState('');

  // Initial Draft Upload State
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialUrl, setInitialUrl] = useState(activeAttempt?.video_url || existingData.vid || '');

  const [isUploading, setIsUploading] = useState(false);
  const [calculatedTiming, setCalculatedTiming] = useState(
    activeAttempt?.timing_status || existingData.timing || 'Not Submit'
  );

  // Modal Video Preview State
  const [previewModalAttempt, setPreviewModalAttempt] = useState<DraftAttempt | null>(null);

  const expDate = record.draft_expected_date;
  const expTime = record.draft_expected_time;

  useEffect(() => {
    const activeVid = activeAttempt?.video_url || initialUrl;
    if (!activeVid && !initialFile && !reDraftFile) {
      setCalculatedTiming('Not Submit');
    } else {
      if (activeAttempt?.timing_status) {
        setCalculatedTiming(activeAttempt.timing_status);
      } else if (existingData.timing) {
        setCalculatedTiming(existingData.timing);
      } else if (expDate && expTime) {
        const expectedMs = new Date(`${expDate}T${expTime}`).getTime();
        const currentMs = new Date().getTime();
        const diffMs = currentMs - expectedMs;
        const tolerance = 5 * 60 * 1000;
        if (diffMs < -tolerance) setCalculatedTiming('Advance');
        else if (Math.abs(diffMs) <= tolerance) setCalculatedTiming('On Time');
        else setCalculatedTiming('Late');
      } else {
        setCalculatedTiming('On Time');
      }
    }
  }, [activeAttempt, initialUrl, initialFile, reDraftFile, expDate, expTime, existingData.timing]);

  // Handle Initial Draft Upload
  const handleInitialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setInitialFile(selectedFile);
      setInitialUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Handle Re-Draft File Select
  const handleReDraftSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setReDraftFile(selectedFile);
      setReDraftUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Submit Initial Draft (Attempt 1)
  const handleSubmitInitialDraft = async () => {
    if (!initialFile && !initialUrl) {
      toast.error('Please upload a draft video first.');
      return;
    }
    setIsUploading(true);
    let finalUrl = initialUrl;

    if (initialFile) {
      try {
        const fileExt = initialFile.name.split('.').pop() || 'mp4';
        const campId = record.campaign_id || 'camp';
        const infId = record.influencer_id || 'inf';
        const uniqueKey = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const filePath = `drafts/camp_${campId}_inf_${infId}_v${videoNumber}_att1_${uniqueKey}.${fileExt}`;

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, initialFile);
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setInitialUrl(finalUrl);
      } catch (err) {
        console.error('Error uploading draft video:', err);
        toast.error('Failed to upload video file.');
        setIsUploading(false);
        return;
      }
    }

    const firstAttempt: DraftAttempt = {
      attempt_number: 1,
      video_url: finalUrl,
      approval_status: 'Pending Approval',
      timing_status: calculatedTiming,
      uploaded_at: new Date().toISOString()
    };

    await onSave({
      attempts: [firstAttempt],
      active_attempt_number: 1,
      approval_status: 'Pending Approval',
      vid: finalUrl,
      timing: calculatedTiming
    }, false);

    setIsUploading(false);
    toast.success('Draft uploaded successfully! Please review and select approval status.');
  };

  // Submit Re-Draft (Attempt N + 1) — Creates new attempt, preserving all previous attempts permanently
  const handleSubmitReDraft = async () => {
    if (!reDraftFile && !reDraftUrl) {
      toast.error('Please select a new re-draft video file.');
      return;
    }
    setIsUploading(true);
    let finalUrl = reDraftUrl;
    const nextAttemptNumber = attempts.length + 1;

    if (reDraftFile) {
      try {
        const fileExt = reDraftFile.name.split('.').pop() || 'mp4';
        const campId = record.campaign_id || 'camp';
        const infId = record.influencer_id || 'inf';
        const uniqueKey = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const filePath = `drafts/camp_${campId}_inf_${infId}_v${videoNumber}_att${nextAttemptNumber}_${uniqueKey}.${fileExt}`;

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, reDraftFile);
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
      } catch (err) {
        console.error('Error uploading re-draft video:', err);
        toast.error('Failed to upload re-draft video file.');
        setIsUploading(false);
        return;
      }
    }

    const expectedSubmit = activeAttempt?.re_draft_submit_date || existingData.latest_re_draft_submit_date || existingData.re_draft_submit_date || '';
    const newAttempt: DraftAttempt = {
      attempt_number: nextAttemptNumber,
      video_url: finalUrl,
      approval_status: 'Pending Approval',
      timing_status: calculatedTiming,
      expected_submit_date: expectedSubmit,
      uploaded_at: new Date().toISOString()
    };

    // Permanently append new attempt
    const updatedAttempts = [...attempts, newAttempt];

    await onSave({
      attempts: updatedAttempts,
      active_attempt_number: nextAttemptNumber,
      approval_status: 'Pending Approval',
      vid: finalUrl,
      timing: calculatedTiming,
      corr: ''
    }, false);

    setIsUploading(false);
    setIsReDraftMode(false);
    setReDraftFile(null);
    setReDraftUrl('');
    setAppStat('');
    setCorr('');
    toast.success(`Re-Draft Attempt ${nextAttemptNumber} submitted for review!`);
  };

  // Save Approval Details (Approved or Not Approved)
  const handleSaveApproval = async () => {
    if (!activeAttempt && !initialUrl) {
      toast.error('No draft video submitted yet. Please upload a draft video first.');
      return;
    }

    if (!appStat) {
      toast.error('Please select either "Approved" or "Not Approved".');
      return;
    }

    if (appStat === 'Not Approved') {
      if (!corr || corr.trim() === '') {
        toast.error('Please enter correction instructions before rejecting a draft.');
        return;
      }
      if (!reDraftSubmitDate || reDraftSubmitDate.trim() === '') {
        toast.error('Please select the Re-Draft Submit Date before submitting the Not Approved status.');
        return;
      }
    }

    setIsUploading(true);
    const userName = await getCurrentUserName();
    const nowIso = new Date().toISOString();

    const isApproved = appStat === 'Approved';

    // Update active attempt in attempts array while preserving video_url and all history
    const updatedAttempts = attempts.map((att, idx) => {
      if (idx === attempts.length - 1) {
        return {
          ...att,
          approval_status: appStat,
          corrections: appStat === 'Not Approved' ? corr : '',
          re_draft_submit_date: appStat === 'Not Approved' ? reDraftSubmitDate : undefined,
          final_product_link: isApproved ? finalL : att.final_product_link,
          final_description: isApproved ? finalD : att.final_description,
          timing_status: calculatedTiming,
          reviewed_at: nowIso,
          reviewed_by: userName
        };
      }
      return att;
    });

    const payload = {
      attempts: updatedAttempts,
      active_attempt_number: activeAttempt?.attempt_number || 1,
      approval_status: appStat,
      vid: activeAttempt?.video_url || initialUrl,
      timing: calculatedTiming,
      corr: appStat === 'Not Approved' ? corr : '',
      re_draft_submit_date: appStat === 'Not Approved' ? reDraftSubmitDate : '',
      latest_re_draft_submit_date: appStat === 'Not Approved' ? reDraftSubmitDate : (existingData.latest_re_draft_submit_date || ''),
      finalL: isApproved ? finalL : '',
      finalD: isApproved ? finalD : ''
    };

    // Save to Supabase (completed is true ONLY if Approved!)
    await onSave(payload, isApproved);
    setIsUploading(false);

    if (isApproved) {
      toast.success('Draft approved! Video workflow unlocked and moved to Post Date.');
      if (onNavigateToPostDate) {
        onNavigateToPostDate();
      }
    } else {
      toast.error('Draft marked as Not Approved. Re-Draft required.');
    }
  };

  const isCurrentDraftNotApproved = activeAttempt?.approval_status === 'Not Approved';
  const isCurrentDraftApproved = activeAttempt?.approval_status === 'Approved';
  const isPendingApproval = activeAttempt && !isCurrentDraftApproved && !isCurrentDraftNotApproved;
  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      
      {/* 1. RE-DRAFT UPLOAD PANEL (When user clicked 'Upload Re-Draft') */}
      {isReDraftMode && (
        <div className="p-5 bg-[#0b1329] border border-blue-500/60 rounded-xl space-y-4 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h5 className="text-sm font-bold text-white">
                Submit Re-Draft (Attempt {(activeAttempt?.attempt_number || 1) + 1})
              </h5>
              <p className="text-xs text-slate-400">
                Upload revised video addressing the correction feedback. Previous drafts will be permanently preserved in history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setIsReDraftMode(false); setReDraftFile(null); setReDraftUrl(''); }}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:w-52 h-32 border-2 border-dashed border-blue-500/50 rounded-xl bg-[#070c18] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
              <UploadCloud className="text-blue-400 mb-1" size={26} />
              <span className="text-xs text-blue-300 font-medium">Select Re-Draft Video</span>
              <input 
                type="file" 
                accept="video/*,image/*" 
                onChange={handleReDraftSelect} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>

            <div className="flex-1 w-full min-h-32 border border-slate-800 rounded-xl bg-[#070c18] flex flex-col items-center justify-center p-3">
              {reDraftUrl ? (
                <div className="w-full flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-lg bg-black overflow-hidden flex items-center justify-center">
                    {(reDraftUrl.startsWith('blob:') || reDraftUrl.includes('.mp4') || reDraftUrl.includes('.webm') || reDraftUrl.includes('video')) ? (
                      <video src={reDraftUrl} className="w-full h-full object-cover" />
                    ) : (
                      <Video size={24} className="text-blue-400" />
                    )}
                  </div>
                  <span className="text-[11px] text-blue-300 font-medium truncate max-w-xs">{reDraftFile?.name}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500">No new re-draft video selected yet</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isUploading || (!reDraftFile && !reDraftUrl)}
              onClick={handleSubmitReDraft}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {isUploading ? 'Uploading...' : `Submit Re-Draft Attempt ${(activeAttempt?.attempt_number || 1) + 1}`}
            </button>
          </div>
        </div>
      )}

      {/* 2. FIRST-TIME DRAFT UPLOAD (When no draft has ever been uploaded) */}
      {attempts.length === 0 && !isReDraftMode && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <div className="relative w-full sm:w-52 h-36 border-2 border-dashed border-blue-500/40 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
              <UploadCloud className="text-blue-400 mb-1" size={26} />
              <span className="text-xs text-blue-300 font-medium">Upload Draft Video</span>
              <input 
                type="file" 
                accept="video/*,image/*" 
                onChange={handleInitialUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
            <div className="flex-1 min-h-36 border border-slate-800 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center p-3">
              {initialUrl ? (
                <div className="w-full flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-lg bg-black overflow-hidden flex items-center justify-center shadow">
                    {(initialUrl.startsWith('blob:') || initialUrl.includes('.mp4') || initialUrl.includes('.webm') || initialUrl.includes('video')) ? (
                      <video src={initialUrl} className="w-full h-full object-cover" />
                    ) : (
                      <Video size={24} className="text-blue-400" />
                    )}
                  </div>
                  <span className="text-[11px] text-blue-300 font-medium truncate max-w-xs">{initialFile?.name}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-medium">No Draft Video Selected</span>
              )}
            </div>
          </div>

          {initialFile && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleSubmitInitialDraft}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-md"
              >
                {isUploading ? 'Uploading...' : 'Save Uploaded Draft (Attempt 1)'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. DRAFT HISTORY (The Primary/Only Draft Section) */}
      {attempts.length > 0 && (
        <div className="space-y-4">
          {/* Header with Title on Left and Upload Re-Draft Button on Right */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History size={16} className="text-purple-400" />
              <h5 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                DRAFT HISTORY ({attempts.length} ATTEMPT{attempts.length === 1 ? '' : 'S'})
              </h5>
            </div>

            {/* Re-Draft Button at TOP-RIGHT when active attempt is Not Approved */}
            {isCurrentDraftNotApproved && !isReDraftMode && (
              <button
                type="button"
                onClick={() => {
                  const hasSavedDate = !!(activeAttempt?.re_draft_submit_date || existingData.latest_re_draft_submit_date || existingData.re_draft_submit_date);
                  if (!hasSavedDate) {
                    toast.error('Please select and save the Re-Draft Submit Date before uploading a re-draft.');
                    return;
                  }
                  setIsReDraftMode(true);
                }}
                disabled={!(activeAttempt?.re_draft_submit_date || existingData.latest_re_draft_submit_date || existingData.re_draft_submit_date)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                  !(activeAttempt?.re_draft_submit_date || existingData.latest_re_draft_submit_date || existingData.re_draft_submit_date)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60 opacity-60'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                }`}
                title={!(activeAttempt?.re_draft_submit_date || existingData.latest_re_draft_submit_date || existingData.re_draft_submit_date) ? 'Re-Draft Submit Date required first' : 'Upload revised video'}
              >
                <UploadCloud size={15} />
                <span>Upload Re-Draft</span>
              </button>
            )}
          </div>

          {/* History Items (Compact rows) */}
          <div className="space-y-2.5">
            {attempts.map((att) => {
              const isCurrent = att.attempt_number === activeAttempt?.attempt_number;
              return (
                <div 
                  key={att.attempt_number} 
                  className={`p-3 sm:p-3.5 rounded-xl bg-[#0b1329] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                    isCurrent ? 'border-blue-500/40 bg-blue-950/10' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Compact Thumbnail + Attempt Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Compact Square Thumbnail (56x56) */}
                    <div 
                      onClick={() => setPreviewModalAttempt(att)}
                      className="relative w-14 h-14 rounded-lg bg-black border border-slate-700/80 shrink-0 overflow-hidden cursor-pointer group flex items-center justify-center shadow-sm"
                      title="Click to view video"
                    >
                      {att.video_url ? (
                        <>
                          <video src={att.video_url} className="w-full h-full object-cover" preload="metadata" />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                            <Play size={15} className="text-white fill-white group-hover:scale-110 transition-transform" />
                          </div>
                        </>
                      ) : (
                        <Video size={16} className="text-slate-500" />
                      )}
                    </div>

                    <div className="truncate min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs sm:text-sm">
                          Draft Attempt {att.attempt_number}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                            Current
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          att.approval_status === 'Approved'
                            ? 'bg-emerald-950/70 text-emerald-400 border-emerald-700/60'
                            : att.approval_status === 'Not Approved'
                              ? 'bg-rose-950/70 text-rose-400 border-rose-700/60'
                              : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                        }`}>
                          {att.approval_status === 'Approved' ? '✓ Approved' : (att.approval_status === 'Not Approved' ? '✕ Not Approved' : 'Pending Approval')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                        <span>
                          Uploaded: {formatHistoryTimestamp(att.uploaded_at)}
                        </span>
                        {att.expected_submit_date && (
                          <span className="text-blue-300 font-medium">
                            • Expected: {formatDisplayDateLocal(att.expected_submit_date)}
                          </span>
                        )}
                        {att.re_draft_submit_date && att.approval_status === 'Not Approved' && (
                          <span className="text-rose-300 font-semibold bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded">
                            Re-Draft Due: {formatDisplayDateLocal(att.re_draft_submit_date)}
                          </span>
                        )}
                      </div>

                      {att.corrections && (
                        <p className="text-rose-300 text-[11px] truncate max-w-lg" title={att.corrections}>
                          <span className="text-rose-400 font-semibold">Feedback:</span> {att.corrections}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: View Button */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    {att.reviewed_at && (
                      <span className="text-[10px] text-slate-500 hidden md:inline">
                        Reviewed: {formatHistoryTimestamp(att.reviewed_at)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewModalAttempt(att)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. APPROVAL & TIMING CONTROLS (Displayed ONLY when active draft is Pending Approval) */}
      {!isReDraftMode && isPendingApproval && (
        <div className="space-y-6 pt-2 border-t border-slate-800 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            
            {/* Approval Status Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Approval Status (Draft Attempt {activeAttempt?.attempt_number || 1})
              </label>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setAppStat('Approved')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    appStat === 'Approved' 
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30' 
                      : 'bg-[#0b1329] text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <Check size={15} />
                  <span>Approved</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setAppStat('Not Approved')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    appStat === 'Not Approved' 
                      ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30' 
                      : 'bg-[#0b1329] text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <XCircle size={15} />
                  <span>Not Approved</span>
                </button>
              </div>
            </div>

            {/* Timing Status Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Timing Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Advance', 'On Time', 'Late', 'Not Submit'].map((ts) => (
                  <div 
                    key={ts} 
                    onClick={() => setCalculatedTiming(ts)}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      calculatedTiming === ts ? 'bg-blue-600/15 border-blue-500/60' : 'bg-[#0b1329] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="timingStatus"
                      checked={calculatedTiming === ts} 
                      onChange={() => setCalculatedTiming(ts)}
                      className="w-3.5 h-3.5 rounded-full border-slate-700 bg-slate-900 text-blue-500 focus:ring-0" 
                    />
                    <span className={`text-xs ${calculatedTiming === ts ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
                      {ts}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Correction Instructions & Re-Draft Submit Date (When Not Approved is selected) */}
          {appStat === 'Not Approved' && (
            <div className="animate-fade-in space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                  Correction Instructions / Re-Draft Guidelines *
                </label>
                <textarea 
                  value={corr} 
                  onChange={e => setCorr(e.target.value)} 
                  placeholder="Enter specific instructions on what needs to be changed for the re-draft..."
                  className="w-full bg-[#0b1329] border border-rose-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 min-h-[90px]" 
                />
                <span className="text-[11px] text-slate-500">
                  These instructions will be permanently recorded in the draft history and displayed to guide the re-draft.
                </span>
              </div>

              {/* Mandatory Re-Draft Submit Date */}
              <div className="p-4 bg-rose-950/25 border border-rose-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                    Re-Draft Submit Date *
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 border border-rose-700/60 uppercase">
                    Required
                  </span>
                </div>
                <input 
                  type="date"
                  value={reDraftSubmitDate}
                  onChange={e => setReDraftSubmitDate(e.target.value)}
                  className="w-full bg-[#070c18] border border-rose-700/70 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  required
                />
                <span className="text-[11px] text-slate-400 block">
                  The expected submission date for Draft Attempt {(activeAttempt?.attempt_number || 1) + 1}. This date will automatically populate the Re-Upload Timeline.
                </span>
              </div>
            </div>
          )}

          {/* Approved Deliverables Info (When Approved is selected) */}
          {appStat === 'Approved' && (
            <div className="animate-fade-in space-y-4 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
              <h6 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Check size={14} /> Approved Deliverable Info
              </h6>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Final Product Link</label>
                  <input 
                    type="text" 
                    value={finalL} 
                    onChange={e => setFinalL(e.target.value)} 
                    placeholder="https://..."
                    className="w-full bg-[#070c18] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Final Caption / Description</label>
                  <input 
                    type="text" 
                    value={finalD} 
                    onChange={e => setFinalD(e.target.value)} 
                    placeholder="Caption text"
                    className="w-full bg-[#070c18] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button 
              onClick={handleSaveApproval} 
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              {isUploading ? 'Saving...' : 'Save Draft Details'}
            </button>
          </div>
        </div>
      )}

      {/* 6. CENTERED VIDEO PREVIEW MODAL */}
      {previewModalAttempt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="bg-[#0b1329] border border-slate-700 rounded-2xl max-w-[540px] w-full p-4 sm:p-5 space-y-3.5 shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Video size={18} className="text-blue-400" />
                  <span>Draft Attempt {previewModalAttempt.attempt_number} Preview</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Video {videoNumber} • Uploaded {formatHistoryTimestamp(previewModalAttempt.uploaded_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  previewModalAttempt.approval_status === 'Approved'
                    ? 'bg-emerald-950/70 text-emerald-400 border-emerald-700/60'
                    : previewModalAttempt.approval_status === 'Not Approved'
                      ? 'bg-rose-950/70 text-rose-400 border-rose-700/60'
                      : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                }`}>
                  {previewModalAttempt.approval_status || 'Pending Approval'}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalAttempt(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Video Player in Modal - Compact Centered 4:3 Aspect Ratio Container */}
            <div className="w-full flex justify-center">
              <div className="w-full aspect-[4/3] max-h-[380px] bg-black rounded-xl overflow-hidden border border-slate-800/90 flex items-center justify-center shadow-inner">
                {previewModalAttempt.video_url ? (
                  <video 
                    src={previewModalAttempt.video_url} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <div className="p-8 text-xs text-slate-500">Video source not found</div>
                )}
              </div>
            </div>

            {/* Details in Modal */}
            {previewModalAttempt.corrections && (
              <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-200">
                <span className="font-bold text-rose-400 block mb-1">Correction Instructions:</span>
                <p className="whitespace-pre-wrap">{previewModalAttempt.corrections}</p>
              </div>
            )}

            {previewModalAttempt.re_draft_submit_date && (
              <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs flex items-center justify-between text-rose-200">
                <span className="text-rose-400 font-semibold">Expected Re-Draft Submit Date:</span>
                <span className="font-bold">{formatDisplayDateLocal(previewModalAttempt.re_draft_submit_date)}</span>
              </div>
            )}

            {previewModalAttempt.reviewed_at && (
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Reviewed by: <span className="text-white font-semibold">{previewModalAttempt.reviewed_by || 'Admin'}</span>
                </span>
                <span>
                  {formatHistoryTimestamp(previewModalAttempt.reviewed_at)}
                </span>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewModalAttempt(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// --- STEP: Post Date (For Any Video 1 to 6) ---
const VideoPostForm = ({ videoNumber, record, existingData = {}, onSave }: any) => {
  // 1. Strict 1-to-1 match for Video N from record.postDates
  const scheduleEntry = (record.postDates || []).find(
    (pd: any) => Number(pd.video_number) === Number(videoNumber)
  );
  let scheduledPostDate = scheduleEntry?.post_date || '';

  // Fallback to views_data inside dispatch.languages
  if (!scheduledPostDate && Array.isArray((record.dispatch as any)?.languages)) {
    const matchViews = (record.dispatch as any).languages.find((l: string) => typeof l === 'string' && l.startsWith('views_data:'));
    if (matchViews) {
      try {
        const vJson = JSON.parse(matchViews.substring('views_data:'.length));
        const found = (vJson?.post_dates || []).find((pd: any) => Number(pd.video_number) === Number(videoNumber));
        if (found?.post_date) {
          scheduledPostDate = parseToYMD(found.post_date, 2026) || found.post_date;
        }
      } catch (e) {}
    }
  }

  if (!scheduledPostDate && scheduleEntry?.draft_date) {
    scheduledPostDate = calculatePostDateFromDraft(scheduleEntry.draft_date, 2026);
  }

  const isDateModified = existingData.is_modified === true;
  const initialEffectivePostDate = existingData.scheduled_post_date || scheduledPostDate || '';

  const [effectivePostDate, setEffectivePostDate] = useState<string>(initialEffectivePostDate);
  const [isEditingDate, setIsEditingDate] = useState<boolean>(false);
  const [tempPostDate, setTempPostDate] = useState<string>(
    parseToYMD(initialEffectivePostDate, 2026) || initialEffectivePostDate || ''
  );
  const [isSavingDate, setIsSavingDate] = useState<boolean>(false);
  const [isSavingLiveDetails, setIsSavingLiveDetails] = useState<boolean>(false);

  // History list
  const historyList: PostDateHistoryEntry[] = Array.isArray(existingData.history) ? existingData.history : [];

  // Live post state
  const [platform, setPlatform] = useState(existingData.platform || 'Instagram');
  const [postLink, setPostLink] = useState(existingData.link || (videoNumber === 1 ? (record.final_post_link || '') : ''));
  const [postedAt, setPostedAt] = useState(
    existingData.postedAt ? formatForDateTimeInput(existingData.postedAt) : (videoNumber === 1 ? formatForDateTimeInput(record.final_post_actual_datetime) : '')
  );
  const [confirmedLive, setConfirmedLive] = useState(
    existingData.confirmed_live !== undefined
      ? !!existingData.confirmed_live
      : (existingData.confirmed !== undefined ? !!existingData.confirmed : (videoNumber === 1 ? !!record.final_post_completed : false))
  );

  // Synchronize state if props change
  useEffect(() => {
    const eff = existingData.scheduled_post_date || scheduledPostDate || '';
    setEffectivePostDate(eff);
    setTempPostDate(parseToYMD(eff, 2026) || eff || '');
    setPlatform(existingData.platform || 'Instagram');
    setPostLink(existingData.link || (videoNumber === 1 ? (record.final_post_link || '') : ''));
    setPostedAt(
      existingData.postedAt ? formatForDateTimeInput(existingData.postedAt) : (videoNumber === 1 ? formatForDateTimeInput(record.final_post_actual_datetime) : '')
    );
    const isLive = existingData.confirmed_live !== undefined
      ? existingData.confirmed_live
      : (existingData.confirmed !== undefined ? existingData.confirmed : (videoNumber === 1 ? record.final_post_completed : false));
    setConfirmedLive(!!isLive);
  }, [videoNumber, record.id, scheduledPostDate, existingData.scheduled_post_date, existingData.link, existingData.postedAt, existingData.confirmed_live, existingData.confirmed, existingData.platform, record.final_post_link, record.final_post_actual_datetime, record.final_post_completed]);

  const platforms = ['Instagram', 'YouTube', 'Facebook'];

  const handleStartEditDate = () => {
    setTempPostDate(parseToYMD(effectivePostDate, 2026) || effectivePostDate || '');
    setIsEditingDate(true);
  };

  const handleCancelEditDate = () => {
    setTempPostDate(parseToYMD(effectivePostDate, 2026) || effectivePostDate || '');
    setIsEditingDate(false);
  };

  const handleSavePostDate = async () => {
    if (!tempPostDate) {
      toast.error('Please pick a valid Post Date.');
      return;
    }

    const normalizedNewYmd = parseToYMD(tempPostDate, 2026) || tempPostDate;
    const previousDateFormatted = formatDisplayDateLocal(effectivePostDate);
    const newDateFormatted = formatDisplayDateLocal(normalizedNewYmd);

    if (previousDateFormatted === newDateFormatted && effectivePostDate) {
      setIsEditingDate(false);
      return;
    }

    setIsSavingDate(true);
    try {
      const userName = await getCurrentUserName();
      const changeEntry: PostDateHistoryEntry = {
        id: `pdh-${Date.now()}`,
        old_date: previousDateFormatted,
        new_date: newDateFormatted,
        changed_by: userName,
        changed_at: new Date().toISOString(),
        reason: 'Post Date edited in Status Tracking'
      };

      const updatedHistory = [changeEntry, ...historyList];

      // 1. Sync Supabase tables: influencer_post_dates_rows & influencers_info_rows
      const syncRes = await syncInfluencerPostDate({
        influencerId: record.influencer_id,
        campaignId: record.campaign_id,
        videoNumber,
        newPostDate: normalizedNewYmd
      });

      if (!syncRes.success) {
        toast.error('Failed to sync Post Date: ' + (syncRes.error || 'Database error'));
        setIsSavingDate(false);
        return;
      }

      // 2. Save to Status Tracking workflow step
      const saveRes = await onSave({
        ...existingData,
        scheduled_post_date: normalizedNewYmd,
        history: updatedHistory,
        is_modified: true,
        platform,
        link: postLink ? postLink.trim() : '',
        postedAt: postedAt ? postedAt.trim() : (existingData.postedAt || ''),
        confirmed_live: confirmedLive,
        confirmed: confirmedLive,
        suppressDefaultToast: true
      }, confirmedLive);

      if (saveRes && saveRes.success === false) {
        toast.error('Failed to save Status Tracking: ' + (saveRes.error || 'Unknown error'));
        setIsSavingDate(false);
        return;
      }

      // 3. Log activity
      logActivity({
        department: 'Marketing',
        action: 'Post Date Edited',
        description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} Post Date changed from ${previousDateFormatted} to ${newDateFormatted}`,
        metadata: { video_number: videoNumber, old_date: previousDateFormatted, new_date: newDateFormatted }
      });

      // 4. Update UI only on full success
      setEffectivePostDate(normalizedNewYmd);
      setIsEditingDate(false);
      toast.success(`Video ${videoNumber} Post Date updated to ${newDateFormatted} and synchronized!`);
    } catch (err: any) {
      console.error('Error updating post date:', err);
      toast.error('Failed to update post date: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleResetToScheduledDate = async () => {
    if (!scheduledPostDate) {
      toast.error('No initial post date found in Influencer schedule.');
      return;
    }
    const normalizedScheduled = parseToYMD(scheduledPostDate, 2026) || scheduledPostDate;
    const previousDateFormatted = formatDisplayDateLocal(effectivePostDate);
    const newDateFormatted = formatDisplayDateLocal(normalizedScheduled);

    setIsSavingDate(true);
    try {
      const userName = await getCurrentUserName();
      const resetEntry: PostDateHistoryEntry = {
        id: `pdh-${Date.now()}`,
        old_date: previousDateFormatted,
        new_date: newDateFormatted,
        changed_by: userName,
        changed_at: new Date().toISOString(),
        reason: 'Reset to original Influencer Schedule'
      };

      const updatedHistory = [resetEntry, ...historyList];

      const syncRes = await syncInfluencerPostDate({
        influencerId: record.influencer_id,
        campaignId: record.campaign_id,
        videoNumber,
        newPostDate: normalizedScheduled
      });

      if (!syncRes.success) {
        toast.error('Failed to sync Post Date: ' + (syncRes.error || 'Database error'));
        setIsSavingDate(false);
        return;
      }

      const saveRes = await onSave({
        ...existingData,
        scheduled_post_date: normalizedScheduled,
        history: updatedHistory,
        is_modified: false,
        platform,
        link: postLink ? postLink.trim() : '',
        postedAt: postedAt ? postedAt.trim() : (existingData.postedAt || ''),
        confirmed_live: confirmedLive,
        confirmed: confirmedLive,
        suppressDefaultToast: true
      }, confirmedLive);

      if (saveRes && saveRes.success === false) {
        toast.error('Failed to save Status Tracking: ' + (saveRes.error || 'Unknown error'));
        setIsSavingDate(false);
        return;
      }

      setEffectivePostDate(normalizedScheduled);
      setTempPostDate(normalizedScheduled);
      setIsEditingDate(false);
      toast.success(`Reset to original schedule: ${newDateFormatted}`);
    } catch (err: any) {
      toast.error('Failed to reset: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleSaveLiveDetails = async () => {
    if (!postLink || !postLink.trim() || isFakeUrl(postLink)) {
      toast.error(`Please enter the Video ${videoNumber} live post link.`);
      return;
    }
    if (!postedAt || !postedAt.trim()) {
      toast.error('Please select the posting date and time.');
      return;
    }
    if (!confirmedLive) {
      toast.error('Please check the Confirmed Live checkbox.');
      return;
    }

    setIsSavingLiveDetails(true);
    try {
      // 1. Sync scheduled post date across Supabase tables if an effectivePostDate exists
      if (effectivePostDate) {
        const normalizedPostDate = parseToYMD(effectivePostDate, 2026) || effectivePostDate;
        const syncRes = await syncInfluencerPostDate({
          influencerId: record.influencer_id,
          campaignId: record.campaign_id,
          videoNumber,
          newPostDate: normalizedPostDate
        });
        if (!syncRes.success) {
          toast.error('Failed to sync scheduled post date: ' + (syncRes.error || 'Database error'));
          setIsSavingLiveDetails(false);
          return;
        }
      }

      // 2. Prepare payload preserving local date/time without UTC conversion drift
      const payload = {
        ...existingData,
        scheduled_post_date: effectivePostDate ? (parseToYMD(effectivePostDate, 2026) || effectivePostDate) : '',
        history: historyList,
        is_modified: isDateModified,
        platform,
        link: postLink.trim(),
        postedAt: postedAt.trim(),
        confirmed_live: confirmedLive,
        confirmed: confirmedLive,
        suppressDefaultToast: true
      };

      const saveRes = await onSave(payload, confirmedLive);

      if (saveRes && saveRes.success === false) {
        toast.error('Failed to save Video ' + videoNumber + ' Post Date: ' + (saveRes.error || 'Unknown error'));
        setIsSavingLiveDetails(false);
        return;
      }

      // 3. Activity logging
      logActivity({
        department: 'Marketing',
        action: 'Post Live Confirmed',
        description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} marked live with link: ${postLink.trim()}`,
        metadata: { video_number: videoNumber, platform, link: postLink.trim(), posted_at: postedAt.trim() }
      });

      // 4. Success feedback ONLY after all operations succeed
      toast.success(`Video ${videoNumber} Post Date saved successfully!`);
    } catch (err: any) {
      console.error('Error saving live details:', err);
      toast.error('Failed to save Video ' + videoNumber + ' Post Date: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingLiveDetails(false);
    }
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      
      {/* 1. SCHEDULED POST DATE CARD (AUTO-FILLED + EDITABLE) */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
          Scheduled Post Date (Video {videoNumber})
        </label>

        {!isEditingDate ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#0b1329] border border-slate-800 rounded-xl gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-base sm:text-lg font-bold font-mono tracking-wide ${effectivePostDate ? 'text-white' : 'text-slate-500 italic'}`}>
                {effectivePostDate ? formatDisplayDateLocal(effectivePostDate) : 'Not Assigned'}
              </span>

              {isDateModified ? (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2.5 py-0.5 rounded-md">
                  Modified (Manual Edit)
                </span>
              ) : (historyList.length > 0 && historyList[0]?.reason?.includes('Draft')) ? (
                <span className="text-[11px] font-bold text-blue-300 bg-blue-950/70 border border-blue-800/60 px-2.5 py-0.5 rounded-md">
                  Auto-synced (+3 days from Draft Date)
                </span>
              ) : scheduledPostDate ? (
                <span className="text-[11px] font-bold text-blue-300 bg-blue-950/70 border border-blue-800/60 px-2.5 py-0.5 rounded-md">
                  Auto-filled from Post Date (Video {videoNumber})
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartEditDate}
                className="px-3.5 py-1.5 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Edit3 size={13} />
                Edit
              </button>

              {isDateModified && scheduledPostDate && (
                <button
                  type="button"
                  onClick={handleResetToScheduledDate}
                  disabled={isSavingDate}
                  className="px-3.5 py-1.5 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-bold transition-colors shadow-sm"
                  title="Restore original scheduled Post Date"
                >
                  Reset to Schedule
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#0b1329] border border-blue-500/60 rounded-xl space-y-3 animate-fade-in">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
              Edit Scheduled Post Date (Video {videoNumber})
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input 
                type="date" 
                value={tempPostDate} 
                onChange={e => setTempPostDate(e.target.value)} 
                className="flex-1 bg-[#070c18] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSavePostDate}
                  disabled={isSavingDate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingDate ? 'Saving...' : 'Save Date'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditDate}
                  disabled={isSavingDate}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. POST DATE HISTORY SECTION */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-400" />
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Post Date History
            </h5>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {historyList.length} change{historyList.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        <div className="space-y-2">
          {/* Base initial schedule reference */}
          <div className="p-3 rounded-xl bg-[#0b1329] border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span className="text-slate-400">Initial date from Influencer Info (Video {videoNumber}):</span>
              <span className="font-bold text-white">
                {scheduledPostDate ? formatDisplayDateLocal(scheduledPostDate) : 'Not Scheduled'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 shrink-0">
              Source Schedule
            </span>
          </div>

          {/* Chronological History entries */}
          {historyList.length > 0 ? (
            historyList.map((entry, hIdx) => (
              <div key={entry.id || hIdx} className="p-3 rounded-xl bg-[#0b1329] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${
                    entry.reason?.includes('Reset') 
                      ? 'bg-rose-400' 
                      : (entry.reason?.includes('Draft') ? 'bg-blue-400' : 'bg-amber-400')
                  }`}></span>
                  <span className="text-slate-400 font-medium">{entry.old_date}</span>
                  <span className="text-slate-500">→</span>
                  <span className="font-bold text-white">{entry.new_date}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">Changed by: <span className="text-slate-200 font-semibold">{entry.changed_by || 'Admin'}</span></span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500 text-[11px]">{formatHistoryTimestamp(entry.changed_at)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    entry.reason?.includes('Reset') 
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' 
                      : (entry.reason?.includes('Draft') 
                          ? 'bg-blue-950/60 text-blue-300 border-blue-800/50' 
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/50')
                  }`}>
                    {entry.reason || 'Edited'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 rounded-xl bg-[#0b1329]/50 border border-slate-800/50 text-center">
              <p className="text-slate-500 text-xs italic">No date changes yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. LIVE POST CONFIRMATION & DETAILS */}
      <div className="pt-4 border-t border-slate-800 space-y-5">
        <div className="flex items-center gap-3 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
          <input 
            type="checkbox" 
            id={`post-live-video-${videoNumber}`}
            checked={confirmedLive}
            onChange={(e) => setConfirmedLive(e.target.checked)}
            className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" 
          />
          <label htmlFor={`post-live-video-${videoNumber}`} className="text-sm font-medium text-slate-200 cursor-pointer">
            Video {videoNumber} is confirmed live and active on the platform.
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Select Platform</label>
            <div className="flex gap-3 max-w-md">
              {platforms.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    platform === p ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-[#0b1329] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Final Post Link</label>
              <input 
                type="text" 
                value={postLink} 
                onChange={e => setPostLink(e.target.value)} 
                placeholder="https://www.instagram.com/reel/..."
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Posting Date & Time</label>
              <input 
                type="datetime-local" 
                value={postedAt} 
                onChange={e => setPostedAt(e.target.value)} 
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button 
            type="button"
            onClick={handleSaveLiveDetails} 
            disabled={isSavingLiveDetails}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            {isSavingLiveDetails && <Loader2 size={16} className="animate-spin text-white" />}
            <span>
              {isSavingLiveDetails 
                ? `Saving Video ${videoNumber} Post Date...` 
                : `Save Video ${videoNumber} Post Date`}
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};

// --- STEP: Payment (Final step for Videos 2 to 6; NO Pay Advance) ---
const VideoPaymentForm = ({ videoNumber, record, existingData = {}, onSave }: any) => {
  const influencer = record.influencer || {};
  const dispatch = record.dispatch || {};

  const currentPaymentMethod = (influencer.payment_method || dispatch.payment_method || '').toUpperCase().trim();
  const currentUpi = (influencer.upi_number || dispatch.upi_number || '').trim();
  const currentAccountHolder = influencer.account_holder_name || dispatch.account_holder_name || '';
  const currentAccountNumber = influencer.account_number || dispatch.account_number || '';
  const currentIfsc = influencer.ifsc_code || dispatch.ifsc_code || '';
  const currentBankName = influencer.bank_name || dispatch.bank_name || '';

  const isAccount = currentPaymentMethod === 'ACCOUNT_DETAILS' || currentPaymentMethod.includes('ACCOUNT');
  const isUPI = currentPaymentMethod === 'UPI' || (!currentPaymentMethod && Boolean(currentUpi));
  const isHistorical = Boolean(existingData.payment_completed);

  const paymentInfoForCard: PaymentDetailsInfo = {
    payment_method: isHistorical && existingData.payment_method 
      ? existingData.payment_method 
      : (isAccount ? 'ACCOUNT_DETAILS' : (isUPI ? 'UPI' : (currentPaymentMethod || null))),
    upi_number: isHistorical && existingData.upi_number ? existingData.upi_number : currentUpi,
    account_holder_name: currentAccountHolder,
    account_number: currentAccountNumber,
    ifsc_code: currentIfsc,
    bank_name: currentBankName
  };

  // Resolve video product & expected payment amount for THIS video
  const perVideoPrice = useMemo(() => getInfluencerVideoPrice(record.influencer, videoNumber), [record.influencer, videoNumber]);
  const totalCampaignPrice = useMemo(() => getInfluencerCampaignTotalPrice(record.influencer, record.pricing), [record.influencer, record.pricing]);

  const defaultExpectedAmount = isHistorical
    ? (existingData.amount || (perVideoPrice !== null && perVideoPrice > 0 ? String(perVideoPrice) : ''))
    : (perVideoPrice !== null && perVideoPrice > 0 ? String(perVideoPrice) : (existingData.amount || ''));

  const [amount, setAmount] = useState(defaultExpectedAmount);
  const [paymentConfirmed, setPaymentConfirmed] = useState(existingData.payment_completed || false);
  const [photo, setPhoto] = useState(existingData.photo || '');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const [transactions, setTransactions] = useState<InfluencerVideoPaymentTransaction[]>([]);

  const loadTransactions = useCallback(async () => {
    if (record?.campaign_id && record?.influencer_id) {
      const txs = await fetchVideoPaymentTransactions(record.campaign_id, record.influencer_id, videoNumber);
      setTransactions(txs);
    }
  }, [record?.campaign_id, record?.influencer_id, videoNumber]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Sync if not historical and perVideoPrice updates
  useEffect(() => {
    if (!isHistorical && perVideoPrice !== null) {
      setAmount(String(perVideoPrice));
    }
  }, [perVideoPrice, isHistorical]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    if (!amount) {
      toast.error(`Please enter the payment amount for Video ${videoNumber}.`);
      return;
    }
    if (!paymentConfirmed) {
      toast.error('Please check the Payment Confirmed checkbox.');
      return;
    }

    setIsUploading(true);
    let finalUrl = photo;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dispatch/${fileName}`;

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setPhoto(finalUrl);
      } catch (err) {
        console.error('Error uploading payment photo:', err);
        setIsUploading(false);
        return;
      }
    }

    await onSave({
      amount,
      photo: finalUrl,
      payment_method: isHistorical && existingData.payment_method ? existingData.payment_method : (isAccount ? 'ACCOUNT_DETAILS' : 'UPI'),
      upi_number: isUPI ? currentUpi : null,
      account_number: isAccount ? currentAccountNumber : null,
      account_holder_name: currentAccountHolder,
      ifsc_code: currentIfsc,
      bank_name: currentBankName,
      payment_completed: paymentConfirmed
    });
    setIsUploading(false);
    await loadTransactions();
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
      {/* Compact Payment Details Card from Campaign Influencer */}
      <StatusTrackingPaymentCard 
        paymentInfo={paymentInfoForCard} 
        isHistorical={isHistorical}
        videoNumber={videoNumber}
        perVideoAmount={perVideoPrice}
        totalCampaignAmount={totalCampaignPrice}
        paymentStatus={existingData.payment_status || (paymentConfirmed ? 'paid' : 'pending')}
        transactions={transactions}
      />

      <div className="flex items-center gap-3 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
        <input 
          type="checkbox" 
          id={`payment-confirmed-video-${videoNumber}`}
          checked={paymentConfirmed}
          onChange={(e) => setPaymentConfirmed(e.target.checked)}
          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" 
        />
        <label htmlFor={`payment-confirmed-video-${videoNumber}`} className="text-sm font-medium text-slate-200 cursor-pointer">
          Payment for Video {videoNumber} has been completed and sent to the influencer.
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">
              Video {videoNumber} Agreed Amount (₹)
            </label>
            <input 
              type="text" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder={perVideoPrice !== null ? String(perVideoPrice) : "Not assigned"}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
            />
          </div>

          <div className="pt-2">
            <div className="relative w-full h-24 border-2 border-dashed border-slate-700/80 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
              <UploadCloud className="text-blue-400 mb-1" size={20} />
              <span className="text-xs text-blue-300 font-medium">Upload Payment Screenshot</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          {preview ? (
            <div className="flex flex-col items-center w-full">
              <div className="w-full h-52 bg-[#0b1329] rounded-xl border border-slate-800 flex items-center justify-center p-2 mb-2 overflow-hidden shadow-lg">
                <img src={preview} alt="Payment Screenshot" className="max-w-full max-h-full object-contain rounded-lg" />
              </div>
              <span className="text-xs text-slate-400">Payment Screenshot Preview</span>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center w-full h-52 bg-[#0b1329] rounded-xl border border-slate-800/60 p-4 opacity-50">
               <UploadCloud className="text-slate-500 mb-2" size={28} />
               <span className="text-xs text-slate-400">No screenshot selected</span>
             </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20"
        >
          {isUploading ? 'Saving...' : `Save Video ${videoNumber} Payment`}
        </button>
      </div>
    </div>
  );
};
