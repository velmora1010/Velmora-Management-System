import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Campaign } from '../../types';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import { 
  Clock, Package, Phone, FileText, Video, Check, 
  XCircle, PauseCircle, Target, Search, Trash2, MoreHorizontal, 
  RefreshCcw, X, UploadCloud, IndianRupee, Eye, Copy, ArrowLeft,
  History, RotateCcw, AlertTriangle, Lock, RefreshCw, Play, Pause, Edit3, Loader2,
  Mic, Volume2, ExternalLink, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Activity, Truck, Share2, Globe, GitBranch,
  Calendar, CreditCard, PhoneCall, PhoneOff, Users, CheckSquare, FastForward,
  FilePlus, CheckCircle2, Save, Sparkles
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
import { resolveInfluencerPaymentDetails } from '../../utils/influencerPaymentUtils';
import { saveVideoPayment, fetchVideoPaymentTransactions, InfluencerVideoPayment, InfluencerVideoPaymentTransaction } from '../../services/influencerVideoPaymentService';
import { upsertCampaignVideoScript, type CampaignVideoScriptRecord } from '../../services/campaignVideoScriptService';
import { 
  fetchCampaignScripts, 
  getScriptAudioUrl, 
  getScriptVideoUrl, 
  type CampaignScript 
} from '../../services/campaignScriptService';
import { 
  StatusTrackingFilterDrawer, 
  type StatusTrackingFilterState, 
  initialStatusTrackingFilterState,
  STATUS_TRACKING_PRICE_RANGES,
  STATUS_TRACKING_WORKFLOW_STATUSES,
  STATUS_TRACKING_DELIVERY_STATUSES
} from '../../components/marketing/StatusTrackingFilterDrawer';
import { areFilterValuesEqual, getUniqueFilterOptions } from '../../utils/filterUtils';
import { 
  shipmentAttemptService, 
  type ShipmentAttempt, 
  type ShipmentIssueType,
  cleanCodeRef,
  extractInfluencerCodeFromOrderId
} from '../../services/shipmentAttemptService';
import { reDispatchQueueService } from '../../services/reDispatchQueueService';
import { 
  isInfluencerInReDispatch as isInfluencerInReDispatchUtil,
  isInfluencerReDispatchActive as isInfluencerReDispatchActiveUtil,
  isInfluencerWorkflowNotStarted as isWorkflowNotStartedUtil,
  getInfluencerWorkflowStatus as getInfluencerWorkflowStatusUtil,
  getCurrentWorkflowState,
  getRecordNotesMetadata
} from '../../utils/workflowStatusUtils';

interface CampaignStatusTrackingProps {
  campaign: Campaign;
  onBack: () => void;
}

// Configurable default videos count for this campaign
export const DEFAULT_CAMPAIGN_VIDEOS_COUNT = 6;

export type WorkflowStepKey = 'delivery' | 'video1' | 'video2' | 'video3' | 'video4' | 'video5' | 'video6';

export const normalizeWorkflowStepId = (val: string): string => {
  if (!val) return '';
  const s = val.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s.includes('sharescript') || s === 'script') return 'share_script';
  if (s.includes('callexplain') || s.includes('call') || s.includes('explain')) return 'call_explain';
  if (s.includes('advance') || s.includes('payadvance')) return 'pay_advance';
  if (s.includes('timeline')) return 'timeline';
  if (s.includes('draft')) return 'draft';
  if (s.includes('postdate') || s.includes('post')) return 'post_date';
  if (s.includes('payment') || s.includes('finalpayment')) return 'payment';
  if (s.includes('deliveryconfirmed')) return 'Delivery Confirmed';
  if (s.includes('notdelivered')) return 'Not Delivered';
  if (s.includes('delivered')) return 'Delivered';
  return val;
};

export const normalizeWorkflowStepLabel = (val: string): string => {
  const id = normalizeWorkflowStepId(val);
  switch (id) {
    case 'share_script': return 'Share Script';
    case 'call_explain': return 'Call & Explain';
    case 'pay_advance': return 'Pay Advance';
    case 'timeline': return 'Timeline';
    case 'draft': return 'Draft';
    case 'post_date': return 'Post Date';
    case 'payment': return 'Payment';
    default: return val;
  }
};

export interface VideoStepConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: any;
}

// VIDEO 1 WORKFLOW STEPS: Delivered -> Share Script -> Call & Explain -> Pay Advance -> Time Line -> Draft -> Post Date (7 steps, NO Payment)
export const VIDEO_1_STEP_CONFIGS: VideoStepConfig[] = [
  { id: 'delivered', label: 'Delivered', shortLabel: 'Delivered', icon: Truck },
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'call_explain', label: 'Call & Explain', shortLabel: 'Call Explain', icon: Phone },
  { id: 'pay_advance', label: 'Pay Advance', shortLabel: 'Pay Advance', icon: CreditCard },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Calendar },
];

// VIDEOS 2 TO 6 WORKFLOW STEPS: Share Script -> Call & Explain -> Time Line -> Draft -> Post Date -> Payment (6 steps, NO Delivered, NO Pay Advance)
export const VIDEO_N_STEP_CONFIGS: VideoStepConfig[] = [
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'call_explain', label: 'Call & Explain', shortLabel: 'Call Explain', icon: Phone },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Calendar },
  { id: 'payment', label: 'Payment', shortLabel: 'Payment', icon: IndianRupee },
];

export const getVideoWorkflowConfigs = (videoNumber: number): VideoStepConfig[] => {
  return videoNumber === 1 ? VIDEO_1_STEP_CONFIGS : VIDEO_N_STEP_CONFIGS;
};

// Backward compatibility alias
export const VIDEO_WORKFLOW_CONFIGS = VIDEO_1_STEP_CONFIGS;

// Top Workflow Summary Box Step Definitions: Video-specific single source of truth
export interface WorkflowSummaryBoxConfig {
  id: string;
  label: string;
  shortLabel?: string;
  icon: any;
}

export const VIDEO_1_SUMMARY_BOX_CONFIGS: WorkflowSummaryBoxConfig[] = [
  { id: 'delivered', label: 'Delivered', shortLabel: 'Delivered', icon: Truck },
  { id: 'not_started', label: 'Not Started', shortLabel: 'Not Started', icon: Clock },
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'call_explain', label: 'Call Explain', shortLabel: 'Call Explain', icon: PhoneCall },
  { id: 'call_skipped', label: 'Call Skipped', shortLabel: 'Call Skipped', icon: PhoneOff },
  { id: 'pay_advance', label: 'Pay Advance', shortLabel: 'Pay Advance', icon: CreditCard },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Calendar },
  { id: 're_dispatch', label: 'Re-Dispatch', shortLabel: 'Re-Dispatch', icon: RotateCcw },
];

export const VIDEO_N_SUMMARY_BOX_CONFIGS: WorkflowSummaryBoxConfig[] = [
  { id: 'not_started', label: 'Not Started', shortLabel: 'Not Started', icon: Clock },
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'call_explain', label: 'Call Explain', shortLabel: 'Call Explain', icon: PhoneCall },
  { id: 'call_skipped', label: 'Call Skipped', shortLabel: 'Call Skipped', icon: PhoneOff },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Calendar },
  { id: 'payment', label: 'Payment', shortLabel: 'Payment', icon: IndianRupee },
];

export const getVideoSummaryBoxConfigs = (videoNumber: number): WorkflowSummaryBoxConfig[] => {
  return videoNumber === 1 ? VIDEO_1_SUMMARY_BOX_CONFIGS : VIDEO_N_SUMMARY_BOX_CONFIGS;
};

// Backward compatibility alias
export const WORKFLOW_SUMMARY_BOX_CONFIGS = VIDEO_1_SUMMARY_BOX_CONFIGS;

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
// PAYMENT PROOF DATA & HELPERS (IMAGES & PDFS)
// =========================================================================
export interface PaymentProofData {
  url: string;
  storage_path?: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  fileSizeFormatted?: string;
  uploadedAt: string;
}

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getStoragePathFromUrl = (url?: string | null, bucketName: string = 'influencer-profiles'): string | null => {
  if (!url) return null;
  const marker = `/${bucketName}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(url.substring(idx + marker.length).split('?')[0]);
  }
  return null;
};

export const normalizePaymentProof = (raw: any): PaymentProofData | null => {
  if (!raw) return null;
  if (typeof raw === 'object' && raw.url) {
    const url = String(raw.url).trim();
    if (!url) return null;
    const isPdf = raw.mimeType === 'application/pdf' || url.toLowerCase().includes('.pdf');
    const defaultName = url.split('/').pop()?.split('?')[0] || (isPdf ? 'payment-proof.pdf' : 'payment-proof.jpg');
    const fSize = raw.fileSize || raw.file_size;
    return {
      url,
      storage_path: raw.storage_path || raw.storagePath || getStoragePathFromUrl(url) || '',
      fileName: raw.fileName || raw.file_name || defaultName,
      mimeType: raw.mimeType || raw.mime_type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      fileSize: fSize,
      fileSizeFormatted: raw.fileSizeFormatted || raw.file_size_formatted || (fSize ? formatFileSize(fSize) : ''),
      uploadedAt: raw.uploadedAt || raw.uploaded_at || new Date().toISOString()
    };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const isPdf = trimmed.toLowerCase().includes('.pdf');
    const defaultName = trimmed.split('/').pop()?.split('?')[0] || (isPdf ? 'payment-proof.pdf' : 'payment-proof.jpg');
    return {
      url: trimmed,
      storage_path: getStoragePathFromUrl(trimmed) || '',
      fileName: defaultName,
      mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
      uploadedAt: new Date().toISOString()
    };
  }
  return null;
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

/**
 * Strict normalizer for matching Product and Language values.
 * Trims whitespace, ignores lowercase/uppercase, and collapses symbols.
 */
export const normalizeScriptMatch = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Finds a matching Script Management record for a specific influencer and video number.
 * Strict exact match on BOTH Product AND Creator Language.
 */
const matchingScriptCache = new Map<string, CampaignScript | null>();

export function findMatchingScriptForInfluencer(
  scripts: CampaignScript[],
  record: any,
  videoNumber: number
): CampaignScript | null {
  if (!scripts || scripts.length === 0 || !record) return null;

  const recKey = record.id || record.dispatch_id || '';
  const cacheKey = `${scripts.length}_${recKey}_${videoNumber}_${record.updated_at || ''}`;
  if (matchingScriptCache.has(cacheKey)) {
    return matchingScriptCache.get(cacheKey) || null;
  }

  // 1. Resolve assigned product for this video
  const resolvedProductInfo = getResolvedProductForVideo(record.influencer, videoNumber);
  const effectiveProduct = resolvedProductInfo.isAssigned
    ? resolvedProductInfo.productName
    : (record.ref_concept && videoNumber === 1 ? record.ref_concept : '');

  if (!effectiveProduct) {
    matchingScriptCache.set(cacheKey, null);
    return null;
  }
  const normProduct = normalizeScriptMatch(effectiveProduct);
  if (!normProduct) {
    matchingScriptCache.set(cacheKey, null);
    return null;
  }

  // 2. Resolve languages for this creator
  const rawLangs = record.influencer?.languages || record.dispatch?.languages || [];
  let influencerLanguages: string[] = [];
  if (Array.isArray(rawLangs)) {
    influencerLanguages = rawLangs
      .filter((l: any) => typeof l === 'string' && !l.startsWith('views_data:'))
      .map((l: string) => l.trim())
      .filter(Boolean);
  } else if (typeof rawLangs === 'string') {
    influencerLanguages = rawLangs
      .split(/[,/]+/)
      .filter((l: string) => !l.startsWith('views_data:'))
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  // Also check if stepData has an explicit language saved
  try {
    const metadata = getRecordNotesMetadata(record);
    const stepLang = metadata.videos?.[String(videoNumber)]?.steps?.share_script?.data?.language;
    if (stepLang && typeof stepLang === 'string' && stepLang.trim()) {
      influencerLanguages.unshift(stepLang.trim());
    }
  } catch (e) {}

  if (influencerLanguages.length === 0) {
    matchingScriptCache.set(cacheKey, null);
    return null;
  }

  const result = scripts.find(s => {
    if (normalizeScriptMatch(s.product) !== normProduct) return false;
    const normScriptLang = normalizeScriptMatch(s.language);
    return influencerLanguages.some(infLang => normalizeScriptMatch(infLang) === normScriptLang);
  }) || null;

  if (matchingScriptCache.size > 2000) matchingScriptCache.clear();
  matchingScriptCache.set(cacheKey, result);
  return result;
}

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
const assignedVideosCache = new WeakMap<StatusTrackingRecord, number[]>();

export const getInfluencerAssignedVideos = (record: StatusTrackingRecord): number[] => {
  if (!record) return [];
  if (typeof record === 'object' && record !== null) {
    const cached = assignedVideosCache.get(record);
    if (cached) return cached;
  }

  let count = Number(record.pricing?.total_videos) || 0;
  
  if (Array.isArray(record.postDates) && record.postDates.length > 0) {
    const maxPd = Math.max(...record.postDates.map(p => Number(p.video_number) || 0));
    if (maxPd > count) count = maxPd;
  }
  
  try {
    const meta = getRecordNotesMetadata(record);
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

  if (typeof record === 'object' && record !== null) {
    assignedVideosCache.set(record, result);
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

/**
 * Checks if influencer is currently marked for Re-Dispatch (reported issue / package return)
 */
export interface ReDispatchCycle {
  cycle_number: number;
  status: 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'DELIVERED';
  issue_type: string;
  issue_remarks?: string;
  issue_proof_url?: string;
  reported_at: string;
  previous_awb?: string;
  previous_courier?: string;
  new_awb?: string;
  new_courier?: string;
  re_dispatch_date?: string;
  moved_to_active_at?: string | null;
  delivered_confirmed: boolean;
  delivery_photo_url?: string;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Derives the complete list of Re-Dispatch cycles for an influencer.
 * If redispatch_cycles array exists in notes metadata, returns it.
 * Otherwise, backward-compatibly synthesizes Cycle 1 for legacy records that have reported an issue or re-dispatch.
 */
export const getInfluencerReDispatchCycles = (record: StatusTrackingRecord): ReDispatchCycle[] => {
  let metadata: any = {};
  try {
    metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
  } catch (e) {
    metadata = {};
  }

  const isMovedToActiveOverall = Boolean(
    record.redispatch?.redispatch_status === 'MOVED_TO_ACTIVE' ||
    record.redispatch?.redispatch_status === 'COMPLETED' ||
    metadata.re_dispatch_moved_to_active ||
    metadata.moved_to_active ||
    metadata.redispatch_lifecycle_status === 'MOVED_TO_ACTIVE' ||
    metadata.redispatch_lifecycle_status === 'COMPLETED'
  );

  // 1. Direct structured cycles in notes
  if (Array.isArray(metadata.redispatch_cycles) && metadata.redispatch_cycles.length > 0) {
    if (isMovedToActiveOverall) {
      return metadata.redispatch_cycles.map((c: any, idx: number) => {
        if (idx === metadata.redispatch_cycles.length - 1 && c.status === 'PENDING_REDISPATCH') {
          return { ...c, status: 'MOVED_TO_ACTIVE' };
        }
        return c;
      });
    }
    return metadata.redispatch_cycles;
  }

  // 2. Synthesize Cycle 1 for legacy / existing records with re-dispatch activity
  const rawStatus = (record.status || '').toLowerCase();
  const dispatchStatus = ((record.dispatch as any)?.dispatch_status || '').toLowerCase();
  const hasRedispatchActivity = Boolean(
    metadata.issue_reported ||
    metadata.re_dispatch_required ||
    metadata.re_dispatch_moved_to_active ||
    metadata.moved_to_active ||
    metadata.redispatch_lifecycle_status ||
    record.redispatch ||
    rawStatus.includes('re-dispatch') ||
    rawStatus.includes('redispatch') ||
    dispatchStatus.includes('re_dispatch') ||
    dispatchStatus.includes('redispatch')
  );

  if (hasRedispatchActivity) {
    let status: 'PENDING_REDISPATCH' | 'MOVED_TO_ACTIVE' | 'DELIVERED' = 'PENDING_REDISPATCH';
    if (metadata.redispatch_lifecycle_status === 'COMPLETED' || record.redispatch?.redispatch_status === 'COMPLETED') {
      status = 'DELIVERED';
    } else if (
      isMovedToActiveOverall ||
      rawStatus.includes('active')
    ) {
      status = 'MOVED_TO_ACTIVE';
    } else {
      status = 'PENDING_REDISPATCH';
    }

    const cycle1: ReDispatchCycle = {
      cycle_number: 1,
      status,
      issue_type: metadata.issue_type || record.redispatch?.issue_type || 'DAMAGED_PRODUCT',
      issue_remarks: metadata.issue_remarks || record.redispatch?.issue_remark || '',
      issue_proof_url: metadata.issue_proof_url || '',
      reported_at: metadata.issue_reported_at || record.updated_at || record.created_at || new Date().toISOString(),
      previous_awb: metadata.source_awb || record.redispatch?.previous_awb || (record.dispatch as any)?.tracking_id || '',
      previous_courier: metadata.source_courier || record.redispatch?.courier || (record.dispatch as any)?.courier_partner || '',
      moved_to_active_at: metadata.moved_to_active_at || record.redispatch?.moved_to_active_at || null,
      delivered_confirmed: status === 'DELIVERED' || Boolean(record.delivered_confirmed && !metadata.re_dispatch_required && !metadata.re_dispatch_moved_to_active),
      delivery_photo_url: record.delivery_photo_url || metadata.delivery_photo_url || '',
      delivered_at: metadata.delivered_date || null,
      created_at: record.created_at || new Date().toISOString(),
      updated_at: metadata.last_updated || record.updated_at || new Date().toISOString()
    };
    return [cycle1];
  }

  return [];
};

/**
 * Checks whether the influencer's current required shipment delivery has been confirmed.
 * If re-dispatch cycles exist, delivery is confirmed ONLY when the latest re-dispatch shipment is confirmed delivered.
 * Otherwise, falls back to canonical initial delivery confirmation.
 */
export const isInfluencerDeliveryConfirmed = (record: StatusTrackingRecord): boolean => {
  const cycles = getInfluencerReDispatchCycles(record);
  if (cycles.length > 0) {
    const latest = cycles[cycles.length - 1];
    return Boolean(latest.delivered_confirmed || latest.status === 'DELIVERED');
  }
  return isDeliveryStepCompleted(record);
};

/**
 * Checks if influencer is currently in the pending Re-Dispatch queue (awaiting logistics action)
 */
export const isInfluencerInReDispatch = (record: StatusTrackingRecord): boolean => {
  return isInfluencerInReDispatchUtil(record);
};

/**
 * Checks if influencer had a Re-Dispatch that was moved to active
 */
export const isInfluencerReDispatchActive = (record: StatusTrackingRecord): boolean => {
  return isInfluencerReDispatchActiveUtil(record);
};

export interface PrerequisiteStep {
  id: string;
  type: 'initial_delivery' | 'redispatch' | 'replacement_delivery';
  label: string;
  isCompleted: boolean;
  isPending: boolean;
  cycleNumber?: number;
  modalMode: 'confirm_delivery' | 'review_issue';
  title: string;
}

/**
 * Dynamically resolves the prerequisite stages (Delivery / Re-Dispatch cycles)
 * shown before Video 1–6 sub-steps.
 *
 * Rules:
 * 1. Normal influencer (0 cycles):
 *    Delivered -> Share Script ...
 * 2. 1st Re-Dispatch pending:
 *    Re-Dispatch -> Share Script ...
 * 3. 1st Re-Dispatch moved to active:
 *    Re-Dispatch [✓] -> Delivered -> Share Script ...
 * 4. 1st Re-Dispatch replacement delivered:
 *    Re-Dispatch [✓] -> Delivered [✓] -> Share Script [Active] ...
 * 5. Subsequent damage (e.g. Cycle 2):
 *    Re-Dispatch #1 [✓] -> Delivered #1 [✓] -> Re-Dispatch #2 -> Delivered -> Share Script ...
 */
export const getInfluencerPrerequisiteSteps = (record: StatusTrackingRecord): PrerequisiteStep[] => {
  const cycles = getInfluencerReDispatchCycles(record);
  
  if (cycles.length === 0) {
    const isCompleted = isInfluencerDeliveryConfirmed(record);
    return [
      {
        id: 'delivery-initial',
        type: 'initial_delivery',
        label: isCompleted ? 'Delivered ✓' : 'Delivered',
        isCompleted,
        isPending: false,
        modalMode: 'confirm_delivery',
        title: isCompleted 
          ? 'Delivery Confirmed (Click to view/edit)' 
          : 'Delivery Confirmation: Not Started (Click to confirm)'
      }
    ];
  }

  const steps: PrerequisiteStep[] = [];
  const multipleCycles = cycles.length > 1;

  cycles.forEach((cycle, idx) => {
    const num = cycle.cycle_number || (idx + 1);
    const numSuffix = multipleCycles ? ` #${num}` : '';
    const isRedispatchCompleted = cycle.status === 'MOVED_TO_ACTIVE' || cycle.status === 'DELIVERED';
    const isRedispatchPending = cycle.status === 'PENDING_REDISPATCH';

    // 1. Re-Dispatch Step (Represents the requested / processed Re-Dispatch cycle)
    steps.push({
      id: `redispatch-${num}`,
      type: 'redispatch',
      label: `Re-Dispatch${numSuffix}${isRedispatchCompleted ? ' ✓' : ''}`,
      isCompleted: isRedispatchCompleted,
      isPending: isRedispatchPending,
      cycleNumber: num,
      modalMode: 'review_issue',
      title: isRedispatchPending 
        ? `Re-Dispatch${numSuffix}: Pending Logistics Action (Click to review issue)`
        : `Re-Dispatch${numSuffix}: Completed / Moved to Active (Click to view details)`
    });

    // 2. Replacement Delivery Step (Workflow always proceeds to Delivered)
    const isDeliveryCompleted = isRedispatchCompleted && Boolean(cycle.delivered_confirmed || cycle.status === 'DELIVERED' || idx < cycles.length - 1);
    steps.push({
      id: `replacement-delivery-${num}`,
      type: 'replacement_delivery',
      label: `Delivered${numSuffix}${isDeliveryCompleted ? ' ✓' : ''}`,
      isCompleted: isDeliveryCompleted,
      isPending: false,
      cycleNumber: num,
      modalMode: 'confirm_delivery',
      title: isDeliveryCompleted
        ? `Replacement Delivery${numSuffix}: Confirmed (Click to view/edit)`
        : `Replacement Delivery${numSuffix}: Awaiting Delivery Confirmation (Click to confirm)`
    });
  });

  return steps;
};

export const getInfluencerDeliveryStatus = (record: StatusTrackingRecord): 'Delivery Confirmed' | 'Delivered' | 'Not Delivered' => {
  if (isInfluencerInReDispatch(record)) {
    return 'Not Delivered';
  }

  if (isInfluencerDeliveryConfirmed(record)) {
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
    skipped?: boolean;
    status?: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'SKIPPED';
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

// High-performance WeakMap cache for getVideoWorkflow results to eliminate lag when switching tabs
export const videoWorkflowCache = new WeakMap<StatusTrackingRecord, Map<number, VideoWorkflowData>>();

export const clearVideoWorkflowCache = (record?: StatusTrackingRecord) => {
  if (record) {
    videoWorkflowCache.delete(record);
  }
};

export const getVideoWorkflow = (record: StatusTrackingRecord, videoNum: number, depth = 0): VideoWorkflowData => {
  if (depth === 0 && record && typeof record === 'object') {
    const recordCache = videoWorkflowCache.get(record);
    if (recordCache) {
      const cached = recordCache.get(videoNum);
      if (cached) return cached;
    }
  }

  const configs = getVideoWorkflowConfigs(videoNum);
  const metadata: any = getRecordNotesMetadata(record);

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
  const steps: Record<string, { completed: boolean; skipped?: boolean; status?: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'SKIPPED'; data: any; updated_at?: string }> = {};

  configs.forEach(cfg => {
    // Dedicated Step: Delivered (Video 1 only)
    if (cfg.id === 'delivered') {
      const isDeliv = isInfluencerDeliveryConfirmed(record);
      steps[cfg.id] = {
        completed: isDeliv,
        skipped: false,
        status: isDeliv ? 'COMPLETED' : 'NOT_STARTED',
        data: {
          delivery_photo_url: record.delivery_photo_url || metadata.delivery_photo_url || '',
          delivered_date: metadata.delivered_date || record.delivered_date || null,
          confirmed: isDeliv
        }
      };
      return;
    }

    // Dedicated Step: Share Script Resolution (Priority: 1. campaign_video_scripts, 2. notes JSON, 3. legacy columns)
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
        skipped: false,
        status: isScriptCompleted ? 'COMPLETED' : 'NOT_STARTED',
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
        if (!draftData.is_deleted && attempts.length === 0 && (draftData.vid || draftData.video_url || (videoNum === 1 && record.draft_video_url && !draftData.attempts))) {
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
        const activeApprovalStatus = latestAttempt ? latestAttempt.approval_status : (draftData.approval_status || '');
        const activeTiming = latestAttempt ? latestAttempt.timing_status : (draftData.timing || '');
        const hasVid = Boolean(latestAttempt?.video_url || draftData.vid || draftData.video_url || (videoNum === 1 && record.draft_video_url));
        const isApproved = Boolean(
          hasVid && 
          activeApprovalStatus === 'Approved' && 
          activeTiming && 
          activeTiming !== 'Not Submit' && 
          st.completed
        );

        steps[cfg.id] = {
          ...st,
          completed: isApproved, // STRICTLY ONLY COMPLETED IF APPROVED + VALID TIMING + CONFIRMED
          status: isApproved ? 'COMPLETED' : (hasVid ? 'IN_PROGRESS' : 'NOT_STARTED'),
          data: {
            ...draftData,
            attempts,
            active_attempt_number: latestAttempt?.attempt_number || 0,
            approval_status: activeApprovalStatus,
            vid: latestAttempt?.video_url || draftData.vid || '',
            timing: activeTiming || '',
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
        const vPrice = getInfluencerVideoPrice(record.influencer, videoNum);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === Number(videoNum) && vp.payment_type === 'advance');
        const isPaid = videoPayment ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) : st.completed;
        const proofUrl = videoPayment?.payment_proof_url || st.data?.photo || (videoNum === 1 ? record.pay_advance_photo_url : '') || '';
        const normalizedProof = st.data?.paymentProof ? normalizePaymentProof(st.data.paymentProof) : (proofUrl ? normalizePaymentProof(proofUrl) : null);
        const livePm = resolveInfluencerPaymentDetails({ ...(record.dispatch || {}), ...(record.influencer || {}) });
        const stepUpi = livePm.payment_method === 'UPI'
          ? (livePm.upi_number || videoPayment?.transaction_reference || st.data?.gpay || (videoNum === 1 ? record.advance_gpay_number : '') || '')
          : '';
        steps[cfg.id] = {
          ...st,
          completed: isPaid,
          data: {
            ...st.data,
            gpay: stepUpi,
            total: (videoPayment?.agreed_amount != null ? String(videoPayment.agreed_amount) : (st.data?.total || (vPrice !== null ? String(vPrice) : (videoNum === 1 ? record.advance_total_amount : '')))),
            advance: (videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (st.data?.advance || (videoNum === 1 ? record.advance_paid_amount : ''))),
            photo: normalizedProof?.url || proofUrl,
            paymentProof: normalizedProof,
            payment_status: videoPayment?.payment_status || (isPaid ? 'paid' : (st.data?.payment_status || null)),
            payment_method: livePm.payment_method || videoPayment?.payment_method || null,
            payment_record: videoPayment
          }
        };
      } else if (cfg.id === 'payment') {
        const vPrice = getInfluencerVideoPrice(record.influencer, videoNum);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === Number(videoNum) && vp.payment_type === 'final');
        const isPaid = videoPayment 
          ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) 
          : (videoNum === 1 ? (Boolean(record.payment_remaining_completed) || st.completed) : st.completed);
        steps[cfg.id] = {
          ...st,
          completed: isPaid,
          data: {
            ...st.data,
            amount: (videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (st.data?.amount || (vPrice !== null ? String(vPrice) : ''))),
            gpay: videoPayment?.transaction_reference || st.data?.gpay || '',
            photo: videoPayment?.payment_proof_url || st.data?.photo || (videoNum === 1 ? record.payment_remaining_photo_url : '') || '',
            payment_status: videoPayment?.payment_status || (isPaid ? 'paid' : 'pending'),
            payment_completed: isPaid,
            payment_method: videoPayment?.payment_method || st.data?.payment_method || '',
            payment_record: videoPayment
          }
        };
      } else if (cfg.id === 'call_explain') {
        const isCallSkipped = Boolean(
          st.skipped === true || 
          st.status === 'SKIPPED' || 
          st.data?.call_skipped === true || 
          st.data?.is_skipped === true ||
          (videoNum === 1 && metadata.call_skipped === true)
        );
        const isCallCompleted = !isCallSkipped && Boolean(st.completed || st.data?.call_explained);
        steps[cfg.id] = {
          ...st,
          completed: isCallCompleted,
          skipped: isCallSkipped,
          status: isCallSkipped ? 'SKIPPED' : (isCallCompleted ? 'COMPLETED' : 'NOT_STARTED'),
          data: {
            ...st.data,
            call_explained: isCallCompleted,
            call_skipped: isCallSkipped,
            is_skipped: isCallSkipped
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
        const isCallSkipped = Boolean(metadata.call_skipped === true);
        completed = !isCallSkipped && (!!metadata.call_explained || (!!record.ref_call_explanation_required && !metadata.call_explanation_pending) || ((record.current_step || 0) >= 2 && !metadata.call_explanation_pending));
        data = {
          call_explained: completed,
          call_skipped: isCallSkipped,
          is_skipped: isCallSkipped,
          phone_called: metadata.phone_called || record.dispatch?.phone_number || '',
          call_datetime: metadata.call_datetime || '',
          call_notes: metadata.call_notes || ''
        };
        steps[cfg.id] = {
          completed,
          skipped: isCallSkipped,
          status: isCallSkipped ? 'SKIPPED' : (completed ? 'COMPLETED' : 'NOT_STARTED'),
          data
        };
        return;
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
        const proofUrl = videoPayment?.payment_proof_url || record.pay_advance_photo_url || '';
        const normalizedProof = proofUrl ? normalizePaymentProof(proofUrl) : null;
        const livePm = resolveInfluencerPaymentDetails({ ...(record.dispatch || {}), ...(record.influencer || {}) });
        const stepUpi = livePm.payment_method === 'UPI'
          ? (livePm.upi_number || videoPayment?.transaction_reference || record.advance_gpay_number || '')
          : '';
        data = {
          gpay: stepUpi,
          total: videoPayment?.agreed_amount != null ? String(videoPayment.agreed_amount) : (record.advance_total_amount || (v1Price !== null ? String(v1Price) : '')),
          advance: videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (record.advance_paid_amount || ''),
          photo: normalizedProof?.url || proofUrl,
          paymentProof: normalizedProof,
          payment_status: videoPayment?.payment_status || (completed ? 'paid' : null),
          payment_method: livePm.payment_method || videoPayment?.payment_method || null,
          payment_record: videoPayment
        };
      } else if (cfg.id === 'timeline') {
        completed = Boolean(record.draft_submission_completed || (metadata.timeline_completed && record.draft_expected_date));
        data = {
          date: scheduledDraftDate || record.draft_expected_date || '',
          time: record.draft_expected_time || '',
          manualOverride: false,
          history: []
        };
      } else if (cfg.id === 'draft') {
        const legacyVid = record.draft_video_url || '';
        const legacyApp = record.draft_approval_status || '';
        const legacyTiming = record.draft_timing_status || '';
        const isApproved = Boolean(
          legacyVid && 
          legacyApp === 'Approved' && 
          legacyTiming && 
          legacyTiming !== 'Not Submit' && 
          record.draft_received
        );
        const attempts: DraftAttempt[] = [];
        if (legacyVid) {
          attempts.push({
            attempt_number: 1,
            video_url: legacyVid,
            approval_status: isApproved ? 'Approved' : (legacyApp === 'Not Approved' ? 'Not Approved' : 'Pending Approval'),
            timing_status: legacyTiming,
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
          timing: legacyTiming,
          corr: record.draft_corrections_required || '',
          finalL: record.draft_final_product_link || '',
          finalD: record.draft_final_description || '',
          attempts,
          active_attempt_number: attempts.length,
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
      } else if (cfg.id === 'payment') {
        const vPrice = getInfluencerVideoPrice(record.influencer, 1);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === 1 && vp.payment_type === 'final');
        completed = videoPayment 
          ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) 
          : Boolean(record.payment_remaining_completed);
        data = {
          amount: videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : (vPrice !== null ? String(vPrice) : ''),
          gpay: videoPayment?.transaction_reference || '',
          photo: videoPayment?.payment_proof_url || record.payment_remaining_photo_url || '',
          payment_status: videoPayment?.payment_status || (completed ? 'paid' : null),
          payment_completed: completed,
          payment_method: videoPayment?.payment_method || '',
          payment_record: videoPayment
        };
      }
    } else {
      if (cfg.id === 'pay_advance') {
        const vPrice = getInfluencerVideoPrice(record.influencer, videoNum);
        const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === Number(videoNum) && vp.payment_type === 'advance');
        completed = videoPayment ? (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0) : false;
        const proofUrl = videoPayment?.payment_proof_url || '';
        const normalizedProof = proofUrl ? normalizePaymentProof(proofUrl) : null;
        const livePm = resolveInfluencerPaymentDetails({ ...(record.dispatch || {}), ...(record.influencer || {}) });
        const stepUpi = livePm.payment_method === 'UPI'
          ? (livePm.upi_number || videoPayment?.transaction_reference || '')
          : '';
        data = {
          gpay: stepUpi,
          total: videoPayment?.agreed_amount != null ? String(videoPayment.agreed_amount) : (vPrice !== null ? String(vPrice) : ''),
          advance: videoPayment?.paid_amount != null ? String(videoPayment.paid_amount) : '',
          photo: normalizedProof?.url || proofUrl,
          paymentProof: normalizedProof,
          payment_status: videoPayment?.payment_status || (completed ? 'paid' : null),
          payment_method: livePm.payment_method || videoPayment?.payment_method || null,
          payment_record: videoPayment
        };
      } else if (cfg.id === 'timeline') {
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
          payment_status: videoPayment?.payment_status || (completed ? 'paid' : null),
          payment_completed: completed,
          payment_method: videoPayment?.payment_method || '',
          payment_record: videoPayment
        };
      }
    }

    steps[cfg.id] = { completed, data };
  });

  const isDelivered = isInfluencerDeliveryConfirmed(record);
  const assignedVideos = getInfluencerAssignedVideos(record);
  const isAssigned = assignedVideos.includes(videoNum);

  const draftStep = steps['draft'];
  const dData = draftStep?.data || {};
  const dAttempts: DraftAttempt[] = Array.isArray(dData.attempts) ? dData.attempts : [];
  const activeDAttempt = dAttempts.length > 0 ? dAttempts[dAttempts.length - 1] : null;
  const draftApprovalStatus = activeDAttempt?.approval_status || dData.approval_status || dData.appStat || (videoNum === 1 ? record.draft_approval_status : '') || '';
  const isReDraftRequired = draftApprovalStatus === 'Not Approved';
  const hasDraftVid = Boolean(activeDAttempt?.video_url || dData.vid || dData.video_url || (videoNum === 1 && record.draft_video_url));
  const isDraftTrulyCompleted = Boolean(hasDraftVid && draftApprovalStatus === 'Approved' && (activeDAttempt?.timing_status || dData.timing || (videoNum === 1 ? record.draft_timing_status : '')) !== 'Not Submit' && draftStep?.completed);

  const draftStatus = isReDraftRequired 
    ? 'Not Approved' 
    : (isDraftTrulyCompleted ? 'Approved' : (hasDraftVid ? 'Pending Approval' : 'Not Started'));

  const isStepDone = (cId: string) => {
    const s = steps[cId];
    return Boolean(s?.completed || s?.skipped || s?.status === 'SKIPPED');
  };

  const completedOrSkippedCount = configs.filter(c => isStepDone(c.id)).length;
  const completedCount = configs.filter(c => steps[c.id]?.completed).length;
  const totalSteps = configs.length;

  const isStarted = depth > 0 ? isDelivered : isInfluencerVideoStarted(record, videoNum);

  let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
  if (!isAssigned || (videoNum > 1 && !isStarted)) {
    status = 'NOT_STARTED';
  } else if (completedOrSkippedCount === totalSteps) {
    status = 'COMPLETED';
  } else if (completedOrSkippedCount > 0 || isReDraftRequired) {
    status = 'IN_PROGRESS';
  } else {
    status = 'NOT_STARTED';
  }

  // Active step calculation:
  // If influencer not assigned or video not started, no step in this video is active yet
  let activeStepId = '';
  if (!isAssigned) {
    activeStepId = '';
  } else if (videoNum > 1 && !isStarted) {
    activeStepId = '';
  } else if (videoNum === 1 && !isDelivered) {
    activeStepId = 'delivered';
  } else if (isReDraftRequired) {
    activeStepId = 'draft';
  } else if (completedOrSkippedCount === totalSteps) {
    activeStepId = '';
  } else {
    const firstIncomplete = configs.find(c => !isStepDone(c.id));
    activeStepId = firstIncomplete ? firstIncomplete.id : '';
  }

  const result: VideoWorkflowData = {
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

  if (depth === 0 && record && typeof record === 'object') {
    let recordCache = videoWorkflowCache.get(record);
    if (!recordCache) {
      recordCache = new Map<number, VideoWorkflowData>();
      videoWorkflowCache.set(record, recordCache);
    }
    recordCache.set(videoNum, result);
  }

  return result;
};


/**
 * Determines whether a specific video workflow has been started for an influencer.
 * Video 1 starts once delivery confirmation is completed.
 * Videos 2-6 start once prior video is fully completed OR explicit progress exists in that video.
 */
export const isInfluencerVideoStarted = (record: StatusTrackingRecord, videoNum: number): boolean => {
  if (videoNum === 1) {
    return isInfluencerDeliveryConfirmed(record);
  }

  // 1. Explicit Video N script
  const vScript = (record.videoScripts || []).find((vs: any) => Number(vs.video_number) === videoNum);
  if (vScript && (vScript.script_shared_approved || vScript.proposed_script || vScript.custom_concept || vScript.voice_record_url)) {
    return true;
  }

  // 2. Explicit Video N payment
  const vPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === videoNum);
  if (vPayment && (vPayment.payment_status === 'paid' || Number(vPayment.paid_amount || 0) > 0)) {
    return true;
  }

  // 3. Notes metadata (check for explicit progress, not just pre-scheduled dates)
  let metadata: any = {};
  try {
    metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
  } catch (e) {}

  const storedVideo = metadata.videos?.[String(videoNum)] || metadata.videos?.[videoNum];
  if (storedVideo?.steps) {
    const hasAnyStep = Object.values(storedVideo.steps).some((st: any) => 
      st?.completed || 
      st?.skipped || 
      st?.status === 'SKIPPED' || 
      st?.data?.call_skipped || 
      st?.data?.is_skipped || 
      (st?.data?.script && String(st.data.script).trim().length > 0) || 
      (st?.data?.concept && String(st.data.concept).trim().length > 0) || 
      st?.data?.manualOverride === true ||
      st?.data?.vid
    );
    if (hasAnyStep) return true;
  }

  // 4. Prior video (videoNum - 1) is fully completed
  const prevWorkflow = getVideoWorkflow(record, videoNum - 1, 1);
  if (prevWorkflow.completedCount === prevWorkflow.totalSteps && prevWorkflow.totalSteps > 0) {
    return true;
  }

  return false;
};

/**
 * Checks if Share Script is actually completed/confirmed for an influencer in the given video number.
 * Independent of delivery status.
 */
export const isInfluencerShareScriptCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const step = vData.steps['share_script'];
  return Boolean(step?.completed);
};

// Top-level alias ensuring isShareScriptCompleted is always declared and safely accessible
export const isShareScriptCompleted = isInfluencerShareScriptCompleted;

/**
 * Checks if Share Script step is currently in progress (concept, proposed script, or voice note drafted).
 */
export const isInfluencerShareScriptInProgress = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;
  if (!isInfluencerDeliveryConfirmed(record)) return false;
  if (isInfluencerShareScriptCompleted(record, videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const step = vData.steps['share_script'];
  const data = step?.data || {};
  return Boolean(
    data.concept || 
    data.script || 
    data.hooks || 
    data.voice_record?.url || 
    data.keypoints || 
    data.link || 
    (data.reference_videos_list && data.reference_videos_list.length > 0)
  );
};

/**
 * Checks if the Call & Explain step for an influencer in a given video number was explicitly marked as Call Skipped.
 */
export const isInfluencerCallSkipped = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const callStep = vData.steps['call_explain'];
  if (callStep?.skipped === true || callStep?.status === 'SKIPPED' || callStep?.data?.call_skipped === true || callStep?.data?.is_skipped === true) {
    return true;
  }

  try {
    const metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
    const storedStep = metadata.videos?.[String(videoNumber)]?.steps?.call_explain || metadata.videos?.[videoNumber]?.steps?.call_explain;
    if (storedStep?.skipped === true || storedStep?.status === 'SKIPPED' || storedStep?.data?.call_skipped === true || storedStep?.data?.is_skipped === true) {
      return true;
    }
    if (videoNumber === 1 && (metadata.call_skipped === true || metadata.is_skipped === true)) {
      return true;
    }
  } catch (e) {}

  return false;
};

/**
 * Checks if the Call & Explain step was normally completed (not skipped) for an influencer.
 */
export const isInfluencerCallCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerCallSkipped(record, videoNumber)) return false;
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const callStep = vData.steps['call_explain'];
  return Boolean(callStep?.completed || callStep?.data?.call_explained);
};

/**
 * Checks if the Timeline step has actually been completed/confirmed.
 */
export const isInfluencerTimelineCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const tlStep = vData.steps['timeline'];
  return Boolean(tlStep?.completed);
};

/**
 * Checks if Draft has actually been completed/approved with valid timing.
 * Strict Rule: UPLOAD SUCCESS != STEP COMPLETED.
 * Requires: Video exists + Approval is 'Approved' + Timing status is selected and != 'Not Submit' + Saved confirmed.
 */
export const isInfluencerDraftCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const dStep = vData.steps['draft'];
  if (!dStep) return false;

  const data = dStep.data || {};
  const attempts: DraftAttempt[] = Array.isArray(data.attempts) ? data.attempts : [];
  const activeAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  // 1. Video must exist
  const hasVideo = Boolean(
    activeAttempt?.video_url || 
    data.vid || 
    data.video_url || 
    (videoNumber === 1 && record.draft_video_url)
  );
  if (!hasVideo) return false;

  // 2. Approval decision must be explicitly 'Approved'
  const approvalStatus = activeAttempt?.approval_status || data.approval_status || data.appStat || (videoNumber === 1 ? record.draft_approval_status : '');
  if (approvalStatus !== 'Approved') return false;

  // 3. Timing status must be chosen and NOT 'Not Submit'
  const timingStatus = activeAttempt?.timing_status || data.timing || (videoNumber === 1 ? record.draft_timing_status : '');
  if (!timingStatus || timingStatus === 'Not Submit') return false;

  // 4. Must be marked completed
  return Boolean(dStep.completed || (videoNumber === 1 && record.draft_received && record.draft_approval_status === 'Approved'));
};

/**
 * Checks if Draft step is currently in progress (video uploaded, pending review or re-draft required).
 */
export const isInfluencerDraftInProgress = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;
  if (isInfluencerDraftCompleted(record, videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const dStep = vData.steps['draft'];
  if (!dStep) return false;

  const data = dStep.data || {};
  const attempts: DraftAttempt[] = Array.isArray(data.attempts) ? data.attempts : [];
  const activeAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  const hasVideo = Boolean(
    activeAttempt?.video_url || 
    data.vid || 
    data.video_url || 
    (videoNumber === 1 && record.draft_video_url)
  );

  const approvalStatus = activeAttempt?.approval_status || data.approval_status || data.appStat || (videoNumber === 1 ? record.draft_approval_status : '');

  return Boolean(
    hasVideo || 
    dStep.status === 'IN_PROGRESS' || 
    approvalStatus === 'Pending Approval' || 
    approvalStatus === 'Not Approved' || 
    vData.isReDraftRequired
  );
};

export type DraftStatusKind = 'not_started' | 'pending_approval' | 'not_approved' | 'completed';

export const getInfluencerDraftStatus = (record: StatusTrackingRecord, videoNumber: number): DraftStatusKind => {
  if (isInfluencerDraftCompleted(record, videoNumber)) return 'completed';
  if (isInfluencerDraftInProgress(record, videoNumber)) {
    const vData = getVideoWorkflow(record, videoNumber);
    const dStep = vData.steps['draft'];
    const data = dStep?.data || {};
    const attempts: DraftAttempt[] = Array.isArray(data.attempts) ? data.attempts : [];
    const activeAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    const approvalStatus = activeAttempt?.approval_status || data.approval_status || data.appStat || (videoNumber === 1 ? record.draft_approval_status : '');
    if (approvalStatus === 'Not Approved' || vData.isReDraftRequired) {
      return 'not_approved';
    }
    return 'pending_approval';
  }
  return 'not_started';
};

/**
 * Checks if Post Date step has actually been completed/confirmed.
 */
export const isInfluencerPostDateCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  const pdStep = vData.steps['post_date'];
  const hasLink = Boolean(pdStep?.data?.link && !isFakeUrl(pdStep.data.link));
  return Boolean(pdStep?.completed || pdStep?.data?.confirmed || hasLink);
};

/**
 * Checks if Pay Advance step is completed (Video 1 ONLY).
 */
export const isInfluencerPayAdvanceCompleted = (record: StatusTrackingRecord, videoNumber: number = 1): boolean => {
  if (videoNumber !== 1) return false;
  if (!record) return false;
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(1)) return false;

  const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === 1 && vp.payment_type === 'advance');
  if (videoPayment && (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0)) {
    return true;
  }
  if (record.pay_advance_completed || (parseFloat(record.advance_paid_amount || '0') > 0)) {
    return true;
  }
  const vData = getVideoWorkflow(record, 1);
  const advStep = vData.steps['pay_advance'];
  return Boolean(advStep?.completed || advStep?.data?.payment_status === 'paid' || advStep?.data?.pay_advance_completed);
};

/**
 * Checks if Pay Advance step is in progress (Video 1 ONLY).
 */
export const isInfluencerPayAdvanceInProgress = (record: StatusTrackingRecord, videoNumber: number = 1): boolean => {
  if (videoNumber !== 1) return false;
  if (!record) return false;
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(1)) return false;
  if (!isInfluencerDeliveryConfirmed(record)) return false;
  if (isInfluencerPayAdvanceCompleted(record, 1)) return false;

  const vData = getVideoWorkflow(record, 1);
  const advStep = vData.steps['pay_advance'];
  if (!advStep) return false;

  const data = advStep.data || {};
  const hasAdvanceVal = parseFloat(data.advance || record.advance_paid_amount || '0') > 0;
  const hasPhoto = Boolean(data.photo || data.paymentProof?.url || record.pay_advance_photo_url);
  const hasGpay = Boolean(data.gpay || record.advance_gpay_number);

  const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === 1 && vp.payment_type === 'advance');
  const hasInitiated = videoPayment && (videoPayment.payment_status === 'initiated' || videoPayment.payment_status === 'processing');

  return Boolean(hasAdvanceVal || hasPhoto || hasGpay || hasInitiated);
};

/**
 * Checks if Payment step is completed (Video 2-6 ONLY).
 */
export const isInfluencerPaymentCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (videoNumber === 1) return false; // Payment belongs ONLY to Video 2-6
  if (!record) return false;
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === Number(videoNumber) && vp.payment_type === 'final');
  if (videoPayment && (videoPayment.payment_status === 'paid' || Number(videoPayment.paid_amount || 0) > 0)) {
    return true;
  }
  const vData = getVideoWorkflow(record, videoNumber);
  const payStep = vData.steps['payment'];
  return Boolean(payStep?.completed || payStep?.data?.payment_completed || payStep?.data?.payment_status === 'paid');
};

/**
 * Checks if all workflow steps for an influencer in a given video number are completed.
 */
export const isInfluencerVideoCompleted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (videoNumber === 1 && !isInfluencerDeliveryConfirmed(record)) return false;
  if (isInfluencerInReDispatch(record)) return false;

  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  const vData = getVideoWorkflow(record, videoNumber);
  return vData.status === 'COMPLETED';
};

/**
 * Authoritative Not Started check for an influencer in a given video number.
 * "Not Started" means the workflow has not started and none of the required workflow progress has been completed.
 * It must NEVER be classified as Not Started if any step has progress, is completed, skipped, or in progress.
 */
export const isInfluencerVideoNotStarted = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (!record) return true;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;

  if (videoNumber === 1) {
    if (isInfluencerDeliveryConfirmed(record)) return false;
    if (isInfluencerInReDispatch(record)) return false;
    if (isInfluencerReDispatchActive(record)) return false;
    if (getInfluencerReDispatchCycles(record).length > 0) return false;
    if (isInfluencerShareScriptCompleted(record, 1) || isInfluencerShareScriptInProgress(record, 1)) return false;
    if (isInfluencerCallCompleted(record, 1) || isInfluencerCallSkipped(record, 1)) return false;
    if (isInfluencerPayAdvanceCompleted(record, 1) || isInfluencerPayAdvanceInProgress(record, 1)) return false;
    if (isInfluencerTimelineCompleted(record, 1)) return false;
    if (isInfluencerDraftCompleted(record, 1) || getInfluencerDraftStatus(record, 1) !== 'not_started') return false;
    if (isInfluencerPostDateCompleted(record, 1)) return false;
    return true;
  }

  // Videos 2 to 6
  if (isInfluencerShareScriptCompleted(record, videoNumber) || isInfluencerShareScriptInProgress(record, videoNumber)) return false;
  if (isInfluencerCallCompleted(record, videoNumber) || isInfluencerCallSkipped(record, videoNumber)) return false;
  if (isInfluencerTimelineCompleted(record, videoNumber)) return false;
  if (isInfluencerDraftCompleted(record, videoNumber) || getInfluencerDraftStatus(record, videoNumber) !== 'not_started') return false;
  if (isInfluencerPostDateCompleted(record, videoNumber)) return false;
  if (isInfluencerPaymentCompleted(record, videoNumber)) return false;
  return true;
};

export const isInfluencerWorkflowNotStarted = isInfluencerVideoNotStarted;

/**
 * Checks if influencer draft is submitted and pending manager review or re-draft required.
 */
export const isInfluencerDraftPendingReview = (record: StatusTrackingRecord, videoNumber: number): boolean => {
  if (isInfluencerInReDispatch(record)) return false;
  const assigned = getInfluencerAssignedVideos(record);
  if (!assigned.includes(videoNumber)) return false;
  if (isInfluencerDraftCompleted(record, videoNumber)) return false;

  const draftStatus = getInfluencerDraftStatus(record, videoNumber);
  return draftStatus === 'pending_approval' || draftStatus === 'not_approved';
};

/**
 * Reusable single predicate matching step ID for both counts and filtered list.
 * Guarantees that summary filter count exactly equals the number of matching rows when clicked!
 */
export const isStepFilterMatch = (
  stepId: string,
  record: StatusTrackingRecord,
  videoNumber: number
): boolean => {
  switch (stepId) {
    case 'delivered':
      return videoNumber === 1 && isInfluencerDeliveryConfirmed(record);
    case 'not_started':
      return isInfluencerVideoNotStarted(record, videoNumber);
    case 'share_script':
      return isInfluencerShareScriptCompleted(record, videoNumber);
    case 'call_explain':
      return isInfluencerCallCompleted(record, videoNumber);
    case 'call_skipped':
      return isInfluencerCallSkipped(record, videoNumber);
    case 'pay_advance':
      return videoNumber === 1 && isInfluencerPayAdvanceCompleted(record, 1);
    case 'timeline':
      return isInfluencerTimelineCompleted(record, videoNumber);
    case 'draft':
      return isInfluencerDraftPendingReview(record, videoNumber);
    case 'post_date':
      return isInfluencerDraftCompleted(record, videoNumber);
    case 'payment':
      return videoNumber >= 2 && isInfluencerPaymentCompleted(record, videoNumber);
    case 're_dispatch':
      return videoNumber === 1 && (isInfluencerInReDispatch(record) || isInfluencerReDispatchActive(record) || getInfluencerReDispatchCycles(record).length > 0);
    default:
      return false;
  }
};

/**
 * Authoritative debug & runtime validation function for filter counts.
 * Calculates exact step counts directly from source status records.
 */
export const validateFilterCounts = (
  records: StatusTrackingRecord[],
  videoNumber: number
): Record<string, number> => {
  const counts: Record<string, number> = { all: 0 };
  const summaryConfigs = getVideoSummaryBoxConfigs(videoNumber);
  summaryConfigs.forEach(cfg => {
    counts[cfg.id] = 0;
  });

  const assignedRecords = records.filter(r => getInfluencerAssignedVideos(r).includes(videoNumber));
  counts.all = assignedRecords.length;

  for (const cfg of summaryConfigs) {
    if (cfg.id === 'all') continue;
    counts[cfg.id] = assignedRecords.filter(r => isStepFilterMatch(cfg.id, r, videoNumber)).length;
  }

  return counts;
};

/**
 * ONE CENTRALIZED WORKFLOW-STATE CALCULATION
 * Returns the exact current active workflow step for an influencer in a given video number:
 * One of: 're_dispatch' | 'not_started' | 'delivered' | 'share_script' | 'call_explain' | 'call_skipped' | 'pay_advance' | 'timeline' | 'draft' | 'post_date' | 'payment' | 'completed'
 */
export const getInfluencerCurrentWorkflowState = (record: StatusTrackingRecord, videoNumber: number): string => {
  return getCurrentWorkflowState(record, videoNumber, {
    isShareScriptCompleted: isInfluencerShareScriptCompleted,
    isShareScriptInProgress: isInfluencerShareScriptInProgress,
    isCallCompleted: isInfluencerCallCompleted,
    isCallSkipped: isInfluencerCallSkipped,
    isPayAdvanceCompleted: isInfluencerPayAdvanceCompleted,
    isTimelineCompleted: isInfluencerTimelineCompleted,
    isDraftCompleted: isInfluencerDraftCompleted,
    isPostDateCompleted: isInfluencerPostDateCompleted,
    isPaymentCompleted: isInfluencerPaymentCompleted,
    getDeliveryStatus: getInfluencerDeliveryStatus,
    isVideoStarted: isInfluencerVideoStarted
  });
};

/**
 * Resolves the single active summary workflow step for an influencer in a given video number:
 */
export const getInfluencerActiveSummaryStep = (record: StatusTrackingRecord, videoNumber: number): string | null => {
  return getInfluencerCurrentWorkflowState(record, videoNumber);
};

export type StepVisualState = 'completed' | 'pending' | 'in_progress' | 'skipped' | 'not_started' | 'rejected';

/**
 * Single authoritative visual-state calculation for any workflow step.
 * Returns: 'completed' | 'pending' | 'in_progress' | 'skipped' | 'not_started' | 'rejected'
 * Priority: COMPLETED (Green) > REJECTED (Red) > PENDING (Amber) > IN_PROGRESS (Blue) > NOT_STARTED (Dim)
 * NOTE: "Not Started" must NEVER be blue.
 */
export const getStepVisualState = (
  record: StatusTrackingRecord,
  videoNumber: number,
  stepId: string
): StepVisualState => {
  if (!record) return 'not_started';

  // 1. Delivery step check (Video 1 only)
  if (stepId === 'delivered') {
    if (videoNumber !== 1) return 'not_started';
    if (isInfluencerInReDispatch(record)) {
      return 'pending'; // Pending Re-Dispatch shipment/delivery action
    }
    if (isInfluencerDeliveryConfirmed(record)) {
      return 'completed';
    }
    const tracking = record.dispatch?.tracking_id;
    const courierStatus = (record.dispatch?.courier_status || '').toLowerCase();
    if (tracking && (courierStatus.includes('transit') || courierStatus.includes('shipped') || courierStatus.includes('out for delivery'))) {
      return 'in_progress';
    }
    return 'not_started';
  }

  // 2. Delivery is the prerequisite for all subsequent Video 1 video workflow steps
  const isDelivered = isInfluencerDeliveryConfirmed(record);

  // 3. For Video > 1, check if video is started
  if (videoNumber > 1 && !isInfluencerVideoStarted(record, videoNumber)) {
    return 'not_started';
  }

  // 4. Check completion first (COMPLETED HAS HIGHEST PRIORITY - GREEN)
  const isDone = (
    stepId === 'share_script' ? isInfluencerShareScriptCompleted(record, videoNumber) :
    stepId === 'call_explain' ? isInfluencerCallCompleted(record, videoNumber) :
    stepId === 'call_skipped' ? isInfluencerCallSkipped(record, videoNumber) :
    stepId === 'pay_advance' ? (videoNumber === 1 && isInfluencerPayAdvanceCompleted(record, 1)) :
    stepId === 'timeline' ? isInfluencerTimelineCompleted(record, videoNumber) :
    stepId === 'draft' ? isInfluencerDraftCompleted(record, videoNumber) :
    stepId === 'post_date' ? isInfluencerPostDateCompleted(record, videoNumber) :
    stepId === 'payment' ? (videoNumber >= 2 && isInfluencerPaymentCompleted(record, videoNumber)) :
    false
  );

  if (isDone) {
    return 'completed';
  }

  // 5. Call Skipped check
  if (stepId === 'call_explain' && isInfluencerCallSkipped(record, videoNumber)) {
    return 'skipped';
  }

  // If Delivery is not confirmed for Video 1, subsequent steps CANNOT be in progress or pending!
  if (videoNumber === 1 && !isDelivered) {
    return 'not_started';
  }

  const vData = getVideoWorkflow(record, videoNumber);
  const stepObj = vData.steps[stepId];
  const stepData = stepObj?.data || {};

  // 6. Step-specific pending & in-progress evaluations (BLUE, AMBER, or RED)
  if (stepId === 'draft') {
    const draftStatus = getInfluencerDraftStatus(record, videoNumber);
    if (draftStatus === 'completed') return 'completed';
    if (draftStatus === 'not_approved') return 'rejected'; // Re-Draft required (RED)
    if (draftStatus === 'pending_approval') return 'pending'; // Draft Submitted – Pending Manager Approval (YELLOW/AMBER)
    if (stepObj?.status === 'IN_PROGRESS') return 'in_progress';
    return 'not_started';
  }

  if (stepId === 'pay_advance') {
    if (videoNumber === 1 && isInfluencerPayAdvanceInProgress(record, 1)) {
      return 'in_progress';
    }
    return 'not_started';
  }

  if (stepId === 'share_script') {
    if (isInfluencerShareScriptInProgress(record, videoNumber)) {
      return 'in_progress';
    }
    return 'not_started';
  }

  if (stepId === 'call_explain') {
    const hasCallData = Boolean(stepData.date || stepData.time || stepData.call_summary || stepData.call_notes);
    if (hasCallData) {
      return 'in_progress';
    }
    return 'not_started';
  }

  if (stepId === 'timeline') {
    // A pre-scheduled date from the campaign does NOT make Timeline in_progress!
    // Timeline must remain NOT STARTED (dim) unless actively modified or confirmed!
    if (stepObj?.status === 'IN_PROGRESS' || stepData.manualOverride === true || (Array.isArray(stepData.history) && stepData.history.length > 0)) {
      return 'in_progress';
    }
    return 'not_started';
  }

  if (stepId === 'post_date') {
    const hasPostLink = Boolean(stepData.link || (videoNumber === 1 ? record.final_post_link : ''));
    if (hasPostLink) {
      return 'in_progress';
    }
    return 'not_started';
  }

  if (stepId === 'payment') {
    if (videoNumber >= 2) {
      const videoPayment = (record.videoPayments || []).find((vp: any) => Number(vp.video_number) === Number(videoNumber) && vp.payment_type === 'final');
      if (videoPayment && (videoPayment.payment_status === 'initiated' || videoPayment.payment_status === 'processing')) {
        return 'in_progress';
      }
    }
    return 'not_started';
  }

  return 'not_started';
};

/**
 * Returns consistent Tailwind visual styles for each visual state.
 */
export const getStepVisualStyles = (state: StepVisualState) => {
  switch (state) {
    case 'completed':
      return {
        circle: "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] border border-emerald-400 hover:scale-105",
        iconClass: "text-white",
        label: "text-emerald-400 font-semibold",
        badge: "bg-emerald-950/80 text-emerald-400 border-emerald-700/60",
        badgeDot: "bg-emerald-400",
        badgeText: "Completed"
      };
    case 'rejected':
      return {
        circle: "bg-rose-500/20 text-rose-400 border border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.3)] hover:scale-105",
        iconClass: "text-rose-400",
        label: "text-rose-400 font-medium",
        badge: "bg-rose-950/80 text-rose-400 border-rose-700/60",
        badgeDot: "bg-rose-400",
        badgeText: "Re-Draft Required"
      };
    case 'pending':
      return {
        circle: "bg-amber-500/20 text-amber-400 border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] hover:scale-105 animate-pulse",
        iconClass: "text-amber-400",
        label: "text-amber-400 font-medium",
        badge: "bg-amber-950/80 text-amber-400 border-amber-700/60",
        badgeDot: "bg-amber-400 animate-pulse",
        badgeText: "Draft Submitted – Pending Manager Approval"
      };
    case 'skipped':
      return {
        circle: "bg-amber-500/20 text-amber-400 border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] hover:scale-105",
        iconClass: "text-amber-400",
        label: "text-amber-400 font-semibold",
        badge: "bg-amber-950/80 text-amber-400 border-amber-700/60",
        badgeDot: "bg-amber-400",
        badgeText: "Skipped"
      };
    case 'in_progress':
      return {
        circle: "bg-blue-600/20 text-blue-400 border border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:scale-105",
        iconClass: "text-blue-400",
        label: "text-blue-400 font-medium",
        badge: "bg-blue-950/80 text-blue-400 border-blue-700/60",
        badgeDot: "bg-blue-400",
        badgeText: "In Progress"
      };
    case 'not_started':
    default:
      return {
        circle: "bg-[#151f32]/60 text-slate-500 border border-slate-800/80 hover:border-slate-700 hover:text-slate-400",
        iconClass: "text-slate-500 group-hover:text-slate-400",
        label: "text-slate-500 font-normal",
        badge: "bg-slate-900 text-slate-400 border-slate-800",
        badgeDot: "bg-slate-500",
        badgeText: "Not Started"
      };
  }
};

export interface StepUndoInfo {
  stepId: string;
  stepLabel: string;
  previousStateLabel: string;
  affectedDownstreamSteps: string[];
  type: 'video_step' | 'prerequisite_delivery' | 'prerequisite_redispatch';
  cycleNumber?: number;
  videoNumber: number;
}

/**
 * Calculates the exact latest reversible workflow event for an influencer
 * based strictly on persisted database state and sequential workflow rules.
 */
export const getInfluencerLatestReversibleStep = (
  record: StatusTrackingRecord,
  videoNumber: number
): StepUndoInfo | null => {
  const isV1 = videoNumber === 1;
  const cycles = getInfluencerReDispatchCycles(record);
  const configs = getVideoWorkflowConfigs(videoNumber);

  // 1. Inspect Video sub-steps in reverse order (e.g. post_date -> draft -> timeline -> pay_advance / payment -> call_explain -> share_script)
  const subStepConfigs = configs.filter(c => c.id !== 'delivered');

  for (let idx = subStepConfigs.length - 1; idx >= 0; idx--) {
    const cfg = subStepConfigs[idx];
    const isCompleted = (
      cfg.id === 'share_script' ? isInfluencerShareScriptCompleted(record, videoNumber) :
      cfg.id === 'call_explain' ? isInfluencerCallCompleted(record, videoNumber) :
      cfg.id === 'pay_advance' ? (isV1 && isInfluencerPayAdvanceCompleted(record, 1)) :
      cfg.id === 'timeline' ? isInfluencerTimelineCompleted(record, videoNumber) :
      cfg.id === 'draft' ? isInfluencerDraftCompleted(record, videoNumber) :
      cfg.id === 'post_date' ? isInfluencerPostDateCompleted(record, videoNumber) :
      cfg.id === 'payment' ? (!isV1 && isInfluencerPaymentCompleted(record, videoNumber)) :
      false
    );
    const isSkipped = cfg.id === 'call_explain' && isInfluencerCallSkipped(record, videoNumber);

    if (isCompleted || isSkipped) {
      // Find what the workflow will return to
      let previousStateLabel = '';
      if (idx > 0) {
        const prevCfg = subStepConfigs[idx - 1];
        const isPrevSkipped = prevCfg.id === 'call_explain' && isInfluencerCallSkipped(record, videoNumber);
        previousStateLabel = `${prevCfg.label} (${isPrevSkipped ? 'Skipped' : 'Completed'})`;
      } else {
        // First sub-step (share_script) returns to Delivery Confirmation / Re-Dispatch
        if (isV1) {
          if (cycles.length > 0) {
            const lastCycle = cycles[cycles.length - 1];
            const num = lastCycle.cycle_number || cycles.length;
            previousStateLabel = `Delivered #${num} (Confirmed)`;
          } else {
            previousStateLabel = 'Delivered (Confirmed)';
          }
        } else {
          previousStateLabel = `Video ${videoNumber}: Not Started`;
        }
      }

      // Check if any downstream sub-steps exist (in case of out-of-order data)
      const affectedDownstreamSteps: string[] = [];
      for (let dIdx = idx + 1; dIdx < subStepConfigs.length; dIdx++) {
        const dCfg = subStepConfigs[dIdx];
        const dDone = (
          dCfg.id === 'share_script' ? isInfluencerShareScriptCompleted(record, videoNumber) :
          dCfg.id === 'call_explain' ? (isInfluencerCallCompleted(record, videoNumber) || isInfluencerCallSkipped(record, videoNumber)) :
          dCfg.id === 'pay_advance' ? (isV1 && isInfluencerPayAdvanceCompleted(record, 1)) :
          dCfg.id === 'timeline' ? isInfluencerTimelineCompleted(record, videoNumber) :
          dCfg.id === 'draft' ? isInfluencerDraftCompleted(record, videoNumber) :
          dCfg.id === 'post_date' ? isInfluencerPostDateCompleted(record, videoNumber) :
          dCfg.id === 'payment' ? (!isV1 && isInfluencerPaymentCompleted(record, videoNumber)) :
          false
        );
        if (dDone) {
          affectedDownstreamSteps.push(dCfg.label);
        }
      }

      return {
        stepId: cfg.id,
        stepLabel: isSkipped ? `${cfg.label} (Skipped)` : cfg.label,
        previousStateLabel,
        affectedDownstreamSteps,
        type: 'video_step',
        videoNumber
      };
    }
  }

  // 2. If NO Video sub-step is completed and we are on Video 1, inspect Prerequisite Steps (Delivery / Re-Dispatch Cycles)
  if (isV1) {
    if (cycles.length > 0) {
      const lastIdx = cycles.length - 1;
      const lastCycle = cycles[lastIdx];
      const num = lastCycle.cycle_number || (lastIdx + 1);

      // Check downstream video 1 steps that would be reset
      const affectedVideo1Steps: string[] = [];
      subStepConfigs.forEach(c => {
        const isDone = (
          c.id === 'share_script' ? isInfluencerShareScriptCompleted(record, 1) :
          c.id === 'call_explain' ? (isInfluencerCallCompleted(record, 1) || isInfluencerCallSkipped(record, 1)) :
          c.id === 'pay_advance' ? isInfluencerPayAdvanceCompleted(record, 1) :
          c.id === 'timeline' ? isInfluencerTimelineCompleted(record, 1) :
          c.id === 'draft' ? isInfluencerDraftCompleted(record, 1) :
          c.id === 'post_date' ? isInfluencerPostDateCompleted(record, 1) :
          false
        );
        if (isDone) affectedVideo1Steps.push(c.label);
      });

      if (lastCycle.delivered_confirmed || lastCycle.status === 'DELIVERED') {
        return {
          stepId: `replacement-delivery-${num}`,
          stepLabel: `Delivered #${num}`,
          previousStateLabel: `Re-Dispatch #${num} (Moved to Active)`,
          affectedDownstreamSteps: affectedVideo1Steps,
          type: 'prerequisite_delivery',
          cycleNumber: num,
          videoNumber: 1
        };
      } else if (lastCycle.status === 'MOVED_TO_ACTIVE') {
        return {
          stepId: `redispatch-${num}`,
          stepLabel: `Re-Dispatch #${num}`,
          previousStateLabel: `Re-Dispatch #${num} (Pending Logistics Action)`,
          affectedDownstreamSteps: affectedVideo1Steps,
          type: 'prerequisite_redispatch',
          cycleNumber: num,
          videoNumber: 1
        };
      } else if (lastCycle.status === 'PENDING_REDISPATCH') {
        return {
          stepId: `redispatch-${num}`,
          stepLabel: `Re-Dispatch #${num} (Pending Issue)`,
          previousStateLabel: cycles.length > 1 ? `Delivered #${num - 1} (Confirmed)` : 'Delivered (Initial Confirmed)',
          affectedDownstreamSteps: affectedVideo1Steps,
          type: 'prerequisite_redispatch',
          cycleNumber: num,
          videoNumber: 1
        };
      }
    } else {
      // Single initial delivery
      if (isInfluencerDeliveryConfirmed(record)) {
        const affectedVideo1Steps: string[] = [];
        subStepConfigs.forEach(c => {
          const isDone = (
            c.id === 'share_script' ? isInfluencerShareScriptCompleted(record, 1) :
            c.id === 'call_explain' ? (isInfluencerCallCompleted(record, 1) || isInfluencerCallSkipped(record, 1)) :
            c.id === 'pay_advance' ? isInfluencerPayAdvanceCompleted(record, 1) :
            c.id === 'timeline' ? isInfluencerTimelineCompleted(record, 1) :
            c.id === 'draft' ? isInfluencerDraftCompleted(record, 1) :
            c.id === 'post_date' ? isInfluencerPostDateCompleted(record, 1) :
            false
          );
          if (isDone) affectedVideo1Steps.push(c.label);
        });

        return {
          stepId: 'delivery-initial',
          stepLabel: 'Delivered (Initial Delivery)',
          previousStateLabel: 'Not Delivered',
          affectedDownstreamSteps: affectedVideo1Steps,
          type: 'prerequisite_delivery',
          videoNumber: 1
        };
      }
    }
  }

  return null;
};

interface RowWorkflowTimelineProps {
  record: StatusTrackingRecord;
  selectedVideoNumber: number;
  hasRedispatch: boolean;
  prerequisiteSteps: PrerequisiteStep[];
  currentVideoData: VideoWorkflowData;
  isDelivered: boolean;
  isPendingReDispatch: boolean;
  onOpenDeliveryModal: (pStep: PrerequisiteStep) => void;
  onOpenVideoModal: (cfgId: string) => void;
  onOpenViewAllModal: (record: StatusTrackingRecord) => void;
}

export const RowWorkflowTimeline: React.FC<RowWorkflowTimelineProps> = ({
  record,
  selectedVideoNumber,
  hasRedispatch,
  prerequisiteSteps,
  currentVideoData,
  isDelivered,
  isPendingReDispatch,
  onOpenDeliveryModal,
  onOpenVideoModal,
  onOpenViewAllModal,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);

  // Filter video sub-steps
  const visibleSubSteps = useMemo(() => {
    return currentVideoData.configs.filter(
      cfg => !(selectedVideoNumber === 1 && hasRedispatch && cfg.id === 'delivered')
    );
  }, [currentVideoData.configs, selectedVideoNumber, hasRedispatch]);

  const totalStepsCount = (selectedVideoNumber === 1 && hasRedispatch ? prerequisiteSteps.length : 0) + visibleSubSteps.length;

  const updateScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflowing = scrollWidth > clientWidth + 4;
    setIsOverflowing(overflowing);
    setCanScrollLeft(overflowing && scrollLeft > 8);
    setCanScrollRight(overflowing && scrollLeft < scrollWidth - clientWidth - 8);
  }, []);

  useEffect(() => {
    updateScrollBounds();
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleResize = () => updateScrollBounds();
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);

    return () => ro.disconnect();
  }, [updateScrollBounds, totalStepsCount]);

  // Identify active step ID for auto-scroll
  const activeStepKey = useMemo(() => {
    if (selectedVideoNumber === 1 && hasRedispatch) {
      for (const p of prerequisiteSteps) {
        if (!p.isCompleted) return p.id;
      }
    }
    for (const cfg of visibleSubSteps) {
      const state = getStepVisualState(record, selectedVideoNumber, cfg.id);
      if (state === 'in_progress' || state === 'pending') return cfg.id;
    }
    for (const cfg of visibleSubSteps) {
      const state = getStepVisualState(record, selectedVideoNumber, cfg.id);
      if (state === 'not_started') return cfg.id;
    }
    return visibleSubSteps[visibleSubSteps.length - 1]?.id || '';
  }, [record, selectedVideoNumber, hasRedispatch, prerequisiteSteps, visibleSubSteps]);

  const lastScrolledStepRef = useRef<string>('');

  // Smooth auto-scroll to active step
  useEffect(() => {
    if (!activeStepRef.current || !scrollContainerRef.current) return;
    if (lastScrolledStepRef.current === activeStepKey) return;
    lastScrolledStepRef.current = activeStepKey;

    const container = scrollContainerRef.current;
    const target = activeStepRef.current;

    const timer = setTimeout(() => {
      if (!container || !target) return;
      if (container.scrollWidth <= container.clientWidth) return;

      const targetOffset = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetOffset),
        behavior: 'smooth'
      });
      updateScrollBounds();
    }, 120);

    return () => clearTimeout(timer);
  }, [activeStepKey, updateScrollBounds]);

  const handleScrollBy = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 160;
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="relative flex-1 min-w-0 flex items-center group/timeline overflow-hidden">
      {/* Left Navigation Arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScrollBy('left')}
          className="absolute left-0 z-30 w-6 h-6 rounded-full bg-[#070c18]/95 hover:bg-[#0f1b38] border border-slate-700/90 text-slate-300 hover:text-white flex items-center justify-center shadow-xl transition-all cursor-pointer backdrop-blur-md"
          title="Scroll left to view previous steps"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Horizontally Scrollable Timeline Track */}
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollBounds}
        onWheel={handleWheel}
        className="flex-1 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 min-w-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-center min-w-max">
          {/* 1. PREREQUISITES: For Video 1 with Re-Dispatch cycles */}
          {selectedVideoNumber === 1 && hasRedispatch && prerequisiteSteps.map((pStep, pIdx) => {
            const pVisualState = pStep.isCompleted ? 'completed' : pStep.isPending ? 'pending' : 'not_started';
            const pVisualStyles = getStepVisualStyles(pVisualState);
            const isActiveStep = pStep.id === activeStepKey;

            return (
              <React.Fragment key={pStep.id}>
                <div
                  ref={isActiveStep ? activeStepRef : null}
                  className="flex flex-col items-center cursor-pointer group relative select-none shrink-0 min-w-0"
                  onClick={() => onOpenDeliveryModal(pStep)}
                  title={pStep.title}
                >
                  <div className={`w-7.5 h-7.5 sm:w-8 sm:h-8 xl:w-8.5 xl:h-8.5 rounded-full flex items-center justify-center transition-all duration-200 z-10 shrink-0 ${pVisualStyles.circle}`}>
                    {pStep.isCompleted ? (
                      <Check size={14} strokeWidth={2.5} className="text-white" />
                    ) : pStep.isPending ? (
                      <AlertTriangle size={13} className="text-amber-400" />
                    ) : pStep.type === 'redispatch' ? (
                      <RotateCcw size={13} className={`${pVisualStyles.iconClass} transition-colors`} />
                    ) : (
                      <Package size={13} className={`${pVisualStyles.iconClass} transition-colors`} />
                    )}
                  </div>
                  <div className="flex flex-col items-center text-center min-w-0 mt-1">
                    <span className={`text-[9px] sm:text-[9.5px] xl:text-[10px] text-center leading-tight transition-colors whitespace-nowrap block ${pVisualStyles.label}`}>
                      {pStep.label}
                    </span>
                  </div>
                </div>

                {/* Connecting Line after this prerequisite step */}
                {(() => {
                  let isPrereqLineActive = false;
                  if (pIdx < prerequisiteSteps.length - 1) {
                    const nextPrereq = prerequisiteSteps[pIdx + 1];
                    isPrereqLineActive = pStep.isCompleted && nextPrereq.isCompleted;
                  } else {
                    const firstSubStepConfig = visibleSubSteps[0];
                    if (firstSubStepConfig) {
                      const firstSubVisualState = getStepVisualState(record, selectedVideoNumber, firstSubStepConfig.id);
                      isPrereqLineActive = pStep.isCompleted && (firstSubVisualState === 'completed' || firstSubVisualState === 'skipped');
                    }
                  }

                  return (
                    <div className="w-4 sm:w-6 xl:w-8 h-[2px] mx-0.5 sm:mx-1 -mt-4 transition-colors duration-300 shrink-0">
                      <div className={`h-full w-full rounded-full transition-all duration-300 ${
                        isPrereqLineActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-700/60'
                      }`} />
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          })}

          {/* 2. SUB-STEPS FOR THE SELECTED VIDEO */}
          {visibleSubSteps.map((cfg, idx, arr) => {
            const visualState = getStepVisualState(record, selectedVideoNumber, cfg.id);
            const visualStyles = getStepVisualStyles(visualState);

            const isCompleted = visualState === 'completed';
            const isSkipped = visualState === 'skipped';
            const isReDraftReq = cfg.id === 'draft' && currentVideoData.isReDraftRequired;
            const StepIcon = cfg.icon;

            const isCurrentStepDone = isCompleted || isSkipped;
            const isActiveStep = cfg.id === activeStepKey;

            return (
              <React.Fragment key={`${selectedVideoNumber}-${cfg.id}`}>
                <div
                  ref={isActiveStep ? activeStepRef : null}
                  className="flex flex-col items-center cursor-pointer group relative select-none shrink-0 min-w-0"
                  onClick={() => {
                    if (selectedVideoNumber === 1 && cfg.id === 'delivered') {
                      onOpenDeliveryModal({
                        id: 'delivery-initial',
                        type: 'initial_delivery',
                        label: 'Delivered',
                        isCompleted: isDelivered,
                        isPending: isPendingReDispatch,
                        modalMode: isPendingReDispatch ? 'review_issue' : 'confirm_delivery',
                        title: 'Delivery Confirmation'
                      });
                      return;
                    }
                    if (!isDelivered) {
                      toast.error('Please complete Delivery Confirmation first.');
                      onOpenDeliveryModal({
                        id: 'delivery-initial',
                        type: 'initial_delivery',
                        label: 'Delivered',
                        isCompleted: isDelivered,
                        isPending: isPendingReDispatch,
                        modalMode: isPendingReDispatch ? 'review_issue' : 'confirm_delivery',
                        title: 'Delivery Confirmation'
                      });
                      return;
                    }
                    onOpenVideoModal(cfg.id);
                  }}
                  title={
                    selectedVideoNumber === 1 && cfg.id === 'delivered'
                      ? `Delivery Confirmation: ${isDelivered ? 'Completed' : 'Not Confirmed'}`
                      : !isDelivered
                      ? 'Requires Delivery Confirmation first'
                      : `${cfg.label} (${
                          visualState === 'completed'
                            ? 'Completed'
                            : visualState === 'skipped'
                            ? 'Skipped'
                            : isReDraftReq
                            ? 'Re-Draft Required'
                            : visualState === 'pending'
                            ? 'Pending Action'
                            : visualState === 'in_progress'
                            ? 'In Progress'
                            : 'Not Started'
                        })`
                  }
                >
                  <div className={`w-7.5 h-7.5 sm:w-8 sm:h-8 xl:w-8.5 xl:h-8.5 rounded-full flex items-center justify-center transition-all duration-200 z-10 shrink-0 ${visualStyles.circle}`}>
                    {isCompleted ? (
                      <Check size={14} strokeWidth={2.5} className="text-white" />
                    ) : isSkipped ? (
                      <FastForward size={13} className="text-amber-400" />
                    ) : isReDraftReq ? (
                      <span className="font-black text-[9px] text-rose-400 tracking-tight">RD</span>
                    ) : (
                      <StepIcon size={13} className={`${visualStyles.iconClass} transition-colors`} />
                    )}
                  </div>
                  <div className="flex flex-col items-center text-center min-w-0 mt-1">
                    <span className={`text-[9.5px] sm:text-[10px] xl:text-[10.5px] text-center leading-tight transition-colors whitespace-nowrap block ${visualStyles.label}`}>
                      {cfg.shortLabel || cfg.label}
                    </span>
                  </div>
                </div>

                {/* Connecting Line between Sub-Steps */}
                {idx !== arr.length - 1 && (() => {
                  const nextCfg = arr[idx + 1];
                  const nextVisualState = getStepVisualState(record, selectedVideoNumber, nextCfg.id);
                  const isNextStepDone = nextVisualState === 'completed' || nextVisualState === 'skipped';
                  const isLineActive = isCurrentStepDone && isNextStepDone;

                  return (
                    <div className="w-4 sm:w-6 xl:w-8 h-[2px] mx-0.5 sm:mx-1 -mt-4 transition-colors duration-300 shrink-0">
                      <div className={`h-full w-full rounded-full transition-all duration-300 ${isLineActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-700/60'}`} />
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right Navigation Arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScrollBy('right')}
          className="absolute right-0 z-30 w-6 h-6 rounded-full bg-[#070c18]/95 hover:bg-[#0f1b38] border border-slate-700/90 text-slate-300 hover:text-white flex items-center justify-center shadow-xl transition-all cursor-pointer backdrop-blur-md"
          title="Scroll right to view subsequent steps"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* "View All Steps" Expand Button when workflow overflows */}
      {isOverflowing && (
        <button
          type="button"
          onClick={() => onOpenViewAllModal(record)}
          className="ml-2 px-2 py-1 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/40 hover:border-purple-400 text-purple-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-sm whitespace-nowrap"
          title="Open complete chronological workflow sequence in modal"
        >
          <Maximize2 size={11} className="text-purple-400" />
          <span>All ({totalStepsCount})</span>
        </button>
      )}
    </div>
  );
};

interface ViewAllWorkflowStepsModalProps {
  record: StatusTrackingRecord;
  selectedVideoNumber: number;
  onClose: () => void;
  onOpenDeliveryModal: (pStep: PrerequisiteStep) => void;
  onOpenVideoModal: (cfgId: string) => void;
}

export const ViewAllWorkflowStepsModal: React.FC<ViewAllWorkflowStepsModalProps> = ({
  record,
  selectedVideoNumber,
  onClose,
  onOpenDeliveryModal,
  onOpenVideoModal,
}) => {
  const currentVideoData = getVideoWorkflow(record, selectedVideoNumber);
  const redispatchCycles = getInfluencerReDispatchCycles(record);
  const hasRedispatch = redispatchCycles.length > 0;
  const prerequisiteSteps = getInfluencerPrerequisiteSteps(record);
  const isDelivered = isInfluencerDeliveryConfirmed(record);
  const isPendingReDispatch = isInfluencerInReDispatch(record);

  const visibleSubSteps = currentVideoData.configs.filter(
    cfg => !(selectedVideoNumber === 1 && hasRedispatch && cfg.id === 'delivered')
  );

  const influencerCode = record.dispatch?.influencer_code || record.influencer?.code || (record as any).code || `ID ${record.influencer_id}`;
  const influencerName = record.influencer?.name || (record as any).name || record.dispatch?.influencer_name || 'Creator';
  const username = record.influencer?.instagram_username ? `@${record.influencer.instagram_username}` : '';

  const allOrderedSteps: Array<{
    id: string;
    stepNumber: number;
    label: string;
    type: 'prerequisite' | 'video_step';
    visualState: StepVisualState;
    visualStyles: any;
    isCompleted: boolean;
    isSkipped: boolean;
    isPending: boolean;
    title: string;
    pStep?: PrerequisiteStep;
    cfgId?: string;
    icon: any;
  }> = [];

  let stepCounter = 1;

  if (selectedVideoNumber === 1 && hasRedispatch) {
    prerequisiteSteps.forEach(p => {
      const pVisualState = p.isCompleted ? 'completed' : p.isPending ? 'pending' : 'not_started';
      const pVisualStyles = getStepVisualStyles(pVisualState);
      const StepIcon = p.type === 'redispatch' ? RotateCcw : Package;
      allOrderedSteps.push({
        id: p.id,
        stepNumber: stepCounter++,
        label: p.label,
        type: 'prerequisite',
        visualState: pVisualState,
        visualStyles: pVisualStyles,
        isCompleted: p.isCompleted,
        isSkipped: false,
        isPending: p.isPending,
        title: p.title,
        pStep: p,
        icon: StepIcon
      });
    });
  }

  visibleSubSteps.forEach(cfg => {
    const visualState = getStepVisualState(record, selectedVideoNumber, cfg.id);
    const visualStyles = getStepVisualStyles(visualState);
    allOrderedSteps.push({
      id: cfg.id,
      stepNumber: stepCounter++,
      label: cfg.label,
      type: 'video_step',
      visualState,
      visualStyles,
      isCompleted: visualState === 'completed',
      isSkipped: visualState === 'skipped',
      isPending: visualState === 'pending',
      title: cfg.label,
      cfgId: cfg.id,
      icon: cfg.icon
    });
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#070c18] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Maximize2 size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                Complete Workflow Timeline
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Full chronological sequence for Video {selectedVideoNumber} ({allOrderedSteps.length} Steps)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Influencer Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Influencer</div>
              <div className="text-white font-bold text-sm mt-0.5 flex items-center gap-2">
                <span>{influencerName}</span>
                {username && <span className="text-xs text-slate-400 font-normal">{username}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-semibold text-xs">
                Video {selectedVideoNumber}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 font-mono font-bold text-xs">
                {influencerCode}
              </span>
            </div>
          </div>

          {/* Full Horizontal Timeline Preview */}
          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-x-auto no-scrollbar">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Horizontal Flow
            </div>
            <div className="flex items-center min-w-max pb-2">
              {allOrderedSteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isLineActive = step.isCompleted && idx < allOrderedSteps.length - 1 && (allOrderedSteps[idx + 1].isCompleted || allOrderedSteps[idx + 1].isSkipped);

                return (
                  <React.Fragment key={`h-${step.id}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${step.visualStyles.circle}`}>
                        {step.isCompleted ? (
                          <Check size={14} strokeWidth={2.5} className="text-white" />
                        ) : step.isSkipped ? (
                          <FastForward size={13} className="text-amber-400" />
                        ) : (
                          <StepIcon size={13} className={step.visualStyles.iconClass} />
                        )}
                      </div>
                      <span className={`text-[9.5px] mt-1.5 whitespace-nowrap ${step.visualStyles.label}`}>
                        {step.label}
                      </span>
                    </div>

                    {idx < allOrderedSteps.length - 1 && (
                      <div className="w-6 sm:w-8 h-[2px] mx-1 -mt-4 shrink-0">
                        <div className={`h-full w-full rounded-full ${isLineActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-700/60'}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step-by-Step Chronological Checklist List */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Chronological Step Details
            </div>
            <div className="space-y-2">
              {allOrderedSteps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <div
                    key={`list-${step.id}`}
                    onClick={() => {
                      if (step.type === 'prerequisite' && step.pStep) {
                        onOpenDeliveryModal(step.pStep);
                      } else if (step.type === 'video_step' && step.cfgId) {
                        if (selectedVideoNumber === 1 && step.cfgId === 'delivered') {
                          onOpenDeliveryModal({
                            id: 'delivery-initial',
                            type: 'initial_delivery',
                            label: 'Delivered',
                            isCompleted: isDelivered,
                            isPending: isPendingReDispatch,
                            modalMode: isPendingReDispatch ? 'review_issue' : 'confirm_delivery',
                            title: 'Delivery Confirmation'
                          });
                        } else {
                          onOpenVideoModal(step.cfgId);
                        }
                      }
                    }}
                    className="p-3 bg-slate-900/60 hover:bg-slate-800/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-mono text-xs flex items-center justify-center font-bold shrink-0">
                        {step.stepNumber}
                      </span>
                      <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center shrink-0 ${step.visualStyles.circle}`}>
                        {step.isCompleted ? (
                          <Check size={13} strokeWidth={2.5} className="text-white" />
                        ) : step.isSkipped ? (
                          <FastForward size={12} className="text-amber-400" />
                        ) : (
                          <StepIcon size={12} className={step.visualStyles.iconClass} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-bold text-xs sm:text-sm group-hover:text-blue-300 transition-colors truncate">
                          {step.label}
                        </div>
                        <div className="text-slate-400 text-[10px] sm:text-xs">
                          {step.type === 'prerequisite' ? 'Delivery / Logistics Action' : `Video ${selectedVideoNumber} Sub-Step`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${step.visualStyles.badge}`}>
                        {step.visualStyles.badgeText}
                      </span>
                      <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                        ➔
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#070c18] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
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

  // Advanced Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<StatusTrackingFilterState>(initialStatusTrackingFilterState);

  // Search input state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Top Workflow Summary Step filter: null = All, or one of 'share_script' | 'call_explain' | 'pay_advance' | 'timeline' | 'draft' | 'post_date' | 'payment'
  const [selectedSummaryStep, setSelectedSummaryStep] = useState<string | null>(null);

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
    if (selectedSummaryStep) count += 1;
    return count;
  }, [activeFilters, selectedSummaryStep]);

  // Modals & Menu State
  const [activeModal, setActiveModal] = useState<{
    recordId: string;
    stageId: string;
    mode?: 'confirm_delivery' | 'review_issue';
    cycleNumber?: number;
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailsRecord, setDetailsRecord] = useState<StatusTrackingRecord | null>(null);
  const [viewAllModalRecord, setViewAllModalRecord] = useState<StatusTrackingRecord | null>(null);

  // Undo Step Modal State
  const [undoModalState, setUndoModalState] = useState<{
    isOpen: boolean;
    record: StatusTrackingRecord;
    stepInfo: StepUndoInfo;
  } | null>(null);
  const [isUndoingStep, setIsUndoingStep] = useState<boolean>(false);

  const handleOpenUndoModal = (record: StatusTrackingRecord) => {
    const stepInfo = getInfluencerLatestReversibleStep(record, selectedVideoNumber);
    if (!stepInfo) {
      toast.error(`No completed steps found for ${record.influencer?.code || (record as any).code || 'this influencer'} in Video ${selectedVideoNumber} to undo.`);
      return;
    }
    setUndoModalState({
      isOpen: true,
      record,
      stepInfo
    });
  };

  // LEVEL 1 WORKFLOW SELECTION STATE (Video 1 to Video 6)
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<WorkflowStepKey>('video1');

  const selectedVideoNumber = useMemo(() => {
    switch (selectedWorkflowStep) {
      case 'video1': return 1;
      case 'video2': return 2;
      case 'video3': return 3;
      case 'video4': return 4;
      case 'video5': return 5;
      case 'video6': return 6;
      default: return 1;
    }
  }, [selectedWorkflowStep]);

  // Auto-reset invalid selectedSummaryStep when switching videos
  useEffect(() => {
    if (selectedSummaryStep) {
      const validConfigs = getVideoSummaryBoxConfigs(selectedVideoNumber);
      if (!validConfigs.some(c => c.id === selectedSummaryStep)) {
        setSelectedSummaryStep(null);
      }
    }
  }, [selectedVideoNumber, selectedSummaryStep]);

  // LEVEL 2 VIEW STATE: null = Main List View; object = Video Detail View
  // Initialized from URL query params (stInfluencer, stVideo, stStep)
  const [selectedVideo, setSelectedVideo] = useState<{ recordId: string; videoNumber: number; stepId?: string | null } | null>(() => {
    const stInf = searchParams.get('stInfluencer');
    const stVid = searchParams.get('stVideo');
    const stStep = searchParams.get('stStep');
    if (stInf) {
      return { recordId: stInf, videoNumber: parseInt(stVid || '1', 10) || 1, stepId: stStep || null };
    }
    return null;
  });

  const [selectedVideoStepId, setSelectedVideoStepId] = useState<string | null>(() => {
    return searchParams.get('stStep') || null;
  });

  // Campaign scripts cache for Share Script integration
  const [campaignScripts, setCampaignScripts] = useState<CampaignScript[]>([]);
  const [isLoadingCampaignScripts, setIsLoadingCampaignScripts] = useState<boolean>(false);

  const loadCampaignScripts = useCallback(async () => {
    if (!campaign?.id) return;
    try {
      setIsLoadingCampaignScripts(true);
      const scripts = await fetchCampaignScripts(campaign.id);
      setCampaignScripts(scripts);
    } catch (err) {
      console.error('Failed to load campaign scripts for status tracking:', err);
    } finally {
      setIsLoadingCampaignScripts(false);
    }
  }, [campaign?.id]);

  useEffect(() => {
    loadCampaignScripts();
  }, [loadCampaignScripts]);

  // Synchronize selectedVideo with URL query parameters (e.g. browser back/forward or direct refresh)
  useEffect(() => {
    const stInf = searchParams.get('stInfluencer');
    const stVid = searchParams.get('stVideo');
    const stStep = searchParams.get('stStep');
    if (stInf) {
      const vNum = parseInt(stVid || '1', 10) || 1;
      setSelectedVideo(prev => {
        if (prev?.recordId === stInf && prev?.videoNumber === vNum && prev?.stepId === (stStep || null)) return prev;
        return { recordId: stInf, videoNumber: vNum, stepId: stStep || null };
      });
      setSelectedVideoStepId(stStep || null);
    } else {
      setSelectedVideo(null);
      setSelectedVideoStepId(null);
    }
  }, [searchParams]);

  // Navigation handlers for detail view and list view
  const handleOpenVideo = useCallback((record: StatusTrackingRecord, videoNumber: number, stepId?: string) => {
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
      if (stepId) {
        next.set('stStep', stepId);
      } else {
        next.delete('stStep');
      }
      return next;
    });
    setSelectedVideoStepId(stepId || null);
    setSelectedVideo({ recordId: record.id, videoNumber, stepId: stepId || null });
  }, [campaign.id, setSearchParams]);

  const handleBackFromDetail = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('stInfluencer');
      next.delete('stVideo');
      next.delete('stStep');
      return next;
    });
    setSelectedVideo(null);
    setSelectedVideoStepId(null);
  }, [setSearchParams]);

  const handleSwitchVideo = useCallback((recordId: string, videoNumber: number, stepId?: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('stVideo', String(videoNumber));
      if (stepId) {
        next.set('stStep', stepId);
      } else {
        next.delete('stStep');
      }
      return next;
    }, { replace: true });
    setSelectedVideoStepId(stepId || null);
    setSelectedVideo(prev => prev ? { ...prev, videoNumber, stepId: stepId || null } : { recordId, videoNumber, stepId: stepId || null });
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

  // Close menus and filter dropdowns on click outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.three-dot-menu-container')) {
        setOpenMenuId(null);
      }
      if (!target.closest('.status-tracking-filter-dropdown-container')) {
        setOpenFilterDropdown(null);
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

    // 1. Re-Dispatch Required: strictly active pending re-dispatch requirement
    if (isInfluencerInReDispatch(record)) {
      return {
        key: 'RE_DISPATCH_REQUIRED',
        label: 'Re-Dispatch Required',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/60',
        dotClass: 'bg-amber-400'
      };
    }

    // 2. Active - Re-Dispatch: moved to active and replacement not yet confirmed delivered
    if ((isInfluencerReDispatchActive(record) || getInfluencerReDispatchCycles(record).length > 0) && !isInfluencerDeliveryConfirmed(record)) {
      return {
        key: 'RE_DISPATCH_ACTIVE',
        label: 'Active — Re-Dispatch',
        badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-600/60',
        dotClass: 'bg-blue-400'
      };
    }

    // 3. On Hold
    if (rawStatus === 'on_hold' || rawStatus === 'on hold' || metadata.on_hold) {
      return {
        key: 'ON_HOLD',
        label: 'On Hold',
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
        dotClass: 'bg-slate-400'
      };
    }

    // 4. Not Started: if zero workflow steps completed
    if (isInfluencerWorkflowNotStarted(record, selectedVideoNumber)) {
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

    // 6. If delivered but videos not started
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

      // Restrict to influencers participating in the currently selected video
      const assignedVideos = getInfluencerAssignedVideos(record);
      if (!assignedVideos.includes(selectedVideoNumber)) return false;

      // 1. Video filter (OR within section)
      if (activeFilters.videos.length > 0) {
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

      // 5. Workflow Step filter (OR within section)
      if (activeFilters.workflowStatuses.length > 0) {
        if ((selectedWorkflowStep as any) === 'delivery') {
          const delStatus = getInfluencerDeliveryStatus(record);
          const matches = activeFilters.workflowStatuses.some(st => 
            areFilterValuesEqual(st, delStatus) || areFilterValuesEqual(normalizeWorkflowStepId(st), delStatus)
          );
          if (!matches) return false;
        } else {
          const vData = getVideoWorkflow(record, selectedVideoNumber);
          const activeStepId = vData.activeStepId;
          const matches = activeFilters.workflowStatuses.some(st => {
            const norm = normalizeWorkflowStepId(st);
            if (norm === activeStepId) return true;
            if (norm === 'payment' && (activeStepId === 'payment' || activeStepId === 'pay_advance')) return true;
            if (norm === 'pay_advance' && (activeStepId === 'payment' || activeStepId === 'pay_advance')) return true;
            const cfg = vData.configs.find(c => c.id === norm || areFilterValuesEqual(c.label, st) || areFilterValuesEqual(c.shortLabel, st));
            if (cfg && cfg.id === activeStepId) return true;
            return false;
          });
          if (!matches) return false;
        }
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

      // 9. Top summary step box filter (All, Delivered, Not Started, Share Script, Call Explain, Call Skipped, Time Line, Draft, Post Date, Re-Dispatch, Payment)
      if (selectedSummaryStep) {
        if (!isStepFilterMatch(selectedSummaryStep, record, selectedVideoNumber)) {
          return false;
        }
      }

      return true;
    });
  }, [activeTrackingRecords, activeFilters, searchQuery, selectedWorkflowStep, selectedVideoNumber, selectedSummaryStep]);

  // Dynamic workflow step counts for horizontal summary boxes based on CURRENTLY SELECTED VIDEO
  const workflowStepCounts = useMemo(() => {
    return validateFilterCounts(activeTrackingRecords, selectedVideoNumber);
  }, [activeTrackingRecords, selectedVideoNumber]);

  // Bulk Sync New Scripts across all active influencers safely without overwriting manual customizations
  const [isSyncingScripts, setIsSyncingScripts] = useState<boolean>(false);

  const handleSyncNewScripts = async () => {
    if (!campaign?.id) return;
    setIsSyncingScripts(true);
    const toastId = toast.loading('Syncing scripts from Script Management...');
    try {
      const freshScripts = await fetchCampaignScripts(campaign.id);
      setCampaignScripts(freshScripts);

      if (!freshScripts || freshScripts.length === 0) {
        toast.error('No scripts found in Script Management to sync.', { id: toastId });
        return;
      }

      let syncedCount = 0;
      const recordsToUpdate: Array<{ id: string; notes: string }> = [];

      for (const record of activeTrackingRecords) {
        const assignedVideos = getInfluencerAssignedVideos(record);
        let recordModified = false;
        let metadata: any = {};
        try {
          metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
        } catch (e) {
          metadata = {};
        }
        if (!metadata.videos) metadata.videos = {};

        for (const vNum of assignedVideos) {
          const vKey = String(vNum);
          if (!metadata.videos[vKey]) {
            metadata.videos[vKey] = { steps: {} };
          }
          if (!metadata.videos[vKey].steps) {
            metadata.videos[vKey].steps = {};
          }

          const stepObj = metadata.videos[vKey].steps['share_script'] || { completed: false, data: {} };
          const stepData = stepObj.data || {};

          // Match script for this influencer and video
          const matching = findMatchingScriptForInfluencer(freshScripts, record, vNum);
          if (!matching) continue;

          const matchingUpdated = matching.updated_at || matching.created_at;
          if (stepData.sourceScriptId === matching.id && stepData.sourceScriptUpdatedAt === matchingUpdated) {
            continue;
          }

          // Safety check: do not overwrite user-customized text
          const hasCustomContent = Boolean(
            (stepData.script && stepData.script.trim().length > 0 && stepData.script !== matching.model_script) ||
            (stepData.hooks && stepData.hooks.trim().length > 0 && stepData.hooks !== matching.key_points) ||
            stepData.is_customized
          );

          if (hasCustomContent) {
            stepData.has_newer_script_available = true;
            stepData.newer_script_id = matching.id;
            stepData.newer_script_updated_at = matchingUpdated;
            metadata.videos[vKey].steps['share_script'] = {
              ...stepObj,
              data: stepData
            };
            recordModified = true;
            continue;
          }

          const audioUrl = matching.reference_audio_file_path 
            ? getScriptAudioUrl(matching.reference_audio_file_path)
            : (matching.reference_audio_url || '');
          const videoUrl = matching.reference_video_file_path
            ? getScriptVideoUrl(matching.reference_video_file_path)
            : (matching.reference_video_url || '');

          const newVoiceRecord = audioUrl ? {
            file_name: matching.reference_audio_file_path?.split('/').pop() || `${matching.product} Audio`,
            storage_path: matching.reference_audio_file_path || '',
            url: audioUrl,
            uploaded_at: matchingUpdated || new Date().toISOString()
          } : (stepData.voice_record || null);

          const newReferenceVideo = videoUrl ? {
            file_name: matching.reference_video_file_path?.split('/').pop() || `${matching.product} Video`,
            storage_path: matching.reference_video_file_path || '',
            url: videoUrl,
            uploaded_at: matchingUpdated || new Date().toISOString()
          } : (stepData.reference_video || null);

          metadata.videos[vKey].steps['share_script'] = {
            ...stepObj,
            completed: stepObj.completed || false,
            data: {
              ...stepData,
              script: matching.model_script || '',
              hooks: matching.key_points || '',
              product_name: matching.product,
              language: matching.language,
              voice_record: newVoiceRecord,
              reference_video: newReferenceVideo,
              sourceScriptId: matching.id,
              sourceScriptUpdatedAt: matchingUpdated,
              loadedAt: new Date().toISOString(),
              has_newer_script_available: false
            }
          };

          recordModified = true;
          syncedCount++;
        }

        if (recordModified) {
          metadata.last_updated = new Date().toISOString();
          recordsToUpdate.push({
            id: record.id,
            notes: JSON.stringify(metadata)
          });
        }
      }

      if (recordsToUpdate.length > 0) {
        for (const item of recordsToUpdate) {
          await supabaseAdmin
            .from(SUPABASE_TABLES.influencerStatus)
            .update({ notes: item.notes, updated_at: new Date().toISOString() })
            .eq('id', item.id);
        }
        await refresh();
        toast.success(`Successfully synced scripts for ${syncedCount} influencer video(s)!`, { id: toastId });
      } else {
        toast.success('All influencer scripts are already up to date!', { id: toastId });
      }
    } catch (err: any) {
      console.error('Error syncing scripts:', err);
      toast.error('Failed to sync scripts: ' + (err?.message || err), { id: toastId });
    } finally {
      setIsSyncingScripts(false);
    }
  };

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

  // Dynamic step options for Workflow Step dropdown
  const workflowStepOptions = useMemo(() => {
    if ((selectedWorkflowStep as any) === 'delivery') {
      return [
        { id: 'all', label: 'All Steps', count: activeTrackingRecords.length },
        { id: 'not_delivered', label: 'Not Delivered', count: activeTrackingRecords.filter(r => getInfluencerDeliveryStatus(r) === 'Not Delivered').length },
        { id: 'delivered', label: 'Delivered', count: activeTrackingRecords.filter(r => getInfluencerDeliveryStatus(r) === 'Delivered').length },
        { id: 'delivery_confirmed', label: 'Delivery Confirmed', count: activeTrackingRecords.filter(r => getInfluencerDeliveryStatus(r) === 'Delivery Confirmed').length },
      ];
    }
    const configs = getVideoWorkflowConfigs(selectedVideoNumber);
    const activeStepCounts: Record<string, number> = {};
    for (let i = 0; i < activeTrackingRecords.length; i++) {
      const vData = getVideoWorkflow(activeTrackingRecords[i], selectedVideoNumber);
      if (vData.activeStepId) {
        activeStepCounts[vData.activeStepId] = (activeStepCounts[vData.activeStepId] || 0) + 1;
      }
    }

    const base = configs.map(cfg => {
      const label = cfg.id === 'pay_advance' ? 'Pay Advance' : (cfg.id === 'timeline' ? 'Timeline' : (cfg.id === 'call_explain' ? 'Call & Explain' : cfg.label));
      return {
        id: cfg.id,
        label,
        count: activeStepCounts[cfg.id] || 0,
        icon: cfg.icon
      };
    });

    return [
      { id: 'all', label: 'All Steps', count: activeTrackingRecords.length },
      ...base
    ];
  }, [selectedWorkflowStep, selectedVideoNumber, activeTrackingRecords]);

  // Matching counts for toolbar badge indicators
  const matchingWorkflowCount = useMemo(() => {
    if (activeFilters.workflowStatuses.length === 0) return activeTrackingRecords.length;
    return activeTrackingRecords.filter(record => {
      if ((selectedWorkflowStep as any) === 'delivery') {
        const delStatus = getInfluencerDeliveryStatus(record);
        return activeFilters.workflowStatuses.some(st => 
          areFilterValuesEqual(st, delStatus) || areFilterValuesEqual(normalizeWorkflowStepId(st), delStatus)
        );
      } else {
        const vData = getVideoWorkflow(record, selectedVideoNumber);
        const activeStepId = vData.activeStepId;
        return activeFilters.workflowStatuses.some(st => {
          const norm = normalizeWorkflowStepId(st);
          if (norm === activeStepId) return true;
          if (norm === 'payment' && (activeStepId === 'payment' || activeStepId === 'pay_advance')) return true;
          if (norm === 'pay_advance' && (activeStepId === 'payment' || activeStepId === 'pay_advance')) return true;
          const cfg = vData.configs.find(c => c.id === norm || areFilterValuesEqual(c.label, st) || areFilterValuesEqual(c.shortLabel, st));
          return !!(cfg && cfg.id === activeStepId);
        });
      }
    }).length;
  }, [activeTrackingRecords, activeFilters.workflowStatuses, selectedWorkflowStep, selectedVideoNumber]);

  const matchingDeliveryCount = useMemo(() => {
    if (activeFilters.deliveryStatuses.length === 0) return activeTrackingRecords.length;
    return activeTrackingRecords.filter(record => {
      const delStatus = getInfluencerDeliveryStatus(record);
      return activeFilters.deliveryStatuses.some(st => areFilterValuesEqual(st, delStatus));
    }).length;
  }, [activeTrackingRecords, activeFilters.deliveryStatuses]);

  // Dropdown filter state & toggle handlers
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'workflow' | 'delivery' | 'platform' | 'language' | 'price' | null>(null);

  const toggleFilterWorkflowStatus = (stepId: string) => {
    if (stepId === 'all') {
      setActiveFilters(prev => ({ ...prev, workflowStatuses: [] }));
      return;
    }
    setActiveFilters(prev => {
      const exists = prev.workflowStatuses.some(s => s === stepId || normalizeWorkflowStepId(s) === normalizeWorkflowStepId(stepId));
      return {
        ...prev,
        workflowStatuses: exists
          ? prev.workflowStatuses.filter(s => s !== stepId && normalizeWorkflowStepId(s) !== normalizeWorkflowStepId(stepId))
          : [...prev.workflowStatuses, stepId]
      };
    });
  };

  const toggleFilterDeliveryStatus = (status: string) => {
    setActiveFilters(prev => {
      const exists = prev.deliveryStatuses.some(s => areFilterValuesEqual(s, status));
      return {
        ...prev,
        deliveryStatuses: exists
          ? prev.deliveryStatuses.filter(s => !areFilterValuesEqual(s, status))
          : [...prev.deliveryStatuses, status]
      };
    });
  };

  const toggleFilterPlatform = (plat: string) => {
    setActiveFilters(prev => {
      const exists = prev.platforms.some(p => areFilterValuesEqual(p, plat));
      return {
        ...prev,
        platforms: exists
          ? prev.platforms.filter(p => !areFilterValuesEqual(p, plat))
          : [...prev.platforms, plat]
      };
    });
  };

  const toggleFilterLanguage = (lang: string) => {
    setActiveFilters(prev => {
      const exists = prev.languages.some(l => areFilterValuesEqual(l, lang));
      return {
        ...prev,
        languages: exists
          ? prev.languages.filter(l => !areFilterValuesEqual(l, lang))
          : [...prev.languages, lang]
      };
    });
  };

  const toggleFilterPriceRange = (rangeId: string) => {
    setActiveFilters(prev => {
      const exists = prev.priceRanges.includes(rangeId);
      return {
        ...prev,
        priceRanges: exists
          ? prev.priceRanges.filter(id => id !== rangeId)
          : [...prev.priceRanges, rangeId]
      };
    });
  };

  const handleClearAllFilters = () => {
    setActiveFilters(initialStatusTrackingFilterState);
    setSearchQuery('');
    setSelectedSummaryStep(null);
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
          const cleanInfCode = cleanCodeRef(record.dispatch?.influencer_code || record.influencer?.code || (record as any).code || record.influencer_id);
          const initial = await shipmentAttemptService.createInitialShipmentAttempt({
            campaign_id: record.campaign_id,
            influencer_id: record.influencer_id,
            influencer_code: cleanInfCode,
            courier: record.dispatch?.courier_partner,
            awb_number: record.dispatch?.tracking_id,
            dispatch_date: record.dispatch?.dispatch_date || null
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

        const targetCampId = record.campaign_id || campaign.id;
        const cleanInfCode = cleanCodeRef(record.dispatch?.influencer_code || record.influencer?.code || (record as any).code || record.influencer_id);

        if (attemptId) {
          await shipmentAttemptService.reportShipmentIssue(attemptId, {
            issue_type: data.issue_type,
            issue_remarks: data.issue_remarks,
            issue_proof_url: data.issue_proof_url,
            influencer_code: cleanInfCode
          });
        }

        const nowIso = new Date().toISOString();
        const existingCycles = getInfluencerReDispatchCycles(record);
        let updatedCycles = [...existingCycles];
        const lastCycle = updatedCycles.length > 0 ? updatedCycles[updatedCycles.length - 1] : null;

        if (lastCycle && lastCycle.status === 'PENDING_REDISPATCH') {
          lastCycle.issue_type = data.issue_type;
          lastCycle.issue_remarks = data.issue_remarks || '';
          lastCycle.issue_proof_url = data.issue_proof_url || '';
          lastCycle.updated_at = nowIso;
        } else {
          const nextCycleNumber = (lastCycle ? lastCycle.cycle_number : 0) + 1;
          const newCycle: ReDispatchCycle = {
            cycle_number: nextCycleNumber,
            status: 'PENDING_REDISPATCH',
            redispatch_code: `R ${cleanInfCode}`,
            issue_type: data.issue_type,
            issue_remarks: data.issue_remarks || '',
            issue_proof_url: data.issue_proof_url || '',
            reported_at: nowIso,
            previous_awb: record.dispatch?.tracking_id || '',
            previous_courier: record.dispatch?.courier_partner || '',
            delivered_confirmed: false,
            created_at: nowIso,
            updated_at: nowIso
          };
          updatedCycles.push(newCycle);
        }

        metadata.last_updated = nowIso;
        metadata.redispatch_cycles = updatedCycles;
        metadata.issue_reported = true;
        metadata.issue_type = data.issue_type;
        metadata.issue_remarks = data.issue_remarks || '';
        metadata.issue_proof_url = data.issue_proof_url || '';
        metadata.re_dispatch_required = true;
        metadata.delivered_confirmed = false;
        metadata.redispatch_lifecycle_status = 'PENDING_REDISPATCH';
        delete metadata.re_dispatch_moved_to_active;
        delete metadata.moved_to_active;

        // Persist to authoritative redispatch_records table
        await reDispatchQueueService.recordReDispatchIssue(targetCampId, {
          influencer_id: record.influencer_id,
          influencer_code: cleanInfCode,
          order_id: `R ${cleanInfCode}`,
          previous_awb: record.dispatch?.tracking_id,
          courier: record.dispatch?.courier_partner,
          issue_type: data.issue_type,
          issue_remark: data.issue_remarks
        });

        const updates: Partial<StatusTrackingRecord> = {
          delivered_confirmed: false,
          current_step: 0,
          status: 'Re-Dispatch Required',
          notes: JSON.stringify(metadata)
        };

        const result = await saveMilestone(recordId, updates);
        if (result.success) {
          toast.success('Shipment issue reported. Influencer moved to Re-Dispatch in Logistics.', { id: toastId });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('influencer_tracking_updated', {
              detail: { campaignId: targetCampId, influencerId: record.influencer_id, status: 'Re-Dispatch Required' }
            }));
            window.dispatchEvent(new CustomEvent('influencer_status_updated', {
              detail: { campaignId: targetCampId, influencerId: record.influencer_id }
            }));
            window.dispatchEvent(new CustomEvent('velmora:influencer-updated', {
              detail: { campaignId: targetCampId, influencerId: record.influencer_id }
            }));
          }
          clearVideoWorkflowCache(record);
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

        const targetCampId = record.campaign_id || campaign.id;
        const cleanInfCode = cleanCodeRef(record.dispatch?.influencer_code || record.influencer?.code || (record as any).code || record.influencer_id);
        const nowIso = new Date().toISOString();

        const existingCycles = getInfluencerReDispatchCycles(record);
        let updatedCycles = [...existingCycles];
        const lastCycle = updatedCycles.length > 0 ? updatedCycles[updatedCycles.length - 1] : null;

        if (lastCycle) {
          lastCycle.status = 'DELIVERED';
          lastCycle.delivered_confirmed = true;
          lastCycle.delivery_photo_url = data.delivery_photo_url;
          lastCycle.delivered_at = nowIso;
          lastCycle.updated_at = nowIso;
          metadata.redispatch_cycles = updatedCycles;
          metadata.redispatch_lifecycle_status = 'COMPLETED';
        }

        metadata.last_updated = nowIso;
        metadata.delivered_confirmed = true;
        metadata.delivery_photo_url = data.delivery_photo_url;
        if (metadata.redispatch_lifecycle_status || metadata.re_dispatch_moved_to_active || metadata.re_dispatch_required) {
          metadata.redispatch_lifecycle_status = 'COMPLETED';
          await reDispatchQueueService.completeReDispatch(targetCampId, {
            influencer_id: record.influencer_id,
            influencer_code: cleanInfCode
          });
        }
        delete metadata.re_dispatch_required;
        delete metadata.re_dispatch_moved_to_active;
        delete metadata.moved_to_active;
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
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('influencer_tracking_updated', {
              detail: { campaignId: targetCampId, influencerId: record.influencer_id, status: 'Active' }
            }));
            window.dispatchEvent(new CustomEvent('influencer_status_updated', {
              detail: { campaignId: targetCampId, influencerId: record.influencer_id }
            }));
            window.dispatchEvent(new CustomEvent('velmora:influencer-updated', {
              detail: { campaignId: targetCampId, influencerId: record.influencer_id }
            }));
          }
          clearVideoWorkflowCache(record);
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
    isStepCompleted: boolean,
    isStepSkipped?: boolean
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
    const isSkipped = isStepSkipped ?? Boolean(cleanStepData.call_skipped || cleanStepData.is_skipped);

    videoObj.steps[stepId] = {
      completed: isSkipped ? false : isStepCompleted,
      skipped: isSkipped,
      status: isSkipped ? 'SKIPPED' : (isStepCompleted ? 'COMPLETED' : 'IN_PROGRESS'),
      data: {
        ...cleanStepData,
        call_skipped: isSkipped,
        is_skipped: isSkipped
      },
      updated_at: new Date().toISOString()
    };

    const updates: Partial<StatusTrackingRecord> = {};

    if (stepId === 'draft') {
      const hasVid = Boolean(stepData.vid || (Array.isArray(stepData.attempts) && stepData.attempts.length > 0 && stepData.attempts[stepData.attempts.length - 1]?.video_url));
      if (!hasVid) {
        videoObj.is_re_draft_required = false;
        videoObj.steps['draft'] = {
          completed: false,
          skipped: false,
          status: 'NOT_STARTED',
          data: {
            attempts: [],
            active_attempt_number: 0,
            approval_status: '',
            vid: '',
            timing: 'Not Submit',
            corr: '',
            finalL: '',
            finalD: '',
            re_draft_submit_date: '',
            latest_re_draft_submit_date: '',
            is_deleted: true
          },
          updated_at: new Date().toISOString()
        };
      } else {
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
    const isStepDone = (cId: string) => {
      const s = videoObj.steps[cId];
      return Boolean(s?.completed || s?.skipped || s?.status === 'SKIPPED');
    };
    const completedOrSkippedCount = configs.filter(c => isStepDone(c.id)).length;
    const actualCompletedCount = configs.filter(c => videoObj.steps[c.id]?.completed).length;
    videoObj.completed_count = actualCompletedCount;
    videoObj.status = completedOrSkippedCount === configs.length ? 'COMPLETED' : ((completedOrSkippedCount > 0 || videoObj.is_re_draft_required) ? 'IN_PROGRESS' : 'NOT_STARTED');

    metadata.last_updated = new Date().toISOString();
    updates.notes = JSON.stringify(metadata);

    // Handle dedicated Step: Share Script relational persistence
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
        if (isSkipped) {
          updates.ref_call_explanation_required = false;
          metadata.call_explained = false;
          metadata.call_skipped = true;
        } else {
          updates.ref_call_explanation_required = isStepCompleted;
          metadata.call_explained = isStepCompleted;
          metadata.call_skipped = false;
        }
      } else if (stepId === 'share_script') {
        updates.reference_video_received = isStepCompleted;
        if (stepData.concept) updates.ref_concept = stepData.concept;
        if (stepData.script) updates.ref_script = stepData.script;
        metadata.script_shared = isStepCompleted;
      } else if (stepId === 'pay_advance') {
        updates.pay_advance_completed = isStepCompleted;
        if (stepData.payment_method === 'UPI' && stepData.gpay) {
          updates.advance_gpay_number = stepData.gpay;
        } else {
          updates.advance_gpay_number = null;
        }
        if (stepData.total) updates.advance_total_amount = stepData.total;
        if (stepData.advance) updates.advance_paid_amount = stepData.advance;
        if (stepData.paymentProof?.url || stepData.photo) {
          updates.pay_advance_photo_url = stepData.paymentProof?.url || stepData.photo;
        } else if (stepData.paymentProof === null || stepData.photo === '') {
          updates.pay_advance_photo_url = null;
        }
      } else if (stepId === 'timeline') {
        updates.expected_delivery_completed = isStepCompleted;
        if (stepData.date) updates.draft_expected_date = stepData.date;
        if (stepData.time) updates.draft_expected_time = stepData.time;
      } else if (stepId === 'draft') {
        const hasVid = Boolean(stepData.vid || (Array.isArray(stepData.attempts) && stepData.attempts.length > 0 && stepData.attempts[stepData.attempts.length - 1]?.video_url));
        if (!hasVid) {
          updates.draft_received = false;
          updates.draft_video_url = null;
          updates.draft_approval_status = null;
          updates.draft_timing_status = 'Not Submit';
          updates.draft_corrections_required = null;
          updates.draft_final_product_link = null;
          updates.draft_final_description = null;
        } else {
          updates.draft_received = isStepCompleted;
          if (stepData.vid) updates.draft_video_url = stepData.vid;
          if (stepData.approval_status || stepData.appStat) updates.draft_approval_status = stepData.approval_status || stepData.appStat;
          if (stepData.timing) updates.draft_timing_status = stepData.timing;
          if (stepData.corr !== undefined) updates.draft_corrections_required = stepData.corr;
          if (stepData.finalL !== undefined) updates.draft_final_product_link = stepData.finalL;
          if (stepData.finalD !== undefined) updates.draft_final_description = stepData.finalD;
        }
      } else if (stepId === 'post_date') {
        updates.final_post_completed = isStepCompleted;
        if (stepData.link) updates.final_post_link = stepData.link;
        if (stepData.postedAt) updates.final_post_actual_datetime = stepData.postedAt;
      }
      updates.notes = JSON.stringify(metadata);
    }

    if (stepId === 'pay_advance') {
      try {
        const vAgreed = parseFloat(stepData.total) || getInfluencerVideoPrice(record.influencer, videoNumber) || 0;
        const vPaid = parseFloat(stepData.advance) || 0;
        const proofUrl = stepData.paymentProof?.url !== undefined ? (stepData.paymentProof?.url || null) : (stepData.photo || null);
        await saveVideoPayment({
          campaignId: record.campaign_id,
          influencerId: record.influencer_id,
          videoNumber: videoNumber,
          paymentType: 'advance',
          agreedAmount: vAgreed,
          paidAmount: vPaid,
          paymentStatus: isStepCompleted || vPaid > 0 ? 'paid' : (stepData.payment_status || 'pending'),
          paymentMethod: stepData.payment_method || null,
          transactionReference: stepData.payment_method === 'UPI' ? (stepData.gpay || stepData.upi_id || stepData.upi_number || null) : null,
          paymentProofUrl: proofUrl,
          notes: stepData.notes || (stepData.account_number ? `Account: ${stepData.account_number}` : null),
        });

        // Optimistically update in-memory record.videoPayments
        if (!record.videoPayments) record.videoPayments = [];
        const existingIdx = record.videoPayments.findIndex((vp: any) => Number(vp.video_number) === Number(videoNumber) && vp.payment_type === 'advance');
        const updatedVp: any = {
          campaign_id: String(record.campaign_id),
          influencer_id: Number(record.influencer_id),
          video_number: Number(videoNumber),
          payment_type: 'advance',
          agreed_amount: vAgreed,
          paid_amount: vPaid,
          payment_status: isStepCompleted || vPaid > 0 ? 'paid' : (stepData.payment_status || 'pending'),
          payment_method: stepData.payment_method || null,
          transaction_reference: stepData.payment_method === 'UPI' ? (stepData.gpay || stepData.upi_id || stepData.upi_number || null) : null,
          payment_proof_url: proofUrl,
          notes: stepData.notes || null,
          updated_at: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          record.videoPayments[existingIdx] = { ...record.videoPayments[existingIdx], ...updatedVp };
        } else {
          record.videoPayments.push(updatedVp);
        }
      } catch (err) {
        console.error(`Failed to persist video ${videoNumber} advance payment record:`, err);
      }
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
          paymentMethod: stepData.payment_method || null,
          transactionReference: stepData.payment_method === 'UPI' ? (stepData.upi_number || stepData.gpay || null) : null,
          paymentProofUrl: stepData.photo || null,
          notes: stepData.notes || (stepData.account_number ? `Account: ${stepData.account_number}` : null),
        });
      } catch (err) {
        console.error(`Failed to persist video ${videoNumber} payment record:`, err);
      }
    }

    const result = await saveMilestone(recordId, updates);
    if (result.success) {
      clearVideoWorkflowCache(record);
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
      clearVideoWorkflowCache(record);
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

  const handleConfirmUndoStep = async () => {
    if (!undoModalState) return;
    const { record, stepInfo } = undoModalState;
    setIsUndoingStep(true);
    const toastId = toast.loading(`Undoing ${stepInfo.stepLabel}...`);

    try {
      const targetCampId = record.campaign_id || campaign.id;
      const targetInfId = record.influencer_id;
      if (!targetCampId || !targetInfId) {
        throw new Error('Missing campaign ID or influencer ID.');
      }

      let metadata: any = {};
      try {
        metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
      } catch (e) {
        metadata = {};
      }

      const updates: Partial<StatusTrackingRecord> = {};
      const nowIso = new Date().toISOString();

      // Case 1: Video Sub-Step
      if (stepInfo.type === 'video_step') {
        const vKey = String(stepInfo.videoNumber);
        metadata.videos = metadata.videos || {};
        metadata.videos[vKey] = metadata.videos[vKey] || { steps: {} };
        metadata.videos[vKey].steps = metadata.videos[vKey].steps || {};

        // Reset the target step
        metadata.videos[vKey].steps[stepInfo.stepId] = {
          completed: false,
          skipped: false,
          status: 'IN_PROGRESS',
          data: {},
          updated_at: nowIso
        };

        // Reset any affected downstream steps in this video
        if (stepInfo.affectedDownstreamSteps.length > 0) {
          const configs = getVideoWorkflowConfigs(stepInfo.videoNumber);
          configs.forEach(cfg => {
            if (stepInfo.affectedDownstreamSteps.some(s => s.toLowerCase().includes(cfg.label.toLowerCase()) || s.toLowerCase().includes(cfg.shortLabel.toLowerCase()))) {
              metadata.videos[vKey].steps[cfg.id] = {
                completed: false,
                skipped: false,
                status: 'IN_PROGRESS',
                data: {},
                updated_at: nowIso
              };
            }
          });
        }

        // Top-level column resets
        if (stepInfo.stepId === 'pay_advance') {
          updates.pay_advance_completed = false;
          updates.advance_paid_amount = '0';
          updates.pay_advance_photo_url = '';
          delete metadata.pay_advance_completed;
        } else if (stepInfo.stepId === 'call_explain') {
          updates.ref_call_explanation_required = false;
          delete metadata.call_explained;
          delete metadata.call_skipped;
          delete metadata.call_explanation_pending;
        } else if (stepInfo.stepId === 'share_script') {
          delete metadata.script_shared;
          updates.reference_video_received = false;
          try {
            await supabaseAdmin
              .from(SUPABASE_TABLES.videoScripts)
              .update({ script_shared_approved: false })
              .eq('campaign_id', targetCampId)
              .eq('influencer_id', targetInfId)
              .eq('video_number', stepInfo.videoNumber);
          } catch (scErr) {
            console.warn('Could not reset campaign_video_scripts:', scErr);
          }
        } else if (stepInfo.stepId === 'post_date') {
          if (stepInfo.videoNumber === 1) {
            updates.final_post_link = '';
            updates.final_post_completed = false;
          }
        } else if (stepInfo.stepId === 'payment') {
          try {
            await supabaseAdmin
              .from(SUPABASE_TABLES.videoPayments)
              .update({ payment_status: 'pending' })
              .eq('campaign_id', targetCampId)
              .eq('influencer_id', targetInfId)
              .eq('video_number', stepInfo.videoNumber);
          } catch (pErr) {
            console.warn('Could not reset videoPayments:', pErr);
          }
        }

        // Recalculate current_step for Video 1
        if (stepInfo.videoNumber === 1) {
          const v1Steps = metadata.videos['1']?.steps || {};
          let nextStep = 1; // delivery confirmed
          if (v1Steps.share_script?.completed) nextStep = 2;
          if (v1Steps.call_explain?.completed || v1Steps.call_explain?.skipped) nextStep = 2;
          if (v1Steps.pay_advance?.completed) nextStep = 3;
          if (v1Steps.timeline?.completed) nextStep = 4;
          if (v1Steps.draft?.completed) nextStep = 5;
          if (v1Steps.post_date?.completed) nextStep = 6;
          updates.current_step = nextStep;
        }

        updates.notes = JSON.stringify(metadata);

      // Case 2: Prerequisite Delivery
      } else if (stepInfo.type === 'prerequisite_delivery') {
        if (stepInfo.cycleNumber) {
          const cycles: any[] = metadata.redispatch_cycles || [];
          const targetCycle = cycles.find(c => c.cycle_number === stepInfo.cycleNumber);
          if (targetCycle) {
            targetCycle.delivered_confirmed = false;
            targetCycle.status = 'MOVED_TO_ACTIVE';
            delete targetCycle.delivery_photo_url;
            delete targetCycle.delivered_at;
            targetCycle.updated_at = nowIso;
          }
          metadata.delivered_confirmed = false;
          metadata.redispatch_lifecycle_status = 'MOVED_TO_ACTIVE';
          updates.delivered_confirmed = false;
          updates.status = 'Active';
          updates.current_step = 0;

          await supabaseAdmin
            .from(SUPABASE_TABLES.redispatchRecords)
            .update({
              redispatch_status: 'MOVED_TO_ACTIVE',
              completed_at: null,
              updated_at: nowIso
            })
            .eq('campaign_id', targetCampId)
            .eq('influencer_id', targetInfId);

        } else {
          // Initial delivery
          metadata.delivered_confirmed = false;
          delete metadata.delivery_photo_url;
          delete metadata.delivered_date;
          updates.delivered_confirmed = false;
          updates.status = 'Not Delivered';
          updates.current_step = 0;
        }

        // Reset any Video 1 sub-steps
        if (metadata.videos && metadata.videos['1']) {
          metadata.videos['1'].steps = {};
          metadata.videos['1'].status = 'NOT_STARTED';
        }
        delete metadata.script_shared;
        delete metadata.call_explained;
        delete metadata.call_skipped;
        delete metadata.pay_advance_completed;
        updates.pay_advance_completed = false;
        updates.reference_video_received = false;
        updates.ref_call_explanation_required = false;

        updates.notes = JSON.stringify(metadata);

      // Case 3: Prerequisite Re-Dispatch
      } else if (stepInfo.type === 'prerequisite_redispatch') {
        const cycles: any[] = metadata.redispatch_cycles || [];
        const cycleIdx = cycles.findIndex(c => c.cycle_number === stepInfo.cycleNumber);
        if (cycleIdx !== -1) {
          const targetCycle = cycles[cycleIdx];
          if (targetCycle.status === 'MOVED_TO_ACTIVE') {
            targetCycle.status = 'PENDING_REDISPATCH';
            delete targetCycle.moved_to_active_at;
            targetCycle.updated_at = nowIso;
            metadata.redispatch_lifecycle_status = 'PENDING_REDISPATCH';
            metadata.re_dispatch_required = true;
            updates.status = 'Re-Dispatch Required';
            updates.delivered_confirmed = false;
            updates.current_step = 0;

            await supabaseAdmin
              .from(SUPABASE_TABLES.redispatchRecords)
              .update({
                redispatch_status: 'PENDING',
                moved_to_active_at: null,
                updated_at: nowIso
              })
              .eq('campaign_id', targetCampId)
              .eq('influencer_id', targetInfId);

          } else {
            // Target cycle was PENDING_REDISPATCH: remove it completely
            const remaining = cycles.filter(c => c.cycle_number !== stepInfo.cycleNumber);
            metadata.redispatch_cycles = remaining;

            await supabaseAdmin
              .from(SUPABASE_TABLES.redispatchRecords)
              .delete()
              .eq('campaign_id', targetCampId)
              .eq('influencer_id', targetInfId);

            if (remaining.length > 0) {
              const prev = remaining[remaining.length - 1];
              if (prev.status === 'DELIVERED' || prev.delivered_confirmed) {
                metadata.delivered_confirmed = true;
                metadata.redispatch_lifecycle_status = 'COMPLETED';
                metadata.re_dispatch_required = false;
                metadata.issue_reported = false;
                updates.delivered_confirmed = true;
                updates.status = 'Active';
                updates.current_step = 1;
              } else {
                metadata.redispatch_lifecycle_status = prev.status;
                updates.status = prev.status === 'MOVED_TO_ACTIVE' ? 'Active' : 'Re-Dispatch Required';
              }
            } else {
              metadata.re_dispatch_required = false;
              metadata.issue_reported = false;
              delete metadata.redispatch_lifecycle_status;
              updates.status = 'Active';
              updates.delivered_confirmed = true;
              updates.current_step = 1;
            }
          }
        }
        updates.notes = JSON.stringify(metadata);
      }

      // Persist to influencer_status_tracking_rows
      const result = await saveMilestone(record.id, updates);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update database row.');
      }

      clearVideoWorkflowCache(record);

      await logActivity(
        campaign.id,
        'STATUS_UPDATE',
        `Undone step "${stepInfo.stepLabel}" for influencer ${record.influencer?.code || record.influencer_id} in Video ${stepInfo.videoNumber}`
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('influencer_tracking_updated', {
          detail: {
            campaignId: targetCampId,
            influencerId: targetInfId,
            videoNumber: stepInfo.videoNumber,
            undoneStep: stepInfo.stepId
          }
        }));
        window.dispatchEvent(new CustomEvent('influencer_status_updated', {
          detail: {
            campaignId: targetCampId,
            influencerId: targetInfId
          }
        }));
      }

      await refresh();
      toast.success(`Successfully undone "${stepInfo.stepLabel}" for ${record.influencer?.code || 'influencer'}!`, { id: toastId });
      setUndoModalState(null);

    } catch (err: any) {
      console.error('Error during undo step execution:', err);
      toast.error(err.message || 'Failed to undo step. Please try again.', { id: toastId });
    } finally {
      setIsUndoingStep(false);
    }
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
    <div className="bg-[#070c18] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[calc(100vh-120px)] min-h-[750px] shadow-2xl p-3 sm:p-4 gap-2.5 sm:gap-3 w-full max-w-full min-w-0">
      
      {/* =========================================================================
          LEVEL 2: DEDICATED VIDEO DETAIL VIEW
      ========================================================================= */}
      {selectedVideo ? (
        selectedRecord ? (
          <VideoDetailView 
            record={selectedRecord}
            videoNumber={selectedVideo.videoNumber}
            initialStepId={selectedVideoStepId || selectedVideo.stepId}
            campaign={campaign}
            campaignScripts={campaignScripts}
            onRefreshScripts={loadCampaignScripts}
            onBack={handleBackFromDetail}
            onSwitchVideo={(num) => handleSwitchVideo(selectedRecord.id, num)}
            onSaveStep={(stepId, data, completed, isSkipped) => handleSaveVideoStep(selectedRecord.id, selectedVideo.videoNumber, stepId, data, completed, isSkipped)}
            onStepChange={(stepId) => {
              setSelectedVideoStepId(stepId);
              setSelectedVideo(prev => prev ? { ...prev, stepId } : null);
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('stStep', stepId);
                return next;
              }, { replace: true });
            }}
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
          {/* 1. STATUS TRACKING VIDEO NAVIGATION HEADER */}
          <div className="w-full bg-[#080e1e] border border-blue-900/30 rounded-[20px] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-lg">
            {/* Center / Video Navigation (Clean line, no outer subcard) */}
            <div className="flex-1 flex items-center justify-center sm:justify-start md:justify-center overflow-x-auto no-scrollbar min-w-0 py-1">
              <div className="flex items-center min-w-[420px] max-w-2xl w-full justify-between px-2">
                {[1, 2, 3, 4, 5, 6].map((vNum, idx) => {
                  const stepKey = `video${vNum}` as WorkflowStepKey;
                  const isSelected = selectedWorkflowStep === stepKey;
                  const isLineActive = isSelected || (idx === 0 && selectedVideoNumber >= 2);

                  return (
                    <React.Fragment key={stepKey}>
                      <div
                        onClick={() => setSelectedWorkflowStep(stepKey)}
                        className="flex flex-col items-center cursor-pointer group select-none relative shrink-0"
                        title={`Switch to Video ${vNum} Workflow`}
                      >
                        {/* Node Icon Circle */}
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full sm:rounded-[14px] flex items-center justify-center transition-all duration-200 z-10 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.9)] border border-blue-400 scale-105'
                              : 'bg-[#0c142b] border border-blue-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          <Video size={17} className={isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'} />
                        </div>

                        {/* Label & Active Dot */}
                        <div className="flex flex-col items-center mt-1.5 text-center min-w-0">
                          {isSelected ? (
                            <>
                              <span className="bg-blue-600 text-white text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.6)] whitespace-nowrap">
                                Video {vNum}
                              </span>
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shadow-[0_0_6px_#60a5fa] mt-1" />
                            </>
                          ) : (
                            <span className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-200 font-medium whitespace-nowrap transition-colors py-0.5">
                              Video {vNum}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Connecting Line between Video Steps */}
                      {idx !== 5 && (
                        <div className="flex-1 min-w-[16px] sm:min-w-[28px] h-[2px] mx-1.5 sm:mx-2.5 -mt-6 sm:-mt-7 transition-colors duration-300">
                          <div
                            className={`h-full w-full rounded-full transition-all duration-300 ${
                              isLineActive
                                ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                                : 'bg-slate-700/60'
                            }`}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Right: Actions (Refresh & Back Icon-only Buttons) */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button 
                onClick={refresh}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#091024] hover:bg-slate-800 border border-slate-800/90 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                title="Refresh Data"
              >
                <RefreshCcw size={17} />
              </button>
              <button 
                onClick={onBack}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#091024] hover:bg-slate-800 border border-slate-800/90 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                title="Back to Overview"
              >
                <ArrowLeft size={17} />
              </button>
            </div>
          </div>

          {/* 2. HORIZONTAL WORKFLOW STEP SUMMARY COUNT BOXES */}
          <div className="flex flex-col gap-2.5 shrink-0">
            {/* Top: Horizontal Workflow Step Summary Boxes in ONE Single Line */}
            <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth pb-1">
              <div className="grid grid-flow-col auto-cols-[minmax(96px,1fr)] sm:auto-cols-[minmax(105px,1fr)] 2xl:auto-cols-auto 2xl:grid-cols-12 gap-1.5 sm:gap-2 w-full min-w-[1020px] 2xl:min-w-0">
                {/* 1. All Box */}
                <button
                  type="button"
                  onClick={() => setSelectedSummaryStep(null)}
                  className={`group relative flex flex-col justify-between p-2 sm:p-2.5 h-[68px] sm:h-[72px] rounded-xl border text-left transition-all duration-200 cursor-pointer shadow-sm min-w-0 ${
                    selectedSummaryStep === null
                      ? 'bg-gradient-to-b from-purple-900/40 via-purple-900/20 to-[#0b1329] border-purple-500 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                      : 'bg-[#0b1329] border-slate-800/80 hover:border-slate-700 hover:bg-[#0e1834] text-slate-300'
                  }`}
                  title="View All Influencers"
                >
                  <div className="flex items-center justify-between gap-1 mb-1 w-full">
                    <span className={`text-[10.5px] sm:text-[11px] font-semibold truncate ${
                      selectedSummaryStep === null ? 'text-purple-200' : 'text-slate-300 group-hover:text-white'
                    }`}>
                      All
                    </span>
                    <Users 
                      size={13} 
                      className={`shrink-0 transition-colors ${
                        selectedSummaryStep === null ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'
                      }`} 
                    />
                  </div>
                  <div className="flex items-baseline justify-between w-full">
                    <span className="text-base sm:text-lg xl:text-xl font-black text-white tracking-tight">
                      {workflowStepCounts.all}
                    </span>
                    {selectedSummaryStep === null && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    )}
                  </div>
                </button>

                {/* Workflow Step Boxes */}
                {getVideoSummaryBoxConfigs(selectedVideoNumber).filter(step => step.id !== 'all').map(step => {
                  const isSelected = selectedSummaryStep === step.id;
                  const count = workflowStepCounts[step.id] || 0;
                  const StepIcon = step.icon;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        setSelectedSummaryStep(prev => prev === step.id ? null : step.id);
                      }}
                      className={`group relative flex flex-col justify-between p-2 sm:p-2.5 h-[68px] sm:h-[72px] rounded-xl border text-left transition-all duration-200 shadow-sm min-w-0 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-b from-purple-900/40 via-purple-900/20 to-[#0b1329] border-purple-500 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                          : 'bg-[#0b1329] border-slate-800/80 hover:border-slate-700 hover:bg-[#0e1834] text-slate-300'
                      }`}
                      title={`Filter by ${step.label} (${count})`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1 w-full">
                        <span className={`text-[10.5px] sm:text-[11px] font-semibold truncate ${
                          isSelected 
                            ? 'text-purple-200' 
                            : 'text-slate-300 group-hover:text-white'
                        }`}>
                          {step.shortLabel || step.label}
                        </span>
                        <StepIcon 
                          size={13} 
                          className={`shrink-0 transition-colors ${
                            isSelected 
                              ? 'text-purple-400' 
                              : 'text-slate-500 group-hover:text-slate-300'
                          }`} 
                        />
                      </div>
                      <div className="flex items-baseline justify-between w-full">
                        <span className="text-base sm:text-lg xl:text-xl font-black text-white tracking-tight">
                          {count}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Toolbar: Filter Status + Search Bar + Advanced Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 pt-0.5">
              <div className="flex items-center gap-2 text-xs">
                {selectedSummaryStep ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400">Filtered by:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 font-semibold flex items-center gap-1.5 text-xs">
                      <span>{getVideoSummaryBoxConfigs(selectedVideoNumber).find(b => b.id === selectedSummaryStep)?.label}</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedSummaryStep(null)}
                        className="hover:text-white text-purple-400 cursor-pointer ml-0.5"
                        title="Clear filter"
                      >
                        <X size={12} />
                      </button>
                    </span>
                    <span className="text-slate-500 text-xs">({filteredRecords.length} matching)</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">
                    Showing {filteredRecords.length} {filteredRecords.length === 1 ? 'Influencer' : 'Influencers'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Sync New Scripts Button */}
                <button
                  type="button"
                  onClick={handleSyncNewScripts}
                  disabled={isSyncingScripts || isLoadingCampaignScripts}
                  className="h-[38px] px-3.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/40 hover:border-purple-500/70 text-purple-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Sync new/updated scripts from Script Management to matching influencers safely without overwriting manual customizations"
                >
                  <RefreshCcw size={14} className={isSyncingScripts ? 'animate-spin text-purple-400' : 'text-purple-400'} />
                  <span className="hidden sm:inline">{isSyncingScripts ? 'Syncing Scripts...' : 'Sync New Scripts'}</span>
                  <span className="sm:hidden">{isSyncingScripts ? 'Syncing...' : 'Sync Scripts'}</span>
                </button>

                <div className="relative w-full sm:w-[280px] md:w-[320px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search influencer, phone, code..."
                    className="w-full h-[38px] bg-[#0b1329] border border-slate-800/80 rounded-xl pl-9 pr-4 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                {/* Advanced Filter drawer button */}
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className={`w-[38px] h-[38px] bg-[#0b1329] border ${
                    activeFilterCount > 0 
                      ? 'border-purple-500 text-purple-300 font-semibold bg-purple-600/10' 
                      : 'border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
                  } rounded-xl flex items-center justify-center transition-colors relative cursor-pointer shadow-sm shrink-0`}
                  title="Advanced Filter Options"
                >
                  <SlidersHorizontal size={16} className={activeFilterCount > 0 ? 'text-purple-400' : 'text-slate-400'} />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center select-none shadow-md border border-[#070c18]">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {(activeFilterCount > 0 || searchQuery.trim() || selectedSummaryStep) && (
                  <button 
                    type="button" 
                    onClick={handleClearAllFilters}
                    className="h-[38px] text-slate-400 hover:text-slate-200 text-xs px-2.5 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer whitespace-nowrap flex items-center"
                    title="Reset all active search and filter criteria"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. DEDICATED INTERNAL VERTICAL SCROLL CONTAINER */}
          <div 
            ref={listScrollContainerRef}
            onScroll={handleListScroll}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-2.5 w-full max-w-full"
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
                  {activeFilterCount > 0 || searchQuery.trim() || selectedSummaryStep
                    ? 'No influencers match the selected filters.'
                    : 'No matching status tracking records'}
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  {activeFilterCount > 0 || searchQuery.trim() || selectedSummaryStep
                    ? 'Try adjusting or clearing your filters to view influencers.'
                    : 'Dispatch an influencer with Delivered shipment status to begin status tracking.'}
                </p>
                {(activeFilterCount > 0 || searchQuery.trim() || selectedSummaryStep) && (
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

                const isDelivered = isInfluencerDeliveryConfirmed(record);
                const overallStatus = getOverallStatus(record);
                const redispatchCycles = getInfluencerReDispatchCycles(record);
                const hasRedispatch = redispatchCycles.length > 0;
                const isPendingReDispatch = overallStatus.key === 'RE_DISPATCH_REQUIRED' || isInfluencerInReDispatch(record);
                const isMenuOpen = openMenuId === record.id;

                // Derive status for the selected video workflow
                const currentVideoData = getVideoWorkflow(record, selectedVideoNumber);
                const prerequisiteSteps = getInfluencerPrerequisiteSteps(record);

                return (
                  <div 
                    key={record.id}
                    id={`st-card-${record.dispatch_id || record.id}`}
                    className="bg-[#0b1329] hover:bg-[#0e1733] border border-slate-800/90 hover:border-slate-700/80 rounded-xl px-3.5 py-3 sm:px-4 sm:py-3.5 min-h-[86px] sm:min-h-[88px] transition-all duration-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 w-full min-w-0"
                  >
                    {/* LEFT SECTION: Compact Code Badge, Profile, Name, Username */}
                    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 w-auto max-w-[200px] sm:max-w-[230px] xl:max-w-[250px] min-w-0">
                      {/* Influencer Code Badge */}
                      <div className="px-2 py-1 rounded-lg bg-[#070c18] border border-slate-700/80 text-white font-mono font-bold text-xs sm:text-[13px] tracking-wider shrink-0 shadow-sm text-center">
                        {influencerCode}
                      </div>

                      {/* Profile Avatar */}
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0 border border-slate-700 bg-slate-900 flex items-center justify-center shadow">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={influencerName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 font-extrabold text-xs sm:text-sm">{influencerName.charAt(0) || '?'}</span>
                        )}
                      </div>

                      {/* Influencer Name & Username */}
                      <div className="truncate min-w-0 flex-1">
                        <h4 className="text-white font-bold text-xs sm:text-[13.5px] leading-tight truncate" title={influencerName}>
                          {influencerName}
                        </h4>
                        <p className="text-slate-400 text-[10px] sm:text-[11px] font-medium mt-0.5 truncate" title={username}>
                          {username}
                        </p>
                      </div>
                    </div>

                    {/* CENTER SECTION: Horizontally Scrollable Contextual Workflow Timeline */}
                    <div className="flex-1 px-1 sm:px-2 xl:px-3 py-1 min-w-0 w-full overflow-hidden">
                      <RowWorkflowTimeline
                        record={record}
                        selectedVideoNumber={selectedVideoNumber}
                        hasRedispatch={hasRedispatch}
                        prerequisiteSteps={prerequisiteSteps}
                        currentVideoData={currentVideoData}
                        isDelivered={isDelivered}
                        isPendingReDispatch={isPendingReDispatch}
                        onOpenDeliveryModal={(pStep) => {
                          setActiveModal({
                            recordId: record.id,
                            stageId: 'delivered',
                            mode: pStep.modalMode,
                            cycleNumber: pStep.cycleNumber
                          });
                        }}
                        onOpenVideoModal={(cfgId) => {
                          handleOpenVideo(record, selectedVideoNumber, cfgId);
                        }}
                        onOpenViewAllModal={(rec) => {
                          setViewAllModalRecord(rec);
                        }}
                      />
                    </div>

                    {/* RIGHT SECTION: Video Status, Manage Button & Three-Dot Menu */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 justify-end w-auto min-w-0">
                      {/* Video Status Badge */}
                      {(() => {
                        const workflowState = getInfluencerCurrentWorkflowState(record, selectedVideoNumber);
                        const hasMatchingScript = Boolean(findMatchingScriptForInfluencer(campaignScripts, record, selectedVideoNumber));
                        const shareStep = currentVideoData.steps['share_script'];
                        const isScriptLoaded = Boolean(
                          shareStep?.data?.model_script || shareStep?.data?.script || shareStep?.data?.script_body || shareStep?.data?.script_link || shareStep?.data?.sourceScriptId
                        );
                        const isShareScriptDone = isInfluencerShareScriptCompleted(record, selectedVideoNumber);

                        if (overallStatus.key === 'RE_DISPATCH_REQUIRED' || isPendingReDispatch) {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60 animate-pulse flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <AlertTriangle size={13} className="text-amber-400" />
                              <span>Re-Dispatch Required</span>
                            </span>
                          );
                        } else if (overallStatus.key === 'RE_DISPATCH_ACTIVE' || (hasRedispatch && !isDelivered)) {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <RotateCcw size={13} className="text-blue-400" />
                              <span>Active — Re-Dispatch</span>
                            </span>
                          );
                        } else if (overallStatus.key === 'ON_HOLD') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>On Hold</span>
                            </span>
                          );
                        } else if (currentVideoData.status === 'COMPLETED' || isInfluencerVideoCompleted(record, selectedVideoNumber)) {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <Check size={13} strokeWidth={2.5} />
                              <span>Completed</span>
                            </span>
                          );
                        } else if (currentVideoData.isReDraftRequired) {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-600/60 animate-pulse flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <AlertTriangle size={13} />
                              <span>Re-Draft Req</span>
                            </span>
                          );
                        } else if (workflowState === 'delivered') {
                          // Delivered is confirmed, next step is Share Script
                          if (isScriptLoaded && !isShareScriptDone) {
                            return (
                              <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                                <span>In Progress</span>
                              </span>
                            );
                          } else if (hasMatchingScript && !isShareScriptDone) {
                            return (
                              <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                                <FileText size={12} className="text-purple-400" />
                                <span>Script Available</span>
                              </span>
                            );
                          } else {
                            return (
                              <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                                <Package size={12} className="text-emerald-400" />
                                <span>Delivered</span>
                              </span>
                            );
                          }
                        } else if (workflowState === 'share_script') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>Share Script</span>
                            </span>
                          );
                        } else if (workflowState === 'call_explain') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>Call Explain</span>
                            </span>
                          );
                        } else if (workflowState === 'timeline') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>Time Line</span>
                            </span>
                          );
                        } else if (workflowState === 'draft') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>Draft</span>
                            </span>
                          );
                        } else if (workflowState === 'post_date') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>Post Date</span>
                            </span>
                          );
                        } else if (workflowState === 'payment') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>Payment</span>
                            </span>
                          );
                        } else if (currentVideoData.status === 'IN_PROGRESS') {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-600/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                              <span>In Progress</span>
                            </span>
                          );
                        } else {
                          return (
                            <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-slate-900/90 text-slate-400 border border-slate-800 flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                              <span>Not Started</span>
                            </span>
                          );
                        }
                      })()}

                      {/* Manage Video Action Button */}
                      {!isDelivered ? (
                        isPendingReDispatch ? (
                          <button
                            onClick={() => {
                              setActiveModal({ recordId: record.id, stageId: 'delivered', mode: 'review_issue' });
                            }}
                            className="px-2.5 sm:px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 hover:text-amber-200 border border-amber-600/50 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                            title="Review Reported Issue / Delivery Details"
                          >
                            <AlertTriangle size={12} className="text-amber-400" />
                            <span>Review Issue</span>
                          </button>
                        ) : hasRedispatch ? (
                          <button
                            onClick={() => {
                              setActiveModal({ recordId: record.id, stageId: 'delivered', mode: 'confirm_delivery' });
                            }}
                            className="px-2.5 sm:px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                            title="Confirm Replacement Delivery"
                          >
                            <Package size={12} className="text-blue-400" />
                            <span>Confirm Delivery</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              toast.error('Please complete Delivery Confirmation first.');
                              setActiveModal({ recordId: record.id, stageId: 'delivered', mode: 'confirm_delivery' });
                            }}
                            className="px-2.5 sm:px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                            title="Delivery confirmation is required before managing video"
                          >
                            <Lock size={12} />
                            <span>Requires Delivery</span>
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleOpenVideo(record, selectedVideoNumber)}
                          className="px-3 sm:px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                          title={`Manage Video ${selectedVideoNumber}`}
                        >
                          <Video size={13} />
                          <span>Manage Video {selectedVideoNumber}</span>
                        </button>
                      )}

                      {/* Three-Dot Menu */}
                      <div className="relative three-dot-menu-container shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : record.id);
                          }}
                          className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="More actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-10 w-56 bg-[#0c1326] border border-slate-700/80 rounded-xl shadow-2xl z-40 py-1.5 overflow-hidden animate-fade-in text-xs">
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
                                setActiveModal({
                                  recordId: record.id,
                                  stageId: 'delivered',
                                  mode: isPendingReDispatch ? 'review_issue' : 'confirm_delivery'
                                });
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                            >
                              <Package size={14} className="text-emerald-400" />
                              <span>{isDelivered ? 'View Delivery Confirmation' : isPendingReDispatch ? 'Review Issue & Re-Dispatch' : 'Confirm Delivery'}</span>
                            </button>
                            <button 
                              onClick={() => {
                                setOpenMenuId(null);
                                if (!isDelivered) {
                                  toast.error('Please complete Delivery Confirmation first.');
                                  setActiveModal({
                                    recordId: record.id,
                                    stageId: 'delivered',
                                    mode: isPendingReDispatch ? 'review_issue' : 'confirm_delivery'
                                  });
                                  return;
                                }
                                handleOpenVideo(record, selectedVideoNumber);
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                            >
                              <Video size={14} className="text-purple-400" />
                              <span>Manage Video {selectedVideoNumber}</span>
                            </button>

                            {/* --- VIEW ALL STEPS ACTION --- */}
                            <div className="h-[1px] bg-slate-800 my-1" />
                            <button 
                              onClick={() => {
                                setOpenMenuId(null);
                                setViewAllModalRecord(record);
                              }}
                              className="w-full px-3.5 py-2 text-left text-purple-300 hover:bg-purple-500/15 hover:text-purple-200 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                            >
                              <Maximize2 size={14} className="text-purple-400" />
                              <span>View All Steps</span>
                            </button>

                            {/* --- UNDO LAST STEP ACTION --- */}
                            <div className="h-[1px] bg-slate-800 my-1" />
                            <button 
                              onClick={() => {
                                setOpenMenuId(null);
                                handleOpenUndoModal(record);
                              }}
                              className="w-full px-3.5 py-2 text-left text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                            >
                              <RotateCcw size={14} className="text-amber-400" />
                              <span>Undo Last Step</span>
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
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activeModal.mode === 'review_issue' || isInfluencerInReDispatch(targetRecord)
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                      : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {activeModal.mode === 'review_issue' || isInfluencerInReDispatch(targetRecord) ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Package size={18} />
                    )}
                  </div>
                  <div>
                    <h5 className="text-base sm:text-lg font-bold text-white leading-none">
                      {activeModal.mode === 'review_issue' || isInfluencerInReDispatch(targetRecord)
                        ? `Re-Dispatch Issue & Shipment History${activeModal.cycleNumber ? ` (Cycle #${activeModal.cycleNumber})` : ''}`
                        : `Delivery Confirmation${activeModal.cycleNumber ? ` (Replacement #${activeModal.cycleNumber})` : ''}`}
                    </h5>
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
                <DeliveredForm 
                  record={targetRecord} 
                  initialMode={activeModal.mode}
                  cycleNumber={activeModal.cycleNumber}
                  onSave={(data: any) => handleDeliverySave(targetRecord.id, data)} 
                />
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
          CONFIRMATION MODAL: SAFE SEQUENTIAL UNDO STEP
      ======================================================== */}
      {undoModalState && undoModalState.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#070c18]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                    Undo Last Step
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Safely revert the latest workflow event for this influencer
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (!isUndoingStep) setUndoModalState(null);
                }}
                disabled={isUndoingStep}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              {/* Influencer Info Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Influencer</div>
                  <div className="text-white font-bold text-sm mt-0.5 flex items-center gap-2">
                    <span>{undoModalState.record.influencer?.name || (undoModalState.record as any).name || undoModalState.record.dispatch?.influencer_name || 'Creator'}</span>
                    <span className="text-xs text-slate-400 font-normal">
                      {undoModalState.record.influencer?.instagram_username ? `@${undoModalState.record.influencer.instagram_username}` : ''}
                    </span>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 font-mono font-bold text-xs">
                  {undoModalState.record.influencer?.code || (undoModalState.record as any).code || undoModalState.record.dispatch?.influencer_code || `ID ${undoModalState.record.influencer_id}`}
                </div>
              </div>

              {/* Step Transition Visual */}
              <div className="space-y-2.5">
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-amber-300/90 font-medium">Undoing:</div>
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    <RotateCcw size={13} />
                    <span>{undoModalState.stepInfo.stepLabel}</span>
                  </div>
                </div>

                <div className="flex justify-center text-slate-500">
                  <ArrowLeft size={16} className="-rotate-90" />
                </div>

                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-emerald-300/90 font-medium">Workflow will return to:</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    <Check size={13} />
                    <span>{undoModalState.stepInfo.previousStateLabel}</span>
                  </div>
                </div>
              </div>

              {/* Downstream Warning if any steps will also be reset */}
              {undoModalState.stepInfo.affectedDownstreamSteps.length > 0 && (
                <div className="p-3.5 bg-rose-950/30 border border-rose-800/60 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                    <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                    <span>These later steps will also be reset:</span>
                  </div>
                  <ul className="list-disc list-inside text-rose-200/90 text-xs pl-1 space-y-0.5">
                    {undoModalState.stepInfo.affectedDownstreamSteps.map(stepName => (
                      <li key={stepName} className="font-medium">{stepName}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-slate-400 text-xs leading-relaxed">
                This operation will safely step back the workflow for this influencer and update database records.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#070c18] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setUndoModalState(null)}
                disabled={isUndoingStep}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUndoStep}
                disabled={isUndoingStep}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-600/25 active:scale-95 cursor-pointer"
              >
                {isUndoingStep ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Undoing Step...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    <span>Undo Step</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: VIEW ALL WORKFLOW STEPS EXPANDED MODAL
      ======================================================== */}
      {viewAllModalRecord && (
        <ViewAllWorkflowStepsModal
          record={viewAllModalRecord}
          selectedVideoNumber={selectedVideoNumber}
          onClose={() => setViewAllModalRecord(null)}
          onOpenDeliveryModal={(pStep) => {
            setActiveModal({
              recordId: viewAllModalRecord.id,
              stageId: 'delivered',
              mode: pStep.modalMode,
              cycleNumber: pStep.cycleNumber
            });
            setViewAllModalRecord(null);
          }}
          onOpenVideoModal={(cfgId) => {
            handleOpenVideo(viewAllModalRecord, selectedVideoNumber, cfgId);
            setViewAllModalRecord(null);
          }}
        />
      )}

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
          deliveryStatuses: availableFilterDeliveryStatuses,
          workflowSteps: workflowStepOptions,
          deliveryStatusCounts: {
            'Not Delivered': activeTrackingRecords.filter(r => getInfluencerDeliveryStatus(r) === 'Not Delivered').length,
            'Delivered': activeTrackingRecords.filter(r => getInfluencerDeliveryStatus(r) === 'Delivered').length,
            'Delivery Confirmed': activeTrackingRecords.filter(r => getInfluencerDeliveryStatus(r) === 'Delivery Confirmed').length,
          },
          totalCount: activeTrackingRecords.length
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
  initialStepId?: string | null;
  campaign?: Campaign;
  campaignScripts?: CampaignScript[];
  onRefreshScripts?: () => Promise<void>;
  onBack: () => void;
  onSwitchVideo: (num: number) => void;
  onSaveStep: (stepId: string, data: any, completed: boolean, isSkipped?: boolean) => Promise<{ success: boolean; error?: any } | void>;
  onStepChange?: (stepId: string) => void;
}

const VideoDetailView: React.FC<VideoDetailViewProps> = ({
  record,
  videoNumber,
  initialStepId,
  campaign,
  campaignScripts,
  onRefreshScripts,
  onBack,
  onSwitchVideo,
  onSaveStep,
  onStepChange
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

  // Determine initial selected step based on stepHint or fallback to active/current step
  const resolveInitialStep = useCallback((stepHint?: string | null): string => {
    if (stepHint && videoData.configs.some(c => c.id === stepHint)) {
      return stepHint;
    }
    if (videoData.activeStepId && videoData.configs.some(c => c.id === videoData.activeStepId)) {
      return videoData.activeStepId;
    }
    const firstIncomplete = videoData.configs.find(c => {
      const s = videoData.steps[c.id];
      return !s?.completed && !s?.skipped && s?.status !== 'SKIPPED';
    });
    if (firstIncomplete) return firstIncomplete.id;
    return videoData.configs[videoData.configs.length - 1]?.id || videoData.configs[0]?.id || 'share_script';
  }, [videoData]);

  const [selectedVideoStepId, setSelectedVideoStepId] = useState<string>(() => resolveInitialStep(initialStepId));

  const handleAdvanceToNextStep = useCallback(() => {
    const currentIndex = videoData.configs.findIndex(c => c.id === selectedVideoStepId);
    if (currentIndex >= 0 && currentIndex < videoData.configs.length - 1) {
      const nextStep = videoData.configs[currentIndex + 1];
      if (nextStep) {
        setSelectedVideoStepId(nextStep.id);
        onStepChange?.(nextStep.id);
      }
    }
  }, [videoData.configs, selectedVideoStepId, onStepChange]);

  // Derive resolved product & per-video price for this specific video from Campaign Influencer data
  const resolvedProductInfo = useMemo(() => getResolvedProductForVideo(record.influencer, videoNumber), [record.influencer, videoNumber]);
  const currentVideoPrice = useMemo(() => getInfluencerVideoPrice(record.influencer, videoNumber), [record.influencer, videoNumber]);

  // Track parent videoNumber and initialStepId to avoid resetting on record updates/saves
  const prevVideoNumRef = useRef(videoNumber);
  const prevInitialStepRef = useRef(initialStepId);

  useEffect(() => {
    if (prevVideoNumRef.current !== videoNumber || prevInitialStepRef.current !== initialStepId) {
      prevVideoNumRef.current = videoNumber;
      prevInitialStepRef.current = initialStepId;
      setSelectedVideoStepId(resolveInitialStep(initialStepId));
    }
  }, [videoNumber, initialStepId, resolveInitialStep]);

  // Fallback if current step is invalid for current video configuration
  useEffect(() => {
    if (!videoData.configs.some(c => c.id === selectedVideoStepId)) {
      setSelectedVideoStepId(resolveInitialStep(initialStepId));
    }
  }, [videoData.configs, selectedVideoStepId, initialStepId, resolveInitialStep]);

  const activeStepConfig = videoData.configs.find(c => c.id === selectedVideoStepId) || videoData.configs[0];
  const activeStepState = videoData.steps[selectedVideoStepId] || { completed: false, data: {} };

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
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      
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
            <span className="text-xs font-bold text-white uppercase tracking-wider">Video {videoNumber}</span>
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

      {/* 2. ACTIVE STEP FOCUSED WORKFLOW PANEL - Exclusively renders ONLY the selected step */}
      <div className="flex-1 min-h-0 bg-[#0b1329] border border-slate-800 border-t-2 border-t-blue-500/80 rounded-2xl p-5 overflow-y-auto shadow-md [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-sm">
              <activeStepConfig.icon size={20} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white leading-none">
                Step {videoData.configs.findIndex(c => c.id === selectedVideoStepId) + 1}: {
                  selectedVideoStepId === 'timeline' && (activeStepState.data?.is_re_upload_timeline === true || !!activeStepState.data?.re_draft_submit_date)
                    ? 'Re-Upload Timeline'
                    : activeStepConfig.label
                }
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Configure details for Video {videoNumber} • {influencerName} ({influencerCode})
              </p>
            </div>
          </div>

          {(() => {
            if (activeStepConfig?.id === 'draft') {
              const draftKind = getInfluencerDraftStatus(record, videoNumber);
              if (draftKind === 'completed') {
                return (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-emerald-950/80 text-emerald-400 border-emerald-700/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Approved
                  </span>
                );
              }
              if (draftKind === 'not_approved') {
                return (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-rose-950/80 text-rose-400 border-rose-700/60">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Re-Draft Required
                  </span>
                );
              }
              if (draftKind === 'pending_approval') {
                return (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-amber-950/80 text-amber-400 border-amber-700/60">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Draft Submitted – Pending Manager Approval
                  </span>
                );
              }
            }

            const visualState = activeStepConfig ? getStepVisualState(record, videoNumber, activeStepConfig.id) : 'not_started';
            const styles = getStepVisualStyles(visualState);

            return (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${styles.badge}`}>
                <span className={`w-2 h-2 rounded-full ${styles.badgeDot}`} />
                {styles.badgeText}
              </span>
            );
          })()}
        </div>

        {/* Step Component Form - Exclusively renders the active step */}
        <div>
          {activeStepConfig?.id === 'delivered' && (
            <DeliveredForm
              record={record}
              initialMode={isInfluencerInReDispatch(record) ? 'review_issue' : 'confirm_delivery'}
              onSave={async (formData: any) => {
                await onSaveStep('delivered', formData, isInfluencerDeliveryConfirmed(record));
                handleAdvanceToNextStep();
              }}
            />
          )}

          {activeStepConfig?.id === 'call_explain' && (
            <CallExplainForm 
              record={record} 
              existingData={activeStepState.data}
              isStepSkipped={Boolean(activeStepState.skipped || activeStepState.status === 'SKIPPED' || activeStepState.data?.call_skipped || activeStepState.data?.is_skipped)}
              onSave={(formData: any, completed?: boolean, isSkipped?: boolean) => 
                onSaveStep(
                  'call_explain', 
                  formData, 
                  completed !== undefined ? completed : formData.call_explained,
                  isSkipped !== undefined ? isSkipped : Boolean(formData.call_skipped || formData.is_skipped)
                )
              }
              onAdvanceStep={handleAdvanceToNextStep}
            />
          )}

          {activeStepConfig?.id === 'share_script' && (
            <ShareScriptForm 
              key={`v-${videoNumber}-share-script-${record.id}`}
              record={record} 
              videoNumber={videoNumber}
              campaign={campaign}
              campaignScripts={campaignScripts}
              onRefreshScripts={onRefreshScripts}
              existingData={activeStepState.data}
              onSave={(formData: any, completed?: boolean) => 
                onSaveStep(
                  'share_script', 
                  formData, 
                  completed !== undefined ? completed : formData.reference_video_received
                )
              }
              onAdvanceStep={handleAdvanceToNextStep}
            />
          )}

          {activeStepConfig?.id === 'pay_advance' && (
            <PayAdvanceForm 
              key={`v${videoNumber}-pay-advance-${record.id}`}
              videoNumber={videoNumber}
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('pay_advance', formData, formData.pay_advance_completed)} 
            />
          )}

          {activeStepConfig?.id === 'timeline' && (
            <ExpectedTimelineForm 
              record={record} 
              videoNumber={videoNumber}
              stepNumber={videoData.configs.findIndex(c => c.id === 'timeline') + 1}
              existingData={activeStepState.data}
              onSave={async (formData: any) => { await onSaveStep('timeline', formData, formData.expected_delivery_completed); }} 
            />
          )}

          {activeStepConfig?.id === 'draft' && (
            <DraftForm 
              key={`v-${videoNumber}-draft-form-${record.id}`}
              record={record} 
              videoNumber={videoNumber}
              existingData={activeStepState.data}
              onSave={async (formData: any, completed: boolean) => { await onSaveStep('draft', formData, completed); }} 
              onNavigateToPostDate={() => {
                setSelectedVideoStepId('post_date');
                onStepChange?.('post_date');
              }}
            />
          )}

          {activeStepConfig?.id === 'post_date' && (
            <VideoPostForm 
              key={`v-${videoNumber}-post-form-${record.id}`}
              videoNumber={videoNumber}
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any, completed?: boolean) => onSaveStep('post_date', formData, completed !== undefined ? completed : formData.confirmed_live)}
            />
          )}

          {activeStepConfig?.id === 'payment' && (
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
const DeliveredForm: React.FC<{
  record: StatusTrackingRecord;
  initialMode?: 'confirm_delivery' | 'review_issue';
  cycleNumber?: number;
  onSave: (data: any) => Promise<void> | void;
}> = ({ record, initialMode, cycleNumber, onSave }) => {
  const isInitiallyCompleted = isInfluencerDeliveryConfirmed(record);
  
  let metadata: any = {};
  try {
    metadata = typeof record.notes === 'string' ? JSON.parse(record.notes || '{}') : (record.notes || {});
  } catch (e) {
    metadata = {};
  }

  const rawStatus = (record.status || '').toLowerCase();
  const isPendingRedispatch = isInfluencerInReDispatch(record);
  const isMovedToActive = Boolean(
    metadata.re_dispatch_moved_to_active || 
    metadata.moved_to_active || 
    metadata.redispatch_lifecycle_status === 'MOVED_TO_ACTIVE'
  );

  // Segmented Selection: 'NO_ISSUE' | 'PRODUCT_ISSUE'
  const [selectedOption, setSelectedOption] = useState<'NO_ISSUE' | 'PRODUCT_ISSUE'>(() => {
    if (initialMode === 'confirm_delivery') return 'NO_ISSUE';
    if (initialMode === 'review_issue') return 'PRODUCT_ISSUE';
    if (isPendingRedispatch) return 'PRODUCT_ISSUE';
    if (isMovedToActive) return 'NO_ISSUE';
    return isInitiallyCompleted ? 'NO_ISSUE' : 'NO_ISSUE';
  });

  useEffect(() => {
    if (initialMode === 'confirm_delivery') {
      setSelectedOption('NO_ISSUE');
    } else if (initialMode === 'review_issue') {
      setSelectedOption('PRODUCT_ISSUE');
    }
  }, [initialMode]);

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
      const latestIssueAttempt = [...data].reverse().find(a => a.issue_reported);
      if (latestIssueAttempt) {
        if (!issueRemarks && latestIssueAttempt.issue_remarks) setIssueRemarks(latestIssueAttempt.issue_remarks);
        if (!issuePhoto && latestIssueAttempt.issue_proof_url) {
          setIssuePhoto(latestIssueAttempt.issue_proof_url);
          setIssuePreview(latestIssueAttempt.issue_proof_url);
        }
        if (latestIssueAttempt.issue_type) setIssueType(latestIssueAttempt.issue_type as ShipmentIssueType);
      }
    } catch (e) {
      console.error('Error loading shipment attempts:', e);
    } finally {
      setIsLoadingAttempts(false);
    }
  }, [record?.campaign_id, record?.influencer_id, issueRemarks, issuePhoto]);

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
                Attempt 1 (Original)
              </span>
              <span>{record.dispatch?.courier_partner || 'Courier'} &bull; Order: #{cleanCodeRef(record.dispatch?.influencer_code || record.influencer_id)}</span>
            </div>
            <div className="flex items-center gap-2">
              {record.dispatch?.dispatch_date && (
                <span className="text-slate-400 font-medium text-[11px]">
                  {formatDisplayDateLocal(record.dispatch.dispatch_date)}
                </span>
              )}
              <span className="text-slate-500 font-mono text-[11px]">
                AWB: {record.dispatch?.tracking_id || '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {attempts.map((att, idx) => {
              const isReplacement = att.shipment_type === 'RE_DISPATCH' || att.attempt_number > 1;
              const hasIssue = Boolean(att.issue_reported || att.issue_type);
              const isDelivered = Boolean(att.delivery_confirmed);

              const infCode = cleanCodeRef(record.dispatch?.influencer_code || record.influencer?.code || record.code || String(record.influencer_id));
              const courierName = att.courier || record.dispatch?.courier_partner || 'Courier';
              const isDelhivery = courierName.toLowerCase().includes('delhivery');
              
              // Ensure the attempt order ID strictly derives from this influencer's code
              let displayOrderId = att.order_id;
              const extractedCode = extractInfluencerCodeFromOrderId(displayOrderId);
              if (!displayOrderId || (extractedCode && extractedCode.toUpperCase() !== infCode.toUpperCase())) {
                displayOrderId = isDelhivery 
                  ? (att.attempt_number > 1 ? `#${'R'.repeat(att.attempt_number - 1)}${infCode}` : `#${infCode}`)
                  : (att.attempt_number > 1 ? `R${'R'.repeat(Math.max(0, att.attempt_number - 2))}${infCode}` : infCode);
              }

              const attemptDate = att.dispatch_date || (att.created_at ? att.created_at.split('T')[0] : null);

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
                        {displayOrderId}
                      </span>
                      <span className="text-slate-400">
                        {courierName}
                      </span>
                      {att.awb_number && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          &bull; AWB: {att.awb_number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {attemptDate && (
                        <span className="text-slate-400 font-medium text-[11px]">
                          {formatDisplayDateLocal(attemptDate)}
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
const CallExplainForm = ({ record, existingData = {}, onSave, isStepSkipped, onAdvanceStep }: any) => {
  const [isCallSkipped, setIsCallSkipped] = useState<boolean>(() => {
    return Boolean(isStepSkipped || existingData.call_skipped || existingData.is_skipped || existingData.status === 'SKIPPED');
  });
  const [showSkipModal, setShowSkipModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    setIsCallSkipped(Boolean(isStepSkipped || existingData.call_skipped || existingData.is_skipped || existingData.status === 'SKIPPED'));
  }, [isStepSkipped, existingData.call_skipped, existingData.is_skipped, existingData.status]);

  const [callExplained, setCallExplained] = useState(
    existingData.call_explained !== undefined ? existingData.call_explained : (record.ref_call_explanation_required || false)
  );

  useEffect(() => {
    if (existingData.call_explained !== undefined) {
      setCallExplained(existingData.call_explained);
    }
  }, [existingData.call_explained]);

  const [callNotes, setCallNotes] = useState(existingData.call_notes || '');
  const [callDatetime, setCallDatetime] = useState(
    existingData.call_datetime ? formatForDateTimeInput(existingData.call_datetime) : ''
  );
  const [phoneCalled, setPhoneCalled] = useState(
    existingData.phone_called || record.dispatch?.phone_number || ''
  );

  const handleCallSkippedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setShowSkipModal(true);
    } else {
      setIsCallSkipped(false);
      onSave({
        call_explained: false,
        call_skipped: false,
        is_skipped: false,
        call_notes: callNotes,
        call_datetime: callDatetime ? new Date(callDatetime).toISOString() : '',
        phone_called: phoneCalled
      }, false, false);
      toast.success('Call Skipped unmarked');
    }
  };

  const handleCancelSkip = () => {
    setShowSkipModal(false);
    setIsCallSkipped(false);
  };

  const handleConfirmSkip = async () => {
    setShowSkipModal(false);
    setIsSaving(true);
    try {
      setIsCallSkipped(true);
      setCallExplained(false);
      await onSave({
        call_explained: false,
        call_skipped: true,
        is_skipped: true,
        call_notes: callNotes,
        call_datetime: callDatetime ? new Date(callDatetime).toISOString() : '',
        phone_called: phoneCalled
      }, false, true);

      toast.success('Step skipped successfully');
      onAdvanceStep?.();
    } catch (err: any) {
      console.error('Error confirming skip:', err);
      toast.error('Failed to skip step: ' + (err?.message || err));
      setIsCallSkipped(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setCallExplained(true);
      setIsCallSkipped(false);
      await onSave({
        call_explained: true,
        call_skipped: false,
        is_skipped: false,
        call_notes: callNotes,
        call_datetime: callDatetime ? new Date(callDatetime).toISOString() : new Date().toISOString(),
        phone_called: phoneCalled
      }, true, false);
      toast.success('Call & Explain confirmed successfully');
      onAdvanceStep?.();
    } catch (err: any) {
      console.error('Error saving call details:', err);
      toast.error('Failed to save call details: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      {/* 1. Checkbox Action Area: Call Explained + Call Skipped in same horizontal action row */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 bg-[#0b1329] p-3.5 sm:p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <input 
            type="checkbox" 
            id="call-explained-checkbox"
            checked={callExplained}
            onChange={(e) => {
              const checked = e.target.checked;
              setCallExplained(checked);
              if (checked && isCallSkipped) {
                setIsCallSkipped(false);
              }
            }}
            className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
          />
          <label htmlFor="call-explained-checkbox" className="text-sm font-medium text-slate-200 cursor-pointer select-none">
            Call explanation completed with influencer (deliverables, guidelines & creative briefing explained).
          </label>
        </div>

        {/* Right / Beside: Call Skipped Checkbox */}
        <div className="flex items-center gap-2.5 sm:pl-4 sm:border-l sm:border-slate-800 shrink-0">
          <input 
            type="checkbox" 
            id="call-skipped-checkbox"
            checked={isCallSkipped}
            onChange={handleCallSkippedChange}
            className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500" 
          />
          <label htmlFor="call-skipped-checkbox" className="text-sm font-semibold text-amber-400 hover:text-amber-300 cursor-pointer select-none flex items-center gap-2">
            <span>Call Skipped</span>
            {isCallSkipped && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-bold tracking-wider">
                Skipped
              </span>
            )}
          </label>
        </div>
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
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>CONFIRMING...</span>
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={2.5} />
              <span>CONFIRM CALL & EXPLAIN</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Dialog: Skip Step */}
      <ConfirmModal
        isOpen={showSkipModal}
        title="Skip Step?"
        message="Are you sure you want to skip this step?"
        confirmText="Confirm"
        cancelText="Cancel"
        isDestructive={false}
        variant="warning"
        onClose={handleCancelSkip}
        onConfirm={handleConfirmSkip}
      />
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

interface ReferenceVideoData {
  file_name?: string;
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

const normalizeReferenceVideo = (raw: any): ReferenceVideoData | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      file_name: trimmed.split('/').pop() || 'reference-video.mp4',
      url: trimmed
    };
  }
  if (typeof raw === 'object' && raw.url) {
    return {
      file_name: raw.file_name || raw.fileName || raw.url.split('/').pop() || 'reference-video.mp4',
      storage_path: raw.storage_path || raw.storagePath || '',
      url: raw.url,
      uploaded_at: raw.uploaded_at || raw.uploadedAt
    };
  }
  return null;
};


interface ShareScriptFormProps {
  record: StatusTrackingRecord;
  videoNumber?: number;
  campaign?: Campaign;
  campaignScripts?: CampaignScript[];
  onRefreshScripts?: () => Promise<void>;
  existingData?: any;
  onSave: (formData: any, completed?: boolean) => Promise<any> | any;
  onAdvanceStep?: () => void;
}

const ShareScriptForm: React.FC<ShareScriptFormProps> = ({ 
  record, 
  videoNumber = 1, 
  campaign,
  campaignScripts = [],
  onRefreshScripts,
  existingData = {}, 
  onSave,
  onAdvanceStep
}) => {
  const [, setSearchParams] = useSearchParams();

  // 1. Resolve Assigned Product for this specific video
  const resolvedProductInfo = useMemo(() => getResolvedProductForVideo(record.influencer, videoNumber), [record.influencer, videoNumber]);
  const effectiveProductName = resolvedProductInfo.isAssigned 
    ? resolvedProductInfo.productName 
    : (existingData.product_name || (videoNumber === 1 ? record.ref_concept : '') || '');

  // 2. Resolve Creator & Campaign Languages
  const influencerLanguages = useMemo(() => {
    const raw = record.influencer?.languages || record.dispatch?.languages || [];
    if (Array.isArray(raw)) {
      return raw
        .filter((l: any) => typeof l === 'string' && !l.startsWith('views_data:'))
        .map((l: string) => l.trim())
        .filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw
        .split(/[,/]+/)
        .filter((l: string) => !l.startsWith('views_data:'))
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [record.influencer?.languages, record.dispatch?.languages]);

  const campaignLanguages = useMemo(() => {
    if (!campaign?.target_languages) return [];
    try {
      const p = typeof campaign.target_languages === 'string' ? JSON.parse(campaign.target_languages) : campaign.target_languages;
      return Array.isArray(p) ? p.map((l: string) => l.trim()).filter(Boolean) : [];
    } catch {
      return typeof campaign.target_languages === 'string' ? [campaign.target_languages.trim()] : [];
    }
  }, [campaign?.target_languages]);

  // Scripts cache from parent or fetched fallback
  const [scripts, setScripts] = useState<CampaignScript[]>(campaignScripts || []);
  const [isLoadingScripts, setIsLoadingScripts] = useState(false);

  useEffect(() => {
    if (campaignScripts && campaignScripts.length > 0) {
      setScripts(campaignScripts);
    }
  }, [campaignScripts]);

  useEffect(() => {
    const campId = campaign?.id || record.campaign_id;
    if ((!campaignScripts || campaignScripts.length === 0) && campId) {
      let isMounted = true;
      setIsLoadingScripts(true);
      fetchCampaignScripts(campId)
        .then(res => {
          if (isMounted) setScripts(res);
        })
        .catch(err => console.error('Error fetching campaign scripts in ShareScriptForm:', err))
        .finally(() => {
          if (isMounted) setIsLoadingScripts(false);
        });
      return () => { isMounted = false; };
    }
  }, [campaign?.id, record.campaign_id, campaignScripts]);

  // Unified available languages pool
  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    influencerLanguages.forEach(l => set.add(l));
    campaignLanguages.forEach(l => set.add(l));
    scripts.forEach(s => {
      if (s.language) set.add(s.language.trim());
    });
    return Array.from(set).sort();
  }, [influencerLanguages, campaignLanguages, scripts]);

  // 3. Selected Language for this video / influencer
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    if (existingData.language) return existingData.language;
    if (influencerLanguages.length > 0) return influencerLanguages[0];
    if (campaignLanguages.length > 0) return campaignLanguages[0];
    return availableLanguages[0] || '';
  });

  // Keep selectedLanguage initialized if newly discovered
  useEffect(() => {
    if (!selectedLanguage) {
      if (existingData.language) {
        setSelectedLanguage(existingData.language);
      } else if (influencerLanguages.length > 0) {
        setSelectedLanguage(influencerLanguages[0]);
      } else if (availableLanguages.length > 0) {
        setSelectedLanguage(availableLanguages[0]);
      }
    }
  }, [selectedLanguage, existingData.language, influencerLanguages, availableLanguages]);

  // 4. Strict Matching Logic: BOTH Product Name AND Language must match
  const matchedScript = useMemo(() => {
    if (!effectiveProductName || !selectedLanguage) return null;
    const normProd = normalizeScriptMatch(effectiveProductName);
    const normLang = normalizeScriptMatch(selectedLanguage);
    if (!normProd || !normLang) return null;

    return scripts.find(s => 
      normalizeScriptMatch(s.product) === normProd &&
      normalizeScriptMatch(s.language) === normLang
    ) || null;
  }, [scripts, effectiveProductName, selectedLanguage]);

  // Form input states
  const [scriptShared, setScriptShared] = useState<boolean>(
    existingData.script_shared !== undefined 
      ? Boolean(existingData.script_shared) 
      : (videoNumber === 1 ? (!!record.reference_video_received || !!record.ref_script) : false)
  );

  const [hooks, setHooks] = useState<string>(
    existingData.hooks || existingData.key_points || existingData.keypoints || (videoNumber === 1 ? (record.ref_hooks || '') : '') || ''
  );
  const [script, setScript] = useState<string>(
    existingData.script || existingData.model_script || (videoNumber === 1 ? (record.ref_script || '') : '') || ''
  );
  const [voiceRecord, setVoiceRecord] = useState<VoiceRecordData | null>(normalizeVoiceRecord(existingData.voice_record));
  const [referenceVideo, setReferenceVideo] = useState<ReferenceVideoData | null>(
    normalizeReferenceVideo(existingData.reference_video || existingData.reference_video_url)
  );

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Script version tracking metadata
  const [sourceScriptMeta, setSourceScriptMeta] = useState<{
    id: string | null;
    updatedAt: string | null;
    loadedAt: string | null;
  }>({
    id: existingData.sourceScriptId || existingData.script_id || null,
    updatedAt: existingData.sourceScriptUpdatedAt || null,
    loadedAt: existingData.loadedAt || null,
  });

  // Check if remote script in Script Management has an update newer than what was loaded
  const isNewerScriptAvailable = useMemo(() => {
    if (!matchedScript || !sourceScriptMeta.updatedAt) return false;
    const remoteTime = new Date(matchedScript.updated_at || matchedScript.created_at).getTime();
    const localTime = new Date(sourceScriptMeta.updatedAt).getTime();
    return remoteTime > localTime;
  }, [matchedScript, sourceScriptMeta.updatedAt]);

  // Helper to apply script fields into form
  const applyScriptData = useCallback((s: CampaignScript, showToast = true) => {
    setScript(s.model_script || '');
    setHooks(s.key_points || '');
    const sUpdated = s.updated_at || s.created_at || new Date().toISOString();
    setSourceScriptMeta({
      id: s.id,
      updatedAt: sUpdated,
      loadedAt: new Date().toISOString(),
    });

    // Reference Audio
    const audioUrl = s.reference_audio_file_path
      ? getScriptAudioUrl(s.reference_audio_file_path)
      : (s.reference_audio_url || '');

    if (audioUrl) {
      setVoiceRecord({
        file_name: s.reference_audio_file_path 
          ? s.reference_audio_file_path.split('/').pop() || `${s.product} (${s.language}) Audio` 
          : `${s.product} (${s.language}) Audio`,
        storage_path: s.reference_audio_file_path || '',
        url: audioUrl,
        uploaded_at: s.updated_at || s.created_at || new Date().toISOString()
      });
    } else {
      setVoiceRecord(null);
    }

    // Reference Video
    const videoUrl = s.reference_video_file_path
      ? getScriptVideoUrl(s.reference_video_file_path)
      : (s.reference_video_url || '');

    if (videoUrl) {
      setReferenceVideo({
        file_name: s.reference_video_file_path 
          ? s.reference_video_file_path.split('/').pop() || `${s.product} (${s.language}) Video` 
          : `${s.product} (${s.language}) Video`,
        storage_path: s.reference_video_file_path || '',
        url: videoUrl,
        uploaded_at: s.updated_at || s.created_at || new Date().toISOString()
      });
    } else {
      setReferenceVideo(null);
    }

    if (showToast) {
      toast.success('Script loaded from Script Management');
    }
  }, []);

  // 5. Automatic Loading: If fields are empty on initial mount, automatically load matching script
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    const hasInitialData = Boolean(
      (existingData.script && existingData.script.trim().length > 0) ||
      (existingData.hooks && existingData.hooks.trim().length > 0) ||
      (existingData.key_points && existingData.key_points.trim().length > 0) ||
      (existingData.keypoints && existingData.keypoints.trim().length > 0) ||
      existingData.voice_record ||
      existingData.reference_video ||
      existingData.reference_video_url
    );

    if (hasInitialData) {
      autoLoadedRef.current = true;
      return;
    }

    if (matchedScript) {
      applyScriptData(matchedScript, false);
      autoLoadedRef.current = true;
    }
  }, [matchedScript, existingData, applyScriptData]);

  // Check if form currently has user-entered content before overwriting
  const hasUserEnteredContent = useCallback(() => {
    return Boolean(
      (script && script.trim().length > 0) ||
      (hooks && hooks.trim().length > 0) ||
      voiceRecord ||
      referenceVideo
    );
  }, [script, hooks, voiceRecord, referenceVideo]);

  // Manual [Load from Script] handler
  const handleLoadFromScript = () => {
    if (!effectiveProductName || !selectedLanguage) {
      toast.error('Both Product Name and Language must be assigned to load script');
      return;
    }

    if (!matchedScript) {
      toast.error(`No matching script found for ${effectiveProductName} - ${selectedLanguage}`);
      return;
    }

    if (hasUserEnteredContent()) {
      setIsConfirmModalOpen(true);
    } else {
      applyScriptData(matchedScript, true);
    }
  };

  // Navigate to Script Management section
  const handleNavigateToScriptManagement = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('subview', 'script');
      return next;
    });
  };

  // Audio upload handler for custom voice recording
  const handleAudioFileSelect = async (file: File) => {
    if (!file) return;

    const validExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExts.includes(fileExt) && !file.type.startsWith('audio/')) {
      toast.error(`Please select a valid audio file (${validExts.join(', ').toUpperCase()})`);
      return;
    }

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

      if (voiceRecord?.storage_path && voiceRecord.storage_path !== filePath) {
        supabaseAdmin.storage
          .from('influencer-profiles')
          .remove([voiceRecord.storage_path])
          .catch(e => console.warn('Previous voice record delete error:', e));
      }

      await onSave({
        reference_video_received: scriptShared,
        script_shared: scriptShared,
        concept: effectiveProductName || '',
        product_name: effectiveProductName || '',
        language: selectedLanguage || '',
        script_id: matchedScript?.id || existingData.script_id || null,
        hooks: hooks || '',
        key_points: hooks || '',
        keypoints: hooks || '',
        script: script || '',
        voice_record: newVoiceRecord,
        reference_video: referenceVideo || null,
        link: existingData.link || '',
        reference_videos_list: existingData.reference_videos_list || []
      }, scriptShared);

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
      await onSave({
        reference_video_received: scriptShared,
        script_shared: scriptShared,
        concept: effectiveProductName || '',
        product_name: effectiveProductName || '',
        language: selectedLanguage || '',
        script_id: matchedScript?.id || existingData.script_id || null,
        hooks: hooks || '',
        key_points: hooks || '',
        keypoints: hooks || '',
        script: script || '',
        voice_record: null,
        reference_video: referenceVideo || null,
        link: existingData.link || '',
        reference_videos_list: existingData.reference_videos_list || []
      }, scriptShared);
      toast.success('Voice recording removed');
    } catch (err: any) {
      console.error('Error removing voice record:', err);
    }
  };

  const handleRemoveReferenceVideo = async () => {
    setReferenceVideo(null);
    try {
      await onSave({
        reference_video_received: scriptShared,
        script_shared: scriptShared,
        concept: effectiveProductName || '',
        product_name: effectiveProductName || '',
        language: selectedLanguage || '',
        script_id: matchedScript?.id || existingData.script_id || null,
        hooks: hooks || '',
        key_points: hooks || '',
        keypoints: hooks || '',
        script: script || '',
        voice_record: voiceRecord || null,
        reference_video: null,
        link: existingData.link || '',
        reference_videos_list: existingData.reference_videos_list || []
      }, scriptShared);
      toast.success('Reference video removed');
    } catch (err: any) {
      console.error('Error removing reference video:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isConfirmed = Boolean(scriptShared);
      await onSave({ 
        reference_video_received: isConfirmed,
        script_shared: isConfirmed,
        concept: effectiveProductName || '', 
        product_name: effectiveProductName || '',
        language: selectedLanguage || '',
        script_id: sourceScriptMeta.id || matchedScript?.id || existingData.script_id || null,
        sourceScriptId: sourceScriptMeta.id || matchedScript?.id || existingData.sourceScriptId || null,
        sourceScriptUpdatedAt: sourceScriptMeta.updatedAt || matchedScript?.updated_at || matchedScript?.created_at || existingData.sourceScriptUpdatedAt || null,
        loadedAt: sourceScriptMeta.loadedAt || existingData.loadedAt || new Date().toISOString(),
        hooks: hooks || '',
        key_points: hooks || '',
        keypoints: hooks || '', 
        script: script || '', 
        voice_record: voiceRecord || null,
        reference_video: referenceVideo || null,
        link: existingData.link || '', 
        reference_videos_list: existingData.reference_videos_list || []
      }, isConfirmed);

      if (isConfirmed) {
        toast.success('Share Script confirmed successfully');
        onAdvanceStep?.();
      } else {
        toast.success('Script details saved (pending approval checkbox)');
      }
    } catch (err: any) {
      console.error('Error saving script details:', err);
      toast.error('Failed to save script details: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-5 sm:p-6 space-y-6 animate-fade-in">
      
      {/* 1. Checkbox: Script & Reference Materials Shared */}
      <div className="flex items-center gap-3 bg-[#0b1329] p-3.5 sm:p-4 rounded-xl border border-slate-800/90 shadow-sm">
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

      {/* 2. TOP ROW: PRODUCT & LANGUAGE + [Load from Script] */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* ROW 1 - COL 1: Product / Campaign Concept */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            PRODUCT / CAMPAIGN CONCEPT
          </label>
          <div className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 flex items-center justify-between gap-3 h-[88px] sm:h-[92px] shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0">
                <Package size={20} className={effectiveProductName ? 'text-purple-400' : 'text-slate-500'} />
              </div>
              <div className="min-w-0">
                <span className={`text-sm sm:text-base font-bold truncate block ${
                  effectiveProductName ? 'text-white' : 'text-slate-500 italic'
                }`}>
                  {effectiveProductName || 'Product not assigned'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Assigned Campaign Product (Video {videoNumber})
                </span>
              </div>
            </div>
            <span className="text-[11px] text-purple-300 font-medium flex items-center gap-1.5 bg-purple-950/70 px-3 py-1.5 rounded-lg border border-purple-800/50 shrink-0 select-none shadow-sm">
              <Lock size={12} /> Auto-filled
            </span>
          </div>
        </div>

        {/* ROW 1 - COL 2: Language + Load from Script */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              LANGUAGE & SCRIPT SOURCE
            </label>
            {matchedScript ? (
              <div className="flex items-center gap-1.5">
                {isNewerScriptAvailable && (
                  <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold animate-pulse">
                    <Sparkles size={10} /> New Script Available
                  </span>
                )}
                <span className="text-[11px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/50 px-2.5 py-0.5 rounded-md flex items-center gap-1 font-mono">
                  <CheckCircle2 size={12} /> Script ID: {matchedScript.id ? String(matchedScript.id).slice(0, 8) : 'sc_matched'}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-amber-400/90 bg-amber-950/50 border border-amber-800/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                <AlertTriangle size={11} /> Unlinked
              </span>
            )}
          </div>

          <div className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 flex items-center justify-between gap-3 h-[88px] sm:h-[92px] shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0">
                <Globe size={20} />
              </div>
              <div className="min-w-0">
                {availableLanguages.length > 1 ? (
                  <div className="relative">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-[#070c18] text-white text-xs sm:text-sm font-bold border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer max-w-[160px] truncate"
                    >
                      {availableLanguages.map(lang => (
                        <option key={lang} value={lang} className="bg-slate-900 text-white">
                          {lang}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Assigned Creator Language
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm sm:text-base font-bold text-white truncate block">
                      {selectedLanguage || 'Language not set'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Assigned Creator Language
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Load from Script Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLoadFromScript}
                disabled={isLoadingScripts || !effectiveProductName || !selectedLanguage}
                title={
                  isNewerScriptAvailable
                    ? 'A newer version of this script is available in Script Management! Click to load updated script.'
                    : 'Load matching model script, key points, audio and video from Script Management'
                }
                className={`px-3.5 py-2 rounded-xl disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                  isNewerScriptAvailable
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 ring-1 ring-amber-400/50'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                }`}
              >
                {isLoadingScripts ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isNewerScriptAvailable ? (
                  <Sparkles size={14} className="text-amber-200" />
                ) : (
                  <FileText size={14} />
                )}
                <span>{isNewerScriptAvailable ? 'Load Updated Script' : 'Load from Script'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 3. MISSING MATCH WARNING BANNER */}
      {!matchedScript && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5 text-amber-300">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span>
              {!effectiveProductName || !selectedLanguage ? (
                <>Product Name or Language is not assigned for Video {videoNumber}. Assign them in Campaign Influencer to link a script.</>
              ) : (
                <>
                  No matching script found for <strong className="text-white font-semibold">{effectiveProductName}</strong> — <strong className="text-white font-semibold">{selectedLanguage}</strong>
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={handleNavigateToScriptManagement}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <FilePlus size={13} />
            <span>Create Script</span>
          </button>
        </div>
      )}

      {/* 4. ROW 2: MODEL SCRIPT & KEY POINTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* MODEL SCRIPT */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              MODEL SCRIPT
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              {script.length}/2000
            </span>
          </div>
          <div className="relative">
            <textarea 
              rows={6}
              value={script} 
              onChange={e => setScript(e.target.value)} 
              placeholder="Enter the proposed video talking points, hook, body, and call-to-action..."
              className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 pb-7 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none min-h-[160px] sm:min-h-[170px]" 
            />
          </div>
        </div>

        {/* KEY POINTS */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              KEY POINTS
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              {hooks.length}/1000
            </span>
          </div>
          <div className="relative">
            <textarea 
              rows={6}
              value={hooks} 
              onChange={e => setHooks(e.target.value)} 
              placeholder="Enter the video hook, key features to highlight, opening line..."
              className="w-full bg-[#0b1329] border border-slate-800/90 rounded-xl px-4 py-3 pb-7 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none min-h-[160px] sm:min-h-[170px]" 
            />
          </div>
        </div>

      </div>

      {/* 5. ROW 3: REFERENCE AUDIO & REFERENCE VIDEO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* REFERENCE AUDIO */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              REFERENCE AUDIO
            </label>
            <span className="text-xs text-slate-500 font-medium">Optional</span>
          </div>

          {voiceRecord?.url ? (
            /* Uploaded Audio Card with Audio Player */
            <div className="bg-[#0b1329] border border-purple-900/50 rounded-xl px-4 py-3 min-h-[120px] flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/70 flex items-center justify-center text-purple-400 shrink-0">
                    <Volume2 size={16} />
                  </div>
                  <div className="truncate min-w-0">
                    <p className="text-xs font-bold text-white truncate" title={voiceRecord.file_name}>
                      {voiceRecord.file_name}
                    </p>
                    <p className="text-[10px] text-purple-300 font-mono">
                      {voiceRecord.file_size_formatted || 'Reference Audio'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a 
                    href={voiceRecord.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80 shrink-0" 
                    title="Open Audio in New Tab"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <label className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold cursor-pointer transition-colors border border-slate-700/80 flex items-center gap-1 shrink-0">
                    <UploadCloud size={11} />
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
                    <Trash2 size={11} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* HTML5 Audio Player */}
              <div className="w-full pt-1">
                <audio 
                  controls 
                  src={voiceRecord.url} 
                  className="h-8 w-full rounded accent-purple-500" 
                  preload="metadata" 
                />
              </div>
            </div>
          ) : (
            /* Empty State: Audio Upload Dropzone */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleAudioFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl px-4 py-3 min-h-[120px] transition-all cursor-pointer flex flex-col justify-center items-center gap-1.5 select-none text-center ${
                isDragOver 
                  ? 'border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/20' 
                  : 'border-slate-800 bg-[#0b1329]/80 hover:border-purple-600/70 hover:bg-[#0b1329]'
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
                <div className="flex flex-col items-center justify-center gap-2 py-2">
                  <Loader2 size={24} className="text-purple-400 animate-spin" />
                  <span className="text-xs font-bold text-purple-300">Uploading voice recording...</span>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0">
                    <Mic size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300">
                      No Reference Audio Attached
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Drag & drop or click to upload custom voice recording (Max 50MB)
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* REFERENCE VIDEO */}
        <div className="space-y-1.5 flex flex-col justify-start">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              REFERENCE VIDEO
            </label>
            <span className="text-xs text-slate-500 font-medium">Optional</span>
          </div>

          {referenceVideo?.url ? (
            /* Uploaded/Loaded Video Preview Card */
            <div className="bg-[#0b1329] border border-purple-900/50 rounded-xl p-3 min-h-[120px] flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/70 flex items-center justify-center text-purple-400 shrink-0">
                    <Video size={16} />
                  </div>
                  <div className="truncate min-w-0">
                    <p className="text-xs font-bold text-white truncate" title={referenceVideo.file_name}>
                      {referenceVideo.file_name}
                    </p>
                    <p className="text-[10px] text-purple-300 font-mono">
                      Script Reference Video
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a 
                    href={referenceVideo.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80 shrink-0" 
                    title="Open Video in New Tab"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <button 
                    type="button" 
                    onClick={handleRemoveReferenceVideo} 
                    className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[10px] font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Remove reference video"
                  >
                    <Trash2 size={11} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* Playable Video Player */}
              <div className="w-full flex justify-center bg-black/60 rounded-lg overflow-hidden border border-slate-800">
                <video 
                  controls 
                  preload="metadata" 
                  src={referenceVideo.url} 
                  className="w-full max-h-[140px] rounded-lg object-contain bg-black" 
                />
              </div>
            </div>
          ) : (
            /* Clean Empty State for Video */
            <div className="border border-dashed border-slate-800 rounded-xl px-4 py-3 min-h-[120px] bg-[#0b1329]/80 flex flex-col justify-center items-center gap-1.5 text-center select-none">
              <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 shrink-0">
                <Video size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">
                  No Reference Video Uploaded
                </p>
                <p className="text-[11px] text-slate-500">
                  Upload a reference video in Script Management to preview it here
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 6. SAVE ACTION BUTTON */}
      <div className="flex justify-end pt-3 border-t border-slate-800/90">
        <button 
          type="button"
          onClick={handleSave} 
          disabled={isSaving || isUploadingVoice}
          className={`text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer ${
            scriptShared 
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' 
              : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{scriptShared ? 'Confirming...' : 'Saving...'}</span>
            </>
          ) : scriptShared ? (
            <>
              <Check size={16} strokeWidth={2.5} />
              <span>CONFIRM SHARE SCRIPT</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>SAVE SCRIPT DETAILS</span>
            </>
          )}
        </button>
      </div>

      {/* CONFIRMATION MODAL: OVERWRITE SCRIPT DETAILS */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title="Replace Current Script Details?"
        message="Load the script from Script Management? This will replace the current script details."
        confirmText="Load Script"
        cancelText="Cancel"
        isDestructive={false}
        variant="warning"
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => {
          if (matchedScript) {
            applyScriptData(matchedScript, true);
          }
          setIsConfirmModalOpen(false);
        }}
      />

    </div>
  );
};

// --- STEP: Pay Advance (Videos 1 to 6) ---
interface PayAdvanceFormProps {
  record: StatusTrackingRecord;
  existingData?: any;
  onSave: (data: any, completed?: boolean) => Promise<any> | void;
  videoNumber?: number;
}

const PayAdvanceForm: React.FC<PayAdvanceFormProps> = ({ 
  record, 
  existingData = {}, 
  onSave, 
  videoNumber = 1 
}) => {
  const influencer = record.influencer || {};
  const dispatch = record.dispatch || {};
  const livePaymentSource = { ...(record.dispatch || {}), ...(record.influencer || {}) };
  const resolvedPayment = resolveInfluencerPaymentDetails(livePaymentSource);

  const isAccount = resolvedPayment.payment_method === 'ACCOUNT_DETAILS';
  const isUPI = resolvedPayment.payment_method === 'UPI';
  const isHistorical = Boolean(existingData.pay_advance_completed || record.pay_advance_completed);

  const vPrice = useMemo(() => getInfluencerVideoPrice(influencer, videoNumber), [influencer, videoNumber]);
  const totalCampaignPrice = useMemo(() => getInfluencerCampaignTotalPrice(influencer, record.pricing), [influencer, record.pricing]);

  const defaultTotal = isHistorical 
    ? (existingData.total || (videoNumber === 1 ? record.advance_total_amount : '') || (vPrice !== null ? String(vPrice) : ''))
    : (vPrice !== null ? String(vPrice) : (existingData.total || (videoNumber === 1 ? record.advance_total_amount : '') || ''));

  const [gpay, setGpay] = useState(
    isUPI 
      ? (resolvedPayment.upi_number || existingData.gpay || (videoNumber === 1 ? record.advance_gpay_number : '') || '')
      : ''
  );
  const [total, setTotal] = useState(defaultTotal);
  const [advance, setAdvance] = useState(existingData.advance || (videoNumber === 1 ? record.advance_paid_amount : '') || '');

  // Keep total in sync if not historical and vPrice changes in Campaign Influencer
  useEffect(() => {
    if (!isHistorical && vPrice !== null) {
      setTotal(String(vPrice));
    }
  }, [vPrice, isHistorical]);

  // Keep gpay in sync if payment details change
  useEffect(() => {
    if (isUPI) {
      setGpay(prev => prev || resolvedPayment.upi_number || '');
    } else {
      setGpay('');
    }
  }, [isUPI, resolvedPayment.upi_number]);

  // Unified Payment Proof state (supporting both Image and PDF)
  const initialProof = useMemo(() => {
    return normalizePaymentProof(existingData.paymentProof || existingData.photo || (videoNumber === 1 ? record.pay_advance_photo_url : ''));
  }, [existingData.paymentProof, existingData.photo, videoNumber, record.pay_advance_photo_url]);

  const [paymentProof, setPaymentProof] = useState<PaymentProofData | null>(initialProof);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // File input refs for uploading and replacing
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Modal states for confirmation
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Sync state if initial data changes (e.g. video switch)
  useEffect(() => {
    setPaymentProof(initialProof);
  }, [initialProof]);

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

  const paymentInfoForCard: PaymentDetailsInfo = {
    payment_method: resolvedPayment.payment_method,
    upi_number: isUPI ? (gpay || resolvedPayment.upi_number || null) : null,
    account_holder_name: isAccount ? (resolvedPayment.account_holder_name || null) : null,
    account_number: isAccount ? (resolvedPayment.account_number || null) : null,
    ifsc_code: isAccount ? (resolvedPayment.ifsc_code || null) : null,
    bank_name: isAccount ? (resolvedPayment.bank_name || null) : null,
    pan_number: isAccount ? (resolvedPayment.pan_number || null) : null
  };

  // Supported format checker
  const validateFileType = (file: File): boolean => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext);
    const isAllowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime);
    return isAllowedExt || isAllowedMime;
  };

  // Triggered when a file is selected (via click or drop)
  const handleFileSelection = (selectedFile: File) => {
    if (!selectedFile) return;

    if (!validateFileType(selectedFile)) {
      toast.error('Unsupported file format. Please upload JPG, JPEG, PNG, WEBP, or PDF.');
      return;
    }

    if (paymentProof) {
      // Ask confirmation to replace existing proof
      setPendingFile(selectedFile);
      setIsReplaceModalOpen(true);
    } else {
      // Direct upload
      executeUpload(selectedFile, false);
    }
  };

  // Perform upload to Supabase storage and persist reference immediately
  const executeUpload = async (fileToUpload: File, isReplacing: boolean = false) => {
    setIsUploadingProof(true);
    const toastId = toast.loading(`Uploading payment proof: ${fileToUpload.name}...`);
    try {
      const campId = record.campaign_id || 'camp';
      const infId = record.influencer_id || 'inf';
      const fileExt = (fileToUpload.name.split('.').pop() || 'jpg').toLowerCase();
      const uniqueKey = Math.random().toString(36).substring(2, 9);
      const filePath = `payment-proofs/camp_${campId}_inf_${infId}_v${videoNumber}_${Date.now()}_${uniqueKey}.${fileExt}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('influencer-profiles')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileToUpload.type || (fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg')
        });

      if (uploadErr) {
        console.error('Storage upload error:', uploadErr);
        throw new Error('Unable to upload this file. Please try again.');
      }

      const { data: publicData } = supabaseAdmin.storage
        .from('influencer-profiles')
        .getPublicUrl(filePath);

      const finalUrl = publicData.publicUrl;
      const isPdf = fileExt === 'pdf' || fileToUpload.type === 'application/pdf';

      const newProof: PaymentProofData = {
        url: finalUrl,
        storage_path: filePath,
        fileName: fileToUpload.name,
        mimeType: fileToUpload.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        fileSize: fileToUpload.size,
        fileSizeFormatted: formatFileSize(fileToUpload.size),
        uploadedAt: new Date().toISOString()
      };

      // Remove the old file if replacing
      if (isReplacing && paymentProof) {
        const oldPath = paymentProof.storage_path || getStoragePathFromUrl(paymentProof.url);
        if (oldPath && oldPath !== filePath) {
          supabaseAdmin.storage
            .from('influencer-profiles')
            .remove([oldPath])
            .catch(e => console.warn('Could not remove previous proof file:', e));
        }
      }

      setPaymentProof(newProof);

      // Save immediately to database without marking Pay Advance as completed
      const isCompleted = Boolean(isHistorical || existingData.pay_advance_completed);
      await onSave({
        gpay: isUPI ? gpay : '',
        total,
        advance,
        photo: newProof.url,
        paymentProof: newProof,
        payment_method: resolvedPayment.payment_method,
        upi_number: isUPI ? (gpay || resolvedPayment.upi_number || null) : null,
        account_holder_name: isAccount ? (resolvedPayment.account_holder_name || null) : null,
        account_number: isAccount ? (resolvedPayment.account_number || null) : null,
        ifsc_code: isAccount ? (resolvedPayment.ifsc_code || null) : null,
        bank_name: isAccount ? (resolvedPayment.bank_name || null) : null,
        pan_number: isAccount ? (resolvedPayment.pan_number || null) : null,
        pay_advance_completed: isCompleted,
        suppressDefaultToast: true
      });

      toast.success(isReplacing ? 'Payment proof replaced successfully' : 'Payment proof uploaded successfully', { id: toastId });
    } catch (err: any) {
      console.error('Error uploading payment proof:', err);
      toast.error(err?.message || 'Unable to upload this file. Please try again.', { id: toastId });
    } finally {
      setIsUploadingProof(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  // Confirm Replace modal action
  const handleConfirmReplace = async () => {
    if (!pendingFile) return;
    const fileToUpload = pendingFile;
    setIsReplaceModalOpen(false);
    setPendingFile(null);
    await executeUpload(fileToUpload, true);
  };

  // Confirm Delete modal action
  const handleConfirmDelete = async () => {
    if (!paymentProof) return;
    setIsDeleteModalOpen(false);
    setIsUploadingProof(true);
    const toastId = toast.loading('Deleting payment proof...');
    try {
      const oldPath = paymentProof.storage_path || getStoragePathFromUrl(paymentProof.url);
      if (oldPath) {
        await supabaseAdmin.storage
          .from('influencer-profiles')
          .remove([oldPath])
          .catch(e => console.warn('Error deleting payment proof from storage:', e));
      }

      setPaymentProof(null);

      const isCompleted = Boolean(isHistorical || existingData.pay_advance_completed);
      await onSave({
        gpay: isUPI ? gpay : '',
        total,
        advance,
        photo: '',
        paymentProof: null,
        payment_method: resolvedPayment.payment_method,
        upi_number: isUPI ? (gpay || resolvedPayment.upi_number || null) : null,
        account_holder_name: isAccount ? (resolvedPayment.account_holder_name || null) : null,
        account_number: isAccount ? (resolvedPayment.account_number || null) : null,
        ifsc_code: isAccount ? (resolvedPayment.ifsc_code || null) : null,
        bank_name: isAccount ? (resolvedPayment.bank_name || null) : null,
        pan_number: isAccount ? (resolvedPayment.pan_number || null) : null,
        pay_advance_completed: isCompleted,
        suppressDefaultToast: true
      });

      toast.success('Payment proof deleted successfully', { id: toastId });
    } catch (err: any) {
      console.error('Error deleting payment proof:', err);
      toast.error('Failed to delete payment proof. Please try again.', { id: toastId });
    } finally {
      setIsUploadingProof(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Main Confirm Pay Advance button
  const handleSave = async () => {
    if (!total || !advance) {
      toast.error(`Please enter both Video ${videoNumber} Agreed Amount and Advance Amount.`);
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ 
        gpay: isUPI ? gpay : '', 
        total, 
        advance, 
        photo: paymentProof?.url || '',
        paymentProof: paymentProof || null,
        payment_method: resolvedPayment.payment_method,
        upi_number: isUPI ? (gpay || resolvedPayment.upi_number || null) : null,
        account_holder_name: isAccount ? (resolvedPayment.account_holder_name || null) : null,
        account_number: isAccount ? (resolvedPayment.account_number || null) : null,
        ifsc_code: isAccount ? (resolvedPayment.ifsc_code || null) : null,
        bank_name: isAccount ? (resolvedPayment.bank_name || null) : null,
        pan_number: isAccount ? (resolvedPayment.pan_number || null) : null,
        pay_advance_completed: true
      });
      await loadTransactions();
      toast.success('Pay Advance confirmed successfully');
    } catch (err: any) {
      console.error('Error confirming pay advance:', err);
      toast.error('Failed to confirm pay advance: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const isPdf = Boolean(paymentProof && (paymentProof.mimeType === 'application/pdf' || paymentProof.url.toLowerCase().includes('.pdf')));

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
      {/* Compact Payment Details Card */}
      <StatusTrackingPaymentCard 
        paymentInfo={paymentInfoForCard} 
        isHistorical={isHistorical}
        videoNumber={videoNumber}
        perVideoAmount={vPrice}
        totalCampaignAmount={totalCampaignPrice}
        paymentStatus={existingData.payment_status || (isHistorical ? 'paid' : 'pending')}
        transactions={transactions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Payment Inputs */}
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
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">
              Video {videoNumber} Agreed Amount (₹)
            </label>
            <input 
              type="text" 
              value={total} 
              onChange={e => setTotal(e.target.value)} 
              placeholder={vPrice !== null ? String(vPrice) : "Not assigned"}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">
              Advance Paid Amount (₹)
            </label>
            <input 
              type="text" 
              value={advance} 
              onChange={e => setAdvance(e.target.value)} 
              placeholder="e.g. 2000"
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
            />
          </div>

          {/* Remaining Balance Indicator */}
          {(() => {
            const numTotal = parseFloat(total);
            const numAdv = parseFloat(advance);
            if (!isNaN(numTotal) && !isNaN(numAdv) && numTotal > 0 && numAdv > 0) {
              const remaining = Math.max(0, numTotal - numAdv);
              return (
                <div className="bg-[#0b1329]/60 border border-slate-800/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Remaining Balance for Video {videoNumber}:</span>
                  <span className="font-mono font-bold text-amber-400">₹{remaining.toLocaleString('en-IN')}</span>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Right Column: Payment Proof (Always Visible) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              Payment Proof
            </label>
            {paymentProof && (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Check size={10} strokeWidth={3} /> Attached
              </span>
            )}
          </div>

          {paymentProof ? (
            /* Populated State: Image or PDF Card */
            isPdf ? (
              /* PDF File Card */
              <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center gap-4 bg-[#070c18] border border-slate-800/80 rounded-xl p-4">
                  <div className="w-14 h-14 rounded-xl bg-rose-950/60 border border-rose-800/60 flex flex-col items-center justify-center text-rose-400 shadow-md flex-shrink-0">
                    <FileText size={24} strokeWidth={2} />
                    <span className="text-[10px] font-black tracking-wider uppercase mt-0.5">PDF</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate" title={paymentProof.fileName}>
                      {paymentProof.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/50 text-[10px] font-bold">
                        PDF Document
                      </span>
                      {paymentProof.fileSizeFormatted && (
                        <>
                          <span>•</span>
                          <span>{paymentProof.fileSizeFormatted}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => window.open(paymentProof.url, '_blank', 'noopener,noreferrer')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>View / Open</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => replaceFileInputRef.current?.click()}
                    disabled={isUploadingProof}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Replace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    disabled={isUploadingProof}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 text-xs font-semibold border border-rose-800/40 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Image Preview Card */
              <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
                <div 
                  onClick={() => window.open(paymentProof.url, '_blank', 'noopener,noreferrer')}
                  className="relative w-full h-48 bg-[#070c18] rounded-lg border border-slate-800/80 flex items-center justify-center overflow-hidden group cursor-pointer"
                  title="Click to view full image"
                >
                  <img 
                    src={paymentProof.url} 
                    alt={paymentProof.fileName} 
                    className="max-w-full max-h-full object-contain transition-transform group-hover:scale-[1.02]" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-xs font-medium border border-slate-700 flex items-center gap-1.5 shadow-lg">
                      <Eye size={13} /> Click to View
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200 truncate" title={paymentProof.fileName}>
                      {paymentProof.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="text-blue-400 font-semibold uppercase">{paymentProof.fileName.split('.').pop() || 'IMAGE'}</span>
                      {paymentProof.fileSizeFormatted && (
                        <>
                          <span>•</span>
                          <span>{paymentProof.fileSizeFormatted}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => window.open(paymentProof.url, '_blank', 'noopener,noreferrer')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 flex items-center gap-1 transition-colors cursor-pointer"
                      title="View in new tab"
                    >
                      <ExternalLink size={12} />
                      <span>View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => replaceFileInputRef.current?.click()}
                      disabled={isUploadingProof}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-medium border border-slate-700/80 flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Replace file"
                    >
                      <RotateCcw size={12} />
                      <span>Replace</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(true)}
                      disabled={isUploadingProof}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 text-xs font-medium border border-rose-800/40 flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Delete file"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Empty State */
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full min-h-[220px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer group ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-slate-700/80 hover:border-blue-500/80 bg-[#0b1329]/70 hover:bg-[#0b1329]'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3 text-blue-400 group-hover:scale-105 transition-transform">
                {isUploadingProof ? <Loader2 size={24} className="animate-spin text-blue-400" /> : <UploadCloud size={24} />}
              </div>
              
              <p className="text-sm font-semibold text-slate-200 mb-1">
                Upload payment screenshot or PDF
              </p>
              <p className="text-xs text-slate-400 mb-3">
                No file uploaded
              </p>
              
              <button
                type="button"
                disabled={isUploadingProof}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md transition-colors cursor-pointer"
              >
                <UploadCloud size={14} />
                {isUploadingProof ? 'Uploading...' : 'Upload Image / PDF'}
              </button>
              
              <p className="text-[11px] text-slate-500 mt-3 font-mono">
                Supported: JPG, JPEG, PNG, WEBP, PDF
              </p>
            </div>
          )}

          {/* Hidden file inputs */}
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelection(e.target.files[0]);
              }
            }} 
            className="hidden" 
          />

          <input 
            ref={replaceFileInputRef}
            type="file" 
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelection(e.target.files[0]);
              }
            }} 
            className="hidden" 
          />
        </div>

      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button 
          type="button"
          onClick={handleSave} 
          disabled={isSaving || isUploadingProof}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Confirming...</span>
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={2.5} />
              <span>CONFIRM PAY ADVANCE</span>
            </>
          )}
        </button>
      </div>

      {/* CONFIRMATION MODAL: REPLACE PAYMENT PROOF */}
      <ConfirmModal
        isOpen={isReplaceModalOpen}
        title="Replace existing payment proof?"
        message={`Are you sure you want to replace the current payment proof with "${pendingFile?.name || 'new file'}"? The existing file will be removed from storage.`}
        confirmText="Replace Proof"
        cancelText="Cancel"
        variant="warning"
        isDestructive={false}
        onClose={() => {
          setIsReplaceModalOpen(false);
          setPendingFile(null);
        }}
        onConfirm={handleConfirmReplace}
      />

      {/* CONFIRMATION MODAL: DELETE PAYMENT PROOF */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete this payment proof?"
        message="Are you sure you want to delete this payment proof? This will remove the file from storage and clear the proof reference. Other payment information will remain intact."
        confirmText="Delete Proof"
        cancelText="Cancel"
        variant="danger"
        isDestructive={true}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />

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
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
        >
          <Check size={16} strokeWidth={2.5} />
          <span>{isReUploadTimeline ? 'CONFIRM RE-UPLOAD TIME LINE' : 'CONFIRM TIME LINE'}</span>
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
    if (existingData.is_deleted) return [];
    if (Array.isArray(existingData.attempts)) {
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
  const [attemptToDelete, setAttemptToDelete] = useState<DraftAttempt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (isUploading) return;
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

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, initialFile, {
          contentType: initialFile.type || 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setInitialUrl(finalUrl);
      } catch (err: any) {
        console.error('Error uploading draft video:', err);
        toast.error('Failed to upload video file: ' + (err?.message || 'Storage error'));
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

    setInitialFile(null);
    setIsUploading(false);
    toast.success('Draft uploaded successfully! Please review and select approval status.');
  };

  // Submit Re-Draft (Attempt N + 1) — Creates new attempt, preserving all previous attempts permanently
  const handleSubmitReDraft = async () => {
    if (isUploading) return;
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

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, reDraftFile, {
          contentType: reDraftFile.type || 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
      } catch (err: any) {
        console.error('Error uploading re-draft video:', err);
        toast.error('Failed to upload re-draft video file: ' + (err?.message || 'Storage error'));
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

  // Delete Draft Attempt
  const handleDeleteAttempt = async (attempt: DraftAttempt) => {
    setIsDeleting(true);
    try {
      // 1. Remove file from Supabase storage if stored in influencer-profiles
      let storagePath: string | null = null;
      const vUrl = attempt.video_url;
      if (vUrl && vUrl.includes('/influencer-profiles/')) {
        const parts = vUrl.split('/influencer-profiles/');
        if (parts[1]) {
          storagePath = decodeURIComponent(parts[1].split('?')[0]);
        }
      }
      if (storagePath) {
        try {
          await supabaseAdmin.storage.from('influencer-profiles').remove([storagePath]);
        } catch (sErr) {
          console.warn('Storage file deletion error (non-fatal):', sErr);
        }
      }

      // 2. Filter out deleted attempt
      const remainingAttempts = attempts.filter(a => a.attempt_number !== attempt.attempt_number);

      if (remainingAttempts.length === 0) {
        // Reset to NOT_STARTED
        const emptyPayload = {
          attempts: [],
          active_attempt_number: 0,
          approval_status: '',
          vid: '',
          timing: 'Not Submit',
          corr: '',
          finalL: '',
          finalD: '',
          re_draft_submit_date: '',
          latest_re_draft_submit_date: '',
          is_deleted: true
        };
        await onSave(emptyPayload, false);

        setInitialFile(null);
        setInitialUrl('');
        setAppStat('');
        setCorr('');
        setFinalL('');
        setFinalD('');
        setCalculatedTiming('Not Submit');
        setReDraftSubmitDate('');
        setAttemptToDelete(null);
        setPreviewModalAttempt(null);
        toast.success('Draft video deleted. Step reset to Not Started.');
      } else {
        // Revert to previous attempt
        const prevAttempt = remainingAttempts[remainingAttempts.length - 1];
        const isPrevApproved = prevAttempt.approval_status === 'Approved' && prevAttempt.timing_status !== 'Not Submit';

        const rollbackPayload = {
          attempts: remainingAttempts,
          active_attempt_number: prevAttempt.attempt_number,
          approval_status: prevAttempt.approval_status || 'Pending Approval',
          vid: prevAttempt.video_url || '',
          timing: prevAttempt.timing_status || 'On Time',
          corr: prevAttempt.corrections || '',
          finalL: prevAttempt.final_product_link || '',
          finalD: prevAttempt.final_description || '',
          re_draft_submit_date: prevAttempt.re_draft_submit_date || '',
          latest_re_draft_submit_date: prevAttempt.re_draft_submit_date || ''
        };
        await onSave(rollbackPayload, isPrevApproved);

        setAppStat(prevAttempt.approval_status === 'Approved' || prevAttempt.approval_status === 'Not Approved' ? prevAttempt.approval_status : '');
        setCorr(prevAttempt.corrections || '');
        setFinalL(prevAttempt.final_product_link || '');
        setFinalD(prevAttempt.final_description || '');
        setCalculatedTiming(prevAttempt.timing_status || 'On Time');
        setReDraftSubmitDate(prevAttempt.re_draft_submit_date || '');
        setAttemptToDelete(null);
        setPreviewModalAttempt(null);
        toast.success(`Draft Attempt ${attempt.attempt_number} deleted. Reverted to Attempt ${prevAttempt.attempt_number}.`);
      }
    } catch (err: any) {
      console.error('Error deleting draft attempt:', err);
      toast.error('Failed to delete draft attempt: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
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

    if (appStat === 'Approved') {
      if (!calculatedTiming || calculatedTiming === 'Not Submit') {
        toast.error('Please select a valid timing status (Advance, On Time, or Late) before approving the draft.');
        return;
      }
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

    const isApproved = appStat === 'Approved' && calculatedTiming !== 'Not Submit';

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

    // Save to Supabase (completed is true ONLY if Approved with valid timing!)
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
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-md flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <span>Submit Re-Draft Attempt {(activeAttempt?.attempt_number || 1) + 1}</span>
              )}
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
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setInitialFile(null);
                  setInitialUrl('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleSubmitInitialDraft}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Save Uploaded Draft (Attempt 1)</span>
                )}
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
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

                  {/* Right: View & Delete Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {att.reviewed_at && (
                      <span className="text-[10px] text-slate-500 hidden md:inline">
                        Reviewed: {formatHistoryTimestamp(att.reviewed_at)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewModalAttempt(att)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                    {isCurrent && (
                      <button
                        type="button"
                        onClick={() => setAttemptToDelete(att)}
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-lg border border-rose-800/60 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="Delete current draft attempt"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. APPROVAL & TIMING CONTROLS */}
      {!isReDraftMode && activeAttempt && (
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
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
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
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
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
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>CONFIRM DRAFT</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 5. DELETE ATTEMPT CONFIRMATION MODAL */}
      {attemptToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="bg-[#0b1329] border border-rose-800/80 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/70 border border-rose-700/60 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Draft Attempt {attemptToDelete.attempt_number}?</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  This action will remove the uploaded draft video file and delete this attempt reference.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl text-xs text-rose-300/90">
              {attempts.length === 1 ? (
                <span>This is the only draft attempt. Deleting it will reset Step 5: Draft back to <strong>Not Started</strong>.</span>
              ) : (
                <span>Draft Attempt {attemptToDelete.attempt_number} will be deleted. Draft Attempt {attemptToDelete.attempt_number - 1} will become the active draft.</span>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAttemptToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteAttempt(attemptToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
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

            {/* Modal Footer with Delete option for current attempt */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              {previewModalAttempt.attempt_number === activeAttempt?.attempt_number ? (
                <button
                  type="button"
                  onClick={() => {
                    const toDel = previewModalAttempt;
                    setPreviewModalAttempt(null);
                    setAttemptToDelete(toDel);
                  }}
                  className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-200 text-xs font-bold rounded-xl border border-rose-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Video</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setPreviewModalAttempt(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
          >
            {isSavingLiveDetails ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Confirming Video {videoNumber} Post Date...</span>
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} />
                <span>CONFIRM POST DATE</span>
              </>
            )}
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
  const livePaymentSource = { ...(record.dispatch || {}), ...(record.influencer || {}) };
  const resolvedPayment = resolveInfluencerPaymentDetails(livePaymentSource);

  const isAccount = resolvedPayment.payment_method === 'ACCOUNT_DETAILS';
  const isUPI = resolvedPayment.payment_method === 'UPI';
  const isHistorical = Boolean(existingData.payment_completed);

  const paymentInfoForCard: PaymentDetailsInfo = {
    payment_method: resolvedPayment.payment_method,
    upi_number: isUPI ? (resolvedPayment.upi_number || null) : null,
    account_holder_name: isAccount ? (resolvedPayment.account_holder_name || null) : null,
    account_number: isAccount ? (resolvedPayment.account_number || null) : null,
    ifsc_code: isAccount ? (resolvedPayment.ifsc_code || null) : null,
    bank_name: isAccount ? (resolvedPayment.bank_name || null) : null,
    pan_number: isAccount ? (resolvedPayment.pan_number || null) : null
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
      payment_method: resolvedPayment.payment_method,
      upi_number: isUPI ? resolvedPayment.upi_number : null,
      account_number: isAccount ? resolvedPayment.account_number : null,
      account_holder_name: isAccount ? resolvedPayment.account_holder_name : null,
      ifsc_code: isAccount ? resolvedPayment.ifsc_code : null,
      bank_name: isAccount ? resolvedPayment.bank_name : null,
      pan_number: isAccount ? resolvedPayment.pan_number : null,
      payment_completed: paymentConfirmed
    });
    setIsUploading(false);
    await loadTransactions();
    toast.success(`Video ${videoNumber} Payment confirmed successfully!`);
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
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Confirming...</span>
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={2.5} />
              <span>CONFIRM PAYMENT</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
