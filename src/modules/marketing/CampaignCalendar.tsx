import React, { useState, useMemo, useEffect } from 'react';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import type { Campaign } from '../../types';
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
  type: 'Delivered' | 'Draft' | 'Final Post';
  label: string;
  icon: string;
  colorClass: string;
  dateStr: string;
  influencerName: string;
  influencerUsername: string;
  campaignName: string;
  avatarUrl: string;
  record: StatusTrackingRecord;
}



const isFakeUrl = (url: string | undefined | null) => {
  if (!url) return true;
  const clean = url.trim().toLowerCase();
  return clean === '' || 
         clean === 'default' || 
         clean === 'default2' || 
         clean.includes('instagram.com/p/default') || 
         clean.includes('instagram.com/p/default2');
};

const parseDateOnly = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
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

export const CampaignCalendar: React.FC<CampaignCalendarProps> = ({ 
  campaign, 
  onBack, 
  onNavigateToStatusTracking 
}) => {
  const { trackingRecords, isLoading, refresh } = useCampaignStatusTracking(campaign.id);
  
  // Date state for month selector
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [monthChangeTrigger, setMonthChangeTrigger] = useState(0); // Trigger anim

  // Filters state (Month View)
  const [filterType, setFilterType] = useState<'All' | 'Delivered' | 'Draft' | 'Final Post'>('All');
  const [searchQuery, setSearchQuery] = useState('');

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
      const influencerIds = [...new Set(trackingRecords.map(r => r.influencer_id).filter(Boolean))];
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
  }, [trackingRecords]);

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
          list.push({
            id: `${r.id}-draft1`,
            recordId: r.id,
            type: 'Draft',
            label: 'Draft 1 Completed',
            icon: '🎬',
            colorClass: 'bg-purple-500/10 border border-purple-500/30 text-purple-400',
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
          list.push({
            id: `${r.id}-draft2`,
            recordId: r.id,
            type: 'Draft',
            label: 'Draft 2 Completed',
            icon: '🎬',
            colorClass: 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400',
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
      const totalVids = r.pricing?.total_videos || 1;
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
            colorClass: 'bg-red-500/10 border border-red-500/30 text-red-400',
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
            colorClass: 'bg-red-500/10 border border-red-500/30 text-red-400',
            dateStr: fpDate,
            influencerName,
            influencerUsername,
            campaignName,
            avatarUrl,
            record: r
          });
        }
      }
    }

    return list;
  }, [trackingRecords, campaign]);

  // Calculate Today's Stats
  const todayStats = useMemo(() => {
    const stats = { deliveries: 0, drafts: 0, finalPosts: 0 };
    for (const ev of events) {
      if (ev.dateStr === todayStr) {
        if (ev.type === 'Delivered') stats.deliveries++;
        else if (ev.type === 'Draft') stats.drafts++;
        else if (ev.type === 'Final Post') stats.finalPosts++;
      }
    }
    return stats;
  }, [events, todayStr]);

  // Filtered Events (Month View)
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      // Type filter
      if (filterType !== 'All' && ev.type !== filterType) return false;

      // Influencer search (name or username)
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = ev.influencerName.toLowerCase().includes(q);
        const matchesUser = ev.influencerUsername.toLowerCase().includes(q);
        if (!matchesName && !matchesUser) return false;
      }

      return true;
    });
  }, [events, filterType, searchQuery]);

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
    // Always show all milestone events of the day in details page
    return events.filter(ev => ev.dateStr === selectedDateStr);
  }, [selectedDateStr, events]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateStr) return '';
    const parts = selectedDateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDateStr]);

  const handleToggleTodayFilter = (type: 'Delivered' | 'Draft' | 'Final Post') => {
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

                  const totalVideos = r.pricing?.total_videos || 1;
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
                    const d1DateCompact = draft1UploadedAt ? formatCalendarUploadDateCompact(draft1UploadedAt) : '';
                    const d2DateCompact = draft2UploadedAt ? formatCalendarUploadDateCompact(draft2UploadedAt) : '';
                    return (
                      <div className="bg-[#151923]/60 border border-slate-800/85 rounded-xl p-2.5 flex flex-col justify-between select-none shadow-sm h-[75px] min-w-0">
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">
                          <span>🎬</span> DRAFTS
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <div className="flex items-center justify-between text-[10px] leading-none">
                            <span className="text-slate-400 font-medium">Draft 1</span>
                            <span className={`font-black ${isDraft1 ? 'text-green-400' : 'text-slate-500'}`}>
                              {isDraft1 ? `✓ ${d1DateCompact}` : 'Pending'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] leading-none">
                            <span className="text-slate-400 font-medium">Draft 2</span>
                            <span className={`font-black ${isDraft2 ? 'text-green-400' : 'text-slate-500'}`}>
                              {isDraft2 ? `✓ ${d2DateCompact}` : 'Pending'}
                            </span>
                          </div>
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
                    <div className="col-span-1 md:col-span-3 lg:col-span-2 space-y-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block select-none">Dispatched</span>
                      <div className="font-bold text-slate-200 flex items-center gap-1 leading-none text-[11px]">
                        <span>📦</span> <span className="truncate max-w-[130px]">{r.dispatch?.product_name || 'N/A'}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 flex flex-col gap-0.5 font-medium leading-none">
                        <span>Qty: <strong className="text-slate-400">{r.dispatch?.total_products !== undefined ? r.dispatch.total_products : 'N/A'}</strong></span>
                        <span>Courier: <strong className="text-slate-450 truncate block max-w-[100px]">{courier}</strong></span>
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
  const TABS = ['All', 'Delivered', 'Draft', 'Final Post'] as const;

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
            onClick={() => handleToggleTodayFilter('Delivered')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-lg ${
              filterType === 'Delivered' 
                ? 'bg-green-500/10 border-green-500/40 shadow-green-500/5' 
                : 'bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">
                <Package size={20} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Deliveries</h4>
                <p className="text-xl font-bold text-slate-200 mt-0.5">{todayStats.deliveries}</p>
              </div>
            </div>
            {filterType === 'Delivered' && (
              <span className="text-[10px] bg-green-500/20 text-green-400 py-0.5 px-2 rounded-full font-bold">Filtered</span>
            )}
          </div>

          <div 
            onClick={() => handleToggleTodayFilter('Draft')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-lg ${
              filterType === 'Draft' 
                ? 'bg-purple-500/10 border-purple-500/40 shadow-purple-500/5' 
                : 'bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                <Video size={20} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Drafts</h4>
                <p className="text-xl font-bold text-slate-200 mt-0.5">{todayStats.drafts}</p>
              </div>
            </div>
            {filterType === 'Draft' && (
              <span className="text-[10px] bg-purple-500/20 text-purple-400 py-0.5 px-2 rounded-full font-bold">Filtered</span>
            )}
          </div>

          <div 
            onClick={() => handleToggleTodayFilter('Final Post')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-lg ${
              filterType === 'Final Post' 
                ? 'bg-red-500/10 border-red-500/40 shadow-red-500/5' 
                : 'bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                <Send size={20} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Final Posts</h4>
                <p className="text-xl font-bold text-slate-200 mt-0.5">{todayStats.finalPosts}</p>
              </div>
            </div>
            {filterType === 'Final Post' && (
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
                
                // Group milestones for indicators
                const hasDelivered = dayEvents.some(ev => ev.type === 'Delivered');
                const hasDraft = dayEvents.some(ev => ev.type === 'Draft');
                const hasFinal = dayEvents.some(ev => ev.type === 'Final Post');

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
                    className={`p-2.5 flex flex-col justify-between min-h-[90px] transition-all relative select-none ${
                      day.isCurrentMonth ? 'bg-transparent text-slate-200' : 'bg-slate-900/20 text-slate-600'
                    } ${dayEvents.length > 0 ? 'cursor-pointer hover:bg-slate-800/20' : ''}`}
                  >
                    
                    {/* Top Row: Date value */}
                    <div className="flex justify-between items-start">
                      <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        isToday 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black' 
                          : 'text-slate-400'
                      }`}>
                        {day.date.getDate()}
                      </span>
                    </div>

                    {/* Milestone indicators (Apple Calendar dots style) */}
                    <div className="flex flex-col items-center justify-end flex-grow pb-1 space-y-1">
                      {dayEvents.length > 0 && (
                        <div className="flex items-center gap-1.5 justify-center py-1 px-1.5 bg-slate-900/30 rounded-lg border border-slate-800/50">
                          {hasDelivered && (
                            <span 
                              className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" 
                              title="Delivered"
                            />
                          )}
                          {hasDraft && (
                            <span 
                              className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.6)]" 
                              title="Draft Submission"
                            />
                          )}
                          {hasFinal && (
                            <span 
                              className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" 
                              title="Final Post"
                            />
                          )}
                        </div>
                      )}
                      
                      {/* Event Count Badges */}
                      {dayEvents.length > 3 ? (
                        <span className="text-[9px] font-black text-slate-500 font-mono mt-0.5">
                          +{dayEvents.length - 3}
                        </span>
                      ) : dayEvents.length > 0 ? (
                        <span className="text-[9px] font-black text-slate-600 font-mono mt-0.5">
                          {dayEvents.length} Event{dayEvents.length > 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
