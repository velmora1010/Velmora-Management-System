import React, { useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { Users, Film, IndianRupee, LineChart, Download } from 'lucide-react';
import { CampaignStateBreakdown } from './CampaignStateBreakdown';
import { CampaignPerformanceChart } from './CampaignPerformanceChart';
import toast from 'react-hot-toast';

interface CampaignAnalyticsProps {
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  onBack: () => void;
}

export const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({ campaign, influencers }) => {
  const metrics = useMemo(() => {

    const activeInfluencers = influencers.filter(inf => !inf.is_archived);
    
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

      } else {
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
  }, [influencers]);

  const handleExportCsv = () => {
    const activeInfluencers = influencers.filter(inf => !inf.is_archived);
    
    if (activeInfluencers.length === 0) {
      toast.error('No active influencers to export.');
      return;
    }

    const productCodeMap: Record<string, string> = {
      'diy detergent liquid': '1B',
      'diy dishwash liquid': '1Y',
      'diy fabric conditioner': '1P',
      'magic sponge': '1S'
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Total Influencers */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between min-h-[140px]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
              <Users size={24} />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Total Influencers</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{metrics.totalInfluencers.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">{metrics.diyCount.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">{metrics.spongeCount.toLocaleString()}</span>
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
              <div className="text-2xl font-bold text-slate-100 mt-1">{metrics.totalVideos.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">{metrics.diyVideos.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">{metrics.spongeVideos.toLocaleString()}</span>
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
              <div className="text-2xl font-bold text-slate-100 mt-1">₹{metrics.totalBudget.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">₹{metrics.diyBudget.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">₹{metrics.spongeBudget.toLocaleString()}</span>
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
              <div className="text-2xl font-bold text-slate-100 mt-1">₹{metrics.avgBudget.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700/50 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">DIY</span>
              <span className="text-slate-200 font-medium">₹{metrics.avgDiy.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-xs">Sponge</span>
              <span className="text-slate-200 font-medium">₹{metrics.avgSponge.toLocaleString()}</span>
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
