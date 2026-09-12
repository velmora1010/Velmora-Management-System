import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign } from '../../types';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import { 
  Clock, Package, Phone, FileText, CreditCard, Video, CheckCircle2, Check, 
  XCircle, PauseCircle, Users, Target, Search, Trash2, MoreHorizontal, 
  ArrowUpDown, RefreshCcw, X, UploadCloud, IndianRupee, Eye, Copy
} from 'lucide-react';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { isActiveStatus } from '../../utils/marketingUtils';
import { naturalCompareCodes } from '../../services/influencerStatusHandoffService';
import toast from 'react-hot-toast';

interface CampaignStatusTrackingProps {
  campaign: Campaign;
  onBack: () => void;
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

const formatForDateTimeInput = (dateStr: string | undefined | null) => {
  if (!dateStr) return '';
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

// 6 Horizontal Workflow Steps matching reference image
const WORKFLOW_STEPS = [
  { id: 'delivered', label: 'Delivery Confirmation', icon: Package, formKey: 'delivered' },
  { id: 'callExplain', label: 'Call & Explain', icon: Phone, formKey: 'callExplain' },
  { id: 'shareScript', label: 'Share Script', icon: FileText, formKey: 'shareScript' },
  { id: 'payAdvance', label: 'Pay Advance', icon: IndianRupee, formKey: 'payAdvance' },
  { id: 'expTimeline', label: 'Time Line', icon: Clock, formKey: 'expTimeline' },
  { id: 'draft', label: 'Draft', icon: Video, formKey: 'draft' }
];

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

  // Derive Step Data for any record
  const getRecordStepData = (record: StatusTrackingRecord) => {
    let metadata: any = {};
    try {
      metadata = JSON.parse(record.notes || '{}');
    } catch (e) {
      metadata = {};
    }

    const isDelivered = !!record.delivered_confirmed;
    const isCallExplained = isDelivered && (!!metadata.call_explained || (!!record.ref_call_explanation_required && !metadata.call_explanation_pending) || ((record.current_step || 0) >= 2 && !metadata.call_explanation_pending));
    const isScriptShared = isDelivered && (!!metadata.script_shared || !!record.reference_video_received || !!record.ref_script || ((record.current_step || 0) >= 3));
    const isAdvancePaid = isDelivered && (!!record.pay_advance_completed || (parseFloat(record.advance_paid_amount || '0') > 0));
    const isTimelineSet = isDelivered && (!!record.expected_delivery_completed || (!!record.draft_expected_date && !!record.draft_expected_time));
    const isDraftDone = isDelivered && (!!record.draft_received || !!record.draft_video_url || (record.draft_approval_status === 'Approved'));

    const stepsCompleted = [
      isDelivered,
      isCallExplained,
      isScriptShared,
      isAdvancePaid,
      isTimelineSet,
      isDraftDone
    ];

    let activeIndex = stepsCompleted.findIndex(completed => !completed);
    if (activeIndex === -1) activeIndex = 6;

    return {
      metadata,
      stepsCompleted,
      activeIndex,
      isDelivered,
      isCallExplained,
      isScriptShared,
      isAdvancePaid,
      isTimelineSet,
      isDraftDone
    };
  };

  // Derive Overall Status Badge
  const getOverallStatus = (record: StatusTrackingRecord, stepData: ReturnType<typeof getRecordStepData>) => {
    const { metadata, stepsCompleted, isDelivered } = stepData;
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

    // Not Started: if Step 1 (delivery) is not confirmed yet
    if (!isDelivered) {
      return {
        key: 'NOT_STARTED',
        label: 'Not Started',
        badgeClass: 'bg-slate-900 text-slate-400 border-slate-800',
        dotClass: 'bg-slate-500'
      };
    }

    const completedCount = stepsCompleted.filter(Boolean).length;

    // Completed
    if (stepsCompleted[5] || completedCount === 6) {
      return {
        key: 'COMPLETED',
        label: 'Completed',
        badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
        dotClass: 'bg-emerald-400'
      };
    }

    // Almost Done
    if (stepsCompleted[4]) {
      return {
        key: 'ALMOST_DONE',
        label: 'Almost Done',
        badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
        dotClass: 'bg-purple-400'
      };
    }

    // Pending
    if (record.draft_approval_status === 'Not Approved' || metadata.is_pending || rawStatus === 'pending') {
      return {
        key: 'PENDING',
        label: 'Pending',
        badgeClass: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
        dotClass: 'bg-amber-400'
      };
    }

    // In Progress
    return {
      key: 'IN_PROGRESS',
      label: 'In Progress',
      badgeClass: 'bg-blue-950/80 text-blue-400 border-blue-700/60',
      dotClass: 'bg-blue-400'
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
      const stepData = getRecordStepData(r);
      const status = getOverallStatus(r, stepData);
      if (status.key === 'COMPLETED') completed++;
      else if (status.key === 'IN_PROGRESS' || status.key === 'ALMOST_DONE') inProgress++;
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
      const stepData = getRecordStepData(record);
      const overallStatus = getOverallStatus(record, stepData);

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'IN_PROGRESS') {
          if (overallStatus.key !== 'IN_PROGRESS' && overallStatus.key !== 'ALMOST_DONE') return false;
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

  // Milestone Save Handler
  const handleFormSave = async (recordId: string, data: any) => {
    const record = activeTrackingRecords.find(r => r.id === recordId) || trackingRecords.find(r => r.id === recordId);
    if (!record) return;

    const updates = { ...data };

    let metadata: any = {};
    try {
      metadata = JSON.parse(record.notes || '{}');
    } catch (e) {
      metadata = {};
    }

    if (updates.notes) {
      try {
        const newMeta = JSON.parse(updates.notes);
        metadata = { ...metadata, ...newMeta };
      } catch (e) {}
    }

    if (activeModal?.stageId === 'delivered') {
      updates.delivered_confirmed = true;
    } else if (activeModal?.stageId === 'callExplain') {
      metadata.call_explained = true;
      metadata.call_explanation_pending = false;
      updates.ref_call_explanation_required = true;
    } else if (activeModal?.stageId === 'shareScript') {
      metadata.script_shared = true;
      updates.reference_video_received = true;
    } else if (activeModal?.stageId === 'payAdvance') {
      updates.pay_advance_completed = true;
    } else if (activeModal?.stageId === 'expTimeline') {
      updates.expected_delivery_completed = true;
    } else if (activeModal?.stageId === 'draft') {
      updates.draft_received = true;
    } else if (activeModal?.stageId === 'payRemaining') {
      updates.payment_remaining_completed = true;
    } else if (activeModal?.stageId === 'finalPost') {
      updates.final_post_completed = true;
    }

    metadata.last_updated = new Date().toISOString();
    updates.notes = JSON.stringify(metadata);

    const result = await saveMilestone(recordId, updates);
    if (result.success) {
      toast.success('Step saved successfully.');
      await refresh();
      setActiveModal(null);
    } else {
      toast.error('Failed to save: ' + (result.error?.message || 'Unknown error'));
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

  const toggleModal = (recordId: string, stageId: string) => {
    setActiveModal({ recordId, stageId });
    setOpenMenuId(null);
  };

  // Last Updated timestamp formatted
  const lastUpdatedStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, []);

  return (
    <div className="bg-[#070c18] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[calc(100vh-120px)] min-h-[750px] shadow-2xl p-5 gap-4">
      
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
            placeholder="Search influencer name, phone, or order ID..."
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
            <option value="PENDING">Pending</option>
            <option value="ALMOST_DONE">Almost Done</option>
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
            <CheckCircle2 size={18} />
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

            const stepData = getRecordStepData(record);
            const overallStatus = getOverallStatus(record, stepData);
            const isMenuOpen = openMenuId === record.id;

            return (
              <div 
                key={record.id}
                id={`st-card-${record.dispatch_id || record.id}`}
                className="bg-[#0b1329] hover:bg-[#0e1733] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4"
              >
                {/* LEFT SECTION: Compact Code Badge, Profile, Name, Username */}
                <div className="flex items-center gap-3 shrink-0">
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
                    <h4 className="text-white font-bold text-sm sm:text-base leading-tight truncate max-w-[190px]" title={influencerName}>
                      {influencerName}
                    </h4>
                    <p className="text-slate-400 text-xs font-medium mt-0.5 truncate max-w-[190px]" title={username}>
                      {username}
                    </p>
                  </div>
                </div>

                {/* CENTER SECTION: 6-Step Horizontal Connected Workflow */}
                <div className="flex-1 px-2 py-1 max-w-2xl mx-auto w-full">
                  <div className="flex items-center justify-between w-full">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const hasStarted = stepData.isDelivered;
                      const isCompleted = stepData.stepsCompleted[idx];
                      const isCurrent = hasStarted && !isCompleted && idx === stepData.activeIndex;

                      // Connecting line state
                      const nextStepCompleted = idx < WORKFLOW_STEPS.length - 1 && stepData.stepsCompleted[idx + 1];
                      const isLineCompleted = isCompleted && (nextStepCompleted || (hasStarted && idx + 1 === stepData.activeIndex));

                      // Node visuals
                      let circleStyle = "bg-[#151f32] text-slate-400 border border-slate-700/80 hover:border-slate-500 hover:text-slate-200";
                      let labelStyle = "text-slate-400";
                      let NodeIcon = step.icon;

                      if (isCompleted) {
                        circleStyle = "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-400 hover:scale-110";
                        labelStyle = "text-emerald-400 font-semibold";
                      } else if (isCurrent) {
                        circleStyle = "bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.7)] ring-4 ring-blue-500/30 border border-blue-400 hover:scale-110";
                        labelStyle = "text-blue-400 font-bold";
                      }

                      return (
                        <React.Fragment key={step.id}>
                          {/* Node & Label */}
                          <div 
                            className="flex flex-col items-center cursor-pointer group relative select-none"
                            onClick={() => toggleModal(record.id, step.id)}
                            title={`Click to manage: ${step.label}`}
                          >
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${circleStyle}`}>
                              {isCompleted ? (
                                <Check size={18} strokeWidth={3} className="text-white" />
                              ) : isCurrent ? (
                                <NodeIcon size={18} className="text-white" />
                              ) : (
                                <span className="font-bold text-xs sm:text-sm text-slate-400">{idx + 1}</span>
                              )}
                            </div>
                            <span className={`text-[10px] sm:text-[11px] text-center w-20 sm:w-24 leading-tight mt-1.5 transition-colors ${labelStyle}`}>
                              {step.label}
                            </span>
                          </div>

                          {/* Connecting Line */}
                          {idx !== WORKFLOW_STEPS.length - 1 && (
                            <div className="flex-1 h-[2px] mx-1 sm:mx-2 -mt-4 transition-colors duration-300">
                              <div className={`h-full w-full rounded-full ${isLineCompleted ? 'bg-emerald-500' : 'bg-slate-700/60'}`} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT SECTION: Overall Status & Three-Dot Menu */}
                <div className="flex items-center gap-3 shrink-0 justify-end">
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
                          onClick={() => toggleModal(record.id, 'payRemaining')}
                          className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                        >
                          <CreditCard size={14} className="text-emerald-400" />
                          <span>Remaining Payment</span>
                        </button>
                        <button 
                          onClick={() => toggleModal(record.id, 'finalPost')}
                          className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white flex items-center gap-2 transition-colors"
                        >
                          <CheckCircle2 size={14} className="text-purple-400" />
                          <span>Final Post Date</span>
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

      {/* ========================================================
          ACTIVE MODAL FORM (Step Modals & Three-Dot Modals)
      ======================================================== */}
      {activeModal && (() => {
        const targetRecord = activeTrackingRecords.find(r => r.id === activeModal.recordId) || trackingRecords.find(r => r.id === activeModal.recordId);
        if (!targetRecord) return null;

        const stageId = activeModal.stageId;
        const matchingStep = WORKFLOW_STEPS.find(s => s.id === stageId);
        const modalTitle = matchingStep?.label || (stageId === 'payRemaining' ? 'Pay Remaining Payment' : stageId === 'finalPost' ? 'Final Post Date' : 'Milestone Form');
        const ModalIcon = matchingStep?.icon || (stageId === 'payRemaining' ? CreditCard : CheckCircle2);

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full ${stageId === 'finalPost' ? 'max-w-4xl' : 'max-w-2xl'} shadow-2xl overflow-hidden animate-fade-in relative`}>
              
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#070c18]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <ModalIcon size={18} />
                  </div>
                  <div>
                    <h5 className="text-base sm:text-lg font-bold text-white leading-none">{modalTitle}</h5>
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

              {/* Modal Body */}
              <div className="p-6 max-h-[calc(85vh-120px)] overflow-y-auto">
                {stageId === 'delivered' && (
                  <DeliveredForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} />
                )}
                {stageId === 'callExplain' && (
                  <CallExplainForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} />
                )}
                {stageId === 'shareScript' && (
                  <ShareScriptForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} />
                )}
                {stageId === 'payAdvance' && (
                  <PayAdvanceForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} />
                )}
                {stageId === 'expTimeline' && (
                  <ExpectedTimelineForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} isRework={false} />
                )}
                {stageId === 'draft' && (
                  <DraftForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} isRework={false} />
                )}
                {stageId === 'payRemaining' && (
                  <PayRemainingForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} />
                )}
                {stageId === 'finalPost' && (
                  <FinalPostForm record={targetRecord} onSave={(data: any) => handleFormSave(targetRecord.id, data)} />
                )}
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
// SUB-FORM COMPONENTS (Maintained & Enhanced for all 6 Steps + 3-Dot Modals)
// =========================================================================

// --- STEP 1: Delivery Confirmation ---
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
      delivered_confirmed: confirmed, 
      current_step: confirmed ? Math.max(record.current_step || 0, 1) : (record.current_step || 0) 
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

// --- STEP 2: Call & Explain ---
const CallExplainForm = ({ record, onSave }: any) => {
  let metadata: any = {};
  try {
    metadata = JSON.parse(record.notes || '{}');
  } catch (e) {
    metadata = {};
  }

  const [callExplained, setCallExplained] = useState(
    metadata.call_explained !== undefined ? metadata.call_explained : (record.ref_call_explanation_required || false)
  );
  const [callNotes, setCallNotes] = useState(metadata.call_notes || '');
  const [callDatetime, setCallDatetime] = useState(
    metadata.call_datetime ? formatForDateTimeInput(metadata.call_datetime) : ''
  );
  const [phoneCalled, setPhoneCalled] = useState(
    metadata.phone_called || record.dispatch?.phone_number || ''
  );

  const handleSave = async () => {
    const updatedMetadata = {
      ...metadata,
      call_explained: callExplained,
      call_notes: callNotes,
      call_datetime: callDatetime ? new Date(callDatetime).toISOString() : new Date().toISOString(),
      phone_called: phoneCalled,
      call_explanation_pending: !callExplained
    };

    await onSave({
      ref_call_explanation_required: callExplained,
      notes: JSON.stringify(updatedMetadata)
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

// --- STEP 3: Share Script ---
const ShareScriptForm = ({ record, onSave }: any) => {
  let metadata: any = {};
  try {
    metadata = JSON.parse(record.notes || '{}');
  } catch (e) {
    metadata = {};
  }

  const [concept, setConcept] = useState(record.ref_concept || metadata.concept || '');
  const [script, setScript] = useState(record.ref_script || metadata.script || '');
  const [keypoints, setKeypoints] = useState(record.ref_keypoints || metadata.keypoints || '');
  const [offer, setOffer] = useState(record.ref_offer || metadata.offer || '');
  const [link, setLink] = useState(record.ref_link || metadata.link || '');
  const [vids, setVids] = useState<string[]>(record.reference_videos_list?.length ? record.reference_videos_list : ['']);
  const [scriptShared, setScriptShared] = useState(
    metadata.script_shared !== undefined ? metadata.script_shared : (!!record.reference_video_received || !!record.ref_script)
  );

  const handleSave = async () => {
    const validVids = vids.filter(Boolean);
    const updatedMetadata = {
      ...metadata,
      script_shared: scriptShared,
      concept,
      script,
      keypoints,
      offer,
      link
    };

    await onSave({ 
      ref_concept: concept || '', 
      ref_script: script || '', 
      ref_keypoints: keypoints || '', 
      ref_offer: offer || '', 
      ref_link: link || '', 
      reference_videos_list: validVids,
      reference_video_received: scriptShared,
      notes: JSON.stringify(updatedMetadata)
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

// --- STEP 4: Pay Advance ---
const PayAdvanceForm = ({ record, onSave }: any) => {
  const [gpay, setGpay] = useState(record.advance_gpay_number || '');
  const [total, setTotal] = useState(record.advance_total_amount || record.pricing?.final_price || '');
  const [advance, setAdvance] = useState(record.advance_paid_amount || '');
  
  const [photo, setPhoto] = useState(record.pay_advance_photo_url || '');
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
      advance_gpay_number: gpay, 
      advance_total_amount: total, 
      advance_paid_amount: advance, 
      pay_advance_photo_url: finalUrl,
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

// --- STEP 5: Time Line ---
const ExpectedTimelineForm = ({ record, onSave, isRework }: any) => {
  const dateKey = isRework ? 're_draft_expected_date' : 'draft_expected_date';
  const timeKey = isRework ? 're_draft_expected_time' : 'draft_expected_time';
  const [date, setDate] = useState(record[dateKey] || '');
  const [time, setTime] = useState(record[timeKey] || '');

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Expected Draft Delivery Date</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Expected Time</label>
          <input 
            type="time" 
            value={time} 
            onChange={e => setTime(e.target.value)} 
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
          />
        </div>
      </div>
      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={() => {
            if (!date || !time) {
              toast.error('Please select both date and time.');
              return;
            }
            onSave({ [dateKey]: date, [timeKey]: time, expected_delivery_completed: true });
          }} 
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          Save Timeline
        </button>
      </div>
    </div>
  );
};

// --- STEP 6: Draft ---
const DraftForm = ({ record, onSave, isRework }: any) => {
  const vUrl = isRework ? 're_draft_video_url' : 'draft_video_url';
  const status = isRework ? 're_draft_approval_status' : 'draft_approval_status';
  const timing = isRework ? 're_draft_timing_status' : 'draft_timing_status';
  const corrections = isRework ? 're_draft_corrections_required' : 'draft_corrections_required';
  const fLink = isRework ? 're_draft_final_product_link' : 'draft_final_product_link';
  const fDesc = isRework ? 're_draft_final_description' : 'draft_final_description';

  const expDate = isRework ? record.re_draft_expected_date : record.draft_expected_date;
  const expTime = isRework ? record.re_draft_expected_time : record.draft_expected_time;

  const metaFileNameKey = isRework ? 'draft2_filename' : 'draft1_filename';
  const metaUploadedAtKey = isRework ? 'draft2_uploaded_at' : 'draft1_uploaded_at';

  let metadata: any = {};
  try {
    metadata = JSON.parse(record.notes || '{}');
  } catch (e) {
    metadata = {};
  }

  const initialFileName = isRework
    ? (metadata.draft2_filename || '')
    : (metadata.draft1_filename || metadata.draft_file_name || '');
  const initialUploadedAt = isRework
    ? (metadata.draft2_uploaded_at || '')
    : (metadata.draft1_uploaded_at || metadata.draft_uploaded_at || '');

  const [vid, setVid] = useState(record[vUrl] || '');
  const [fileName, setFileName] = useState(initialFileName);
  const [uploadedAt, setUploadedAt] = useState(initialUploadedAt);
  const [appStat, setAppStat] = useState(record[status] || '');
  const [corr, setCorr] = useState(record[corrections] || '');
  const [finalL, setFinalL] = useState(record[fLink] || '');
  const [finalD, setFinalD] = useState(record[fDesc] || '');
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [calculatedTiming, setCalculatedTiming] = useState(record[timing] || 'Not Submit');

  useEffect(() => {
    if (!vid && !file) {
      setCalculatedTiming('Not Submit');
    } else {
      if (record[timing] && !file) {
        setCalculatedTiming(record[timing]);
      } else {
        if (expDate && expTime) {
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
    }
  }, [vid, file, expDate, expTime, record, timing]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setVid(URL.createObjectURL(selectedFile));
      setFileName(selectedFile.name);
      setUploadedAt(new Date().toISOString());
    }
  };

  const handleSave = async () => {
    if (appStat === 'Not Approved' && (!corr || corr.trim() === '')) {
      toast.error('Please enter correction instructions before rejecting a draft.');
      return;
    }
    if (!file && !vid) {
      toast.error('Please upload a draft video first.');
      return;
    }

    setIsUploading(true);
    let finalUrl = vid;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const generatedFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `drafts/${generatedFileName}`;

        const { error } = await supabaseAdmin.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabaseAdmin.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setVid(finalUrl);
      } catch (err) {
        console.error('Error uploading draft video:', err);
        setIsUploading(false);
        return;
      }
    }

    const isStepCompleted = !!finalUrl;
    const nowStr = new Date().toISOString();
    const currentUploadedAt = file ? nowStr : (uploadedAt || (finalUrl ? nowStr : ''));
    const currentFileName = file ? file.name : (fileName || (finalUrl ? 'uploaded_video.mp4' : ''));

    const updatedMetadata = {
      ...metadata,
      [metaFileNameKey]: currentFileName,
      [metaUploadedAtKey]: currentUploadedAt,
    };

    if (isRework) {
      updatedMetadata.draft2_received = isStepCompleted;
      updatedMetadata.draft2_completed = isStepCompleted;
      updatedMetadata.draft2_status = isStepCompleted ? 'COMPLETED' : 'CURRENT';
    } else {
      updatedMetadata.draft1_received = isStepCompleted;
      updatedMetadata.draft1_completed = isStepCompleted;
      updatedMetadata.draft1_status = isStepCompleted ? 'COMPLETED' : 'CURRENT';
      updatedMetadata.draft_file_name = currentFileName;
      updatedMetadata.draft_uploaded_at = currentUploadedAt;
    }

    const data: any = { 
      [vUrl]: finalUrl, 
      [status]: appStat, 
      [timing]: calculatedTiming, 
      [corrections]: corr, 
      [fLink]: finalL, 
      [fDesc]: finalD,
      notes: JSON.stringify(updatedMetadata)
    };

    if (!isRework) {
      data.draft_received = isStepCompleted;
      if (isStepCompleted) {
        data.current_step = Math.max(record.current_step || 0, 5);
      }
    } else {
      if (isStepCompleted) {
        data.current_step = Math.max(record.current_step || 0, 6);
      }
    }
    
    if (appStat === 'Not Approved' && !isRework) {
      data['re_draft_expected_date'] = record.re_draft_expected_date || '';
    } else if (appStat === 'Approved' && !isRework) {
      data['re_draft_expected_date'] = null;
      data['re_draft_expected_time'] = null;
      data['re_draft_video_url'] = null;
      data['re_draft_approval_status'] = null;
      data['re_draft_timing_status'] = null;
      data['re_draft_corrections_required'] = null;
      data['re_draft_final_product_link'] = null;
      data['re_draft_final_description'] = null;
    }

    await onSave(data);
    setIsUploading(false);
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 space-y-6">
      
      {/* Upload Section */}
      <div className="flex flex-col sm:flex-row justify-center gap-6">
        <div className="relative w-full sm:w-44 h-32 border-2 border-dashed border-blue-500/40 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
          <UploadCloud className="text-blue-400 mb-1" size={24} />
          <span className="text-xs text-blue-300 font-medium">Upload Draft Video</span>
          <input 
            type="file" 
            accept="video/*,image/*" 
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          />
        </div>
        <div className="flex-1 min-h-32 border border-slate-800 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center p-3">
          {vid ? (
            <div className="w-full flex flex-col items-center gap-2">
              {(vid.startsWith('blob:') || vid.includes('.mp4') || vid.includes('.webm') || vid.includes('video') || vid.includes('drafts')) ? (
                <video src={vid} controls className="w-full max-h-28 object-contain rounded bg-black" />
              ) : (
                <div className="text-xs text-slate-400 italic">Preview available</div>
              )}
              {fileName && (
                <span className="text-[11px] text-slate-300 font-semibold truncate w-full text-center" title={fileName}>
                  {fileName}
                </span>
              )}
            </div>
          ) : (
             <span className="text-xs text-slate-500 font-medium">No Draft Video Selected</span>
          )}
        </div>
      </div>

      {/* Approval & Timing Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-y border-slate-800 py-6">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Approval Status</label>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setAppStat('Approved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${appStat === 'Approved' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[#0b1329] text-slate-400 border-slate-800 hover:border-slate-600'}`}
            >
              Approved
            </button>
            <button 
              onClick={() => setAppStat('Not Approved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${appStat === 'Not Approved' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-[#0b1329] text-slate-400 border-slate-800 hover:border-slate-600'}`}
            >
              Not Approved
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Timing Status</label>
          <div className="grid grid-cols-2 gap-2">
            {['Advance', 'On Time', 'Late', 'Not Submit'].map((ts) => (
              <div key={ts} className={`flex items-center gap-2 p-2 rounded-lg border ${calculatedTiming === ts ? 'bg-blue-600/10 border-blue-500/50' : 'bg-[#0b1329] border-slate-800'}`}>
                <input type="checkbox" checked={calculatedTiming === ts} readOnly className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0" />
                <span className={`text-xs ${calculatedTiming === ts ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>{ts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {appStat === 'Not Approved' && (
        <div className="animate-fade-in">
          <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Correction Instructions</label>
          <textarea 
            value={corr} 
            onChange={e => setCorr(e.target.value)} 
            placeholder="Enter required changes, retakes, or missing guidelines..."
            className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[90px]" 
          />
        </div>
      )}

      {appStat === 'Approved' && (
        <div className="animate-fade-in space-y-4">
          <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Deliverable Info</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Final Product Link</label>
              <input 
                type="text" 
                value={finalL} 
                onChange={e => setFinalL(e.target.value)} 
                placeholder="Product link in video"
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Final Description</label>
              <input 
                type="text" 
                value={finalD} 
                onChange={e => setFinalD(e.target.value)} 
                placeholder="Caption / description text"
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
        >
          {isUploading ? 'Saving...' : 'Save Draft Details'}
        </button>
      </div>
    </div>
  );
};

// --- REMAINING PAYMENT (Three-dot menu) ---
const PayRemainingForm = ({ record, onSave }: any) => {
  const totalAmount = record.pricing?.final_price || 0;
  const advancePaid = parseFloat(record.advance_paid_amount || '0');
  const remainingPayment = totalAmount - advancePaid;

  const [photo, setPhoto] = useState(record.payment_remaining_photo_url || '');
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
      payment_remaining_photo_url: finalUrl || '',
      payment_remaining_completed: true 
    });
    setIsUploading(false);
  };

  return (
    <div className="bg-[#070c18] border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Total Agreed Amount</label>
            <input type="text" value={`₹${Number(totalAmount).toFixed(2)}`} readOnly className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white opacity-80 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Advance Paid</label>
            <input type="text" value={`₹${Number(advancePaid).toFixed(2)}`} readOnly className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white opacity-80 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Remaining Payment Due</label>
            <input type="text" value={`₹${Number(remainingPayment).toFixed(2)}`} readOnly className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-emerald-400 font-black cursor-not-allowed" />
          </div>
          
          <div className="pt-2">
            <div className="relative w-full h-24 border-2 border-dashed border-slate-700/80 rounded-xl bg-[#0b1329] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors">
              <UploadCloud className="text-emerald-400 mb-1" size={20} />
              <span className="text-xs text-emerald-300 font-medium">Upload Final Payment Proof</span>
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
                <img src={preview} alt="Proof Preview" className="max-w-full max-h-full object-contain rounded-lg" />
              </div>
              <span className="text-xs text-slate-400">Payment Proof Preview</span>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center w-full h-52 bg-[#0b1329] rounded-xl border border-slate-800/60 p-4 opacity-50">
               <UploadCloud className="text-slate-500 mb-2" size={28} />
               <span className="text-xs text-slate-400">No proof uploaded</span>
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
          {isUploading ? 'Saving...' : 'Save Payment Details'}
        </button>
      </div>
    </div>
  );
};

// --- FINAL POST DATE (Three-dot menu) ---
const FinalPostForm = ({ record, onSave }: any) => {
  let metadata: any = {};
  try {
    metadata = JSON.parse(record.notes || '{}');
  } catch (e) {
    metadata = {};
  }

  const rawV1Link = metadata.video1_final_post_link || record.final_post_link || '';
  const initialV1Link = isFakeUrl(rawV1Link) ? '' : rawV1Link;
  const initialV1PostedAt = formatForDateTimeInput(metadata.video1_posted_at || record.final_post_actual_datetime);
  const initialV1Platform = metadata.video1_platform || 'Instagram';
  const initialV1Confirmed = metadata.video1_confirmed !== undefined && !isFakeUrl(rawV1Link)
    ? metadata.video1_confirmed 
    : (!isFakeUrl(rawV1Link) ? (record.final_post_completed || false) : false);

  const rawV2Link = metadata.video2_final_post_link || '';
  const initialV2Link = isFakeUrl(rawV2Link) ? '' : rawV2Link;
  const initialV2PostedAt = formatForDateTimeInput(metadata.video2_posted_at);
  const initialV2Platform = metadata.video2_platform || 'Instagram';
  const initialV2Confirmed = metadata.video2_confirmed !== undefined && !isFakeUrl(rawV2Link) ? metadata.video2_confirmed : false;

  const [v1Link, setV1Link] = useState(initialV1Link);
  const [v1PostedAt, setV1PostedAt] = useState(initialV1PostedAt);
  const [v1Platform, setV1Platform] = useState(initialV1Platform);
  const [v1Confirmed, setV1Confirmed] = useState(initialV1Confirmed);

  const [v2Link, setV2Link] = useState(initialV2Link);
  const [v2PostedAt, setV2PostedAt] = useState(initialV2PostedAt);
  const [v2Platform, setV2Platform] = useState(initialV2Platform);
  const [v2Confirmed, setV2Confirmed] = useState(initialV2Confirmed);

  const totalVideos = record.pricing?.total_videos || 1;

  const handleSaveVideo1 = async () => {
    if (!v1Link || isFakeUrl(v1Link) || !v1PostedAt) {
      toast.error('Please fill in both the Video 1 Post Link and Posting Date & Time.');
      return;
    }
    if (!v1Confirmed) {
      toast.error('Please check the Confirmed Live checkbox for Video 1.');
      return;
    }

    const updatedMetadata = {
      ...metadata,
      video1_final_post_link: v1Link,
      video1_posted_at: v1PostedAt,
      video1_platform: v1Platform,
      video1_confirmed: v1Confirmed,
    };

    await onSave({
      final_post_link: v1Link,
      final_post_actual_datetime: v1PostedAt,
      final_post_completed: true,
      notes: JSON.stringify(updatedMetadata)
    });
  };

  const handleSaveVideo2 = async () => {
    if (!v2Link || isFakeUrl(v2Link) || !v2PostedAt) {
      toast.error('Please fill in both the Video 2 Post Link and Posting Date & Time.');
      return;
    }
    if (!v2Confirmed) {
      toast.error('Please check the Confirmed Live checkbox for Video 2.');
      return;
    }

    const updatedMetadata = {
      ...metadata,
      video2_final_post_link: v2Link,
      video2_posted_at: v2PostedAt,
      video2_platform: v2Platform,
      video2_confirmed: v2Confirmed,
    };

    await onSave({
      final_post_completed: true,
      notes: JSON.stringify(updatedMetadata)
    });
  };

  const platforms = ['Instagram', 'YouTube', 'Facebook'];

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 ${totalVideos === 2 ? 'md:grid-cols-2' : ''} gap-6`}>
        {/* VIDEO 1 */}
        <div className="bg-[#070c18] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <h4 className="text-sm font-black text-white uppercase">Video 1 Final Post</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v1Confirmed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-900 text-slate-400'}`}>
              {v1Confirmed ? 'LIVE' : 'PENDING'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Platform</label>
              <div className="flex gap-2">
                {platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => setV1Platform(p)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors ${v1Platform === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0b1329] border-slate-800 text-slate-400'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Final Post Link</label>
              <input 
                type="text" 
                value={v1Link} 
                onChange={e => setV1Link(e.target.value)} 
                placeholder="https://..."
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Posting Date/Time</label>
              <input 
                type="datetime-local" 
                value={v1PostedAt} 
                onChange={e => setV1PostedAt(e.target.value)} 
                className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" 
              />
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input 
                type="checkbox" 
                checked={v1Confirmed} 
                onChange={e => setV1Confirmed(e.target.checked)} 
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500" 
              />
              <span className="text-xs font-medium text-slate-300">Confirmed Live on platform</span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button 
              onClick={handleSaveVideo1}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-600/10"
            >
              Save Video 1
            </button>
          </div>
        </div>

        {/* VIDEO 2 (if 2 videos required) */}
        {totalVideos === 2 && (
          <div className="bg-[#070c18] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h4 className="text-sm font-black text-white uppercase">Video 2 Final Post</h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v2Confirmed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-900 text-slate-400'}`}>
                {v2Confirmed ? 'LIVE' : 'PENDING'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Platform</label>
                <div className="flex gap-2">
                  {platforms.map(p => (
                    <button
                      key={p}
                      onClick={() => setV2Platform(p)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors ${v2Platform === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0b1329] border-slate-800 text-slate-400'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Final Post Link</label>
                <input 
                  type="text" 
                  value={v2Link} 
                  onChange={e => setV2Link(e.target.value)} 
                  placeholder="https://..."
                  className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Posting Date/Time</label>
                <input 
                  type="datetime-local" 
                  value={v2PostedAt} 
                  onChange={e => setV2PostedAt(e.target.value)} 
                  className="w-full bg-[#0b1329] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" 
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={v2Confirmed} 
                  onChange={e => setV2Confirmed(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500" 
                />
                <span className="text-xs font-medium text-slate-300">Confirmed Live on platform</span>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button 
                onClick={handleSaveVideo2}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-600/10"
              >
                Save Video 2
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
