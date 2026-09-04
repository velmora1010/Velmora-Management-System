import React, { useState, useMemo, useEffect } from 'react';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import { useCampaignInfluencers, parseToYMD, calculateDraftDate } from '../../hooks/marketing/useCampaignInfluencers';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  X, 
  Calendar, 
  Package, 
  Video, 
  Send,
  Loader2,
  ArrowLeft,
  Eye
} from 'lucide-react';

interface CampaignCalendarProps {
  campaign: Campaign;
  onBack: () => void;
  onNavigateToStatusTracking: () => void;
}

interface CalendarEvent {
  id: string;
  recordId: string;
  type: 'Delivered' | 'Draft' | 'Final Post' | 'Payment';
  label: string;
  icon: string;
  colorClass: string;
  dateStr: string;
  influencerName: string;
  influencerUsername: string;
  campaignName: string;
  avatarUrl: string;
  record: StatusTrackingRecord;
  bill?: any;
  videoNumber?: number;
  postDateStr?: string | null;
  draftDateStr?: string | null;
}

const createFallbackRecord = (inf: CampaignInfluencer, campaign: Campaign): StatusTrackingRecord => {
  return {
    id: `inf-${inf.id}`,
    campaign_id: campaign.id,
    influencer_id: inf.id as any,
    dispatch_id: `disp-${inf.id}`,
    delivered_confirmed: false,
    draft_video_url: null,
    re_draft_video_url: null,
    final_post_completed: false,
    current_step: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dispatch: {
      id: `disp-${inf.id}`,
      campaign_id: campaign.id,
      campaign_name: campaign.campaign_name,
      influencer_id: inf.id as any,
      influencer_name: inf.influencer_name || inf.name || 'Unknown',
      influencer_code: inf.name || inf.code || '',
      influencer_avatar: inf.profile_file_url || '',
      phone_number: inf.phone_number || '',
      courier_partner: 'N/A',
      tracking_id: 'N/A',
      product_name: inf.products?.[0]?.product_name || 'N/A',
      total_products: inf.products?.[0]?.qty || 0,
      expected_delivery_date: null,
      dispatch_date: null
    }
  } as unknown as StatusTrackingRecord;
};



const isFakeUrl = (url: string | undefined | null) => {
  if (!url) return true;
  const clean = url.trim().toLowerCase();
  return clean === '' || 
         clean === 'default' || 
         clean === 'default2' || 
         clean.includes('instagram.com/p/default') || 
         clean.includes('instagram.com/p/default2');
};

const parseDateOnly = (val: any, defaultYear = 2026): string => {
  return parseToYMD(val, defaultYear);
};

const getWorkflowStepLabel = (record: StatusTrackingRecord) => {
  const stages = [
    'Delivered',
    'Pay Advance',
    'Send Reference Videos',
    'Expected Delivery Timeline',
    'Draft 1',
    'Draft 2',
    'Pay Remaining Payment',
    'Final Post'
  ];

  const step = record.current_step || 0;
  return stages[step] || 'Completed';
};

const formatTimelineDate = (dateStr: string, showYear = false) => {
  if (!dateStr) return '';
  const cleanDate = dateStr.split(' ')[0].split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = parseInt(parts[2]);
  const month = monthNames[parseInt(parts[1]) - 1] || '';
  const year = parts[0];
  return showYear ? `${day} ${month} ${year}` : `${day} ${month}`;
};

const getWorkflowStepBadge = (record: StatusTrackingRecord) => {
  const label = getWorkflowStepLabel(record);
  
  let colorClass = 'bg-slate-500/10 border-slate-800 text-slate-400';
  let dotColor = 'bg-slate-500';
  
  if (label === 'Delivered') {
    colorClass = 'bg-green-500/10 border-green-500/20 text-green-405 text-green-400';
    dotColor = 'bg-green-500';
  } else if (label === 'Pay Advance') {
    colorClass = 'bg-yellow-500/10 border-yellow-500/20 text-yellow-450';
    dotColor = 'bg-yellow-500';
  } else if (label === 'Send Reference Videos') {
    colorClass = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
    dotColor = 'bg-cyan-500';
  } else if (label === 'Expected Delivery Timeline') {
    colorClass = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
    dotColor = 'bg-indigo-500';
  } else if (label === 'Draft 1' || label === 'Draft 2') {
    colorClass = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
    dotColor = 'bg-purple-500';
  } else if (label === 'Pay Remaining Payment') {
    colorClass = 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    dotColor = 'bg-orange-500';
  } else if (label === 'Final Post Date' || label === 'Completed') {
    colorClass = 'bg-red-500/10 border-red-500/20 text-red-400';
    dotColor = 'bg-red-500';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-bold border ${colorClass} shadow-sm select-none`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {label}
    </span>
  );
};

interface MilestoneStatus {
  status: 'Pending' | 'On Time' | 'Delayed';
  earlyDays: number;
  delayDays: number;
  badgeText: string;
}

const isDraftOnTime = (expectedDateStr: string, actualDateStr: string | null): boolean => {
  if (!expectedDateStr || !actualDateStr) return false;
  const exp = new Date(expectedDateStr.split(' ')[0].split('T')[0]);
  const act = new Date(actualDateStr.split(' ')[0].split('T')[0]);
  return act <= exp;
};

const isDraftDelayed = (expectedDateStr: string, actualDateStr: string | null, todayStr: string): boolean => {
  if (!expectedDateStr) return false;
  const exp = new Date(expectedDateStr.split(' ')[0].split('T')[0]);
  if (actualDateStr) {
    const act = new Date(actualDateStr.split(' ')[0].split('T')[0]);
    return act > exp;
  } else {
    const today = new Date(todayStr);
    return today > exp;
  }
};

const isPaymentOnTime = (dueDateStr: string, paidDateStr: string | null): boolean => {
  if (!dueDateStr || !paidDateStr) return false;
  const due = new Date(dueDateStr.split(' ')[0].split('T')[0]);
  const paid = new Date(paidDateStr.split(' ')[0].split('T')[0]);
  return paid <= due;
};

const isPaymentDelayed = (dueDateStr: string, paidDateStr: string | null, status: string | null, todayStr: string): boolean => {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr.split(' ')[0].split('T')[0]);
  const today = new Date(todayStr);
  const isPending = !status || status.toLowerCase() === 'pending' || status.toLowerCase() === 'unpaid';
  if (isPending) {
    return today > due;
  } else if (paidDateStr) {
    const paid = new Date(paidDateStr.split(' ')[0].split('T')[0]);
    return paid > due;
  }
  return false;
};

const calculateEarlyDays = (expectedDateStr: string, actualDateStr: string): number => {
  if (!expectedDateStr || !actualDateStr) return 0;
  const exp = new Date(expectedDateStr.split(' ')[0].split('T')[0]);
  const act = new Date(actualDateStr.split(' ')[0].split('T')[0]);
  const diffTime = exp.getTime() - act.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const calculateDelayDays = (expectedDateStr: string, actualDateStr: string | null, todayStr: string): number => {
  if (!expectedDateStr) return 0;
  const exp = new Date(expectedDateStr.split(' ')[0].split('T')[0]);
  const comp = actualDateStr 
    ? new Date(actualDateStr.split(' ')[0].split('T')[0]) 
    : new Date(todayStr);
  const diffTime = comp.getTime() - exp.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const getMilestoneStatus = (
  expectedDateStr: string | null | undefined,
  actualDateStr: string | null | undefined,
  isCompleted: boolean,
  todayStr: string,
  completionPrefix = '✓ On Time',
  delayPrefix = 'Late by',
  earlyPrefix = 'Early'
): MilestoneStatus => {
  if (!expectedDateStr) {
    return { status: 'Pending', earlyDays: 0, delayDays: 0, badgeText: 'Pending' };
  }
  const expected = new Date(expectedDateStr.split(' ')[0].split('T')[0]);
  if (isCompleted) {
    const actualStr = actualDateStr || todayStr;
    const actual = new Date(actualStr.split(' ')[0].split('T')[0]);
    if (actual <= expected) {
      const earlyDays = Math.ceil((expected.getTime() - actual.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 'On Time',
        earlyDays,
        delayDays: 0,
        badgeText: earlyDays > 0 ? `${earlyDays} Day${earlyDays > 1 ? 's' : ''} ${earlyPrefix}` : completionPrefix
      };
    } else {
      const delayDays = Math.ceil((actual.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 'Delayed',
        earlyDays: 0,
        delayDays,
        badgeText: `${delayPrefix} ${delayDays} Day${delayDays > 1 ? 's' : ''}`
      };
    }
  } else {
    const today = new Date(todayStr);
    if (today > expected) {
      const delayDays = Math.ceil((today.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 'Delayed',
        earlyDays: 0,
        delayDays,
        badgeText: `${delayPrefix} ${delayDays} Day${delayDays > 1 ? 's' : ''}`
      };
    }
    return { status: 'Pending', earlyDays: 0, delayDays: 0, badgeText: 'Pending' };
  }
};

const getPaidDate = (bill: any): string | null => {
  if (!bill || bill.bill_status !== 'Paid') return null;
  if (bill.notes) {
    const match = bill.notes.match(/paid on (\d{4}-\d{2}-\d{2})/i);
    if (match) return match[1];
  }
  return bill.created_at ? bill.created_at.split('T')[0] : bill.due_date;
};

export const CampaignCalendar: React.FC<CampaignCalendarProps> = ({ 
  campaign, 
  onBack, 
  onNavigateToStatusTracking 
}) => {
  const { trackingRecords, isLoading: isTrackingLoading, refresh: refreshTracking } = useCampaignStatusTracking(campaign.id);
  const { influencers, isLoading: isInfluencersLoading, refresh: refreshInfluencers } = useCampaignInfluencers(campaign.id);

  const isLoading = isTrackingLoading || isInfluencersLoading;

  const refresh = async () => {
    await Promise.all([refreshTracking(), refreshInfluencers()]);
  };
  
  // Date state for month selector
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [monthChangeTrigger, setMonthChangeTrigger] = useState(0); // Trigger anim

  // Filters state (Month View)
  type CampaignFilterType = 'All' | 'Delivered' | 'Draft' | 'Draft On Time' | 'Draft Delayed' | 'Payment' | 'Payment On Time' | 'Payment Delayed' | 'Final Post';
  const [filterType, setFilterType] = useState<CampaignFilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [bills, setBills] = useState<any[]>([]);
  const [isBillsLoading, setIsBillsLoading] = useState(false);

  useEffect(() => {
    const fetchBills = async () => {
      setIsBillsLoading(true);
      try {
        const { data, error } = await supabase
          .from('finance_bills_rows')
          .select('*')
          .neq('status', 'archived');
        if (!error && data) {
          setBills(data);
        }
      } catch (err) {
        console.error('Failed to fetch bills for calendar:', err);
      } finally {
        setIsBillsLoading(false);
      }
    };
    fetchBills();
  }, []);

  // Selected date for Full Page Day Details view
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Platform details map loaded reactively
  const [influencerPlatforms, setInfluencerPlatforms] = useState<Record<string, string[]>>({});

  // Generate today string
  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  // Fetch influencer platforms reactively
  useEffect(() => {
    const fetchPlatforms = async () => {
      const trackingIds = trackingRecords.map(r => r.influencer_id).filter(Boolean);
      const infIds = (influencers || []).map(i => i.id).filter(Boolean);
      const influencerIds = Array.from(new Set([...trackingIds, ...infIds]));
      if (influencerIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('influencer_platforms_details_rows')
          .select('influencer_id, platform')
          .in('influencer_id', influencerIds);

        if (!error && data) {
          const map: Record<string, string[]> = {};
          for (const item of data) {
            if (!map[item.influencer_id]) {
              map[item.influencer_id] = [];
            }
            map[item.influencer_id].push(item.platform);
          }
          setInfluencerPlatforms(map);
        }
      } catch (err) {
        console.error('Failed to load platforms:', err);
      }
    };

    fetchPlatforms();
  }, [trackingRecords, influencers]);

  // Filter bills for this campaign once in memory using preferred order matching
  const campaignBills = useMemo(() => {
    return bills.filter(b => {
      return trackingRecords.some(r => {
        const note = b.notes?.toLowerCase() || '';
        const s3 = b.sub_category3?.toLowerCase() || '';
        const s2 = b.sub_category2?.toLowerCase() || '';

        // 1. Check influencer_id
        if (r.influencer_id) {
          const infIdPattern = new RegExp(`\\binfluencer_id:\\s*${r.influencer_id}\\b`, 'i');
          const simpleIdPattern = new RegExp(`\\binfluencer\\s+id:\\s*${r.influencer_id}\\b`, 'i');
          if (infIdPattern.test(note) || simpleIdPattern.test(note) || s3 === String(r.influencer_id)) {
            return true;
          }
        }

        // 2. Check dispatch_id
        if (r.dispatch_id) {
          const dispIdPattern = new RegExp(`\\bdispatch_id:\\s*${r.dispatch_id}\\b`, 'i');
          const simpleDispPattern = new RegExp(`\\bdispatch\\s+id:\\s*${r.dispatch_id}\\b`, 'i');
          if (dispIdPattern.test(note) || simpleDispPattern.test(note) || s3 === String(r.dispatch_id)) {
            return true;
          }
        }

        // 3. Check campaign_id + influencer_id
        if (r.campaign_id && r.influencer_id) {
          const campInfPattern = new RegExp(`\\bcampaign_id:\\s*${r.campaign_id}\\b.*\\binfluencer_id:\\s*${r.influencer_id}\\b`, 'i');
          if (campInfPattern.test(note)) {
            return true;
          }
        }

        // 4. Fallback: Username or Name matching
        const username = r.dispatch?.influencer_code?.toLowerCase();
        const name = r.dispatch?.influencer_name?.toLowerCase();

        if (username && (s3 === username || s2 === username || note.includes(username))) {
          return true;
        }
        if (name && (s3 === name || s2 === name || note.includes(name))) {
          return true;
        }

        return false;
      });
    });
  }, [bills, trackingRecords]);

  // Map tracking records to calendar events
  const events = useMemo(() => {
    const list: CalendarEvent[] = [];

    for (const r of trackingRecords) {
      const influencerName = r.dispatch?.influencer_name || 'Unknown';
      const influencerUsername = r.dispatch?.influencer_code || '';
      const campaignName = r.dispatch?.campaign_name || campaign.campaign_name;
      const avatarUrl = r.dispatch?.influencer_avatar || '';

      // 1. Delivered milestone — rely only on the explicit boolean field
      const isDeliveredCompleted = !!r.delivered_confirmed;
      if (isDeliveredCompleted) {
        const dDate = parseDateOnly(r.dispatch?.expected_delivery_date || r.dispatch?.dispatch_date);
        if (dDate) {
          list.push({
            id: `${r.id}-delivered`,
            recordId: r.id,
            type: 'Delivered',
            label: 'Delivered',
            icon: '📦',
            colorClass: 'bg-green-500/10 border border-green-500/30 text-green-400',
            dateStr: dDate,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r
          });
        }
      }

      let metadata: any = {};
      try {
        metadata = JSON.parse(r.notes || '{}');
      } catch (e) {
        metadata = {};
      }

      // 2. Draft 1 milestone
      const isDraft1Completed = !!r.draft_video_url;
      const draft1UploadedAt = metadata.draft1_uploaded_at || metadata.draft_uploaded_at;
      if (isDraft1Completed && draft1UploadedAt) {
        const drDate = parseDateOnly(draft1UploadedAt);
        if (drDate) {
          const d1Status = getMilestoneStatus(r.draft_expected_date, draft1UploadedAt, isDraft1Completed, todayStr);
          let d1Color = 'bg-purple-500/10 border border-purple-500/30 text-purple-400';
          if (d1Status.status === 'On Time') d1Color = 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
          else if (d1Status.status === 'Delayed') d1Color = 'bg-rose-500/10 border border-rose-500/30 text-rose-500';

          list.push({
            id: `${r.id}-draft1`,
            recordId: r.id,
            type: 'Draft',
            label: 'Draft 1 Completed',
            icon: '🎬',
            colorClass: d1Color,
            dateStr: drDate,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r
          });
        }
      }

      // 3. Draft 2 milestone
      const isDraft2Completed = !!r.re_draft_video_url;
      const draft2UploadedAt = metadata.draft2_uploaded_at;
      if (isDraft2Completed && draft2UploadedAt) {
        const dr2Date = parseDateOnly(draft2UploadedAt);
        if (dr2Date) {
          const d2Status = getMilestoneStatus(r.re_draft_expected_date, draft2UploadedAt, isDraft2Completed, todayStr);
          let d2Color = 'bg-purple-500/10 border border-purple-500/30 text-purple-400';
          if (d2Status.status === 'On Time') d2Color = 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
          else if (d2Status.status === 'Delayed') d2Color = 'bg-rose-500/10 border border-rose-500/30 text-rose-500';

          list.push({
            id: `${r.id}-draft2`,
            recordId: r.id,
            type: 'Draft',
            label: 'Draft 2 Completed',
            icon: '🎬',
            colorClass: d2Color,
            dateStr: dr2Date,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r
          });
        }
      }

      // 4. Video 1 Final Post milestone
      const totalVids = (r.pricing as any)?.total_videos || 1;
      const rawV1Link = metadata.video1_final_post_link || r.final_post_link;
      const isV1Completed = !!(metadata.video1_confirmed || r.final_post_completed) && 
                            !isFakeUrl(rawV1Link) && 
                            !!(metadata.video1_posted_at || r.final_post_actual_datetime);
      if (isV1Completed && (metadata.video1_posted_at || r.final_post_actual_datetime)) {
        const fpDate = parseDateOnly(metadata.video1_posted_at || r.final_post_actual_datetime);
        if (fpDate) {
          list.push({
            id: `${r.id}-video1-finalpost`,
            recordId: r.id,
            type: 'Final Post',
            label: totalVids === 2 ? 'Video 1 Final Post' : 'Final Post',
            icon: '🚀',
            colorClass: 'bg-blue-500/10 border border-blue-500/30 text-blue-400',
            dateStr: fpDate,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r
          });
        }
      }

      // 5. Video 2 Final Post milestone
      const isV2Completed = !!metadata.video2_confirmed && 
                            !isFakeUrl(metadata.video2_final_post_link) && 
                            !!metadata.video2_posted_at;
      if (totalVids === 2 && isV2Completed && metadata.video2_posted_at) {
        const fpDate = parseDateOnly(metadata.video2_posted_at);
        if (fpDate) {
          list.push({
            id: `${r.id}-video2-finalpost`,
            recordId: r.id,
            type: 'Final Post',
            label: 'Video 2 Final Post',
            icon: '🚀',
            colorClass: 'bg-blue-500/10 border border-blue-500/30 text-blue-400',
            dateStr: fpDate,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r
          });
        }
      }

      // 6. Payment milestone (directly from the bills module)
      const matchingBill = campaignBills.find(b => {
        const note = b.notes?.toLowerCase() || '';
        const s3 = b.sub_category3?.toLowerCase() || '';
        const s2 = b.sub_category2?.toLowerCase() || '';

        if (r.influencer_id) {
          const infIdPattern = new RegExp(`\\binfluencer_id:\\s*${r.influencer_id}\\b`, 'i');
          const simpleIdPattern = new RegExp(`\\binfluencer\\s+id:\\s*${r.influencer_id}\\b`, 'i');
          if (infIdPattern.test(note) || simpleIdPattern.test(note) || s3 === String(r.influencer_id)) {
            return true;
          }
        }
        if (r.dispatch_id) {
          const dispIdPattern = new RegExp(`\\bdispatch_id:\\s*${r.dispatch_id}\\b`, 'i');
          const simpleDispPattern = new RegExp(`\\bdispatch\\s+id:\\s*${r.dispatch_id}\\b`, 'i');
          if (dispIdPattern.test(note) || simpleDispPattern.test(note) || s3 === String(r.dispatch_id)) {
            return true;
          }
        }
        const username = r.dispatch?.influencer_code?.toLowerCase();
        const name = r.dispatch?.influencer_name?.toLowerCase();
        if (username && (s3 === username || s2 === username || note.includes(username))) return true;
        if (name && (s3 === name || s2 === name || note.includes(name))) return true;
        return false;
      });

      if (matchingBill && matchingBill.due_date) {
        const dueDate = parseDateOnly(matchingBill.due_date);
        if (dueDate) {
          const paidDate = getPaidDate(matchingBill);
          const status = matchingBill.bill_status || 'Pending';
          const pStatus = getMilestoneStatus(matchingBill.due_date, paidDate, status === 'Paid', todayStr, '✓ Paid On Time', 'Late by', 'Early');

          let payColor = 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400';
          if (status === 'Paid' && pStatus.status === 'On Time') {
            payColor = 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'; // Emerald Green
          } else if (pStatus.status === 'Delayed') {
            payColor = 'bg-red-950/20 border border-red-900/30 text-red-600'; // Dark Red
          }

          list.push({
            id: `${r.id}-payment`,
            recordId: r.id,
            type: 'Payment',
            label: `Payment Due: ₹${matchingBill.amount || 0}`,
            icon: '💰',
            colorClass: payColor,
            dateStr: dueDate,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r,
            bill: matchingBill
          });
        }
      }
    }

    // Add Post Date & Draft Date events for each influencer in this campaign
    for (const inf of influencers) {
      const influencerName = inf.influencer_name || inf.name || 'Unknown';
      const influencerUsername = inf.name || inf.code || '';
      const campaignName = campaign.campaign_name;
      const avatarUrl = inf.profile_file_url || '';
      const postDates = inf.postDates || [];

      // Find matching status tracking record if available
      const matchingRecord = trackingRecords.find(r => 
        String(r.influencer_id) === String(inf.id) ||
        (r.dispatch?.influencer_code && r.dispatch.influencer_code.toLowerCase() === influencerUsername.toLowerCase())
      ) || createFallbackRecord(inf, campaign);

      for (const pd of postDates) {
        const vNum = pd.video_number || 1;

        // 1. Draft Date Event (calculate if not stored)
        const drDate = pd.draft_date ? parseDateOnly(pd.draft_date, 2026) : (pd.post_date ? calculateDraftDate(pd.post_date, 2026) : '');
        if (drDate) {
          const exists = list.some(e => e.dateStr === drDate && e.type === 'Draft' && String(e.record?.influencer_id) === String(inf.id) && e.label.includes(`Video ${vNum}`));
          if (!exists) {
            list.push({
              id: `inf-${inf.id}-v${vNum}-draft`,
              recordId: String(inf.id),
              type: 'Draft',
              label: `Video ${vNum} Draft`,
              icon: '🎬',
              colorClass: 'bg-purple-500/10 border border-purple-500/30 text-purple-400',
              dateStr: drDate,
              influencerName,
              influencerUsername,
              campaignName,
              avatarUrl,
              record: matchingRecord,
              videoNumber: vNum,
              postDateStr: pd.post_date,
              draftDateStr: drDate
            });
          }
        }

        // 2. Final Post Event
        const fpDate = pd.post_date ? parseDateOnly(pd.post_date, 2026) : '';
        if (fpDate) {
          const exists = list.some(e => e.dateStr === fpDate && e.type === 'Final Post' && String(e.record?.influencer_id) === String(inf.id) && e.label.includes(`Video ${vNum}`));
          if (!exists) {
            list.push({
              id: `inf-${inf.id}-v${vNum}-finalpost`,
              recordId: String(inf.id),
              type: 'Final Post',
              label: `Video ${vNum} Final Post`,
              icon: '🚀',
              colorClass: 'bg-blue-500/10 border border-blue-500/30 text-blue-400',
              dateStr: fpDate,
              influencerName,
              influencerUsername,
              campaignName,
              avatarUrl,
              record: matchingRecord,
              videoNumber: vNum,
              postDateStr: pd.post_date,
              draftDateStr: drDate
            });
          }
        }
      }
    }

    return list;
  }, [trackingRecords, influencers, campaign, bills, todayStr]);

  // Calculate Today's Stats dynamically adapting to active filters
  const todaySummaryStats = useMemo(() => {
    let card1Title = "Today's Deliveries";
    let card2Title = "Today's Drafts";
    let card3Title = "Today's Final Posts";

    let card1Val = 0;
    let card2Val = 0;
    let card3Val = 0;

    let card1Type: CampaignFilterType = 'Delivered';
    let card2Type: CampaignFilterType = 'Draft';
    let card3Type: CampaignFilterType = 'Final Post';

    const todayEvents = events.filter(ev => ev.dateStr === todayStr);

    if (filterType.includes('Draft')) {
      card1Title = "Today's Drafts";
      card2Title = "Today's On Time Drafts";
      card3Title = "Today's Delayed Drafts";

      card1Type = 'Draft';
      card2Type = 'Draft On Time';
      card3Type = 'Draft Delayed';

      for (const ev of todayEvents) {
        if (ev.type === 'Draft') {
          card1Val++;
          const expected = ev.label.includes('Draft 2') ? ev.record.re_draft_expected_date : ev.record.draft_expected_date;
          if (expected && isDraftOnTime(expected, ev.dateStr)) card2Val++;
          if (expected && isDraftDelayed(expected, ev.dateStr, todayStr)) card3Val++;
        }
      }
    } else if (filterType.includes('Payment')) {
      card1Title = "Today's Payments";
      card2Title = "Today's On Time Payments";
      card3Title = "Today's Delayed Payments";

      card1Type = 'Payment';
      card2Type = 'Payment On Time';
      card3Type = 'Payment Delayed';

      for (const ev of todayEvents) {
        if (ev.type === 'Payment') {
          card1Val++;
          const bill = (ev as any).bill;
          if (bill?.due_date) {
            const paidDate = getPaidDate(bill);
            if (isPaymentOnTime(bill.due_date, paidDate)) card2Val++;
            if (isPaymentDelayed(bill.due_date, paidDate, bill.bill_status, todayStr)) card3Val++;
          }
        }
      }
    } else {
      // Default view
      for (const ev of todayEvents) {
        if (ev.type === 'Delivered') card1Val++;
        else if (ev.type === 'Draft') card2Val++;
        else if (ev.type === 'Final Post') card3Val++;
      }
    }

    return {
      card1Title, card2Title, card3Title,
      card1Val, card2Val, card3Val,
      card1Type, card2Type, card3Type
    };
  }, [events, filterType, todayStr]);

  // Filtered Events (Month View)
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      // Influencer search (name or username)
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = ev.influencerName.toLowerCase().includes(q);
        const matchesUser = ev.influencerUsername.toLowerCase().includes(q);
        if (!matchesName && !matchesUser) return false;
      }

      // Filter Type logic
      if (filterType === 'All') return true;
      if (filterType === 'Delivered') return ev.type === 'Delivered';
      
      if (filterType === 'Draft') return ev.type === 'Draft';
      if (filterType === 'Draft On Time') {
        if (ev.type !== 'Draft') return false;
        const expected = ev.label.includes('Draft 2') ? ev.record.re_draft_expected_date : ev.record.draft_expected_date;
        return expected ? isDraftOnTime(expected, ev.dateStr) : false;
      }
      if (filterType === 'Draft Delayed') {
        if (ev.type !== 'Draft') return false;
        const expected = ev.label.includes('Draft 2') ? ev.record.re_draft_expected_date : ev.record.draft_expected_date;
        return expected ? isDraftDelayed(expected, ev.dateStr, todayStr) : false;
      }

      if (filterType === 'Payment') return ev.type === 'Payment';
      if (filterType === 'Payment On Time') {
        if (ev.type !== 'Payment') return false;
        const bill = (ev as any).bill;
        return bill?.due_date ? isPaymentOnTime(bill.due_date, getPaidDate(bill)) : false;
      }
      if (filterType === 'Payment Delayed') {
        if (ev.type !== 'Payment') return false;
        const bill = (ev as any).bill;
        return bill?.due_date ? isPaymentDelayed(bill.due_date, getPaidDate(bill), bill.bill_status, todayStr) : false;
      }

      if (filterType === 'Final Post') return ev.type === 'Final Post';

      return true;
    });
  }, [events, filterType, searchQuery, todayStr]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setMonthChangeTrigger(t => t + 1);
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setMonthChangeTrigger(t => t + 1);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setMonthChangeTrigger(t => t + 1);
  };

  const handleClearFilters = () => {
    setFilterType('All');
    setSearchQuery('');
  };

  // Generate Month Grid Days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const totalDaysPrev = new Date(year, month, 0).getDate();

    const grid = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, totalDaysPrev - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      grid.push({ date: d, isCurrentMonth: false, dateStr });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      grid.push({ date: d, isCurrentMonth: true, dateStr });
    }

    // Next month padding
    const remaining = grid.length % 7;
    if (remaining > 0) {
      const padding = 7 - remaining;
      for (let i = 1; i <= padding; i++) {
        const d = new Date(year, month + 1, i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        grid.push({ date: d, isCurrentMonth: false, dateStr });
      }
    }

    return grid;
  }, [year, month]);

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of filteredEvents) {
      if (!map[ev.dateStr]) map[ev.dateStr] = [];
      map[ev.dateStr].push(ev);
    }
    return map;
  }, [filteredEvents]);

  // Click on a date opens Day Details page view
  const selectedDateEvents = useMemo(() => {
    if (!selectedDateStr) return [];
    return filteredEvents.filter(ev => ev.dateStr === selectedDateStr);
  }, [selectedDateStr, filteredEvents]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateStr) return '';
    const parts = selectedDateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDateStr]);

  const handleToggleTodayFilter = (type: CampaignFilterType) => {
    if (filterType === type) {
      setFilterType('All');
    } else {
      setFilterType(type);
    }
  };

  const handleViewStatus = (dispatchId: string) => {
    (window as any).activeTrackingScrollTarget = dispatchId;
    onNavigateToStatusTracking();
  };

  // Day Details filter states
  const [daySearchQuery, setDaySearchQuery] = useState('');
  const [dayCampaignSearch, setDayCampaignSearch] = useState('');
  const [dayFilterType, setDayFilterType] = useState<'All' | 'Delivered' | 'Draft' | 'Final Post' | 'Pending'>('All');
  const [dayPlatformFilter, setDayPlatformFilter] = useState<'All' | 'Instagram' | 'YouTube' | 'Facebook'>('All');
  const [dayMilestoneFilter, setDayMilestoneFilter] = useState<'All' | 'Delivered' | 'Draft1' | 'Draft2' | 'FinalVideo'>('All');
  const [daySortBy, setDaySortBy] = useState<'DeliveryDate' | 'Draft1Date' | 'Draft2Date' | 'FinalPostDate' | 'InfluencerName'>('DeliveryDate');

  // Filtered Day Details events list
  const filteredDayEvents = useMemo(() => {
    return selectedDateEvents.filter(ev => {
      const r = ev.record;
      const influencerName = r.dispatch?.influencer_name || 'Unknown';
      const influencerUsername = r.dispatch?.influencer_code || '';
      const campaignName = r.dispatch?.campaign_name || campaign.campaign_name;

      // Search influencer
      if (daySearchQuery) {
        const q = daySearchQuery.toLowerCase().trim();
        const matchesName = influencerName.toLowerCase().includes(q);
        const matchesUser = influencerUsername.toLowerCase().includes(q);
        if (!matchesName && !matchesUser) return false;
      }

      // Search campaign
      if (dayCampaignSearch) {
        const q = dayCampaignSearch.toLowerCase().trim();
        if (!campaignName.toLowerCase().includes(q)) return false;
      }

      // Event Type / Pending filter
      if (dayFilterType !== 'All') {
        if (dayFilterType === 'Pending') {
          if (r.final_post_completed) return false;
        } else {
          if (ev.type !== dayFilterType) return false;
        }
      }

      // Platform filter
      if (dayPlatformFilter !== 'All') {
        const plats = influencerPlatforms[r.influencer_id] || [];
        const matchesPlat = plats.some(p => p.toLowerCase() === dayPlatformFilter.toLowerCase());
        if (!matchesPlat) return false;
      }

      // Milestone Filter (Day Schedule Event List only)
      if (dayMilestoneFilter !== 'All') {
        if (dayMilestoneFilter === 'Delivered') {
          const isCompleted = !!r.delivered_confirmed;
          if (!isCompleted) return false;
        } else if (dayMilestoneFilter === 'Draft1') {
          const isCompleted = !!r.draft_video_url;
          if (!isCompleted) return false;
        } else if (dayMilestoneFilter === 'Draft2') {
          const isCompleted = !!r.re_draft_video_url;
          if (!isCompleted) return false;
        } else if (dayMilestoneFilter === 'FinalVideo') {
          if (!r.final_post_completed) return false;
        }
      }

      return true;
    });
  }, [selectedDateEvents, daySearchQuery, dayCampaignSearch, dayFilterType, dayPlatformFilter, dayMilestoneFilter, influencerPlatforms, campaign]);

  // Sorted Day Details events list
  const sortedDayEvents = useMemo(() => {
    const list = [...filteredDayEvents];
    list.sort((a, b) => {
      const rA = a.record;
      const rB = b.record;

      if (daySortBy === 'InfluencerName') {
        const nameA = (rA.dispatch?.influencer_name || '').toLowerCase();
        const nameB = (rB.dispatch?.influencer_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }

      let dateA = '';
      let dateB = '';

      if (daySortBy === 'DeliveryDate') {
        dateA = rA.dispatch?.expected_delivery_date || rA.dispatch?.dispatch_date || '';
        dateB = rB.dispatch?.expected_delivery_date || rB.dispatch?.dispatch_date || '';
      } else if (daySortBy === 'Draft1Date') {
        dateA = rA.draft_expected_date || '';
        dateB = rB.draft_expected_date || '';
      } else if (daySortBy === 'Draft2Date') {
        dateA = rA.re_draft_expected_date || '';
        dateB = rB.re_draft_expected_date || '';
      } else if (daySortBy === 'FinalPostDate') {
        dateA = rA.final_post_actual_datetime || '';
        dateB = rB.final_post_actual_datetime || '';
      }

      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB);
    });
    return list;
  }, [filteredDayEvents, daySortBy]);



  // RENDER DETAILED DAY SCHEDULE VIEW
  if (selectedDateStr) {
    return (
      <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden flex flex-col min-h-[850px] animate-fade-in text-slate-200">
        
        {/* Day Schedule Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-700 bg-slate-800/50 gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedDateStr(null);
                setDaySearchQuery('');
                setDayCampaignSearch('');
                setDayFilterType('All');
                setDayPlatformFilter('All');
                setDayMilestoneFilter('All');
                setDaySortBy('DeliveryDate');
              }}
              className="p-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Back to Month View"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                📅 {selectedDateLabel} Schedule
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Visual planner details and workflow stages for this day.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onBack} 
              className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm cursor-pointer"
            >
              Back to Overview
            </button>
          </div>
        </div>

        {/* Day Schedule Content Area */}
        <div className="flex-1 p-4 space-y-4 flex flex-col min-h-0 bg-slate-900/40">
          


          {/* Filtering controls inside Day view */}
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/80 shrink-0 flex flex-wrap items-center justify-between gap-4">
            
            {/* Event Type & Pending filters (tabs) */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 custom-scrollbar flex-nowrap font-sans">
              {['All', 'Delivered', 'Draft', 'Final Post', 'Pending'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDayFilterType(tab as any)}
                  className={`py-1 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    dayFilterType === tab
                      ? 'text-white bg-slate-700/85 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>



          </div>

          {/* Schedule Event List Cards */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 min-h-[500px]">
            {(() => {
              const seen = new Set<string>();
              const uniqueEvents: typeof sortedDayEvents = [];
              for (const ev of sortedDayEvents) {
                const infId = ev.record.influencer_id;
                if (!seen.has(infId)) {
                  seen.add(infId);
                  uniqueEvents.push(ev);
                }
              }

              if (uniqueEvents.length === 0) {
                return (
                  <div className="bg-slate-900/30 border border-slate-800 border-dashed p-10 rounded-2xl text-center text-slate-500 italic text-xs select-none">
                    No milestone events match the selected filter criteria.
                  </div>
                );
              }

              return uniqueEvents.map((ev) => {
                const r = ev.record;
                const influencerName = r.dispatch?.influencer_name || 'Unknown';
                const influencerUsername = r.dispatch?.influencer_code || '';
                const avatarUrl = r.dispatch?.influencer_avatar || '';
                const phone = r.dispatch?.phone_number || '';
                const courier = r.dispatch?.courier_partner || 'N/A';
                const trackingId = r.dispatch?.tracking_id || 'N/A';
                
                const plats = influencerPlatforms[r.influencer_id] || [];
                
                // Milestone completion states
                let metadata: any = {};
                try {
                  metadata = JSON.parse(r.notes || '{}');
                } catch (e) {}
                  const isDelivered = !!r.delivered_confirmed;
                  const isDraft1 = !!r.draft_video_url;
                  const isDraft2 = !!r.re_draft_video_url;
                  const draft1UploadedAt = metadata.draft1_uploaded_at || metadata.draft_uploaded_at;
                  const draft2UploadedAt = metadata.draft2_uploaded_at;

                  const totalVideos = (r.pricing as any)?.total_videos || 1;
                  const rawV1Link = metadata.video1_final_post_link || r.final_post_link;
                  const isVideo1FinalPostCompleted = !!(metadata.video1_confirmed || r.final_post_completed) && 
                                                     !isFakeUrl(rawV1Link) && 
                                                     !!(metadata.video1_posted_at || r.final_post_actual_datetime);
                  
                  const isVideo2FinalPostCompleted = !!metadata.video2_confirmed && 
                                                     !isFakeUrl(metadata.video2_final_post_link) && 
                                                     !!metadata.video2_posted_at;

                  const isFinalPost = totalVideos === 2 
                    ? (isVideo1FinalPostCompleted && isVideo2FinalPostCompleted)
                    : isVideo1FinalPostCompleted;

                  const formatCalendarUploadDate = (tsStr: string) => {
                    if (!tsStr) return '';
                    try {
                      const d = new Date(tsStr);
                      const day = d.getDate();
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const month = monthNames[d.getMonth()];
                      const year = d.getFullYear();
                      const hours = String(d.getHours()).padStart(2, '0');
                      const minutes = String(d.getMinutes()).padStart(2, '0');
                      return `${day} ${month} ${year} ${hours}:${minutes}`;
                    } catch (e) {
                      return '';
                    }
                  };

                  const formatCalendarUploadDateCompact = (tsStr: string) => {
                    if (!tsStr) return '';
                    try {
                      const d = new Date(tsStr);
                      const day = d.getDate();
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const month = monthNames[d.getMonth()];
                      return `${day} ${month}`;
                    } catch (e) {
                      return '';
                    }
                  };

                  const renderDeliverySection = () => {
                    const formattedDate = r.dispatch?.expected_delivery_date || r.dispatch?.dispatch_date
                      ? formatTimelineDate(r.dispatch?.expected_delivery_date || r.dispatch?.dispatch_date, true)
                      : '';
                    return (
                      <div className="bg-[#151923]/60 border border-slate-800/85 rounded-xl p-2.5 flex flex-col justify-between select-none shadow-sm h-[75px] min-w-0">
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">
                          <span>📦</span> DELIVERY
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className={`text-[10px] font-extrabold flex items-center gap-1 leading-none ${isDelivered ? 'text-green-400' : 'text-slate-500'}`}>
                            {isDelivered ? '✓ Completed' : 'Pending'}
                          </span>
                          {formattedDate && (
                            <span className="text-[9px] text-slate-500 font-bold font-mono leading-none mt-1 truncate">{formattedDate}</span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const renderDraftsSection = () => {
                    const d1Status = getMilestoneStatus(r.draft_expected_date, draft1UploadedAt, isDraft1, todayStr);
                    const d2Status = getMilestoneStatus(r.re_draft_expected_date, draft2UploadedAt, isDraft2, todayStr);

                    const getStatusColor = (statusVal: 'Pending' | 'On Time' | 'Delayed') => {
                      if (statusVal === 'On Time') return 'text-green-400';
                      if (statusVal === 'Delayed') return 'text-red-400';
                      return 'text-slate-500';
                    };

                    return (
                      <div className="bg-[#151923]/60 border border-slate-800/85 rounded-xl p-2.5 flex flex-col justify-between select-none shadow-sm h-[75px] min-w-0">
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">
                          <span>🎬</span> DRAFTS
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <div className="flex items-center justify-between text-[10px] leading-none">
                            <span className="text-slate-400 font-medium">Draft 1</span>
                            <span className={`font-black truncate max-w-[80px] ${getStatusColor(d1Status.status)}`} title={d1Status.badgeText}>
                              {d1Status.badgeText}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] leading-none">
                            <span className="text-slate-400 font-medium">Draft 2</span>
                            <span className={`font-black truncate max-w-[80px] ${getStatusColor(d2Status.status)}`} title={d2Status.badgeText}>
                              {d2Status.badgeText}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  const renderPaymentSection = () => {
                    const matchingBill = campaignBills.find(b => {
                      const note = b.notes?.toLowerCase() || '';
                      const s3 = b.sub_category3?.toLowerCase() || '';
                      const s2 = b.sub_category2?.toLowerCase() || '';

                      if (r.influencer_id) {
                        const infIdPattern = new RegExp(`\\binfluencer_id:\\s*${r.influencer_id}\\b`, 'i');
                        const simpleIdPattern = new RegExp(`\\binfluencer\\s+id:\\s*${r.influencer_id}\\b`, 'i');
                        if (infIdPattern.test(note) || simpleIdPattern.test(note) || s3 === String(r.influencer_id)) {
                          return true;
                        }
                      }
                      if (r.dispatch_id) {
                        const dispIdPattern = new RegExp(`\\bdispatch_id:\\s*${r.dispatch_id}\\b`, 'i');
                        const simpleDispPattern = new RegExp(`\\bdispatch\\s+id:\\s*${r.dispatch_id}\\b`, 'i');
                        if (dispIdPattern.test(note) || simpleDispPattern.test(note) || s3 === String(r.dispatch_id)) {
                          return true;
                        }
                      }
                      const username = r.dispatch?.influencer_code?.toLowerCase();
                      const name = r.dispatch?.influencer_name?.toLowerCase();
                      if (username && (s3 === username || s2 === username || note.includes(username))) return true;
                      if (name && (s3 === name || s2 === name || note.includes(name))) return true;
                      return false;
                    });

                    const dueDate = matchingBill?.due_date;
                    const status = matchingBill?.bill_status || 'Pending';
                    const paidDate = getPaidDate(matchingBill);

                    const isPaid = status === 'Paid';
                    const pStatus = getMilestoneStatus(dueDate, paidDate, isPaid, todayStr, '✓ Paid On Time', 'Late by', 'Early');

                    const getStatusColor = (statusVal: 'Pending' | 'On Time' | 'Delayed') => {
                      if (isPaid && statusVal === 'On Time') return 'text-green-400';
                      if (statusVal === 'Delayed') return 'text-red-400';
                      return 'text-slate-500';
                    };

                    return (
                      <div className="bg-[#151923]/60 border border-slate-800/85 rounded-xl p-2.5 flex flex-col justify-between select-none shadow-sm h-[75px] min-w-0">
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">
                          <span>💰</span> PAYMENT
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className={`text-[10px] font-extrabold flex items-center gap-1 leading-none ${getStatusColor(pStatus.status)}`} title={pStatus.badgeText}>
                            {pStatus.badgeText}
                          </span>
                          {dueDate && (
                            <span className="text-[9px] text-slate-500 font-bold font-mono leading-none mt-1 truncate">
                              Due: {formatTimelineDate(dueDate, true)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const renderFinalPostsSection = () => {
                    const v1DateCompact = metadata.video1_posted_at ? formatCalendarUploadDateCompact(metadata.video1_posted_at) : '';
                    const v2DateCompact = metadata.video2_posted_at ? formatCalendarUploadDateCompact(metadata.video2_posted_at) : '';
                    return (
                      <div className="bg-[#151923]/60 border border-slate-800/85 rounded-xl p-2.5 flex flex-col justify-between select-none shadow-sm h-[75px] min-w-0">
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">
                          <span>🚀</span> FINAL POSTS
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <div className="flex items-center justify-between text-[10px] leading-none">
                            <span className="text-slate-400 font-medium">Video 1</span>
                            <span className={`font-black ${isVideo1FinalPostCompleted ? 'text-green-400' : 'text-slate-500'}`}>
                              {isVideo1FinalPostCompleted ? `✓ ${v1DateCompact}` : 'Pending'}
                            </span>
                          </div>
                          {totalVideos === 2 ? (
                            <div className="flex items-center justify-between text-[10px] leading-none">
                              <span className="text-slate-400 font-medium">Video 2</span>
                              <span className={`font-black ${isVideo2FinalPostCompleted ? 'text-green-400' : 'text-slate-500'}`}>
                                {isVideo2FinalPostCompleted ? `✓ ${v2DateCompact}` : 'Pending'}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[9px] text-slate-500 italic leading-none truncate">1 Video Campaign</div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div 
                      key={`${r.campaign_id || campaign.id}-${r.influencer_id}`}
                    className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-slate-700/80 hover:bg-slate-800/10 hover:scale-[1.001] transition-all duration-200 shadow-md hover:shadow-lg grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 items-center"
                  >
                    
                    {/* Influencer Profile Column */}
                    <div className="col-span-1 md:col-span-3 lg:col-span-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-slate-950 flex items-center justify-center shadow-inner">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-500 font-bold text-sm">{influencerName.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <h4 className="font-extrabold text-slate-100 truncate text-sm leading-snug">{influencerName}</h4>
                        <div className="flex items-center gap-2">
                          {influencerUsername && (
                            <p className="text-[10px] text-slate-400 font-mono truncate">@{influencerUsername}</p>
                          )}
                          {phone && (
                            <p className="text-[9px] text-slate-500 font-mono truncate">{phone}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-1 select-none">
                          {plats.map(p => (
                            <span key={p} className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 text-[8px] font-bold text-slate-400 uppercase">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                     {/* Product Column */}
                    <div className="col-span-1 md:col-span-3 lg:col-span-1 space-y-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block select-none">Dispatched</span>
                      <div className="font-bold text-slate-200 flex items-center gap-1 leading-none text-[11px]">
                        <span>📦</span> <span className="truncate max-w-[100px]">{r.dispatch?.product_name || 'N/A'}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 flex flex-col gap-0.5 font-medium leading-none">
                        <span>Qty: <strong className="text-slate-400">{r.dispatch?.total_products !== undefined ? r.dispatch.total_products : 'N/A'}</strong></span>
                        <span>Courier: <strong className="text-slate-450 truncate block max-w-[80px]">{courier}</strong></span>
                        {trackingId !== 'N/A' && (
                          <span className="truncate">AWB: <strong className="text-slate-400 font-mono">{trackingId}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Milestone Timeline Columns */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-2">
                      {renderDeliverySection()}
                    </div>
                    <div className="col-span-1 md:col-span-2 lg:col-span-2">
                      {renderDraftsSection()}
                    </div>
                    <div className="col-span-1 md:col-span-2 lg:col-span-2">
                      {renderPaymentSection()}
                    </div>
                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                      {renderFinalPostsSection()}
                    </div>

                    {/* Workflow Step & Actions Column */}
                    <div className="col-span-1 md:col-span-6 lg:col-span-1 flex lg:flex-col items-center lg:items-center justify-between lg:justify-center gap-3 border-t lg:border-t-0 lg:border-l border-slate-800/60 pt-3 lg:pt-0 lg:pl-3">
                      <div className="flex flex-col lg:items-center gap-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block select-none">Step</span>
                        {getWorkflowStepBadge(r)}
                      </div>

                      <button
                        onClick={() => handleViewStatus(r.dispatch_id)}
                        title="Open Status Tracking"
                        className="p-2 bg-purple-650 bg-purple-600/10 hover:bg-purple-600 text-purple-450 text-purple-400 hover:text-white rounded-lg border border-purple-500/20 hover:border-purple-500 transition-all cursor-pointer shadow-sm flex items-center justify-center shrink-0"
                      >
                        <Eye size={14} />
                      </button>
                    </div>

                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  }

  // RENDER MONTHLY CALENDAR GRID VIEW
  const TABS = ['All', 'Delivered', 'Draft', 'Draft On Time', 'Draft Delayed', 'Payment', 'Payment On Time', 'Payment Delayed', 'Final Post'] as const;

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden flex flex-col min-h-[850px] relative text-slate-200 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 gap-4 shrink-0">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Calendar size={20} className="text-purple-400" />
          Campaign Planner Calendar: {campaign.campaign_name}
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={refresh} 
            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors cursor-pointer" 
            title="Refresh Status Tracking Data"
          >
            <Loader2 size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={onBack} 
            className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm cursor-pointer"
          >
            Back to Overview
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-6 space-y-6 flex flex-col min-h-0 bg-slate-900/40">
        
        {/* Today's Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          
          <div 
            onClick={() => handleToggleTodayFilter(todaySummaryStats.card1Type)}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-lg ${
              filterType === todaySummaryStats.card1Type 
                ? 'bg-green-500/10 border-green-500/40 shadow-green-500/5' 
                : 'bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">
                <Package size={20} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{todaySummaryStats.card1Title}</h4>
                <p className="text-xl font-bold text-slate-200 mt-0.5">{todaySummaryStats.card1Val}</p>
              </div>
            </div>
            {filterType === todaySummaryStats.card1Type && (
              <span className="text-[10px] bg-green-500/20 text-green-400 py-0.5 px-2 rounded-full font-bold">Filtered</span>
            )}
          </div>

          <div 
            onClick={() => handleToggleTodayFilter(todaySummaryStats.card2Type)}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-lg ${
              filterType === todaySummaryStats.card2Type 
                ? 'bg-purple-500/10 border-purple-500/40 shadow-purple-500/5' 
                : 'bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                <Video size={20} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{todaySummaryStats.card2Title}</h4>
                <p className="text-xl font-bold text-slate-200 mt-0.5">{todaySummaryStats.card2Val}</p>
              </div>
            </div>
            {filterType === todaySummaryStats.card2Type && (
              <span className="text-[10px] bg-purple-500/20 text-purple-400 py-0.5 px-2 rounded-full font-bold">Filtered</span>
            )}
          </div>

          <div 
            onClick={() => handleToggleTodayFilter(todaySummaryStats.card3Type)}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-lg ${
              filterType === todaySummaryStats.card3Type 
                ? 'bg-red-500/10 border-red-500/40 shadow-red-500/5' 
                : 'bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                <Send size={20} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{todaySummaryStats.card3Title}</h4>
                <p className="text-xl font-bold text-slate-200 mt-0.5">{todaySummaryStats.card3Val}</p>
              </div>
            </div>
            {filterType === todaySummaryStats.card3Type && (
              <span className="text-[10px] bg-red-500/20 text-red-400 py-0.5 px-2 rounded-full font-bold">Filtered</span>
            )}
          </div>

        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-700 shrink-0">
          
          {/* Tab Filter Type */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 lg:pb-0 custom-scrollbar flex-nowrap">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`py-1.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  filterType === tab
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search boxes */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Influencer search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Influencer..."
                className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs text-slate-200 focus:outline-none focus:border-primary w-48 placeholder:text-slate-600 shadow-sm"
              />
              <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
            </div>

            {(filterType !== 'All' || searchQuery) && (
              <button
                onClick={handleClearFilters}
                className="h-9 px-3 border border-slate-700 hover:border-slate-600 hover:bg-slate-800/30 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>

        </div>

        {/* Monthly Calendar View */}
        <div className="flex-1 bg-slate-950/40 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          
          {/* Calendar month selector header */}
          <div className="flex justify-between items-center p-4 bg-slate-800/60 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => {
                  setCurrentDate(new Date(year, parseInt(e.target.value), 1));
                  setMonthChangeTrigger(t => t + 1);
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-100 cursor-pointer focus:outline-none focus:border-slate-500 shadow-sm appearance-none pr-7"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                  <option key={m} value={i} className="bg-slate-900 text-slate-200">{m}</option>
                ))}
              </select>
              <span className="text-base font-bold text-slate-100 select-none">{currentDate.getFullYear()}</span>
            </div>

            <button
              onClick={handleToday}
              className="h-8 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Grid Layout (7 headers + month days) */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            {/* Headers row */}
            <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-800/30 shrink-0 select-none">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
                <div key={w} className="py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {w}
                </div>
              ))}
            </div>

            {/* Days Grid Container */}
            <div 
              key={monthChangeTrigger}
              className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-950/20 divide-x divide-y divide-slate-800/60 animate-fade-in"
            >
              {daysGrid.map((day, idx) => {
                const dayEvents = eventsByDate[day.dateStr] || [];
                const isToday = day.dateStr === todayStr;
                
                const MAX_VISIBLE_EVENTS = 2;
                const hasMoreEvents = dayEvents.length > MAX_VISIBLE_EVENTS;
                const visibleEvents = hasMoreEvents ? dayEvents.slice(0, MAX_VISIBLE_EVENTS) : dayEvents;
                const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;

                // Construct tooltip details
                const tooltipText = (() => {
                  if (dayEvents.length === 0) return '';
                  const lines = dayEvents.map(ev => `${ev.campaignName} - ${ev.type} - ${ev.influencerName}`);
                  const dateStrFormatted = day.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                  return `${dateStrFormatted}\n${lines.join('\n')}`;
                })();

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        setSelectedDateStr(day.dateStr);
                      }
                    }}
                    title={tooltipText}
                    className={`p-2.5 flex flex-col justify-between min-h-[118px] h-full overflow-hidden transition-all relative select-none ${
                      day.isCurrentMonth ? 'bg-transparent text-slate-200' : 'bg-slate-900/30 text-slate-600'
                    } ${dayEvents.length > 0 ? 'cursor-pointer hover:bg-slate-800/30' : ''}`}
                  >
                    
                    {/* Top Row: Date Value */}
                    <div className="flex justify-between items-center mb-1.5 shrink-0">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                          {day.date.getDate()}
                        </span>
                      ) : (
                        <span className={`text-xs font-bold ${
                          day.isCurrentMonth ? 'text-slate-100' : 'text-slate-600 font-medium'
                        }`}>
                          {day.date.getDate()}
                        </span>
                      )}
                    </div>

                    {/* Events List inside Cell (No Inner Scrollbars) */}
                    <div className="flex-1 space-y-1.5 overflow-hidden">
                      {visibleEvents.map((ev) => {
                        const rawUsername = ev.influencerUsername || ev.influencerName || 'Inf';
                        const formattedUsername = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;

                        let badgeStyle = 'bg-[#3b154c]/70 text-purple-200 border-purple-500/30 hover:bg-[#3b154c]';
                        let dotStyle = 'bg-purple-400';
                        if (ev.type === 'Final Post') {
                          badgeStyle = 'bg-[#152e54]/70 text-blue-200 border-blue-500/30 hover:bg-[#152e54]';
                          dotStyle = 'bg-blue-400';
                        } else if (ev.type === 'Delivered') {
                          badgeStyle = 'bg-emerald-950/60 text-emerald-200 border-emerald-500/30 hover:bg-emerald-900/70';
                          dotStyle = 'bg-emerald-400';
                        } else if (ev.type === 'Payment') {
                          badgeStyle = 'bg-amber-950/60 text-amber-200 border-amber-500/30 hover:bg-amber-900/70';
                          dotStyle = 'bg-amber-400';
                        }

                        return (
                          <div
                            key={ev.id}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border truncate leading-tight select-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${badgeStyle}`}
                            title={`${ev.influencerName} (@${ev.influencerUsername}): ${ev.label} (${ev.dateStr})`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotStyle}`} />
                            <span className="truncate">{formattedUsername}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overflow link (+N more) */}
                    {hasMoreEvents && (
                      <div className="mt-1 shrink-0 pt-0.5">
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDateStr(day.dateStr);
                          }}
                          className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          +{overflowCount} more
                        </span>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Legend & Footer Bar */}
            <div className="p-3.5 bg-slate-900/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 select-none shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="font-medium text-slate-300">Draft</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="font-medium text-slate-300">Final Post</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-300">Delivered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-medium text-slate-300">Payment</span>
                </div>
              </div>
              <div className="text-slate-500 text-[11px]">
                Showing all influencer activities for {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month]} {year}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
