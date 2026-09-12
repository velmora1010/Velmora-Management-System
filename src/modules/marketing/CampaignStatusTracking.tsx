import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign } from '../../types';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import { 
  Clock, Package, Phone, FileText, Video, Check, 
  XCircle, PauseCircle, Users, Target, Search, Trash2, MoreHorizontal, 
  RefreshCcw, X, UploadCloud, IndianRupee, Eye, Copy, ArrowLeft,
  History, RotateCcw, AlertTriangle, Lock, RefreshCw, Play, Edit3, Loader2
} from 'lucide-react';
import { logActivity } from '../../services/activityService';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { isActiveStatus } from '../../utils/marketingUtils';
import { naturalCompareCodes } from '../../services/influencerStatusHandoffService';
import { parseToYMD, calculateDraftDate } from '../../hooks/marketing/useCampaignInfluencers';
import toast from 'react-hot-toast';

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

// Video 1 Steps: Call & Explain -> Share Script -> Pay Advance -> Time Line -> Draft -> Post Date
export const VIDEO_1_STEP_CONFIGS: VideoStepConfig[] = [
  { id: 'call_explain', label: 'Call & Explain', shortLabel: 'Call Explain', icon: Phone },
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
  { id: 'pay_advance', label: 'Pay Advance', shortLabel: 'Pay Advance', icon: IndianRupee },
  { id: 'timeline', label: 'Time Line', shortLabel: 'Time Line', icon: Clock },
  { id: 'draft', label: 'Draft', shortLabel: 'Draft', icon: Video },
  { id: 'post_date', label: 'Post Date', shortLabel: 'Post Date', icon: Check },
];

// Videos 2 through 6 Steps: Call & Explain -> Share Script -> Time Line -> Draft -> Post Date -> Payment
export const VIDEO_N_STEP_CONFIGS: VideoStepConfig[] = [
  { id: 'call_explain', label: 'Call & Explain', shortLabel: 'Call Explain', icon: Phone },
  { id: 'share_script', label: 'Share Script', shortLabel: 'Share Script', icon: FileText },
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
// TYPES & HELPERS FOR DRAFT ATTEMPTS, RE-DRAFT & TIMELINE AUDIT HISTORY
// =========================================================================
export interface DraftAttempt {
  attempt_number: number;
  video_url: string;
  approval_status: 'Approved' | 'Not Approved' | 'Pending Approval';
  timing_status?: string;
  corrections?: string;
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
  newPostDate
}: {
  influencerId: string | number;
  campaignId?: string;
  videoNumber: number;
  newPostDate: string;
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
      // Modify ONLY post_date on this specific row. Preserve draft_date, campaign_id, etc.
      const { error: updatePdErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerPostDates)
        .update({
          post_date: newPostDate,
          updated_at: new Date().toISOString()
        })
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
          post_date: newPostDate
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
        // Do NOT touch pdItem.draft_date or other properties
      } else {
        viewsJson.post_dates.push({
          video_number: videoNumber,
          post_date: newPostDate
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

  // Initialize steps record
  const steps: Record<string, { completed: boolean; data: any; updated_at?: string }> = {};

  configs.forEach(cfg => {
    // If structured in metadata.videos, use that
    if (storedVideo?.steps?.[cfg.id]) {
      const st = storedVideo.steps[cfg.id];
      if (cfg.id === 'timeline') {
        const isOver = st.data?.manualOverride === true;
        const effDate = isOver ? (st.data?.date || '') : (scheduledDraftDate || st.data?.date || (videoNum === 1 ? (record.draft_expected_date || '') : ''));
        steps[cfg.id] = {
          ...st,
          data: {
            ...st.data,
            date: effDate,
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
        const effPostDate = postData.scheduled_post_date || scheduledPostDate || '';
        steps[cfg.id] = {
          ...st,
          data: {
            ...postData,
            scheduled_post_date: effPostDate,
            history: Array.isArray(postData.history) ? postData.history : []
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
          script: record.ref_script || metadata.script || '',
          keypoints: record.ref_keypoints || metadata.keypoints || '',
          offer: record.ref_offer || metadata.offer || '',
          link: record.ref_link || metadata.link || '',
          reference_videos_list: record.reference_videos_list || []
        };
      } else if (cfg.id === 'pay_advance') {
        completed = !!record.pay_advance_completed || (parseFloat(record.advance_paid_amount || '0') > 0);
        data = {
          gpay: record.advance_gpay_number || '',
          total: record.advance_total_amount || record.pricing?.final_price || '',
          advance: record.advance_paid_amount || '',
          photo: record.pay_advance_photo_url || ''
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
  const { trackingRecords, isLoading, refresh, saveMilestone } = useCampaignStatusTracking(campaign.id);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');

  // Modals & Menu State
  const [activeModal, setActiveModal] = useState<{ recordId: string; stageId: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailsRecord, setDetailsRecord] = useState<StatusTrackingRecord | null>(null);

  // LEVEL 2 VIEW STATE: null = Main List View; object = Video Detail View
  const [selectedVideo, setSelectedVideo] = useState<{ recordId: string; videoNumber: number } | null>(null);

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
    if (!record.delivered_confirmed) {
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

  // Collect available languages across records
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    activeTrackingRecords.forEach(r => {
      (r.dispatch?.languages || []).forEach(l => {
        if (l && typeof l === 'string') langs.add(l);
      });
    });
    return Array.from(langs).sort();
  }, [activeTrackingRecords]);

  // Overall KPI Counts
  const kpiCounts = useMemo(() => {
    const total = activeTrackingRecords.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let onHold = 0;
    let notStarted = 0;

    activeTrackingRecords.forEach(r => {
      const status = getOverallStatus(r);
      if (status.key === 'COMPLETED') completed++;
      else if (status.key === 'IN_PROGRESS') inProgress++;
      else if (status.key === 'PENDING') pending++;
      else if (status.key === 'ON_HOLD') onHold++;
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
      notStarted,
      notStartedPct: calcPct(notStarted)
    };
  }, [activeTrackingRecords]);

  // Filtered influencers based on user selections
  const filteredRecords = useMemo(() => {
    return activeTrackingRecords.filter(record => {
      const dispatch = record.dispatch || ({} as any);
      const overallStatus = getOverallStatus(record);

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'IN_PROGRESS') {
          if (overallStatus.key !== 'IN_PROGRESS') return false;
        } else if (overallStatus.key !== selectedStatus) {
          return false;
        }
      }

      // Platform filter
      if (selectedPlatform !== 'ALL') {
        const platforms = dispatch.platforms || [];
        if (!platforms.some((p: string) => p.toLowerCase() === selectedPlatform.toLowerCase())) {
          return false;
        }
      }

      // Language filter
      if (selectedLanguage !== 'ALL') {
        const languages = dispatch.languages || [];
        if (!languages.includes(selectedLanguage)) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (dispatch.influencer_name || '').toLowerCase();
        const code = (dispatch.influencer_code || '').toLowerCase();
        const username = (dispatch.username || '').toLowerCase();
        const phone = (dispatch.phone_number || '').toLowerCase();
        const tracking = (dispatch.tracking_id || '').toLowerCase();
        const matches = name.includes(q) || code.includes(q) || username.includes(q) || phone.includes(q) || tracking.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [activeTrackingRecords, selectedStatus, selectedPlatform, selectedLanguage, searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedPlatform('ALL');
    setSelectedLanguage('ALL');
  };

  // Milestone Save Handler for Top-Level Delivery & Modals
  const handleDeliverySave = async (recordId: string, data: any) => {
    const record = activeTrackingRecords.find(r => r.id === recordId) || trackingRecords.find(r => r.id === recordId);
    if (!record) return;

    let metadata: any = {};
    try {
      metadata = JSON.parse(record.notes || '{}');
    } catch (e) {
      metadata = {};
    }

    metadata.last_updated = new Date().toISOString();
    metadata.delivered_confirmed = data.delivered_confirmed;

    const updates: Partial<StatusTrackingRecord> = {
      delivered_confirmed: data.delivered_confirmed,
      delivery_photo_url: data.delivery_photo_url || null,
      current_step: data.delivered_confirmed ? Math.max(record.current_step || 0, 1) : 0,
      notes: JSON.stringify(metadata)
    };

    const result = await saveMilestone(recordId, updates);
    if (result.success) {
      toast.success('Delivery confirmation saved successfully.');
      await refresh();
      setActiveModal(null);
    } else {
      toast.error('Failed to save delivery: ' + (result.error?.message || 'Unknown error'));
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

    if (stepId === 'draft') {
      videoObj.is_re_draft_required = (stepData.approval_status === 'Not Approved');
    }

    // Calculate video completion status
    const configs = videoNumber === 1 ? VIDEO_1_STEP_CONFIGS : VIDEO_N_STEP_CONFIGS;
    const completedStepsCount = configs.filter(c => videoObj.steps[c.id]?.completed).length;
    videoObj.completed_count = completedStepsCount;
    videoObj.status = completedStepsCount === configs.length ? 'COMPLETED' : ((completedStepsCount > 0 || videoObj.is_re_draft_required) ? 'IN_PROGRESS' : 'NOT_STARTED');

    metadata.last_updated = new Date().toISOString();

    const updates: Partial<StatusTrackingRecord> = {
      notes: JSON.stringify(metadata)
    };

    // For Video 1, mirror corresponding legacy columns to maintain backward compatibility
    if (videoNumber === 1) {
      if (stepId === 'call_explain') {
        updates.ref_call_explanation_required = isStepCompleted;
        metadata.call_explained = isStepCompleted;
      } else if (stepId === 'share_script') {
        updates.reference_video_received = isStepCompleted;
        metadata.script_shared = isStepCompleted;
      } else if (stepId === 'pay_advance') {
        updates.pay_advance_completed = isStepCompleted;
        if (stepData.gpay) updates.advance_gpay_number = stepData.gpay;
        if (stepData.total) updates.advance_total_amount = stepData.total;
        if (stepData.advance) updates.advance_paid_amount = stepData.advance;
        if (stepData.photo) updates.pay_advance_photo_url = stepData.photo;
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
    }

    const result = await saveMilestone(recordId, updates);
    if (result.success) {
      if (!stepData?.suppressDefaultToast) {
        toast.success(`Video ${videoNumber} step updated successfully!`);
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
  const selectedRecord = selectedVideo 
    ? (activeTrackingRecords.find(r => String(r.id) === String(selectedVideo.recordId)) || trackingRecords.find(r => String(r.id) === String(selectedVideo.recordId)) || null)
    : null;

  return (
    <div className="bg-[#070c18] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[calc(100vh-120px)] min-h-[750px] shadow-2xl p-5 gap-4">
      
      {/* =========================================================================
          LEVEL 2: DEDICATED VIDEO DETAIL VIEW
      ========================================================================= */}
      {selectedVideo && selectedRecord ? (
        <VideoDetailView 
          record={selectedRecord}
          videoNumber={selectedVideo.videoNumber}
          onBack={() => setSelectedVideo(null)}
          onSwitchVideo={(num) => setSelectedVideo({ recordId: selectedRecord.id, videoNumber: num })}
          onSaveStep={(stepId, data, completed) => handleSaveVideoStep(selectedRecord.id, selectedVideo.videoNumber, stepId, data, completed)}
        />
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
              <select 
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-[#0b1329] border border-slate-800/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="NOT_STARTED">Not Started</option>
              </select>
              <select 
                value={selectedPlatform}
                onChange={e => setSelectedPlatform(e.target.value)}
                className="bg-[#0b1329] border border-slate-800/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Platforms</option>
                <option value="Instagram">Instagram</option>
                <option value="YouTube">YouTube</option>
                <option value="Facebook">Facebook</option>
              </select>
              <select 
                value={selectedLanguage}
                onChange={e => setSelectedLanguage(e.target.value)}
                className="bg-[#0b1329] border border-slate-800/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Languages</option>
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
              <button 
                onClick={handleClearFilters}
                className="border border-rose-500/50 hover:bg-rose-500/10 text-rose-400 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Trash2 size={15} />
                Clear All
              </button>
            </div>
          </div>

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
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 scroll-smooth">
            {isLoading ? (
              <div className="flex justify-center items-center h-64 text-slate-400">
                <RefreshCcw size={22} className="animate-spin mr-2 text-blue-400" />
                <span>Loading status tracking records...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-64 text-slate-500 italic bg-[#0b1329]/50 rounded-2xl border border-slate-800/60 p-8">
                <div className="text-4xl mb-3 opacity-60">🎯</div>
                <h3 className="text-slate-300 text-base font-semibold mb-1">No matching status tracking records</h3>
                <p className="text-xs text-slate-400">
                  {searchQuery || selectedStatus !== 'ALL' || selectedPlatform !== 'ALL' || selectedLanguage !== 'ALL'
                    ? 'Try clearing your filters to view influencers.'
                    : 'Dispatch an influencer with Delivered shipment status to begin status tracking.'}
                </p>
              </div>
            ) : (
              filteredRecords.map(record => {
                const dispatch = record.dispatch || ({} as any);
                const avatarUrl = dispatch.influencer_avatar;
                const influencerCode = dispatch.influencer_code || record.influencer_id;
                const influencerName = dispatch.influencer_name || 'Unknown Influencer';
                const username = dispatch.username || '—';

                const isDelivered = !!record.delivered_confirmed;
                const overallStatus = getOverallStatus(record);
                const isMenuOpen = openMenuId === record.id;

                // Derive status for all 6 videos
                const videoWorkflows = [1, 2, 3, 4, 5, 6].map(num => getVideoWorkflow(record, num));

                return (
                  <div 
                    key={record.id}
                    id={`st-card-${record.dispatch_id || record.id}`}
                    className="bg-[#0b1329] hover:bg-[#0e1733] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4"
                  >
                    {/* LEFT SECTION: Compact Code Badge, Profile, Name, Username */}
                    <div className="flex items-center gap-3 shrink-0 min-w-[220px]">
                      {/* Compact Influencer Code Badge */}
                      <div className="px-2.5 py-1 rounded-lg bg-[#070c18] border border-slate-700/80 text-white font-mono font-bold text-xs tracking-wider shrink-0 shadow-sm text-center">
                        {influencerCode}
                      </div>

                      {/* Profile Avatar */}
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 border border-slate-700 bg-slate-900 flex items-center justify-center shadow">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={influencerName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 font-extrabold text-sm">{influencerName.charAt(0) || '?'}</span>
                        )}
                      </div>

                      {/* Influencer Name & Username */}
                      <div className="truncate min-w-0">
                        <h4 className="text-white font-bold text-sm sm:text-base leading-tight truncate max-w-[170px]" title={influencerName}>
                          {influencerName}
                        </h4>
                        <p className="text-slate-400 text-xs font-medium mt-0.5 truncate max-w-[170px]" title={username}>
                          {username}
                        </p>
                      </div>
                    </div>

                    {/* CENTER SECTION: 7 Horizontal Stages (Delivery + 6 Videos) */}
                    <div className="flex-1 px-2 py-1 max-w-3xl mx-auto w-full">
                      <div className="flex items-center justify-between w-full">
                        
                        {/* 1. DELIVERY CONFIRMATION STAGE */}
                        <div 
                          className="flex flex-col items-center cursor-pointer group relative select-none"
                          onClick={() => setActiveModal({ recordId: record.id, stageId: 'delivered' })}
                          title={isDelivered ? 'Delivery Confirmed (Click to view/edit)' : 'Delivery Confirmation: Not Started (Click to confirm)'}
                        >
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
                            isDelivered 
                              ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-400 hover:scale-110'
                              : 'bg-[#151f32] text-slate-400 border border-slate-700/80 hover:border-slate-500 hover:text-slate-200'
                          }`}>
                            {isDelivered ? (
                              <Check size={18} strokeWidth={3} className="text-white" />
                            ) : (
                              <Package size={17} className="text-slate-400 group-hover:text-slate-200" />
                            )}
                          </div>
                          <span className={`text-[10px] sm:text-[11px] text-center w-20 sm:w-24 leading-tight mt-1.5 transition-colors ${
                            isDelivered ? 'text-emerald-400 font-bold' : 'text-slate-400'
                          }`}>
                            Delivery
                          </span>
                        </div>

                        {/* Connecting Line from Delivery to Video 1 */}
                        <div className="flex-1 h-[2px] mx-1 sm:mx-2 -mt-4 transition-colors duration-300">
                          <div className={`h-full w-full rounded-full ${
                            isDelivered ? 'bg-emerald-500/80' : 'bg-slate-700/60'
                          }`} />
                        </div>

                        {/* 2 to 7: VIDEOS 1 THROUGH 6 */}
                        {videoWorkflows.map((vw, idx) => {
                          const vNum = vw.videoNumber;
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
                                className="flex flex-col items-center cursor-pointer group relative select-none"
                                onClick={() => {
                                  if (!isDelivered) {
                                    toast.error('Please complete Delivery Confirmation first.');
                                    setActiveModal({ recordId: record.id, stageId: 'delivered' });
                                    return;
                                  }
                                  setSelectedVideo({ recordId: record.id, videoNumber: vNum });
                                }}
                                title={`Click to manage Video ${vNum} (${vw.completedCount} of ${vw.totalSteps} completed)`}
                              >
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${circleStyle}`}>
                                  {isVCompleted ? (
                                    <Check size={18} strokeWidth={3} className="text-white" />
                                  ) : isReDraftReq ? (
                                    <span className="font-black text-xs text-amber-400 tracking-tight">RD</span>
                                  ) : isVInProgress ? (
                                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                                  ) : (
                                    <span className="font-bold text-xs sm:text-sm text-slate-400 group-hover:text-white">{vNum}</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className={`text-[10px] sm:text-[11px] text-center w-16 sm:w-20 leading-tight mt-1.5 transition-colors ${labelStyle}`}>
                                    Video {vNum}
                                  </span>
                                  {isReDraftReq && (
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-950/90 border border-amber-800/80 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap shadow-sm">
                                      Re-Draft Req
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Connecting Line between Videos */}
                              {idx !== videoWorkflows.length - 1 && (
                                <div className="flex-1 h-[2px] mx-1 sm:mx-2 -mt-4 transition-colors duration-300">
                                  <div className={`h-full w-full rounded-full ${isLineActive ? 'bg-emerald-500' : isVInProgress ? 'bg-blue-500/50' : 'bg-slate-700/60'}`} />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* RIGHT SECTION: Overall Status & Three-Dot Menu */}
                    <div className="flex items-center gap-3 shrink-0 justify-end min-w-[150px]">
                      {/* Status Badge */}
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border shadow-sm ${overallStatus.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${overallStatus.dotClass}`}></span>
                        <span>{overallStatus.label}</span>
                      </span>

                      {/* Three-Dot Menu */}
                      <div className="relative three-dot-menu-container">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : record.id);
                          }}
                          className="w-8 h-8 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                          title="More actions"
                        >
                          <MoreHorizontal size={16} />
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
            <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in relative">
              <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#070c18]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <Package size={18} />
                  </div>
                  <div>
                    <h5 className="text-base sm:text-lg font-bold text-white leading-none">Delivery Confirmation</h5>
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
  const influencerCode = dispatch.influencer_code || record.influencer_id;
  const influencerName = dispatch.influencer_name || 'Unknown Influencer';
  const username = dispatch.username || '—';
  const avatarUrl = dispatch.influencer_avatar;

  // Derive workflow data for this specific video
  const videoData = useMemo(() => getVideoWorkflow(record, videoNumber), [record, videoNumber]);
  const [activeStepId, setActiveStepId] = useState<string>(videoData.activeStepId);

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
    <div className="flex flex-col h-full space-y-4 animate-fade-in overflow-hidden">
      
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

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">VIDEO {videoNumber}</span>
            {videoStatusBadge}
          </div>
        </div>
      </div>

      {/* 2. COMPACT 6-STEP PROGRESS STEPPER CARD */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 shrink-0 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider">VIDEO {videoNumber} WORKFLOW</span>
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
                    {cfg.shortLabel}
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
                Step {videoData.configs.findIndex(c => c.id === activeStepId) + 1}: {activeStepConfig.label}
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
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('share_script', formData, formData.reference_video_received)} 
            />
          )}

          {activeStepId === 'pay_advance' && (
            <PayAdvanceForm 
              record={record} 
              existingData={activeStepState.data}
              onSave={(formData: any) => onSaveStep('pay_advance', formData, formData.pay_advance_completed)} 
            />
          )}

          {activeStepId === 'timeline' && (
            <ExpectedTimelineForm 
              record={record} 
              videoNumber={videoNumber}
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

// --- STEP: Delivery Confirmation ---
const DeliveredForm = ({ record, onSave }: any) => {
  const [photo, setPhoto] = useState(record.delivery_photo_url || '');
  const [confirmed, setConfirmed] = useState(record.delivered_confirmed || false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    if (!confirmed) {
      toast.error('Please confirm package delivery first.');
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
      delivery_photo_url: finalUrl, 
      delivered_confirmed: confirmed
    });
    setIsUploading(false);
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
        <input 
          type="checkbox" 
          id="delivered-confirmed"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" 
        />
        <label htmlFor="delivered-confirmed" className="text-sm font-medium text-slate-200 cursor-pointer">
          Yes, the package has been delivered and confirmed by the creator.
        </label>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
          Delivery Proof Photo
        </label>
        <div className="border-2 border-dashed border-slate-700/80 rounded-xl p-4 text-center relative hover:border-emerald-500 transition-colors bg-[#0b1329] min-h-[200px] flex items-center justify-center">
          {preview ? (
            <div className="relative w-full aspect-video">
              <img src={preview} alt="Delivery Proof" className="w-full h-full object-contain rounded-lg" />
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center">
              <UploadCloud className="text-slate-500 mb-2" size={32} />
              <span className="text-sm text-slate-300 font-medium mb-1">Click to upload delivery photo</span>
              <span className="text-xs text-slate-500">PNG, JPG up to 5MB</span>
            </div>
          )}
          <input 
            type="file" 
            accept="image/*" 
            onChange={handlePhotoUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          />
        </div>
      </div>
      
      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {isUploading ? 'Saving...' : 'Save Delivery Details'}
        </button>
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
const ShareScriptForm = ({ record, existingData = {}, onSave }: any) => {
  const [concept, setConcept] = useState(existingData.concept || record.ref_concept || '');
  const [script, setScript] = useState(existingData.script || record.ref_script || '');
  const [keypoints, setKeypoints] = useState(existingData.keypoints || record.ref_keypoints || '');
  const [offer, setOffer] = useState(existingData.offer || record.ref_offer || '');
  const [link, setLink] = useState(existingData.link || record.ref_link || '');
  const [vids, setVids] = useState<string[]>(
    existingData.reference_videos_list?.length ? existingData.reference_videos_list : (record.reference_videos_list?.length ? record.reference_videos_list : [''])
  );
  const [scriptShared, setScriptShared] = useState(
    existingData.script_shared !== undefined ? existingData.script_shared : (!!record.reference_video_received || !!record.ref_script)
  );

  const handleSave = async () => {
    const validVids = vids.filter(Boolean);
    await onSave({ 
      reference_video_received: scriptShared,
      script_shared: scriptShared,
      concept: concept || '', 
      script: script || '', 
      keypoints: keypoints || '', 
      offer: offer || '', 
      link: link || '', 
      reference_videos_list: validVids
    });
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3 bg-[#0b1329] p-4 rounded-xl border border-slate-800">
        <input 
          type="checkbox" 
          id="script-shared-checkbox"
          checked={scriptShared}
          onChange={(e) => setScriptShared(e.target.checked)}
          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" 
        />
        <label htmlFor="script-shared-checkbox" className="text-sm font-medium text-slate-200 cursor-pointer">
          Script & reference materials shared and approved with the creator.
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Campaign Concept</label>
          <input 
            type="text" 
            value={concept} 
            onChange={e => setConcept(e.target.value)} 
            placeholder="e.g. Morning Glow Routine"
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Offer to Mention</label>
          <input 
            type="text" 
            value={offer} 
            onChange={e => setOffer(e.target.value)} 
            placeholder="e.g. 15% OFF with code CREATOR15"
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Proposed Script</label>
          <textarea 
            value={script} 
            onChange={e => setScript(e.target.value)} 
            placeholder="Enter the proposed video talking points, hook, body, and call-to-action..."
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 h-24" 
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Key Points to Cover</label>
          <textarea 
            value={keypoints} 
            onChange={e => setKeypoints(e.target.value)} 
            placeholder="Key product USPs, ingredients, or brand highlights to emphasize..."
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 h-20" 
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Creator Product Link</label>
          <input 
            type="text" 
            value={link} 
            onChange={e => setLink(e.target.value)} 
            placeholder="https://..."
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
          />
        </div>
      </div>
      
      <div className="border-t border-slate-800 pt-4">
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Reference Video Links</label>
        {vids.map((v, i) => (
          <input 
            key={i} 
            type="text" 
            value={v} 
            onChange={e => { const nv = [...vids]; nv[i] = e.target.value; setVids(nv); }} 
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white mb-2 focus:outline-none focus:border-blue-500" 
            placeholder="Paste reference video URL..." 
          />
        ))}
        <button 
          onClick={() => setVids([...vids, ''])} 
          className="text-emerald-400 text-xs font-bold hover:underline"
        >
          + Add More Video Links
        </button>
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          Save Script Details
        </button>
      </div>
    </div>
  );
};

// --- STEP: Pay Advance (Video 1 Only) ---
const PayAdvanceForm = ({ record, existingData = {}, onSave }: any) => {
  const [gpay, setGpay] = useState(existingData.gpay || record.advance_gpay_number || '');
  const [total, setTotal] = useState(existingData.total || record.advance_total_amount || record.pricing?.final_price || '');
  const [advance, setAdvance] = useState(existingData.advance || record.advance_paid_amount || '');
  
  const [photo, setPhoto] = useState(existingData.photo || record.pay_advance_photo_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    if (!total || !advance) {
      toast.error('Please enter both Total Amount and Advance Amount.');
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
      gpay, 
      total, 
      advance, 
      photo: finalUrl,
      pay_advance_completed: true
    });
    setIsUploading(false);
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Inputs & Upload */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">GPay / UPI Number</label>
            <input 
              type="text" 
              value={gpay} 
              onChange={e => setGpay(e.target.value)} 
              placeholder="e.g. 9876543210@upi"
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Total Agreed Amount (₹)</label>
            <input 
              type="text" 
              value={total} 
              onChange={e => setTotal(e.target.value)} 
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Advance Paid Amount (₹)</label>
            <input 
              type="text" 
              value={advance} 
              onChange={e => setAdvance(e.target.value)} 
              placeholder="e.g. 2000"
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
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
  existingData?: any;
  onSave: (data: any) => Promise<void> | void;
}

const ExpectedTimelineForm: React.FC<ExpectedTimelineFormProps> = ({ 
  record, 
  videoNumber, 
  existingData = {}, 
  onSave 
}) => {
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

  // 2. Active date calculation: manualOverride takes priority, else scheduled draft date
  const hasManualOverride = existingData.manualOverride === true;
  const initialEffectiveDate = hasManualOverride
    ? (existingData.date || '')
    : (scheduledDraftDate || existingData.date || (videoNumber === 1 ? (record.draft_expected_date || '') : ''));

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
    const eff = isOver
      ? (existingData.date || '')
      : (scheduledDraftDate || existingData.date || (videoNumber === 1 ? (record.draft_expected_date || '') : ''));
    setEffectiveDate(eff);
    setIsOverride(isOver);
    setTempEditDate(parseToYMD(eff, 2026) || eff || '');
    setTime(existingData.time || (videoNumber === 1 ? (record.draft_expected_time || '') : ''));
  }, [videoNumber, record.id, scheduledDraftDate, existingData.manualOverride, existingData.date, existingData.time]);

  const handleStartEdit = () => {
    setTempEditDate(parseToYMD(effectiveDate, 2026) || effectiveDate || '');
    setIsEditing(true);
  };

  const handleApplyEdit = () => {
    if (!tempEditDate) {
      toast.error('Please pick a valid date.');
      return;
    }
    const normalizedNew = parseToYMD(tempEditDate, 2026) || tempEditDate;
    const normalizedScheduled = parseToYMD(scheduledDraftDate, 2026) || scheduledDraftDate;
    const newIsOverride = normalizedNew !== normalizedScheduled;

    setEffectiveDate(normalizedNew);
    setIsOverride(newIsOverride);
    setIsEditing(false);
    toast.success('Date updated. Click "Save Timeline" to permanently save & record history.');
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
      history: updatedHistory,
      expected_delivery_completed: true
    });

    logActivity({
      department: 'Marketing',
      action: 'Timeline Date Reset',
      description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} timeline reset to ${newDateFormatted}`,
      metadata: { video_number: videoNumber, old_date: previousDateFormatted, new_date: newDateFormatted }
    });

    toast.success(`Reset to scheduled draft date: ${newDateFormatted}`);
  };

  const handleSaveTimeline = async () => {
    if (!effectiveDate) {
      toast.error('Please assign an Expected Draft Delivery Date.');
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
        reason: isOverride ? 'Manual Timeline override' : 'Timeline date updated'
      };
      updatedHistory = [changeEntry, ...historyList];

      logActivity({
        department: 'Marketing',
        action: 'Timeline Date Edited',
        description: `Influencer ${record.dispatch?.influencer_code || record.influencer_id} Video ${videoNumber} timeline changed from ${previousDateFormatted} to ${newDateFormatted}`,
        metadata: { video_number: videoNumber, old_date: previousDateFormatted, new_date: newDateFormatted }
      });
    }

    await onSave({
      date: effectiveDate,
      time: time || '',
      manualOverride: isOverride,
      history: updatedHistory,
      expected_delivery_completed: true
    });
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      
      {/* Date Display or Inline Edit Card */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
          Expected Draft Delivery Date
        </label>
        
        {!isEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#0b1329] border border-slate-800 rounded-xl gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-base sm:text-lg font-bold font-mono tracking-wide ${effectiveDate ? 'text-white' : 'text-slate-500 italic'}`}>
                {effectiveDate ? formatDisplayDateLocal(effectiveDate) : 'Not Assigned'}
              </span>

              {isOverride ? (
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

              {isOverride && scheduledDraftDate && (
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
              Edit Expected Draft Delivery Date (Video {videoNumber})
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
            <History size={16} className="text-blue-400" />
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Timeline Date History
            </h5>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {historyList.length} change{historyList.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        <div className="space-y-2">
          {/* Base scheduled origin */}
          <div className="p-3 rounded-xl bg-[#0b1329] border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span className="text-slate-400">Initial date from Post Date (Video {videoNumber}):</span>
              <span className="font-bold text-white">{scheduledDraftDate ? formatDisplayDateLocal(scheduledDraftDate) : 'Not Scheduled'}</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50 shrink-0">
              Source Schedule
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
                  {entry.reason || 'Override'}
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
          Save Timeline
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

    const newAttempt: DraftAttempt = {
      attempt_number: nextAttemptNumber,
      video_url: finalUrl,
      approval_status: 'Pending Approval',
      timing_status: calculatedTiming,
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

    if (appStat === 'Not Approved' && (!corr || corr.trim() === '')) {
      toast.error('Please enter correction instructions before rejecting a draft.');
      return;
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
                onClick={() => setIsReDraftMode(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
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

                      <p className="text-slate-400 text-[11px]">
                        Uploaded: {formatHistoryTimestamp(att.uploaded_at)}
                      </p>

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

          {/* Correction Instructions (When Not Approved is selected) */}
          {appStat === 'Not Approved' && (
            <div className="animate-fade-in space-y-2">
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

  const isDateModified = existingData.is_modified === true || (!!existingData.scheduled_post_date && existingData.scheduled_post_date !== scheduledPostDate);
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
  const [amount, setAmount] = useState(existingData.amount || '');
  const [paymentConfirmed, setPaymentConfirmed] = useState(existingData.payment_completed || false);
  const [photo, setPhoto] = useState(existingData.photo || '');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

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
      payment_completed: paymentConfirmed
    });
    setIsUploading(false);
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
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
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Video {videoNumber} Payment Amount (₹)</label>
            <input 
              type="text" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="e.g. 5000"
              className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
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
