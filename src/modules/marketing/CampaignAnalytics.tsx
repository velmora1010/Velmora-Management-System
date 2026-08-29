import React, { useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { Users, Film, IndianRupee, LineChart, Download } from 'lucide-react';
import { CampaignStateBreakdown } from './CampaignStateBreakdown';
import { CampaignPerformanceChart } from './CampaignPerformanceChart';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';
import toast from 'react-hot-toast';

interface CampaignAnalyticsProps {
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  onBack: () => void;
}

import { isArchived } from '../../utils/marketingUtils';

const isFakeUrl = (url: string | null | undefined): boolean => {
  if (!url) return true;
  const lower = url.toLowerCase().trim();
  return (
    lower === '' ||
    lower === 'default' ||
    lower === 'default2' ||
    lower.includes('instagram.com/p/default') ||
    lower.includes('instagram.com/p/default2') ||
    lower === 'placeholder' ||
    lower === 'null' ||
    lower === 'undefined'
  );
};

export const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({ campaign, influencers }) => {
  const { trackingRecords, isLoading: isTrackingLoading } = useCampaignStatusTracking(campaign.id);
  const { dispatchRecords, isLoading: isDispatchLoading } = useCampaignDispatch(campaign.id);

  const activeInfluencers = useMemo(() => influencers.filter(inf => !isArchived(inf.is_archived)), [influencers]);

  const metrics = useMemo(() => {
    let diyCount = 0;
    let spongeCount = 0;
    let diyVideos = 0;
    let spongeVideos = 0;
    let diyBudget = 0;
    let spongeBudget = 0;

    activeInfluencers.forEach(inf => {
      const p = inf.pricing;
      if (p) {
        const v1Count = Number(p.video1_count) || 0;
        const v2Count = Number(p.video2_count) || 0;
        
        if (v1Count > 0) diyCount++;
        if (v2Count > 0) spongeCount++;

        diyVideos += v1Count;
        spongeVideos += v2Count;

        diyBudget += Number(p.video1_price) || 0;
        spongeBudget += Number(p.video2_price) || 0;
      }
    });

    const totalInfluencers = activeInfluencers.length;
    const totalVideos = diyVideos + spongeVideos;
    const totalBudget = diyBudget + spongeBudget;

    const avgBudget = totalVideos > 0 ? Math.round(totalBudget / totalVideos) : 0;
    const avgDiy = diyVideos > 0 ? Math.round(diyBudget / diyVideos) : 0;
    const avgSponge = spongeVideos > 0 ? Math.round(spongeBudget / spongeVideos) : 0;

    return {
      totalInfluencers,
      diyCount,
      spongeCount,
      totalVideos,
      diyVideos,
      spongeVideos,
      totalBudget,
      diyBudget,
      spongeBudget,
      avgBudget,
      avgDiy,
      avgSponge
    };
  }, [activeInfluencers]);

  // 1. Campaign Summary Calculations
  const budgetUsed = metrics.totalBudget;
  const targetLanguagesStr = useMemo(() => {
    let parsed: string[] = [];
    try {
      if (typeof campaign.target_languages === 'string') {
        const p = JSON.parse(campaign.target_languages);
        parsed = Array.isArray(p) ? p : [campaign.target_languages];
      } else if (Array.isArray(campaign.target_languages)) {
        parsed = campaign.target_languages;
      }
    } catch (e) {
      if (typeof campaign.target_languages === 'string') {
        parsed = [campaign.target_languages];
      }
    }
    return parsed.length > 0 ? parsed.join(', ') : 'N/A';
  }, [campaign.target_languages]);

  // 2. Workflow & Video & Payment Live Calculations
  const {
    dispatchedCount,
    deliveredCount,
    payAdvanceCount,
    refVideosCount,
    expTimelineCount,
    draft1Count,
    draft2Count,
    payRemainingCount,
    finalPostCount,
    totalPendingSteps,
    totalVideosRequired,
    totalVideosPosted,
    video1Completed,
    video2Completed,
    pendingVideos,
    totalPaid,
    remainingPayment,
    pendingPaymentsCount
  } = useMemo(() => {
    const dispCount = dispatchRecords.length;
    let delCount = 0;
    let payAdvCount = 0;
    let refVCount = 0;
    let expTimeCount = 0;
    let dr1Count = 0;
    let dr2Count = 0;
    let payRemCount = 0;
    let finPCount = 0;
    let pendSteps = 0;

    let vRequired = 0;
    let v1Done = 0;
    let v2Done = 0;

    let paidSum = 0;
    let remPaySum = 0;
    let pendPayCount = 0;

    trackingRecords.forEach(r => {
      const influencerVids = Number((r.pricing as any)?.total_videos) || 1;
      vRequired += influencerVids;

      if (r.delivered_confirmed) delCount++;
      if (r.pay_advance_completed) payAdvCount++;
      if (r.reference_video_received) refVCount++;
      if (r.expected_delivery_completed) expTimeCount++;
      if (r.draft_received || !!r.draft_video_url) dr1Count++;
      
      const isD2Done = (r.draft_approval_status === 'Approved') || !!r.re_draft_video_url;
      if (isD2Done) dr2Count++;
      if (r.payment_remaining_completed) payRemCount++;
      if (r.final_post_completed) finPCount++;

      // Video 1 and Video 2 Live status
      let metadata: any = {};
      try {
        metadata = JSON.parse(r.notes || '{}');
      } catch (e) {}

      const rawV1Link = metadata.video1_final_post_link || r.final_post_link;
      const v1DoneFlag = !!(metadata.video1_confirmed || r.final_post_completed) && 
                         !isFakeUrl(rawV1Link) && 
                         !!(metadata.video1_posted_at || r.final_post_actual_datetime);
      
      const v2DoneFlag = !!metadata.video2_confirmed && 
                         !isFakeUrl(metadata.video2_final_post_link) && 
                         !!metadata.video2_posted_at;

      if (v1DoneFlag) v1Done++;
      if (v2DoneFlag) v2Done++;

      // Pending steps calculation
      if (!r.delivered_confirmed) pendSteps++;
      if (!r.pay_advance_completed) pendSteps++;
      if (!r.reference_video_received) pendSteps++;
      if (!r.expected_delivery_completed) pendSteps++;
      if (!r.draft_video_url) pendSteps++;
      if (influencerVids === 2 && !isD2Done) pendSteps++;
      if (!r.payment_remaining_completed) pendSteps++;
      if (!v1DoneFlag) pendSteps++;
      if (influencerVids === 2 && !v2DoneFlag) pendSteps++;

      // Payments calculations
      const advPaid = Number(r.advance_paid_amount) || 0;
      const finalPrice = Number(r.pricing?.final_price) || 0;
      const remainingPrice = finalPrice - advPaid;
      
      paidSum += advPaid;
      if (r.payment_remaining_completed) {
        paidSum += remainingPrice;
      } else {
        remPaySum += remainingPrice;
        pendPayCount++;
      }
    });

    const vPosted = v1Done + v2Done;
    const pendVideos = Math.max(0, vRequired - vPosted);

    return {
      dispatchedCount: dispCount,
      deliveredCount: delCount,
      payAdvanceCount: payAdvCount,
      refVideosCount: refVCount,
      expTimelineCount: expTimeCount,
      draft1Count: dr1Count,
      draft2Count: dr2Count,
      payRemainingCount: payRemCount,
      finalPostCount: finPCount,
      totalPendingSteps: pendSteps,
      totalVideosRequired: vRequired,
      totalVideosPosted: vPosted,
      video1Completed: v1Done,
      video2Completed: v2Done,
      pendingVideos: pendVideos,
      totalPaid: paidSum,
      remainingPayment: remPaySum,
      pendingPaymentsCount: pendPayCount
    };
  }, [trackingRecords, dispatchRecords]);

  // 3. Platform Distribution Calculations
  const { instagramCount, youtubeCount, facebookCount } = useMemo(() => {
    let insta = 0;
    let yt = 0;
    let fb = 0;
    activeInfluencers.forEach(inf => {
      const hasInsta = inf.platforms?.some(p => p.platform.toLowerCase() === 'instagram');
      const hasYt = inf.platforms?.some(p => p.platform.toLowerCase() === 'youtube');
      const hasFb = inf.platforms?.some(p => p.platform.toLowerCase() === 'facebook');
      if (hasInsta) insta++;
      if (hasYt) yt++;
      if (hasFb) fb++;
    });
    return { instagramCount: insta, youtubeCount: yt, facebookCount: fb };
  }, [activeInfluencers]);

  const handleExportCsv = () => {
    if (activeInfluencers.length === 0) {
      toast.error('No active influencers to export.');
      return;
    }

    const productCodeMap: Record<string, string> = {
      'diy detergent liquid': '1B',
      'diy dishwash liquid': '1Y',
      'diy fabric conditioner': '1P',
      'magic sponge': '1S',
      'kitchen cleaner': 'KC',
      'car wash': 'CW',
      'bike wash': 'BW',
      'bbc': 'BBC',
      'hand wash': 'HW',
      'glass cleaner': 'GC',
      'bamboo towel': 'BT',
      'floor cleaner': 'FC'
    };

    const headers = ['User Name', 'Influencer Name', 'Phone Number', 'Alt Phone', 'City', 'State', 'Address', 'Products'];
    const rows = [headers.join(',')];

    activeInfluencers.forEach(inf => {
      const userName = `"${(inf.name || '').replace(/"/g, '""')}"`;
      const infName = `"${(inf.influencer_name || '').replace(/"/g, '""')}"`;
      const phone = `"${(inf.phone_number || '').replace(/"/g, '""')}"`;
      const altPhone = `"${(inf.alternative_number || '').replace(/"/g, '""')}"`;
      const city = `"${(inf.city || '').replace(/"/g, '""')}"`;
      const state = `"${(inf.state || '').replace(/"/g, '""')}"`;
      const address = `"${(inf.complete_address || '').replace(/"/g, '""')}"`;

      const productCodes = new Set<string>();
      if (inf.products && inf.products.length > 0) {
        inf.products.forEach(p => {
          const pname = (p.product_name || '').toLowerCase().trim();
          if (productCodeMap[pname]) {
            productCodes.add(productCodeMap[pname]);
          }
        });
      }
      const productsStr = `"${Array.from(productCodes).join(',')}"`;

      rows.push([userName, infName, phone, altPhone, city, state, address, productsStr].join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const campaignName = campaign.campaign_name || 'export';
    const safeFileName = campaignName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    link.setAttribute('href', url);
    link.setAttribute('download', `influencers-${safeFileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isTrackingLoading || isDispatchLoading) {
    return (
      <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-6 flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm mt-4">Loading campaign analytics...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Campaign Analytics</h2>
          <p className="text-slate-400 text-sm">Analytics for selected campaign</p>
        </div>
        <button 
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Influencers */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between min-h-[140px]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
              <Users size={24} />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Total Influencers</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{(metrics?.totalInfluencers ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">{(metrics?.diyCount ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">{(metrics?.spongeCount ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Total Videos */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between min-h-[140px]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg shrink-0">
              <Film size={24} />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Total Videos</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{(metrics?.totalVideos ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">{(metrics?.diyVideos ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">{(metrics?.spongeVideos ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Total Budget */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between min-h-[140px]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
              <IndianRupee size={24} />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Total Budget</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">₹{(metrics?.totalBudget ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">₹{(metrics?.diyBudget ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">₹{(metrics?.spongeBudget ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Avg Budget Per Video */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between min-h-[140px]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
              <LineChart size={24} />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Avg Budget Per Video</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">₹{(metrics?.avgBudget ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">₹{(metrics?.avgDiy ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">₹{(metrics?.avgSponge ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Campaign Summary & Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Campaign Summary */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-3">📋 Campaign Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Budget Used</span>
              <span className="text-slate-200 font-semibold">₹{(budgetUsed ?? 0).toLocaleString()} / ₹{(campaign?.total_budget ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Onboarded Influencers</span>
              <span className="text-slate-200 font-semibold">{activeInfluencers.length} / {campaign.expected_influencers || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Video</span>
              <span className="text-slate-200 font-semibold">{totalVideosPosted} / {totalVideosRequired}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Languages</span>
              <span className="text-slate-200 font-semibold truncate max-w-[250px]">{targetLanguagesStr}</span>
            </div>
          </div>
        </div>

        {/* Platform Statistics */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-3">📱 Platform Distribution</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Instagram Influencers</span>
              <span className="text-slate-200 font-semibold">{instagramCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">YouTube Influencers</span>
              <span className="text-slate-200 font-semibold">{youtubeCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Facebook Influencers</span>
              <span className="text-slate-200 font-semibold">{facebookCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Stats & Video/Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Workflow Statistics */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-3">
          <h3 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-3">🔄 Workflow Step Completion</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Influencers Tracked</span>
              <span className="text-slate-200 font-semibold">{trackingRecords.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dispatched Products</span>
              <span className="text-slate-200 font-semibold">{dispatchedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Delivered</span>
              <span className="text-slate-200 font-semibold">{deliveredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pay Advance Completed</span>
              <span className="text-slate-200 font-semibold">{payAdvanceCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reference Videos Sent</span>
              <span className="text-slate-200 font-semibold">{refVideosCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expected Timeline Set</span>
              <span className="text-slate-200 font-semibold">{expTimelineCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Draft 1 Completed</span>
              <span className="text-slate-200 font-semibold">{draft1Count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Draft 2 Completed</span>
              <span className="text-slate-200 font-semibold">{draft2Count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remaining Payment Completed</span>
              <span className="text-slate-200 font-semibold">{payRemainingCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Final Post Completed</span>
              <span className="text-slate-200 font-semibold">{finalPostCount}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700/50">
              <span className="text-slate-300 font-semibold">Pending Workflow Steps</span>
              <span className="text-indigo-400 font-bold">{totalPendingSteps}</span>
            </div>
          </div>
        </div>

        {/* Video & Payment Statistics */}
        <div className="space-y-6">
          {/* Video Statistics */}
          <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-3">
            <h3 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-3">🎬 Video Deliverables</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Videos Required</span>
                <span className="text-slate-200 font-semibold">{totalVideosRequired}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Videos Posted</span>
                <span className="text-slate-200 font-semibold">{totalVideosPosted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Video 1 Completed</span>
                <span className="text-slate-200 font-semibold">{video1Completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Video 2 Completed</span>
                <span className="text-slate-200 font-semibold">{video2Completed}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700/50">
                <span className="text-slate-300 font-semibold">Pending Videos</span>
                <span className="text-rose-400 font-bold">{pendingVideos}</span>
              </div>
            </div>
          </div>

          {/* Payment Statistics */}
          <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-3">
            <h3 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-3">💰 Financial Settlement</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Budget Booked</span>
                <span className="text-slate-200 font-semibold">₹{(budgetUsed ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Paid Amount</span>
                <span className="text-slate-205 text-emerald-400 font-bold">₹{(totalPaid ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Remaining Payment</span>
                <span className="text-slate-205 text-orange-400 font-bold">₹{(remainingPayment ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700/50">
                <span className="text-slate-300 font-semibold">Pending Remaining Payments</span>
                <span className="text-amber-400 font-bold">{pendingPaymentsCount} creators</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Layout Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
        
        {/* Left Col: State Breakdown */}
        <div className="lg:col-span-7">
          <CampaignStateBreakdown influencers={influencers} />
        </div>

        {/* Right Col: Performance Chart */}
        <div className="lg:col-span-5">
          <CampaignPerformanceChart metrics={metrics} />
        </div>

      </div>
    </div>
  );
};
